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
global.getApp = jest.fn(function() { return { globalData: {} }; });
global.Page = jest.fn();
global.App = jest.fn();

var confidence = require('../../../data/confidence');

var EXPECTED_LEVELS = ['A', 'B', 'C', 'D', 'E'];

describe('置信度框架 — CONFIDENCE 结构', function() {

  test('[P0] CONFIDENCE 包含5个级别: A/B/C/D/E', function() {
    expect(confidence.CONFIDENCE).toBeDefined();
    var keys = Object.keys(confidence.CONFIDENCE);
    EXPECTED_LEVELS.forEach(function(l) {
      expect(keys).toContain(l);
    });
  });

  test('[P0] 每个级别有 level/label/fullLabel/description', function() {
    EXPECTED_LEVELS.forEach(function(l) {
      var entry = confidence.CONFIDENCE[l];
      expect(entry.level).toBe(l);
      expect(entry.label).toBeDefined();
      expect(typeof entry.label).toBe('string');
      expect(entry.fullLabel).toBeDefined();
      expect(typeof entry.fullLabel).toBe('string');
      expect(entry.description).toBeDefined();
      expect(typeof entry.description).toBe('string');
    });
  });

  test('[P0] 每个级别有 color/bg/border/textColor', function() {
    EXPECTED_LEVELS.forEach(function(l) {
      var entry = confidence.CONFIDENCE[l];
      expect(entry.color).toBeDefined();
      expect(/^#[0-9A-Fa-f]{6}$/.test(entry.color)).toBe(true);
      expect(entry.bg).toBeDefined();
      expect(/^#[0-9A-Fa-f]{6}$/.test(entry.bg)).toBe(true);
      expect(entry.border).toBeDefined();
      expect(entry.textColor).toBeDefined();
      expect(/^#[0-9A-Fa-f]{6}$/.test(entry.textColor)).toBe(true);
    });
  });

  test('[P1] A/B级 isAuthoritative=true, canAutoApply=true', function() {
    ['A', 'B'].forEach(function(l) {
      expect(confidence.CONFIDENCE[l].isAuthoritative).toBe(true);
      expect(confidence.CONFIDENCE[l].canAutoApply).toBe(true);
    });
  });

  test('[P1] C级 isAuthoritative=false, canAutoApply=false', function() {
    expect(confidence.CONFIDENCE.C.isAuthoritative).toBe(false);
    expect(confidence.CONFIDENCE.C.canAutoApply).toBe(false);
  });

  test('[P1] D/E级 showBanner=true', function() {
    expect(confidence.CONFIDENCE.D.showBanner).toBe(true);
    expect(confidence.CONFIDENCE.E.showBanner).toBe(true);
  });
});

describe('置信度框架 — LEGAL_SOURCE', function() {

  test('[P0] LEGAL_SOURCE 存在且为非空对象', function() {
    expect(confidence.LEGAL_SOURCE).toBeDefined();
    var keys = Object.keys(confidence.LEGAL_SOURCE);
    expect(keys.length).toBeGreaterThanOrEqual(3);
  });

  test('[P1] 每个法源有 key/label/description', function() {
    var sources = confidence.LEGAL_SOURCE;
    Object.keys(sources).forEach(function(key) {
      var entry = sources[key];
      expect(entry.key).toBeDefined();
      expect(entry.label).toBeDefined();
      if (entry.description !== undefined) {
        expect(typeof entry.description).toBe('string');
      }
    });
  });
});

describe('置信度框架 — getConfidenceDisplay()', function() {

  test('[P0] getConfidenceDisplay 是函数', function() {
    expect(typeof confidence.getConfidenceDisplay).toBe('function');
  });

  test('[P0] 输入已知级别返回对应配置', function() {
    EXPECTED_LEVELS.forEach(function(l) {
      var result = confidence.getConfidenceDisplay(l);
      expect(result).toBeDefined();
      expect(result.level).toBe(l);
      expect(result.label).toBeDefined();
    });
  });

  test('[P1] 输入无效级别返回默认配置不崩', function() {
    var result = confidence.getConfidenceDisplay('X');
    expect(result).toBeDefined();
  });
});

describe('置信度框架 — getRuleAutoApply()', function() {

  test('[P0] getRuleAutoApply 是函数', function() {
    expect(typeof confidence.getRuleAutoApply).toBe('function');
  });

  test('[P0] A/B级 → true', function() {
    expect(confidence.getRuleAutoApply('A')).toBe(true);
    expect(confidence.getRuleAutoApply('B')).toBe(true);
  });

  test('[P0] C/D/E级 → false', function() {
    expect(confidence.getRuleAutoApply('C')).toBe(false);
    expect(confidence.getRuleAutoApply('D')).toBe(false);
    expect(confidence.getRuleAutoApply('E')).toBe(false);
  });

  test('[P1] 无效级别 → false', function() {
    expect(confidence.getRuleAutoApply('X')).toBe(false);
  });
});

describe('置信度框架 — formatLegalCitation()', function() {

  test('[P0] formatLegalCitation 是函数', function() {
    expect(typeof confidence.formatLegalCitation).toBe('function');
  });

  test('[P1] 有效参数返回非空字符串', function() {
    var result = confidence.formatLegalCitation({
      ordinanceLabel: 'Cap.115',
      sectionLabel: '入境条例',
      description: '测试'
    });
    expect(typeof result).toBe('string');
  });
});

describe('置信度框架 — LEGAL_CITATION_FORMAT', function() {

  test('[P1] LEGAL_CITATION_FORMAT 存在', function() {
    expect(confidence.LEGAL_CITATION_FORMAT).toBeDefined();
    expect(typeof confidence.LEGAL_CITATION_FORMAT).toBe('object');
  });
});

describe('置信度框架 — P0修正条目', function() {

  test('[P1] P0_LEGAL_FIXES 存在', function() {
    expect(confidence.P0_LEGAL_FIXES).toBeDefined();
    expect(typeof confidence.P0_LEGAL_FIXES).toBe('object');
  });

  test('[P1] P0_POLICY_FIXES 存在', function() {
    expect(confidence.P0_POLICY_FIXES).toBeDefined();
    expect(typeof confidence.P0_POLICY_FIXES).toBe('object');
  });

  test('[P1] P0修正条目有 title/wrongStatement/correctStatement/caveat/confidence/source', function() {
    var legalKeys = Object.keys(confidence.P0_LEGAL_FIXES || {});
    var policyKeys = Object.keys(confidence.P0_POLICY_FIXES || {});
    var allKeys = legalKeys.concat(policyKeys);
    allKeys.forEach(function(key) {
      var fix = confidence.P0_LEGAL_FIXES[key] || confidence.P0_POLICY_FIXES[key];
      if (!fix) return;
      expect(fix.title).toBeDefined();
      expect(fix.wrongStatement).toBeDefined();
      expect(fix.correctStatement).toBeDefined();
      expect(fix.confidence).toBeDefined();
      expect(fix.source).toBeDefined();
    });
  });
});
