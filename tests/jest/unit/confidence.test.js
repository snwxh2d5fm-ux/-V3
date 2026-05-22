/**
 * 住港伴 V3 — 置信度框架单元测试
 * 测试 data/confidence.js 的 CONFIDENCE / LEGAL_SOURCE / getConfidenceDisplay / getRuleAutoApply
 *
 * 运行: npx jest tests/jest/ --verbose
 */

// ============================================================
// Mock 微信全局 API
// ============================================================
global.wx = {};
global.getApp = jest.fn(function () {
  return { globalData: {} };
});
global.Page = jest.fn();
global.App = jest.fn();

const confidence = require('../../../data/confidence');

const EXPECTED_LEVELS = ['A', 'B', 'C', 'D', 'E'];

describe('置信度框架 — CONFIDENCE 结构', function () {
  test('[P0] CONFIDENCE 包含5个级别: A/B/C/D/E', function () {
    expect(confidence.CONFIDENCE).toBeDefined();
    const keys = Object.keys(confidence.CONFIDENCE);
    EXPECTED_LEVELS.forEach(function (l) {
      expect(keys).toContain(l);
    });
  });

  test('[P0] 每个级别有 level/label/fullLabel/description', function () {
    EXPECTED_LEVELS.forEach(function (l) {
      const entry = confidence.CONFIDENCE[l];
      expect(entry.level).toBe(l);
      expect(entry.label).toBeDefined();
      expect(typeof entry.label).toBe('string');
      expect(entry.fullLabel).toBeDefined();
      expect(typeof entry.fullLabel).toBe('string');
      expect(entry.description).toBeDefined();
      expect(typeof entry.description).toBe('string');
    });
  });

  test('[P0] 每个级别有 color/bg/border/textColor (hex)', function () {
    EXPECTED_LEVELS.forEach(function (l) {
      const entry = confidence.CONFIDENCE[l];
      expect(entry.color).toBeDefined();
      expect(/^#[0-9A-Fa-f]{6}$/.test(entry.color)).toBe(true);
      expect(entry.bg).toBeDefined();
      expect(/^#[0-9A-Fa-f]{6}$/.test(entry.bg)).toBe(true);
      expect(entry.border).toBeDefined();
      expect(entry.textColor).toBeDefined();
      expect(/^#[0-9A-Fa-f]{6}$/.test(entry.textColor)).toBe(true);
    });
  });

  test('[P1] A/B级 isAuthoritative=true, canAutoApply=true', function () {
    ['A', 'B'].forEach(function (l) {
      expect(confidence.CONFIDENCE[l].isAuthoritative).toBe(true);
      expect(confidence.CONFIDENCE[l].canAutoApply).toBe(true);
    });
  });

  test('[P1] C级 isAuthoritative=false, canAutoApply=false', function () {
    expect(confidence.CONFIDENCE.C.isAuthoritative).toBe(false);
    expect(confidence.CONFIDENCE.C.canAutoApply).toBe(false);
  });

  test('[P1] D/E级 showBanner=true', function () {
    expect(confidence.CONFIDENCE.D.showBanner).toBe(true);
    expect(confidence.CONFIDENCE.E.showBanner).toBe(true);
  });
});

describe('置信度框架 — LEGAL_SOURCE', function () {
  test('[P0] LEGAL_SOURCE 存在且为非空对象', function () {
    expect(confidence.LEGAL_SOURCE).toBeDefined();
    const keys = Object.keys(confidence.LEGAL_SOURCE);
    expect(keys.length).toBeGreaterThanOrEqual(3);
  });

  test('[P1] 每个法源有 type/label', function () {
    const sources = confidence.LEGAL_SOURCE;
    Object.keys(sources).forEach(function (key) {
      const entry = sources[key];
      expect(entry.type).toBeDefined();
      expect(entry.label).toBeDefined();
    });
  });
});

describe('置信度框架 — getConfidenceDisplay()', function () {
  test('[P0] getConfidenceDisplay 是函数', function () {
    expect(typeof confidence.getConfidenceDisplay).toBe('function');
  });

  test('[P0] 输入已知级别返回对应配置', function () {
    EXPECTED_LEVELS.forEach(function (l) {
      const result = confidence.getConfidenceDisplay(l);
      expect(result).toBeDefined();
      expect(result.level).toBe(l);
      expect(result.label).toBeDefined();
    });
  });

  test('[P1] 输入无效级别返回默认配置不崩', function () {
    const result = confidence.getConfidenceDisplay('X');
    expect(result).toBeDefined();
  });
});

describe('置信度框架 — getRuleAutoApply()', function () {
  test('[P0] getRuleAutoApply 是函数', function () {
    expect(typeof confidence.getRuleAutoApply).toBe('function');
  });

  test('[P0] A/B级 → "auto"', function () {
    expect(confidence.getRuleAutoApply('A')).toBe('auto');
    expect(confidence.getRuleAutoApply('B')).toBe('auto');
  });

  test('[P0] C级 → "confirm"', function () {
    expect(confidence.getRuleAutoApply('C')).toBe('confirm');
  });

  test('[P1] D/E级 → "disabled"', function () {
    expect(confidence.getRuleAutoApply('D')).toBe('disabled');
    expect(confidence.getRuleAutoApply('E')).toBe('disabled');
  });

  test('[P1] 无效级别 → "disabled"', function () {
    expect(confidence.getRuleAutoApply('X')).toBe('disabled');
  });
});

describe('置信度框架 — formatLegalCitation()', function () {
  test('[P0] formatLegalCitation 是函数', function () {
    expect(typeof confidence.formatLegalCitation).toBe('function');
  });

  test('[P1] formatLegalCitation 接收 type+ref 返回字符串', function () {
    const result = confidence.formatLegalCitation('cap115', 's.11(8)');
    expect(typeof result).toBe('string');
  });
});

describe('置信度框架 — LEGAL_CITATION_FORMAT', function () {
  test('[P1] LEGAL_CITATION_FORMAT 存在', function () {
    expect(confidence.LEGAL_CITATION_FORMAT).toBeDefined();
    expect(typeof confidence.LEGAL_CITATION_FORMAT).toBe('object');
  });
});

describe('置信度框架 — P0修正条目', function () {
  test('[P1] P0_LEGAL_FIXES 存在且有条目', function () {
    expect(confidence.P0_LEGAL_FIXES).toBeDefined();
    const keys = Object.keys(confidence.P0_LEGAL_FIXES);
    expect(keys.length).toBeGreaterThan(0);
    // 每条有 wrong/correct/reason/confidence
    keys.forEach(function (key) {
      const entry = confidence.P0_LEGAL_FIXES[key];
      expect(entry.wrong).toBeDefined();
      expect(entry.correct).toBeDefined();
      expect(entry.reason).toBeDefined();
      expect(entry.confidence).toBeDefined();
    });
  });

  test('[P1] P0_POLICY_FIXES 存在且有条目', function () {
    expect(confidence.P0_POLICY_FIXES).toBeDefined();
    const keys = Object.keys(confidence.P0_POLICY_FIXES);
    expect(keys.length).toBeGreaterThan(0);
    // 每条有 title/wrongStatement/correctStatement/confidence/source
    keys.forEach(function (key) {
      const entry = confidence.P0_POLICY_FIXES[key];
      expect(entry.title).toBeDefined();
      expect(entry.wrongStatement).toBeDefined();
      expect(entry.correctStatement).toBeDefined();
      expect(entry.confidence).toBeDefined();
      expect(entry.source).toBeDefined();
    });
  });
});
