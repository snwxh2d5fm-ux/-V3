/**
 * payment — 住港伴V3 微信支付V3直连服务
 *
 * 微信支付流程 (V3):
 *   前端 → createOrder → 微信支付V3 JSAPI下单 → 返回 prepay_id
 *   前端 → wx.requestPayment({ prepay_id, ... }) → 用户确认支付
 *   微信 → paymentCallback (V3 加密回调) → 更新订单 + 激活会员
 *
 * 环境变量 (CloudBase 控制台 → 云函数 → 环境变量):
 *   WXPAY_MCHID          = (商户号，从 pay.weixin.qq.com 获取)
 *   WXPAY_APPID          = (小程序AppID)
 *   WXPAY_API_V3_KEY     = (在 pay.weixin.qq.com → API安全 → APIv3密钥)
 *   WXPAY_SERIAL_NO      = (商户证书序列号)
 *   WXPAY_PRIVATE_KEY    = (apiclient_key.pem 内容, base64 或直接文本)
 *
 * PRD v4 对齐: MB-01~MB-05, PM-01~PM-03
 */
const cloud = require('wx-server-sdk');
const axios = require('axios');
const crypto = require('crypto');
const invoices = require('./invoices');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// ========== 微信支付V3配置 (从环境变量读取) ==========
const WXPAY_CONFIG = {
  mchid: process.env.WXPAY_MCHID || '',
  appid: process.env.WXPAY_APPID || 'wx08c2222c1bf042fd', // KEEP-INTENTIONAL: 5.22 rescue - restore removed fallback
  apiV3Key: process.env.WXPAY_API_V3_KEY || '',
  serialNo: process.env.WXPAY_SERIAL_NO || '',
  privateKey: (process.env.WXPAY_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  baseUrl: 'https://api.mch.weixin.qq.com',
};

if (!process.env.WXPAY_APPID) {
  console.warn('[payment] WXPAY_APPID 环境变量未设置，使用硬编码兜底值。请在 CloudBase 控制台→云函数→payment→环境变量中配置 WXPAY_APPID');
}

// ========== 入口 ==========
exports.main = async (event, context) => {
  const { action } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  // 微信支付回调是 HTTP 触发，event 结构不同
  if (event.httpMethod === 'POST' && event.path === '/payment/callback') {
    return await handleV3Callback(event);
  }

  try {
    switch (action) {
      case 'getPlans':
        return await getPlans(event);
      case 'getUserOrders':
        return await getUserOrders(openid, event);
      case 'getOrderStatus':
        return await getOrderStatus(openid, event);
      case 'createOrder':
        return await createOrder(openid, event);
      case 'confirmPayment':
        return await confirmPayment(openid, event);
      case 'checkSubscription':
        return await checkSubscription(openid);
      case 'getSubscriptions':
        return await getSubscriptions(openid);
      case 'cancelSubscription':
        return await cancelSubscription(openid, event);
      case 'identityReset':
        return await identityReset(openid, event);
      case 'unlockAllPhases':
        return await unlockAllPhases(openid, event);
      case 'createInvoice':
        return await invoices.createInvoice(openid, event, db);
      case 'getInvoices':
        return await invoices.getInvoices(openid, event, db);
      case 'getInvoiceDetail':
        return await invoices.getInvoiceDetail(openid, event, db);
      case 'deleteOrder':
        return await deleteOrder(openid, event);
      default:
        return { code: 400, msg: '无效操作' };
    }
  } catch (err) {
    console.error('[payment]', err);
    return { code: 500, msg: '支付服务异常，请稍后重试' };
  }
};

// ==================== 会员方案查询 ====================
async function getPlans(event) {
  const query = { isActive: true };
  if (event && event.planId) query.planId = event.planId;

  const result = await db.collection('membership_plans').where(query).orderBy('priceYearly', 'asc').get();

  return {
    code: 0,
    data: result.data.map((p) => ({
      planId: p.planId,
      planName: p.planName,
      level: p.level,
      priceMonthly: p.priceMonthly || 0,
      priceYearly: p.priceYearly || 0,
      features: p.features || [],
      limits: p.limits || {},
      highlighted: p.highlighted || false,
      badge: p.badge || null,
    })),
  };
}

// ==================== V3 签名工具 ====================
function buildAuthorization(method, urlPath, body) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const message = `${method}\n${urlPath}\n${timestamp}\n${nonce}\n${body || ''}\n`;
  const signature = crypto.createSign('RSA-SHA256').update(message).sign(WXPAY_CONFIG.privateKey, 'base64');
  return `WECHATPAY2-SHA256-RSA2048 mchid="${WXPAY_CONFIG.mchid}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${WXPAY_CONFIG.serialNo}"`;
}

