/**
 * 住港伴 V3 — 匹配引擎单元测试
 * 测试 data/solution-library.js 的 matchPersonaToPaths()
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

const { APPLICATION_PATHS } = require('../../../data/constants');
const { matchPersonaToPaths } = require('../../../data/solution-library');

/**
 * 辅助: 从匹配结果中提取指定路径的score
 */
function getScore(results, pathKey) {
  var found = results.find(function(r) { return r.path === pathKey; });
  return found ? found.matchScore : 0;
}

function getConfidence(results, pathKey) {
  var found = results.find(function(r) { return r.path === pathKey; });
  return found ? found.confidence : null;
}

describe('匹配引擎 — matchPersonaToPaths()', function() {

  // ============================================================
  // 1. 高收入 => 高才A
  // ============================================================
  test('[P0] 年收入>=250万 => 高才A +100分', function() {
    var profile = {
      income: 3000000,
      age: 35,
      experience: 5,
      education: '硕士',
      eligibleSchool: false,
      major: '金融',
      capital: 20000000,
      language: [],
      purpose: 'employment'
    };
    var results = matchPersonaToPaths(profile);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(getScore(results, APPLICATION_PATHS.TTPS_A)).toBe(100);
    expect(results[0].matchScore).toBe(100);
  });

  // ============================================================
  // 2. 名校本科+经验<3+年轻 => 高才C
  // ============================================================
  test('[P0] 名校本科+经验<3+年龄<=28 => 高才C +100分', function() {
    var profile = {
      income: 500000,
      age: 24,
      experience: 1,
      education: '本科',
      eligibleSchool: true,
      major: '商科',
      capital: 2000000,
      language: [],
      purpose: 'employment'
    };
    var results = matchPersonaToPaths(profile);
    expect(getScore(results, APPLICATION_PATHS.TTPS_C)).toBe(100);
    expect(results[0].path).toBe(APPLICATION_PATHS.TTPS_C);
  });

  test('[P0] 名校本科+经验>=3 => 高才B +100分', function() {
    var profile = {
      income: 800000,
      age: 30,
      experience: 5,
      education: '本科',
      eligibleSchool: true,
      major: '商科',
      capital: 2000000,
      language: [],
      purpose: 'employment'
    };
    var results = matchPersonaToPaths(profile);
    expect(getScore(results, APPLICATION_PATHS.TTPS_B)).toBe(100);
  });

  // ============================================================
  // 3. 高净值 => CIES
  // ============================================================
  test('[P0] 资产>=3000万 => CIES +100分', function() {
    var profile = {
      income: 1000000,
      age: 45,
      experience: 15,
      education: '本科',
      eligibleSchool: false,
      major: '管理',
      capital: 50000000,
      language: [],
      purpose: 'investment'
    };
    var results = matchPersonaToPaths(profile);
    expect(getScore(results, APPLICATION_PATHS.CIES)).toBe(100);
  });

  // ============================================================
  // 4. 高净值+退休目的 => RETIREMENT +95分
  // ============================================================
  test('[P0] 高净值+退休目的 => RETIREMENT +95分', function() {
    var profile = {
      income: 1000000,
      age: 48,
      experience: 20,
      education: '本科',
      eligibleSchool: false,
      major: '其他',
      capital: 35000000,
      language: [],
      purpose: 'retirement'
    };
    var results = matchPersonaToPaths(profile);
    expect(getScore(results, APPLICATION_PATHS.CIES)).toBe(100);
    expect(getScore(results, APPLICATION_PATHS.RETIREMENT)).toBe(95);
  });

  // ============================================================
  // 5. 年龄>=50+退休目的 => RETIREMENT +90分
  // ============================================================
  test('[P0] 年龄>=50+退休目的 => RETIREMENT +90分', function() {
    var profile = {
      income: 500000,
      age: 55,
      experience: 25,
      education: '本科',
      eligibleSchool: false,
      major: '其他',
      capital: 5000000,
      language: [],
      purpose: 'retirement'
    };
    var results = matchPersonaToPaths(profile);
    expect(getScore(results, APPLICATION_PATHS.RETIREMENT)).toBe(90);
  });

  test('[P0] 年龄>=50+资产>=3000万(无退休目的) => RETIREMENT +90分', function() {
    var profile = {
      income: 500000,
      age: 55,
      experience: 25,
      education: '本科',
      eligibleSchool: false,
      major: '其他',
      capital: 35000000,
      language: [],
      purpose: 'employment'
    };
    var results = matchPersonaToPaths(profile);
    expect(getScore(results, APPLICATION_PATHS.CIES)).toBe(100);
    expect(getScore(results, APPLICATION_PATHS.RETIREMENT)).toBe(90);
  });

  // ============================================================
  // 6. 企业主+高收入 => TTPS_A +85, CIES +60 (上限100)
  // ============================================================
  test('[P0] 企业主+高收入 => 高才A +85(上限100), CIES +60', function() {
    var profile = {
      income: 3000000,
      age: 42,
      experience: 15,
      education: '本科',
      eligibleSchool: false,
      major: '管理',
      capital: 15000000,
      language: [],
      companyType: 'enterprise_owner',
      purpose: 'business'
    };
    var results = matchPersonaToPaths(profile);
    // 85 + 100 = 185, capped at 100
    expect(results.find(function(r) { return r.path === APPLICATION_PATHS.TTPS_A; }).matchScore).toBe(100);
    expect(getScore(results, APPLICATION_PATHS.CIES)).toBe(60);
  });

  // ============================================================
  // 7. STEM+经验>=2 => TechTAS
  // ============================================================
  test('[P0] STEM专业+经验>=2 => TechTAS +80分', function() {
    var profile = {
      income: 500000,
      age: 30,
      experience: 3,
      education: '硕士',
      eligibleSchool: false,
      major: 'STEM',
      capital: 500000,
      language: [],
      purpose: 'employment'
    };
    var results = matchPersonaToPaths(profile);
    expect(getScore(results, APPLICATION_PATHS.TECHTAS)).toBe(80);
  });

  test('[P0] STEM专业+经验<2 => TechTAS 不触发', function() {
    var profile = {
      income: 500000,
      age: 24,
      experience: 1,
      education: '硕士',
      eligibleSchool: false,
      major: 'STEM',
      capital: 500000,
      language: [],
      purpose: 'employment'
    };
    var results = matchPersonaToPaths(profile);
    expect(getScore(results, APPLICATION_PATHS.TECHTAS)).toBe(0);
  });

  // ============================================================
  // 8. persona=9(陪读家长) => DEPENDENT +60, MINOR_STUDENT +50
  // ============================================================
  test('[P0] 陪读家长(persona=9)+有子女+年龄>=30 => DEPENDENT +60, MINOR_STUDENT +50', function() {
    var profile = {
      income: 500000,
      age: 35,
      experience: 5,
      education: '本科',
      eligibleSchool: false,
      major: '其他',
      capital: 5000000,
      language: [],
      persona: 9,
      hasKids: true,
      childAge: 10,
      purpose: 'family'
    };
    var results = matchPersonaToPaths(profile);
    expect(getScore(results, APPLICATION_PATHS.DEPENDENT)).toBe(60);
    expect(getScore(results, APPLICATION_PATHS.MINOR_STUDENT)).toBe(50);
  });

  test('[P0] 陪读家长但年龄<30 => 不触发', function() {
    var profile = {
      income: 500000,
      age: 28,
      experience: 3,
      education: '本科',
      eligibleSchool: false,
      major: '其他',
      capital: 500000,
      language: [],
      persona: 9,
      hasKids: true,
      childAge: 5,
      purpose: 'family'
    };
    var results = matchPersonaToPaths(profile);
    expect(getScore(results, APPLICATION_PATHS.DEPENDENT)).toBe(0);
    expect(getScore(results, APPLICATION_PATHS.MINOR_STUDENT)).toBe(0);
  });

  test('[P0] 陪读家长但无子女 => 不触发', function() {
    var profile = {
      income: 500000,
      age: 35,
      experience: 5,
      education: '本科',
      eligibleSchool: false,
      major: '其他',
      capital: 500000,
      language: [],
      persona: 9,
      hasKids: false,
      purpose: 'family'
    };
    var results = matchPersonaToPaths(profile);
    expect(getScore(results, APPLICATION_PATHS.DEPENDENT)).toBe(0);
    expect(getScore(results, APPLICATION_PATHS.MINOR_STUDENT)).toBe(0);
  });

  test('[P0] 陪读家长+子女>=18 => DEPENDENT触发, MINOR_STUDENT不触发', function() {
    var profile = {
      income: 500000,
      age: 45,
      experience: 10,
      education: '本科',
      eligibleSchool: false,
      major: '其他',
      capital: 500000,
      language: [],
      persona: 9,
      hasKids: true,
      childAge: 20,
      purpose: 'family'
    };
    var results = matchPersonaToPaths(profile);
    expect(getScore(results, APPLICATION_PATHS.DEPENDENT)).toBe(60);
    expect(getScore(results, APPLICATION_PATHS.MINOR_STUDENT)).toBe(0);
  });

  // ============================================================
  // 9. 交换生 => EXCHANGE +100
  // ============================================================
  test('[P0] 交换生+年龄<=30 => EXCHANGE +100分', function() {
    var profile = {
      income: 0,
      age: 22,
      experience: 0,
      education: '在读',
      eligibleSchool: true,
      major: '其他',
      capital: 500000,
      language: [],
      studyType: 'exchange',
      purpose: 'study'
    };
    var results = matchPersonaToPaths(profile);
    expect(getScore(results, APPLICATION_PATHS.EXCHANGE)).toBe(100);
  });

  test('[P0] 交换生+年龄>30 => EXCHANGE 不触发', function() {
    var profile = {
      income: 0,
      age: 32,
      experience: 0,
      education: '在读',
      eligibleSchool: true,
      major: '其他',
      capital: 500000,
      language: [],
      studyType: 'exchange',
      purpose: 'study'
    };
    var results = matchPersonaToPaths(profile);
    expect(getScore(results, APPLICATION_PATHS.EXCHANGE)).toBe(0);
  });

  // ============================================================
  // 10. 未成年无陪读 => MINOR_STUDENT +100
  // ============================================================
  test('[P0] 未成年(<18)+无陪读家长 => MINOR_STUDENT +100分', function() {
    var profile = {
      income: 0,
      age: 15,
      experience: 0,
      education: '在读中小学',
      eligibleSchool: false,
      major: '其他',
      capital: 0,
      language: [],
      hasParentCompanion: false,
      purpose: 'study'
    };
    var results = matchPersonaToPaths(profile);
    expect(getScore(results, APPLICATION_PATHS.MINOR_STUDENT)).toBe(100);
  });

  test('[P0] 未成年但有陪读家长 => MINOR_STUDENT 不触发', function() {
    var profile = {
      income: 0,
      age: 15,
      experience: 0,
      education: '在读中小学',
      eligibleSchool: false,
      major: '其他',
      capital: 0,
      language: [],
      hasParentCompanion: true,
      purpose: 'study'
    };
    var results = matchPersonaToPaths(profile);
    expect(getScore(results, APPLICATION_PATHS.MINOR_STUDENT)).toBe(0);
  });

  // ============================================================
  // 11. 名校毕业生 => STUDENT_IANG
  // ============================================================
  test('[P0] 名校毕业生+年龄<=28+经验<=3 => STUDENT_IANG +90分', function() {
    var profile = {
      income: 500000,
      age: 25,
      experience: 2,
      education: '本科',
      eligibleSchool: true,
      major: '商科',
      capital: 2000000,
      language: [],
    };
    var results = matchPersonaToPaths(profile);
    expect(getScore(results, APPLICATION_PATHS.STUDENT_IANG)).toBe(90);
  });

  // ============================================================
  // 12. 兼读制 => PARTTIME_QMAS
  // ============================================================
  test('[P2] 兼读制+年龄>=28 => PARTTIME_QMAS +80分', function() {
    var profile = {
      income: 500000,
      age: 32,
      experience: 8,
      education: '本科',
      eligibleSchool: false,
      major: '其他',
      capital: 500000,
      language: [],
      studyType: 'parttime',
      purpose: 'study'
    };
    var results = matchPersonaToPaths(profile);
    expect(getScore(results, APPLICATION_PATHS.PARTTIME_QMAS)).toBe(80);
  });

  test('[P2] 兼读制+年龄<28 => PARTTIME_QMAS 不触发', function() {
    var profile = {
      income: 500000,
      age: 24,
      experience: 2,
      education: '本科',
      eligibleSchool: false,
      major: '其他',
      capital: 500000,
      language: [],
      studyType: 'parttime',
      purpose: 'study'
    };
    var results = matchPersonaToPaths(profile);
    expect(getScore(results, APPLICATION_PATHS.PARTTIME_QMAS)).toBe(0);
  });

  // ============================================================
  // 13. QMAS 12项准则
  // ============================================================
  test('[P0] QMAS 12项准则>=6 => QMAS触发(10项=90分)', function() {
    var profile = {
      income: 1500000,
      age: 35,
      educationLevel: 2,
      major: 'STEM',
      language: ['中文', '英语流利'],
      englishProficient: true,
      experience: 7,
      hasFamous: true,
      isTargetIndustry: true,
      hasIntlExp: true,
      capital: 20000000,
      education: '硕士',
      eligibleSchool: false,
      purpose: 'employment'
    };
    // 10项满足: age+educationLevel+major+languageC1+englishProficient+experience+hasFamous+isTargetIndustry+hasIntlExp+income
    // score = 50 + (10-6)*10 = 90
    var results = matchPersonaToPaths(profile);
    expect(getScore(results, APPLICATION_PATHS.QMAS)).toBe(90);
  });

  test('[P0] QMAS 12项准则<6 => 不触发', function() {
    var profile = {
      income: 500000,
      age: 55,
      educationLevel: 1,
      major: '人文',
      language: ['中文'],
      englishProficient: false,
      experience: 2,
      hasFamous: false,
      isTargetIndustry: false,
      hasIntlExp: false,
      capital: 500000,
      education: '本科',
      eligibleSchool: false,
      purpose: 'employment'
    };
    var results = matchPersonaToPaths(profile);
    expect(getScore(results, APPLICATION_PATHS.QMAS)).toBe(0);
  });

  // ============================================================
  // 14. 结果排序: 降序
  // ============================================================
  test('[P0] 结果按分数降序排列', function() {
    var profile = {
      income: 500000,
      age: 25,
      experience: 1,
      education: '本科',
      eligibleSchool: true,
      major: '其他',
      capital: 500000,
      language: [],
    };
    var results = matchPersonaToPaths(profile);
    for (var i = 1; i < results.length; i++) {
      expect(results[i - 1].matchScore).toBeGreaterThanOrEqual(results[i].matchScore);
    }
  });

  // ============================================================
  // 15. 结果上限: 最多4条
  // ============================================================
  test('[P2] 最多返回4条结果', function() {
    var profile = {
      income: 3000000,
      age: 35,
      experience: 5,
      education: '本科',
      eligibleSchool: true,
      major: 'STEM',
      capital: 35000000,
      language: ['中文', '英语流利'],
      englishProficient: true,
      hasFamous: true,
      isTargetIndustry: true,
      hasIntlExp: true,
      educationLevel: 2,
      purpose: 'retirement'
    };
    var results = matchPersonaToPaths(profile);
    expect(results.length).toBeLessThanOrEqual(4);
  });

  // ============================================================
  // 16. 空profile
  // ============================================================
  test('[P2] 空profile返回空数组', function() {
    var results = matchPersonaToPaths({});
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);
  });

  // ============================================================
  // 17. 企业主QMAS F1/F2触发
  // ============================================================
  test('[P2] 企业主+资产>=500万 => QMAS F1触发', function() {
    var profile = {
      income: 1500000,
      age: 40,
      educationLevel: 2,
      major: '管理',
      language: ['中文', '英语流利'],
      englishProficient: true,
      experience: 10,
      hasFamous: true,
      isTargetIndustry: false,
      hasIntlExp: false,
      companyType: 'enterprise_owner',
      capital: 8000000,
      hasListedCompany: false,
      purpose: 'business'
    };
    var results = matchPersonaToPaths(profile);
    expect(getScore(results, APPLICATION_PATHS.QMAS)).toBeGreaterThanOrEqual(50);
  });

  // ============================================================
  // 18. confidence级别验证
  // ============================================================
  test('[P2] 分数>=80 => confidence=high', function() {
    var profile = {
      income: 3000000,
      age: 40,
      experience: 10,
      education: '本科',
      eligibleSchool: false,
      major: '金融',
      capital: 20000000,
      language: [],
      purpose: 'employment'
    };
    var results = matchPersonaToPaths(profile);
    var ttpsA = results.find(function(r) { return r.path === APPLICATION_PATHS.TTPS_A; });
    expect(ttpsA).toBeDefined();
    expect(ttpsA.confidence).toBe('high');
  });

  test('[P2] 6项QMAS准则 => score=50 => confidence=medium', function() {
    var profile = {
      income: 1500000,
      age: 35,
      educationLevel: 2,
      major: 'STEM',
      language: ['中文', '英语流利'],
      experience: 5,
      capital: 20000000,
      education: '硕士',
      eligibleSchool: false,
      purpose: 'employment'
    };
    var results = matchPersonaToPaths(profile);
    var qmas = results.find(function(r) { return r.path === APPLICATION_PATHS.QMAS; });
    expect(qmas).toBeDefined();
    expect(qmas.matchScore).toBe(50);
    expect(qmas.confidence).toBe('medium');
  });
});
