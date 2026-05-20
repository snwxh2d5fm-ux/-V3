# PM审查报告（玄武）— Sprint 3 工作区修复

**审查日期**: 2026-05-20 15:15 HKT
**审查范围**: 家庭空间邀请 / PDF生成 / 意见反馈字数 / 流程控弹窗 / 前序P0追踪
**审查类型**: PRD对齐 + 功能完整性 + UX体验

---

## 一、前序P0追踪（复审确认）

| # | 前序P0 | 复审结论 |
|---|--------|----------|
| P0-A | 权限枚举断裂 | ⚠️ 未复现文件 — 未在本次审查范围内验证 |
| P0-B | share-create安全检查缺失 | ✅ 已确认存在。`share-create/index.js` 缺少 `!openid` 校验（line 58），未登录用户可创建分享记录，userId=undefined。需补 `if (!openid) return { code: 401, msg: '请先登录' };` |
| P0-C | mine闭包 | 未审查 — mine页面不在本次改动范围内 |
| P0-D | 价格单位 | 未审查 — 不在本次改动范围内 |

---

## 二、家庭空间邀请体验

**PRD期望**: 接收入口 + 一键分享，家属可点击卡片加入

### 功能完整性审查

#### ✅ 已正确实现
- 页面注册：`subpkg-share/pages/family-invite/index` 已在 `app.json` 第86行注册
- 双模式：`manage`（创建者管理成员） + `accept`（被邀请者接受邀请）
- 接收入口：手动输入邀请码输入框 + 粘贴跳转 (`accept-entry` 卡片，WXML:211-219)
- 一键微信分享：`button open-type="share"` (WXML:207) + `onShareAppMessage` (JS:310-323)
- 邀请码生成：角色选择（配偶/子女）+ 权限多选 + 风险提示弹窗
- 成员管理：列表展示、权限更新、移除成员
- 云函数：`family-invite-create` + `family-invite-accept` + `family-space-manage` 均存在
- 安全校验：角色白名单、权限白名单、邀请过期检查、自分禁止、防重复加入

#### P0 阻塞

| # | 问题 | 影响 | 修复建议 |
|---|------|------|----------|
| P0-01 | **family-invite 云函数未注册到 cloudbaserc.json** | `family-invite-create`、`family-invite-accept`、`family-space-manage` 三个云函数在根 `cloudbaserc.json` 的 `functions` 数组中均未出现。部署工具可能不会自动部署这些函数，导致线上调用失败。 | 在 `cloudbaserc.json` 的 `functions` 数组中补入三个函数的配置项，timeout建议≥15s |
| P0-02 | **generate-pdf 云函数未注册到 cloudbaserc.json** | `generate-pdf` 同样未出现在根配置文件。当前使用 CloudRun 格式的本地配置，与其余云函数不一致，部署流程可能断裂。 | 统一到根 `cloudbaserc.json` 或确保 CloudRun 部署流程已配置 |

#### P1 严重

| # | 问题 | 影响 | 修复建议 |
|---|------|------|----------|
| P1-01 | **接受邀请端缺少邀请人信息展示** | `loadInvite` 返回的 inviteInfo 不含邀请人昵称/头像，WXML 中 `inviteInfo.inviterHint` 始终为 falsy（云函数 loadInvite 只返回 role/permissions/expiresAt）。用户体验弱：不知道是谁邀请的。 | 云函数 `loadInvite` 增加查询邀请人 `users` 表，返回 `inviterHint` 字段（脱敏昵称） |
| P1-02 | **分享卡片无预览图** | `onShareAppMessage` 的 `imageUrl` 为空字符串（JS:321）。微信聊天中分享卡片只显示标题文字，视觉吸引力弱，转化率低。 | 上传一张家庭空间分享卡片图到云存储，填入 `imageUrl`（建议 300x300px） |
| P1-03 | **邀请码格式不友好** | `crypto.randomBytes(12).toString('hex')` 生成 24 位纯 hex 字符串（如 `a3f8c2...`），手动输入极易出错。对比系统中的 `invite-code` 云函数使用 `ZGB-XXXX-XXXX` 格式（字母数字分段，排除易混淆字符），体验差距大。 | 统一邀请码格式为分段式（如 `FS-XXXX-XXXX`），使用与 invite-code 相同的字符集和校验逻辑 |

#### P2 建议

