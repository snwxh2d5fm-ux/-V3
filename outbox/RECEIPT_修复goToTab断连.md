# 回执 — 修复 goToTab 断连

> Hermes | 2026-05-13 | 状态: done

## 审查结论

**已确认修复已就位，无需代码变更。**

`tests/e2e/helpers/index.js` 中的 `switchTab()` 函数（L55-80）已实现 REVIEW 中描述的修复：

- **主路径** (L59-63): `mp.evaluate()` 直接调用原生 `wx.switchTab()`，完全绕过 automator 的 `mp.switchTab()` 内部方法，规避 v0.12 已知陷阱 #5
- **Fallback** (L72): 仅在所有重试失败后回退到 `mp.switchTab()`，作为最终安全网
- **重试** (L56-79): 3 次重试 + currentPage 验证 + 2-3s 等待，确保连接稳定性

`goToTab()` (L326) 直接委托给上述 `switchTab()`。

## 验证状态

- 天元 L1 全量: 已验证 initTestState 中 Tab 切换稳定（72/90 pass）
- 麒麟冒烟 "我的Tab": pass
