# NOTIFY: regression initTestState 重型载荷断连 — 卡点根因

> 来自: Hermes QA | 状态: 🔴
> 日期: 2026-05-13

## 找到卡点了

regression.test.js 的 `beforeAll → initTestState()` 是全部失败的唯一根因：

```js
// helpers/index.js:280
await mp.evaluate(function(tk) {
  wx.clearStorageSync();
  wx.setStorageSync('auth_token', tk);
  wx.setStorageSync('user_profile', { ... }); // 大量 JSON
  wx.setStorageSync('__processes__', [...]);  // 流程种子
  wx.setStorageSync('__reminders__', [...]);  // 提醒种子
}, token);
```

`evaluate` 把大段 JSON 通过 WebSocket 注入小程序运行时，传输超时 → 连接断开 → 后续所有 `mp.evaluate()` / `mp.currentPage()` 全部崩。

## 证据

- 核心 6 套件全绿 — 没有 beforeAll 重型数据注入
- regression 第一项 8.1（我的Tab）有时能过 — WebSocket 还没断
- 8.2 开始全部 `Connection closed` — 轮到了 `initTestState`，传输中崩断

## 修复方向

把 `initTestState` 的逻辑移到 `tests/e2e/setup.js` 的 `globalSetup`：
- setup 中刚 `automator.launch()` 完，WebSocket 最新鲜
- 一次性注入种子数据到 `wx.storage`
- regression.test.js 的 `beforeAll` 只做轻量验证，不写 storage

这样 regression 套件不再自己负责数据初始化，连接不会中途崩。