| # | 问题 | 影响 | 修复建议 |
|---|------|------|----------|
| P2-01 | **条件恒真** | WXML:212 `wx:if="{{hasSpace || !hasSpace}}"` 恒为 true，`accept-entry` 卡片无条件始终渲染。语义不清，代码意图不明确。 | 移除冗余条件或改为明确语义（如直接无 `wx:if`） |
| P2-02 | **不可变编程违规** | `onPermissionToggle` (JS:163-173) 直接对 `this.data.selectedPermissions` 执行 `push/splice`。虽然后续 `setData` 覆盖，但违反 AGENTS.md §1.4 铁律 | 改为 `var permissions = this.data.selectedPermissions.slice()` |
| P2-03 | **风险弹窗语义模糊** | `showRiskDialog` 在创建邀请时弹出（点击"创建家庭空间"或"添加家属"同一流程），标题"授权风险提示"偏向授权语境，对首次创建空间的用户应使用更友好的引导措辞 | 区分首次创建 vs 追加邀请的两个提示文案 |
| P2-04 | **缺少 empty state 对已有空间但无成员的场景** | 当 `hasSpace=true` 但 `members=[]` 时，显示"X人"为"0人"，但无明确引导添加成员的操作指引 | 增加 0 成员空状态提示："暂无家庭成员，点击下方创建邀请来添加" |

---

## 三、PDF生成（证件夹卡槽）

**PRD期望**: PDF按钮应有反应，空文档时给出提示

### 功能完整性审查

#### ✅ 已正确实现
- 空文档检测：`generateSlotPDF` (documents JS:746-762) — 三层检查：docs不存在 → 无filePath → 调用pdf-generator空数组
- `pdf-generator.js` 空数组检查 (JS:71-73)：`uploadedDocs.length === 0` 时 toast "无图片可合成"
- 文件可读性验证 (JS:93-98)：`fs.accessSync` 检查文件是否存在
- 缓存机制：slotKey → PDF路径 + docCount 失效
- 压缩兜底：上传失败时自动 `compressImage` 重试
- generate-pdf 云函数存在且实现正确（jspdf合成 + 云存储上传）

#### P0 阻塞

| # | 问题 | 影响 | 修复建议 |
|---|------|------|----------|
| P0-03 | **retry机制完全失效** | `pdf-generator.js:49` — `slotKey._pdfRetry`：`slotKey` 是字符串原始值，JS允许在原始值上设属性但该属性不持久（GC后丢失）。每次递归调用 `generateSlotPDF(slotKey, ...)` 传递的都是新字符串字面量，retry count 始终从0开始。**递归打开失败后不会真正重试3次，直接 toast "PDF打开失败"**。 | 将 retryCount 改为闭包变量或传入参数：`function generateSlotPDF(slotKey, slotName, uploadedDocs, retryCount)` |
| P0-04 | **generate-pdf 配置格式不一致** | 本地 `generate-pdf/cloudbaserc.json` 使用 `"cloudrun"` 配置（CloudRun容器模式），根 `cloudbaserc.json` 未注册此函数。若部署依赖根配置，线上 generate-pdf 函数不存在 → PDF永远合成失败。 | 统一部署配置：在根 cloudbaserc.json 中注册或确认 CloudRun 部署流程自动化 |

#### P1 严重

| # | 问题 | 影响 | 修复建议 |
|---|------|------|----------|
| P1-04 | **重复冗余代码** | `slotKey._pdfRetry = 0` 在 pdf-generator.js 中出现3次（lines 69, 75, 85）。lines 69和75之间无分支改变状态，85在75后的第10行且同逻辑块内，纯冗余。代码异味影响可维护性。 | 仅保留一处 `retryCount = 0` 初始化 |
| P1-05 | **缓存失效只看文档数量** | `getSavedPDF` (JS:16-17) 仅比较 `docCount`。如果用户删除了旧照片、上传了同样数量的新照片，PDF缓存不会失效，展示的是旧的合成结果。 | 加入内容摘要（如图片 fileID 数组的 hash）作为缓存键的一部分 |
| P1-06 | **loading 状态不总是关闭** | generate-pdf 云函数返回 `code !== 0` 时，`wx.hideLoading()` 在 line 138 调用。但下载失败时，Promise chain 到达 line 163 catch → 调用 `wx.hideLoading()`。流程上 loading 总会关闭，但嵌套 Promise 链较长，易出遗漏。 | 使用 finally 块统一关闭 loading |

#### P2 建议

| # | 问题 | 影响 | 修复建议 |
|---|------|------|----------|
| P2-05 | **PDF文件永久累积** | vault 目录中的 PDF 文件以 `pdf_<slotKey>_<timestamp>.pdf` 命名，旧文件不会被清理。长期使用会占用存储空间。 | 在 `savePDF` 前清理同一 slotKey 的旧 PDF 文件 |
| P2-06 | **最多20页限制无提示** | generate-pdf 云函数限制 `maxPages=20`（line 38），超出部分静默截断。用户可能不知道PDF不完整。 | 前端检测文档数>20时 toast 提示"超过20张将只合成前20页" |

---

## 四、意见反馈字数限制

**PRD期望**: 最少字数从2字改为10字

### 审查结果

#### ✅ 已正确实现
- JS逻辑 (line 153)：`this.data.content.trim().length >= 10` ✅
- WXML标签 (line 28)：`至少10字` ✅
- WXML提示 (line 91)：`请输入至少10个字的问题描述` ✅

#### P1 严重

