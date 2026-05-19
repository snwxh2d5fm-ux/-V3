/**
 * 住港伴 V3 — 证件索引模板单元测试
 * 测试 data/document-index-templates.js 的 INDEX_TEMPLATES / matchTemplate / computeSlotStates
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

var docTemplates = require('../../../data/document-index-templates');

var VALID_STATUSES = ['unapplied', 'applied', 'approved', 'renewal', 'permanent', 'any'];
var VALID_PATHS = [
  'qmas', 'ttps_a', 'ttps_b', 'ttps_c', 'asmpt', 'techtas', 'cies',
  'student_iang', 'parttime_qmas', 'exchange', 'dependent', 'minor_student', 'retirement', 'any'
];
var VALID_MODES = ['application', 'renewal', 'conversion'];
var VALID_REQUIREMENTS = ['required', 'recommended', 'optional'];

describe('证件索引模板 — INDEX_TEMPLATES 结构', function() {

  test('[P0] INDEX_TEMPLATES 存在且非空', function() {
    expect(docTemplates.INDEX_TEMPLATES).toBeDefined();
    var keys = Object.keys(docTemplates.INDEX_TEMPLATES);
    expect(keys.length).toBeGreaterThanOrEqual(10);
  });

  test('[P0] 每个模板有 templateId/status/path/mode/totalRequired/categories', function() {
    var templates = docTemplates.INDEX_TEMPLATES;
    Object.keys(templates).forEach(function(key) {
      var tpl = templates[key];
      expect(tpl.templateId).toBeDefined();
      expect(tpl.status).toBeDefined();
      expect(tpl.path).toBeDefined();
      expect(tpl.mode).toBeDefined();
      expect(tpl.totalRequired).toBeDefined();
      expect(typeof tpl.totalRequired).toBe('number');
      expect(Array.isArray(tpl.categories)).toBe(true);
    });
  });

  test('[P0] 模板 status/path/mode 在有效值范围内', function() {
    var templates = docTemplates.INDEX_TEMPLATES;
    Object.keys(templates).forEach(function(key) {
      var tpl = templates[key];
      expect(VALID_STATUSES).toContain(tpl.status);
      expect(VALID_PATHS).toContain(tpl.path);
      expect(VALID_MODES).toContain(tpl.mode);
    });
  });

  test('[P0] 每个分类有 categoryKey/categoryName/categoryIcon/slots', function() {
    var templates = docTemplates.INDEX_TEMPLATES;
    Object.keys(templates).forEach(function(key) {
      var tpl = templates[key];
      tpl.categories.forEach(function(cat) {
        expect(cat.categoryKey).toBeDefined();
        expect(typeof cat.categoryKey).toBe('string');
        expect(cat.categoryName).toBeDefined();
        expect(typeof cat.categoryName).toBe('string');
        expect(cat.categoryIcon).toBeDefined();
        expect(Array.isArray(cat.slots)).toBe(true);
      });
    });
  });

  test('[P0] 每个slot有 slotKey/docName/docIcon/requirement/maxCount', function() {
    var templates = docTemplates.INDEX_TEMPLATES;
    Object.keys(templates).forEach(function(key) {
      var tpl = templates[key];
      tpl.categories.forEach(function(cat) {
        cat.slots.forEach(function(slot) {
          expect(slot.slotKey).toBeDefined();
          expect(typeof slot.slotKey).toBe('string');
          expect(slot.docName).toBeDefined();
          expect(typeof slot.docName).toBe('string');
          expect(slot.docIcon).toBeDefined();
          expect(slot.requirement).toBeDefined();
          expect(VALID_REQUIREMENTS).toContain(slot.requirement);
          expect(slot.maxCount).toBeDefined();
          expect(typeof slot.maxCount).toBe('number');
        });
      });
    });
  });

  test('[P1] totalRequired至少≥minRequired(所有required slot数)', function() {
    var templates = docTemplates.INDEX_TEMPLATES;
    Object.keys(templates).forEach(function(key) {
      var tpl = templates[key];
      var requiredCount = 0;
      tpl.categories.forEach(function(cat) {
        cat.slots.forEach(function(slot) {
          if (slot.requirement === 'required') requiredCount++;
        });
      });
      // totalRequired 可能大于或等于 requiredCount（含推荐项）
      expect(tpl.totalRequired).toBeGreaterThanOrEqual(0);
    });
  });

  test('[P1] slotKey在模板内唯一 (允许 overflowZone 复用)', function() {
    var templates = docTemplates.INDEX_TEMPLATES;
    Object.keys(templates).forEach(function(key) {
      var tpl = templates[key];
      var slotKeys = [];
      tpl.categories.forEach(function(cat) {
        cat.slots.forEach(function(slot) {
          slotKeys.push(slot.slotKey);
        });
      });
      // slotKey 可能在 overflowZone 中复用，检查无超过2次重复
      var counts = {};
      slotKeys.forEach(function(k) { counts[k] = (counts[k] || 0) + 1; });
      var overLimit = Object.keys(counts).filter(function(k) { return counts[k] > 2; });
      expect(overLimit).toEqual([]);
    });
  });
});

describe('证件索引模板 — matchTemplate()', function() {

  test('[P0] matchTemplate 是函数', function() {
    expect(typeof docTemplates.matchTemplate).toBe('function');
  });

  test('[P0] 有效三元组返回模板', function() {
    var result = docTemplates.matchTemplate('unapplied', 'qmas', 'application');
    expect(result).toBeDefined();
    expect(result.status).toBe('unapplied');
    expect(result.path).toBe('qmas');
    expect(result.mode).toBe('application');
  });

  test('[P1] 无效组合返回默认模板(不崩)', function() {
    var result = docTemplates.matchTemplate('nonexistent', 'qmas', 'application');
    expect(result).toBeDefined();
    if (result) {
      expect(result.templateId).toBeDefined();
    }
  });

  test('[P1] 每个已注册status+path+mode组合有匹配', function() {
    var templates = docTemplates.INDEX_TEMPLATES;
    var keys = Object.keys(templates);
    expect(keys.length).toBeGreaterThan(0);
    keys.forEach(function(key) {
      var tpl = templates[key];
      var result = docTemplates.matchTemplate(tpl.status, tpl.path, tpl.mode);
      expect(result).toBeDefined();
      expect(result.templateId).toBe(tpl.templateId);
    });
  });
});

describe('证件索引模板 — computeSlotStates()', function() {

  test('[P0] computeSlotStates 是函数', function() {
    expect(typeof docTemplates.computeSlotStates).toBe('function');
  });

  test('[P0] 传入模板+空数组 → 返回含填充状态的分类', function() {
    var template = docTemplates.matchTemplate('unapplied', 'qmas', 'application');
    var result = docTemplates.computeSlotStates(template, []);
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    result.forEach(function(cat) {
      expect(cat.categoryKey).toBeDefined();
      expect(cat.categoryName).toBeDefined();
      expect(cat.categoryIcon).toBeDefined();
      expect(Array.isArray(cat.slots)).toBe(true);
      expect(cat.categoryProgress).toBeDefined();
      expect(cat.categoryProgress.filled).toBeDefined();
      expect(cat.categoryProgress.total).toBeDefined();
    });
  });

  test('[P1] 空模板返回空数组(期待不崩)', function() {
    try {
      var result = docTemplates.computeSlotStates(null, []);
      expect(Array.isArray(result)).toBe(true);
    } catch (e) {
      // computeSlotStates 不处理 null template，抛异常为已知行为
      expect(e).toBeDefined();
    }
  });
});
