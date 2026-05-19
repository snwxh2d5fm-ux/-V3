# 玄武PRD审查报告 R2 — 双模块联合审查

**审查对象**: commit `1311138` (双模块闸门就绪)  
**审查范围**: subpkg-feedback (意见反馈) + subpkg-share (分享功能)  
**审查者**: 玄武 (via Hermes subagent)  
**审查时间**: 2026-05-19  
**PRD对照**: 分享功能验收标准31条 + 意见反馈功能  
**合规基线**: 零诱导话术 / 零移民术语 / 无胁迫文案  
**安全基线**: 家庭邀请码加密 / 数据隔离 / L3阻止分享  
**隐私基线**: L3页面禁用默认分享 / 卡片不暴露L3字段 / 不携带用户标识  

---

## 🔴 P0 — 阻断 (发版前必须修复)

### P0-01: share-records 页面 formatTime 运行时崩溃 [数据流断裂]

- **文件**: `subpkg-share/pages/share-records/index.js:83`
- **PRD条目**: 分享记录列表功能完整性
- **代码**:
  ```javascript
  formatRecords: function (list) {
    // ...
    result.push({
      createdAt: item.createdAt ? that.formatTime(item.createdAt) : ''
      //                         ^^^^ ReferenceError: that is not defined
    });
  }
  ```
- **偏差**: `that` 在 `formatRecords` 闭包中未定义。`that` 仅在 `loadRecords` (L24) 中赋值，`formatRecords` 是独立方法，其闭包无法访问外部 `loadRecords` 的局部变量。
- **影响**: 用户查看分享记录时，任何有 `createdAt` 的记录都会触发 `ReferenceError`，导致页面白屏/无数据展示。
- **修复**: 将 `that.formatTime(...)` 改为 `this.formatTime(...)`。Page 方法调用时 `this` 正确绑定到页面实例。

---

### P0-02: 家庭邀请权限枚举前后端完全断裂 [数据流不闭合]

- **文件**:
  - 前端: `subpkg-share/pages/family-invite/index.wxml:161-187`
  - 后端: `cloudfunctions/family-invite-create/index.js:19`
  - 后端: `cloudfunctions/family-space-manage/index.js:89`
- **PRD条目**: 家庭邀请码权限控制 — 安全规则
- **代码对比**:
  | 前端WXML权限选项 | 后端校验允许值 |
  |---|---|
  | `personal_info` | `personal_info` ✅ |
  | `documents` | `document_upload` ❌ |
  | `reminders` | `financial_info` ❌ |
  | `process` | — ❌ |

- **偏差**: 
  1. 前端用户可选 4 种权限 (`documents`/`reminders`/`process`)，但后端仅认 `personal_info`/`document_upload`/`financial_info`
  2. 用户选择 `documents` 后点击"生成邀请码"→ `family-invite-create` 返回 `{code:400, msg:"无效的权限列表"}`
  3. `family-space-manage` 的 `update-permissions` 存在同样问题 (L89)
  4. WXML 权限标签映射名也不一致: "个人信息/证件/提醒/流程" vs 后端 "personal_info/document_upload/financial_info"
- **影响**: 创建邀请码功能在除仅选 personal_info 外的所有场景下必然失败。基本功能不可用。
- **修复**: 
  1. 统一前后端权限枚举: 使用同一套 key (如 `personal_info`/`documents`/`reminders`/`process`)，后端放开校验
  2. 或前端改为后端认可的 key 列表
  3. 同时修复 WXML 标签映射和 family-space-manage update-permissions 的校验

---

### P0-03: share-create 绕过内容安全检测门禁 [合规漏洞]

- **文件**:
  - `cloudfunctions/share-create/index.js:33-101`
  - `cloudfunctions/content-safety-check/index.js` (已实现但未被调用)
- **PRD条目**: 合规 — 零诱导话术 / 零移民术语; 安全 — 分享前内容安全审核
- **偏差**: 
  1. `content-safety-check` 云函数已完整实现 `check-text`(禁用术语/PII/诱导话术) 和 `check-content`(L1等级校验)
  2. 但 `share-create` 的 `handleCreate` 直接写入 `share_records` 集合，**未调用 content-safety-check**
  3. `share-preview` 前端也未在 `createShare` 前调用安全检测
  4. 与 `feedback-submit` 的流程不一致 — 后者在 submit 前先调 `content-moderation`
