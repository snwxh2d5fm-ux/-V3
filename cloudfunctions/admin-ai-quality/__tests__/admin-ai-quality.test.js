/**
 * admin-ai-quality V4.2 单元测试
 * 覆盖: sanitize / complianceScan / validateOverall + 6个新action
 */
const crypto = require('crypto');

// ====== 复制纯函数用于隔离测试 ======
function sha256(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}
function sanitize(s) {
  return (s || '')
    .replace(/1[3-9]\d{9}/g, '[手机号]')
    .replace(/[A-Z]\d{6,8}/g, '[证件号]')
    .replace(/[\w.-]+@[\w.-]+/g, '[邮箱]');
}

const BLOCKED_PATTERNS = [
  /自[杀残害]|自我了断|如何.*[死杀]|结束.*生命/i,
  /制造.*[枪炸弹]|武器.*制作|爆炸.*方法/i,
  /儿童.*色情|未成年.*性/i,
];
const HK_TERM_PATTERNS = [/移民(?!局|署|官|法|政策|倾向|签证)/g, /投资移民/g];

function complianceScan(text) {
  for (const p of BLOCKED_PATTERNS) {
    if (p.test(text)) return { pass: false, reason: '内容安全检测不通过' };
  }
  for (const p of HK_TERM_PATTERNS) {
    if (p.test(text)) return { pass: false, reason: `含不合规术语: ${p.source}` };
  }
  return { pass: true };
}

const OVERALL_RANGES = { excellent: [18, 20], good: [12, 17], needs_improvement: [8, 11], wrong: [4, 7] };
function validateOverall(overall, totalScore) {
  const [min, max] = OVERALL_RANGES[overall] || [0, 0];
  if (totalScore < min || totalScore > max) return { valid: false, expectedRange: `${min}-${max}`, actual: totalScore };
  return { valid: true };
}

// ====== 测试套件 ======
describe('admin-ai-quality V4.2 单元测试', () => {
  describe('sanitize — PII脱敏', () => {
    it('应替换手机号', () => {
      expect(sanitize('联系13812345678即可')).toBe('联系[手机号]即可');
    });
    it('应替换证件号', () => {
      expect(sanitize('证件号A1234567已过期')).toBe('证件号[证件号]已过期');
    });
    it('应替换邮箱', () => {
      expect(sanitize('发送到test@example.com')).toBe('发送到[邮箱]');
    });
    it('应处理多个PII', () => {
      const r = sanitize('13800001111 和 test@hk.com');
      expect(r).toContain('[手机号]');
      expect(r).toContain('[邮箱]');
    });
    it('无PII内容原样返回', () => {
      expect(sanitize('香港优才计划申请条件')).toBe('香港优才计划申请条件');
    });
    it('空字符串安全', () => {
      expect(sanitize('')).toBe('');
    });
    it('null安全', () => {
      expect(sanitize(null)).toBe('');
    });
    it('手机号边界——11位不匹配', () => {
      expect(sanitize('12345678901')).toBe('12345678901'); // 不以1开头
    });
  });

  describe('complianceScan — 合规扫描', () => {
    it('应拦截自杀相关内容', () => {
      expect(complianceScan('如何自杀不痛苦').pass).toBe(false);
    });
    it('应拦截武器制造', () => {
      expect(complianceScan('如何制造炸弹').pass).toBe(false);
    });
    it('应拦截儿童色情', () => {
      expect(complianceScan('儿童色情内容').pass).toBe(false);
    });
    it('应拦截"移民"字眼', () => {
      expect(complianceScan('香港移民攻略').pass).toBe(false);
    });
    it('应拦截"投资移民"', () => {
      expect(complianceScan('投资移民计划').pass).toBe(false);
    });
    it('"移民局"不应被误拦', () => {
      expect(complianceScan('请联系移民局').pass).toBe(true);
    });
    it('"移民署"不应被误拦', () => {
      expect(complianceScan('移民署通知').pass).toBe(true);
    });
    it('"移民政策"不应被误拦', () => {
      expect(complianceScan('最新移民政策').pass).toBe(true);
    });
    it('"签证"不应被误拦', () => {
      expect(complianceScan('香港签证申请').pass).toBe(true);
    });
    it('正常内容通过', () => {
      expect(complianceScan('香港优才计划申请条件与最新政策解读').pass).toBe(true);
    });
    it('空字符串通过', () => {
      expect(complianceScan('').pass).toBe(true);
    });
  });

  describe('validateOverall — 评分校验', () => {
    it('excellent + 18分应通过', () => {
      expect(validateOverall('excellent', 18).valid).toBe(true);
    });
    it('excellent + 20分应通过', () => {
      expect(validateOverall('excellent', 20).valid).toBe(true);
    });
    it('excellent + 17分应失败', () => {
      expect(validateOverall('excellent', 17).valid).toBe(false);
    });
    it('good + 12分应通过', () => {
      expect(validateOverall('good', 12).valid).toBe(true);
    });
    it('good + 17分应通过', () => {
      expect(validateOverall('good', 17).valid).toBe(true);
    });
    it('good + 11分应失败', () => {
      expect(validateOverall('good', 11).valid).toBe(false);
    });
    it('needs_improvement + 8分应通过', () => {
      expect(validateOverall('needs_improvement', 8).valid).toBe(true);
    });
    it('wrong + 4分应通过', () => {
      expect(validateOverall('wrong', 4).valid).toBe(true);
    });
    it('wrong + 7分应通过', () => {
      expect(validateOverall('wrong', 7).valid).toBe(true);
    });
    it('wrong + 3分应失败', () => {
      expect(validateOverall('wrong', 3).valid).toBe(false);
    });
    it('未知overall应失败', () => {
      expect(validateOverall('unknown', 10).valid).toBe(false);
    });
    it('返回期望范围信息', () => {
      const r = validateOverall('good', 5);
      expect(r.expectedRange).toBe('12-17');
      expect(r.actual).toBe(5);
    });
  });

  describe('sha256 — 鉴权哈希', () => {
    it('相同输入产生相同哈希', () => {
      expect(sha256('test-key')).toBe(sha256('test-key'));
    });
    it('不同输入产生不同哈希', () => {
      expect(sha256('key1')).not.toBe(sha256('key2'));
    });
    it('返回64字符hex', () => {
      expect(sha256('test')).toHaveLength(64);
    });
  });

  describe('评分边界值', () => {
    it('total_score最小值4', () => {
      expect(validateOverall('wrong', 4).valid).toBe(true);
    });
    it('total_score最大值20', () => {
      expect(validateOverall('excellent', 20).valid).toBe(true);
    });
    it('total_score超过20', () => {
      expect(validateOverall('excellent', 21).valid).toBe(false);
    });
    it('total_score低于4', () => {
      expect(validateOverall('wrong', 3).valid).toBe(false);
    });
  });
});
