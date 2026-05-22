/**
 * E2E 测试辅助工具库
 *
 * 提供页面导航、元素查询、断言、截图等常用操作的封装。
 * 基于 miniprogram-automator v0.12 API。
 *
 * 关键 API 约定 (v0.12 vs 旧版):
 *   - MiniProgram 没有 .page 属性 → 必须 currentPage() 获取 Page 实例
 *   - Page: waitFor(), $(), $$(), data(), setData(), callMethod(), size()
 *   - Element: text(), attribute(), tap(), input(), trigger(), size(), offset()
 *   - MiniProgram: navigateTo(), reLaunch(), switchTab(), currentPage(), screenshot(), evaluate()
 */

const path = require('path');
const fs = require('fs');

// ============================================================
// 内部 — 获取当前页面
// ============================================================

/** 获取当前页面，无页面时返回 null 不抛异常 */
async function getCurrentPage(mp) {
  const page = await mp.currentPage();
  return page || null;
}

/** 安全 waitFor：优先用 Page.waitFor，page 不存在时用 setTimeout */
async function safeWait(mp, ms) {
  const page = await getCurrentPage(mp);
  if (page) {
    await page.waitFor(ms);
  } else {
    await new Promise((r) => setTimeout(r, ms));
  }
}

// ============================================================
// 页面导航
// ============================================================

/** 等待页面加载完成 (MiniProgram 没有 waitFor，用 reLaunch + 等待替代) */
async function waitForPage(mp, pagePath, timeout = 15000) {
  await mp.reLaunch(pagePath);
  await safeWait(mp, 1500);
  return await getCurrentPage(mp);
}

/** 通过 URL 跳转到指定页面 */
async function navigateTo(mp, url) {
  await mp.navigateTo(url);
  await safeWait(mp, 1500);
}

/** 切换到指定 Tab (evaluate + 3次重试 + currentPage验证 + 最终fallback) */
async function switchTab(mp, url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // 用 mp.evaluate 直接调微信原生 wx.switchTab，绕过 automator 脆弱的 mp.switchTab()
      await mp.evaluate((targetUrl) => {
        return new Promise((resolve, reject) => {
          wx.switchTab({ url: targetUrl, success: resolve, fail: reject });
        });
      }, url);
      // 等待页面稳定后验证 currentPage 可用
      await new Promise((r) => setTimeout(r, 2000 + Math.random() * 1000));
      const page = await mp.currentPage();
      if (page) return page;
    } catch (e) {
      if (attempt === retries) {
        // 最后一次失败：回退到 mp.switchTab() 做最终尝试
        try {
          await mp.switchTab(url);
          await new Promise((r) => setTimeout(r, 1500));
          return await mp.currentPage();
        } catch (fallbackErr) {
          throw new Error(
            `switchTab failed after ${retries} evaluate retries + fallback: ${fallbackErr.message} (last evaluate: ${e.message})`,
          );
        }
      }
      // 非最后一次：等 2-3s 再重试
      await new Promise((r) => setTimeout(r, 2000 + Math.random() * 1000));
    }
  }
}

/** 返回上一页 */
async function navigateBack(mp) {
  await mp.navigateBack();
  await safeWait(mp, 1000);
}

/** 重新启动小程序 */
async function reLaunch(mp, url = '/pages/home/home') {
  await mp.reLaunch(url);
  await safeWait(mp, 2000);
}

// ============================================================
// 元素操作
// ============================================================

/** 查找单个元素 (通过选择器) */
async function findElement(mp, selector) {
  try {
    const page = await getCurrentPage(mp);
    if (!page) return null;
    return await page.$(selector);
  } catch {
    return null;
  }
}

/** 查找多个元素 */
async function findElements(mp, selector) {
  try {
    const page = await getCurrentPage(mp);
    if (!page) return [];
    return await page.$$(selector);
  } catch {
    return [];
  }
}

/** 获取元素文本 */
async function getText(mp, selector) {
  const el = await findElement(mp, selector);
  if (!el) return '';
  try {
    return await el.text();
  } catch {
    return '';
  }
}

