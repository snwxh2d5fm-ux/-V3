// 住港伴 V4 — admin-compliance: 合规安全监控
const cloudbase = require('@cloudbase/node-sdk');
const auth = require('../_shared/auth');
const audit = require('../_shared/audit'); // P0-08
const app = cloudbase.init({ env: 'cloudbase-d1g17tgt7cc199a60' });
const db = app.database();

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
  const kh = auth.sha256(_apiKey);
  const adm = await db.collection('admin_users').where({ apiKeyHash: kh, status: 'active' }).limit(1).get();
  if (!adm.data.length) return { code: 401, msg: '无效的 API Key' };
  const lock = auth.checkLockout(adm.data[0]);
  if (lock.locked) return { code: 429, msg: lock.reason };
  // P0-08 IP白名单
  const ipCheck = auth.checkIPWhitelist(clientIp);
  if (!ipCheck.allowed) {
    console.warn('[IP白名单] admin-compliance 拒绝:', clientIp, ipCheck.reason);
    return { code: 403, msg: 'IP 不在白名单中' };
  }
  adm.data[0]._clientIp = clientIp;

  try {
    switch (action) {
      case 'getComplianceStatus':
        return complianceStatus();
      case 'getModerationLogs':
        return moderationLogs(params);
      case 'reviewModeration': // P0-08
        return await reviewModeration(params, adm.data[0]);
      case 'ignoreModeration': // P0-08
        return await ignoreModeration(params, adm.data[0]);
      default:
        return { code: 400, msg: '无效操作: ' + action };
    }
  } catch (err) {
    return { code: 500, msg: err.message };
  }
};

async function complianceStatus() {
  const [modCnt, convCnt] = await Promise.all([
    db.collection('content_moderation_logs').count(),
    db
      .collection('conversation_logs')
      .where({ 'safety_triggered.0': db.command.neq(null) })
      .count(),
  ]);
  return {
    code: 0,
    data: {
      moderationLogs: modCnt.total,
      safetyTriggers: convCnt.total,
      k2LeakDetected: convCnt.total > 0,
      complianceIssues: false,
    },
  };
}

async function moderationLogs(p) {
  const { page = 1, pageSize = 20 } = p;
  const [list, cnt] = await Promise.all([
    db
      .collection('content_moderation_logs')
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get(),
    db.collection('content_moderation_logs').count(),
  ]);
  return { code: 0, data: { total: cnt.total, page, pageSize, list: list.data } };
}

// P0-08: content moderation actions with audit
async function reviewModeration(p, admin) {
  const { logId, action: modAction, note } = p;
  if (!logId || !modAction) return { code: 400, msg: '缺少 logId 或 action' };
  await db.collection('content_moderation_logs').doc(logId).update({
    reviewedBy: admin.email,
    reviewAction: modAction,
    reviewNote: (note || '').slice(0, 200),
    reviewedAt: new Date(),
  });
  await audit.logAudit({
    admin: { email: admin.email, role: admin.role || 'unknown' },
    event: audit.AUDIT_EVENTS.CRUD,
    targetType: 'content_moderation_logs',
    targetId: logId,
    detail: { action: modAction, note: (note || '').slice(0, 100) },
    ip: admin._clientIp || '',
  }).catch((e) => console.error('[audit]', e));
  return { code: 0, msg: 'ok' };
}

async function ignoreModeration(p, admin) {
  const { logId, reason } = p;
  if (!logId) return { code: 400, msg: '缺少 logId' };
  await db.collection('content_moderation_logs').doc(logId).update({
    reviewedBy: admin.email,
    reviewAction: 'ignored',
    reviewNote: (reason || 'manual ignore').slice(0, 200),
    reviewedAt: new Date(),
  });
  await audit.logAudit({
    admin: { email: admin.email, role: admin.role || 'unknown' },
    event: audit.AUDIT_EVENTS.CRUD,
    targetType: 'content_moderation_logs',
    targetId: logId,
    detail: { action: 'ignore', reason: (reason || '').slice(0, 100) },
    ip: admin._clientIp || '',
  }).catch((e) => console.error('[audit]', e));
  return { code: 0, msg: 'ok' };
}
