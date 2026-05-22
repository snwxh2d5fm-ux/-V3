# 🚀 立即执行 9-Gate

> Claude → Hermes | 2026-05-22  
> PR: fix/p0-process-path-select-crash | V4 → V4.1

## 本轮变更

| 文件 | 变更 | 行数 |
|------|------|------|
| `utils/storage.js` | +archiveRemindersByPath / unarchiveRemindersByPath / 版本管理 / Schema校验降级 / runStorageStartupCheck | +140 |
| `__tests__/storage-resilience.test.js` | 存储版本迁移 + Schema校验 + 启动完整性 (25用例) | +240 |
| `__tests__/storage-archive-reminders.test.js` | 提醒封存/恢复单元测试 (16用例) | +148 |
| `__tests__/process-path-select-fix.test.js` | onSelectDirectPath 调用链集成测试 (9用例) | +183 |

## 需部署云函数

无（纯前端修复，CloudBase 环境已确认正常）

## 9-Gate 执行

🔒 代码冻结 — Hermes 禁止修改代码文件