// ==================== 订单管理 ====================

async function createOrder(openid, event) {
  // 校验V3配置
  if (!WXPAY_CONFIG.mchid || !WXPAY_CONFIG.privateKey) {
    console.error(
      '[payment] V3配置缺失: mchid=%s, key=%s',
      WXPAY_CONFIG.mchid ? 'OK' : 'MISSING',
      WXPAY_CONFIG.privateKey ? 'OK' : 'MISSING',
    );
    return { code: 500, msg: '支付服务未配置，请联系管理员' };
  }

  const { planId, productId, period = 'yearly' } = event;
  let orderInfo = null;

  if (planId) {
    const planResult = await db.collection('membership_plans').where({ planId, isActive: true }).get();
    if (planResult.data.length === 0) return { code: 404, msg: '会员方案不存在' };
    const plan = planResult.data[0];
    const price = period === 'monthly' ? plan.priceMonthly || 0 : plan.priceYearly || 0;
    if (price <= 0) return { code: 400, msg: '方案价格异常' };
    orderInfo = {
      productId: plan.planId,
      productName: plan.planName,
      amount: price,
      amountYuan: (price / 100).toFixed(2),
      category: 'membership',
      planId: plan.planId,
      level: plan.level,
      period,
    };
  } else if (productId) {
    const prodResult = await db.collection('products').where({ productId, isActive: true }).get();
    if (prodResult.data.length === 0) return { code: 404, msg: '商品不存在' };
    const product = prodResult.data[0];
    if (product.price <= 0) return { code: 400, msg: '商品价格异常' };
    orderInfo = {
      productId: product.productId,
      productName: product.name,
      amount: product.price,
      amountYuan: (product.price / 100).toFixed(2),
      category: product.category || 'service',
    };
  } else {
    return { code: 400, msg: '缺少 planId 或 productId' };
  }

  // 写入订单
  const { _id: orderId } = await db.collection('orders').add({
    data: {
      _openid: openid,
      productId: orderInfo.productId,
      planId: orderInfo.planId || null,
      productName: orderInfo.productName,
      amount: orderInfo.amount,
      amountYuan: orderInfo.amountYuan,
      category: orderInfo.category,
      period: orderInfo.period || null,
      status: 'pending',
      createdAt: db.serverDate(),
    },
  });

  // === 微信支付V3 JSAPI下单 ===
  try {
    const urlPath = '/v3/pay/transactions/jsapi';
    const reqBody = JSON.stringify({
      appid: WXPAY_CONFIG.appid,
      mchid: WXPAY_CONFIG.mchid,
      description: `住港伴 - ${orderInfo.productName}`,
      out_trade_no: orderId,
      notify_url: `https://${CLOUD_ENV}.service.tcloudbase.com/payment/callback`,
      amount: { total: orderInfo.amount, currency: 'CNY' },
      payer: { openid: openid },
    });

    const auth = buildAuthorization('POST', urlPath, reqBody);
    const resp = await axios.post(`${WXPAY_CONFIG.baseUrl}${urlPath}`, reqBody, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: auth,
      },
      timeout: 10000,
    });

    const prepayId = resp.data.prepay_id;
    if (!prepayId) {
      console.error('[payment] V3下单未返回prepay_id:', JSON.stringify(resp.data));
      throw new Error('no prepay_id');
    }

    // 生成前端 wx.requestPayment 所需参数
    const paySignParams = signForMiniProgram(WXPAY_CONFIG.appid, prepayId);
    return {
      code: 0,
      data: {
        orderId,
        payment: paySignParams,
        amount: orderInfo.amount,
        amountYuan: orderInfo.amountYuan,
        productName: orderInfo.productName,
      },
    };
  } catch (payErr) {
    console.error('[payment] V3下单失败:', payErr.response?.data || payErr.message);
    await db
      .collection('orders')
      .where({ _id: orderId })
      .update({
        data: { status: 'failed', failReason: 'v3_order_failed' },
      });
    return { code: 500, msg: '支付下单失败，请稍后重试' };
  }
}

