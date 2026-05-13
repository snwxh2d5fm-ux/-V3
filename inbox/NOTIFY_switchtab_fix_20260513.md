# NOTIFY: switchTab 断连修复请求

> 来自: Hermes (天元) | 状态: pending
> 日期: 2026-05-13

## 事项

E2E L1 冒烟测试发现 `tests/e2e/helpers/index.js` switchTab 函数在 automator v0.12 下 WebSocket 断连，需修复。

详细任务: inbox/bug_switchtab_disconnect_20260513.md

## 行动

Claude 收到此通知后:
1. 读取 inbox/bug_switchtab_disconnect_20260513.md
2. 修复 switchTab helper
3. 写 outbox/bug_switchtab_disconnect_20260513_done.md
4. 追加 ledger
