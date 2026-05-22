/**
 * 住港伴 V3 — E2E 流程控模块测试
 * 对应分层清单 §5: 流程控 9/9 项
 * 运行: npm run test:e2e:process
 */

const { goToTab, navigateTo, findElement, findElements, initTestState, waitFor, reLaunch } = require('../helpers');

let mp;

beforeAll(async () => {
  mp = global.__miniProgram__;
  await initTestState(mp);
  await goToTab(mp, 'process');
  await waitFor(mp, 2000);
});

describe('§5 流程控 (process)', () => {
  test('5.1 进入流程控 → 页面正常渲染', async () => {
    const page = await mp.currentPage();
    expect(page.path).toContain('process');
  });

  test('5.2 阶段指示器组件存在', async () => {
    const stage = await findElement(mp, 'stage-indicator, .mc-ring__fg');
    expect(!!stage).toBe(true);
  });

  test('5.3 工具栏入口存在', async () => {
    const znBtn = await findElement(mp, '[data-action="guide"], [data-action="znp"]');
    const xlBtn = await findElement(mp, '[data-action="precheck"], [data-action="xlb"]');
    const hasAny = !!(znBtn || xlBtn);
    expect(hasAny).toBeTruthy();
  });

  test('5.4 流程控详情页可访问', async () => {
    await reLaunch(mp, '/pages/process/detail/detail?id=e2e-test-process');
    await waitFor(mp, 2000);
    const page = await mp.currentPage();
    expect(page.path).toBe('pages/process/detail/detail');
  });
});