/**
 * 生成小程序调起支付所需的签名参数
 */
function signForMiniProgram(appid, prepayId) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = crypto.randomBytes(16).toString('hex');
  const pkg = `prepay_id=${prepayId}`;
  const signStr = `${appid}\n${timestamp}\n${nonceStr}\n${pkg}\n`;
  const paySign = crypto.createSign('RSA-SHA256').update(signStr).sign(WXPAY_CONFIG.privateKey, 'base64');
  return {
    timeStamp: timestamp,
    nonceStr: nonceStr,
    package: pkg,
    signType: 'RSA',
    paySign: paySign,
  };
}

/**
 * 前端支付成功后主动确认（补充回调）
 *
 * 调用微信支付V3查询接口，验证用户是否已支付成功。
 * 为什么需要这个：
 *   Event 类型云函数不能接收 HTTP 回调，微信支付的异步通知可能无法到达。
 *   前端在 wx.requestPayment success 后调用此接口主动确认。
 */
async function confirmPayment(openid, event) {
  const { orderId } = event;
  if (!orderId) return { code: 400, msg: '缺少 orderId' };

  // 查本地订单
  const orderResult = await db.collection('orders').where({ _id: orderId }).get();
  if (!orderResult.data || orderResult.data.length === 0 || orderResult.data[0]._openid !== openid) {
    return { code: 404, msg: '订单不存在' };
  }
  const order = orderResult.data[0];

  // 已完成的订单直接返回
  if (order.status === 'completed') {
    return {
      code: 0,
      data: {
        orderId: order._id,
        status: 'completed',
        subscriptionActivated: order.subscriptionActivated || false,
      },
    };
  }

  // 向微信支付查询订单真实状态
  try {
    const urlPath = `/v3/pay/transactions/out-trade-no/${orderId}?mchid=${WXPAY_CONFIG.mchid}`;
    const auth = buildAuthorization('GET', urlPath, '');
    const resp = await axios.get(`${WXPAY_CONFIG.baseUrl}${urlPath}`, {
      headers: { Accept: 'application/json', Authorization: auth },
      timeout: 10000,
    });

    const tradeState = resp.data.trade_state;
    console.debug('[payment] 查单结果:', tradeState, 'orderId:', orderId);

    if (tradeState === 'SUCCESS') {
      // 支付成功 → 完成订单 + 激活会员
      await db
        .collection('orders')
        .where({ _id: orderId })
        .update({
          data: {
            status: 'completed',
            completedAt: db.serverDate(),
            transactionId: resp.data.transaction_id || '',
          },
        });

      if (order.category === 'membership' && order.planId) {
        await activateMembership(openid, order);
      }
      if (order.category === 'guidebook_unlock') {
        await db
          .collection('users')
          .where({ _openid: openid })
          .update({ data: { guidebookAllUnlocked: true, updatedAt: db.serverDate() } });
      }
      if (order.category === 'identity_reset') {
        await cloud.callFunction({
          name: 'process-manager',
          data: { action: 'resetIdentityPhase', transactionId: resp.data.transaction_id || '' },
        });
      }

      await db.collection('audit_logs').add({
        data: {
          _openid: openid,
          action: 'payment_success',
          detail: { orderId, amount: order.amount, planId: order.planId },
          createdAt: db.serverDate(),
        },
      });

      return {
        code: 0,
        data: {
          orderId: order._id,
          status: 'completed',
          subscriptionActivated: true,
        },
      };
    }

    // 未支付或支付中
    return {
      code: 0,
      data: {
        orderId: order._id,
        status: order.status,
        tradeState: tradeState || 'unknown',
        subscriptionActivated: false,
      },
    };
  } catch (e) {
    console.error('[payment] 查单失败:', e.response?.data || e.message);
    // 查单失败时不信任前端——返回错误让用户重试或联系客服
    // 订单状态保持pending，等待V3回调或用户手动重试
    return {
      code: 503,
      msg: '支付验证暂时不可用，请稍后重试。如已付款，款项将在30分钟内原路退回或自动到账。',
      data: {
        orderId: order._id,
        status: order.status,
        subscriptionActivated: false,
        retryAfter: 30000,
      },
    };
  }
}

