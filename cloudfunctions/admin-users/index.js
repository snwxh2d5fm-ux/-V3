// 住港伴 V4 — admin-users: 用户管理
const cloudbase = require('@cloudbase/node-sdk');
const crypto = require('crypto');
const app = cloudbase.init({ env: 'cloudbase-d1g17tgt7cc199a60' });
const db = app.database();

function sha256(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }

exports.main = async (event) => {
  let body = event;
  if (event.body && typeof event.body === 'string') { try { body = JSON.parse(event.body); } catch (_) {} }
  const { action, params = {}, _apiKey } = body;
  const apiKey = _apiKey || body._apiKey;
  if (!apiKey) return { code: 401, msg: '缺少 API Key' };
  const keyHash = sha256(apiKey);
  const adm = await db.collection('admin_users').where({ apiKeyHash: keyHash, status: 'active' }).limit(1).get();
  if (!adm.data.length) return { code: 401, msg: '无效的 API Key' };

  try {
    switch (action) {
      case 'listUsers': return listUsers(params);
      case 'getUserDetail': return getUserDetail(params);
      case 'lockUser': return lockUser(params, adm.data[0]);
      case 'unlockUser': return unlockUser(params, adm.data[0]);
      case 'extendTrial': return extendTrial(params, adm.data[0]);
      default: return { code: 400, msg: '无效操作: ' + action };
    }
  } catch (err) { return { code: 500, msg: err.message }; }
};

async function listUsers(p) {
  const { page = 1, pageSize = 20, filter = {} } = p;
  const q = {};
  if (filter.visaType) q.primaryVisaType = filter.visaType;
  if (filter.membershipTier) q.membershipTier = filter.membershipTier;
  const [list, cnt] = await Promise.all([
    db.collection('user_profiles').where(q).skip((page-1)*pageSize).limit(pageSize).orderBy('updatedAt','desc').get(),
    db.collection('user_profiles').where(q).count()
  ]);
  return { code: 0, msg: 'ok', data: { total: cnt.total, page, pageSize, list: list.data } };
}

async function getUserDetail(p) {
  const [prof, events, orders] = await Promise.all([
    db.collection('user_profiles').where({ _openid: p.openid }).limit(1).get(),
    db.collection('user_events').where({ _openid: p.openid }).orderBy('createdAt','desc').limit(20).get(),
    db.collection('orders').where({ _openid: p.openid }).orderBy('createdAt','desc').limit(20).get()
  ]);
  return { code: 0, msg: 'ok', data: { profile: prof.data[0]||null, events: events.data, orders: orders.data } };
}

async function lockUser(p, admin) {
  await db.collection('user_profiles').where({ _openid: p.openid }).update({ isLocked: true });
  await audit(admin, 'lock_user', 'user', p.openid, p);
  return { code: 0, msg: 'ok' };
}
async function unlockUser(p, admin) { await db.collection('user_profiles').where({ _openid: p.openid }).update({ isLocked: false }); await audit(admin, 'unlock_user', 'user', p.openid, p); return { code: 0, msg: 'ok' }; }
async function extendTrial(p, admin) { await db.collection('user_profiles').where({ _openid: p.openid }).update({ freeTrialEndAt: new Date(Date.now()+p.days*86400000).toISOString() }); await audit(admin, 'extend_trial', 'user', p.openid, p); return { code: 0, msg: 'ok' }; }

async function audit(admin, action, targetType, targetId, detail) {
  await db.collection('admin_audit_trail').add({ adminUid: admin.uid, adminName: admin.name, action, targetType, targetId, detail: JSON.parse(JSON.stringify(detail)), ip: '', success: true, createdAt: new Date() });
}
