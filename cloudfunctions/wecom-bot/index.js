/**
 * wecom-bot v1.1 — 企业微信AI机器人 HTTP 云函数
 *
 * 路径：/wecom/callback
 *   GET  — URL验证
 *   POST — 接收消息 → 自动回复
 *
 * 配置（CloudBase 环境变量）：
 *   WECOM_CORP_ID / WECOM_TOKEN / WECOM_ENCODING_AES_KEY / WECOM_AGENT_SECRET / WECOM_AGENT_ID
 */

const crypto = require('crypto');

// V1 速率限制: 基于 fromUser 的简单内存计数器 (每分钟上限20条)
var _rateLimitMap = {};
function rateLimitCheck(fromUser) {
  var now = Date.now();
  var key = fromUser;
  var entry = _rateLimitMap[key];
  if (!entry || now - entry.resetAt > 60000) {
    _rateLimitMap[key] = { count: 1, resetAt: now };
    return true;
  }
  entry.count++;
  return entry.count <= 20;
}

// ============ 配置 ============
// 敏感凭据仅从 CloudBase 环境变量读取，严禁硬编码
const CONFIG = {
  corpId: process.env.WECOM_CORP_ID,
  token: process.env.WECOM_TOKEN,
  encodingAESKey: process.env.WECOM_ENCODING_AES_KEY,
  agentSecret: process.env.WECOM_AGENT_SECRET,
  agentId: process.env.WECOM_AGENT_ID
};

// AES Key = Base64.decode(EncodingAESKey + "=")
var AESKey = CONFIG.encodingAESKey ? Buffer.from(CONFIG.encodingAESKey + '=', 'base64') : null;

// ============ SCF HTTP 云函数入口 ============
exports.main = async (event, context) => {
  // 延迟校验：仅在首次请求时检查，避免模块加载时崩溃
  if (!AESKey) {
    return { statusCode: 500, body: 'ENV not configured' };
  }
  try {
    var method = (event.httpMethod || '').toUpperCase();
    if (method === 'GET') {
      return await handleVerify(event);
    } else if (method === 'POST') {
      return await handleMessage(event);
    }
    return { statusCode: 405, body: 'Method Not Allowed' };
  } catch (err) {
    console.error('[wecom-bot]', err);
    return { statusCode: 500, body: 'Internal Error' };
  }
};

// ============ GET: URL验证 ============
async function handleVerify(event) {
  var params = event.queryStringParameters || {};
  var msgSignature = params.msg_signature || '';
  var timestamp = params.timestamp || '';
  var nonce = params.nonce || '';
  var echostr = params.echostr || '';

  if (!msgSignature || !timestamp || !nonce || !echostr) {
    return { statusCode: 400, body: 'Missing params' };
  }

  var sig = verifySignature(msgSignature, timestamp, nonce, echostr);
  if (!sig) {
    console.log('[wecom-bot] 签名验证失败');
    return { statusCode: 403, body: 'Signature verification failed' };
  }

  var decrypted = decrypt(echostr);
  console.log('[wecom-bot] URL验证成功');
  return { statusCode: 200, headers: { 'Content-Type': 'text/plain' }, body: decrypted.message };
}

