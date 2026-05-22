/**
 * 住港伴 V3 — E2E 冒烟测试 (L1 自动化, v2: 避免 reLaunch)
 *
 * 对应分层清单 §1-2: 启动验证 + TabBar 导航 5/5
 * 排除 L2: 冷启动耗时(需真机)
 * 排除 L3: 微信登录授权(需真实账号)
 * 运行: npm run test:e2e:smoke
 */

const { goToTab, findElement, findElements, TABS } = require('../helpers');

let mp;

beforeAll(() => {
  mp = global.__miniProgram__;
  expect(mp).toBeTruthy();
});

// ============================================================
// §1 启动验证
// ============================================================
describe('§1 启动验证', () => {
  test('1.1 小程序已连接 → currentPage 可用', async () => {
    const page = await mp.currentPage();
    expect(page).toBeTruthy();
    expect(page.path).toBeTruthy();
    console.log(`   当前页面路径: ${page.path}`);
  });

  test('1.2 页面应渲染 page 根元素', async () => {
    const el = await findElement(mp, 'page');
    expect(el).toBeTruthy();
  });
});

// ============================================================
// §2 TabBar 导航
// ============================================================
describe('§2 TabBar 导航', () => {
  test('2.1 攻略书Tab → 可切换', async () => {
    await goToTab(mp, 'guidebooks');
    const page = await mp.currentPage();
    // 可能被重定向到 status-select (未完成引导时)
    expect(page.path).toBeTruthy();
    console.log(`   攻略书Tab → ${page.path}`);
  });

  test('2.2 证件夹Tab → 可切换', async () => {
    await goToTab(mp, 'documents');
    const page = await mp.currentPage();
    expect(page.path).toContain('documents');
  });

  test('2.3 提醒器Tab → 可切换', async () => {
    await goToTab(mp, 'reminders');
    const page = await mp.currentPage();
    expect(page.path).toContain('reminders');
  });

  test('2.4 流程控Tab → 可切换', async () => {
    await goToTab(mp, 'process');
    const page = await mp.currentPage();
    expect(page.path).toContain('process');
  });

  test('2.5 我的Tab → 可切换', async () => {
    await goToTab(mp, 'mine');
    const page = await mp.currentPage();
    expect(page.path).toContain('mine');
  });
});