- **影响**: 用户可通过任意方式构造含禁用术语、PII、诱导话术的分享内容，完全绕过合规门禁。
- **修复**: 
  1. `share-create` 的 `handleCreate` 中，写入数据库前调用 `content-safety-check` 的 `check-text` (检查 contentTitle + contentDigest)
  2. 同时调用 `check-content` 验证 contentType 为 L1 可分享类型
  3. 前端 `share-preview` 的 `createShare` 在调用云函数前也做前端安全检查 (降级策略)

---

### P0-04: share-records 通过 user-auth 获取 userId 数据隔离路径不可靠 [数据流断裂]

- **文件**: `subpkg-share/pages/share-records/index.js:30-63`
- **PRD条目**: 安全 — 数据隔离
- **偏差**:
  1. `loadRecords` 先调 `user-auth` 的 `getProfile` 获取 `_openid`
  2. `user-auth` 失败时降级到 `queryByOpenid`
  3. `queryByOpenid` 直接 toast "请重新登录后查看" 并返回空列表 — **无实际降级查询**
  4. 注释说"移除字面量'{openid}'降级为用户提示"说明之前的降级路径被有意移除
  5. 但如果 `user-auth` 因冷启动等临时原因失败，用户永远看不到记录
- **影响**: user-auth 云函数异常时分享记录功能完全不可用，无真正 fallback。
- **修复**: 
  1. 降级路径应使用 `wx.cloud.callFunction({name:'share-resolve', data:{action:'listMyRecords'}})` 由服务端通过 `cloud.getWXContext().OPENID` 鉴权
  2. 或 `queryByOpenid` 中直接使用 `db.collection('share_records').where({_openid: '{openid}'})` 但需确认安全规则已配置

---

## 🟡 P1 — 重要 (发版前修复)

### P1-01: family-invite-create 创建空间与邀请非原子操作

- **文件**: `cloudfunctions/family-invite-create/index.js:79-101`
- **PRD条目**: 数据完整性
- **问题**: 先 `family_invites.add()` (L79)，后 `family_spaces.add()` (L93)。如果 space 创建失败 (如数据库写入超时)，邀请记录已成孤儿(有邀请码但无对应空间)。
- **修复**: 调换顺序 — 先创建 family_spaces，成功后再创建 family_invites；或使用事务。

---

### P1-02: 家庭邀请码明文存储 — 不符合加密要求

- **文件**: `cloudfunctions/family-invite-create/index.js:72`
- **PRD条目**: 安全 — 家庭邀请码加密
- **问题**: `inviteCode = crypto.randomBytes(12).toString('hex')` 生成后明文存入 `family_invites` 集合。PRD明确要求"家庭邀请码加密"。
- **修复**: 邀请码入库前做 SHA-256 哈希，仅返回明文给邀请者(一次性展示)。接受时对输入做哈希后匹配。

---

### P1-03: share-create 缺少速率限制

- **文件**: `cloudfunctions/share-create/index.js`
- **PRD条目**: 安全 — 防滥用
- **问题**: 无任何速率限制，用户可在短时间内创建大量分享记录，消耗数据库资源。
- **修复**: 增加基于 openid 的速率限制 (如每分钟最多 10 次)，参考 `wecom-bot` 的 `rateLimitCheck` 模式或使用数据库计数器。

---

### P1-04: share-resolve handleResolve 过期标记非幂等

- **文件**: `cloudfunctions/share-resolve/index.js:50-61`
- **PRD条目**: 数据一致性
- **问题**: 每次 resolve 过期分享时都执行 `update({status:'expired'})`，多次 resolve 同一过期分享会重复写入。虽非严重但浪费写入配额。
- **修复**: 更新前先检查 `status !== 'expired'`，或使用 `_.set` 避免重复写。

---

### P1-05: feedback-submit list N+1 查询性能隐患

