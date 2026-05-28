# 技术设计文档 — 存储多用户隔离修复

## 文档信息
- 项目：住港伴 ZGB V4
- 版本：v1.0
- 日期：2026-05-28
- 关联：符生账号提醒器脏数据

## 1. 概述

### 1.1 问题
`utils/storage.js` 中三个存储 Key（`__reminders__`/`__processes__`/`__vault_meta__`）使用全局 `wx.Storage`，无用户隔离。多账号共用同一设备时数据互相污染。云端的 `reminder-engine` 和 `db-admin` 已按 `_openid` 隔离，本地未对齐。

### 1.2 设计策略
- 统一入口：`getCurrentOpenid()` 从 session/globalData 获取当前用户标识
- 读过滤：取数据时自动排除其他用户的记录（无 `_openid` 的旧数据放行，保证向后兼容）
- 写绑定：存数据时自动附加 `_openid`
- 仅改 `storage.js`，不碰各页面调用方

## 2. 核心实现

### 2.1 获取当前 openid

```javascript
function getCurrentOpenid() {
  try {
    var app = getApp();
    return (app && app.globalData && app.globalData.userInfo && app.globalData.userInfo._openid)
      || (wx.getStorageSync('__session__') || {}).userInfo && (wx.getStorageSync('__session__') || {}).userInfo._openid
      || null;
  } catch (e) {
    return null;
  }
}
```

两层兜底：`globalData.userInfo._openid`（当前会话）→ `__session__.userInfo._openid`（持久化会话）。

### 2.2 提醒（`__reminders__`）— 数组结构

```
修复函数: getAllReminders, saveReminder, updateReminder, deleteReminder, saveReminders
```

**读**：前端不变，`getAllReminders` 内部过滤：
```javascript
function getAllReminders() {
  var all = wx.getStorageSync(REMINDER_KEY) || [];
  var openid = getCurrentOpenid();
  if (!openid) return all;
  return all.filter(function (r) {
    return !r._openid || r._openid === openid;
  });
}
```

**写**：`saveReminder` 入口绑定：
```javascript
function saveReminder(reminder) {
  var openid = getCurrentOpenid();
  if (openid && !reminder._openid) reminder._openid = openid;
  // ... 原有 save 逻辑不变
}
```

**影响范围**：8 个读写函数，全部改为通过 `getAllReminders` 读 + 写时绑定。`saveReminders` 全量写时需确保已有 `_openid` 不丢失。

### 2.3 流程线（`__processes__`）— 数组结构

```
修复函数: getAllProcessLines, saveProcessLine, saveProcessLines
```

模式与提醒完全相同。`getProcessLine` 内部调 `getAllProcessLines().find(...)`，自动受过滤保护。

### 2.4 证件夹（`__vault_meta__`）— 嵌套对象结构

```
修复函数: saveDocumentMeta, getAllDocuments, deleteDocument
```

结构：`{ documents: { docId: { name, type, ... } }, version: 1 }`

**方案**：每个 document 写入时绑定 `_openid`。读取时过滤。

```javascript
function saveDocumentMeta(doc) {
  var meta = wx.getStorageSync(META_KEY) || { documents: {}, version: 1 };
  var openid = getCurrentOpenid();
  if (openid) doc._openid = openid;
  meta.documents[doc.id] = doc;
  meta.version = meta.version || 1;
  wx.setStorageSync(META_KEY, meta);
}

function getAllDocuments() {
  var meta = wx.getStorageSync(META_KEY);
  if (!meta || !meta.documents) return [];
  var docs = Object.values(meta.documents);
  var openid = getCurrentOpenid();
  if (!openid) return docs;
  return docs.filter(function (d) {
    return !d._openid || d._openid === openid;
  });
}
```

### 2.5 旧数据渐进迁移

| 时间点 | 行为 |
|--------|------|
| 修复前存在的提醒/流程/证件 | 无 `_openid` → `!r._openid` 放行 → 所有用户可见 |
| 修复后新增的数据 | 带 `_openid` → 仅该用户可见 |
| 用户下次操作旧数据 | `saveReminder`/`saveDocumentMeta` 被调用时自动补上 `_openid` |
| 两个用户都操作过同一旧数据 | 最后操作者绑定其 `_openid`，该数据归属最后操作的用户 |

## 3. 时序图

```
新用户A登录 → saveReminder({ title: "续签" })
  ↓ getCurrentOpenid() → "okpw33A..."
  ↓ reminder._openid = "okpw33A..."
  ↓ 写入 __reminders__ [{..., _openid: "okpw33A..."}]

用户A再次进入提醒页 → getAllReminders()
  ↓ getCurrentOpenid() → "okpw33A..."
  ↓ 过滤: _openid === "okpw33A..." ✅ → 显示

用户B登录同设备 → getAllReminders()
  ↓ getCurrentOpenid() → "okpw33B..."
  ↓ 过滤: _openid === "okpw33A..." ❌ → 隐藏
  ↓ 旧数据无_openid → !r._openid → 放行 → 显示
```

## 4. 异常处理

| 场景 | 行为 |
|------|------|
| `getCurrentOpenid()` 返回 `null` | 读不过滤（返回全量），写不绑定（旧行为） |
| 旧数据无 `_openid` 字段 | `!r._openid` → true → 放行，所有用户可见 |
| `__session__` 损坏 | fallback 到 `globalData.userInfo`，再失败返回 null |
| 云端 sync merge | `reminder-engine.list` 已按 `_openid` 返回 → 与本地方案一致 |

## 5. 变更文件

| 文件 | 变更 | 行数 |
|------|------|:--:|
| `utils/storage.js` | 新增 `getCurrentOpenid()` + 修改 11 个读写函数 | ~40 |

无其他文件变更。所有调用方透明受益。

## 6. 回归风险

| 模块 | 风险 | 说明 |
|------|:--:|------|
| 提醒器列表 | ZERO | 过滤逻辑仅排除其他用户数据，自己的数据不变 |
| 提醒详情 | ZERO | `getAllReminders().find()` 结果不变 |
| 流程控 | ZERO | 同模式 |
| 证件夹 | ZERO | 同模式 |
| 云端同步 | ZERO | 云端已有 `_openid` 隔离，本地方案对齐 |
| 未登录态 | ZERO | `openid=null` → 全量返回，与修复前完全一致 |
| 旧数据 | ZERO | 无 `_openid` → 放行，兼容修复前写入的所有数据 |
