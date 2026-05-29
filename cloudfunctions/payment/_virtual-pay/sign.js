/**
 * _virtual-pay/sign.js — 虚拟支付签名模块
 *
 * 为 wx.requestVirtualPayment 生成 signData / paySig / signature。
 * signData 为 JSON 字符串（camelCase 字段名），与微信官方文档一致。
 *
 * 签名公式:
 *   paySig    = hex(hmac_sha256(appKey, "requestVirtualPayment&" + signData))
 *   signature = hex(hmac_sha256(sessionKey, "requestVirtualPayment&" + signData))
 *
 * 约束:
 *   - sessionKey 不做 Base64 解码
 *   - outTradeNo 不能以下划线开头
 *   - signData 中不传 platform 字段
 */
const crypto = require('crypto');

// ========== 环境变量 ==========
const VIRTUAL_OFFER_ID = process.env.VIRTUAL_OFFER_ID || '';
const VIRTUAL_APP_KEY = process.env.VIRTUAL_APP_KEY || '';
const VIRTUAL_ENV = process.env.VIRTUAL_ENV !== undefined ? parseInt(process.env.VIRTUAL_ENV, 10) : 0;

/**
 * 生成虚拟支付订单号
 * 格式: ZGB + 毫秒时间戳(36进制) + 4位随机hex
 * 满足: 8-32字符、字母数字混合、不以_开头
 */
function generateTradeNo() {
  const ts = Date.now().toString(36);
  const rand = crypto.randomBytes(4).toString('hex');  // 4 bytes = 8 hex chars = 4.3B 种可能
  return `ZGB${ts}${rand}`;
}

/**
 * 构建 signData JSON 字符串
 * @param {Object} opts
 * @param {string} opts.offerId       - 小程序虚拟支付 OfferID（mp.weixin.qq.com → 支付与交易 → 虚拟支付）
 * @param {string} opts.productId     - 虚拟支付道具ID
 * @param {number} opts.goodsPrice    - 道具单价(分)
 * @param {string} opts.outTradeNo    - 商户订单号
 * @param {string} opts.attach        - 透传数据JSON
 * @param {number} [opts.env]         - 0=正式, 1=沙箱
 * @returns {string} JSON字符串
 */
function buildSignData({ offerId, productId, goodsPrice, outTradeNo, attach, env }) {
  const params = {
    offerId: offerId || VIRTUAL_OFFER_ID,
    buyQuantity: 1,
    currencyType: 'CNY',
    outTradeNo: outTradeNo,
    productId: productId,
    goodsPrice: goodsPrice,
    attach: attach,
  };
  if (env !== undefined) {
    params.env = env;
  }
  return JSON.stringify(params);
}

/**
 * 计算 paySig（支付签名）
 * @param {string} appKey  - 小程序虚拟支付 AppKey
 * @param {string} signData - signData JSON字符串
 * @returns {string} hex小写
 */
function calculatePaySig(appKey, signData) {
  const key = appKey || VIRTUAL_APP_KEY;
  const message = 'requestVirtualPayment&' + signData;
  return crypto.createHmac('sha256', key).update(message).digest('hex');
}

/**
 * 计算 signature（用户态签名）
 * @param {string} sessionKey - code2Session返回的session_key原始值（不解码）
 * @param {string} signData   - signData JSON字符串
 * @returns {string} hex小写
 */
function calculateSignature(sessionKey, signData) {
  const message = 'requestVirtualPayment&' + signData;
  return crypto.createHmac('sha256', sessionKey).update(message).digest('hex');
}

/**
 * 校验虚拟支付配置是否就绪
 * @returns {{ ok: boolean, missing: string[] }}
 */
function checkConfig() {
  const missing = [];
  if (!VIRTUAL_OFFER_ID) missing.push('VIRTUAL_OFFER_ID');
  if (!VIRTUAL_APP_KEY) missing.push('VIRTUAL_APP_KEY');
  return { ok: missing.length === 0, missing };
}

module.exports = {
  generateTradeNo,
  buildSignData,
  calculatePaySig,
  calculateSignature,
  checkConfig,
  VIRTUAL_OFFER_ID,
  VIRTUAL_APP_KEY,
  VIRTUAL_ENV,
};
