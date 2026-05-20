/**
 * 住港伴 V3 — 邀请内测码云函数 (invite-code)
 *
 * 支持操作:
 *   [用户端]
 *   - query-code-status  查询码状态（预览权益，不消耗码）
 *   - redeem-code         兑换码获得年卡
 *   - get-membership      查询当前用户会员状态
 *
 *   [管理端]
 *   - generate-seed-codes 批量生成种子码
 *   - revoke-code         撤销未使用的码
 *   - get-code-stats      码使用统计
 *
 * 集成: 复用 users / subscription_records / audit_logs 现有集合
 * 新增: invite_codes 集合
 * 鉴权: 管理操作通过 ADMIN_OPENIDS 环境变量白名单
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// ========== 常量 ==========
const CODE_COLLECTION = 'invite_codes';
const CODE_PREFIX = 'ZGB';
const CODE_LENGTH = 8;
// 排除易混淆字符 0/O/1/I/L
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const DEFAULT_EXPIRE_DAYS = 60;          // 种子码默认有效期
const MAX_GENERATE_COUNT = 200;          // 单次最大生成数
const MEMBERSHIP_DAYS = 365;             // 年卡天数

// 管理员白名单（环境变量，逗号分隔的 openid 列表）
const ADMIN_OPENIDS = (process.env.ADMIN_OPENIDS || '').split(',').filter(Boolean);

// ========== 入口 ==========
exports.main = async (event) => {
  const { action } = event;
  const { OPENID } = cloud.getWXContext();

  try {
    switch (action) {

      // ---- 用户端 ----
      case 'query-code-status':
        return await queryCodeStatus(event);
      case 'redeem-code':
        return await redeemCode(OPENID, event);
      case 'get-membership':
        return await getMembership(OPENID);
      case 'submit-feedback':
        return await submitFeedback(OPENID, event);

      // ---- 管理端 ----
      case 'generate-seed-codes':
        if (!isAdmin(OPENID)) return denyAdmin();
        return await generateSeedCodes(event);
      case 'revoke-code':
        if (!isAdmin(OPENID)) return denyAdmin();
        return await revokeCode(OPENID, event);
      case 'revoke-batch':
        if (!isAdmin(OPENID)) return denyAdmin();
        return await revokeBatch(OPENID, event);
      case 'get-code-stats':
        if (!isAdmin(OPENID)) return denyAdmin();
        return await getCodeStats(event);

      // ---- 初始化 ----
      case 'init-collections':
        if (!isAdmin(OPENID)) return denyAdmin();
        return await initCollections();

      default:
        return { code: 404, msg: `未知操作: ${action}` };
    }
  } catch (e) {
    console.error(`[invite-code] ${action} 异常:`, e.message || e);
    return { code: 500, msg: '服务异常，请稍后重试' };
  }
};

// ==================== 用户端：查询码状态 ====================
async function queryCodeStatus({ code }) {
  if (!code) return { code: 400, msg: '请输入内测码' };

  const normalized = normalizeCode(code);
  if (!isValidFormat(normalized)) {
    return { code: 400, msg: '内测码格式不正确，请检查后重试' };
  }

  const { data } = await db.collection(CODE_COLLECTION)
    .where({ code: normalized })
    .limit(1)
    .get();

  if (data.length === 0) {
    return { code: 404, msg: '内测码不存在，请检查后重试' };
  }

  const record = data[0];
  const now = new Date();

  switch (record.status) {
    case 'unused':
      if (record.expires_at && new Date(record.expires_at) < now) {
        return { code: 400, msg: `该码已过期（有效期至${fmtDate(record.expires_at)}）`, valid: false, status: 'expired' };
      }
      return {
        code: 0,
        valid: true,
        status: 'unused',
        hint: '兑换后将获得 365天基础年卡会员'
      };
    case 'redeemed':
      return { code: 400, msg: '该码已被使用', valid: false, status: 'redeemed' };
    case 'expired':
      return { code: 400, msg: `该码已过期（有效期至${fmtDate(record.expires_at)}）`, valid: false, status: 'expired' };
    case 'revoked':
      return { code: 400, msg: '该码已失效', valid: false, status: 'revoked' };
    default:
      return { code: 400, msg: '该码状态异常', valid: false };
  }
}

// ==================== 用户端：兑换码 ====================
async function redeemCode(openid, { code, deviceId }) {
  // ---- 0. 参数校验 ----
  if (!code) return { code: 400, msg: '请输入内测码' };

  const normalized = normalizeCode(code);
  if (!isValidFormat(normalized)) {
    return { code: 400, msg: '内测码格式不正确，请检查后重试' };
  }

  if (!openid) {
    return { code: 401, msg: '请先登录' };
  }

  // ---- 1. 查码 ----
  const { data: codes } = await db.collection(CODE_COLLECTION)
    .where({ code: normalized })
    .limit(1)
    .get();

  if (codes.length === 0) {
    return { code: 404, msg: '内测码不存在，请检查后重试' };
  }

  const codeRecord = codes[0];
  const now = new Date();

  // ---- 2. 校验码状态 ----
  if (codeRecord.status === 'redeemed') {
    // 3. 幂等检查（同用户+同码已兑换过，返回已有结果）
    if (codeRecord.redeemed_by_uid === openid) {
      const existingMembership = await getMembership(openid);
      return {
        code: 0,
        msg: '你已兑换过该码',
        membershipExpiresAt: existingMembership.data?.expiresAt || null,
        alreadyRedeemed: true
      };
    }
    return { code: 400, msg: '该码已被使用' };
  }
  if (codeRecord.status === 'revoked') {
    return { code: 400, msg: '该码已失效' };
  }
  if (codeRecord.status === 'expired' ||
      (codeRecord.expires_at && new Date(codeRecord.expires_at) < now)) {
    return { code: 400, msg: `该码已过期（有效期至${fmtDate(codeRecord.expires_at)}）` };
  }
  if (codeRecord.status !== 'unused') {
    return { code: 400, msg: '该码状态异常，无法兑换' };
  }

  // ---- 4. 检查用户是否已有年卡 ----
  const { data: users } = await db.collection('users')
    .where({ _openid: openid })
    .limit(1)
    .get();

  if (users.length === 0) {
    return { code: 404, msg: '用户不存在，请先登录' };
  }

  const user = users[0];
  if (user.membershipLevel && user.membershipLevel !== 'free') {
    const expireAt = user.membershipExpireAt
      ? new Date(user.membershipExpireAt)
      : null;
    if (expireAt && expireAt > now) {
      return {
        code: 400,
        msg: `你已是${membershipLabel(user.membershipLevel)}会员（到期日：${fmtDate(expireAt)}），无需重复兑换`
      };
    }
  }


  // ---- 4.5 免费试用检查（如有试用期，终止并记录） ----
  const { data: subscriptions } = await db.collection('subscription_records')
    .where({ _openid: openid, status: 'active', level: 'free_trial' })
    .limit(1)
    .get();
  const hasFreeTrial = subscriptions.length > 0;
  if (hasFreeTrial) {
    // 终止免费试用
    await db.collection('subscription_records')
      .doc(subscriptions[0]._id)
      .update({
        data: {
          status: 'terminated_by_invite',
          terminatedAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      });
  }
  // ---- 5. 设备校验（同uid+同deviceId限制，兼容家庭共用设备） ----
  if (deviceId) {
    const deviceHash = hashDeviceId(deviceId);
    const { data: deviceRecords } = await db.collection(CODE_COLLECTION)
      .where({
        status: 'redeemed',
        device_hash: deviceHash,
        redeemed_by_uid: openid  // 同设备不同用户允许兑换（家庭场景）
      })
      .limit(1)
      .get();
    if (deviceRecords.length > 0) {
      return { code: 400, msg: '你的账号已完成过兑换，每个账号限兑换一次' };
    }
  }

  // ---- 6. 原子更新码状态（条件更新防止并发超发） ----
  const updateResult = await db.collection(CODE_COLLECTION)
    .where({
      code: normalized,
      status: 'unused'  // 条件：仅当仍为unused时才更新
    })
    .update({
      data: {
        status: 'redeemed',
        redeemed_by_uid: openid,
        redeemed_at: db.serverDate(),
        device_hash: deviceId ? hashDeviceId(deviceId) : null,
        updated_at: db.serverDate()
      }
    });

  if (updateResult.stats.updated === 0) {
    // 并发冲突：另一请求抢先兑换了
    return { code: 400, msg: '该码已被使用' };
  }

  // ---- 7. 激活年卡会员 ----
  const membershipResult = await activateMembership(openid, normalized);

  // ---- 8. 审计日志 ----
  await db.collection('audit_logs').add({
    data: {
      _openid: openid,
      action: 'invite_code_redeemed',
      detail: {
        code: normalized,
        codeType: codeRecord.type || 'seed',
        batchId: codeRecord.batch_id || null,
        channel: codeRecord.channel || null,
        membershipLevel: 'basic',
        membershipDays: MEMBERSHIP_DAYS
      },
      createdAt: db.serverDate()
    }
  });

  return {
    code: 0,
    msg: '年卡已激活',
    membershipLevel: 'basic',
    membershipExpiresAt: membershipResult.expiresAt,
    membershipLabel: '基础年卡会员'
  };
}

// ==================== 用户端：查询会员状态 ====================
async function getMembership(openid) {
  const { data: users } = await db.collection('users')
    .where({ _openid: openid })
    .limit(1)
    .get();

  if (users.length === 0) {
    return { code: 0, data: { hasMembership: false, level: 'free' } };
  }

  const user = users[0];
  const now = new Date();
  const level = user.membershipLevel || 'free';
  const expireAt = user.membershipExpireAt
    ? new Date(user.membershipExpireAt)
    : null;

  const isActive = level !== 'free' && expireAt && expireAt > now;
  const daysRemaining = isActive
    ? Math.ceil((expireAt - now) / 86400000)
    : 0;

  return {
    code: 0,
    data: {
      hasMembership: isActive,
      level,
      label: membershipLabel(level),
      expiresAt: expireAt ? expireAt.toISOString() : null,
      daysRemaining,
      isLocked: user.isLocked || false
    }
  };
}

// ==================== 用户端：提交反馈 ====================
async function submitFeedback(openid, { feedback, stage }) {
  if (!feedback || !String(feedback).trim()) {
    return { code: 400, msg: '请输入反馈内容' };
  }

  const trimmed = String(feedback).trim().slice(0, 500);
  const feedbackStage = stage || 't0';

  try {
    await db.collection('user_feedback').add({
      data: {
        _openid: openid,
        stage: feedbackStage,
        open_feedback: trimmed,
        submitted_at: db.serverDate(),
        createdAt: db.serverDate()
      }
    });
    return { code: 0, msg: '感谢反馈' };
  } catch (e) {
    console.error('[invite-code] submitFeedback error:', e.message);
    return { code: 500, msg: '提交失败，请稍后重试' };
  }
}

// ==================== 管理端：批量生成种子码 ====================
async function generateSeedCodes({ count, channel, expiresInDays, batchId }) {
  // ---- 参数校验 ----
  const genCount = parseInt(count) || 50;
  if (genCount < 1 || genCount > MAX_GENERATE_COUNT) {
    return { code: 400, msg: `生成数量须在 1-${MAX_GENERATE_COUNT} 之间` };
  }

  const expireDays = parseInt(expiresInDays) || DEFAULT_EXPIRE_DAYS;
  if (expireDays < 1 || expireDays > 365) {
    return { code: 400, msg: '有效期须在 1-365 天之间' };
  }

  const batch = batchId || `BATCH-${Date.now().toString(36).toUpperCase()}`;
  const source = channel || 'manual';

  const now = new Date();
  const expiresAt = new Date(now.getTime() + expireDays * 86400000);

  // ---- 批量生成唯一码 ----
  const codes = [];
  const attempts = genCount * 3; // 最多尝试3倍数量
  let tried = 0;

  while (codes.length < genCount && tried < attempts) {
    tried++;
    const newCode = generateCode();

    // 检查重复（本地列表 + 数据库）
    if (codes.some(c => c === newCode)) continue;

    const { data: existing } = await db.collection(CODE_COLLECTION)
      .where({ code: newCode })
      .limit(1)
      .get();
    if (existing.length > 0) continue;

    codes.push(newCode);
  }

  if (codes.length < genCount) {
    return { code: 500, msg: `仅成功生成 ${codes.length}/${genCount} 个码，请重试` };
  }

  // ---- 批量写入 ----
  const docs = codes.map(c => ({
    code: c,
    type: 'seed',
    status: 'unused',
    batch_id: batch,
    channel: source,
    generated_at: db.serverDate(),
    expires_at: expiresAt.toISOString(),
    redeemed_by_uid: null,
    redeemed_at: null
  }));

  // 逐条写入（CloudBase SDK 不支持批量insert）
  for (const doc of docs) {
    await db.collection(CODE_COLLECTION).add({ data: doc });
  }

  // ---- 审计日志 ----
  const adminOpenid = cloud.getWXContext().OPENID;
  await db.collection('audit_logs').add({
    data: {
      _openid: adminOpenid,
      action: 'invite_seed_codes_generated',
      detail: {
        batch,
        count: genCount,
        channel: source,
        expiresInDays: expireDays,
        expiresAt: expiresAt.toISOString()
      },
      createdAt: db.serverDate()
    }
  });

  return {
    code: 0,
    data: {
      batch,
      count: genCount,
      channel: source,
      expiresAt: expiresAt.toISOString(),
      codes // 仅此一次返回明文列表
    }
  };
}

// ==================== 管理端：撤销码 ====================
async function revokeCode(adminOpenid, { code }) {
  if (!code) return { code: 400, msg: '请提供要撤销的码' };

  const normalized = normalizeCode(code);
  if (!isValidFormat(normalized)) {
    return { code: 400, msg: '内测码格式不正确' };
  }

  const { data } = await db.collection(CODE_COLLECTION)
    .where({ code: normalized })
    .limit(1)
    .get();

  if (data.length === 0) {
    return { code: 404, msg: '内测码不存在' };
  }

  const record = data[0];

  if (record.status !== 'unused') {
    return { code: 400, msg: `该码状态为「${statusLabel(record.status)}」，仅可撤销未使用的码` };
  }

  await db.collection(CODE_COLLECTION)
    .doc(record._id)
    .update({
      data: {
        status: 'revoked',
        revoked_by: adminOpenid,
        revoked_at: db.serverDate(),
        updated_at: db.serverDate()
      }
    });

  await db.collection('audit_logs').add({
    data: {
      _openid: adminOpenid,
      action: 'invite_code_revoked',
      detail: {
        code: normalized,
        batchId: record.batch_id || null,
        channel: record.channel || null
      },
      createdAt: db.serverDate()
    }
  });

  return { code: 0, msg: '码已撤销' };
}

// ==================== 管理端：批量撤销 ====================
async function revokeBatch(adminOpenid, { batchId }) {
  if (!batchId) return { code: 400, msg: '请提供批次号' };

  const { data: codes } = await db.collection(CODE_COLLECTION)
    .where({ batch_id: batchId, status: 'unused' })
    .get();

  if (codes.length === 0) {
    return { code: 0, msg: '该批次无未使用的码', data: { count: 0 } };
  }

  let revokedCount = 0;
  for (const record of codes) {
    await db.collection(CODE_COLLECTION).doc(record._id).update({
      data: {
        status: 'revoked',
        revoked_by: adminOpenid,
        revoked_at: db.serverDate(),
        updated_at: db.serverDate()
      }
    });
    revokedCount++;
  }

  // 审计日志
  await db.collection('audit_logs').add({
    data: {
      _openid: adminOpenid,
      action: 'invite_batch_revoked',
      detail: { batchId, count: revokedCount },
      createdAt: db.serverDate()
    }
  });

  return { code: 0, msg: `已撤销 ${revokedCount} 个码`, data: { count: revokedCount } };
}

// ==================== 管理端：码使用统计 ====================
async function getCodeStats({ batchId, channel }) {
  let query = {};

  if (batchId) {
    query.batch_id = batchId;
  }
  if (channel) {
    query.channel = channel;
  }

  const { data: allCodes } = await db.collection(CODE_COLLECTION)
    .where(Object.keys(query).length > 0 ? query : { type: 'seed' })
    .get();

  const total = allCodes.length;
  const redeemed = allCodes.filter(c => c.status === 'redeemed').length;
  const unused = allCodes.filter(c => c.status === 'unused').length;
  const expired = allCodes.filter(c => c.status === 'expired').length;
  const revoked = allCodes.filter(c => c.status === 'revoked').length;

  // 按渠道分布
  const channelMap = {};
  for (const c of allCodes) {
    const ch = c.channel || 'unknown';
    if (!channelMap[ch]) {
      channelMap[ch] = { total: 0, redeemed: 0 };
    }
    channelMap[ch].total++;
    if (c.status === 'redeemed') channelMap[ch].redeemed++;
  }

  const byChannel = Object.entries(channelMap).map(([name, stats]) => ({
    channel: name,
    total: stats.total,
    redeemed: stats.redeemed,
    rate: stats.total > 0 ? Math.round((stats.redeemed / stats.total) * 100) : 0
  }));

  return {
    code: 0,
    data: {
      totalGenerated: total,
      totalRedeemed: redeemed,
      totalUnused: unused,
      totalExpired: expired,
      totalRevoked: revoked,
      redemptionRate: total > 0 ? Math.round((redeemed / total) * 100) : 0,
      byChannel
    }
  };
}

// ==================== 初始化：创建集合与索引 ====================

async function initCollections() {
  const results = {};

  // 1. 确保 invite_codes 集合存在（写入临时文档后删除）
  try {
    const { data: existing } = await db.collection(CODE_COLLECTION).limit(1).get();
    results[CODE_COLLECTION] = { exists: true, msg: '集合已存在' };
  } catch (e) {
    // 集合不存在，创建它
    try {
      const addRes = await db.collection(CODE_COLLECTION).add({
        data: {
          _init: true,
          code: '_placeholder_',
          type: 'seed',
          status: 'revoked',
          createdAt: db.serverDate()
        }
      });
      await db.collection(CODE_COLLECTION).doc(addRes._id).remove();
      results[CODE_COLLECTION] = { created: true, msg: '集合已创建' };
    } catch (e2) {
      results[CODE_COLLECTION] = { error: e2.message };
    }
  }

  // 2. 确保 code_audit_log 集合存在
  const auditCollection = 'code_audit_log';
  try {
    const { data: existing2 } = await db.collection(auditCollection).limit(1).get();
    results[auditCollection] = { exists: true, msg: '集合已存在' };
  } catch (e) {
    try {
      const addRes = await db.collection(auditCollection).add({
        data: { _init: true, action: 'init', createdAt: db.serverDate() }
      });
      await db.collection(auditCollection).doc(addRes._id).remove();
      results[auditCollection] = { created: true, msg: '集合已创建' };
    } catch (e2) {
      results[auditCollection] = { error: e2.message };
    }
  }

  // 3. 索引说明（需在云开发控制台手动创建）
  results.indexes = {
    note: '以下索引请前往云开发控制台 → 数据库 → invite_codes → 索引管理 手动创建',
    required: [
      { collection: 'invite_codes', field: 'code', unique: true, desc: '唯一索引（主键）' },
      { collection: 'invite_codes', field: 'status, expires_at', unique: false, desc: '过期扫描' },
      { collection: 'invite_codes', field: 'generator_uid, status', unique: false, desc: '我的邀请查询' },
      { collection: 'invite_codes', field: 'batch_id', unique: false, desc: '批次查询' },
      { collection: 'code_audit_log', field: 'code, timestamp', unique: false, desc: '审计追溯' },
      { collection: 'code_audit_log', field: 'uid, timestamp', unique: false, desc: '用户操作追溯' }
    ]
  };

  return { code: 0, msg: '初始化完成', data: results };
}

// ==================== 工具函数 ====================

/** 生成唯一码 ZGB-XXXX-XXXX */
function generateCode() {
  let raw = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    raw += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return `${CODE_PREFIX}-${raw.slice(0, 4)}-${raw.slice(4)}`;
}

