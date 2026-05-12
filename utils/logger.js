/**
 * 住港伴 — 统一日志工具
 * 生产环境 (APP_ENV=prod) 静默所有日志
 */
const APP_ENV = typeof wx !== 'undefined' ? (wx.getStorageSync('__app_env__') || 'dev') : 'dev';

const logger = {
  info(module, msg, data) {
    if (APP_ENV !== 'prod') console.log(`[${module}] ${msg}`, data || '');
  },
  error(module, msg, err) {
    if (APP_ENV !== 'prod') console.error(`[${module}] ${msg}`, err || '');
    // 生产环境可上报到云函数错误收集
  },
  warn(module, msg) {
    if (APP_ENV !== 'prod') console.warn(`[${module}] ${msg}`);
  }
};

module.exports = logger;