// ==================== 订单查询 ====================

async function getUserOrders(openid, event) {
  const limit = Math.min((event && event.limit) || 10, 50);
  const result = await db
    .collection('orders')
    .where({ _openid: openid })
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  return {
    code: 0,
    data: result.data.map((o) => ({
      orderId: o._id,
      productName: o.productName,
      amount: o.amount,
      amountYuan: o.amountYuan,
      category: o.category,
      status: o.status,
      createdAt: o.createdAt,
      completedAt: o.completedAt,
    })),
  };
}

async function getOrderStatus(openid, event) {
  const { orderId } = event;
  if (!orderId) return { code: 400, msg: '缺少 orderId' };
  try {
    const qResult = await db.collection('orders').where({ _id: orderId }).get();
    if (!qResult.data || qResult.data.length === 0 || qResult.data[0]._openid !== openid) {
      return { code: 404, msg: '订单不存在' };
    }
    const order = qResult.data[0];
    return {
      code: 0,
      data: {
        orderId: order._id,
        status: order.status,
        amount: order.amount,
        productName: order.productName,
        subscriptionActivated: order.subscriptionActivated || false,
      },
    };
  } catch (e) {
    return { code: 404, msg: '订单不存在' };
  }
}

async function deleteOrder(openid, event) {
  const { orderId } = event;
  if (!orderId) return { code: 400, msg: '缺少 orderId' };
  try {
    // 验证订单归属
    const qResult = await db.collection('orders').where({ _id: orderId, _openid: openid }).get();
    if (!qResult.data || qResult.data.length === 0) {
      return { code: 404, msg: '订单不存在或无权操作' };
    }
    const order = qResult.data[0];
    // 已完成订单不允许删除
    if (order.status === 'completed') {
      return { code: 400, msg: '已支付订单不可删除' };
    }
    await db.collection('orders').doc(orderId).remove();
    return { code: 0, msg: '已删除' };
  } catch (e) {
    return { code: 500, msg: '删除失败' };
  }
}

// ==================== V3 支付回调 ====================

/**
 * 微信支付 V3 回调处理
 * 由微信支付平台 POST 到 notify_url（需公网可达）
 *
 * V3 回调体格式:
 *   { id, create_time, resource_type, event_type, summary,
 *     resource: { algorithm, ciphertext, associated_data, nonce, original_type } }
 */
/**
 * [V4.2-P1] 支付回调幂等key: 用 outTradeNo 防重复处理
 * 微信可能在未收到200时重试，需确保同一订单不重复激活会员
 */
const CALLBACK_LOCKS = new Map(); // 内存锁（云函数实例级别，短期有效）

