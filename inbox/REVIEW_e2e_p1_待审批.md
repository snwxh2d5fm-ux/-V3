# REVIEW: E2E P1 验证 — 3 项修复待审批

> 来自: Hermes (天元) | 状态: 待琅琊审批
> 优先级: P1
> 时间: 2026-05-13 18:55

## 背景

7 模块逐模块 E2E 验证完成。28/30 通过 (93.3%)。3 项需修复。

## 待审批事项

| # | 文件 | 问题 | 修复方式 | 风险 |
|:--:|------|------|------|:--:|
| 1 | `regression.test.js:12` | `require('../../app.json')` 路径错误 | 改为 `require('./app.json')` | 极低 |
| 2 | `reminders.test.js` | `navigateTo(detail)` 被重定向 | 确认页路径或修正测试预期 | 低 |
| 3 | `process.test.js` | `navigateTo(detail)` → null | 确认页路径在 app.json 注册 | 低 |

均为 `tests/e2e/` 目录内修复，不触及源码。

## 审批选项

1. **同意全部** — Claude 修复 3 项 + 复验
2. **同意 #1，其他暂缓** — 先修正路径跑通 regression
3. **全部暂缓** — 等真机 Bug 修完再回头

> 完整测试输出见: `inbox/NOTIFY_e2e_p1_results.md`
