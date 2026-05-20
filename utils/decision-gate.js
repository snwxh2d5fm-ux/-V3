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

  // KR-01: 白名单校验 — 仅 ['unapplied','submitted','approved','permanent'] 视为有效
  if (typeof userStatus !== 'string' || !VALID_STATUSES.includes(userStatus)) {
    return { ok: false, reason: 'identity' };
  }
  return { ok: true, reason: null };
}

module.exports = { canMakeDecision: canMakeDecision };
