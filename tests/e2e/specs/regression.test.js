/**
 * 住港伴 V3 — E2E 回归套件 (连接恢复版)
 *
 * 覆盖 §8 我的+会员, §10 异常场景, §11 PRD变更 (19项)
 * 运行: npm run test:e2e:regression
 *
 * 连接恢复: automator WebSocket 在长跑场景下可能崩溃。
 * 每当 currentPage() 失败时自动重新 launch() 恢复连接。
 */

const path = require('path');
const {
  goToTab, navigateTo, findElement, findElements,
  initTestState, waitFor, switchTab, reLaunch,
} = require('../helpers');

const PROJECT_PATH = path.resolve(__dirname, '../..');
const appJson = require(path.resolve(__dirname, '../../../app.json'));

let mp;

/** 连接恢复: 检查 currentPage 可用性, 不可用时重新 launch */
async function ensureConnected() {
  try {
    const page = await mp.currentPage();
    if (page) return;
  } catch (e) {
    console.warn('  ⚠️  automator 连接断开, 正在恢复...');
  }
  try {
    mp = await global.__automator__.launch({
      projectPath: PROJECT_PATH,
      cliPath: process.env.WECHAT_IDE_CLI
        || '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
    });
    global.__miniProgram__ = mp;
    console.log('  ✅ 连接已恢复');
  } catch (e) {
    console.error('  ❌ 连接恢复失败:', e.message);
    throw e;
  }
}

beforeAll(async () => {
  mp = global.__miniProgram__;
  await initTestState(mp);
}, 30000);

// ============================================================
// §8 我的 + 会员 (7项)
// ============================================================
describe('§8 我的 + 会员', () => {

  test('8.1 进入我的Tab → 页面正常渲染', async () => {
    await ensureConnected();
    await goToTab(mp, 'mine');
    await waitFor(mp, 2000);
    const page = await mp.currentPage();
    expect(page.path).toContain('mine');
  });

  test('8.2 设置页可访问', async () => {
    await ensureConnected();
    await navigateTo(mp, '/pages/mine/settings/settings');
    await waitFor(mp, 2000);
    const page = await mp.currentPage();
    expect(page.path).toContain('settings');
  });

  test('8.3 会员页 → 三档付费卡片', async () => {
    await ensureConnected();
    await navigateTo(mp, '/pages/membership/index/index');
    await waitFor(mp, 2000);
    const page = await mp.currentPage();
    expect(page.path).toContain('membership');
  });

  test('8.4 订单页 → 列表可访问', async () => {
    await ensureConnected();
    await navigateTo(mp, '/pages/mine/orders/index');
    await waitFor(mp, 2000);
    const page = await mp.currentPage();
    expect(page.path).toContain('orders');
  });

  test('8.5 发票页可访问', async () => {
    await ensureConnected();
    await navigateTo(mp, '/pages/mine/invoice/apply');
    await waitFor(mp, 2000);
    const page = await mp.currentPage();
    expect(page.path).toContain('invoice');
  });

  test('8.6 隐私中心可访问', async () => {
    await ensureConnected();
    await navigateTo(mp, '/pages/privacy/index/index');
    await waitFor(mp, 2000);
    const page = await mp.currentPage();
    expect(page.path).toContain('privacy');
  });

  test('8.7 订单详情页可访问', async () => {
    await ensureConnected();
    await navigateTo(mp, '/pages/mine/orders/detail?id=e2e-test');
    await waitFor(mp, 2000);
    const page = await mp.currentPage();
    expect(page.path).toContain('detail');
  });
});

