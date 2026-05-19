/**
 * wecom-bot v1.0 — 企业微信AI机器人回调云函数
 *
 * 功能：
 *   GET  / — URL验证（企业微信回调配置验证）
 *   POST / — 接收用户消息 → 语义匹配 → 自动回复
 *
 * 配置（环境变量）：
 *   WECOM_CORP_ID       — 企业ID
 *   WECOM_TOKEN         — 回调Token
 *   WECOM_ENCODING_AES_KEY — 消息加密密钥
 *   WECOM_AGENT_SECRET  — 应用Secret（用于主动发消息）
 *   WECOM_AGENT_ID      — 应用AgentId
 */

const crypto = require('crypto');
const http = require('http');

// ============ 配置 ============
const CONFIG = {
  corpId: process.env.WECOM_CORP_ID || 'ww6dd588ba1ed37cd0',
  token: process.env.WECOM_TOKEN || 'vdNbgJJVfxd7H4YlwzpnPz5B',
  encodingAESKey: process.env.WECOM_ENCODING_AES_KEY || 'Mp1D2ErPUkR4KYbfksr8coB2HEzimUieKTGJcREgXza',
  agentSecret: process.env.WECOM_AGENT_SECRET || 'Vda6DjM2U2TPjezaUUVxjANPvNyu07Rr4wsIbhC-2Fo',
  agentId: process.env.WECOM_AGENT_ID || '1000002'
};

// AES Key = Base64.decode(EncodingAESKey + "=")
var AESKey = Buffer.from(CONFIG.encodingAESKey + '=', 'base64');

// ============ HTTP Server ============
var server = http.createServer(async function(req, res) {
  try {
    if (req.method === 'GET') {
      await handleVerify(req, res);
    } else if (req.method === 'POST') {
      await handleMessage(req, res);
    } else {
      res.writeHead(405);
      res.end('Method Not Allowed');
    }
  } catch (err) {
    console.error('[wecom-bot]', err);
    res.writeHead(500);
    res.end('Internal Error');
  }
});

server.listen(9000, function() {
  console.log('[wecom-bot] 企微机器人回调服务已启动 :9000');
});

// ============ GET: URL验证 ============
async function handleVerify(req, res) {
  var url = new URL(req.url, 'http://localhost');
  var msgSignature = url.searchParams.get('msg_signature') || '';
  var timestamp = url.searchParams.get('timestamp') || '';
  var nonce = url.searchParams.get('nonce') || '';
  var echostr = url.searchParams.get('echostr') || '';

  if (!msgSignature || !timestamp || !nonce || !echostr) {
    res.writeHead(400);
    res.end('Missing params');
    return;
  }

  // 验证签名
  var sig = verifySignature(msgSignature, timestamp, nonce, echostr);
  if (!sig) {
    console.log('[wecom-bot] 签名验证失败');
    res.writeHead(403);
    res.end('Signature verification failed');
    return;
  }

  // 解密echostr
  var decrypted = decrypt(echostr);
  console.log('[wecom-bot] URL验证成功');
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(decrypted.message);
}

// ============ POST: 接收消息 ============
async function handleMessage(req, res) {
  var body = '';
  req.on('data', function(chunk) { body += chunk; });
  req.on('end', async function() {
    // 解析XML，提取Encrypt字段
    var encrypt = extractXmlField(body, 'Encrypt');
    if (!encrypt) {
      res.writeHead(400);
      res.end('Missing Encrypt');
      return;
    }

    // URL参数
    var url = new URL(req.url, 'http://localhost');
    var msgSignature = url.searchParams.get('msg_signature') || '';
    var timestamp = url.searchParams.get('timestamp') || '';
    var nonce = url.searchParams.get('nonce') || '';

    // 验证签名
    var sig = verifySignature(msgSignature, timestamp, nonce, encrypt);
    if (!sig) {
      res.writeHead(403);
      res.end('Signature failed');
      return;
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

    console.log('[wecom-bot] 收到消息: from=' + fromUser + ', type=' + msgType + ', content=' + content);

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

    res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' });
    res.end(responseXml);
  });
}

// ============ 自动回复生成 ============
function generateReply(content) {
  var text = content.toLowerCase().trim();

  // 转人工
  if (text.indexOf('转人工') !== -1 || text.indexOf('人工') !== -1 || text.indexOf('客服') !== -1) {
    return '已为你转接人工客服。\n\n💡 你也可以直接添加客服微信，获取1对1即时沟通。\n\n请长按下方二维码或在"住港伴小程序→我的→意见反馈→添加客服微信"中扫码添加。';
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
  return '<xml>' +
    '<ToUserName><![CDATA[' + fromUser + ']]></ToUserName>' +
    '<FromUserName><![CDATA[' + toUser + ']]></FromUserName>' +
    '<CreateTime>' + timestamp + '</CreateTime>' +
    '<MsgType><![CDATA[text]]></MsgType>' +
    '<Content><![CDATA[' + content + ']]></Content>' +
    '</xml>';
}