| # | 问题 | 影响 | 修复建议 |
|---|------|------|----------|
| P1-07 | **字数提示不一致** | WXML line 39: `至少输入2个字` — 当用户输入不足10字时，红色提示文案仍显示"至少输入2个字"，与实际的10字最低限制矛盾。用户可能误以为只需写2字就够了。 | 将 line 39 的文案改为 `至少输入10个字` |

---

## 五、流程控弹窗修复

**PRD期望**: 修复流程控弹窗打扰用户的问题

### 审查结果

#### ✅ 已正确实现
- `checkDisclaimerNeeded()` 已设为空函数 (JS:442) — 免责弹窗不再主动弹出 ✅
- 自评数据说明弹窗改为用户主动点击触发（仅在 materialTotalCount≥9 时显示入口标签）✅
- 自评弹窗实现质量高：结构化卡片 + 动画 + 小屏适配 ✅

#### P1 严重

| # | 问题 | 影响 | 修复建议 |
|---|------|------|----------|
| P1-08 | **空函数调用浪费资源** | `onShow` (JS:78) 仍通过 `setTimeout` 调用空函数 `checkDisclaimerNeeded()`。虽不影响功能，但产生无意义的 500ms 定时器。 | 移除 `onShow` 中的 setTimeout + checkDisclaimerNeeded 调用，同时清理相关未使用的 data 变量 |
| P1-09 | **死代码积累** | `showDisclaimerPopup` / `disclaimerType` / `disclaimerTitle` / `disclaimerBody` / `disclaimerConfirmed` (JS:59-64) 5个 data 变量 + `confirmDisclaimer()` / `closeDisclaimerPopup()` 2个方法 — 全部不再使用但保留在代码中。`showDisclaimer` (JS:38) + `closeDisclaimer` (JS:412) 也是死代码。累计 7 个变量 + 3 个方法为垃圾代码。 | 清理所有未使用的 disclaimer 相关代码，减少页面 data 体积 |

---

## 六、跨模块风险汇总

### P0（阻塞发布 — 必须在合并前修复）

| # | 模块 | 问题 | 严重性 |
|---|------|------|--------|
| P0-01 | 家庭空间 | cloudbaserc.json 缺少 family-invite-* + family-space-manage 注册 | 功能不可用 |
| P0-02 | PDF | cloudbaserc.json 缺少 generate-pdf 注册 | 功能不可用 |
| P0-03 | PDF | retry 机制因JS原始值特性完全失效 | 打开失败无重试 |
| P0-04 | PDF | generate-pdf 云函数配置格式与其余云函数不一致 | 部署风险 |
| P0-B(前序) | 分享 | share-create 缺少登录校验，可创建无主分享记录 | 安全漏洞 |

### P1（高优先级 — 本Sprint修复）

| # | 模块 | 问题 |
|---|------|------|
| P1-01 | 家庭空间 | 接受端缺少邀请人信息展示 |
| P1-02 | 家庭空间 | 分享卡片无预览图 |
| P1-03 | 家庭空间 | 邀请码格式不友好（24位hex） |
| P1-04 | PDF | 重复冗余代码（retry=0写3次） |
| P1-05 | PDF | 缓存失效仅比较文档数量而非内容 |
| P1-07 | 反馈 | 字数不足提示文案仍显示"2字" |
| P1-08 | 流程控 | 空函数调用 + setTimeout 资源浪费 |
| P1-09 | 流程控 | 7+死代码变量/方法 |

### P2（建议优化 — 可排入后续Sprint）

| # | 模块 | 问题 |
|---|------|------|
| P2-01 | 家庭空间 | 条件恒真 `hasSpace || !hasSpace` |
| P2-02 | 家庭空间 | 不可变编程违规 (push/splice) |
| P2-03 | 家庭空间 | 风险弹窗首次创建语义可优化 |
| P2-04 | 家庭空间 | 0成员时缺空状态引导 |
| P2-05 | PDF | vault目录PDF文件无清理机制 |
| P2-06 | PDF | 超过20页静默截断无提示 |

---

## 七、PRD对齐总结

| 需求项 | 状态 | 说明 |
|--------|:----:|------|
| 家庭空间-接收入口 | ⚠️ 部分 | 手动输入入口 ✅，邀请码格式待优化 |
| 家庭空间-一键分享 | ⚠️ 部分 | `open-type="share"` ✅，缺预览图 + 邀请人信息 |
| PDF生成-无反应修复 | ⚠️ 部分 | 空文档检测 ✅，retry机制 P0 断裂 |
| PDF生成-空文档提示 | ✅ | 三层空检测 + toast 提示 |
| 反馈字数 2→10 | ⚠️ 部分 | 校验逻辑 ✅，提示文案残留"2字" P1 |
| 流程控弹窗修复 | ✅ | 弹窗已关闭，自评入口优化 |

**总体评估**: 5项需求3项部分完成，1项完全完成，1项有小残留。5个P0阻塞项必须在合并前解决。

---

*审查人: Hermes Agent (玄武)*
*审查标准: AGENTS.md / PRD / 微信小程序 UX 规范*
