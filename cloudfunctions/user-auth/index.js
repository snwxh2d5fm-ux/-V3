// cloudfunctions/user-auth/index.js
// 住港伴 V3 — 用户认证云函数
// 支持: 微信登录 / 手机号登录 / 状态管理 / 会员检查
const cloud = require('wx-server-sdk');
const crypto = require('crypto');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const { reportError } = require('./_cf-error');

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
    reportError({ db, fnName: 'user-auth', action, error: e, context: { _openid: OPENID } }).catch(() => {});
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
      data: sanitizeUser({ ...user, isNew: false }),
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
    data: sanitizeUser({ ...userDoc, isNew: true }),
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

  // ---- 稳定哈希手机号（V4.2-fix: 去掉随机盐，支持跨账号反查合并） ----
  const phoneSalt = process.env.PHONE_SALT;
  if (!phoneSalt) {
    console.error('[phoneLogin] FATAL: PHONE_SALT 环境变量未配置');
    return { code: 500, msg: '服务配置异常' };
  }
  const phoneHash = crypto
    .createHmac('sha256', phoneSalt)
    .update(phoneNumber)
    .digest('hex');

  const users = db.collection(COLLECTION);
  const { data: existing } = await users.where({ _openid: openid }).get();

  // ---- 反查：此手机号是否已被另一个openid绑定 ----
  if (existing.length === 0) {
    const { data: linkedUsers } = await users.where({ phoneHash }).get();
    if (linkedUsers.length > 0) {
      const linkedUser = linkedUsers[0];
      console.log(`[user-auth] phoneLogin 检测到账号合并: ${openid} ← ${linkedUser._openid}`);

      await users.where({ _openid: openid }).update({
        data: {
          phoneHash,
          status: linkedUser.status || 'active',
          currentPhase: linkedUser.currentPhase || '',
          membershipLevel: linkedUser.membershipLevel || 'free',
          selectedPath: linkedUser.selectedPath || '',
          guidebookAllUnlocked: linkedUser.guidebookAllUnlocked || false,
          lastLoginAt: db.serverDate(),
          updatedAt: db.serverDate(),
        },
      });

      const fromOpenid = linkedUser._openid;
      const toOpenid = openid;
      const steps = [];

      try {
        // Step1: 标记旧账号为 merged
        await users.where({ _openid: fromOpenid }).update({
          data: { status: 'merged', mergedTo: toOpenid, updatedAt: db.serverDate() },
        });
        steps.push('users');

        // Step2: 迁移 user_processes
        await db.collection('user_processes').where({ _openid: fromOpenid }).update({
          data: { _openid: toOpenid, updatedAt: db.serverDate() },
        });
        steps.push('user_processes');

        // Step3: 迁移 reminders
        await db.collection('reminders').where({ _openid: fromOpenid }).update({
          data: { _openid: toOpenid, updatedAt: db.serverDate() },
        });
        steps.push('reminders');

        // Step4: 迁移 user_documents（写入 _openid_legacy 供回滚定位）
        await db.collection('user_documents').where({ _openid: fromOpenid }).update({
          data: { _openid: toOpenid, _openid_legacy: fromOpenid, updatedAt: db.serverDate() },
        });
        steps.push('user_documents');

        // 全部成功 — 写审计日志
        await db.collection('audit_logs').add({
          data: {
            _openid: toOpenid,
            action: 'account_merged',
            detail: { fromOpenid, toOpenid, by: 'phoneHash', status: 'completed' },
            createdAt: db.serverDate(),
          },
        });
      } catch (e) {
        const failedStep = steps.length > 0 ? steps[steps.length - 1] : 'users_update';
        console.error('[phoneLogin] merge failed at step:', failedStep, e.message || e);

        // 补偿回滚：反序恢复已迁移的数据
        if (steps.includes('user_documents')) {
          await db.collection('user_documents')
            .where({ _openid: toOpenid, _openid_legacy: fromOpenid })
            .update({ data: { _openid: fromOpenid, _openid_legacy: '' } })
            .catch(function (re) { console.error('[phoneLogin] rollback user_documents failed:', re.message); });
        }
        if (steps.includes('reminders')) {
          await db.collection('reminders')
            .where({ _openid: toOpenid })
            .update({ data: { _openid: fromOpenid } })
            .catch(function (re) { console.error('[phoneLogin] rollback reminders failed:', re.message); });
        }
        if (steps.includes('user_processes')) {
          await db.collection('user_processes')
            .where({ _openid: toOpenid })
            .update({ data: { _openid: fromOpenid } })
            .catch(function (re) { console.error('[phoneLogin] rollback user_processes failed:', re.message); });
        }
        if (steps.includes('users')) {
          await users.where({ _openid: fromOpenid }).update({
            data: { status: 'active', mergedTo: '', updatedAt: db.serverDate() },
          }).catch(function (re) { console.error('[phoneLogin] rollback users failed:', re.message); });
        }

        // 失败审计日志
        await db.collection('audit_logs').add({
          data: {
            _openid: toOpenid,
            action: 'account_merged',
            detail: { fromOpenid, toOpenid, by: 'phoneHash', status: 'failed', failedStep, error: String(e.message || e) },
            createdAt: db.serverDate(),
          },
        }).catch(function (re) { console.error('[phoneLogin] audit_logs write failed:', re.message); });

        return { code: 500, msg: '账号合并失败，请稍后重试。您的数据未丢失。' };
      }

      const { data: merged } = await users.where({ _openid: openid }).get();
      if (merged.length > 0) {
        const user = merged[0];
        return {
          code: 0,
          token: makeToken(openid, user._id),
          userInfo: { nickName: user.nickName || '住港伴用户' },
          userStatus: user.currentPhase || 'unapplied',
          membershipLevel: user.membershipLevel || 'free',
          phoneBound: true,
          accountMerged: true,
          data: sanitizeUser({ ...user, isNew: false }),
        };
      }
    }
  }

  if (existing.length > 0) {
    // 已有账号 — 补充绑定手机号
    const user = existing[0];
    if (user.status === 'locked') {
      return { code: 403, msg: '账号已被锁定' };
    }
    await users.doc(user._id).update({
      data: {
        phoneHash,
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
      isNew: false,
      data: sanitizeUser({ ...user, phoneHash, isNew: false }),
    };
  }

  // 新用户（手机号直接注册）
  const freeTrialEnd = new Date(Date.now() + 180 * 24 * 3600 * 1000);
  const userDoc = {
    _openid: openid,
    status: 'active',
    nickName: '住港伴用户',
    phoneHash,
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
    data: sanitizeUser({ ...userDoc, isNew: true }),
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
async function updateStatus(openid, { userStatus, subStatus, guidebookAllUnlocked }) {
  const updateData = {
    currentPhase: userStatus,
    updatedAt: db.serverDate(),
  };
  if (subStatus) updateData.subStatus = subStatus;
  if (guidebookAllUnlocked !== undefined) {
    updateData.guidebookAllUnlocked = guidebookAllUnlocked;
  }

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
  const allowed = ['userStatus', 'userSubStatus', 'membershipLevel', 'membershipExpireAt', 'activeProcessId', 'selectedPath', 'currentPhase'];
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

function getTokenSecret() {
  const secret = process.env.TOKEN_SECRET;
  if (!secret) {
    console.error('[user-auth] TOKEN_SECRET 环境变量未设置！请在 CloudBase 控制台→云函数→user-auth→环境变量中添加 TOKEN_SECRET');
    // 降级密钥：使用 CloudBase 环境 ID + 固定盐值，避免直接崩溃
    // ⚠️ 这是临时降级，生产环境必须在控制台配置 TOKEN_SECRET
    return 'zgb-fallback-' + (process.env.TCB_ENV || cloud.DYNAMIC_CURRENT_ENV || 'unknown');
  }
  return secret;
}

function makeToken(openid, userId) {
  // 使用 crypto.randomBytes 生成不可预测的随机令牌
  const randomPart = require('crypto').randomBytes(32).toString('hex');
  const hmac = require('crypto').createHmac('sha256', getTokenSecret());
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

    // 主验证：使用当前密钥
    const primaryHmac = require('crypto').createHmac('sha256', getTokenSecret());
    if (sig === primaryHmac.update(payload).digest('hex')) {
      return { openid: parts[0], uid: parts[1], iat: parseInt(parts[2]) };
    }

    // 回退验证：兼容5.22前使用旧密钥签发的token（仅验证，不签发新token）
    // SEC-NOTE: LEGACY_TOKEN_KEY 应尽快轮换并在所有旧token过期后删除
    const legacyKey = process.env.LEGACY_TOKEN_KEY || '';
    if (legacyKey && legacyKey !== getTokenSecret()) {
      const legacyHmac = require('crypto').createHmac('sha256', legacyKey);
      if (sig === legacyHmac.update(payload).digest('hex')) {
        console.warn('[user-auth] Legacy token validated — LEGACY_TOKEN_KEY should be rotated');
        return { openid: parts[0], uid: parts[1], iat: parseInt(parts[2]) };
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}
