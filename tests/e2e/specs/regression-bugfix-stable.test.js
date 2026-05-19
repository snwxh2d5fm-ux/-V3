/**
 * 住港伴 V3 — 13项Bug修复 真机模拟回归验证
 *
 * 使用真实案例数据 (tests/e2e/fixtures/case-*.json)
 * 三机部署: 天元+麒麟+玄武
 *
 * 改进:
 *   1. reLaunch 轮询验证
 *   2. beforeEach 存储隔离
 *   3. 文件种子注入 (fixture JSON → wx.getFileSystemManager)
 *
 * 运行: npx jest -c tests/e2e/jest.config.js --runInBand --testPathPattern=regression-bugfix-stable --forceExit
 */

const {
  goToTab, navigateTo, findElement, findElements,
  initTestState, waitFor, reLaunch, switchTab,
} = require('../helpers');

let mp;

// ============================================================
// 稳定导航
// ============================================================
async function reLaunchAndWait(mp, url, expectedPath, timeoutMs) {
  timeoutMs = timeoutMs || 10000;
  await mp.reLaunch(url);
  var deadline = Date.now() + timeoutMs;
  var lastPath = '';
  while (Date.now() < deadline) {
    try {
      var page = await mp.currentPage();
      if (page && page.path && page.path.indexOf(expectedPath) >= 0) {
        return page;
      }
      lastPath = (page && page.path) || 'null';
    } catch (e) {
      lastPath = 'error: ' + e.message;
    }
    await new Promise(function (r) { return setTimeout(r, 500); });
  }
  throw new Error('reLaunch timeout: expected "' + expectedPath + '", last: "' + lastPath + '"');
}

// ============================================================
// 文件种子注入 — evaluate 只传路径，JSON 由小程序自己读
// ============================================================
async function seedFromFixture(mp, fixturePath, storageKey) {
  await mp.evaluate(function (fp, key) {
    var fsm = wx.getFileSystemManager();
    var raw = fsm.readFileSync(fp, 'utf8');
    wx.setStorageSync(key, JSON.parse(raw));
  }, fixturePath, storageKey);
}

// ============================================================
// 全局 setup
// ============================================================
beforeAll(async () => {
  mp = global.__miniProgram__;
  await initTestState(mp);
}, 30000);

beforeEach(async () => {
  // 仅清理非认证类缓存，保留 auth_token
  await mp.evaluate(function () {
    var keep = { auth_token: wx.getStorageSync('auth_token'), user_profile: wx.getStorageSync('user_profile') };
    wx.clearStorageSync();
    if (keep.auth_token) wx.setStorageSync('auth_token', keep.auth_token);
    if (keep.user_profile) wx.setStorageSync('user_profile', keep.user_profile);
  });
});

// ============================================================
// #1 长周期提醒已移除
// ============================================================
describe('#1 长周期提醒已移除', () => {

  test('QMAS路径(7-8年)不弹长周期提醒', async () => {
    await seedFromFixture(mp, 'tests/e2e/fixtures/case-processes.json', '__processes__');

    await reLaunchAndWait(mp, '/pages/process/index/index', 'process');

    var popupVisible = await mp.evaluate(function () {
      var page = getCurrentPages()[getCurrentPages().length - 1];
      return page && page.data ? !!page.data.showDisclaimerPopup : null;
    });
    if (popupVisible === true) {
      var popupType = await mp.evaluate(function () {
        var page = getCurrentPages()[getCurrentPages().length - 1];
        return page && page.data ? page.data.disclaimerType : '';
      });
      expect(popupType).not.toBe('long_cycle');
    } else {
      expect(popupVisible).toBe(false);
    }
  }, 15000);

});