/** 规范化码：去空格、转大写 */
function normalizeCode(input) {
  return String(input).replace(/\s/g, '').toUpperCase();
}

/** 校验码格式 ZGB-XXXX-XXXX */
function isValidFormat(code) {
  const pattern = /^ZGB-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  return pattern.test(code);
}

/** 设备ID哈希（隐私保护） */
function hashDeviceId(deviceId) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(String(deviceId)).digest('hex');
}

/** 管理员鉴权 */
function isAdmin(openid) {
  if (ADMIN_OPENIDS.length === 0) return false;
  return ADMIN_OPENIDS.includes(openid);
}

/** 管理员拒绝响应 */
function denyAdmin() {
  return { code: 403, msg: '权限不足' };
}

/** 日期格式化 */
function fmtDate(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 会员等级中文标签 */
function membershipLabel(level) {
  const map = {
    free: '免费',
    basic: '基础年卡',
    pro: '进阶年卡',
    premium: '尊享年卡'
  };
  return map[level] || level;
}

/** 码状态中文标签 */
function statusLabel(status) {
  const map = {
    unused: '未使用',
    redeemed: '已兑换',
    expired: '已过期',
    revoked: '已撤销'
  };
  return map[status] || status;
}

/** 激活年卡会员（遵循 payment/activateMembership 同一模式） */
async function activateMembership(openid, inviteCode) {
  const now = new Date();
  const expireAt = new Date(now.getTime() + MEMBERSHIP_DAYS * 86400000);

  // 查现有订阅记录
  const existingSubs = await db.collection('subscription_records')
    .where({ _openid: openid, status: 'active' })
    .get();

  if (existingSubs.data.length > 0) {
    // 已有活跃订阅 — 延期或覆盖
    const sub = existingSubs.data[0];
    const currentExpire = new Date(sub.expireAt);
    const newExpire = currentExpire > now
      ? new Date(currentExpire.getTime() + MEMBERSHIP_DAYS * 86400000)
      : expireAt;
    await db.collection('subscription_records').doc(sub._id).update({
      data: {
        level: 'basic',
        source: 'invite_code',
        sourceCode: inviteCode,
        expireAt: newExpire.toISOString(),
        renewedAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });
  } else {
    // 新订阅记录
    await db.collection('subscription_records').add({
      data: {
        _openid: openid,
        level: 'basic',
        source: 'invite_code',
        sourceCode: inviteCode,
        status: 'active',
        startedAt: db.serverDate(),
        expireAt: expireAt.toISOString(),
        autoRenew: false,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });
  }

  // 更新用户会员状态
  await db.collection('users').where({ _openid: openid }).update({
    data: {
      membershipLevel: 'basic',
      membershipExpireAt: expireAt.toISOString(),
      isLocked: false,
      updatedAt: db.serverDate()
    }
  });

  return { level: 'basic', expiresAt: expireAt.toISOString() };
}