async function handleV3Callback(event) {
  let outTradeNo = null;
  let transactionId = null;

  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

    // 验证微信支付V3回调签名（生产环境强制开启）
    const wechatSig = event.headers['wechatpay-signature'] || event.headers['Wechatpay-Signature'] || '';
    const timestamp = event.headers['wechatpay-timestamp'] || event.headers['Wechatpay-Timestamp'] || '';
    const nonce = event.headers['wechatpay-nonce'] || event.headers['Wechatpay-Nonce'] || '';
    const rawBody = typeof event.body === 'string' ? event.body : JSON.stringify(event.body);
    const signMessage = timestamp + '\n' + nonce + '\n' + rawBody + '\n';
    const v3Key = WXPAY_CONFIG.apiV3Key;
    if (!v3Key) {
      console.error('[payment] V3回调: apiV3Key未配置，拒绝回调处理');
      return { statusCode: 500, body: JSON.stringify({ code: 'FAIL', message: 'server not configured' }) };
    }
    const computed = require('crypto').createHmac('sha256', v3Key).update(signMessage).digest('base64');
    if (computed !== wechatSig) {
      console.error('[payment] V3回调签名验证失败');
      return { statusCode: 401, body: JSON.stringify({ code: 'FAIL', message: 'invalid signature' }) };
    }

    // 解密 resource
    const resource = body.resource;
    if (!resource || resource.algorithm !== 'AEAD_AES_256_GCM') {
      console.error('[payment] 回调resource格式不支持');
      return { statusCode: 400, body: JSON.stringify({ code: 'FAIL', message: 'bad resource' }) };
    }

    const plaintext = aesGcmDecrypt(
      resource.ciphertext,
      resource.associated_data || '',
      resource.nonce,
      WXPAY_CONFIG.apiV3Key,
    );

    const paymentData = JSON.parse(plaintext);
    outTradeNo = paymentData.out_trade_no;
    transactionId = paymentData.transaction_id;
    const tradeState = paymentData.trade_state;

    // 只处理支付成功
    if (tradeState !== 'SUCCESS') {
      return { statusCode: 200, body: JSON.stringify({ code: 'SUCCESS' }) };
    }

    // [V4.2-P1] 幂等检查：内存锁防并发重试
    if (CALLBACK_LOCKS.has(outTradeNo)) {
      console.warn('[payment] 重复回调已锁定:', outTradeNo);
      return { statusCode: 200, body: JSON.stringify({ code: 'SUCCESS' }) };
    }
    CALLBACK_LOCKS.set(outTradeNo, Date.now());

    let orderResult;
    try {
      orderResult = await db.collection('orders').doc(outTradeNo).get();
    } catch (dbErr) {
      console.error('[payment] 查询订单DB失败:', outTradeNo, dbErr.message);
      CALLBACK_LOCKS.delete(outTradeNo);
      // 返回200让微信停止重试（无订单可处理），记录异常供人工排查
      return { statusCode: 200, body: JSON.stringify({ code: 'SUCCESS', warning: 'db_read_failed' }) };
    }

    if (!orderResult.data) {
      console.error('[payment] 回调订单不存在:', outTradeNo);
      CALLBACK_LOCKS.delete(outTradeNo);
      return { statusCode: 200, body: JSON.stringify({ code: 'SUCCESS', warning: 'order_not_found' }) };
    }

    const order = orderResult.data;
    if (order.status === 'completed') {
      CALLBACK_LOCKS.delete(outTradeNo);
      return { statusCode: 200, body: JSON.stringify({ code: 'SUCCESS' }) };
    }

    // [V4.2-P1] 核心操作：标记订单完成（独立 try，失败时清理锁）
    try {
      await db
        .collection('orders')
        .doc(outTradeNo)
        .update({
          data: {
            status: 'completed',
            completedAt: db.serverDate(),
            transactionId: transactionId || '',
          },
        });
    } catch (updateErr) {
      console.error('[payment] 更新订单状态失败:', outTradeNo, updateErr.message);
      CALLBACK_LOCKS.delete(outTradeNo);
      return { statusCode: 500, body: JSON.stringify({ code: 'FAIL', message: 'order_update_failed' }) };
    }

    // [V4.2-P1] 副作用操作：各业务独立 try/catch，失败不影响主流程
    if (order.category === 'membership' && order.planId) {
      try {
        await activateMembership(order._openid, order);
      } catch (memberErr) {
        console.error('[payment] 激活会员失败(订单已完成):', outTradeNo, memberErr.message);
      }
    }
    if (order.category === 'identity_reset') {
      try {
        await cloud.callFunction({
          name: 'process-manager',
          data: { action: 'resetIdentityPhase', transactionId: transactionId },
        });
      } catch (resetErr) {
        console.error('[payment] 身份重置失败(订单已完成):', outTradeNo, resetErr.message);
      }
    }
    if (order.category === 'guidebook_unlock') {
      try {
        await db
          .collection('users')
          .where({ _openid: order._openid })
          .update({ data: { guidebookAllUnlocked: true, updatedAt: db.serverDate() } });
      } catch (unlockErr) {
        console.error('[payment] 关卡解锁失败(订单已完成):', outTradeNo, unlockErr.message);
      }
    }

    // 审计日志：失败不影响回调结果
    try {
      await db.collection('audit_logs').add({
        data: {
          _openid: order._openid,
          action: 'payment_success',
          detail: { orderId: outTradeNo, amount: order.amount, productId: order.productId, planId: order.planId },
          createdAt: db.serverDate(),
        },
      });
    } catch (auditErr) {
      console.error('[payment] 审计日志写入失败:', outTradeNo, auditErr.message);
    }

    // 清理内存锁（延迟30s释放，防止极端并发）
    setTimeout(() => CALLBACK_LOCKS.delete(outTradeNo), 30000);

    return { statusCode: 200, body: JSON.stringify({ code: 'SUCCESS' }) };
  } catch (e) {
    console.error('[payment] V3回调异常:', outTradeNo, e.message);
    return { statusCode: 500, body: JSON.stringify({ code: 'FAIL', message: 'internal error' }) };
  }
}

