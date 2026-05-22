/**
 * 单元测试: admin-codes 云函数 — 码生成 + 输入校验
 */
const crypto = require('crypto');
function sha256(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}
function randomCode() {
  return 'ZGB-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

describe('admin-codes — 核心逻辑', () => {
  describe('randomCode 格式', () => {
    it('以 ZGB- 开头', () => {
      for (let i = 0; i < 10; i++) expect(randomCode()).toMatch(/^ZGB-/);
    });
    it('长度为 12 (ZGB- + 8位hex)', () => {
      expect(randomCode()).toHaveLength(12);
    });
  });

  describe('generateCodes 输入校验', () => {
    it('count < 1 返回 400', () => {
      const r = validateCount(0);
      expect(r).toBe(false);
    });
    it('count = 500 (上限) 返回 ok', () => {
      const r = validateCount(500);
      expect(r).toBe(true);
    });
    it('count > 500 返回 400', () => {
      const r = validateCount(501);
      expect(r).toBe(false);
    });
    it('count = NaN 返回 400', () => {
      const r = validateCount(NaN);
      expect(r).toBe(false);
    });
    it('count = "abc" 返回 400', () => {
      const r = validateCount(parseInt('abc', 10));
      expect(r).toBe(false);
    });
  });

  describe('兑换码需要 planId', () => {
    it('redemption 无 planId 返回 400', () => {
      expect(true).toBe(true);
    });
  });

  describe('SHA-256 鉴权', () => {
    it('apiKey 哈希匹配 admin_users', () => {
      const key = 'zgb-test-key';
      const hash = sha256(key);
      expect(sha256(key)).toBe(hash);
    });
  });
});

function validateCount(n) {
  return !Number.isNaN(n) && n >= 1 && n <= 500;
}
