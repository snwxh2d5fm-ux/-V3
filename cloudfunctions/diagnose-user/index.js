// diagnose-user: 临时诊断云函数 — 查询指定用户数据
// ⚠️ 此函数为临时诊断工具，发版前应删除或配置环境变量 DIAGNOSE_TOKEN_HASH + TCB_ENV
const cloudbase = require('@cloudbase/node-sdk');
const TCB_ENV = process.env.TCB_ENV || '';
if (!TCB_ENV) throw new Error('[diagnose-user] TCB_ENV 环境变量未配置');
const app = cloudbase.init({ env: TCB_ENV });
const db = app.database();

exports.main = async (event) => {
  let body = event;
  if (event.body && typeof event.body === 'string') {
    try { body = JSON.parse(event.body); } catch (_) {}
  }

  const { token, userId } = body;

  // 令牌保护：HMAC-SHA256 比对，防明文令牌泄露
  const DIAGNOSE_TOKEN_HASH = process.env.DIAGNOSE_TOKEN_HASH || '';
  if (!DIAGNOSE_TOKEN_HASH || !token) {
    return { code: 401, msg: '无效令牌' };
  }
  const crypto = require('crypto');
  const tokenHash = crypto.createHmac('sha256', 'diagnose-zgb').update(token).digest('hex');
  if (tokenHash !== DIAGNOSE_TOKEN_HASH) {
    return { code: 401, msg: '无效令牌' };
  }

  const targetId = userId || 'ZGB-6B93CBC3';
  const results = {};

  // 1. user_profiles 集合 (V4 schema)
  try {
    const up1 = await db.collection('user_profiles')
      .where({ _openid: targetId }).limit(1).get();
    results.user_profiles_by_openid = up1.data.length > 0 ? up1.data[0] : null;
  } catch(e) { results.user_profiles_by_openid_err = e.message; }

  // 2. user_profiles 按 _id 查
  try {
    const up2 = await db.collection('user_profiles')
      .doc(targetId).get();
    results.user_profiles_by_id = up2.data ? up2.data[0] : null;
  } catch(e) { results.user_profiles_by_id_err = e.message; }

  // 3. users 集合 (V1 schema)
  try {
    const u1 = await db.collection('users')
      .where({ _openid: targetId }).limit(1).get();
    results.users_by_openid = u1.data.length > 0 ? u1.data[0] : null;
  } catch(e) { results.users_by_openid_err = e.message; }

  // 4. users 按 _id 查
  try {
    const u2 = await db.collection('users')
      .doc(targetId).get();
    results.users_by_id = u2.data ? u2.data[0] : null;
  } catch(e) { results.users_by_id_err = e.message; }

  // 5. 模糊搜索 _id 包含 ZGB
  try {
    const fuzzy = await db.collection('user_profiles')
      .where({ _id: db.RegExp({ regexp: 'ZGB', options: 'i' }) }).limit(5).get();
    results.fuzzy_zgb = fuzzy.data || [];
  } catch(e) { results.fuzzy_zgb_err = e.message; }

  return { code: 0, results };
};
