/**
 * 住港伴 V3 — app.json 完整性验证 (原 regression E2E 降级)
 *
 * 原 E2E 回归套件因 automator v0.12 mp.evaluate() WebSocket 硬限制无法稳定运行。
 * 降级为 Jest 单元测试，验证页面注册完整性、TabBar 配置、关键文件存在性。
 */

const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const appJson = require(path.join(PROJECT_ROOT, 'app.json'));

describe('app.json 完整性 (§10 降级)', () => {

  test('所有注册页面文件存在', () => {
    const pages = appJson.pages || [];
    const missing = [];

    pages.forEach(function(pagePath) {
      const jsFile = path.join(PROJECT_ROOT, pagePath + '.js');
      const wxmlFile = path.join(PROJECT_ROOT, pagePath + '.wxml');
      const hasFile = fs.existsSync(jsFile) || fs.existsSync(wxmlFile);
      if (!hasFile) missing.push(pagePath);
    });

    if (missing.length > 0) {
      console.warn('缺失页面文件:', missing);
    }
    expect(missing).toEqual([]);
  });

  test('TabBar 页面在 pages 中注册', () => {
    const tabList = (appJson.tabBar && appJson.tabBar.list) || [];
    const pages = appJson.pages || [];

    tabList.forEach(function(tab) {
      expect(pages).toContain(tab.pagePath);
    });
  });

  test('TabBar 页面文件存在', () => {
    const tabList = (appJson.tabBar && appJson.tabBar.list) || [];

    tabList.forEach(function(tab) {
      const jsFile = path.join(PROJECT_ROOT, tab.pagePath + '.js');
      expect(fs.existsSync(jsFile)).toBe(true);
    });
  });

  test('app.json 结构合法', () => {
    expect(Array.isArray(appJson.pages)).toBe(true);
    expect(appJson.pages.length).toBeGreaterThan(0);
    expect(appJson.window).toBeDefined();
  });

  test('无重复页面', () => {
    const pages = appJson.pages || [];
    const seen = {};
    const dupes = [];

    pages.forEach(function(p) {
      if (seen[p]) dupes.push(p);
      seen[p] = true;
    });

    expect(dupes).toEqual([]);
  });

});

describe('关键文件存在性 (§11 降级)', () => {

  const keyFiles = [
    'data/constants.js',
    'data/guidebook-data.js',
    'data/templates.js',
    'data/solution-library.js',
    'data/timeline-templates.js',
    'data/document-index-templates.js',
    'utils/storage.js',
    'utils/ocr.js',
    'utils/stage-helper.js',
    'pages/home/home.js',
    'pages/documents/index/index.js',
    'pages/reminders/index/index.js',
    'pages/process/index/index.js',
    'pages/guidebooks/index/index.js',
    'pages/mine/index/index.js',
    'cloudfunctions/ai-chat/index.js',
    'cloudfunctions/generate-pdf/index.js',
    'CLAUDE.md',
  ];

  keyFiles.forEach(function(file) {
    test(file + ' 存在', function() {
      expect(fs.existsSync(path.join(PROJECT_ROOT, file))).toBe(true);
    });
  });

});

describe('攻略书数据完整性', () => {

  test('guidebook-data.js 可加载且非空', () => {
    const { GUIDEBOOK_DB } = require(path.join(PROJECT_ROOT, 'data/guidebook-data.js'));
    const keys = Object.keys(GUIDEBOOK_DB);
    expect(keys.length).toBeGreaterThan(0);
  });

  test('每篇攻略有 title + category', () => {
    const { GUIDEBOOK_DB } = require(path.join(PROJECT_ROOT, 'data/guidebook-data.js'));
    Object.keys(GUIDEBOOK_DB).forEach(function(id) {
      const entry = GUIDEBOOK_DB[id];
      expect(entry.title).toBeDefined();
      expect(entry.category).toBeDefined();
    });
  });

});