// ============ POST: 接收消息 ============
async function handleMessage(event) {
  var body = event.body || '';
  var params = event.queryStringParameters || {};

  // 请求体大小限制 64KB
  if (body.length > 65536) {
    return { statusCode: 413, body: 'Payload too large' };
  }

  // 解析XML，提取Encrypt字段
  var encrypt = extractXmlField(body, 'Encrypt');
  if (!encrypt) {
    return { statusCode: 400, body: 'Missing Encrypt' };
  }

  var msgSignature = params.msg_signature || '';
  var timestamp = params.timestamp || '';
  var nonce = params.nonce || '';

  // 验证签名
  var sig = verifySignature(msgSignature, timestamp, nonce, encrypt);
  if (!sig) {
    return { statusCode: 403, body: 'Signature failed' };
  }

  // 解密消息
  var decrypted = decrypt(encrypt);
  var xmlContent = decrypted.message;

  // 提取消息字段
  var msgType = extractXmlField(xmlContent, 'MsgType');
  var fromUser = extractXmlField(xmlContent, 'FromUserName');
  var toUser = extractXmlField(xmlContent, 'ToUserName');
  var content = extractXmlField(xmlContent, 'Content') || '';
  var msgId = extractXmlField(xmlContent, 'MsgId');

  // 日志仅输出脱敏信息
  console.log('[wecom-bot] 收到消息: type=' + msgType + ', len=' + (content ? content.length : 0));

  // 速率限制: 每用户每分钟最多20条
  if (!rateLimitCheck(fromUser)) {
    console.log('[wecom-bot] 速率限制触发: from=' + fromUser.slice(0, 6) + '***');
    return { statusCode: 429, body: 'Rate limited' };
  }

  // 只处理文本消息
  var replyContent = '';
  if (msgType === 'text') {
    replyContent = generateReply(content);
  } else if (msgType === 'event') {
    var eventType = extractXmlField(xmlContent, 'Event');
    if (eventType === 'subscribe' || eventType === 'enter_agent') {
      replyContent = '👋 你好！我是住港伴智能助手。\n\n你可以直接告诉我遇到的问题，我会尽力帮你解决。\n\n如需人工客服，请说"转人工"。';
    }
  } else {
    replyContent = '目前仅支持文字消息，请用文字描述你的问题。';
  }

  // 构建回复XML
  var now = Math.floor(Date.now() / 1000);
  var replyXml = buildTextReplyXml(fromUser, toUser, now, replyContent);

  // 加密回复
  var encrypted = encryptReply(replyXml, CONFIG.corpId);
  var replySig = generateSignature(CONFIG.token, String(now), nonce, encrypted);

  // 返回加密XML
  var responseXml = '<xml>' +
    '<Encrypt><![CDATA[' + encrypted + ']]></Encrypt>' +
    '<MsgSignature><![CDATA[' + replySig + ']]></MsgSignature>' +
    '<TimeStamp>' + now + '</TimeStamp>' +
    '<Nonce><![CDATA[' + nonce + ']]></Nonce>' +
    '</xml>';

  return { statusCode: 200, headers: { 'Content-Type': 'application/xml; charset=utf-8' }, body: responseXml };
}

// ============ 自动回复生成 ============
function generateReply(content) {
  var text = content.toLowerCase().trim();

  // 转人工
  if (text.indexOf('转人工') !== -1 || text.indexOf('人工') !== -1 || text.indexOf('客服') !== -1) {
    return '已为你转接人工客服。\n\n💡 你也可以直接添加客服微信，获取1对1即时沟通。\n\n请在小程序中操作："我的→意见反馈→扫码咨询客服"。';
  }

  // 关键词匹配
  if (text.indexOf('bug') !== -1 || text.indexOf('闪退') !== -1 || text.indexOf('报错') !== -1 || text.indexOf('异常') !== -1 || text.indexOf('崩溃') !== -1) {
    return '收到你的问题反馈！\n\n建议你在住港伴小程序的"我的→意见反馈"中提交详细信息（可附截图），我们的技术团队会尽快排查。\n\n如需紧急处理，请回复"转人工"。';
  }

  if (text.indexOf('续签') !== -1 || text.indexOf('延期') !== -1) {
    return '关于续签，建议查看住港伴攻略书中的"续签专区"，里面有完整的材料清单和流程指引。\n\n你也可以在AI对话中直接提问，获取针对性建议。';
  }

  if (text.indexOf('证件') !== -1 || text.indexOf('材料') !== -1 || text.indexOf('ocr') !== -1) {
    return '证件相关的问题，建议使用住港伴的"证件夹"功能进行管理。\n\n如果遇到OCR识别问题，请在"我的→意见反馈"中提交详情，我们会优化识别引擎。';
  }

  if (text.indexOf('永居') !== -1 || text.indexOf('永久') !== -1) {
    return '永居申请相关的问题，建议查看住港伴攻略书中的"永居冲刺"章节，或使用AI对话获取个性化评估。';
  }

  if (text.indexOf('你好') !== -1 || text.indexOf('hi') !== -1 || text.indexOf('hello') !== -1) {
    return '你好！我是住港伴智能助手 👋\n\n你可以问我：\n• 续签材料有哪些？\n• 证件OCR识别问题\n• 永居申请流程\n• 反馈Bug或问题\n\n如需人工客服，请回复"转人工"。';
  }

  // 默认回复
  return '收到你的消息！\n\n📋 如需提交反馈或报告问题，请在住港伴小程序中操作："我的→意见反馈"\n\n💡 常见问题也可以直接在AI对话中提问。\n\n如需人工客服，请回复"转人工"。';
}

