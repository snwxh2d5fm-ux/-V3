# 证件夹删除Bug修复 — 代码审查报告

**审查人**: 麒麟 (Hermes Agent)  
**审查日期**: 2026-05-11  
**审查范围**: 3 个文件  
**基准**: `utils/storage.js` (module.exports 含 21 个导出, META_KEY = `__vault_meta__`)

---

## 1. 审查概览

| 文件 | 状态 | 严重问题 | 一般问题 | 建议 |
|------|------|---------|---------|------|
| `pages/documents/detail/detail.js` | ✅ 通过 | 0 | 1 | 2 |
| `pages/documents/combine/combine.js` | ⚠️ 有条件通过 | 0 | 1 | 1 |
| `pages/admin-db/index/index.js` | ❌ 需修复 | 0 | 2 | 0 |

---

## 2. pages/documents/detail/detail.js — 逐项审查

### 2.1 导入匹配

```js
const { getDocumentMeta, deleteDocument: deleteDocFromVault, saveDocumentMeta, getAllDocuments } = require('../../../utils/storage');
```

| 导入名称 | storage.js 导出 | 匹配 |
|----------|----------------|------|
| `getDocumentMeta` | ✅ 第232行 | ✅ |
| `deleteDocument` (别名 `deleteDocFromVault`) | ✅ 第233行 | ✅ |
| `saveDocumentMeta` | ✅ 第232行 | ✅ |
| `getAllDocuments` | ✅ 第232行 | ✅ |

> ⚠️ **建议1**: `getAllDocuments` 被导入但文件中未使用，可移除避免 lint 警告。

### 2.2 存储键检查

搜索 `__documents__` 和 `__vault_meta__` 全文无直接引用。  
仅有的 `wx.getStorageSync` 调用为 `CONSTANTS.STORAGE_KEYS.PRIVACY_MODE`（第30行）和 `CONSTANTS.STORAGE_KEYS.USER_PROFILE`（combine.js），均为独立存储键，不涉及证件元数据。

✅ **存储键已完全统一到 `__vault_meta__`，无残留 `__documents__` 直接读写。**

### 2.3 删除链路

```js
// detail.js 第157-180行
deleteDocument() {
    wx.showModal({ ... });
    // 确认后:
    const deleted = deleteDocFromVault(that.data.docId);   // → storage.deleteDocument()
    if (deleted) {
        wx.showToast({ title: '已删除', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 1000);
    } else {
        wx.showToast({ title: '证件不存在', icon: 'none' });
    }
}
```

对应 `storage.deleteDocument()` (第94-108行):

```
deleteDocument(docId)
  ├── wx.getStorageSync(META_KEY)        // 读取 __vault_meta__
  ├── doc 不存在 → return false
  ├── fs.unlinkSync(doc.filePath)         // 物理文件删除 (try/catch保护)
  ├── delete meta.documents[docId]        // 元数据删除
  └── wx.setStorageSync(META_KEY, meta)  // 写回
```

| 审查项 | 结果 |
|--------|------|
| 元数据读写通过 `__vault_meta__` | ✅ |
| 物理文件 `fs.unlinkSync` 删除 | ✅ |
| 文件不存在时静默处理 | ✅ (try/catch, 注释"文件可能不存在") |
| 返回值 `true/false` 正确传递 | ✅ |
| 删除成功后自动返回上一页 | ✅ |
| 异常有 toast 提示 | ✅ |

> 💡 **建议2**: `deleteDocument` 仅删除 `doc.filePath` 指向的单个文件。如果将来添加缩略图/多页扫描，需同步删除关联文件。当前单文件场景无问题。

### 2.4 归档/恢复链路

**归档** (第118-140行):
```js
getDocumentMeta(docId) → doc.status = 'archived' → doc.archivedAt = ISO时间戳 → saveDocumentMeta(doc)
```
✅ 链路完整：读取 → 修改 status → 写回。附加 `archivedAt` 时间戳为审计做好准备。

**恢复** (第142-155行):
```js
getDocumentMeta(docId) → doc.status = 'active' → delete doc.archivedAt → saveDocumentMeta(doc)
```
✅ 链路完整。恢复时清除 `archivedAt`，保持元数据干净。

> ⚠️ **问题1 (一般)**: `restoreDocument()` 中如果 `getDocumentMeta` 返回 `null`（证件已被删除），方法静默结束无任何提示。应加 toast：
> ```js
> if (!doc) {
>     wx.showToast({ title: '证件不存在', icon: 'none' });
>     return;
> }
> ```

---

## 3. pages/documents/combine/combine.js — 逐项审查

### 3.1 导入匹配

```js
const { getAllDocuments } = require('../../../utils/storage');
```

✅ `getAllDocuments` 存在于 storage.js 第232行导出。

### 3.2 存储键检查

全文无 `__documents__` 或 `__vault_meta__` 直接引用。  
`wx.getStorageSync` 仅用于 `USER_PROFILE`, `IDENTITY_PROFILE`, `USER_SUB_STATUS`，均为独立存储键。

✅ **存储键完全统一。**

### 3.3 loadDocuments 切换

```js
// 第141-149行
loadDocuments() {
    try {
        var docs = getAllDocuments();    // 改用 storage.js 函数
        this.setData({ allDocs: docs || [] });
        this.matchChecklist();
    } catch(e) {
        this.setData({ allDocs: [] });
    }
}
```

✅ 已从（推测的）直接 `wx.getStorageSync` 改为 `getAllDocuments()`。

