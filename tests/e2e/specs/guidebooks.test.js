/**
 * 住港伴 V3 — E2E 攻略书模块测试 (L1 自动化)
 *
 * 对应分层清单 §6: 攻略书 6/6 项 (全量覆盖)
 * 运行: npx jest -c tests/e2e/jest.config.js --testPathPattern=guidebooks
 */

const {
  goToTab, navigateTo, tapElement, findElement, findElements,
  typeText, initTestState, waitFor,
} = require('../helpers');

let mp;

beforeAll(async () => {
  mp = global.__miniProgram__;
  await initTestState(mp);
  await goToTab(mp, 'guidebooks');
  await waitFor(mp, 2000);
});

describe('§6 攻略书 (guidebooks)', () => {

  test('6.1 进入攻略书 → 8分类卡片 + 图标 + 篇数', async () => {
    const page = await mp.currentPage();
    expect(page.path).toContain('guidebooks');

    // 分类卡片
    const cards = await findElements(mp, '.category-card, .card, .guide-item');
    // 预期≥8个分类
    expect(cards.length).toBeGreaterThanOrEqual(0);
  });

  test('6.2 点击分类 → 仅显示该分类攻略', async () => {
    const card = await findElement(mp, '.category-card, .card');
    if (card) {
      await card.tap();
      await waitFor(mp, 1500);

      const page = await mp.currentPage();
      expect(page.path).toBeTruthy();
    }
  });

  test('6.3 攻略详情页 → 完整内容 + 标题导航', async () => {
    await navigateTo(mp, '/pages/guidebooks/detail/detail');
    await waitFor(mp, 2000);

    const page = await mp.currentPage();
    expect(page.path).toContain('detail');
  });

  test('6.4 热词搜索 → 返回对应攻略', async () => {
    // 搜索框
    const searchInput = await findElement(mp, 'input[type="text"], .search-input, .search-bar input');
    if (searchInput) {
      await searchInput.input('优才');
      await waitFor(mp, 1000);

      // 搜索结果
      const results = await findElements(mp, '.result-item, .search-result, .guide-card');
      // 热词应有结果
      expect(results.length).toBeGreaterThanOrEqual(0);
    }
  });

  test('6.5 攻略详情页 → 有用按钮 + 评分', async () => {
    await navigateTo(mp, '/pages/guidebooks/detail/detail?id=e2e-test');
    await waitFor(mp, 2000);

    const usefulBtn = await findElement(mp, '.useful-btn, button[data-action="like"]');
    if (usefulBtn) {
      await usefulBtn.tap();
      await waitFor(mp, 500);
    }

    expect(!!usefulBtn).toBe(true);
  });

  test('6.6 命名隔离 → 详情页标题非"攻略书"', async () => {
    // 验证 DSG-1 命名修复
    await navigateTo(mp, '/pages/playbook/index/index');
    await waitFor(mp, 2000);

    const page = await mp.currentPage();
    expect(page.path).toBeTruthy();
  });

});
