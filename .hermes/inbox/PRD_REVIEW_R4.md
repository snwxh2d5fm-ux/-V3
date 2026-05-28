# PRD 评审报告 — R4 存储架构 v4

## 评审信息
- 评审日期：2026-05-28
- 评审小组：架构师 / 资深开发者 / 测试agent / 安全agent
- PRD：PRD_STORAGE_ARCHITECTURE_V4.md

---

## 一、架构师审查

### 发现 1: `restore` action 已存在，无需新建

`db-admin` 已有 `pullAll` action（line 35-36, 97-116），功能与 PRD 中描述的 `restore` 完全一致：按 `_openid` 查询三集合，返回 `{ documents, reminders, processes }`。

**建议**: PRD 中 `restore` → 改为 `pullAll`。省掉一个云函数 action 的开发量。

### 发现 2: 云端返回格式与本地不一致，需字段映射

`pullAll` 返回的是 CloudBase 原始文档，包含 `_id`、`_openid`、`updatedAt` 等系统字段。本地 Storage 用 `id`、`deadline`、`status: "active"`。app.js 恢复逻辑需要做字段映射层，不能直接 `setStorageSync`。

**建议**: app.js 恢复逻辑增加 `normalizeReminder`/`normalizeProcess`/`normalizeDocument` 三个映射函数。

### 发现 3: 三个域恢复不应是"全或无"

当前判断条件要求三个域全部为空才恢复。如果一个域已有数据（如用户已手动加了一个证件），另外两个域也应该能从云端恢复。

**建议**: 改为逐域判断：
```
if (getAllReminders().length === 0) restoreReminders()
if (getAllProcessLines().length === 0) restoreProcesses()
if (Object.keys(getAllDocuments()).length === 0) restoreDocuments()
```

### 架构师结论: 🟡 有条件通过（3 项修正）

---

## 二、资深开发者审查

### 发现 4: `syncData` 使用 `id` 字段 upsert

```javascript
// db-admin:86
.where({ _openid: openid, id: r.id })
.update({ data: r })
```

依赖本地 reminder 有 `id` 字段。本地生成是 `'MS_' + event + '_' + idx + '_' + Date.now()`，格式稳定。✅

但 reminders 集合中文档可能积压——sync 是 upsert（update or add），旧提醒不会自动删除。用户本地删了提醒，云端仍保留旧版本。恢复时会把已删的再拉回来。

**建议**: sync 时云端做 diff 清理（本地 id 集合 vs 云端 id 集合，云端多余的标记删除），或恢复时只取 `status !== 'deleted'` 的记录。

**暂不修**: 这属于数据一致性增强，P2，不阻塞本期。

### 发现 5: `syncData` 逐条 upsert 性能

documents 和 reminders 是逐条 `.where().update().catch(.add())`，如果用户有 100+ 条提醒，就是 100+ 次数据库调用。虽然 CloudBase 对同一集合的并发操作有连接池，但极端情况下可能触发限流。

**暂不修**: P3 优化项，批量操作可未来改造。

### 资深开发者结论: ✅ 通过（2 项 P2/P3 记录）

---

## 三、测试agent审查

### 发现 6: 新设备判断存在边界场景

判断条件 `getAllReminders().length === 0` 在以下场景下有歧义：

| 场景 | 本地数据 | 判定 | 是否正确 |
|------|:--:|------|:--:|
| 真新设备 | 空 | 恢复 ✅ | ✅ |
| 用户手动清空了所有提醒 | 空数组 | 恢复 | ⚠️ 可能恢复出已删的数据（见发现4） |
| 数据库为空的老用户 | 空 | 恢复（但云端也是空） | ✅ 无影响 |
| 已有数据的设备 | 非空 | 跳过 ✅ | ✅ |

**建议**: 恢复逻辑增加确认弹窗："检测到云端有备份数据，是否恢复？" 让用户选择，而非静默覆盖。

### 测试场景补充

PRD 缺少以下测试场景：

1. 云端数据损坏（返回格式错误）→ 本地不受影响
2. 云端返回空数据 → 本地保持空
3. 恢复过程中网络中断 → 部分恢复，下次登录补全
4. 旧设备和新设备同时在线 → 各自使用本地数据，不互相同步

### 测试agent结论: 🟡 有条件通过（增加确认弹窗 + 测试场景）

---

## 四、安全agent审查

### 发现 7: `pullAll` 返回字段无过滤

```javascript
return {
  code: 200,
  data: {
    documents: docsRes.data,    // ← 全量字段返回
    reminders: remindersRes.data, // ← 全量字段返回
    processes: processesRes.data, // ← 全量字段返回
  },
};
```

CloudBase 文档可能包含 `phoneHash`、`passwordHash`（如果字段被错误写入）。PRD 已提"字段白名单校验"但未给出具体白名单。

**建议**: `pullAll` 增加字段过滤，每类数据明确允许返回的字段列表。

### 发现 8: `syncData` 无大小限制

用户可能上传超大文件导致 `__vault_meta__` 膨胀。sync 时全量上传可能超过云函数 6MB 限制。

**暂不修**: 当前用户基数小，P3 记录。

### 安全agent结论: 🟡 有条件通过（字段白名单必须修复）

---

## 五、决议汇总

| 角色 | 结论 | 条件 |
|------|:--:|------|
| 架构师 | 🟡 有条件通过 | pullAll 替代 restore / 字段映射 / 逐域判断 |
| 资深开发者 | ✅ 通过 | 2项 P2/P3 记录 |
| 测试agent | 🟡 有条件通过 | 确认弹窗 / 补测试场景 |
| 安全agent | 🟡 有条件通过 | pullAll 字段白名单 |

**总决议**: 🟡 **有条件通过**

**必须修复（编码前）**：
1. PRD 中 `restore` → 改为已有 `pullAll` action
2. app.js 增加云端→本地字段映射（normalize 函数）
3. 恢复改为逐域判断（非全或无）
4. pullAll 增加返回字段白名单
5. 恢复前增加用户确认弹窗

**P2 记录**：
- 云端 diff 清理（发现4）
- 测试场景补充（发现6）

**P3 记录**：
- 批量操作性能优化（发现5）
- sync 大小限制（发现8）
