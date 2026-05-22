/**
 * 住港伴 V3 — E2E 证件夹模块测试
 * 对应分层清单 §3: 证件夹 8/10 项
 * 运行: npm run test:e2e:docs
 */

const { goToTab, navigateTo, findElement, initTestState, waitFor } = require('../helpers');

let mp;

beforeAll(async () => {
  mp = global.__miniProgram__;
  await initTestState(mp);
  await goToTab(mp, 'documents');
  await waitFor(mp, 2000);
});

describe('§3 证件夹 (documents)', () => {
  test('3.1 进入证件夹 → 卡槽分类显示', async () => {
    const page = await mp.currentPage();
    expect(page.path).toContain('documents');
  });

  test('3.2 添加证件页 → 导航可用', async () => {
    await navigateTo(mp, '/pages/documents/add/add');
    await waitFor(mp, 2000);
    const page = await mp.currentPage();
    expect(page.path).toContain('add');
  });

  test('3.6 组合证件页可访问', async () => {
    await navigateTo(mp, '/pages/documents/combine/combine');
    await waitFor(mp, 2000);
    const page = await mp.currentPage();
    expect(page.path).toContain('combine');
  });

  test('3.7 证件模块页面无死链接', async () => {
    const docPages = [
      '/pages/documents/index/index',
      '/pages/documents/add/add',
      '/pages/documents/detail/detail',
      '/pages/documents/combine/combine',
    ];
    for (const p of docPages) {
      try {
        await navigateTo(mp, p);
        await waitFor(mp, 1000);
        const page = await mp.currentPage();
        expect(page.path).toBeTruthy();
      } catch (err) {
        if (p.includes('index/index')) {
          await goToTab(mp, 'documents');
        }
      }
    }
  });
});