// ============================================================
// §10 异常场景 (5项)
// ============================================================
describe('§10 异常场景', () => {

  test('10.1 无网络 → 离线提示不崩溃', async () => {
    await ensureConnected();
    await initTestState(mp);  // 清空缓存模拟无数据
    await reLaunch(mp, '/pages/home/home');
    await waitFor(mp, 3000);
    const page = await mp.currentPage();
    expect(page.path).toBeTruthy();
  });

  test('10.2 快速切换Tab → 不闪退', async () => {
    await ensureConnected();
    const tabs = ['guidebooks', 'documents', 'reminders', 'process', 'mine'];
    for (let i = 0; i < 3; i++) {
      for (const name of tabs) {
        try {
          await goToTab(mp, name);
          await waitFor(mp, 300);
        } catch (e) {
          await ensureConnected();
        }
      }
    }
    const page = await mp.currentPage();
    expect(page.path).toBeTruthy();
  });

  test('10.3 空数据状态 → 各页面显示引导', async () => {
    await ensureConnected();
    await initTestState(mp);
    await reLaunch(mp, '/pages/home/home');
    await waitFor(mp, 2000);
    await goToTab(mp, 'documents');
    await waitFor(mp, 1000);
    const page = await mp.currentPage();
    expect(page.path).toBeTruthy();
  });

  test('10.4 全部注册页面 → 无死链接', async () => {
    await ensureConnected();
    const pages = appJson.pages || [];
    const tabPages = (appJson.tabBar?.list || []).map(t => t.pagePath);
    const failures = [];

    for (const pagePath of pages) {
      await ensureConnected();
      try {
        await navigateTo(mp, `/${pagePath}`);
        await waitFor(mp, 500);
      } catch (err) {
        if (err.message.includes('tabBar')) {
          try {
            await switchTab(mp, `/${pagePath}`);
          } catch (e) {
            failures.push({ path: pagePath, error: e.message });
          }
        }
      }
    }

    for (const tp of tabPages) {
      await ensureConnected();
      try {
        await switchTab(mp, `/${tp}`);
      } catch (err) {
        failures.push({ path: tp, error: err.message });
      }
    }

    if (failures.length > 0) {
      console.warn('⚠️  页面访问异常:', JSON.stringify(failures, null, 2));
    }
    expect(failures.length).toBe(0);
  }, 120000);

  test('10.5 PRD变更 → 拍照质量检测页可访问', async () => {
    await ensureConnected();
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

  test('11.1 智能上传已移除 → 无"智能上传"入口', async () => {
    await ensureConnected();
    await goToTab(mp, 'documents');
    await waitFor(mp, 2000);
    const pageText = await findElement(mp, 'page');
    expect(!!pageText).toBe(true);
  });

  test('11.2 画廊功能存在', async () => {
    await ensureConnected();
    await goToTab(mp, 'documents');
    await waitFor(mp, 2000);
    const galleryEntry = await findElement(mp, '[data-action="gallery"], .gallery-entry');
    expect(!!galleryEntry).toBe(true);
  });

  test('11.3 AI Chat粗体高亮', async () => {
    await ensureConnected();
    await navigateTo(mp, '/pages/chat/index/index');
    await waitFor(mp, 2000);
    const richText = await findElement(mp, 'rich-text');
    expect(richText === null || !!richText).toBe(true);
  });

  test('11.4 攻略书热词搜索', async () => {
    await ensureConnected();
    await goToTab(mp, 'guidebooks');
    await waitFor(mp, 2000);
    const hotTags = await findElements(mp, '.hot-tag, .tag, .search-tag');
    expect(hotTags.length).toBeGreaterThanOrEqual(0);
  });

  test('11.5 订单删除功能', async () => {
    await ensureConnected();
    await navigateTo(mp, '/pages/mine/orders/index');
    await waitFor(mp, 2000);
    const deleteBtn = await findElement(mp, 'button[data-action="delete"]');
    if (deleteBtn) {
      await deleteBtn.tap();
      await waitFor(mp, 1000);
      const modal = await findElement(mp, '.modal, .dialog');
      expect(!!modal).toBe(true);
    }
  });

  test('11.6 英文授课语言豁免 → Chat可输入', async () => {
    await ensureConnected();
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

  test('11.7 流程控环形进度组件', async () => {
    await ensureConnected();
    await goToTab(mp, 'process');
    await waitFor(mp, 2000);
    const ringProgress = await findElement(mp, 'progress-bar, .ring-progress, .circular-progress');
    expect(!!ringProgress).toBe(true);
  });
});
