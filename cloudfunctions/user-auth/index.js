// cloudfunctions/user-auth/index.js
// 住港伴 V3 — 用户认证云函数
// 支持: 微信登录 / 手机号登录 / 状态管理 / 会员检查
const cloud = require('wx-server-sdk');
const crypto = require('crypto');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// ========== 用户表名 ==========
const COLLECTION = 'users';

// ========== 入口 ==========
exports.main = async (event) => {
  const { action } = event;
  const { OPENID } = cloud.getWXContext();

  try {
    switch (action) {
      // ---- 认证 ----
      case 'login':
        return handleLogin(OPENID, event);
      case 'phoneLogin':
        return handlePhoneLogin(OPENID, event);
      case 'validate':
        return handleValidate(OPENID, event);

      // ---- 用户管理 ----
      case 'updateStatus':
        return updateStatus(OPENID, event);
      case 'updatePath':
        return updatePath(OPENID, event);
      case 'checkMembership':
        return checkMembership(OPENID);
      case 'getProfile':
        return getProfile(OPENID);
      case 'syncProfile':
        return syncProfile(OPENID, event);

      default:
        return { code: 404, msg: `未知动作: ${action}` };
    }
  } catch (e) {
    console.error(`[user-auth] ${action} 异常:`, e.message || e);
    return { code: 500, msg: '服务异常，请稍后重试' };
  }
};

// ==================== 微信登录 ====================
async function handleLogin(openid, { code, phoneHash }) {
  const users = db.collection(COLLECTION);
  const { data: existing } = await users.where({ _openid: openid }).get();

  if (existing.length > 0) {
    const user = existing[0];
    if (user.status === 'locked') {
      return { code: 403, msg: '账号已被锁定' };
    }
    await users.doc(user._id).update({
      data: { lastLoginAt: db.serverDate() }
    });
    return {
      code: 0,
      token: makeToken(openid, user._id),
      userInfo: { nickName: user.nickName || '住港伴用户' },
      userStatus: user.currentPhase || 'unapplied',
      membershipLevel: user.membershipLevel || 'free',
      data: sanitizeUser(user)
    };
  }

  // 新用户注册
  const freeTrialEnd = new Date(Date.now() + 180 * 24 * 3600 * 1000);
  const userDoc = {
    _openid: openid,
    status: 'active',
    nickName: '住港伴用户',
    freeTrialStartAt: db.serverDate(),
    freeTrialEndAt: freeTrialEnd,
    membershipLevel: 'free',
    selectedPath: '',
    currentPhase: '',
    milestoneStatus: {},
    authorizedLabels: [],
    privacySettings: { mode: 'L1', encryptionEnabled: true },
    phoneHash: phoneHash || '',
    createdAt: db.serverDate(),
    lastLoginAt: db.serverDate()
  };

  const { _id } = await users.add({ data: userDoc });
  userDoc._id = _id;

  return {
    code: 0,
    token: makeToken(openid, _id),
    userInfo: { nickName: '住港伴用户' },
    userStatus: 'unapplied',
    membershipLevel: 'free',
    isNew: true,
    data: sanitizeUser(userDoc)
  };
}

