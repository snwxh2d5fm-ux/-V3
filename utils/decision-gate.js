/**
 * 住港伴 V4 — 双闸门决策引擎
 * 决策 = 已登录 + 已确认身份状态
 *
 * 闸门1: 登录状态  (globalData.isLoggedIn)
 * 闸门2: 身份状态  (globalData.userStatus → Storage 兜底)
 *
 * 返回 { ok: Boolean, reason: String|null }
 *   ok=true  → 双闸门通过，可执行决策
 *   ok=false → reason='login' | 'identity'
 */

var VALID_STATUSES = ['unapplied', 'submitted', 'approved', 'permanent'];

function canMakeDecision() {
  var app;
  try { app = getApp(); } catch(e) { app = null; }

  // 闸门1：登录状态
  var isLoggedIn = !!(app && app.globalData && app.globalData.isLoggedIn);
  if (!isLoggedIn) return { ok: false, reason: 'login' };

  // 闸门2：身份状态（globalData → Storage 兜底）
  var userStatus;
  try {
    userStatus = (app.globalData && app.globalData.userStatus) || wx.getStorageSync('__user_status__') || '';
  } catch(e) {
    userStatus = '';
  }

  if (!userStatus || userStatus === 'skipped' || VALID_STATUSES.indexOf(userStatus) === -1) {
    return { ok: false, reason: 'identity' };
  }

  return { ok: true, reason: null };
}

module.exports = { canMakeDecision: canMakeDecision };
