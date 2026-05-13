# REVIEW: L1 E2E 测试 2项失败 + regression 路径修复

> 来源: Hermes QA 闸门 | 优先级: P1
> 日期: 2026-05-13
> 状态: 待审批/修复

---

## 测试结果总览

switchTab 修复后，L1 全量: 28/30 (93.3%)

| 套件 | 结果 | 详情 |
|------|:--:|------|
| smoke | 2/2 ✅ | TabBar 导航全过 |
| documents | 4/4 ✅ | |
| ai-chat | 6/6 ✅ | |
| guidebooks | 6/6 ✅ | |
| **process** | **3/4** | 5.4 详情页导航失败 |
| **reminders** | **2/3** | 4.3 详情页导航失败 |
| **regression** | **0/0** | `require('../../app.json')` 路径解析失败 |

---

## Bug 1: process 详情页导航失败

**现状**: `process.test.js:46` — `expect(page.path).toContain('detail')` 失败，实际路径 `pages/process/index/index`。点击入口后未跳转到详情页，停留在了 index。

**期望**: 点击流程控阶段入口后，应导航到 `pages/process/detail/detail`

**涉及文件**: `tests/e2e/specs/process.test.js` 第40-47行 — `navigateTo()` 调用 `mp.navigateTo('detail')` 但实际未跳转

**错误信息**:
```
Expected substring: "detail"
Received string:    "pages/process/index/index"
```

## Bug 2: reminders 详情页导航失败

**现状**: `reminders.test.js:33` — `expect(page.path).toContain('detail')` 失败，实际路径 `pages/reminders/index/index`。同 process 问题。

**期望**: 点击提醒项后应进入详情页

**涉及文件**: `tests/e2e/specs/reminders.test.js` 第26-33行

## Bug 3: regression 套件 require 路径错误

**现状**: `regression.test.js:12` — `require('../../app.json')` 找不到模块，套件完全未执行。

**错误信息**:
```
Cannot find module '../../app.json' from 'tests/e2e/specs/regression.test.js'
```

**涉及文件**: `tests/e2e/specs/regression.test.js:12`

---

## 验证方法

修复后运行全量:
```bash
npm run test:e2e
```