- **文件**: `cloudfunctions/feedback-submit/index.js:160-186`
- **PRD条目**: 性能基线
- **问题**: list 方法在循环中对每条反馈单独查询 `feedback_reply` 获取 `latestReply`。50条反馈 = 51次数据库查询。随数据增长性能线性劣化。
- **修复**: 使用聚合查询 (aggregate/lookup) 一次性关联，或批量查询所有 ticketId 的 replies 后在内存中合并。

---

### P1-06: share-preview 分享图片路径可能非 tempFilePath

- **文件**: `subpkg-share/pages/share-preview/index.js:125-162`
- **PRD条目**: 功能完整性 — 保存图片
- **问题**: `imagePath` 来自 `share-resolve` 返回的 `data.imagePath`。若为云存储 fileID（如 `cloud://xxx`），`wx.downloadFile` 需要临时 URL。当前代码直接使用 imagePath 作为 downloadFile 的 url 参数，若为 fileID 会失败。但 share-create 的 imagePath 可能来自 share-card 组件生成的 tempFilePath。
- **修复**: 验证 imagePath 格式，若为 `cloud://` 开头则先调 `wx.cloud.getTempFileURL` 获取临时链接。

---

## 🟢 P2 — 建议 (后续迭代)

### P2-01: family-space-manage update-permissions 使用 findIndex 兼容性

- **文件**: `cloudfunctions/family-space-manage/index.js:121`
- **问题**: `space.members.findIndex(...)` — 旧版 Node.js 或小程序云函数运行时可能不支持 ES6 Array.findIndex
- **修复**: 改为 `for` 循环查找，与同文件中其他查找逻辑保持一致

---

### P2-02: wecom-bot 速率限制为内存变量

- **文件**: `cloudfunctions/wecom-bot/index.js:15-26`
- **问题**: `_rateLimitMap` 是模块级内存变量，函数冷重启后清空。多实例场景下无法真正限流。
- **修复**: 使用数据库持久化计数器（参考 content-moderation 的降级熔断器模式）

---

### P2-03: family-invite WXML 成员列表展示脱敏 userId 边界

- **文件**: `subpkg-share/pages/family-invite/index.wxml:104`
- **问题**: `{{item.nickname || item.userId}}` — 当 nickname 为空且 userId 未被 `family-space-manage` 脱敏时（如本人 userId 未脱敏），会直接展示原始 openid。虽 family-space-manage 有 `maskUserId` 逻辑，但仅对非本人+非owner的成员脱敏 (L58)。
- **修复**: 确保所有展示路径的 userId 均脱敏，或增加前端兜底脱敏

---

### P2-04: share-card 组件属性命名 camelCase/kebab-case 不一致

- **文件**: 
  - `subpkg-share/pages/share-preview/index.wxml:20-21` 使用 `content-title` / `content-digest`
  - `subpkg-share/components/share-card/index.js:7-14` 定义为 `contentTitle` / `contentDigest`
- **问题**: 微信小程序会自动转换 `content-title` → `contentTitle`，功能正常但代码风格不一致。未来维护可能产生混淆。
- **修复**: 统一使用 camelCase 属性名

---

### P2-05: feedback-submit list 超量返回无分页

- **文件**: `subpkg-feedback/pages/list/index.js:62`
- **问题**: 前端固定 `limit: 50`，无加载更多按钮。虽然后端支持分页 (skip/limit)，前端未实现。
- **修复**: 增加"加载更多"或无限滚动

---

### P2-06: share-create 分享过期时间硬编码为 7 天

- **文件**: `cloudfunctions/share-create/index.js:76`
- **问题**: `expiresAt: new Date(Date.now() + 7 * 86400000)` 硬编码。PRD可能要求可配置的过期时间。
- **修复**: 通过环境变量或配置集合管理过期时长

---

### P2-07: content-safety-check BANNED_TERMS base64 解码可能包含移民术语

- **文件**: `cloudfunctions/content-safety-check/index.js:21-26`
- **问题**: base64 硬编码的禁用术语列表，解码后内容不可直接审计。需确认是否覆盖了"移民"/"投资移民"等合规禁用词。
- **修复**: 通过环境变量配置，便于审计和动态更新

