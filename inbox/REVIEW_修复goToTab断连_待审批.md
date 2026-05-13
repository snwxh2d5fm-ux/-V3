# 🔒 RESTRICTED — 修复 goToTab WebSocket 断连

> 状态: pending_claude | P0 | Hermes

## 现状

`tests/e2e/helpers/index.js` 的 `goToTab()` 使用 `mp.switchTab(url)`。每次 Tab 切换触发 WebSocket 断开——这是 miniprogram-automator v0.12 已知陷阱 #5。

天元 L1 全量多次因 `initTestState` 中第一个 `evaluate` 调用时连接已断开而失败。麒麟冒烟测试 "我的Tab" 也因 switchTab 后页面未刷新而 fail。

## 涉及文件

`tests/e2e/helpers/index.js` — `goToTab()` 函数

## 修改

```javascript
// 现状（断连）
await mp.switchTab(url);

// 改为（绕过 automator 内部方法）
await mp.evaluate((targetUrl) => {
  return new Promise((resolve, reject) => {
    wx.switchTab({ url: targetUrl, success: resolve, fail: reject });
  });
}, url);
```

## 参考

QA gate skill → `references/miniprogram-automator-v012-api.md` 陷阱 #5
