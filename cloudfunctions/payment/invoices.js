/**
 * payment/invoices — 发票管理模块
 * 从 payment/index.js 分离，处理发票申请、列表查询、详情
 */

/**
 * 创建发票申请
 * @param {string} openid
 * @param {object} event — { orderId, invoiceType: 'personal'|'company', title, taxNumber, email, address, phone, bankInfo }
 * @param {object} db - CloudBase database instance
 */
async function createInvoice(openid, event, db) {
  var orderId = (event.orderId || '').trim();
  var invoiceType = (event.invoiceType || 'personal').trim();
  var title = (event.title || '').trim();
  var taxNumber = (event.taxNumber || '').trim();
  var email = (event.email || '').trim();
  var address = (event.address || '').trim();
  var phone = (event.phone || '').trim();
  var bankInfo = (event.bankInfo || '').trim();

  if (!orderId) return { code: 400, msg: '缺少 orderId' };
  if (!['personal', 'company'].includes(invoiceType)) return { code: 400, msg: '无效的发票类型' };
  if (title.length > 100) return { code: 400, msg: '发票抬头不超过100字' };
  if (taxNumber.length > 30) return { code: 400, msg: '税号不超过30位' };
  if (address.length > 200) return { code: 400, msg: '地址不超过200字' };
  if (phone.length > 20) return { code: 400, msg: '电话不超过20位' };
  if (bankInfo.length > 200) return { code: 400, msg: '银行信息不超过200字' };

  var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (email && !emailRe.test(email)) return { code: 400, msg: '邮箱格式不正确' };

  var orderResult = await db.collection('orders').where({ _id: orderId, _openid: openid }).get();
  if (orderResult.data.length === 0) return { code: 404, msg: '订单不存在' };
  var order = orderResult.data[0];
  if (order.status !== 'completed') return { code: 400, msg: '仅已支付订单可申请发票' };

  var existing = await db.collection('invoices').where({ orderId: orderId, _openid: openid }).get();
  if (existing.data.length > 0) return { code: 400, msg: '该订单已申请过发票', data: { invoiceId: existing.data[0]._id } };

  if (invoiceType === 'company') {
    if (!title) return { code: 400, msg: '企业发票必须填写公司名称' };
    if (!taxNumber) return { code: 400, msg: '企业发票必须填写税号' };
  } else { title = title || '个人'; }

  var invoiceData = {
    _openid: openid, orderId: orderId, orderAmount: order.amount, orderAmountYuan: order.amountYuan,
    productName: order.productName, invoiceType: invoiceType, title: title, taxNumber: taxNumber,
    email: email, address: address, phone: phone, bankInfo: bankInfo,
    status: 'pending', createdAt: db.serverDate(), updatedAt: db.serverDate()
  };
  var addResult = await db.collection('invoices').add({ data: invoiceData });
  var invoiceId = addResult._id;

  try {
    await db.collection('audit_logs').add({
      data: { _openid: openid, action: 'invoice_requested',
        detail: { invoiceId: invoiceId, orderId: orderId, invoiceType: invoiceType }, createdAt: db.serverDate() }
    });
  } catch (auditErr) { console.error('[payment] audit_logs写入失败:', auditErr.message); }

  return { code: 0, data: { invoiceId: invoiceId, status: 'pending', msg: '发票申请已提交，3个工作日内发送至您的邮箱' } };
}

/**
 * 获取用户发票列表（分页）
 * @param {string} openid
 * @param {object} event — { limit, offset }
 * @param {object} db
 */
async function getInvoices(openid, event, db) {
  var limit = Math.min((event && event.limit) || 10, 50);
  var offset = Math.max(0, (event && event.offset) || 0);
  var countResult = await db.collection('invoices').where({ _openid: openid }).count();
  var result = await db.collection('invoices').where({ _openid: openid })
    .orderBy('createdAt', 'desc').skip(offset).limit(limit + 1).get();
  var items = result.data;
  var hasMore = items.length > limit;
  if (hasMore) items = items.slice(0, limit);
  var list = items.map(function(inv) {
    return { invoiceId: inv._id, orderId: inv.orderId, productName: inv.productName,
      orderAmountYuan: inv.orderAmountYuan, invoiceType: inv.invoiceType, title: inv.title,
      status: inv.status, createdAt: inv.createdAt, issuedAt: inv.issuedAt != null ? inv.issuedAt : null };
  });
  return { code: 0, data: { list: list, total: countResult.total, hasMore: hasMore, offset: offset, limit: limit } };
}

/**
 * 获取单张发票详情
 * @param {string} openid
 * @param {object} event — { invoiceId }
 * @param {object} db
 */
async function getInvoiceDetail(openid, event, db) {
  var invoiceId = event.invoiceId;
  if (!invoiceId) return { code: 400, msg: '缺少 invoiceId' };
  var result = await db.collection('invoices').where({ _id: invoiceId, _openid: openid }).get();
  if (result.data.length === 0) return { code: 404, msg: '发票记录不存在' };
  var inv = result.data[0];
  return { code: 0, data: { invoiceId: inv._id, orderId: inv.orderId, productName: inv.productName,
    orderAmountYuan: inv.orderAmountYuan, invoiceType: inv.invoiceType, title: inv.title,
    taxNumber: inv.taxNumber, email: inv.email, address: inv.address, phone: inv.phone,
    bankInfo: inv.bankInfo, status: inv.status, createdAt: inv.createdAt, issuedAt: inv.issuedAt != null ? inv.issuedAt : null } };
}

module.exports = { createInvoice, getInvoices, getInvoiceDetail };
