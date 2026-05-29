/**
 * _virtual-pay/callback.js — 虚拟支付消息推送回调
 *
 * 来源: 微信官方文档 — 消息推送能力处理小程序虚拟支付回调
 *   https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloud/guide/wechatpay/virtual-payment-callback.html
 *
 * 配置: CloudBase 控制台 → 设置 → 消息推送 → 添加配置
 *   消息类型 = event
 *   事件类型 = xpay_goods_deliver_notify
 *   目标云函数 = payment
 *
 * 推送格式:
 *   { ToUserName, FromUserName, CreateTime, MsgType: 'event',
 *     Event: 'xpay_goods_deliver_notify',
 *     OpenId, OutTradeNo, Env }
 *
 * 响应格式: { ErrCode: 0, ErrMsg: 'success' }
 *   (非此格式微信认为失败，持续重试最多两天)
 *
 * ⚠️ 官方明确: 不可在前端 success 回调中发货！
 *    发货必须在消息推送回调中完成。
 *    wx.requestVirtualPayment 的 success 可能因异常丢失。
 */
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const CALLBACK_LOCKS = new Map();
const VIRTUAL_ENV = parseInt(process.env.VIRTUAL_ENV || '0', 10);

/**
 * CloudBase 消息推送入口
 * @param {Object} event - CloudBase 推送的虚拟支付事件
 * @returns {{ ErrCode: number, ErrMsg: string }}
 */
exports.main = async (event) => {
  const { Event: eventType, OpenId: openid, OutTradeNo: outTradeNo, Env: pushEnv } = event;

  // ---- 只处理道具发货通知 ----
  if (eventType !== 'xpay_goods_deliver_notify') {
    console.log('[vpay-cb] 非发货事件, 忽略:', eventType);
    return { ErrCode: 0, ErrMsg: 'ignored' };
  }

  // ---- 环境校验: 沙箱推送不在生产环境处理，反之亦然 ----
  if (pushEnv !== undefined && pushEnv !== VIRTUAL_ENV) {
    console.warn('[vpay-cb] 环境不匹配: pushEnv=%s, VIRTUAL_ENV=%s', pushEnv, VIRTUAL_ENV);
    return { ErrCode: 0, ErrMsg: 'env_mismatch' };
  }

  if (!outTradeNo) {
    console.error('[vpay-cb] 缺少 OutTradeNo');
    return { ErrCode: 0, ErrMsg: 'missing outTradeNo' };
  }

  if (!openid) {
    console.error('[vpay-cb] 缺少 OpenId');
    return { ErrCode: 0, ErrMsg: 'missing openid' };
  }

  // ---- 幂等锁 ----
  if (CALLBACK_LOCKS.has(outTradeNo)) {
    console.warn('[vpay-cb] 重复推送已锁定:', outTradeNo);
    return { ErrCode: 0, ErrMsg: 'success' };
  }
  CALLBACK_LOCKS.set(outTradeNo, Date.now());

  try {
    // ---- 查本地订单 ----
    let orderResult;
    try {
      orderResult = await db.collection('orders')
        .where({ outTradeNo: outTradeNo })
        .limit(1)
        .get();
    } catch (dbErr) {
      console.error('[vpay-cb] 查订单DB失败:', outTradeNo, dbErr.message);
      CALLBACK_LOCKS.delete(outTradeNo);
      return { ErrCode: 0, ErrMsg: 'success' }; // 返回成功停止重试
    }

    if (!orderResult.data || orderResult.data.length === 0) {
      console.error('[vpay-cb] 订单不存在:', outTradeNo);
      CALLBACK_LOCKS.delete(outTradeNo);
      return { ErrCode: 0, ErrMsg: 'success' };
    }

    const order = orderResult.data[0];

    // 已完成订单 → 直接返回成功
    if (order.status === 'completed') {
      CALLBACK_LOCKS.delete(outTradeNo);
      return { ErrCode: 0, ErrMsg: 'success' };
    }

    // ---- 更新订单状态 ----
    try {
      await db.collection('orders')
        .where({ outTradeNo: outTradeNo, status: 'pending' })
        .update({
          data: {
            status: 'completed',
            completedAt: db.serverDate(),
          },
        });
    } catch (updateErr) {
      console.error('[vpay-cb] 更新订单失败:', outTradeNo, updateErr.message);
      CALLBACK_LOCKS.delete(outTradeNo);
      return { ErrCode: -1, ErrMsg: 'order update failed' };
    }

    // ---- 发货（各副作用独立 try/catch） ----
    if (order.category === 'membership') {
      try {
        await activateMembership(openid, order);
      } catch (e) {
        console.error('[vpay-cb] 会员激活失败:', outTradeNo, e.message);
      }
    }

    if (order.category === 'guidebook_unlock') {
      try {
        await db.collection('users')
          .where({ _openid: openid })
          .update({ data: { guidebookAllUnlocked: true, updatedAt: db.serverDate() } });
      } catch (e) {
        console.error('[vpay-cb] 关卡解锁失败:', outTradeNo, e.message);
      }
    }

    // 审计日志
    try {
      await db.collection('audit_logs').add({
        data: {
          _openid: openid,
          action: 'payment_success',
          detail: {
            orderId: order._id,
            outTradeNo: outTradeNo,
            amount: order.amount,
            productId: order.productId,
            payChannel: 'virtual_payment',
            source: 'xpay_goods_deliver_notify',
          },
          createdAt: db.serverDate(),
        },
      });
    } catch (auditErr) {
      console.error('[vpay-cb] 审计日志写入失败:', outTradeNo, auditErr.message);
    }

    return { ErrCode: 0, ErrMsg: 'success' };
  } finally {
    setTimeout(() => CALLBACK_LOCKS.delete(outTradeNo), 60000);
  }
};

