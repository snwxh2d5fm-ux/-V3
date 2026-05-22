// 住港伴 V4 — admin-revenue: 财务看板
const cloudbase = require('@cloudbase/node-sdk');
const crypto = require('crypto');
const app = cloudbase.init({ env: 'cloudbase-d1g17tgt7cc199a60' });
const db = app.database();
function sha256(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

exports.main = async (event) => {
  let body = event;
  if (event.body && typeof event.body === 'string') {
    try {
      body = JSON.parse(event.body);
    } catch (_) {}
  }
  const { action, params = {}, _apiKey } = body;
  if (!_apiKey) return { code: 401, msg: '缺少 API Key' };
  const kh = sha256(_apiKey);
  const adm = await db.collection('admin_users').where({ apiKeyHash: kh, status: 'active' }).limit(1).get();
  if (!adm.data.length) return { code: 401, msg: '无效的 API Key' };

  try {
    switch (action) {
      case 'getRevenueSummary':
        return revSummary(params);
      case 'listOrders':
        return listOrders(params);
      case 'listInvoices':
        return listInvoices(params);
      case 'issueInvoice':
        return issueInvoice(params, adm.data[0]);
      case 'rejectInvoice':
        return rejectInvoice(params, adm.data[0]);
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
  return { code: 0, msg: 'ok' };
}
async function rejectInvoice(p, admin) {
  await db
    .collection('invoices')
    .where({ invoiceNumber: p.invoiceNumber })
    .update({ status: 'rejected', rejectedReason: p.reason || '', updatedAt: new Date().toISOString() });
  return { code: 0, msg: 'ok' };
}
