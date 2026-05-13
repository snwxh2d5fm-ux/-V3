/**
 * 住港伴 V3 — 攻略书数据模块单元测试
 * 测试 data/guidebook-data.js 的 GUIDEBOOK_DB / getAllCards / getById / getByCategory / search
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

var guidebook = require('../../../data/guidebook-data');

var EXPECTED_CATEGORIES = ['qmas', 'ttps', 'asmpt', 'iang', 'landing', 'renewal', 'pr_sprint', 'life', 'other'];

describe('攻略书数据 — GUIDEBOOK_DB 基础结构', function() {

  test('[P0] GUIDEBOOK_DB 存在且非空', function() {
    expect(guidebook.GUIDEBOOK_DB).toBeDefined();
    var ids = Object.keys(guidebook.GUIDEBOOK_DB);
    expect(ids.length).toBeGreaterThanOrEqual(47);
  });

  test('[P0] 所有攻略有 id/category/title/confidence', function() {
    var db = guidebook.GUIDEBOOK_DB;
    Object.keys(db).forEach(function(id) {
      var article = db[id];
      expect(article.id).toBeDefined();
      expect(typeof article.id).toBe('string');
      expect(article.category).toBeDefined();
      expect(EXPECTED_CATEGORIES).toContain(article.category);
      expect(article.title).toBeDefined();
      expect(typeof article.title).toBe('string');
      expect(article.title.length).toBeGreaterThan(0);
      expect(article.confidence).toBeDefined();
      expect(['A', 'B', 'C', 'D', 'E']).toContain(article.confidence);
    });
  });

  test('[P0] 所有攻略有 desc/source/rating/tags/updated', function() {
    var db = guidebook.GUIDEBOOK_DB;
    Object.keys(db).forEach(function(id) {
      var article = db[id];
      expect(article.desc).toBeDefined();
      expect(typeof article.desc).toBe('string');
      expect(article.source).toBeDefined();
      expect(typeof article.source).toBe('string');
      expect(typeof article.rating).toBe('number');
      expect(article.rating).toBeGreaterThan(0);
      expect(article.rating).toBeLessThanOrEqual(5);
      expect(Array.isArray(article.tags)).toBe(true);
      expect(article.updated).toBeDefined();
      expect(typeof article.updated).toBe('string');
    });
  });

  test('[P0] 9个分类全部有攻略', function() {
    var db = guidebook.GUIDEBOOK_DB;
    var catCount = {};
    EXPECTED_CATEGORIES.forEach(function(c) { catCount[c] = 0; });
    Object.keys(db).forEach(function(id) {
      var cat = db[id].category;
      if (catCount.hasOwnProperty(cat)) catCount[cat]++;
    });
    EXPECTED_CATEGORIES.forEach(function(c) {
      expect(catCount[c]).toBeGreaterThan(0);
    });
  });

  test('[P0] ID格式: {category}_xxx', function() {
    var db = guidebook.GUIDEBOOK_DB;
    Object.keys(db).forEach(function(id) {
      expect(id).toBe(db[id].id);
      var underscoreIdx = id.indexOf('_');
      expect(underscoreIdx).toBeGreaterThan(0);
      var catPrefix = id.substring(0, underscoreIdx);
      expect(EXPECTED_CATEGORIES).toContain(catPrefix);
    });
  });

  test('[P1] contentType值都是有效值', function() {
    var db = guidebook.GUIDEBOOK_DB;
    var validTypes = ['faq', 'steps', 'article'];
    Object.keys(db).forEach(function(id) {
      var article = db[id];
      // contentType 可能存在也可能不存在
      if (article.contentType) {
        expect(validTypes).toContain(article.contentType);
      }
    });
  });

  test('[P1] DEFAULT_DISCLAIMER 存在且为非空字符串', function() {
    expect(guidebook.DEFAULT_DISCLAIMER).toBeDefined();
    expect(typeof guidebook.DEFAULT_DISCLAIMER).toBe('string');
    expect(guidebook.DEFAULT_DISCLAIMER.length).toBeGreaterThan(0);
  });
});

describe('攻略书数据 — getAllCards()', function() {

  test('[P0] getAllCards 是函数', function() {
    expect(typeof guidebook.getAllCards).toBe('function');
  });

  test('[P0] 返回数组,长度≥47', function() {
    var cards = guidebook.getAllCards();
    expect(Array.isArray(cards)).toBe(true);
    expect(cards.length).toBeGreaterThanOrEqual(47);
  });

  test('[P0] 每张卡有 id/icon/title/category/desc/confidence/rating/tags/updated', function() {
    var cards = guidebook.getAllCards();
    cards.forEach(function(card) {
      expect(card.id).toBeDefined();
      expect(card.icon).toBeDefined();
      expect(card.title).toBeDefined();
      expect(card.category).toBeDefined();
      expect(card.desc).toBeDefined();
      expect(card.confidence).toBeDefined();
      expect(card.rating).toBeDefined();
      expect(Array.isArray(card.tags)).toBe(true);
      expect(card.updated).toBeDefined();
    });
  });
});

describe('攻略书数据 — getById()', function() {

  test('[P0] getById 是函数', function() {
    expect(typeof guidebook.getById).toBe('function');
  });

  test('[P0] 有效ID返回完整文章', function() {
    var ids = Object.keys(guidebook.GUIDEBOOK_DB);
    var testId = ids[0];
    var article = guidebook.getById(testId);
    expect(article).toBeDefined();
    expect(article.id).toBe(testId);
  });

  test('[P0] 无效ID返回null', function() {
    expect(guidebook.getById('nonexistent_999')).toBeNull();
  });

  test('[P1] 空ID返回null', function() {
    expect(guidebook.getById('')).toBeNull();
    expect(guidebook.getById(null)).toBeNull();
  });
});

describe('攻略书数据 — getByCategory()', function() {

  test('[P0] getByCategory 是函数', function() {
    expect(typeof guidebook.getByCategory).toBe('function');
  });

  test('[P0] 每个分类返回≥1篇攻略', function() {
    EXPECTED_CATEGORIES.forEach(function(cat) {
      var articles = guidebook.getByCategory(cat);
      expect(Array.isArray(articles)).toBe(true);
      expect(articles.length).toBeGreaterThanOrEqual(1);
      articles.forEach(function(a) {
        expect(a.category).toBe(cat);
      });
    });
  });

  test('[P1] 无效分类返回空数组', function() {
    var result = guidebook.getByCategory('nonexistent');
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });
});

describe('攻略书数据 — search()', function() {

  test('[P0] search 是函数', function() {
    expect(typeof guidebook.search).toBe('function');
  });

  test('[P0] 搜索"优才"返回≥1篇', function() {
    var results = guidebook.search('优才');
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  test('[P1] 搜索无匹配词返回空数组', function() {
    var results = guidebook.search('xyznonexistentkeyword999');
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);
  });

  test('[P1] 搜索空字符串返回空数组', function() {
    var results = guidebook.search('');
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);
  });
});

describe('攻略书数据 — getRecommended()', function() {

  test('[P0] getRecommended 是函数', function() {
    expect(typeof guidebook.getRecommended).toBe('function');
  });

  test('[P0] 返回 {cards, reason}', function() {
    var profile = { purpose: 'employment', reason: '在职人士就业通道' };
    var result = guidebook.getRecommended(profile);
    expect(result).toBeDefined();
    expect(Array.isArray(result.cards)).toBe(true);
    expect(result.reason).toBeDefined();
    expect(typeof result.reason).toBe('string');
  });

  test('[P1] 空profile也可调用不崩', function() {
    var result = guidebook.getRecommended({});
    expect(result).toBeDefined();
    expect(Array.isArray(result.cards)).toBe(true);
  });
});
