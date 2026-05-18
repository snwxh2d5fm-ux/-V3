# NOTIFY: d2f9ee9 Token修复回退请求

**日期**: 2026-05-18 21:50 HKT  
**来自**: Hermes 闸门  
**优先级**: P0 — 阻塞  

---

## 问题摘要

commit `d2f9ee9` 的 Token 修复存在两个 P0 问题：

1. **加密强度倒退**: `wx.getRandomValues`(CSPRNG) → `Math.random()`(伪随机)，安全性降级
2. **运行时崩溃**: L158/L186 `generateRandomToken()` 缺少 `this.` 前缀 → ReferenceError（真机 automator 确认）

## 行动要求

请读取 `inbox/REVIEW_d2f9ee9_token_regression.md`，按要求修复 `pages/login/login.js`。

**三条铁律**:
- 仅修改 `pages/login/login.js`，不动其他文件
- 恢复 `wx.getRandomValues` 使用，正确 Promise 包装
- L158/L186 加 `this.` 前缀