// ==================== 手机号登录 ====================
async function handlePhoneLogin(openid, { phoneCode, loginType }) {
  if (!phoneCode) {
    return { code: 400, msg: '缺少手机号授权码' };
  }

  let phoneNumber;

  // ---- 微信手机号快速验证 ----
  if (loginType === 'wechat_phone') {
    try {
      const result = await cloud.openapi.phonenumber.getPhoneNumber({
        code: phoneCode
      });
      if (result.errCode !== 0) {
        console.error('[phoneLogin] getPhoneNumber 错误:', result);
        return { code: 500, msg: '手机号服务异常' };
      }
      phoneNumber = result.phoneInfo.purePhoneNumber;
    } catch (e) {
      // DevTools 模拟器下 openapi 不可用 — 降级处理
      if (e.errCode === -1 || (e.message && e.message.includes('not supported'))) {
        console.warn('[phoneLogin] 当前环境不支持 openapi，使用模拟模式');
        phoneNumber = 'dev_' + openid.slice(-8);
      } else {
        console.error('[phoneLogin] 手机号解密异常:', e);
        return { code: 500, msg: '手机号服务异常' };
      }
    }
  } else {
    // 其他登录方式 (预留: SMS验证码等)
    return { code: 400, msg: '不支持的登录方式' };
  }

  if (!phoneNumber) {
    return { code: 500, msg: '未能获取手机号' };
  }

  // ---- 哈希手机号 ----
  const salt = crypto.randomBytes(16).toString('hex');
  const phoneHash = crypto
    .createHash('sha256')
    .update(phoneNumber + salt)
    .digest('hex');

  const users = db.collection(COLLECTION);
  const { data: existing } = await users.where({ _openid: openid }).get();

  if (existing.length > 0) {
    // 已有账号 — 补充绑定手机号
    const user = existing[0];
    if (user.status === 'locked') {
      return { code: 403, msg: '账号已被锁定' };
    }
    await users.doc(user._id).update({
      data: {
        phoneHash,
        phoneSalt: salt,
        lastLoginAt: db.serverDate()
      }
    });
    return {
      code: 0,
      token: makeToken(openid, user._id),
      userInfo: { nickName: user.nickName || '住港伴用户' },
      userStatus: user.currentPhase || 'unapplied',
      membershipLevel: user.membershipLevel || 'free',
      phoneBound: true,
      data: sanitizeUser({ ...user, phoneHash })
    };
  }

  // 新用户（手机号直接注册）
  const freeTrialEnd = new Date(Date.now() + 180 * 24 * 3600 * 1000);
  const userDoc = {
    _openid: openid,
    status: 'active',
    nickName: '住港伴用户',
    phoneHash,
    phoneSalt: salt,
    freeTrialStartAt: db.serverDate(),
    freeTrialEndAt: freeTrialEnd,
    membershipLevel: 'free',
    selectedPath: '',
    currentPhase: '',
    milestoneStatus: {},
    authorizedLabels: [],
    privacySettings: { mode: 'L1', encryptionEnabled: true },
    createdAt: db.serverDate(),
    lastLoginAt: db.serverDate()
  };

  const { _id } = await users.add({ data: userDoc });
  userDoc._id = _id;

  return {
    code: 0,
    token: makeToken(openid, _id),
    userInfo: { nickName: '住港伴用户' },
    userStatus: 'unapplied',
    membershipLevel: 'free',
    phoneBound: true,
    isNew: true,
    data: sanitizeUser(userDoc)
  };
}

// ==================== Token 验证 ====================
async function handleValidate(openid, { token }) {
  if (!token) return { code: 400, valid: false };
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString()
    );
    if (payload.openid !== openid) return { code: 401, valid: false };
    // 检查用户存在性
    const { data } = await db.collection(COLLECTION)
      .where({ _openid: openid, status: _.neq('locked') })
      .get();
    return { code: 0, valid: data.length > 0 };
  } catch (e) {
    return { code: 401, valid: false };
  }
}

// ==================== 状态/路径/会员 ====================
async function updateStatus(openid, { userStatus, subStatus }) {
  const updateData = {
    currentPhase: userStatus,
    updatedAt: db.serverDate()
  };
  if (subStatus) updateData.subStatus = subStatus;

  await db.collection(COLLECTION)
    .where({ _openid: openid })
    .update({ data: updateData });
  return { code: 0 };
}

async function updatePath(openid, { selectedPath }) {
  await db.collection(COLLECTION)
    .where({ _openid: openid })
    .update({ data: { selectedPath, updatedAt: db.serverDate() } });
  return { code: 0 };
}

async function checkMembership(openid) {
  const { data } = await db.collection(COLLECTION).where({ _openid: openid }).get();
  if (!data.length) return { code: 404, msg: '用户不存在' };
  const user = data[0];
  const now = new Date();
  const isLocked =
    user.membershipLevel === 'free' &&
    user.freeTrialEndAt &&
    new Date(user.freeTrialEndAt) < now;
  return {
    code: 0,
    level: user.membershipLevel,
    isLocked,
    expireAt: user.membershipExpireAt || user.freeTrialEndAt
  };
}

async function getProfile(openid) {
  const { data } = await db.collection(COLLECTION).where({ _openid: openid }).get();
  return {
    code: 0,
    userInfo: data.length ? sanitizeUser(data[0]) : null
  };
}

async function syncProfile(openid, { profile }) {
  if (!profile) return { code: 400, msg: 'profile 为空' };
  const safeProfile = {};
  const allowed = [
    'userStatus', 'userSubStatus', 'membershipLevel',
    'activeProcessId', 'selectedPath', 'currentPhase'
  ];
  for (const key of allowed) {
    if (profile[key] !== undefined) safeProfile[key] = profile[key];
  }
  safeProfile.updatedAt = db.serverDate();

  await db.collection(COLLECTION)
    .where({ _openid: openid })
    .update({ data: safeProfile });
  return { code: 0 };
}

// ==================== 工具函数 ====================
function sanitizeUser(user) {
  const { _id, _openid, phoneHash, phoneSalt, ...safe } = user;
  return { id: _id, ...safe, phoneBound: !!phoneHash };
}

function makeToken(openid, userId) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    openid,
    uid: userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600
  };
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64');
  // 简化版 JWT (无签名) — 用于 CloudBase 内部服务间调用
  return `${b64(header)}.${b64(payload)}.cloudbase`;
}
