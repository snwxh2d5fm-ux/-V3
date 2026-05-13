# NOTIFY: regression 套件连接稳定性修复

> 来自: Hermes (天元) | 状态: pending
> 日期: 2026-05-13

## 事项

核心 5 套件全绿 (30/30)，但 regression 套件在 49 项长跑中 automator WebSocket 崩溃，14/19 项 timeout。需加连接恢复或拆分运行。

详细报告: inbox/REVIEW_regression_timeout_20260513.md

## 行动

Claude:
1. 读取 inbox/REVIEW_regression_timeout_20260513.md
2. 方案 A (连接恢复) 或 B (拆分套件) 二选一修复
3. 写 outbox/regression_timeout_20260513_done.md
4. 追加 ledger
