// 住港伴 V4 — admin-feedback: 客服工单管理 (P0-04: PII自动脱敏)
const cloudbase = require('@cloudbase/node-sdk');
const auth = require('../_shared/auth');
const audit = require('../_shared/audit'); // P0-08
const app = cloudbase.init({ env: 'cloudbase-d1g17tgt7cc199a60' });
const db = app.database();
function sanitize(s) {
  return (s || '')
    .replace(/1[3-9]\d{9}/g, '[手机号]')
    .replace(/[A-Z]\d{6,8}/g, '[证件号]')
    .replace(/[\w.-]+@[\w.-]+/g, '[邮箱]');
}

exports.main = async (event) => {
  // P0-08: extract client IP before body parsing
  const clientIp = event.headers?.['x-forwarded-for']?.split(',')[0]?.trim()
    || event.headers?.['x-real-ip']
    || event.httpHeaders?.['x-forwarded-for']?.split(',')[0]?.trim()
    || '';
  let body = event;
  if (event.body && typeof event.body === 'string') {
    try {
      body = JSON.parse(event.body);
    } catch (_) {}
  }
  const { action, params = {}, _apiKey } = body;
  if (!_apiKey) return { code: 401, msg: '缺少 API Key' };
  const adm = await db
    .collection('admin_users')
    .where({ apiKeyHash: auth.sha256(_apiKey), status: 'active' })
    .limit(1)
    .get();
  if (!adm.data.length) return { code: 401, msg: '无效 API Key' };
  const lock = auth.checkLockout(adm.data[0]);
  if (lock.locked) return { code: 429, msg: lock.reason };
  // P0-08 IP白名单
  const ipCheck = auth.checkIPWhitelist(clientIp);
  if (!ipCheck.allowed) {
    console.warn('[IP白名单] admin-feedback 拒绝:', clientIp, ipCheck.reason);
    return { code: 403, msg: 'IP 不在白名单中' };
  }
  adm.data[0]._clientIp = clientIp;

  try {
    switch (action) {
      case 'listFeedback':
        return listFeedback(params);
      case 'getFeedbackDetail':
        return feedbackDetail(params);
      case 'updateStatus':
        return await updateStatus(params, adm.data[0]);
      case 'getStats':
        return feedbackStats(params);
      default:
        return { code: 400, msg: '无效操作: ' + action };
    }
  } catch (err) {
    return { code: 500, msg: err.message };
  }
};

async function listFeedback(p) {
  const { page = 1, pageSize = 20, status, type } = p;
  const q = {};
  if (status) q.status = status;
  if (type) q.type = type;
  const [list, cnt] = await Promise.all([
    db
      .collection('feedback')
      .where(q)
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get(),
    db.collection('feedback').where(q).count(),
  ]);
  // P0-04: PII auto-sanitization on content
  const safe = (list.data || []).map((f) => ({ ...f, content: sanitize(f.content || '') }));
  return { code: 0, data: { total: cnt.total, page, pageSize, list: safe } };
}

async function feedbackDetail(p) {
  const r = await db.collection('feedback').where({ ticketId: p.ticketId }).limit(1).get();
  if (!r.data.length) return { code: 404, msg: '未找到' };
  const f = r.data[0];
  f.content = sanitize(f.content || ''); // 二次脱敏
  return { code: 0, data: f };
}

// P0-08: add audit for status change
async function updateStatus(p, admin) {
  await db
    .collection('feedback')
    .where({ ticketId: p.ticketId })
    .update({ status: p.status, updatedAt: new Date().toISOString() });
  await audit.logAudit({
    admin: { email: admin.email, role: admin.role || 'unknown' },
    event: audit.AUDIT_EVENTS.CRUD,
    targetType: 'feedback',
    targetId: p.ticketId,
    detail: { action: 'updateStatus', newStatus: p.status },
    ip: admin._clientIp || '',
  }).catch((e) => console.error('[audit]', e));
  return { code: 0, msg: 'ok' };
}

async function feedbackStats(p) {
  const [total, resolved] = await Promise.all([
    db.collection('feedback').count(),
    db.collection('feedback').where({ status: 'resolved' }).count(),
  ]);
  return {
    code: 0,
    data: {
      total: total.total,
      resolved: resolved.total,
      closureRate: total.total ? Math.round((resolved.total / total.total) * 100) + '%' : '0%',
    },
  };
}