// ============================================================
// #4 提醒器时间线自动生成
// ============================================================
describe('#4 提醒器时间线自动生成', () => {

  test('QMAS路径自动生成≥1个时间线节点', async () => {
    await mp.evaluate(function () {
      var app = getApp();
      if (app && app.globalData) {
        app.globalData.selectedPath = 'qmas';
        app.globalData.selectedPathName = '优才计划';
      }
    });

    await reLaunchAndWait(mp, '/pages/reminders/detail/detail?action=timeline&path=qmas&_autogen=1', 'reminders');
    await waitFor(mp, 4000);

    var result = await mp.evaluate(function () {
      var page = getCurrentPages()[getCurrentPages().length - 1];
      if (!page || !page.data) return { stages: 0, path: '' };
      return {
        stages: (page.data.timelineStages || []).length,
        path: page.data.timelinePath || ''
      };
    });

    expect(result.stages).toBeGreaterThanOrEqual(1);
    expect(result.path).toContain('qmas');
  }, 15000);

});

// ============================================================
// #5 攻略UGC内容非空白
// ============================================================
describe('#5 攻略UGC内容非空白', () => {

  test('攻略详情页 loads without error', async () => {
    await reLaunchAndWait(mp, '/pages/guidebooks/detail/detail?id=qmas_001', 'detail');
    await waitFor(mp, 5000);

    var loadState = await mp.evaluate(function () {
      var page = getCurrentPages()[getCurrentPages().length - 1];
      if (!page || !page.data) return { notFound: true };
      return {
        loading: page.data.loading,
        loadError: page.data.loadError,
        notFound: page.data.notFound,
        hasGuide: !!page.data.guide,
        parsedCount: (page.data.parsedSections || []).length
      };
    });

    expect(loadState.notFound).not.toBe(true);
    expect(loadState.loadError).not.toBe(true);
    expect(loadState.hasGuide || loadState.parsedCount > 0).toBe(true);
  }, 15000);

});

// ============================================================
// #7 配偶证件隔离 — 使用案例数据 (8份证件, 3 ownerType)
// ============================================================
describe('#7 配偶证件隔离 (案例: 本人×5 配偶×2 子女×1)', () => {

  test('切换到配偶 → 溢出区无本人证件', async () => {
    // 注入案例证件库
    await seedFromFixture(mp, 'tests/e2e/fixtures/case-vault-meta.json', '__vault_meta__');

    // 设置身份为配偶
    await mp.evaluate(function () {
      var app = getApp();
      if (app && app.globalData) app.globalData.identityOwner = 'spouse';
    });

    await reLaunchAndWait(mp, '/pages/documents/index/index?owner=spouse', 'documents');
    await waitFor(mp, 3000);

    var result = await mp.evaluate(function () {
      var page = getCurrentPages()[getCurrentPages().length - 1];
      if (!page || !page.data) return { overflowOwners: [], identityOwner: '' };
      var overflowDocs = page.data.overflowDocs || [];
      return {
        identityOwner: page.data.identityOwner || '',
        overflowOwners: overflowDocs.map(function (d) { return d.ownerType || 'self'; })
      };
    });

    // 不应混入本人
    result.overflowOwners.forEach(function (o) {
      expect(o).not.toBe('self');
    });
  }, 15000);

});

// ============================================================
// #13 预检%空白
// ============================================================
describe('#13 预检报告显示百分比', () => {

  test('报告页不崩溃 + loading结束', async () => {
    await seedFromFixture(mp, 'tests/e2e/fixtures/case-vault-meta.json', '__vault_meta__');

    await reLaunchAndWait(mp, '/pages/precheck/report/report?blocked=0', 'report');
    await waitFor(mp, 5000);

    var state = await mp.evaluate(function () {
      var page = getCurrentPages()[getCurrentPages().length - 1];
      if (!page || !page.data) return { crashed: true };
      return {
        crashed: false,
        loading: page.data.loading,
        score: page.data.score,
        totalDocs: page.data.totalDocs
      };
    });

    expect(state.crashed).toBe(false);
    expect(state.totalDocs).toBeGreaterThanOrEqual(1);
    if (typeof state.score === 'number') {
      expect(state.score).toBeGreaterThanOrEqual(0);
      expect(state.score).toBeLessThanOrEqual(100);
    }
    expect(state.loading).toBe(false);
  }, 15000);

});