> ⚠️ **问题2 (一般 — 逻辑缺陷)**: `getAllDocuments()` 返回**所有**证件（含 `status: 'archived'` 的归档证件）。`matchChecklist()` 第269-273行匹配时未过滤 status，导致已归档证件仍被计为 "已就绪"（`status='has'`）。
>
> **影响**: 用户归档身份证后，combine 页面仍显示身份证为 ✅ 已就绪 — 与实际状态矛盾。
>
> **修复方案**: `loadDocuments()` 中过滤：
> ```js
> var docs = getAllDocuments().filter(function(d) { return d.status !== 'archived'; });
> ```
> 或让 `getAllDocuments` 接受可选 filter 参数（但会改动 storage.js 公共 API，需评估影响面）。

### 3.4 路径切换联动

`switchPath()` → `loadUserPath()` → `loadDocuments()` — 路径切换后正确重新加载文档。✅

---

## 4. pages/admin-db/index/index.js — 逐项审查

### 4.1 导入匹配

```js
const { saveDocuments, saveReminders } = require('../../../utils/storage');
```

| 导入名称 | storage.js 导出 | 匹配 |
|----------|----------------|------|
| `saveDocuments` | ✅ 第236行 | ✅ |
| `saveReminders` | ✅ 第236行 | ✅ |

### 4.2 存储键检查

没有 `__documents__` 直接读写。 ✅

### 4.3 pull 操作修复

```js
// 第54行
if (documents) saveDocuments(documents);    // 改用 storage.js 函数
```

✅ 已切换到 `saveDocuments()`，数据写入 `__vault_meta__`。

> ❌ **问题3 (一般 — 实际Bug)**: `saveReminders` 已导入但**未使用**。第55行仍然直接写：
> ```js
> if (reminders) wx.setStorageSync('__reminders__', reminders);
> ```
> 而不是调用 `saveReminders(reminders)`。
>
> **影响**: 
> 1. 绕过了 `saveReminders` 的版本号递增逻辑（`storage.js` 第197行 `version + 1`）
> 2. `saveReminders` 的入参格式与直接写入不同——`saveReminders` 内部用 `{ items: reminders, version: N }` 结构包裹，而直接写 `__reminders__` 直接存数组。两者结构不兼容！后续 `getAllReminders()` 会读不到数据。
>
> **严重程度**: 如果云端返回的 `reminders` 是数组，直接用 `setStorageSync` 存入，则 `getAllReminders()` 第131行 `data.items` 会是 `undefined`，导致提醒功能完全失效。
>
> **修复**: 第55行改为:
> ```js
> if (reminders) saveReminders(reminders);
> ```

> ⚠️ **问题4 (一般)**: 第56行 `__processes__` 也直接写：
> ```js
> if (processes) wx.setStorageSync('__processes__', processes);
> ```
> 未导入 `saveProcessLine`/`getAllProcessLines`，同样存在结构不兼容风险（`PROCESS_KEY` 存储格式为 `{ lines: [...], version: N }`）。虽然用户本次审查未要求覆盖 `__processes__`，但作为同模式问题应一并修复。

### 4.4 saveDocuments 数据健壮性

`saveDocuments()` (storage.js 第189-194行):
```js
function saveDocuments(docs) {
    const meta = wx.getStorageSync(META_KEY) || { documents: {}, version: 1 };
    docs.forEach(d => { meta.documents[d.id] = d; });
    ...
}
```

> 💡 **建议3**: 如果云端返回的文档缺少 `id` 字段，会以 `undefined` 为键存入，导致数据错乱。建议加校验或至少加 `if (d.id)` 保护。但这是 `storage.js` 的问题，不在本次审查范围内。

---

## 5. 全局汇总

### 5.1 审查要点完成情况

| 审查要点 | 状态 |
|----------|------|
| 存储键统一到 `__vault_meta__` (无 `__documents__` 直接读写) | ✅ 全部通过 |
| 删除链路: deleteDocFromVault → 元数据 + fs.unlinkSync | ✅ 正确 |
| 归档/恢复: getDocumentMeta → 修改 status → saveDocumentMeta | ✅ 正确 |
| 导入与 storage.js module.exports 匹配 | ✅ 全部匹配 |

### 5.2 问题清单

| # | 严重度 | 文件 | 描述 | 修复优先级 |
|---|--------|------|------|-----------|
| 1 | 一般 | detail.js:143 | restoreDocument 未处理 doc=null | P2 |
| 2 | 一般 | combine.js:143 | getAllDocuments 含归档文档，导致 checklist 误判 "已就绪" | P2 |
| 3 | 一般 | admin-db/index.js:55 | saveReminders 已导入未使用，直接写 __reminders__ 导致结构不兼容 | **P1** |
| 4 | 一般 | admin-db/index.js:56 | __processes__ 同理直接写，结构不兼容 | P2 |

### 5.3 遗留风险

- `deleteDocument` 仅删除单文件 (doc.filePath)，未来多文件场景需扩展
- `saveDocuments` 无 id 缺失校验（storage.js 层问题）
- 未发现会话中其他页面（如 add/add.js 或 list 页面）的对应修改 — 如有也应一并审查

---

## 6. 结论

**删除链路修复正确** — `detail.js` 的删除/归档/恢复已完全切换到 `storage.js` 函数，存储键统一到 `__vault_meta__`。

**combine.js 切换正确但有逻辑缺陷** — 归档文档不应出现在 checklist 中。

**admin-db 存在实质性 bug** — `saveReminders` 导入不用 + 直接写打破存储结构，需立即修复。

建议修复 P1 问题后合入。
