/**
 * k2-leak-scanner v1.0 — K2泄露扫描器
 *
 * 定时（每日凌晨3点）扫描知识库和AI对话历史，检测K2内容泄露。
 * 检测到泄露 → 写入 k2_leak_alerts 集合 → 触发人工审核。
 *
 * 扫描目标:
 *   1. knowledge_chunks — 防御性扫描，确保无K2结构化字段残留
 *   2. ai_chat_logs — AI对话历史（如有）
 *
 * 触发器: 每日 0 0 3 * * * * (CloudBase 7段cron)
 */
var cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
var db = cloud.database();
var _ = db.command;

// K2 检测模式
var K2_STRUCTURED_FIELDS = ['visual_features', 'validation_rules', 'vault_mode', 'privacy_level'];

var K2_CONTENT_PATTERNS = [
  { regex: /圆角边框|全息防伪|光变油墨|微缩文字|安全线|防伪底纹/g, category: 'forgery_feature' },
  { regex: /防伪特征|安全特征|anti-counterfeiting/g, category: 'forgery_feature' },
  { regex: /AES-256|PBKDF2|WASM沙箱|客户端加密/g, category: 'privacy_tech' },
  { regex: /Canny|边缘检测|轮廓近似|OCR模型|校验位算法/g, category: 'ocr_tech' },
  { regex: /validation_rule|vault_mode|privacy_level/g, category: 'internal_field' }
];

exports.main = async function(event, context) {
  var now = new Date().toISOString();
  var alerts = [];
  var scanStats = { knowledge_chunks: 0, ai_chat_logs: 0 };

  // ====== 扫描1: knowledge_chunks K2 结构化字段残留 ======
  try {
    var fieldCheck = buildFieldScanQuery();
    var fieldRes = await db.collection('knowledge_chunks')
      .where(fieldCheck)
      .field({ _id: true, doc_id: true, name_zh: true, visual_features: true, validation_rules: true, vault_mode: true, privacy_level: true })
      .limit(50)
      .get();

    scanStats.knowledge_chunks = fieldRes.data.length;

    for (var i = 0; i < fieldRes.data.length; i++) {
      var doc = fieldRes.data[i];
      var leakedFields = [];
      for (var j = 0; j < K2_STRUCTURED_FIELDS.length; j++) {
        if (doc[K2_STRUCTURED_FIELDS[j]] !== undefined) {
          leakedFields.push(K2_STRUCTURED_FIELDS[j]);
        }
      }
      alerts.push({
        source: 'knowledge_chunks',
        doc_id: doc._id,
        name_zh: doc.name_zh || '',
        leak_type: 'structured_fields',
        leaked_fields: leakedFields,
        detected_at: now,
        severity: 'P0',
        status: 'open'
      });
    }
  } catch (e) {
    console.warn('[k2-scanner] knowledge_chunks scan error:', e.message);
  }

  // ====== 扫描2: ai_chat_logs K2 内容关键词 (如集合存在) ======
  try {
    var oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    var chatRes = await db.collection('ai_chat_logs')
      .where({ timestamp: _.gte(oneDayAgo) })
      .field({ ai_response: true, message_id: true, _id: true, user_query: true })
      .limit(200)
      .get();

    scanStats.ai_chat_logs = chatRes.data.length;

    for (var k = 0; k < chatRes.data.length; k++) {
      var chat = chatRes.data[k];
      var content = chat.ai_response || '';
      var matchedPatterns = [];

      for (var p = 0; p < K2_CONTENT_PATTERNS.length; p++) {
        var match = content.match(K2_CONTENT_PATTERNS[p].regex);
        if (match) {
          matchedPatterns.push({
            category: K2_CONTENT_PATTERNS[p].category,
            snippet: match[0]
          });
        }
      }

      if (matchedPatterns.length > 0) {
        alerts.push({
          source: 'ai_chat_logs',
          conversation_id: chat._id,
          message_id: chat.message_id,
          user_query_snippet: (chat.user_query || '').substring(0, 200),
          ai_response_snippet: content.substring(0, 300),
          leak_type: 'content_pattern',
          matched_patterns: matchedPatterns,
          detected_at: now,
          severity: matchedPatterns.some(function(m) { return m.category === 'forgery_feature'; }) ? 'P0' : 'P1',
          status: 'open'
        });
      }
    }
  } catch (e) {
    // ai_chat_logs 集合不存在时静默跳过
    if (e.errCode !== -502005) {
      console.warn('[k2-scanner] ai_chat_logs scan error:', e.message);
    }
  }

  // ====== 写入告警 ======
  var savedAlerts = 0;
  if (alerts.length > 0) {
    for (var a = 0; a < alerts.length; a++) {
      try {
        await db.collection('k2_leak_alerts').add({ data: alerts[a] });
        savedAlerts++;
      } catch (e) {
        console.warn('[k2-scanner] save alert error:', e.message);
      }
    }
  }

  return {
    code: 200,
    message: 'K2 scan completed',
    data: {
      scanned: scanStats,
      alerts_found: alerts.length,
      alerts_saved: savedAlerts,
      timestamp: now
    }
  };
};

/**
 * 构建 K2 结构化字段存在性查询
 * CloudBase NoSQL 不支持 $exists，用 partial _or 查询实现
 */
function buildFieldScanQuery() {
  // 使用正则匹配 content 中的 K2 关键词作为后备
  // 因为 CloudBase where 不支持字段存在性检查
  var pattern = db.RegExp({
    regexp: 'visual_features|privacy_level|vault_mode|圆角边框|光变油墨',
    options: 'i'
  });
  return { content: pattern };
}