/**
 * AES-256-GCM 解密（V3回调resource解密）
 */
function aesGcmDecrypt(ciphertextB64, aad, nonceB64, key) {
  const ciphertext = Buffer.from(ciphertextB64, 'base64');
  const authTag = ciphertext.subarray(ciphertext.length - 16);
  const data = ciphertext.subarray(0, ciphertext.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key), Buffer.from(nonceB64, 'base64'));
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}

// ==================== ¥599 身份重置 ====================

async function identityReset(openid, event) {
  if (!WXPAY_CONFIG.mchid || !WXPAY_CONFIG.privateKey) {
    return { code: 500, msg: '支付服务未配置' };
  }

  const AMOUNT = 59900; // ¥599.00 (分)
  const productName = '身份状态重置';
  const category = 'identity_reset';

  // 前置检查1: 7天内是否已有重置
  const recentReset = await db
    .collection('orders')
    .where({
      _openid: openid,
      category: 'identity_reset',
      status: 'completed',
      createdAt: _.gte(new Date(Date.now() - 7 * 86400000)),
    })
    .get();
  if (recentReset.data.length > 0) {
    return { code: 429, msg: '7天内已进行过身份重置，请稍后再试' };
  }

  // 前置检查2: 是否存在未支付的 identity_reset 订单（防止重复创建）
  const pendingReset = await db
    .collection('orders')
    .where({
      _openid: openid,
      category: 'identity_reset',
      status: 'pending',
    })
    .get();
  if (pendingReset.data.length > 0) {
    return {
      code: 409,
      msg: '你有一笔未完成的身份重置订单，请先完成支付或等待过期后再试',
      data: { existingOrderId: pendingReset.data[0]._id },
    };
  }

  const { _id: orderId } = await db.collection('orders').add({
    data: {
      _openid: openid,
      productId: 'identity_reset',
      productName,
      amount: AMOUNT,
      amountYuan: '599.00',
      category,
      status: 'pending',
      createdAt: db.serverDate(),
    },
  });

  try {
    const urlPath = '/v3/pay/transactions/jsapi';
    const reqBody = JSON.stringify({
      appid: WXPAY_CONFIG.appid,
      mchid: WXPAY_CONFIG.mchid,
      description: `住港伴 - ${productName}`,
      out_trade_no: orderId,
      notify_url: `https://${CLOUD_ENV}.service.tcloudbase.com/payment/callback`,
      amount: { total: AMOUNT, currency: 'CNY' },
      payer: { openid },
    });

    const auth = buildAuthorization('POST', urlPath, reqBody);
    const resp = await axios.post(`${WXPAY_CONFIG.baseUrl}${urlPath}`, reqBody, {
      headers: { 'Content-Type': 'application/json', Authorization: auth },
    });

    if (!resp.data || !resp.data.prepay_id) {
      return { code: 500, msg: '微信支付下单失败', detail: resp.data };
    }

    const prepayId = resp.data.prepay_id;
    const nonceStr = crypto.randomBytes(16).toString('hex');
    const timeStamp = String(Math.floor(Date.now() / 1000));
    const pkg = 'prepay_id=' + prepayId;
    const signStr = [WXPAY_CONFIG.appid, timeStamp, nonceStr, pkg].join('\n') + '\n';
    const paySign = crypto.createSign('RSA-SHA256').update(signStr).sign(WXPAY_CONFIG.privateKey, 'base64');

    return {
      code: 0,
      data: {
        orderId,
        category,
        payment: {
          timeStamp,
          nonceStr,
          package: pkg,
          signType: 'RSA',
          paySign,
        },
      },
    };
  } catch (e) {
    console.error('[payment] identityReset error:', e);
    return { code: 500, msg: '支付创建失败', error: e.message };
  }
}

// ==================== ¥9.90 关卡提前解锁 ====================

