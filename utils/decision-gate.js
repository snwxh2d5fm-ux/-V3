/**
 * 住港伴 V4 — 双闸门决策引擎
 * 决策 = 已登录 + 已确认身份状态
 */
var VALID_STATUSES = ['unapplied', 'submitted', 'approved', 'permanent'];

function canMakeDecision() {
  var app;
  try { app = getApp(); } catch(e) { app = null; }
  var gd = app && app.globalData;

  var isLoggedIn = !!(gd && gd.isLoggedIn);
  if (!isLoggedIn) return { ok: false, reason: 'login' };

  var userStatus;
  try {
    userStatus = (gd && gd.userStatus) || wx.getStorageSync('__user_status__') || '';
  } catch(e) { userStatus = ''; }

  // 防御: 非字符串存储值降级为空
  if (typeof userStatus !== 'string') userStatus = '';

  if (!userStatus || userStatus === 'skipped') {
    return { ok: false, reason: 'identity' };
  }
  return { ok: true, reason: null };
}

module.exports = { canMakeDecision: canMakeDecision };
