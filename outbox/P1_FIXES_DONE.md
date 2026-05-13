# E2E P1 修复完成 — 琅琊批准

**时间**: 2026-05-13
**来源**: 琅琊代码审查 → E2E P1 3项
**执行**: 仅代码修改，未运行测试（Hermes 负责验证）

## 修复明细

| # | 文件 | 行号 | 修改 | 理由 |
|---|------|------|------|------|
| 1 | `tests/jest/unit/app-integrity.test.js` | 12 | `require(path.join(PROJECT_ROOT, 'app.json'))` → `require('../../../app.json')` | 降级回归测试的 app.json 加载路径直接使用相对路径，与 PROJECT_ROOT 解耦 |
| 2 | `tests/e2e/specs/reminders.test.js` | 55 | `expect(page.path).toContain('detail')` → `expect(page.path).toBe('pages/reminders/detail/detail')` | detail 页路径断言从模糊匹配收紧为精确路径，防止误匹配其他含 "detail" 的页面 |
| 3 | `tests/e2e/specs/process.test.js` | 61 | `expect(page.path).toContain('detail')` → `expect(page.path).toBe('pages/process/detail/detail')` | 同上 |

## 验证状态

- [ ] Hermes 闸门验证（待执行）

## 备注

- 原 `regression.test.js` 已降级为 `app-integrity.test.js`（Jest 单元），见文件注释
- reminders 和 process 的 detail 页面路径经确认与 `pages/*/detail/detail.*` 文件一致