async function unlockAllPhases(openid, event) {
  if (!WXPAY_CONFIG.mchid || !WXPAY_CONFIG.privateKey) {
    return { code: 500, msg: '支付服务未配置' };
  }

  const AMOUNT = 990; // ¥9.90 (分)
  const productName = '攻略书全部关卡提前解锁';
  const category = 'guidebook_unlock';

  // 前置检查: 是否已解锁或已是会员
  const userResult = await db.collection('users').where({ _openid: openid }).get();
  if (userResult.data.length > 0) {
    const user = userResult.data[0];
    if (user.guidebookAllUnlocked) return { code: 409, msg: '已解锁全部关卡，无需重复购买' };
    if (user.membershipLevel !== 'free') return { code: 409, msg: '已是付费会员，全部关卡已解锁' };
  }

  // 前置检查2: 是否存在未支付的 guidebook_unlock 订单
  const pendingUnlock = await db
    .collection('orders')
    .where({
      _openid: openid,
      category: 'guidebook_unlock',
      status: 'pending',
    })
    .get();
  if (pendingUnlock.data.length > 0) {
    return {
      code: 409,
      msg: '你有一笔未完成的关卡解锁订单，请先完成支付',
      data: { existingOrderId: pendingUnlock.data[0]._id },
    };
  }

  const { _id: orderId } = await db.collection('orders').add({
    data: {
      _openid: openid,
      productId: 'guidebook_unlock_all',
      productName,
      amount: AMOUNT,
      amountYuan: '9.90',
      category,
      status: 'pending',
      createdAt: db.serverDate(),
    },
  });

  try {
    const urlPath = '/v3/pay/transactions/jsapi';
    const reqBody = JSON.stringify({
      appid: WXPAY_CONFIG.appid,
      mchid: WXPAY_CONFIG.mchid,
      description: `住港伴 - ${productName}`,
      out_trade_no: orderId,
      notify_url: `https://${CLOUD_ENV}.service.tcloudbase.com/payment/callback`,
      amount: { total: AMOUNT, currency: 'CNY' },
      payer: { openid },
    });

    const auth = buildAuthorization('POST', urlPath, reqBody);
    const resp = await axios.post(`${WXPAY_CONFIG.baseUrl}${urlPath}`, reqBody, {
      headers: { 'Content-Type': 'application/json', Authorization: auth },
    });

    if (!resp.data || !resp.data.prepay_id) {
      return { code: 500, msg: '微信支付下单失败', detail: resp.data };
    }

    const prepayId = resp.data.prepay_id;
    const nonceStr = crypto.randomBytes(16).toString('hex');
    const timeStamp = String(Math.floor(Date.now() / 1000));
    const pkg = 'prepay_id=' + prepayId;
    const signStr = [WXPAY_CONFIG.appid, timeStamp, nonceStr, pkg].join('\n') + '\n';
    const paySign = crypto.createSign('RSA-SHA256').update(signStr).sign(WXPAY_CONFIG.privateKey, 'base64');

    return {
      code: 0,
      data: {
        orderId,
        category,
        payment: { timeStamp, nonceStr, package: pkg, signType: 'RSA', paySign },
      },
    };
  } catch (e) {
    console.error('[payment] unlockAllPhases error:', e);
    return { code: 500, msg: '支付创建失败', error: e.message };
  }
}

// ==================== 订阅管理 ====================

async function checkSubscription(openid) {
  const userResult = await db.collection('users').where({ _openid: openid }).get();
  if (userResult.data.length === 0) return { code: 404, msg: '用户不存在' };

  const user = userResult.data[0];
  const now = new Date();

  if (user.membershipLevel && user.membershipLevel !== 'free') {
    const expireAt = user.membershipExpireAt ? new Date(user.membershipExpireAt) : null;
    if (expireAt && expireAt <= now) {
      await db
        .collection('users')
        .where({ _openid: openid })
        .update({
          data: { membershipLevel: 'free', membershipExpireAt: null, isLocked: true, updatedAt: db.serverDate() },
        });
      return {
        code: 0,
        data: { level: 'free', isActive: false, isLocked: true, daysRemaining: 0, message: '会员已过期，请续费' },
      };
    }
    const daysRemaining = expireAt ? Math.ceil((expireAt.getTime() - now.getTime()) / 86400000) : 365;
    return {
      code: 0,
      data: {
        level: user.membershipLevel,
        isActive: true,
        isLocked: false,
        expireAt: user.membershipExpireAt,
        daysRemaining,
        message: `会员有效期剩余 ${daysRemaining} 天`,
      },
    };
  }

  if (user.freeTrialEndAt) {
    const trialEnd = new Date(user.freeTrialEndAt);
    if (trialEnd <= now) {
      return {
        code: 0,
        data: {
          level: 'free',
          isActive: false,
          isLocked: true,
          daysRemaining: 0,
          message: '免费试用已到期，请订阅会员',
        },
      };
    }
    const daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000);
    return {
      code: 0,
      data: {
        level: 'free_trial',
        isActive: true,
        isLocked: false,
        expireAt: user.freeTrialEndAt,
        daysRemaining,
        message: `免费试用剩余 ${daysRemaining} 天`,
      },
    };
  }

  return { code: 0, data: { level: 'free', isActive: true, isLocked: false, daysRemaining: 0, message: '免费用户' } };
}

