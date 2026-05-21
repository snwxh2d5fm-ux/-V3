var decisionGate = require('../utils/decision-gate');
var mockStorage = {};
var mockApp = { globalData: { isLoggedIn: false } };

beforeEach(function() {
  mockStorage = {};
  mockApp = { globalData: { isLoggedIn: false } };
  global.getApp = jest.fn(function() { return mockApp; });
  global.wx = global.wx || {};
  global.wx.getStorageSync = jest.fn(function(key) { return mockStorage[key] || null; });
});

function setState(isLoggedIn, userStatus) {
  mockApp.globalData.isLoggedIn = isLoggedIn;
  mockApp.globalData.userStatus = userStatus;
}

describe('canMakeDecision - Gate 1', function() {
  test('未登录 → login', function() {
    setState(false, null);
    expect(decisionGate.canMakeDecision()).toEqual({ ok: false, reason: 'login' });
  });
  test('getApp returns null → login', function() {
    global.getApp = jest.fn(function() { return null; });
    expect(decisionGate.canMakeDecision()).toEqual({ ok: false, reason: 'login' });
  });
});

describe('canMakeDecision - Gate 2', function() {
  test('userStatus empty → identity', function() {
    setState(true, '');
    expect(decisionGate.canMakeDecision()).toEqual({ ok: false, reason: 'identity' });
  });
  test('userStatus skipped → identity', function() {
    setState(true, 'skipped');
    expect(decisionGate.canMakeDecision()).toEqual({ ok: false, reason: 'identity' });
  });
  test('userStatus unapplied → ok', function() {
    setState(true, 'unapplied');
    expect(decisionGate.canMakeDecision()).toEqual({ ok: true, reason: null });
  });
  test('userStatus submitted → ok', function() {
    setState(true, 'submitted');
    expect(decisionGate.canMakeDecision()).toEqual({ ok: true, reason: null });
  });
  test('userStatus approved → ok', function() {
    setState(true, 'approved');
    expect(decisionGate.canMakeDecision()).toEqual({ ok: true, reason: null });
  });
  test('userStatus permanent → ok', function() {
    setState(true, 'permanent');
    expect(decisionGate.canMakeDecision()).toEqual({ ok: true, reason: null });
  });
  test('userStatus null → identity', function() {
    setState(true, null);
    expect(decisionGate.canMakeDecision()).toEqual({ ok: false, reason: 'identity' });
  });
});

describe('canMakeDecision - Storage fallback', function() {
  test('falls back to __user_status__ in Storage', function() {
    setState(true, null);
    mockStorage.__user_status__ = 'unapplied';
    expect(decisionGate.canMakeDecision()).toEqual({ ok: true, reason: null });
  });
  test('Storage returns number → identity', function() {
    setState(true, null);
    mockStorage.__user_status__ = 123;
    expect(decisionGate.canMakeDecision()).toEqual({ ok: false, reason: 'identity' });
  });
  test('Storage returns object → identity', function() {
    setState(true, null);
    mockStorage.__user_status__ = {};
    expect(decisionGate.canMakeDecision()).toEqual({ ok: false, reason: 'identity' });
  });
  test('Storage throws → identity', function() {
    setState(true, null);
    global.wx.getStorageSync = jest.fn(function() { throw new Error('crash'); });
    expect(decisionGate.canMakeDecision()).toEqual({ ok: false, reason: 'identity' });
  });
});

describe('Edge cases', function() {
  test('getApp undefined → login', function() {
    global.getApp = undefined;
    expect(decisionGate.canMakeDecision()).toEqual({ ok: false, reason: 'login' });
  });
  test('globalData null → login', function() {
    global.getApp = jest.fn(function() { return { globalData: null }; });
    expect(decisionGate.canMakeDecision()).toEqual({ ok: false, reason: 'login' });
  });
});
