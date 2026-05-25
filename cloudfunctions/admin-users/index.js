// 住港伴 V4 — admin-users: 用户管理 (按身份/会员/状态/路径等多维统计)
const cloudbase = require('@cloudbase/node-sdk');
const auth = require('./auth');
const audit = require('./audit'); // P0-08
const app = cloudbase.init({ env: 'cloudbase-d1g17tgt7cc199a60' });
const db = app.database();

const PERSONA_MAP = { 1: '在校学生', 2: '在职人士', 3: '企业主', 4: '海外华人', 5: '受养人' };

function deriveStatus(p) {
  if (p.userStatus && p.userStatus !== '') return p.userStatus;
  if (p.onboardingCompleted) return '已抵港';
  if (p.switchCount > 0 && p.selectedPath) return '评估中';
  if (p.selectedPath) return '已选路径';
  return '未提交';
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
  if (!adm.data.length) return { code: 401, msg: '无效的 API Key' };
  const lock = auth.checkLockout(adm.data[0]);
  if (lock.locked) return { code: 429, msg: lock.reason };
  // P0-08 IP白名单
  const ipCheck = auth.checkIPWhitelist(clientIp);
  if (!ipCheck.allowed) {
    console.warn('[IP白名单] admin-users 拒绝:', clientIp, ipCheck.reason);
    return { code: 403, msg: 'IP 不在白名单中' };
  }
  adm.data[0]._clientIp = clientIp;

  try {
    switch (action) {
      case 'listUsers':
        return listUsersWithAudit(params, adm.data[0]);
      case 'getUserDetail':
        return getUserDetailWithAudit(params, adm.data[0]);
      case 'getUserStats':
        return getUserStats();
      case 'lockUser':
        return lockUser(params, adm.data[0]);
      case 'unlockUser':
        return unlockUser(params, adm.data[0]);
      case 'extendTrial':
        return extendTrial(params, adm.data[0]);
      default:
        return { code: 400, msg: '无效操作: ' + action };
    }
  } catch (err) {
    return { code: 500, msg: err.message };
  }
};

async function listUsers(p) {
  const { page = 1, pageSize = 20, filter = {} } = p;
  const q = {};
  if (filter.persona != null) q.persona = parseInt(filter.persona);
  if (filter.membershipTier) q.membershipTier = filter.membershipTier;
  if (filter.path) q.selectedPath = filter.path;

  const [list, cnt] = await Promise.all([
    db
      .collection('user_profiles')
      .where(q)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .orderBy('updatedAt', 'desc')
      .get(),
    db.collection('user_profiles').where(q).count(),
  ]);

  const enriched = (list.data || []).map((p) => ({
    _openid: p._openid,
    persona: p.persona,
    personaLabel: PERSONA_MAP[p.persona] || p.personaLabel || '未知',
    selectedPath: p.selectedPath,
    pathLabel: p.pathLabel,
    membershipTier: p.membershipTier || 'free_trial',
    userStatus: deriveStatus(p),
    isLocked: p.isLocked || false,
    onboardingCompleted: p.onboardingCompleted || false,
    switchCount: p.switchCount || 0,
    lastActiveAt: p.updatedAt,
    createdAt: p.createdAt,
  }));

  return { code: 0, msg: 'ok', data: { total: cnt.total, page, pageSize, list: enriched } };
}

async function getUserStats() {
  // P0-15: 全量拉取加 limit 防止生产 OOM
  const profs = await db.collection('user_profiles').limit(2000).get();
  const data = profs.data || [];
  const byPersona = {},
    byPath = {},
    byMembership = {},
    byStatus = {};
  data.forEach((p) => {
    const persona = PERSONA_MAP[p.persona] || p.personaLabel || '未知';
    byPersona[persona] = (byPersona[persona] || 0) + 1;
    const path = p.selectedPath || '未选择';
    byPath[path] = (byPath[path] || 0) + 1;
    const tier = p.membershipTier || 'free_trial';
    byMembership[tier] = (byMembership[tier] || 0) + 1;
    const status = deriveStatus(p);
    byStatus[status] = (byStatus[status] || 0) + 1;
  });
  return { code: 0, data: { total: data.length, byPersona, byPath, byMembership, byStatus } };
}

async function getUserDetail(p) {
  const [prof, events, orders] = await Promise.all([
    db.collection('user_profiles').where({ _openid: p.openid }).limit(1).get(),
    db.collection('user_events').where({ _openid: p.openid }).orderBy('createdAt', 'desc').limit(20).get(),
    db.collection('orders').where({ _openid: p.openid }).orderBy('createdAt', 'desc').limit(20).get(),
  ]);
  const profile = prof.data[0];
  if (profile) {
    profile.personaLabel = PERSONA_MAP[profile.persona] || profile.personaLabel;
    profile.derivedStatus = deriveStatus(profile);
  }
  return { code: 0, msg: 'ok', data: { profile: profile || null, events: events.data, orders: orders.data } };
}

async function lockUser(p, admin) {
  await db.collection('user_profiles').where({ _openid: p.openid }).update({ isLocked: true });
  await auditAdminEvent(admin, audit.AUDIT_EVENTS.CRUD, 'user', p.openid, { action: 'lock_user' });
  return { code: 0, msg: 'ok' };
}
async function unlockUser(p, admin) {
  await db.collection('user_profiles').where({ _openid: p.openid }).update({ isLocked: false });
  await auditAdminEvent(admin, audit.AUDIT_EVENTS.CRUD, 'user', p.openid, { action: 'unlock_user' });
  return { code: 0, msg: 'ok' };
}
async function extendTrial(p, admin) {
  await db
    .collection('user_profiles')
    .where({ _openid: p.openid })
    .update({ freeTrialEndAt: new Date(Date.now() + p.days * 86400000).toISOString() });
  await auditAdminEvent(admin, audit.AUDIT_EVENTS.CRUD, 'user', p.openid, { action: 'extend_trial', days: p.days });
  return { code: 0, msg: 'ok' };
}

// P0-08: add audit for listUsers and getUserDetail
async function listUsersWithAudit(p, admin) {
  const result = await listUsers(p);
  await auditAdminEvent(admin, audit.AUDIT_EVENTS.SENSITIVE_VIEW, 'user_list', '', {
    filters: p.filter || {},
    page: p.page || 1,
  });
  return result;
}

async function getUserDetailWithAudit(p, admin) {
  const result = await getUserDetail(p);
  if (result.data && result.data.profile) {
    await auditAdminEvent(admin, audit.AUDIT_EVENTS.SENSITIVE_VIEW, 'user_detail', p.openid, {});
  }
  return result;
}

// P0-08: migrate to shared audit module, append-only
async function auditAdminEvent(admin, event, targetType, targetId, detail) {
  await audit.logAudit({
    admin: { email: admin.email, role: admin.role || 'unknown' },
    event,
    targetType,
    targetId,
    detail: detail || {},
    ip: admin._clientIp || '',
  }).catch((e) => console.error('[audit]', e));
}