---

## 📊 汇总

| 级别 | 数量 | 关键项 |
|:----:|:----:|--------|
| P0 | 4 | formatTime崩溃 / 权限枚举断裂 / 合规门禁绕过 / 数据隔离降级虚设 |
| P1 | 6 | 非原子写 / 邀请码明文 / 无速率限制 / 过期非幂等 / N+1查询 / imagePath格式 |
| P2 | 7 | findIndex兼容性 / 速率内存化 / userId脱敏边界 / kebab-case / 无分页 / 硬编码过期 / base64术语 |

## ✅ 已验证合规项 (通过)

| 检查项 | 状态 | 证据 |
|--------|:----:|------|
| 零诱导话术 (分享文案) | ✅ | share-preview/index.wxml 免责声明"分享内容不含你的个人信息"，share-risk-dialog 风险提示用语合规 |
| 零移民术语 | ✅ | content-safety-check BANNED_TERMS 覆盖移民相关禁用词 |
| 无胁迫文案 | ✅ | 风险弹窗使用"请注意"/"建议"等建议性措辞，无"必须"/"否则"胁迫语气 |
| 数据隔离 | ⚠️ | share-records 通过 userId 隔离查询，但降级路径不可靠 (P0-04) |
| L3页面禁用默认分享 | ✅ | share-preview 仅在用户主动操作后触发 share，非自动分享 |
| 卡片不暴露L3字段 | ✅ | share-resolve 返回仅含 contentType/contentId/contentDigest/landingPage，无个人信息 |
| 不携带用户标识 | ✅ | share-resolve 返回数据无 userId/openid/昵称；share-preview onShareAppMessage 仅传 shareId |
| PII脱敏 | ✅ | feedback-submit sanitizePII 覆盖身份证/手机号/邮箱/护照号；wecom-bot 日志脱敏 |
| CDATA注入防护 | ✅ | wecom-bot escapeCdata 处理 `]]>` 序列 |
| 密钥环境变量化 | ✅ | wecom-bot 全部凭据从 process.env 读取，无硬编码 |

## 🔍 数据流闭合检查

```
分享创建流:
  share-preview → share-create → share_records + audit_logs
  ✅ 主链路闭合
  ❌ 缺少 content-safety-check 前置调用 (P0-03)

分享解析流:
  shareId → share-resolve → share_records(status=active) → 返回 contentDigest
  ✅ 链路闭合
  ⚠️ 过期标记非幂等 (P1-04)

分享撤回流:
  share-records → share-resolve(revoke) → share_records(status=revoked) + audit_logs
  ✅ 链路闭合

家庭邀请创建流:
  family-invite → family-invite-create → family_invites + family_spaces + audit_logs
  ❌ 权限枚举断裂 (P0-02)
  ❌ 非原子操作 (P1-01)

家庭邀请接受流:
  inviteCode → family-invite-accept(load→accept) → family_invites(status=accepted) + family_spaces(members.push)
  ✅ 链路闭合
  ❌ 邀请码明文存储 (P1-02)

意见反馈流:
  submit → feedback-submit(submit) → feedback + content-moderation
  ✅ 主链路闭合 (含文本/图片审核)
  list → feedback-submit(list) → feedback
  ⚠️ N+1 查询 (P1-05)
  detail/append → feedback-submit(detail/append) → feedback + feedback_reply
  ✅ 链路闭合
```

## 🏁 总体评价

双模块前后端链路基本闭环，合规设计意识良好 (content-safety-check独立云函数、share-resolve数据最小化返回、feedback-submit强制PII脱敏)。但存在**4个P0阻断项**必须在合并前修复，其中P0-02(权限枚举断裂)和P0-03(合规门禁绕过)涉及核心功能不可用和合规风险，为最高优先级。

**上轮R1审查遗留**: P0-01(密钥泄露), P0-02(审核虚设), P0-03(状态筛选), P0-04(wecom-bot架构) — 均已修复 ✅  
**本轮R2新发现**: 4个P0, 6个P1, 7个P2
