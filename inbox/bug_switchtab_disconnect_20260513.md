# 🔴 P0 Bug: automator switchTab 断连修复

> 来源: Hermes 执行 L1 E2E 冒烟测试发现
> 日期: 2026-05-13 22:xx
> 涉及文件: tests/e2e/helpers/index.js

## 现状

`npm run test:e2e:smoke` 运行时，setup 连接成功（home 页可访问，2 项启动验证通过），但第一个 `switchTab` 立即导致 WebSocket 断开：

```
Connection closed, check if wechat web devTools is still running
```

切换 5 个 Tab 全部失败（5/7 项未通过）。

## 根因

miniprogram-automator v0.12 的 `mp.switchTab(url)` 内部会调用 `mp.currentPage()` 做页面就绪检查。Tab 切换期间页面重渲染，WebSocket 在此时断开。这与已知的 `mp.reLaunch` 断连陷阱（参考 pitfall #3）同源——导航操作期间 WebSocket 不稳定。

## 期望

`switchTab` helper 增加断连重试和降级机制：
1. 优先用 `mp.evaluate(() => wx.switchTab({ url }))` 直接调微信原生 API，绕过 automator 脆弱的 `mp.switchTab()`
2. 最多重试 3 次，间隔 2-3s
3. 每次重试后验证 `mp.currentPage()` 可用
4. 最后一次失败时回退到 `mp.switchTab()` 原生方法做最终尝试

## 涉及文件

- `tests/e2e/helpers/index.js` 第 54-58 行 `switchTab()` 函数

## 实现要点

```js
// 当前实现 (第 54-58 行):
async function switchTab(mp, url) {
  await mp.switchTab(url);
  await safeWait(mp, 1500);
}

// 需要改为: evaluate + 重试 3 次 + currentPage 验证 + 最终 fallback
// 核心思路：
//   try { mp.evaluate(wx.switchTab) } → 等 2s → mp.currentPage()
//   失败 → 重试 (最多3次)
//   最后一次 → try { mp.switchTab() } 最后手段
```

## 验证方法

修复后运行 `npm run test:e2e:smoke`，7/7 应全部通过。

## 当前失败详情

```
Tests: 5 failed, 2 passed, 7 total
✓ 1.1 小程序已连接 (12ms)
✓ 1.2 页面应渲染 page 根元素 (1070ms)
✕ 2.1 ~ 2.5 全部 TabBar 导航测试失败
```
