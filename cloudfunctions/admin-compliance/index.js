// 住港伴 V4 — admin-compliance: 合规安全监控
const cloudbase = require('@cloudbase/node-sdk');
const crypto = require('crypto');
const app = cloudbase.init({ env: 'cloudbase-d1g17tgt7cc199a60' });
const db = app.database();
function sha256(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }

exports.main = async (event) => {
  let body = event; if (event.body && typeof event.body === 'string') { try { body = JSON.parse(event.body); } catch (_) {} }
  const { action, params = {}, _apiKey } = body;
  if (!_apiKey) return { code: 401, msg: '缺少 API Key' };
  const kh = sha256(_apiKey);
  const adm = await db.collection('admin_users').where({ apiKeyHash: kh, status: 'active' }).limit(1).get();
  if (!adm.data.length) return { code: 401, msg: '无效的 API Key' };

  try {
    switch (action) {
      case 'getComplianceStatus': return complianceStatus();
      case 'getModerationLogs': return moderationLogs(params);
      default: return { code: 400, msg: '无效操作: ' + action };
    }
  } catch (err) { return { code: 500, msg: err.message }; }
};

async function complianceStatus() {
  const [modCnt, convCnt] = await Promise.all([
    db.collection('content_moderation_logs').count(),
    db.collection('conversation_logs').where({ 'safety_triggered.0': db.RegExp({ $exists: true }) }).count()
  ]);
  return { code: 0, data: { moderationLogs: modCnt.total, safetyTriggers: convCnt.total, k2LeakDetected: convCnt.total > 0, complianceIssues: false } };
}

async function moderationLogs(p) {
  const { page=1, pageSize=20 } = p;
  const [list, cnt] = await Promise.all([
    db.collection('content_moderation_logs').orderBy('createdAt','desc').skip((page-1)*pageSize).limit(pageSize).get(),
    db.collection('content_moderation_logs').count()
  ]);
  return { code: 0, data: { total: cnt.total, page, pageSize, list: list.data } };
}