async function getSubscriptions(openid) {
  const result = await db
    .collection('subscription_records')
    .where({ _openid: openid })
    .orderBy('createdAt', 'desc')
    .get();
  return {
    code: 0,
    data: result.data.map((s) => ({
      subscriptionId: s._id,
      planId: s.planId,
      level: s.level,
      status: s.status,
      startedAt: s.startedAt,
      expireAt: s.expireAt,
      autoRenew: s.autoRenew || false,
      renewedAt: s.renewedAt,
    })),
  };
}

async function cancelSubscription(openid, event) {
  const { subscriptionId } = event;
  if (!subscriptionId) return { code: 400, msg: '缺少 subscriptionId' };
  const subResult = await db.collection('subscription_records').where({ _id: subscriptionId, _openid: openid }).get();
  if (subResult.data.length === 0) return { code: 404, msg: '订阅记录不存在' };
  await db
    .collection('subscription_records')
    .doc(subscriptionId)
    .update({
      data: { status: 'cancelled', autoRenew: false, updatedAt: db.serverDate() },
    });
  await db.collection('audit_logs').add({
    data: { _openid: openid, action: 'subscription_cancelled', detail: { subscriptionId }, createdAt: db.serverDate() },
  });
  return { code: 0, msg: '订阅已取消，到期后不再续费' };
}

// ==================== 内部函数 ====================
// 发票管理已提取到 ./invoices.js

async function activateMembership(openid, order) {
  let level = 'basic';
  try {
    const planResult = await db.collection('membership_plans').where({ planId: order.planId }).get();
    if (planResult.data.length > 0) level = planResult.data[0].level || 'basic';
  } catch (e) {
    console.error('[payment] 查询方案等级失败:', e);
  }

  const now = new Date();
  const duration = order.period === 'monthly' ? 30 : 365;
  const expireAt = new Date(now.getTime() + duration * 86400000);

  const existingSubs = await db.collection('subscription_records').where({ _openid: openid, status: 'active' }).get();

  if (existingSubs.data.length > 0) {
    const sub = existingSubs.data[0];
    const currentExpire = new Date(sub.expireAt);
    const newExpire = currentExpire > now ? new Date(currentExpire.getTime() + duration * 86400000) : expireAt;
    await db
      .collection('subscription_records')
      .doc(sub._id)
      .update({
        data: {
          planId: order.planId,
          level,
          expireAt: newExpire.toISOString(),
          renewedAt: db.serverDate(),
          updatedAt: db.serverDate(),
        },
      });
  } else {
    await db.collection('subscription_records').add({
      data: {
        _openid: openid,
        planId: order.planId,
        level,
        orderId: order._id || null,
        status: 'active',
        startedAt: db.serverDate(),
        expireAt: expireAt.toISOString(),
        autoRenew: false,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate(),
      },
    });
  }

  await db
    .collection('users')
    .where({ _openid: openid })
    .update({
      data: {
        membershipLevel: level,
        membershipExpireAt: expireAt.toISOString(),
        isLocked: false,
        updatedAt: db.serverDate(),
      },
    });

  const orderDocId = order._id || order.orderId;
  if (orderDocId) {
    await db
      .collection('orders')
      .doc(orderDocId)
      .update({ data: { subscriptionActivated: true } });
  }

  await db.collection('audit_logs').add({
    data: {
      _openid: openid,
      action: 'subscription_activated',
      detail: { planId: order.planId, level, orderId: order._id },
      createdAt: db.serverDate(),
    },
  });
}
