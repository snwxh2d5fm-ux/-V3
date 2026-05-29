/**
 * Unit tests for _virtual-pay/sign.js
 * Tests all 5 exported functions with deterministic inputs
 */
const sign = require('../sign');

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    failures.push({ name, error: e.message });
  }
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || 'assertEqual'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertType(v, type, msg) {
  if (typeof v !== type) {
    throw new Error(`${msg || 'assertType'}: expected ${type}, got ${typeof v}`);
  }
}

function assertMatch(v, regex, msg) {
  if (!regex.test(v)) {
    throw new Error(`${msg || 'assertMatch'}: ${JSON.stringify(v)} does not match ${regex}`);
  }
}

// ============================================================
// generateTradeNo
// ============================================================
test('returns string starting with ZGB', () => {
  assertMatch(sign.generateTradeNo(), /^ZGB/);
});

test('length 14-20 chars (4-byte random)', () => {
  const no = sign.generateTradeNo();
  if (no.length < 14 || no.length > 20) throw new Error(`bad length: ${no.length}`);
});

test('no leading underscore', () => {
  for (let i = 0; i < 50; i++) {
    if (sign.generateTradeNo().startsWith('_')) throw new Error('starts with _');
  }
});

test('1000 unique — no collision (P2 fix verified)', () => {
  const set = new Set();
  for (let i = 0; i < 1000; i++) set.add(sign.generateTradeNo());
  assertEqual(set.size, 1000, '1000 个均唯一（randomBytes(4) 修复后）');
});

test('alphanumeric only', () => {
  for (let i = 0; i < 20; i++) {
    assertMatch(sign.generateTradeNo(), /^[A-Za-z0-9]+$/);
  }
});

// ============================================================
// buildSignData
// ============================================================
test('returns valid JSON string', () => {
  JSON.parse(sign.buildSignData({ offerId:'1',productId:'p',goodsPrice:10,outTradeNo:'t',attach:'{}' }));
});

test('camelCase field names (not snake_case)', () => {
  const p = JSON.parse(sign.buildSignData({ offerId:'1',productId:'p',goodsPrice:10,outTradeNo:'t',attach:'{}' }));
  if (p.offer_id || p.buy_quantity || p.out_trade_no) throw new Error('should be camelCase');
  assertEqual(p.offerId, '1');
  assertEqual(p.buyQuantity, 1);
  assertEqual(p.currencyType, 'CNY');
});

test('env=1 included, env=undefined omitted', () => {
  assertEqual(JSON.parse(sign.buildSignData({ offerId:'1',productId:'p',goodsPrice:10,outTradeNo:'t',attach:'{}',env:1 })).env, 1);
  if ('env' in JSON.parse(sign.buildSignData({ offerId:'1',productId:'p',goodsPrice:10,outTradeNo:'t',attach:'{}' }))) throw new Error('env should be absent');
});

test('no platform field (causes -15005)', () => {
  if (JSON.parse(sign.buildSignData({ offerId:'1',productId:'p',goodsPrice:10,outTradeNo:'t',attach:'{}' })).platform) throw new Error('platform field present');
});

// ============================================================
// calculatePaySig
// ============================================================
test('64-char lowercase hex', () => {
  const sig = sign.calculatePaySig('key', '{"t":1}');
  assertEqual(sig.length, 64);
  assertMatch(sig, /^[a-f0-9]{64}$/);
});

test('deterministic', () => {
  assertEqual(sign.calculatePaySig('k','{"a":1}'), sign.calculatePaySig('k','{"a":1}'));
});

test('different keys → different output', () => {
  if (sign.calculatePaySig('A','{}') === sign.calculatePaySig('B','{}')) throw new Error('should differ');
});

test('different signData → different output', () => {
  if (sign.calculatePaySig('k','{"a":1}') === sign.calculatePaySig('k','{"a":2}')) throw new Error('should differ');
});

// ============================================================
// calculateSignature
// ============================================================
test('64-char lowercase hex', () => {
  assertMatch(sign.calculateSignature('sk','{}'), /^[a-f0-9]{64}$/);
});

test('deterministic', () => {
  assertEqual(sign.calculateSignature('sk','{}'), sign.calculateSignature('sk','{}'));
});

test('base64 chars in sessionKey handled (no decode)', () => {
  const sig = sign.calculateSignature('abc+/==123','{"t":1}');
  assertEqual(sig.length, 64);
});

test('paySig ≠ signature with different keys', () => {
  if (sign.calculatePaySig('app','{}') === sign.calculateSignature('ses','{}')) throw new Error('should differ');
});

// ============================================================
// checkConfig
// ============================================================
test('returns {ok, missing}', () => {
  const r = sign.checkConfig();
  assertType(r.ok, 'boolean');
  if (!Array.isArray(r.missing)) throw new Error('missing should be array');
});

// ============================================================
console.log(`sign.js: ${passed}/${passed + failed} passed`);
if (failed > 0) { failures.forEach(f => console.log(`  ❌ ${f.name}: ${f.error}`)); process.exit(1); }