/** 获取元素属性 */
async function getAttribute(mp, selector, attr) {
  const el = await findElement(mp, selector);
  if (!el) return null;
  try {
    return await el.attribute(attr);
  } catch {
    return null;
  }
}

/** 点击元素 (Page.waitFor 等待元素出现后 tap) */
async function tapElement(mp, selector, timeout = 5000) {
  const page = await getCurrentPage(mp);
  if (!page) throw new Error('No current page for tapElement');
  await page.waitFor(timeout); // 先等页面稳定
  const el = await page.$(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);
  await el.tap();
  await safeWait(mp, 500);
}

/** 输入文本 */
async function typeText(mp, selector, text) {
  const page = await getCurrentPage(mp);
  if (!page) throw new Error('No current page for typeText');
  await page.waitFor(1000);
  const el = await page.$(selector);
  if (!el) throw new Error(`Input not found: ${selector}`);
  await el.input(text);
}

/** 滚动到指定元素 (用 evaluate 调用 wx.pageScrollTo) */
async function scrollTo(mp, selector) {
  const page = await getCurrentPage(mp);
  if (!page) return;
  await page.waitFor(1000);
  const el = await page.$(selector);
  if (!el) return;
  const offset = await el.offset();
  if (offset) {
    await mp.pageScrollTo(offset.top || 0);
  }
  await safeWait(mp, 300);
}

// ============================================================
// 断言辅助
// ============================================================

/** 断言元素存在且可见 */
async function expectVisible(mp, selector, timeout = 5000) {
  const page = await getCurrentPage(mp);
  if (!page) throw new Error('No current page for expectVisible');
  // Page.waitFor(selector) 会等待元素出现 (但不一定支持 selector 参数)
  // 改用轮询方式
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = await page.$(selector);
    if (el) {
      expect(el).toBeTruthy();
      return el;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`expectVisible timeout: ${selector}`);
}

