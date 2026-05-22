# REVIEW: process/index.js:213 — await 在非 async 函数中 (SyntaxError)

**日期**: 2026-05-20
**来源**: Hermes Gate 3 (DevTools code 10)
**优先级**: P0 (编译阻断)

---

## 问题

`pages/process/index.js:213` — `try` 块内使用 `await`，但外层 `completeAllSteps` 函数未声明 `async`

```javascript
// L209-213
try {
    ...
    var res = await wx.cloud.callFunction({...});  // ❌ SyntaxError: Missing catch or finally after try
```

`node -c` 和 DevTools Summer 编译器均报错，整个小程序无法编译。

## 修复

二选一：

1. 加 `async`: `completeAllSteps: async function(e) {` — 同时确认调用方支持异步
2. 改 `.then()` 链: `wx.cloud.callFunction({...}).then(function(res) { ... })`

## 铁律

仅修改 `pages/process/index/index.js`，不动其他文件。修完 `node -c` 通过 + DevTools 编译确认。
