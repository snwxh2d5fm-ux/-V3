/**
 * 住港伴 V4 — 双闸门决策引擎 单元测试
 *
 * 8 种状态组合 + 4 种存储异常场景
 *
 * 闸门1: login  — 依赖 globalData.isLoggedIn
 * 闸门2: identity — 依赖 globalData.userStatus / Storage 兜底
 */

var gate = require('../utils/decision-gate');

// ============================================================
// 辅助：构造 getApp 返回值
// ============================================================
function mockApp(isLoggedIn, userStatus) {
  var gd = {};
  if (isLoggedIn !== undefined) gd.isLoggedIn = isLoggedIn;
  if (userStatus !== undefined) gd.userStatus = userStatus;
  return function() { return { globalData: gd }; };
}

describe('双闸门决策引擎 (V4)', function() {

  beforeEach(function() {
    // 重置全局 mock 到默认状态
    global.getApp = jest.fn(function() {
      return { globalData: { token: 'test_token', userData: null } };
    });
    // 清空存储
    Object.keys(global.__mockStorage).forEach(function(k) { delete global.__mockStorage[k]; });
    // 恢复 wx.getStorageSync 为默认实现（从 __mockStorage 读取）
    global.wx.getStorageSync = jest.fn(function(key) {
      return global.__mockStorage[key] !== undefined ? global.__mockStorage[key] : null;
    });
  });

  // ============================================================
  // Group 1: 闸门1 — 登录状态
  // ============================================================

  describe('闸门1 — 登录状态', function() {

    test('D-01: 未登录 + 未设置状态 → login', function() {
      global.getApp = mockApp(false, null);
      var result = gate.canMakeDecision();
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('login');
    });

    test('D-12: getApp() 返回 null → login', function() {
      global.getApp = jest.fn(function() { return null; });
      var result = gate.canMakeDecision();
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('login');
    });

  });

  // ============================================================
  // Group 2: 闸门2 — 身份状态 (globalData 通路)
  // ============================================================

  describe('闸门2 — globalData.userStatus', function() {

    test('D-02: 已登录 + userStatus="" → identity', function() {
      global.getApp = mockApp(true, '');
      var result = gate.canMakeDecision();
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('identity');
    });

    test('D-08: 已登录 + userStatus=null → identity', function() {
      global.getApp = mockApp(true, null);
      var result = gate.canMakeDecision();
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('identity');
    });

    test('D-09: 已登录 + userStatus=undefined → identity', function() {
      global.getApp = mockApp(true, undefined);
      var result = gate.canMakeDecision();
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('identity');
    });

  });

  // ============================================================
  // Group 3: 闸门2 — 跳过状态
  // ============================================================

  describe('闸门2 — 跳过(skipped)', function() {

    test('D-03: skipped → identity', function() {
      global.getApp = mockApp(true, 'skipped');
      var result = gate.canMakeDecision();
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('identity');
    });

  });

  // ============================================================
  // Group 4: 闸门2 — 有效状态
  // ============================================================

  describe('闸门2 — 有效身份状态 ✅', function() {

    test('D-04: unapplied → ok', function() {
      global.getApp = mockApp(true, 'unapplied');
      expect(gate.canMakeDecision()).toEqual({ ok: true, reason: null });
    });

    test('D-05: submitted → ok', function() {
      global.getApp = mockApp(true, 'submitted');
      expect(gate.canMakeDecision()).toEqual({ ok: true, reason: null });
    });

    test('D-06: approved → ok', function() {
      global.getApp = mockApp(true, 'approved');
      expect(gate.canMakeDecision()).toEqual({ ok: true, reason: null });
    });

    test('D-07: permanent → ok', function() {
      global.getApp = mockApp(true, 'permanent');
      expect(gate.canMakeDecision()).toEqual({ ok: true, reason: null });
    });

  });

  // ============================================================
  // Group 5: 存储异常场景 (Storage 兜底)
  // ============================================================

  describe('Storage 兜底 — 异常/脏数据', function() {

    test('D-10: Storage 返回数字 123 → identity', function() {
      global.getApp = mockApp(true, undefined);
      global.__mockStorage['__user_status__'] = 123;
      var result = gate.canMakeDecision();
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('identity');
    });

    test('D-11a: Storage 返回空对象 {} → identity', function() {
      global.getApp = mockApp(true, undefined);
      global.__mockStorage['__user_status__'] = {};
      var result = gate.canMakeDecision();
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('identity');
    });

    test('D-11b: Storage 抛出异常 → identity', function() {
      global.getApp = mockApp(true, undefined);
      global.wx.getStorageSync = jest.fn(function() {
        throw new Error('storage crash');
      });
      var result = gate.canMakeDecision();
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('identity');
    });

  });

  // ============================================================
  // Group 6: 边界场景
  // ============================================================

  describe('边界场景', function() {

    test('D-13: getApp() 不存在(全局未定义) → login', function() {
      var orig = global.getApp;
      delete global.getApp;
      var result = gate.canMakeDecision();
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('login');
      global.getApp = orig;
    });

    test('D-14: globalData 为 null → login', function() {
      global.getApp = jest.fn(function() { return { globalData: null }; });
      var result = gate.canMakeDecision();
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('login');
    });

  });

});