// ============ 企微加解密函数 ============
function verifySignature(msgSignature, timestamp, nonce, encrypt) {
  var sig = generateSignature(CONFIG.token, timestamp, nonce, encrypt);
  return sig === msgSignature;
}

function generateSignature(token, timestamp, nonce, encrypt) {
  var arr = [token, timestamp, nonce, encrypt].sort();
  var str = arr.join('');
  return crypto.createHash('sha1').update(str, 'utf-8').digest('hex');
}

function decrypt(encryptText) {
  var aesKey = AESKey;
  var iv = aesKey.slice(0, 16);
  var decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
  decipher.setAutoPadding(false);
  var decrypted = Buffer.concat([decipher.update(encryptText, 'base64'), decipher.final()]);

  // 去除PKCS7填充
  var padLen = decrypted[decrypted.length - 1];
  var unpadded = decrypted.slice(0, decrypted.length - padLen);

  // 解析: random(16) + msgLen(4) + msg + corpId
  var msgLen = unpadded.readUInt32BE(16);
  var message = unpadded.slice(20, 20 + msgLen).toString('utf-8');
  var corpId = unpadded.slice(20 + msgLen).toString('utf-8');

  return { message: message, corpId: corpId };
}

function encryptReply(xmlContent, corpId) {
  var random = crypto.randomBytes(16);
  var msgBuffer = Buffer.from(xmlContent, 'utf-8');
  var msgLen = Buffer.alloc(4);
  msgLen.writeUInt32BE(msgBuffer.length, 0);
  var corpBuffer = Buffer.from(corpId, 'utf-8');

  var raw = Buffer.concat([random, msgLen, msgBuffer, corpBuffer]);

  // PKCS7 padding
  var blockSize = 32;
  var padLen = blockSize - (raw.length % blockSize);
  var padded = Buffer.concat([raw, Buffer.alloc(padLen, padLen)]);

  var aesKey = AESKey;
  var iv = aesKey.slice(0, 16);
  var cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
  cipher.setAutoPadding(false);
  var encrypted = Buffer.concat([cipher.update(padded), cipher.final()]);
  return encrypted.toString('base64');
}

// ============ XML工具 ============
function extractXmlField(xml, fieldName) {
  var regex = new RegExp('<' + fieldName + '><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></' + fieldName + '>');
  var match = xml.match(regex);
  if (match) return match[1];
  var regex2 = new RegExp('<' + fieldName + '>([\\s\\S]*?)</' + fieldName + '>');
  var match2 = xml.match(regex2);
  return match2 ? match2[1] : null;
}

function buildTextReplyXml(fromUser, toUser, timestamp, content) {
  // 转义 CDATA 中的 ]]> 序列，防止注入
  var safeFromUser = escapeCdata(fromUser);
  var safeToUser = escapeCdata(toUser);
  var safeContent = escapeCdata(content);
  return '<xml>' +
    '<ToUserName><![CDATA[' + safeFromUser + ']]></ToUserName>' +
    '<FromUserName><![CDATA[' + safeToUser + ']]></FromUserName>' +
    '<CreateTime>' + timestamp + '</CreateTime>' +
    '<MsgType><![CDATA[text]]></MsgType>' +
    '<Content><![CDATA[' + safeContent + ']]></Content>' +
    '</xml>';
}

// CDATA 转义: ]]> → ]]]]><![CDATA[>
function escapeCdata(str) {
  return String(str).replace(/\]\]>/g, ']]]]><![CDATA[>');
}
