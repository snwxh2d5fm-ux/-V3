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
      data: { lastLoginAt: db.serverDate() },
    });
    return {
      code: 0,
      token: makeToken(openid, user._id),
      userInfo: { nickName: user.nickName || '住港伴用户' },
      userStatus: user.currentPhase || 'unapplied',
      membershipLevel: user.membershipLevel || 'free',
      data: sanitizeUser(user),
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
    lastLoginAt: db.serverDate(),
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
    data: sanitizeUser(userDoc),
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
    // 检查 cloud.openapi 是否可用
    if (!cloud.openapi || !cloud.openapi.phonenumber) {
      console.error('[phoneLogin] cloud.openapi.phonenumber 不可用');
      return { code: 500, msg: '手机号服务未配置，请在CloudBase控制台开通微信OpenAPI' };
    }
    try {
      const result = await cloud.openapi.phonenumber.getPhoneNumber({
        code: phoneCode,
      });
      if (result.errCode !== 0) {
        console.error('[phoneLogin] getPhoneNumber errCode:', result.errCode, result.errMsg);
        // 真机常见错误码映射
        const errMap = {
          '-80076': '小程序未开通手机号快速验证能力，请在微信公众平台开通',
          '-1': '当前环境不支持手机号验证',
          '-80001': '网络异常，请检查网络后重试',
        };
        const errMsg = errMap[String(result.errCode)] || '手机号服务异常(errCode:' + result.errCode + ')';
        return { code: 500, msg: errMsg };
      }
      phoneNumber = result.phoneInfo.purePhoneNumber;
    } catch (e) {
      console.error(
        '[phoneLogin] 异常:',
        JSON.stringify({ errCode: e.errCode, errMsg: e.errMsg, message: e.message, err: String(e) }),
      );
      // DevTools/模拟器降级
      if (e.errCode === -1 || (e.message && /not support|not available/i.test(e.message))) {
        console.warn('[phoneLogin] 使用模拟模式');
        phoneNumber = 'dev_' + openid.slice(-8);
      } else if (e.errCode === -80076) {
        return { code: 500, msg: '小程序未开通手机号快速验证能力，请在微信公众平台开通' };
      } else {
        return { code: 500, msg: '手机号服务异常，请稍后重试或使用微信一键登录' };
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
        lastLoginAt: db.serverDate(),
      },
    });
    return {
      code: 0,
      token: makeToken(openid, user._id),
      userInfo: { nickName: user.nickName || '住港伴用户' },
      userStatus: user.currentPhase || 'unapplied',
      membershipLevel: user.membershipLevel || 'free',
      phoneBound: true,
      data: sanitizeUser({ ...user, phoneHash }),
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
    lastLoginAt: db.serverDate(),
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
    data: sanitizeUser(userDoc),
  };
}

// ==================== Token 验证 ====================
async function handleValidate(openid, { token }) {
  if (!token) return { code: 400, valid: false };
  // 新旧 token 格式兼容：新格式含HMAC签名，旧格式为base64.header.payload.cloudbase
  try {
    let payloadStr;
    // 尝试新格式验证
    const verified = verifyToken(token);
    if (verified) {
      if (verified.openid !== openid) return { code: 401, valid: false };
      payloadStr = verified.openid;
    } else {
      // 旧格式向下兼容——拆分后解析payload
      const parts = token.split('.');
      if (parts.length >= 2) {
        payloadStr = JSON.parse(Buffer.from(parts[1], 'base64').toString()).openid;
        if (payloadStr !== openid) return { code: 401, valid: false };
      } else {
        return { code: 401, valid: false };
      }
    }
    // 检查用户存在性
    const { data } = await db
      .collection(COLLECTION)
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
    updatedAt: db.serverDate(),
  };
  if (subStatus) updateData.subStatus = subStatus;

  await db.collection(COLLECTION).where({ _openid: openid }).update({ data: updateData });
  return { code: 0 };
}

async function updatePath(openid, { selectedPath }) {
  await db
    .collection(COLLECTION)
    .where({ _openid: openid })
    .update({ data: { selectedPath, updatedAt: db.serverDate() } });
  return { code: 0 };
}

async function checkMembership(openid) {
  const { data } = await db.collection(COLLECTION).where({ _openid: openid }).get();
  if (!data.length) return { code: 404, msg: '用户不存在' };
  const user = data[0];
  const now = new Date();
  const isLocked = user.membershipLevel === 'free' && user.freeTrialEndAt && new Date(user.freeTrialEndAt) < now;
  return {
    code: 0,
    level: user.membershipLevel,
    isLocked,
    expireAt: user.membershipExpireAt || user.freeTrialEndAt,
  };
}

async function getProfile(openid) {
  const { data } = await db.collection(COLLECTION).where({ _openid: openid }).get();
  return {
    code: 0,
    userInfo: data.length ? sanitizeUser(data[0]) : null,
  };
}

async function syncProfile(openid, { profile }) {
  if (!profile) return { code: 400, msg: 'profile 为空' };
  const safeProfile = {};
  const allowed = ['userStatus', 'userSubStatus', 'membershipLevel', 'activeProcessId', 'selectedPath', 'currentPhase'];
  for (const key of allowed) {
    if (profile[key] !== undefined) safeProfile[key] = profile[key];
  }
  safeProfile.updatedAt = db.serverDate();

  await db.collection(COLLECTION).where({ _openid: openid }).update({ data: safeProfile });
  return { code: 0 };
}

// ==================== 工具函数 ====================
function sanitizeUser(user) {
  const { _id, _openid, phoneHash, phoneSalt, ...safe } = user;
  return { id: _id, ...safe, phoneBound: !!phoneHash };
}

function makeToken(openid, userId) {
  // 使用 crypto.randomBytes 生成不可预测的随机令牌
  const randomPart = require('crypto').randomBytes(32).toString('hex');
  const hmac = require('crypto').createHmac('sha256', process.env.TOKEN_SECRET);
  const payload = [openid, userId, Date.now(), randomPart].join(':');
  const signature = hmac.update(payload).digest('hex');
  return Buffer.from(payload + ':' + signature).toString('base64');
}

function verifyToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length < 5) return null;
    const payload = parts.slice(0, 4).join(':');
    const sig = parts[4];
    const hmac = require('crypto').createHmac('sha256', process.env.TOKEN_SECRET);
    const expected = hmac.update(payload).digest('hex');
    if (sig !== expected) return null;
    return { openid: parts[0], uid: parts[1], iat: parseInt(parts[2]) };
  } catch (e) {
    return null;
  }
}
