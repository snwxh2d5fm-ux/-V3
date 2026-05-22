# PR: fix/p0-process-path-select-crash — V4.1

## 概述

修复 P0 生产事故：用户符生在"流程控→直接选择路径→优才计划→确认选择优才计划"点击无响应。

## 根因

`pages/process/index/index.js:146` 调用 `require('...storage').unarchiveRemindersByPath(id)`，但该函数在 `utils/storage.js` 中未定义，导致 `onSelectDirectPath` 中途崩溃。代码缺陷自 V4 引入（V3 无此调用），仅当用户进入空状态面板时触发。

## 变更内容

### Bug 修复
- `utils/storage.js`：新增 `archiveRemindersByPath` / `unarchiveRemindersByPath` 函数并导出

### 系统性防护（V4.1）
- 存储版本管理：`getStorageVersion` / `setStorageVersion` / `ensureStorageVersion`（minReadable + _future_data 容忍机制）
- Schema 校验降级：`validateProcessLine` / `validateAndRepairProcesses`（坏数据→重命名备份 + 降级空状态）
- 启动完整性：`runStorageStartupCheck()`（版本迁移→数据校验→健康上报）

### 测试
- `__tests__/storage-resilience.test.js` — 25 用例（Schema校验 + 坏数据降级 + 版本迁移 + 启动完整性）
- `__tests__/storage-archive-reminders.test.js` — 16 用例（封存/恢复/往返）
- `__tests__/process-path-select-fix.test.js` — 9 用例（onSelectDirectPath 调用链集成）

## 测试结果

```
Tests: 447 passed, 12 skipped, 4 todo, 1 failed (预存，无关)
新增: 50 passed, 0 failed
全量回归: 0 新增失败
```

## Code Review

✅ APPROVED — 0 CRITICAL / 0 HIGH / 2 MEDIUM / 1 LOW  
[View full review](CODE_REVIEW_KIRIN.md)

## 文档

- [Bug 排查报告](bug-report-符生-确认选择优才计划无响应.md)
- [测试报告](测试报告-符生Bug修复-20260522.md)
- [系统防护方案](系统防护方案-本地数据架构-20260522.md)
- [技术评审委员会纪要](技术评审委员会-专家会审纪要-20260522.md)

## 合入后待办

- [ ] app.js onLaunch 加 `runStorageStartupCheck()` 调用
- [ ] 发版后符生真机验证
- [ ] 真机测试矩阵按 TC-NEW-01~TC-DATA-02 执行
