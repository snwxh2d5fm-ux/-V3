/**
 * 住港伴 V3 — 数据完整性单元测试
 * 验证 constants.js 中 APPLICATION_PATHS / PATH_NAMES / PATH_RISK_LEVELS / PATH_CYCLES
 * 的完整性和一致性
 *
 * 运行: npx jest tests/jest/ --verbose
 */

// ============================================================
// Mock 微信全局 API
// ============================================================
global.wx = {};
global.getApp = jest.fn(() => ({ globalData: {} }));
global.Page = jest.fn();
global.App = jest.fn();

var CONSTANTS = require('../../../data/constants');

var PATH_KEYS = Object.keys(CONSTANTS.APPLICATION_PATHS).map(function(k) {
  return CONSTANTS.APPLICATION_PATHS[k];
});

// 已确认的13条路径(含退休)
var EXPECTED_PATH_COUNT = 13;

var EXPECTED_PATH_VALUES = [
  'student_iang',
  'parttime_qmas',
  'ttps_a',
  'ttps_b',
  'ttps_c',
  'qmas',
  'asmpt',
  'techtas',
  'cies',
  'dependent',
  'minor_student',
  'exchange',
  'retirement'
];

describe('数据完整性 — APPLICATION_PATHS / PATH_NAMES / PATH_RISK_LEVELS / PATH_CYCLES', function() {

  // ============================================================
  // 1. 路径条目数
  // ============================================================
  test('[P0] APPLICATION_PATHS 包含13条路径(含退休)', function() {
    expect(PATH_KEYS.length).toBe(EXPECTED_PATH_COUNT);
  });

  test('[P0] PATH_NAMES 条目数与路径数一致', function() {
    expect(Object.keys(CONSTANTS.PATH_NAMES).length).toBe(PATH_KEYS.length);
  });

  test('[P0] PATH_RISK_LEVELS 条目数与路径数一致', function() {
    expect(Object.keys(CONSTANTS.PATH_RISK_LEVELS).length).toBe(PATH_KEYS.length);
  });

  test('[P0] PATH_CYCLES 条目数与路径数一致', function() {
    expect(Object.keys(CONSTANTS.PATH_CYCLES).length).toBe(PATH_KEYS.length);
  });

  // ============================================================
  // 2. 每个路径key在全部字典中都有对应条目
  // ============================================================
  test('[P0] APPLICATION_PATHS 每个值在 PATH_NAMES 中都有对应', function() {
    PATH_KEYS.forEach(function(key) {
      expect(CONSTANTS.PATH_NAMES[key]).toBeDefined();
    });
  });

  test('[P0] APPLICATION_PATHS 每个值在 PATH_RISK_LEVELS 中都有对应', function() {
    PATH_KEYS.forEach(function(key) {
      expect(CONSTANTS.PATH_RISK_LEVELS[key]).toBeDefined();
    });
  });

  test('[P0] APPLICATION_PATHS 每个值在 PATH_CYCLES 中都有对应', function() {
    PATH_KEYS.forEach(function(key) {
      expect(CONSTANTS.PATH_CYCLES[key]).toBeDefined();
    });
  });

  // ============================================================
  // 3. 反向检查: 所有字典没有多余条目
  // ============================================================
  test('[P0] PATH_NAMES 没有多余的key', function() {
    var namesKeys = Object.keys(CONSTANTS.PATH_NAMES);
    namesKeys.forEach(function(key) {
      expect(PATH_KEYS).toContain(key);
    });
  });

  test('[P0] PATH_RISK_LEVELS 没有多余的key', function() {
    var riskKeys = Object.keys(CONSTANTS.PATH_RISK_LEVELS);
    riskKeys.forEach(function(key) {
      expect(PATH_KEYS).toContain(key);
    });
  });

  test('[P0] PATH_CYCLES 没有多余的key', function() {
    var cyclesKeys = Object.keys(CONSTANTS.PATH_CYCLES);
    cyclesKeys.forEach(function(key) {
      expect(PATH_KEYS).toContain(key);
    });
  });

  // ============================================================
  // 4. 具体路径值验证
  // ============================================================
  test('[P0] 13条路径值与期望一致', function() {
    EXPECTED_PATH_VALUES.forEach(function(v) {
      expect(PATH_KEYS).toContain(v);
    });
  });

  // ============================================================
  // 5. PATH_RISK_LEVELS 值格式验证
  // ============================================================
  test('[P0] PATH_RISK_LEVELS 值格式: {level, label, color}', function() {
    var riskKeys = Object.keys(CONSTANTS.PATH_RISK_LEVELS);
    riskKeys.forEach(function(key) {
      var entry = CONSTANTS.PATH_RISK_LEVELS[key];
      expect(entry).toHaveProperty('level');
      expect(entry).toHaveProperty('label');
      expect(entry).toHaveProperty('color');
      // level 必须是非空字符串
      expect(typeof entry.level).toBe('string');
      expect(entry.level.length).toBeGreaterThan(0);
      // label 必须是字符串
      expect(typeof entry.label).toBe('string');
      expect(entry.label.length).toBeGreaterThan(0);
      // color 必须是有效的6位十六进制色值(#XXXXXX)
      expect(/^#[0-9A-Fa-f]{6}$/.test(entry.color)).toBe(true);
    });
  });

  // ============================================================
  // 6. PATH_CYCLES 值格式验证
  // ============================================================
  test('[P0] PATH_CYCLES 值格式: {label, firstVisa}', function() {
    var cyclesKeys = Object.keys(CONSTANTS.PATH_CYCLES);
    cyclesKeys.forEach(function(key) {
      var entry = CONSTANTS.PATH_CYCLES[key];
      expect(entry).toHaveProperty('label');
      expect(entry).toHaveProperty('firstVisa');
      expect(typeof entry.label).toBe('string');
      expect(entry.label.length).toBeGreaterThan(0);
      expect(typeof entry.firstVisa).toBe('string');
    });
  });

  // ============================================================
  // 7. PATH_NAMES 格式验证
  // ============================================================
  test('[P1] PATH_NAMES 所有值为非空字符串', function() {
    var namesKeys = Object.keys(CONSTANTS.PATH_NAMES);
    namesKeys.forEach(function(key) {
      var name = CONSTANTS.PATH_NAMES[key];
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // 8. APPLICATION_PATHS 常量值验证
  // ============================================================
  test('[P1] APPLICATION_PATHS 所有值为唯一字符串', function() {
    var values = Object.keys(CONSTANTS.APPLICATION_PATHS).map(function(k) {
      return CONSTANTS.APPLICATION_PATHS[k];
    });
    var uniqueValues = values.filter(function(v, i, arr) {
      return arr.indexOf(v) === i;
    });
    expect(uniqueValues.length).toBe(values.length);
  });

  // ============================================================
  // 9. 退休路径特殊验证
  // ============================================================
  test('[P0] 退休路径在全部字典中存在', function() {
    expect(CONSTANTS.APPLICATION_PATHS.RETIREMENT).toBe('retirement');
    expect(CONSTANTS.PATH_NAMES.retirement).toBeDefined();
    expect(CONSTANTS.PATH_RISK_LEVELS.retirement).toBeDefined();
    expect(CONSTANTS.PATH_CYCLES.retirement).toBeDefined();
  });

  // ============================================================
  // 10. 无循环引用检查
  // ============================================================
  test('[P1] APPLICATION_PATHS 无自引用(不引用其他成员)', function() {
    var pathKeys = Object.keys(CONSTANTS.APPLICATION_PATHS);
    pathKeys.forEach(function(k) {
      var v = CONSTANTS.APPLICATION_PATHS[k];
      // 值应该是简单字符串，不是同一个对象的引用
      expect(typeof v).toBe('string');
    });
  });
});

// ============================================================
// 附加检查: solution-library.js 的 ALL_PATH_DETAILS
// ============================================================
describe('数据完整性 — solution-library.js ALL_PATH_DETAILS', function() {

  var solutionLib = require('../../../data/solution-library');

  test('[P1] ALL_PATH_DETAILS 存在且非空', function() {
    expect(solutionLib.ALL_PATH_DETAILS).toBeDefined();
    var detailKeys = Object.keys(solutionLib.ALL_PATH_DETAILS);
    expect(detailKeys.length).toBeGreaterThan(0);
  });

  test('[P1] ALL_PATH_DETAILS 每个路径有 pathId/riskLevel/keyRisks/firstVisa/totalCycle', function() {
    PATH_KEYS.forEach(function(key) {
      var detail = solutionLib.ALL_PATH_DETAILS[key];
      if (!detail) return; // 跳过不存在详情的路径
      expect(detail.pathId).toBeDefined();
      expect(detail.pathId).toBe(key);
      expect(detail.riskLevel).toBeDefined();
      expect(typeof detail.riskLevel).toBe('string');
      expect(detail.keyRisks).toBeDefined();
      expect(Array.isArray(detail.keyRisks)).toBe(true);
      expect(detail.firstVisa).toBeDefined();
      expect(detail.totalCycle).toBeDefined();
    });
  });

  test('[P1] ALL_PATH_DETAILS 每个路径key在 APPLICATION_PATHS 中存在', function() {
    var detailKeys = Object.keys(solutionLib.ALL_PATH_DETAILS);
    detailKeys.forEach(function(key) {
      expect(PATH_KEYS).toContain(key);
    });
  });

  test('[P1] ALL_PATH_DETAILS 的riskLevel与PATH_RISK_LEVELS的level一致', function() {
    PATH_KEYS.forEach(function(key) {
      var detail = solutionLib.ALL_PATH_DETAILS[key];
      if (!detail) return;
      var riskLevel = CONSTANTS.PATH_RISK_LEVELS[key];
      if (riskLevel) {
        expect(detail.riskLevel).toBe(riskLevel.level);
      }
    });
  });

  test('[P1] PERSONAS 包含12个画像定义', function() {
    expect(solutionLib.PERSONAS).toBeDefined();
    var personaKeys = Object.keys(solutionLib.PERSONAS);
    expect(personaKeys.length).toBe(12);
    // 验证每个画像有name/ageRange/coreNeed
    [1,2,3,4,5,6,7,8,9,10,11,12].forEach(function(id) {
      var p = solutionLib.PERSONAS[id];
      expect(p).toBeDefined();
      expect(p.name).toBeDefined();
      expect(p.ageRange).toBeDefined();
      expect(p.coreNeed).toBeDefined();
    });
  });

  test('[P1] DECISION_COMPARISONS 存在且非空', function() {
    expect(solutionLib.DECISION_COMPARISONS).toBeDefined();
    var dcKeys = Object.keys(solutionLib.DECISION_COMPARISONS);
    expect(dcKeys.length).toBeGreaterThan(0);
  });

  test('[P1] matchPersonaToPaths 是函数', function() {
    expect(typeof solutionLib.matchPersonaToPaths).toBe('function');
  });
});
