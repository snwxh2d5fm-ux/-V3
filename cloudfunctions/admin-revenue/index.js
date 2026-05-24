// 住港伴 V4 — admin-revenue: 财务看板
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
    console.warn('[IP白名单] admin-revenue 拒绝:', clientIp, ipCheck.reason);
    return { code: 403, msg: 'IP 不在白名单中' };
  }
  adm.data[0]._clientIp = clientIp;

  try {
    switch (action) {
      case 'getRevenueSummary':
        return revSummary(params);
      case 'listOrders':
        return listOrders(params);
      case 'listInvoices':
        return listInvoices(params);
      case 'issueInvoice':
        return await issueInvoice(params, adm.data[0]);
      case 'rejectInvoice':
        return await rejectInvoice(params, adm.data[0]);
      case 'exportRevenue': // P0-08
        return await exportRevenue(params, adm.data[0]);
      case 'exportOrders': // P0-08
        return await exportOrders(params, adm.data[0]);
      default:
        return { code: 400, msg: '无效操作: ' + action };
    }
  } catch (err) {
    return { code: 500, msg: err.message };
  }
};

async function revSummary(p) {
  const orders = await db.collection('orders').where({ status: 'completed' }).get();
  const total = (orders.data || []).reduce((s, o) => s + (o.amount || 0), 0);
  const byPlan = {};
  orders.data.forEach((o) => {
    byPlan[o.planId || 'other'] = (byPlan[o.planId || 'other'] || 0) + (o.amount || 0);
  });
  return {
    code: 0,
    msg: 'ok',
    data: {
      totalRevenue: total,
      orderCount: orders.data.length,
      avgOrder: orders.data.length ? Math.round(total / orders.data.length) : 0,
      revenueByPlan: byPlan,
    },
  };
}

async function listOrders(p) {
  const { page = 1, pageSize = 20 } = p;
  const [list, cnt] = await Promise.all([
    db
      .collection('orders')
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get(),
    db.collection('orders').count(),
  ]);
  return { code: 0, msg: 'ok', data: { total: cnt.total, page, pageSize, list: list.data } };
}

async function listInvoices(p) {
  const { page = 1, pageSize = 20 } = p;
  const [list, cnt] = await Promise.all([
    db
      .collection('invoices')
      .orderBy('applyAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get(),
    db.collection('invoices').count(),
  ]);
  return { code: 0, msg: 'ok', data: { total: cnt.total, page, pageSize, list: list.data } };
}

async function issueInvoice(p, admin) {
  await db
    .collection('invoices')
    .where({ invoiceNumber: p.invoiceNumber })
    .update({
      status: 'issued',
      issuedAt: new Date().toISOString(),
      invoiceUrl: p.invoiceUrl || '',
      adminNote: p.adminNote || '',
    });
  await audit.logAudit({
    admin: { email: admin.email, role: admin.role || 'unknown' },
    event: audit.AUDIT_EVENTS.CRUD,
    targetType: 'invoices',
    targetId: p.invoiceNumber,
    detail: { action: 'issueInvoice' },
    ip: admin._clientIp || '',
  }).catch((e) => console.error('[audit]', e));
  return { code: 0, msg: 'ok' };
}
async function rejectInvoice(p, admin) {
  await db
    .collection('invoices')
    .where({ invoiceNumber: p.invoiceNumber })
    .update({ status: 'rejected', rejectedReason: p.reason || '', updatedAt: new Date().toISOString() });
  await audit.logAudit({
    admin: { email: admin.email, role: admin.role || 'unknown' },
    event: audit.AUDIT_EVENTS.CRUD,
    targetType: 'invoices',
    targetId: p.invoiceNumber,
    detail: { action: 'rejectInvoice', reason: (p.reason || '').slice(0, 100) },
    ip: admin._clientIp || '',
  }).catch((e) => console.error('[audit]', e));
  return { code: 0, msg: 'ok' };
}

// P0-08: revenue/order export with audit
async function exportRevenue(p, admin) {
  const result = await revSummary(p);
  await audit.logAudit({
    admin: { email: admin.email, role: admin.role || 'unknown' },
    event: audit.AUDIT_EVENTS.DATA_EXPORT,
    targetType: 'revenue',
    detail: { action: 'exportRevenue' },
    ip: admin._clientIp || '',
  }).catch((e) => console.error('[audit]', e));
  return result;
}

async function exportOrders(p, admin) {
  const result = await listOrders(p);
  await audit.logAudit({
    admin: { email: admin.email, role: admin.role || 'unknown' },
    event: audit.AUDIT_EVENTS.DATA_EXPORT,
    targetType: 'orders',
    detail: { action: 'exportOrders', page: p.page || 1 },
    ip: admin._clientIp || '',
  }).catch((e) => console.error('[audit]', e));
  return result;
}
