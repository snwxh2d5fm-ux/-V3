/**
 * _virtual-pay/confirm.js — 虚拟支付确认
 *
 * ⚠️ 官方约束: 不可在前端 success 回调中发货！
 *   wx.requestVirtualPayment 的 success 可能因异常丢失，
 *   发货必须在 CloudBase 消息推送回调 (xpay_goods_deliver_notify) 中完成。
 *   来源: developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloud/guide/wechatpay/virtual-payment-callback.html
 *
 * 因此本模块的 confirmPayment:
 *   - 仅做订单查询 + 审计日志写入
 *   - 不执行 dispatchFulfillment / activateMembership / unlock
 *   - 发货由 callback.js 的消息推送回调负责
 *
 * 四重校验（保留来自玄武评审 P0-01 的安全设计）:
 *   1. openid 归属校验（订单._openid === 当前用户）
 *   2. 订单状态校验（status === 'pending'）
 *   3. 时间窗口校验（createdAt 距今 ≤ 30 分钟）
 *   4. 环境校验（沙箱 pushEnv 与 VIRTUAL_ENV 匹配）
 */
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const ORDER_TIMEOUT_MS = 30 * 60 * 1000;
const CONFIRM_LOCK = new Map();
const VIRTUAL_ENV = parseInt(process.env.VIRTUAL_ENV || '0', 10);

/**
 * confirmPayment — 前端主动确认（仅记录，不发货）
 * @param {string} openid - cloud.getWXContext().OPENID
 * @param {Object} event  - { orderId, pushEnv? }
 */
async function confirmPayment(openid, event) {
  const { orderId } = event;
  if (!orderId) return { code: 400, msg: '缺少 orderId' };

  // 并发锁
  if (CONFIRM_LOCK.has(orderId)) {
    return { code: 429, msg: '订单处理中，请稍后查看结果' };
  }
  CONFIRM_LOCK.set(orderId, Date.now());

  try {
    let order;
    try {
      const orderResult = await db.collection('orders').doc(orderId).get();
      if (!orderResult.data) return { code: 404, msg: '订单不存在' };
      order = orderResult.data;
    } catch (e) {
      return { code: 404, msg: '订单不存在' };
    }

    // 第 1 重: openid 归属
    if (order._openid !== openid) {
      console.warn('[vpay-confirm] openid 不匹配:', orderId);
      return { code: 403, msg: '订单不存在' };
    }

    // 第 2 重: 状态校验
    if (order.status === 'completed') {
      return { code: 0, data: { orderId: order._id, status: 'completed', subscriptionActivated: order.subscriptionActivated || false } };
    }
    if (order.status !== 'pending') {
      return { code: 409, msg: '订单状态异常' };
    }

    // 第 3 重: 时间窗口
    const createdAt = order.createdAt ? new Date(order.createdAt).getTime() : 0;
    if (Date.now() - createdAt > ORDER_TIMEOUT_MS) {
      return { code: 410, msg: '订单已过期，请重新下单' };
    }

    // 第 4 重: 环境校验（沙箱推送不在生产处理）
    const pushEnv = event.pushEnv;
    if (pushEnv !== undefined && pushEnv !== VIRTUAL_ENV) {
      console.warn('[vpay-confirm] 环境不匹配:', pushEnv, VIRTUAL_ENV);
      return { code: 400, msg: '环境不匹配' };
    }

    // 写入审计日志（确认用户确实调用了 confirmPayment）
    try {
      await db.collection('audit_logs').add({
        data: {
          _openid: openid,
          action: 'payment_confirmed',
          detail: { orderId, outTradeNo: order.outTradeNo, amount: order.amount, productId: order.productId, payChannel: 'virtual_payment' },
          createdAt: db.serverDate(),
        },
      });
    } catch (e) {
      console.error('[vpay-confirm] 审计日志写入失败:', orderId, e.message);
    }

    // ⚠️ 不在此处发货！发货由 xpay_goods_deliver_notify 消息推送回调负责
    return { code: 0, data: { orderId: order._id, status: order.status, msg: '已确认，等待回调发货' } };
  } finally {
    setTimeout(() => CONFIRM_LOCK.delete(orderId), 60000);
  }
}

module.exports = { confirmPayment, CONFIRM_LOCK };
