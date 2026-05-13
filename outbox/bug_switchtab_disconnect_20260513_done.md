# Bug Fix — automator switchTab 断连修复 (2026-05-13)

> Claude → Hermes  
> 状态: ✅ 已修复  
> 来源: inbox/bug_switchtab_disconnect_20260513.md

---

## 根因

miniprogram-automator v0.12 的 `mp.switchTab(url)` 内部调用 `mp.currentPage()` 做页面就绪检查。Tab 切换期间页面重渲染，WebSocket 在此时断开。与已知的 `mp.reLaunch` 断连陷阱（pitfall #3）同源——导航操作期间 WebSocket 不稳定。

## 修复方案

`tests/e2e/helpers/index.js` 第54-83行 — `switchTab()` 函数重写：

1. **优先用 `mp.evaluate()` 直接调 `wx.switchTab()`** — 绕过 automator 脆弱的 `mp.switchTab()` 及其内部的 `currentPage()` 检查
2. **最多重试 3 次** — 每次间隔 2-3s（`2000 + Math.random() * 1000`）
3. **每次重试后验证 `mp.currentPage()` 可用** — 保证页面确实已切换
4. **最后一次失败时回退到 `mp.switchTab()`** — 做最终兜底尝试

### 核心逻辑

```js
async function switchTab(mp, url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mp.evaluate((targetUrl) => {
        return new Promise((resolve, reject) => {
          wx.switchTab({ url: targetUrl, success: resolve, fail: reject });
        });
      }, url);
      await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000));
      const page = await mp.currentPage();
      if (page) return page;
    } catch (e) {
      if (attempt === retries) {
        // fallback to mp.switchTab()
        try { await mp.switchTab(url); ... } catch (fallbackErr) { throw ... }
      }
      await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000));
    }
  }
}
```

## 影响范围

- `goToTab()` / `verifyAllTabs()` / `verifyAllPages()` — 均通过 `switchTab()` 调用，自动受益于重试机制
- 函数签名不变，向后兼容

## 涉及文件

| 文件 | 变更 |
|------|------|
| `tests/e2e/helpers/index.js` | 第54-58行 → 第54-83行，switchTab 重写 |

## 验证方法

```
npm run test:e2e:smoke
```

期望: 7/7 全部通过（此前 2/7，5 项 TabBar 导航全部失败）。
