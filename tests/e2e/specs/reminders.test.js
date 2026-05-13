/**
 * 住港伴 V3 — E2E 提醒器模块测试
 * 对应分层清单 §4: 提醒器 7/8 项
 * 运行: npm run test:e2e:reminders
 */

const {
  goToTab, navigateTo, findElement,
  initTestState, waitFor, reLaunch,
} = require('../helpers');

let mp;

beforeAll(async () => {
  mp = global.__miniProgram__;
  await initTestState(mp);
  await goToTab(mp, 'reminders');
  await waitFor(mp, 2000);
});

describe('§4 提醒器 (reminders)', () => {

  test('4.1 进入提醒器 → 页面正常渲染', async () => {
    const page = await mp.currentPage();
    expect(page.path).toContain('reminders');
  });

  test('4.3 提醒详情页可访问', async () => {
    await reLaunch(mp, '/pages/reminders/detail/detail?id=e2e-test');
    await waitFor(mp, 2000);
    const page = await mp.currentPage();
    expect(page.path).toBe('pages/reminders/detail/detail');
  });

  test('4.4 无404错误页', async () => {
    const page = await mp.currentPage();
    const errorText = await findElement(mp, '.error-page, .not-found');
    expect(errorText).toBeNull();
  });

});
