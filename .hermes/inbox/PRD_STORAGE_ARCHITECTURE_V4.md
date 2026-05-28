# 存储架构方案 v4 — 本地优先 + 云端备份恢复

## 文档信息
- 版本：v1.1（评审修订：pullAll替代restore / 字段映射 / 逐域恢复 / 白名单 / 确认弹窗）
- 日期：2026-05-28
- 作者：生活板块 PD
- 关联：符生提醒器脏数据修复 + ZGB-6B93CBC3 修复上线

## 1. 架构原则

```
本地 Storage ← 唯一读写源（所有 CRUD 走本地，即时响应，离线可用）
     ↕
syncAllToCloud（异步上传，不阻塞 UI，不上传个人信息）
     ↓
云端 CloudBase（备份副本，按 _openid 隔离）
     ↓
新设备检测（本地数据为空时一次性拉取，覆盖写入）
     ↓
本地 Storage（恢复完成，后续继续本地优先）
```

**核心规则：本地有数据 → 信本地。本地空 → 从云端恢复。**
永不合并，永不冲突。

## 2. 两个独立操作

### 2.1 备份上传（本地→云端）

**触发**：`syncAllToCloud`，app.js 中按间隔或变更时调用
**数据**：`__reminders__`、`__processes__`、`__vault_meta__` 全量
**目标**：`db-admin.sync` 云函数
**规则**：异步，不阻塞 UI，失败不影响本地数据

### 2.2 新设备恢复（云端→本地）

**触发**：app.js 登录成功后，逐域检测本地无历史数据
**判断条件**（逐域独立，非全或无）：
```
getAllReminders().length === 0 → 恢复提醒
getAllProcessLines().length === 0 → 恢复流程
Object.keys(getAllDocuments()).length === 0 → 恢复证件
```
**数据**：调用已有 `db-admin.pullAll` action（无需新建）
**规则**：覆盖写入本地 Storage，一次性，不合并
**确认**：恢复前弹窗提示用户"检测到云端备份，是否恢复数据？"
**字段映射**：云端返回的 CloudBase 文档需 normalize 后写入本地 Storage

### 2.3 云端→本地字段映射

`pullAll` 返回的是 CloudBase 原始文档，需映射为本地 Storage 格式：

| 域 | 云端格式 | 本地格式 |
|----|----------|----------|
| 提醒 | `_id`, `deadlineDate`, `status: "pending"` | `id: _id`, `deadline: deadlineDate`, `status: "active"` |
| 流程 | `_id`, `stages` | `id: _id`, `stages` 不变 |
| 证件 | `_id`, `name` | `id: _id`, `name` 不变 |

仅在 app.js 恢复逻辑中调用 `normalizeReminder`/`normalizeProcess`/`normalizeDocument` 做转换，不影响 storage.js 的读写接口。

## 3. 移除的旧逻辑

**`reminders/index.js:428-449`** — 每次 onShow 从云端 merge 提醒数据。

移除原因：
- 调用了不存在的 `reminder-engine.list` action，从未实际工作
- 云端与本地字段格式不兼容（`_id` vs `id`, `deadlineDate` vs `deadline`, `pending` vs `active`）
- 合并逻辑在每次 onShow 执行，本地编辑后可能被云端旧数据覆盖
- catch 静默吞错，隐藏故障

## 4. 恢复云函数（复用已有 pullAll）

`db-admin.pullAll` 已实现（line 97-116），无需新建。

**需修改**：增加返回字段白名单，禁止泄露 `phoneHash`、`passwordHash`、`openid` 等敏感字段。

**白名单**：
- 提醒：`_id, title, deadline, deadlineDate, description, status, type, confidence, pathway, chainId, chainLabel, chainOrder, linkedDocIds, offsetDays, createdAt, updatedAt`
- 流程：`_id, name, templateId, status, stages, completedStages, currentStageId, createdAt, updatedAt`
- 证件：`_id, name, type, category, number, expiryDate, issueDate, status, createdAt, updatedAt`

## 5. app.js 恢复调用位置

```
app.js onLaunch / 登录成功后
  → 逐域检测本地数据为空
  → 弹窗确认"检测到云端备份，是否恢复数据？"
  → 用户确认 → await wx.cloud.callFunction({ name: 'db-admin', data: { action: 'pullAll' } })
  → normalizeReminders(data.reminders) → wx.setStorageSync('__reminders__', ...)
  → normalizeProcesses(data.processes) → wx.setStorageSync('__processes__', ...)
  → normalizeDocuments(data.documents) → wx.setStorageSync('__vault_meta__', { documents: ..., version: 1 })
  → 完成
  → 用户取消 → 跳过，本地保持空
```

## 6. 变更清单

| 文件 | 变更 | 类型 |
|------|------|:--:|
| pages/reminders/index/index.js | 删除 line 428-449（云端 merge） | 删 |
| cloudfunctions/db-admin/index.js | pullAll 增加字段白名单 | 改 |
| app.js | onLaunch 增加逐域检测 + 确认弹窗 + normalize + 恢复 | 增 |
| utils/storage.js | 无变更（读写接口不变） | — |

## 7. 非功能需求

| 维度 | 要求 |
|------|------|
| 性能 | 恢复逻辑仅在首次登录执行，不影响日常使用 |
| 离线 | 日常读写完全离线可用，恢复逻辑仅在登录时触发一次 |
| 安全 | 云端返回数据做字段白名单，禁止泄露敏感信息 |
| 兼容 | 旧设备已有本地数据 → 跳过恢复，行为与修复前一致 |

## 8. 与之前方案的差异

| 项目 | 被废弃的方案B | 新方案 |
|------|:--:|:--:|
| _openid 过滤 | 在每个读写函数中加过滤 | wx.Storage 已系统级隔离，不需要 |
| 云端同步 | onShow 每次 merge | 仅新设备一次覆盖 |
| 冲突处理 | 合并可能污染 | 永不合并，不冲突 |
| 改动范围 | storage.js 11个函数 | app.js 1处 + reminders 1处删除 + db-admin 1个action |
