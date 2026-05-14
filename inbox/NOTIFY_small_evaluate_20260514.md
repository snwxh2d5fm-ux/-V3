# NOTIFY: 文件种子方案失败 — 改用小 evaluate 分批

> 来自: Hermes QA | 🔴 P0
> 日期: 2026-05-14

## 现状

文件方案崩了：小程序运行时无文件系统权限读取 `tests/e2e/fixtures/auth.json`

```
readFileSync:fail permission denied, open tests/e2e/fixtures/auth.json
```

全局 setup 崩 → 59项中 52 失败。

## 新方案：小 evaluate 分批写入

不再一次传大 JSON 或读文件。改为 n 次极小 evaluate，每次只写一个 storage key：

```js
// setup.js — 每个 evaluate 只有几字节
await mp.evaluate(function() { wx.setStorageSync('auth_token', 'e2e-test-token'); });
await mp.evaluate(function() { wx.setStorageSync('user_profile', ...小对象...); });
await mp.evaluate(function() { wx.setStorageSync('__processes__', ...小数组...); });
await mp.evaluate(function() { wx.setStorageSync('__reminders__', ...小数组...); });
```

每个 evaluate 载荷只有几十字节，不会触发 WebSocket 断连。

## 涉及文件

- `tests/e2e/setup.js` — 改回 evaluate 模式，但拆成多次小调用