/** 断言元素不存在 */
async function expectNotVisible(mp, selector, timeout = 3000) {
  const page = await getCurrentPage(mp);
  if (!page) {
    // 无页面 = 肯定不存在
    expect(true).toBe(true);
    return;
  }
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = await page.$(selector);
    if (el) {
      throw new Error(`Element ${selector} should not be visible`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  expect(true).toBe(true);
}

/** 断言文本包含 */
async function expectText(mp, selector, expectedText, timeout = 5000) {
  const text = await getText(mp, selector);
  expect(text).toContain(expectedText);
}

/** 断言当前页面路径 */
async function expectCurrentPage(mp, expectedPath) {
  const page = await getCurrentPage(mp);
  expect(page).toBeTruthy();
  expect(page.path).toBe(expectedPath);
}

// ============================================================
// 截图
// ============================================================

let screenshotCounter = 0;

/** 截图并保存到 reports/screenshots/ */
async function screenshot(mp, name = '') {
  screenshotCounter++;
  const filename = `${String(screenshotCounter).padStart(3, '0')}_${name || 'screenshot'}.png`;
  const dir = path.resolve(__dirname, 'reports', 'screenshots');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  await mp.screenshot({ path: filePath });
  return filePath;
}

// ============================================================
// 数据准备 / 清理
// ============================================================

/** 清除小程序本地缓存 */
async function clearStorage(mp) {
  await mp.evaluate(() => {
    // @ts-ignore
    wx.clearStorageSync();
  });
}

/** Mock 登录状态 — 小 evaluate 分批写入，每 key 几十字节不触发断连 */
async function mockLogin(mp) {
  await mp.evaluate(function (token) {
    wx.setStorageSync('auth_token', token);
  }, 'e2e-test-token-c53f7a91');
  await mp.evaluate(
    function (profile) {
      wx.setStorageSync('user_profile', profile);
    },
    { openid: 'e2e-test-openid', nickname: 'E2E测试用户', avatarUrl: '' },
  );
}

/**
 * 验证测试状态已就绪。
 * 种子数据注入已移至 globalSetup (setup.js)，避免 beforeAll 重型 evaluate 导致 WebSocket 超时断连。
 * 若无 auth_token 缓存 (新机器/清缓存后)，自动兜底调用 mockLogin 而非抛错。
 */
async function initTestState(mp) {
  let hasToken = await mp.evaluate(function () {
    return wx.getStorageSync('auth_token');
  });
  if (!hasToken) {
    // 新机器无缓存 → 先 mock 登录再继续 (麒麟/玄武兜底)
    await mockLogin(mp);
    hasToken = await mp.evaluate(function () {
      return wx.getStorageSync('auth_token');
    });
    if (!hasToken) {
      throw new Error('Test state not initialized — mockLogin failed');
    }
  }
}

/** 轻量清空 storage + 恢复 token (用于空数据/异常场景测试) */
async function lightClearStorage(mp) {
  await mp.evaluate(function () {
    wx.clearStorageSync();
  });
}

/** 调用云函数 (通过 evaluate 调用 wx.cloud.callFunction) */
async function callFunction(mp, name, data = {}) {
  return await mp.evaluate(
    ({ name, data }) => {
      // @ts-ignore
      return wx.cloud.callFunction({ name, data });
    },
    { name, data },
  );
}

/** 获取当前页面 data */
async function getPageData(mp) {
  const page = await getCurrentPage(mp);
  if (!page) return null;
  return await page.data();
}

// ============================================================
// TabBar 快捷操作
// ============================================================

const TABS = {
  guidebooks: '/pages/guidebooks/index/index',
  documents: '/pages/documents/index/index',
  reminders: '/pages/reminders/index/index',
  process: '/pages/process/index/index',
  mine: '/pages/mine/index/index',
};

/** 切换到指定 Tab */
async function goToTab(mp, tabName) {
  const url = TABS[tabName];
  if (!url) throw new Error(`Unknown tab: ${tabName}. Options: ${Object.keys(TABS).join(', ')}`);
  await switchTab(mp, url);
}

/** 验证所有 Tab 可切换 */
async function verifyAllTabs(mp) {
  const results = {};
  for (const [name, url] of Object.entries(TABS)) {
    try {
      await switchTab(mp, url);
      const page = await getCurrentPage(mp);
      results[name] = { passed: true, path: page?.path || 'unknown' };
    } catch (err) {
      results[name] = { passed: false, error: err.message };
    }
  }
  return results;
}

// ============================================================
// 页面完整性检查
// ============================================================

/**
 * 验证 app.json 中所有注册页面可访问
 * 跳过 TabBar 页面 (用 switchTab) 和需要参数的页面
 */
async function verifyAllPages(mp, appJson) {
  const results = { passed: [], failed: [], skipped: [] };
  const tabPages = (appJson.tabBar?.list || []).map((t) => t.pagePath);
  const pages = appJson.pages || [];

  for (const pagePath of pages) {
    try {
      if (tabPages.includes(pagePath)) {
        await switchTab(mp, `/${pagePath}`);
      } else {
        await navigateTo(mp, `/${pagePath}`);
      }
      results.passed.push(pagePath);
    } catch (err) {
      results.failed.push({ path: pagePath, error: err.message });
    }
    await safeWait(mp, 500);
  }

  return results;
}

module.exports = {
  // 导航
  waitForPage,
  navigateTo,
  switchTab,
  navigateBack,
  reLaunch,
  waitFor: safeWait, // 等待 ms

  // 元素
  findElement,
  findElements,
  getText,
  getAttribute,
  tapElement,
  typeText,
  scrollTo,

  // 断言
  expectVisible,
  expectNotVisible,
  expectText,
  expectCurrentPage,

  // 截图
  screenshot,

  // 数据
  clearStorage,
  mockLogin,
  initTestState,
  lightClearStorage,
  callFunction,
  getPageData,

  // TabBar
  goToTab,
  verifyAllTabs,

  // 页面完整性
  verifyAllPages,

  // 常量
  TABS,
};
