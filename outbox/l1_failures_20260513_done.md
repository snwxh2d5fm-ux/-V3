# DONE: L1 E2E 3项修复完成

> 对应: inbox/NOTIFY_l1_failures_20260513.md
> 日期: 2026-05-13
> 状态: done

## 修复清单

### Bug 1: process 详情页导航失败 ✅
**文件**: `tests/e2e/specs/process.test.js`
**根因**: `navigateTo('/pages/process/detail/detail')` 缺少 `?id=` 参数，页面 onLoad 判断无 id → 导航回退 → test 看到 index 页
**修复**:
- URL 改为 `/pages/process/detail/detail?id=e2e-test-process`
- beforeAll 中通过 `mp.evaluate` 种子测试流程数据到 `__processes__` storage

### Bug 2: reminders 详情页导航失败 ✅
**文件**: `tests/e2e/specs/reminders.test.js`
**根因**: 虽有 `?id=e2e-test`，但 `loadReminderDetail()` 从 storage 找不到该 id → 导航回退
**修复**:
- beforeAll 中通过 `mp.evaluate` 种子测试提醒数据到 `__reminders__` storage

### Bug 3: regression require 路径错误 ✅
**文件**: `tests/e2e/specs/regression.test.js:12`
**根因**: `require('../../app.json')` 从 `tests/e2e/specs/` 向上两级 = `tests/app.json`（不存在）
**修复**: 改为 `require('../../../app.json')` → 项目根目录 `app.json`

## 变更文件
- `tests/e2e/specs/process.test.js` — 种子数据 + URL 参数
- `tests/e2e/specs/reminders.test.js` — 种子数据
- `tests/e2e/specs/regression.test.js` — require 路径修正

## 验证
```bash
npm run test:e2e
```
