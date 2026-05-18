/**
 * content-moderation v1.1 — 内容安全审核云函数
 * 
 * 封装腾讯云文本内容安全 (TMS) TextModeration API
 * 原生实现，零外部依赖。DB 缓存/日志为可选功能。
 */

// === wx-server-sdk 安全加载（CloudBase 运行时预装，但某些环境可能缺失）===
var cloud, db, _;
try {
  cloud = require('wx-server-sdk');
  cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
  db = cloud.database();
  _ = db.command;
} catch (e) {
  console.log('[content-moderation] wx-server-sdk 不可用，DB功能降级');
  cloud = null; db = null; _ = null;
}

// ============ 配置 ============
var ENV = {
  secretId: process.env.TENCENT_SECRET_ID || '',
  secretKey: process.env.TENCENT_SECRET_KEY || '',
  bizType: 'zhugangban_guidebook'
};

// SEC-H01: 模块加载时检测密钥空值，致命告警
if (!ENV.secretId || !ENV.secretKey) {
  console.error('[content-moderation] FATAL: TENCENT_SECRET_ID 或 TENCENT_SECRET_KEY 未配置！TMS API 将无法使用。');
}

// SEC-C02: 降级熔断器 — 全局变量追踪连续降级调用
var degradeCount = 0;
var degradeThreshold = 5;
var degradeWindowMs = 60000;
var degradeWindowStart = 0;

// SEC-H04: PII脱敏函数 — 手机号/身份证/邮箱正则替换
function sanitizePII(text) {
  if (!text) return text;
  try {
    var s = text;
    // 手机号
    s = s.replace(/1[3-9]\d{9}/g, '[手机号已脱敏]');
    // 身份证
    s = s.replace(/\d{6}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]/g, '[身份证已脱敏]');
    // 邮箱
    s = s.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[邮箱已脱敏]');
    return s;
  } catch (e) { return text; }
}

// ============ 主入口 ============
exports.main = async (event) => {
  var action = event.action;
  try {
    if (action === 'moderateText')  return await moderateText(event);
    if (action === 'moderateImage') return await moderateImage(event);
    if (action === 'moderateBatch') return await moderateBatch(event);
    if (action === 'checkStatus')   return await checkStatus();
    return { code: 400, msg: '不支持 action: ' + action };
  } catch (err) {
    console.error('[content-moderation]', err);
    return { code: 500, msg: '审核异常: ' + err.message };
  }
};

// ============ 单条文本审核 ============
async function moderateText(event) {
  var content = event.content;
  var dataId = event.dataId;
  var source = event.source || 'unknown';
  
  if (!content || content.trim().length === 0) {
    return { code: 400, msg: '内容不能为空' };
  }
  
  // 截断至 10,000 字符（TMS 限制）
  var text = content.substring(0, 10000);
  var hash = cryptoHash(text);
  
  // 1. 检查缓存（DB 不可用时跳过）
  if (db) {
    try {
      var cached = await checkCache(hash);
      if (cached) return { code: 0, data: { suggestion: cached.suggestion, label: cached.label, score: cached.score, keywords: cached.keywords || [], cached: true } };
    } catch(e) { /* ignore */ }
  }
  
  // 2. 降级熔断检查
  var now = Date.now();
  if (now - degradeWindowStart > degradeWindowMs) {
    degradeCount = 0;
    degradeWindowStart = now;
  }
  if (degradeCount >= degradeThreshold) {
    return { code: 0, data: { suggestion: 'Pass', label: 'Normal', score: 0, keywords: [], degraded: true, degradeReason: 'TMS API 暂时不可用' } };
  }

  // 3. 调用 TMS API
  var result;
  try {
    result = await callTMS(text, dataId);
    // 调用成功，重置熔断计数
    if (degradeCount > 0) { degradeCount = 0; }
  } catch (apiErr) {
    console.error('[content-moderation] TMS API 失败:', apiErr.message);
    // 降级熔断计数
    degradeCount++;
    if (degradeCount === 1) degradeWindowStart = Date.now();
    // 降级：API 不可用时放行
    return { code: 0, data: { suggestion: 'Pass', label: 'Normal', score: 0, keywords: [], degraded: true, degradeReason: 'TMS API 暂时不可用' } };
  }
  
  // 3. 记录日志（可选）
  if (db) {
    try { await logModeration({ dataId: dataId || hash, contentHash: hash, contentPreview: sanitizePII(text.substring(0, 200)), source: source, suggestion: result.suggestion, label: result.label, score: result.score, createdAt: new Date() }); } catch(e) {}
    try { await saveCache(hash, result); } catch(e) {}
  }
  
  return { code: 0, data: { suggestion: result.suggestion, label: result.label, score: result.score, keywords: result.keywords || [], cached: false } };
}

