/**
 * 住港伴 V4 — 邀请码/兑换码管理云函数 (admin-codes)
 * Phase 1: listCodes, getCodeStats, generateCodes
 * 鉴权: API Key (SHA-256) 验证, 与 admin-stats 共用 admin_users 集合
 */
const cloudbase = require('@cloudbase/node-sdk');
const crypto = require('crypto');
const app = cloudbase.init({ env: 'cloudbase-d1g17tgt7cc199a60' });
const db = app.database();
const _ = db.command;

function sha256(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

function randomCode() {
  // 统一格式 ZGB-XXXX-XXXX，与 invite-code 云函数保持一致
  const hex = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `ZGB-${hex.slice(0, 4)}-${hex.slice(4)}`;
}

exports.main = async (event) => {
  // HTTP 网关调用时 event.body 是 JSON 字符串
  let body = event;
  if (event.body && typeof event.body === 'string') {
    try {
      body = JSON.parse(event.body);
    } catch (_) {
      /* keep raw */
    }
  }
  const { action, params = {}, _apiKey } = body;

  // API Key 鉴权
  const apiKey = _apiKey || body._apiKey;
  if (!apiKey) return { code: 401, msg: '缺少 API Key' };

  const admin = await validateApiKey(apiKey);
  if (!admin) return { code: 401, msg: '无效的 API Key' };

  try {
    switch (action) {
      case 'listCodes':
        return await listCodes(params, admin);
      case 'getCodeStats':
        return await getCodeStats(params);
      case 'generateCodes':
        return await generateCodes(params, admin);
      default:
        return { code: 400, msg: '无效操作: ' + action };
    }
  } catch (err) {
    console.error('[admin-codes]', err);
    return { code: 500, msg: '服务异常: ' + (err.message || String(err)) };
  }
};

async function validateApiKey(apiKey) {
  const keyHash = sha256(apiKey);
  const res = await db.collection('admin_users').where({ apiKeyHash: keyHash, status: 'active' }).limit(1).get();
  return res.data.length > 0 ? res.data[0] : null;
}

// ========== listCodes ==========

async function listCodes(params, admin) {
  const { page = 1, pageSize = 50, codeType, status, batchId } = params;
  const query = {};
  if (codeType) query.codeType = codeType;
  if (status) query.status = status;
  if (batchId) query.batchId = batchId;

  const [result, count] = await Promise.all([
    db
      .collection('invite_codes')
      .where(query)
      .orderBy('generatedAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get(),
    db.collection('invite_codes').where(query).count(),
  ]);

  return {
    code: 0,
    msg: 'ok',
    data: { total: count.total, page, pageSize, list: result.data },
  };
}

// ========== getCodeStats ==========

async function getCodeStats(params) {
  const { codeType } = params;
  const query = {};
  if (codeType) query.codeType = codeType;

  const [total, activated] = await Promise.all([
    db.collection('invite_codes').where(query).count(),
    db
      .collection('invite_codes')
      .where(_.or([{ ...query, status: 'used' }, { ...query, status: 'redeemed' }]))
      .count(),
  ]);

  const generated = total.total;
  const actCount = activated.total;
  const rate = generated > 0 ? Math.round((actCount / generated) * 100) + '%' : '0%';

  return { code: 0, msg: 'ok', data: { generated, activated: actCount, activationRate: rate } };
}

// ========== generateCodes ==========

async function generateCodes(params, admin) {
  const { codeType = 'invite', planId, count = 10, expiresInDays = 30, batchName = '' } = params;

  // 输入校验 (P0-05)
  const qty = parseInt(count, 10);
  if (Number.isNaN(qty) || qty < 1 || qty > 500) {
    return { code: 400, msg: '数量需为 1-500 之间的整数' };
  }
  if (codeType === 'redemption' && !planId) {
    return { code: 400, msg: '兑换码需指定套餐 (planId)' };
  }

  const batchId =
    'batch_' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '_' + crypto.randomBytes(3).toString('hex');
  const expiresAt = expiresInDays > 0 ? new Date(Date.now() + expiresInDays * 86400000).toISOString() : null;

  const codes = [];
  for (let i = 0; i < qty; i++) {
    codes.push({
      code: randomCode(),
      codeType,
      planId: planId || null,
      planName: planId ? mapPlanName(planId) : null,
      batchId,
      batchName: batchName || batchId,
      maxActivations: 1,
      activationCount: 0,
      status: 'active',
      generatedBy: admin.email,
      generatedAt: new Date().toISOString(),
      expiresAt,
      note: batchName || '',
    });
  }

  // 批量写入 (CloudBase 最多 500 条/请求)
  await db.collection('invite_codes').add(codes);

  // 审计日志
  await db.collection('admin_audit_trail').add({
    data: {
      adminUid: admin.uid,
      adminName: admin.name,
      action: 'generate_codes',
      targetType: 'invite_code',
      targetId: batchId,
      detail: { codeType, count: qty, planId },
      ip: '',
      success: true,
      createdAt: new Date(),
    },
  });

  return {
    code: 0,
    msg: 'ok',
    data: { batchId, count: qty, codes: codes.map((c) => c.code) },
  };
}

function mapPlanName(planId) {
  const map = { annual_399: '年卡', pro_2999: '专业版', enterprise_6999: '企业版' };
  return map[planId] || planId;
}
