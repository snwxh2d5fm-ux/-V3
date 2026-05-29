/**
 * Unit tests for _virtual-pay/callback.js
 * CloudBase message push format (NOT HTTP — contamination fixed)
 */
let passed = 0; let failed = 0;
function test(name, fn) { try { fn(); passed++; } catch(e) { failed++; console.log(`  ❌ ${name}: ${e.message}`); } }
function assertEqual(a,b,m) { if (a!==b) throw new Error(`${m||'assertEqual'}: ${JSON.stringify(b)} !== ${JSON.stringify(a)}`); }

// ============================================================
// Mock CloudBase
// ============================================================
let mockOrderResult = [];
let mockAddCalled = false;

const mockDb = {
  collection: (name) => {
    if (name === 'audit_logs') return { add: async () => { mockAddCalled = true; return { _id: 'audit_1' }; } };
    if (name === 'subscription_records') return { where: () => ({ get: async () => ({ data: [] }) }) };
    return mockDb;
  },
  where: () => ({
    limit: () => ({ get: async () => ({ data: mockOrderResult }) }),
    update: async () => ({ stats: { updated: 1 } }),
    orderBy: () => ({ limit: () => ({ get: async () => ({ data: [] }) }) }),
  }),
  doc: (id) => ({ get: async () => ({ data: mockOrderResult[0] || null }), update: async () => ({ stats: { updated: 1 } }) }),
  serverDate: () => new Date().toISOString(),
};

const Module = require('module');
const origRequire = Module.prototype.require;
Module.prototype.require = function(id) {
  if (id === 'wx-server-sdk') return { init: () => {}, database: () => mockDb, DYNAMIC_CURRENT_ENV: 'test-env' };
  return origRequire.apply(this, arguments);
};
delete require.cache[require.resolve('../callback')];
const callback = require('../callback');
Module.prototype.require = origRequire;

// ============================================================
// Tests: CloudBase 消息推送格式
// ============================================================
console.log('\n📦 消息推送回调 — 事件类型');
test('非 xpay_goods_deliver_notify 事件 → 忽略', async () => {
  const res = await callback.main({ Event: 'some_other_event' });
  assertEqual(res.ErrCode, 0);
  assertEqual(res.ErrMsg, 'ignored');
});

test('xpay_goods_deliver_notify → 正常处理', async () => {
  mockOrderResult = [];
  const res = await callback.main({
    Event: 'xpay_goods_deliver_notify',
    OpenId: 'test_openid',
    OutTradeNo: 'ZGBtest_001',
    Env: 0,
  });
  assertEqual(res.ErrCode, 0);
  assertEqual(res.ErrMsg, 'success');
});

// ============================================================
// Tests: 边界
// ============================================================
console.log('\n📦 消息推送回调 — 边界');

test('缺少 OutTradeNo → 返回 success（停止重试）', async () => {
  const res = await callback.main({ Event: 'xpay_goods_deliver_notify', OpenId: 'uid' });
  assertEqual(res.ErrCode, 0);
  assertEqual(res.ErrMsg, 'missing outTradeNo');
});

test('缺少 OpenId → 返回 success', async () => {
  const res = await callback.main({ Event: 'xpay_goods_deliver_notify', OutTradeNo: 'ZGBt' });
  assertEqual(res.ErrCode, 0);
  assertEqual(res.ErrMsg, 'missing openid');
});

test('环境不匹配 → 忽略', async () => {
  process.env.VIRTUAL_ENV = '0';
  delete require.cache[require.resolve('../callback')];
  const cb2 = require('../callback');
  const res = await cb2.main({ Event: 'xpay_goods_deliver_notify', OpenId: 'uid', OutTradeNo: 'ZGBt', Env: 1 });
  assertEqual(res.ErrCode, 0);
  assertEqual(res.ErrMsg, 'env_mismatch');
});

// ============================================================
// Tests: 幂等
// ============================================================
console.log('\n📦 消息推送回调 — 幂等');

test('同一 OutTradeNo 重复推送 → 都返回 success', async () => {
  mockOrderResult = [];
  const evt = { Event: 'xpay_goods_deliver_notify', OpenId: 'uid', OutTradeNo: 'ZGB_idem_002', Env: 0 };
  const r1 = await callback.main(evt);
  const r2 = await callback.main(evt);
  assertEqual(r1.ErrCode, 0);
  assertEqual(r2.ErrCode, 0);
});

// ============================================================
console.log(`\ncallback.js: ${passed}/${passed + failed} passed`);
if (failed > 0) process.exit(1);
