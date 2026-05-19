/**
 * 住港伴 V3 — 画像×路径兼容矩阵单元测试
 * 测试 data/persona-path-compat.js 的 MATRIX / getCompatibility / validateBestMatch
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

var compat = require('../../../data/persona-path-compat');
var PATH_KEYS = [
  'student_iang', 'ttps_c', 'exchange', 'ttps_b', 'dependent',
  'minor_student', 'parttime_qmas', 'qmas', 'ttps_a', 'asmpt',
  'techtas', 'cies', 'retirement'
];

describe('画像×路径兼容矩阵 — 结构与完整性', function() {

  test('[P0] PERSONAS 包含4个画像定义', function() {
    expect(compat.PERSONAS).toBeDefined();
    var keys = Object.keys(compat.PERSONAS);
    expect(keys.length).toBe(4);
    expect(compat.PERSONAS.STUDENT).toBe(1);
    expect(compat.PERSONAS.EMPLOYED).toBe(2);
    expect(compat.PERSONAS.OWNER).toBe(4);
    expect(compat.PERSONAS.OVERSEAS).toBe(7);
  });

  test('[P0] COMPATIBILITY 包含三级: compatible/conditional/incompatible', function() {
    expect(compat.COMPATIBILITY.compatible).toBeDefined();
    expect(compat.COMPATIBILITY.conditional).toBeDefined();
    expect(compat.COMPATIBILITY.incompatible).toBeDefined();
    expect(compat.COMPATIBILITY.compatible.cls).toBe('compatible');
    expect(compat.COMPATIBILITY.conditional.cls).toBe('conditional');
    expect(compat.COMPATIBILITY.incompatible.cls).toBe('incompatible');
  });

  test('[P0] MATRIX 包含4个画像入口', function() {
    expect(compat.MATRIX).toBeDefined();
    var matrixKeys = Object.keys(compat.MATRIX).map(Number);
    expect(matrixKeys).toContain(1);  // STUDENT
    expect(matrixKeys).toContain(2);  // EMPLOYED
    expect(matrixKeys).toContain(4);  // OWNER
    expect(matrixKeys).toContain(7);  // OVERSEAS
  });

  test('[P0] 每个画像的MATRIX覆盖全部13条路径', function() {
    var personas = [1, 2, 4, 7];
    personas.forEach(function(persona) {
      var matrix = compat.MATRIX[persona];
      expect(matrix).toBeDefined();
      PATH_KEYS.forEach(function(pathKey) {
        var level = matrix[pathKey];
        expect(level).toBeDefined();
        expect(['compatible', 'conditional', 'incompatible']).toContain(level);
      });
    });
  });

  test('[P0] MATRIX 无多余路径key', function() {
    var personas = [1, 2, 4, 7];
    personas.forEach(function(persona) {
      var matrix = compat.MATRIX[persona];
      Object.keys(matrix).forEach(function(key) {
        expect(PATH_KEYS).toContain(key);
      });
    });
  });

  test('[P1] 每级兼容性有 label/cls/color/bg', function() {
    ['compatible', 'conditional', 'incompatible'].forEach(function(level) {
      var entry = compat.COMPATIBILITY[level];
      expect(entry.label).toBeDefined();
      expect(typeof entry.label).toBe('string');
      expect(entry.cls).toBeDefined();
      expect(typeof entry.cls).toBe('string');
      expect(entry.color).toBeDefined();
      expect(typeof entry.color).toBe('string');
      expect(entry.bg).toBeDefined();
      expect(typeof entry.bg).toBe('string');
    });
  });
});

describe('画像×路径兼容矩阵 — 业务规则', function() {

  test('[P0] 学生 → IANG/高才C/交换生为compatible', function() {
    var m = compat.MATRIX[compat.PERSONAS.STUDENT];
    expect(m.student_iang).toBe('compatible');
    expect(m.ttps_c).toBe('compatible');
    expect(m.exchange).toBe('compatible');
  });

  test('[P0] 学生 → 高才A/CIES/退休为incompatible', function() {
    var m = compat.MATRIX[compat.PERSONAS.STUDENT];
    expect(m.ttps_a).toBe('incompatible');
    expect(m.cies).toBe('incompatible');
    expect(m.retirement).toBe('incompatible');
  });

  test('[P0] 在职 → QMAS/ASMPT/TechTAS为compatible', function() {
    var m = compat.MATRIX[compat.PERSONAS.EMPLOYED];
    expect(m.qmas).toBe('compatible');
    expect(m.asmpt).toBe('compatible');
    expect(m.techtas).toBe('compatible');
  });

  test('[P0] 企业主 → TTPS_A/CIES为compatible', function() {
    var m = compat.MATRIX[compat.PERSONAS.OWNER];
    expect(m.ttps_a).toBe('compatible');
    expect(m.cies).toBe('compatible');
  });

  test('[P0] 企业主 → 交换生/dependent为incompatible', function() {
    var m = compat.MATRIX[compat.PERSONAS.OWNER];
    expect(m.exchange).toBe('incompatible');
    expect(m.dependent).toBe('conditional');
  });

  test('[P0] 海外华人 → 全部13条路径存在', function() {
    var m = compat.MATRIX[compat.PERSONAS.OVERSEAS];
    PATH_KEYS.forEach(function(key) {
      expect(m[key]).toBeDefined();
    });
  });
});

describe('画像×路径兼容矩阵 — getCompatibility()', function() {

  test('[P0] getCompatibility 是函数', function() {
    expect(typeof compat.getCompatibility).toBe('function');
  });

  test('[P0] persona=1, path=student_iang → compatible', function() {
    var result = compat.getCompatibility(1, 'student_iang');
    expect(result.level).toBe('compatible');
  });

  test('[P0] persona=1, path=ttps_a → incompatible', function() {
    var result = compat.getCompatibility(1, 'ttps_a');
    expect(result.level).toBe('incompatible');
  });

  test('[P0] persona=2, path=qmas → compatible', function() {
    var result = compat.getCompatibility(2, 'qmas');
    expect(result.level).toBe('compatible');
  });

  test('[P1] 无效persona返回conditional', function() {
    var result = compat.getCompatibility(99, 'qmas');
    expect(result.level).toBe('conditional');
  });

  test('[P1] 无效path返回conditional', function() {
    var result = compat.getCompatibility(1, 'nonexistent');
    expect(result.level).toBe('conditional');
  });
});

describe('画像×路径兼容矩阵 — validateBestMatch()', function() {

  test('[P0] validateBestMatch 是函数', function() {
    expect(typeof compat.validateBestMatch).toBe('function');
  });

  test('[P0] 最佳匹配compatible路径 → {ok:true}', function() {
    var validation = compat.validateBestMatch(1, 'student_iang');
    expect(validation.ok).toBe(true);
  });

  test('[P0] 最佳匹配incompatible路径 → {ok:false,warning}', function() {
    var validation = compat.validateBestMatch(1, 'ttps_a');
    expect(validation.ok).toBe(false);
    expect(validation.warning).toBeDefined();
  });

  test('[P1] 最佳匹配conditional路径 → {ok:true,warning}', function() {
    var validation = compat.validateBestMatch(1, 'dependent');
    expect(validation.ok).toBe(true);
    expect(validation.warning).toBeDefined();
  });
});

describe('画像×路径兼容矩阵 — getPersonaName()', function() {

  test('[P1] 返回中文名称', function() {
    expect(compat.getPersonaName(1)).toBe('在校学生');
    expect(compat.getPersonaName(2)).toBe('在职人士');
    expect(compat.getPersonaName(4)).toBe('企业主');
    expect(compat.getPersonaName(7)).toBe('海外华人');
  });

  test('[P1] 未知persona返回"未知"', function() {
    expect(compat.getPersonaName(99)).toBe('未知');
  });
});