// ========== 会员激活 ==========

async function activateMembership(openid, order) {
  let level = 'basic';
  try {
    const planResult = await db.collection('membership_plans')
      .where({ planId: order.productId })
      .get();
    if (planResult.data.length > 0) level = planResult.data[0].level || 'basic';
  } catch (e) {
    console.error('[vpay-cb] 查询方案等级失败:', e.message);
  }

  const now = new Date();
  const duration = order.period === 'monthly' ? 30 : 365;
  const expireAt = new Date(now.getTime() + duration * 86400000);

  const existingSubs = await db.collection('subscription_records')
    .where({ _openid: openid, status: 'active' })
    .get();

  if (existingSubs.data.length > 0) {
    const sub = existingSubs.data[0];
    const currentExpire = new Date(sub.expireAt);
    const newExpire = currentExpire > now
      ? new Date(currentExpire.getTime() + duration * 86400000)
      : expireAt;
    await db.collection('subscription_records').doc(sub._id).update({
      data: { planId: order.productId, level, expireAt: newExpire.toISOString(), renewedAt: db.serverDate(), updatedAt: db.serverDate() },
    });
  } else {
    await db.collection('subscription_records').add({
      data: { _openid: openid, planId: order.productId, level, orderId: order._id || null, status: 'active', startedAt: db.serverDate(), expireAt: expireAt.toISOString(), autoRenew: false, createdAt: db.serverDate(), updatedAt: db.serverDate() },
    });
  }

  await db.collection('users').where({ _openid: openid }).update({
    data: { membershipLevel: level, membershipExpireAt: expireAt.toISOString(), isLocked: false, guidebookAllUnlocked: true, updatedAt: db.serverDate() },
  });

  await db.collection('audit_logs').add({
    data: { _openid: openid, action: 'subscription_activated', detail: { planId: order.productId, level, orderId: order._id, payChannel: 'virtual_payment', source: 'xpay_goods_deliver_notify' }, createdAt: db.serverDate() },
  });
}
