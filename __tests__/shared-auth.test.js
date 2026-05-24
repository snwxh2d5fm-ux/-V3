/**
 * 单元测试: _shared/auth.js — scrypt密码哈希 + 锁定 + IP白名单 (P0-14修复)
 */
const auth = require('../cloudfunctions/_shared/auth');

describe('_shared/auth — scrypt密码哈希', () => {
  it('hashPassword 产出 salt:hash 格式', async () => {
    const h = await auth.hashPassword('test-password');
    expect(h).toMatch(/^[a-f0-9]+:[a-f0-9]+$/);
    const [salt, hash] = h.split(':');
    expect(salt).toHaveLength(32);
    expect(hash).toHaveLength(128);
  });

  it('verifyPassword 正确密码返回 valid=true', async () => {
    const h = await auth.hashPassword('correct');
    const r = await auth.verifyPassword('correct', h);
    expect(r.valid).toBe(true);
  });

  it('verifyPassword 错误密码返回 valid=false', async () => {
    const h = await auth.hashPassword('correct');
    const r = await auth.verifyPassword('wrong', h);
    expect(r.valid).toBe(false);
  });

  it('verifyPassword 不同salt产生不同哈希', async () => {
    const h1 = await auth.hashPassword('same-pw');
    const h2 = await auth.hashPassword('same-pw');
    expect(h1).not.toBe(h2);
    const r = await auth.verifyPassword('same-pw', h1);
    expect(r.valid).toBe(true);
  });
});

describe('_shared/auth — SHA-256遗留兼容', () => {
  it('verifyLegacy 正确密码返回 valid=true + needsMigration', () => {
    const sha = auth.sha256('legacy-pw');
    const r = auth.verifyLegacy('legacy-pw', sha);
    expect(r.valid).toBe(true);
    expect(r.needsMigration).toBe(true);
  });

  it('verifyLegacy 错误密码返回 valid=false', () => {
    const sha = auth.sha256('legacy-pw');
    const r = auth.verifyLegacy('wrong', sha);
    expect(r.valid).toBe(false);
  });

  it('sha256 确定性', () => {
    expect(auth.sha256('a')).toBe(auth.sha256('a'));
    expect(auth.sha256('a')).not.toBe(auth.sha256('b'));
  });
});

describe('_shared/auth — 暴力破解防护', () => {
  it('checkLockout 未锁定正常返回', () => {
    const admin = { loginAttempts: 0 };
    const lock = auth.checkLockout(admin);
    expect(lock.locked).toBe(false);
  });

  it('checkLockout 5次锁定', () => {
    const admin = { loginAttempts: 5, lockedUntil: new Date(Date.now() + 10 * 60 * 1000).toISOString() };
    const lock = auth.checkLockout(admin);
    expect(lock.locked).toBe(true);
    expect(lock.reason).toMatch(/锁定/);
  });

  it('checkLockout 锁定期过后解锁', () => {
    const admin = { loginAttempts: 5, lockedUntil: new Date(Date.now() - 1000).toISOString() };
    const lock = auth.checkLockout(admin);
    expect(lock.locked).toBe(false);
  });

  it('checkLockout 未达到5次不锁定', () => {
    const admin = { loginAttempts: 4 };
    const lock = auth.checkLockout(admin);
    expect(lock.locked).toBe(false);
  });
});

describe('_shared/auth — IP白名单', () => {
  it('未配置IP_WHITELIST 允许所有', () => {
    const r = auth.checkIPWhitelist('10.0.0.1');
    expect(r.allowed).toBe(true);
  });

  it('精确IP匹配', () => {
    const orig = process.env.IP_WHITELIST;
    process.env.IP_WHITELIST = '10.0.0.1,192.168.1.1';
    const r = auth.checkIPWhitelist('10.0.0.1');
    process.env.IP_WHITELIST = orig;
    expect(r.allowed).toBe(true);
  });

  it('不匹配IP拒绝', () => {
    const orig = process.env.IP_WHITELIST;
    process.env.IP_WHITELIST = '10.0.0.1';
    const r = auth.checkIPWhitelist('10.0.0.2');
    process.env.IP_WHITELIST = orig;
    expect(r.allowed).toBe(false);
  });

  it('CIDR网段匹配', () => {
    const orig = process.env.IP_WHITELIST;
    process.env.IP_WHITELIST = '192.168.1.0/24';
    const r = auth.checkIPWhitelist('192.168.1.100');
    process.env.IP_WHITELIST = orig;
    expect(r.allowed).toBe(true);
  });
});

describe('_shared/auth — 常量', () => {
  it('MAX_LOGIN_ATTEMPTS = 5', () => {
    expect(auth.MAX_LOGIN_ATTEMPTS).toBe(5);
  });
  it('LOCKOUT_MINUTES = 30', () => {
    expect(auth.LOCKOUT_MINUTES).toBe(30);
  });
});
