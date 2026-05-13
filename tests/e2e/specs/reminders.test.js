/**
 * 住港伴 V3 — E2E 提醒器模块测试
 * 对应分层清单 §4: 提醒器 7/8 项
 * 运行: npm run test:e2e:reminders
 */

const {
  goToTab, navigateTo, findElement,
  initTestState, waitFor,
} = require('../helpers');

let mp;

beforeAll(async () => {
  mp = global.__miniProgram__;
  await initTestState(mp);
  // 种子测试提醒数据，确保详情页有数据可加载
  await mp.evaluate(() => {
    wx.setStorageSync('__reminders__', {
      items: [{
        id: 'e2e-test',
        title: 'E2E测试提醒',
        label: 'E2E测试提醒',
        deadline: '2026-12-31',
        description: 'E2E测试用提醒',
        type: 'manual',
        confidence: 'B',
        status: 'active',
        priority: 'normal',
        linkedDocIds: [],
        dependsOn: null,
        alerts: [],
        source: { type: 'manual' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }],
      version: 1
    });
  });
  await goToTab(mp, 'reminders');
  await waitFor(mp, 2000);
});

describe('§4 提醒器 (reminders)', () => {

  test('4.1 进入提醒器 → 页面正常渲染', async () => {
    const page = await mp.currentPage();
    expect(page.path).toContain('reminders');
  });

  test('4.3 提醒详情页可访问', async () => {
    // 重新播种确保数据未被页面init覆盖
    await mp.evaluate(() => {
      wx.setStorageSync('__reminders__', {
        items: [{
          id: 'e2e-test',
          title: 'E2E测试提醒',
          label: 'E2E测试提醒',
          deadline: '2026-12-31',
          description: 'E2E测试用提醒',
          type: 'manual',
          confidence: 'B',
          status: 'active',
          priority: 'normal',
          linkedDocIds: [],
          dependsOn: null,
          alerts: [],
          source: { type: 'manual' },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }],
        version: 1
      });
    });
    await navigateTo(mp, '/pages/reminders/detail/detail?id=e2e-test');
    await waitFor(mp, 2000);
    const page = await mp.currentPage();
    expect(page.path).toContain('detail');
  });

  test('4.4 无404错误页', async () => {
    const page = await mp.currentPage();
    const errorText = await findElement(mp, '.error-page, .not-found');
    expect(errorText).toBeNull();
  });

});