// ============ 图片审核（腾讯云 IMS ImageModeration） ============
async function moderateImage(event) {
  var fileID = event.fileID;
  if (!fileID) return { code: 400, msg: '缺少 fileID' };

  // 1. 从云存储下载图片
  var buffer;
  try {
    var downloadRes = await cloud.downloadFile({ fileID: fileID });
    buffer = downloadRes.fileContent;
  } catch (e) {
    console.error('[content-moderation] 图片下载失败:', e.message);
    return { code: 500, msg: '图片下载失败' };
  }

  // 2. Base64编码
  var base64 = buffer.toString('base64');

  // 3. 调用 IMS API
  try {
    var result = await callIMS(base64, fileID);
    var blocked = result.suggestion === 'Block';
    return { code: 0, data: { suggestion: result.suggestion, label: result.label, score: result.score, blocked: blocked } };
  } catch (apiErr) {
    console.error('[content-moderation] IMS API 失败:', apiErr.message);
    // 降级：API 不可用时放行
    return { code: 0, data: { suggestion: 'Pass', label: 'Normal', score: 0, blocked: false, degraded: true } };
  }
}

// ============ 调用 IMS API（TC3-HMAC-SHA256，同 TMS 签名模式） ============
async function callIMS(base64Content, dataId) {
  var crypto = require('crypto');
  var https = require('https');

  var payload = JSON.stringify({
    FileContent: base64Content,
    BizType: ENV.bizType,
    DataId: dataId || ''
  });

  var host = 'ims.tencentcloudapi.com';
  var service = 'ims';
  var action = 'ImageModeration';
  var version = '2020-12-29';
  var algorithm = 'TC3-HMAC-SHA256';
  var timestamp = Math.floor(Date.now() / 1000);
  var date = new Date(timestamp * 1000).toISOString().substring(0, 10);

  var hashedPayload = crypto.createHash('sha256').update(payload).digest('hex');
  var canonicalRequest = 'POST\n/\n\ncontent-type:application/json; charset=utf-8\nhost:' + host + '\n\ncontent-type;host\n' + hashedPayload;
  var hashedCanonicalRequest = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
  var credentialScope = date + '/' + service + '/tc3_request';
  var stringToSign = algorithm + '\n' + timestamp + '\n' + credentialScope + '\n' + hashedCanonicalRequest;

  var kDate = crypto.createHmac('sha256', 'TC3' + ENV.secretKey).update(date).digest();
  var kService = crypto.createHmac('sha256', kDate).update(service).digest();
  var kSigning = crypto.createHmac('sha256', kService).update('tc3_request').digest();
  var signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  var authorization = algorithm + ' Credential=' + ENV.secretId + '/' + credentialScope + ', SignedHeaders=content-type;host, Signature=' + signature;

  return new Promise(function(resolve, reject) {
    var req = https.request({
      hostname: host, port: 443, path: '/', method: 'POST',
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Host': host,
        'Authorization': authorization,
        'X-TC-Action': action,
        'X-TC-Version': version,
        'X-TC-Timestamp': timestamp,
        'X-TC-Region': 'ap-guangzhou'
      }
    }, function(res) {
      var body = '';
      res.on('data', function(c) { body += c; });
      res.on('end', function() {
        try {
          var parsed = JSON.parse(body);
          if (parsed.Response && parsed.Response.Error) {
            reject(new Error(parsed.Response.Error.Message));
            return;
          }
          var r = parsed.Response || {};
          resolve({ suggestion: r.Suggestion || 'Pass', label: r.Label || 'Normal', score: r.Score || 0 });
        } catch (err) { reject(err); }
      });
    });
    req.on('timeout', function() { req.destroy(new Error('IMS API request timeout')); });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ============ 批量文本审核 ============
async function moderateBatch(event) {
  var items = event.items || [];
  var source = event.source || 'batch';
  
  if (items.length === 0) return { code: 400, msg: '审核列表不能为空' };
  if (items.length > 50) return { code: 400, msg: '单次批量不超过50条' };
  
  var results = [];
  var passCount = 0, reviewCount = 0, blockCount = 0;
  
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var res = await moderateText({ content: item.content, dataId: item.dataId, source: item.source || source });
    var data = res.data || {};
    results.push({ dataId: item.dataId, suggestion: data.suggestion, label: data.label, score: data.score, keywords: data.keywords, cached: data.cached, degraded: data.degraded });
    if (data.suggestion === 'Pass') passCount++;
    else if (data.suggestion === 'Review') reviewCount++;
    else if (data.suggestion === 'Block') blockCount++;
  }
  
  return { code: 0, data: { total: items.length, passCount: passCount, reviewCount: reviewCount, blockCount: blockCount, results: results } };
}

// ============ 查询审核统计 ============
async function checkStatus() {
  if (!db) return { code: 0, data: { dbAvailable: false } };
  try {
    var now = new Date();
    var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var totalResult = await db.collection('content_moderation_logs').count();
    var todayResult = await db.collection('content_moderation_logs').where({ createdAt: _.gte(todayStart) }).count();
    var blockedResult = await db.collection('content_moderation_logs').where({ 'suggestion': 'Block', createdAt: _.gte(todayStart) }).count();
    return { code: 0, data: { dbAvailable: true, totalModerated: totalResult.total, todayModerated: todayResult.total, todayBlocked: blockedResult.total } };
  } catch (e) {
    return { code: 0, data: { dbAvailable: false } };
  }
}

// ============ 调用 TMS API（TC3-HMAC-SHA256 签名 + 超时 + 重试） ============
async function callTMS(content, dataId) {
  var maxRetries = 2;
  var lastError;

  for (var attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      var delay = Math.pow(2, attempt - 1) * 1000;
      await new Promise(function(r) { setTimeout(r, delay); });
      console.warn('[content-moderation] TMS API retry ' + attempt + '/' + maxRetries);
    }
    try {
      return await callTMSOnce(content, dataId);
    } catch (err) {
      lastError = err;
      var isNetworkErr = (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND' || (err.message && err.message.indexOf('timeout') >= 0));
      if (attempt < maxRetries && isNetworkErr) {
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

function callTMSOnce(content, dataId) {
  var crypto = require('crypto');
  var https = require('https');

  var payload = JSON.stringify({
    Content: Buffer.from(content, 'utf-8').toString('base64'),
    BizType: ENV.bizType,
    DataId: dataId || '',
    SourceLanguage: 'zh'
  });

  var host = 'tms.tencentcloudapi.com';
  var service = 'tms';
  var action = 'TextModeration';
  var version = '2020-12-29';
  var algorithm = 'TC3-HMAC-SHA256';
  var timestamp = Math.floor(Date.now() / 1000);
  var date = new Date(timestamp * 1000).toISOString().substring(0, 10);

  // Step 1: Canonical Request
  var hashedPayload = crypto.createHash('sha256').update(payload).digest('hex');
  var canonicalRequest = 'POST\n/\n\ncontent-type:application/json; charset=utf-8\nhost:' + host + '\n\ncontent-type;host\n' + hashedPayload;

  // Step 2: String to Sign
  var hashedCanonicalRequest = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
  var credentialScope = date + '/' + service + '/tc3_request';
  var stringToSign = algorithm + '\n' + timestamp + '\n' + credentialScope + '\n' + hashedCanonicalRequest;

  // Step 3: Signature
  var kDate = crypto.createHmac('sha256', 'TC3' + ENV.secretKey).update(date).digest();
  var kService = crypto.createHmac('sha256', kDate).update(service).digest();
  var kSigning = crypto.createHmac('sha256', kService).update('tc3_request').digest();
  var signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  // Step 4: Authorization
  var authorization = algorithm + ' Credential=' + ENV.secretId + '/' + credentialScope + ', SignedHeaders=content-type;host, Signature=' + signature;

  // 发起请求
  return new Promise(function(resolve, reject) {
    var req = https.request({
      hostname: host, port: 443, path: '/', method: 'POST',
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Host': host,
        'Authorization': authorization,
        'X-TC-Action': action,
        'X-TC-Version': version,
        'X-TC-Timestamp': timestamp,
        'X-TC-Region': 'ap-guangzhou'
      }
    }, function(res) {
      var body = '';
      res.on('data', function(c) { body += c; });
      res.on('end', function() {
        try {
          var parsed = JSON.parse(body);
          if (parsed.Response && parsed.Response.Error) {
            reject(new Error(parsed.Response.Error.Message));
            return;
          }
          var r = parsed.Response || {};
          resolve({ suggestion: r.Suggestion || 'Pass', label: r.Label || 'Normal', score: r.Score || 0, keywords: r.Keywords || [] });
        } catch (err) { reject(err); }
      });
    });
    req.on('timeout', function() {
      req.destroy(new Error('TMS API request timeout'));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ============ DB 辅助（仅当 wx-server-sdk 可用） ============
async function checkCache(hash) {
  var result = await db.collection('moderation_cache').where({ hash: hash, expireAt: _.gte(new Date()) }).get();
  return (result.data && result.data.length > 0) ? result.data[0].result : null;
}

async function saveCache(hash, result) {
  await db.collection('moderation_cache').add({ data: { hash: hash, result: result, expireAt: new Date(Date.now() + 86400000), createdAt: new Date() } });
}

async function logModeration(entry) {
  await db.collection('content_moderation_logs').add({ data: entry });
}

function cryptoHash(str) {
  try {
    var crypto = require('crypto');
    return 'md_' + crypto.createHash('sha256').update(str, 'utf-8').digest('hex').substring(0, 16);
  } catch (e) {
    // 降级：SHA-256 不可用时使用简单哈希
    var hash = 0;
    for (var i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0; }
    return 'md_' + Math.abs(hash).toString(36);
  }
}
