/**
 * _virtual-pay/order.js — 虚拟支付订单创建
 *
 * createVirtualOrder:
 *   1. 查商品信息（products 或 membership_plans）
 *   2. code2Session 换取 sessionKey + openid
 *   3. 校验 openid 一致性
 *   4. 写入 orders 集合
 *   5. 构建 signData + 计算 paySig / signature
 *   6. 丢弃 sessionKey → 返回支付参数
 */
const cloud = require('wx-server-sdk');
const sign = require('./sign');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// ========== 商品查找 ==========

/**
 * 根据虚拟支付道具 ID 查找商品信息
 * 先查 products 集合（攻略书解锁），再查 membership_plans（会员）
 */
async function lookupProduct(productId) {
  // 1. 查 products 集合
  const prodResult = await db.collection('products')
    .where({ productId, isActive: true })
    .limit(1)
    .get();
  if (prodResult.data.length > 0) {
    const p = prodResult.data[0];
    return {
      productId: p.productId,
      name: p.name,
      price: p.price,
      category: p.category || 'service',
    };
  }

  // 2. 查 membership_plans 集合（通过 virtualProductId 匹配）
  const planResult = await db.collection('membership_plans')
    .where({ virtualProductId: productId, isActive: true })
    .limit(1)
    .get();
  if (planResult.data.length > 0) {
    const p = planResult.data[0];
    return {
      productId: p.planId,
      virtualProductId: p.virtualProductId,
      name: p.planName,
      price: p.priceYearly,
      category: 'membership',
      level: p.level,
    };
  }

  return null;
}

// ========== 核心: 创建虚拟支付订单 ==========

/**
 * createVirtualOrder
 * @param {string} openid   - cloud.getWXContext().OPENID
 * @param {Object} event    - 云函数 event
 * @param {string} event.productId - 虚拟支付道具ID
 * @param {string} event.code      - wx.login() 返回的 code
 * @param {string} [event.period]  - 会员周期 (yearly/monthly)，默认 yearly
 * @returns {{ code, data?, msg? }}
 */
async function createVirtualOrder(openid, event) {
  const { productId, code, period } = event;

  // ---- 0. 参数校验 ----
  if (!productId) return { code: 400, msg: '缺少 productId' };
  if (!code) return { code: 400, msg: '缺少 code（请先 wx.login）' };

  // ---- 0a. 配置检查 ----
  const config = sign.checkConfig();
  if (!config.ok) {
    console.error('[virtual-pay] 配置缺失:', config.missing);
    return { code: 500, msg: '虚拟支付未配置，请联系管理员' };
  }

  // ---- 1. 查商品 ----
  const product = await lookupProduct(productId);
  if (!product) {
    return { code: 404, msg: '商品不存在' };
  }
  if (product.price <= 0) {
    return { code: 400, msg: '商品价格异常' };
  }

  // ---- 2. code2Session 换取 sessionKey ----
  let sessionKey;
  let sessionOpenid;
  try {
    const sessResult = await cloud.openapi.code2Session({ code });
    sessionKey = sessResult.session_key;
    sessionOpenid = sessResult.openid;
  } catch (e) {
    console.error('[virtual-pay] code2Session 失败:', e.message);
    return { code: 502, msg: '支付服务暂不可用，请稍后重试' };
  }

  if (!sessionKey || !sessionOpenid) {
    return { code: 401, msg: '登录态过期，请重新登录' };
  }

  // ---- 3. openid 校验 ----
  if (sessionOpenid !== openid) {
    console.error('[virtual-pay] openid 不一致:', 'session:', sessionOpenid.slice(-6), 'ctx:', openid.slice(-6));
    return { code: 403, msg: '身份验证失败' };
  }

  // ---- 4a. 前置检查：是否存在未支付的同类型虚拟支付订单 ----
  const pendingOrder = await db.collection('orders')
    .where({
      _openid: openid,
      productId: product.productId,
      payChannel: 'virtual_payment',
      status: 'pending',
    })
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
  if (pendingOrder.data.length > 0) {
    const elapsed = Date.now() - new Date(pendingOrder.data[0].createdAt).getTime();
    if (elapsed < 1800000) {
      return {
        code: 409,
        msg: '你有一笔未完成的支付订单，请先完成支付或等待过期后再试',
        data: { existingOrderId: pendingOrder.data[0]._id },
      };
    }
    // 超时 30 分钟的旧订单自动作废（不阻塞，但也不主动改状态以减少 DB 写入）
  }

  // ---- 4. 生成 outTradeNo + 写入订单 ----
  const outTradeNo = sign.generateTradeNo();
  const attach = JSON.stringify({ oid: openid.slice(-8), pid: productId, cat: product.category });

  const orderData = {
    _openid: openid,
    productId: product.productId,
    virtualProductId: product.virtualProductId || productId,
    productName: product.name,
    amount: product.price,
    amountYuan: (product.price / 100).toFixed(2),
    category: product.category,
    period: product.level ? (period || 'yearly') : null,
    outTradeNo: outTradeNo,
    payChannel: 'virtual_payment',
    status: 'pending',
    createdAt: db.serverDate(),
  };

  let orderId;
  try {
    const addResult = await db.collection('orders').add({ data: orderData });
    orderId = addResult._id;
  } catch (e) {
    console.error('[virtual-pay] 订单写入失败:', e.message);
    return { code: 500, msg: '订单创建失败，请稍后重试' };
  }

  // ---- 5. 构建 signData + 签名 ----
  const signData = sign.buildSignData({
    offerId: sign.VIRTUAL_OFFER_ID,
    productId: product.virtualProductId || productId,
    goodsPrice: product.price,
    outTradeNo: outTradeNo,
    attach: attach,
    env: sign.VIRTUAL_ENV,
  });

  const paySig = sign.calculatePaySig(sign.VIRTUAL_APP_KEY, signData);
  const userSignature = sign.calculateSignature(sessionKey, signData);

  // ---- 6. 丢弃 sessionKey ----
  sessionKey = null;
  // （函数作用域结束时 sessionKey 自然销毁，显式置 null 防意外闭包引用）

  return {
    code: 0,
    data: {
      orderId: orderId,
      signData: signData,
      paySig: paySig,
      signature: userSignature,
      mode: 'short_series_goods',
      productId: product.virtualProductId || productId,
      productName: product.name,
      amount: product.price,
      amountYuan: (product.price / 100).toFixed(2),
    },
  };
}

module.exports = { lookupProduct, createVirtualOrder };
