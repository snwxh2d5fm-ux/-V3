/**
 * 住港伴 V4 — cf-alert 云函数 (HTTP)
 *
 * 功能:
 *   1. GET /cf-alert/status — 返回最近24h的云函数健康状态
 *   2. POST /cf-alert/send  — 手动触发告警推送
 *   3. GET /cf-alert/config — 查看告警配置状态
 *
 * 环境变量:
 *   WECOM_WEBHOOK_URL — 企微机器人 Webhook 地址（必配）
 */

const cloudbase = require('@cloudbase/node-sdk');
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();
const _ = db.command;

const COLLECTION = 'cf_error_logs';
const WECOM_WEBHOOK_URL = process.env.WECOM_WEBHOOK_URL || '';

// ========== 入口 ==========
exports.main = async (event, context) => {
  const method = (event.httpMethod || 'GET').toUpperCase();
  const path = event.path || '/';

  try {
    if (method === 'GET' && path.endsWith('/status')) {
      return await getHealthStatus();
    }
    if (method === 'GET' && path.endsWith('/config')) {
      return await getConfig();
    }
    if (method === 'POST' && path.endsWith('/send')) {
      return await manualSend(event);
    }
    // 默认返回可用端点
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service: 'cf-alert',
        version: '1.0.0',
        endpoints: ['/status', '/config', '/send'],
        webhookConfigured: !!WECOM_WEBHOOK_URL,
      }),
    };
  } catch (e) {
    console.error('[cf-alert] 异常:', e);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: e.message || 'internal error' }),
    };
  }
};

// ========== 健康状态 ==========
async function getHealthStatus() {
  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 3600000);

  // 按云函数分组统计最近24h错误
  const { data: errors } = await db
    .collection(COLLECTION)
    .where({ createdAt: _.gte(since24h.toISOString()) })
    .orderBy('createdAt', 'desc')
    .limit(200)
    .get();

  // 聚合统计
  const fnMap = {};
  let criticalCount = 0;
  let highCount = 0;

  for (const e of errors) {
    const key = e.fnName || 'unknown';
    if (!fnMap[key]) {
      fnMap[key] = { fnName: key, total: 0, critical: 0, high: 0, lastError: e.createdAt, lastMsg: '' };
    }
    fnMap[key].total++;
    if (e.severity === 'critical') {
      fnMap[key].critical++;
      criticalCount++;
    } else {
      fnMap[key].high++;
      highCount++;
    }
    if (!fnMap[key].lastError || e.createdAt > fnMap[key].lastError) {
      fnMap[key].lastError = e.createdAt;
      fnMap[key].lastMsg = (e.errorMsg || '').slice(0, 100);
    }
  }

  const summary = {
    checkedAt: now.toISOString(),
    last24h: {
      totalErrors: errors.length,
      critical: criticalCount,
      high: highCount,
      functionsAffected: Object.keys(fnMap).length,
    },
    functions: Object.values(fnMap).sort((a, b) => b.total - a.total),
  };

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(summary),
  };
}

// ========== 配置状态 ==========
async function getConfig() {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      webhookConfigured: !!WECOM_WEBHOOK_URL,
      webhookUrlMasked: WECOM_WEBHOOK_URL
        ? WECOM_WEBHOOK_URL.replace(/key=([^&]+)/, 'key=***')
        : '(not set)',
      errorCollection: COLLECTION,
      collectionInitialized: true, // 由首次写入自动创建
    }),
  };
}

// ========== 手动发送 ==========
async function manualSend(event) {
  const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body || {};

  if (!body.fnName || !body.errorMsg) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: '缺少必填字段: fnName, errorMsg' }),
    };
  }

  const { reportErrorHttp } = require('../_shared/error-reporter');
  await reportErrorHttp({
    fnName: body.fnName,
    action: body.action || 'manual',
    error: new Error(body.errorMsg),
    app,
    context: { manual: true, note: body.note || '' },
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, msg: '告警已发送' }),
  };
}
