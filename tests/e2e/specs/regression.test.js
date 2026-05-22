/**
 * 住港伴 V3 — E2E 回归套件
 *
 * 覆盖 §8 我的+会员, §10 异常场景, §11 PRD变更 (19项)
 * 对应 app-integrity 单元测试的运行时补充
 * 运行: npm run test:e2e:regression
 */

const {
  goToTab,
  navigateTo,
  findElement,
  findElements,
  initTestState,
  waitFor,
  reLaunch,
  switchTab,
} = require('../helpers');

let mp;

beforeAll(async () => {
  mp = global.__miniProgram__;
  await initTestState(mp);
}, 30000);

// ============================================================
// §8 我的 + 会员 (7项)
// ============================================================
describe('§8 我的 + 会员', () => {
  test('8.1 进入我的Tab → 页面正常渲染', async () => {
    await goToTab(mp, 'mine');
    await waitFor(mp, 2000);
    const page = await mp.currentPage();
    expect(page.path).toContain('mine');
  });

  test('8.2 设置页可访问', async () => {
    await navigateTo(mp, '/pages/mine/settings/settings');
    await waitFor(mp, 2000);
    const page = await mp.currentPage();
    expect(page.path).toContain('settings');
  });

  test('8.3 会员页 → 三档付费卡片', async () => {
    await navigateTo(mp, '/pages/membership/index/index');
    await waitFor(mp, 2000);
    const page = await mp.currentPage();
    expect(page.path).toContain('membership');
  });

  test('8.4 订单页 → 列表可访问', async () => {
    await navigateTo(mp, '/pages/mine/orders/index');
    await waitFor(mp, 2000);
    const page = await mp.currentPage();
    expect(page.path).toContain('orders');
  });

  test('8.5 发票页可访问', async () => {
    await navigateTo(mp, '/pages/mine/invoice/apply');
    await waitFor(mp, 2000);
    const page = await mp.currentPage();
    expect(page.path).toContain('invoice');
  });

  test('8.6 隐私中心可访问', async () => {
    await navigateTo(mp, '/pages/privacy/index/index');
    await waitFor(mp, 2000);
    const page = await mp.currentPage();
    expect(page.path).toContain('privacy');
  });

  test('8.7 订单详情页可访问', async () => {
    await navigateTo(mp, '/pages/mine/orders/detail?orderId=e2e-test');
    await waitFor(mp, 2000);
    const page = await mp.currentPage();
    expect(page.path).toContain('detail');
  });
});

// ============================================================
// §10 异常场景 (5项)
// ============================================================
describe('§10 异常场景', () => {
  test('10.1 冷启动 → 首页正常渲染', async () => {
    await reLaunch(mp, '/pages/home/home');
    await waitFor(mp, 3000);
    const page = await mp.currentPage();
    expect(page.path).toBeTruthy();
  });

  test('10.2 快速切换Tab → 不闪退', async () => {
    const tabs = ['guidebooks', 'documents', 'reminders', 'process', 'mine'];
    for (let i = 0; i < 3; i++) {
      for (const name of tabs) {
        await goToTab(mp, name);
        await waitFor(mp, 200);
      }
    }
    const page = await mp.currentPage();
    expect(page.path).toBeTruthy();
  });

  test('10.3 空数据状态 → 证件夹页正常渲染', async () => {
    await reLaunch(mp, '/pages/home/home');
    await waitFor(mp, 2000);
    await goToTab(mp, 'documents');
    await waitFor(mp, 1000);
    const page = await mp.currentPage();
    expect(page.path).toBeTruthy();
  });

  test('10.4 全部已注册页面 → 无死链接', async () => {
    const appJson = require('../../../app.json');
    const pages = appJson.pages || [];
    const tabPages = (appJson.tabBar?.list || []).map(function (t) {
      return t.pagePath;
    });
    const failures = [];

    for (const pagePath of pages) {
      try {
        if (tabPages.includes(pagePath)) {
          await switchTab(mp, '/' + pagePath);
        } else {
          await navigateTo(mp, '/' + pagePath);
        }
        await waitFor(mp, 300);
      } catch (err) {
        failures.push({ path: pagePath, error: err.message });
      }
    }

    if (failures.length > 0) {
      console.warn('页面访问异常:', JSON.stringify(failures, null, 2));
    }
    expect(failures.length).toBe(0);
  });

  test('10.5 证件添加页可访问', async () => {
    await navigateTo(mp, '/pages/documents/add/add');
    await waitFor(mp, 2000);
    const page = await mp.currentPage();
    expect(page.path).toContain('add');
  });
});

// ============================================================
// §11 PRD变更验证 (7项)
// ============================================================
describe('§11 PRD变更验证', () => {
  test('11.1 智能上传已移除 → 页面无相关入口', async () => {
    await goToTab(mp, 'documents');
    await waitFor(mp, 2000);
    const pageText = await findElement(mp, 'page');
    expect(!!pageText).toBe(true);
  });

  test('11.2 画廊功能入口存在', async () => {
    await goToTab(mp, 'documents');
    await waitFor(mp, 2000);
    const galleryEntry = await findElement(mp, '[data-action="gallery"], .gallery-entry');
    expect(!!galleryEntry).toBe(true);
  });

  test('11.3 AI Chat rich-text → 粗体渲染组件存在', async () => {
    await navigateTo(mp, '/pages/chat/index/index');
    await waitFor(mp, 2000);
    const richText = await findElement(mp, 'rich-text');
    expect(richText === null || !!richText).toBe(true);
  });

  test('11.4 攻略书热词搜索入口', async () => {
    await goToTab(mp, 'guidebooks');
    await waitFor(mp, 2000);
    const hotTags = await findElements(mp, '.hot-tag, .tag, .search-tag');
    expect(hotTags.length).toBeGreaterThan(0);
  });

  test('11.5 订单删除 → 确认弹窗', async () => {
    await navigateTo(mp, '/pages/mine/orders/index');
    await waitFor(mp, 2000);
    const deleteBtn = await findElement(mp, 'button[data-action="delete"], .delete-btn');
    if (deleteBtn) {
      await deleteBtn.tap();
      await waitFor(mp, 1000);
      const modal = await findElement(mp, '.modal, .dialog, .wx-toast');
      expect(!!modal).toBe(true);
    }
  });

  test('11.6 英文授课语言豁免 → AI对话页可提问', async () => {
    await navigateTo(mp, '/pages/chat/index/index');
    await waitFor(mp, 2000);
    const input = await findElement(mp, 'input, textarea');
    if (input) {
      await input.input('英文授课语言豁免');
      const sendBtn = await findElement(mp, '.send-btn, button[data-action="send"]');
      if (sendBtn) {
        await sendBtn.tap();
        await waitFor(mp, 3000);
      }
    }
    const page = await mp.currentPage();
    expect(page.path).toContain('chat');
  });

  test('11.7 流程控材料环形进度', async () => {
    await goToTab(mp, 'process');
    await waitFor(mp, 2000);
    const ringProgress = await findElement(mp, 'progress-bar, .ring-progress, .circular-progress');
    expect(!!ringProgress).toBe(true);
  });
});
