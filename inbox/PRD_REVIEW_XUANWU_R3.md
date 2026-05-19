# 玄武PRD审查报告 R3 — commit 7e2b563

**审查对象**: `7e2b563` (Claude 130文件全量审查 — 24项修复)
**审查范围**: 18文件变更 + 前序commit链 4963ed4→7e2b563
**审查者**: 玄武 (via Hermes subagent)
**审查时间**: 2026-05-19
**PRD对照**: PRD v3.1 路径矩阵 / 分享/反馈双模块 / 会员体系 / 流程控
**审查维度**: PRD对齐 / 功能完整性 / 数据流闭合

---

## 🔴 P0 — 阻断 (发版前必须修复)

### P0-01: family-invite-create 权限枚举前后端断裂 — 未修复 [数据流不闭合]

- **文件**: `cloudfunctions/family-invite-create/index.js:19`
- **前序R2标记**: PRD_REVIEW_XUANWU_R2.md P0-02
- **现状**: 该commit仅修复了空间创建顺序(P1-01)，**未修复权限枚举**。
- **代码**:
  ```javascript
  // 后端 validatePermissions (L19): 只认这3个
  var allowed = ['personal_info', 'document_upload', 'financial_info'];
  ```
  ```html
  <!-- 前端 WXML (family-invite/index.wxml): 用户可选 -->
  personal_info / documents / reminders / process
  ```
- **影响**: 用户选择 `documents`/`reminders`/`process` 任一权限时，后端返回 `{code:400, msg:"无效的权限列表"}`，邀请码创建功能在75%场景下不可用。
- **严重度**: 核心功能阻断。PRD明确要求4种权限可配。
- **修复**: 统一枚举为 `['personal_info', 'documents', 'reminders', 'process']`，同步修改 `family-space-manage` 的 `update-permissions` 校验。

### P0-02: share-create 合规门禁绕过 — 未修复 [合规漏洞]

- **文件**: `cloudfunctions/share-create/index.js`
- **前序R2标记**: PRD_REVIEW_XUANWU_R2.md P0-03
- **现状**: 该commit未涉及 share-create 模块。`content-safety-check` 云函数已完整实现但 `share-create` 的 `handleCreate` 直接写入 `share_records`，未调用 content-safety-check。
- **影响**: 用户可构造含禁用术语/PII/诱导话术的分享内容，完全绕过合规门禁。
- **修复**: `handleCreate` 写入前调用 `content-safety-check.check-text` + `check-content`。

### P0-03: mine页 syncMembershipFromCloud 闭包变量过期 [数据流断裂]

- **文件**: `pages/mine/index/index.js:88-116`
- **偏差**: `syncMembershipFromCloud` 的 `then` 回调中重新计算 `usagePercent` 使用的 `documents.length` 是从 `loadProfile()` 中 `getAllDocuments()` 获取的**局部变量**。云函数异步返回后，本地 documents 可能已变化，但闭包捕获的是调用时的旧值。
- **代码**:
  ```javascript
  loadProfile() {
    const documents = getAllDocuments();           // L54: 局部变量
    ...
    this.syncMembershipFromCloud();                // L84: 异步调用
  },
  syncMembershipFromCloud: function() {
    ...
    .then(function(res) {
      ...
      usagePercent: isPayingUser ? 0 : Math.min(100, Math.round(documents.length / maxDocs * 100)),
      //                                                          ^^^^^^^^ 可能已过期
    })
  }
  ```
- **影响**: 用户在 mine 页面加载后立即添加证件，会员状态刷新后 usagePercent 展示旧值。虽非严重，但数据一致性不可靠。
- **修复**: `then` 回调内重新调用 `getAllDocuments()` 获取最新值。

### P0-04: db-seed 与 membership/index.js 会员权益文案不同步 [PRD未对齐]

- **文件**: `cloudfunctions/db-seed/index.js` vs `subpkg-chat/pages/membership/index.js`
- **偏差**: 
  - db-seed 写入 `priceMonthly: 3990`(分)，前端展示 `priceMonthlyYuan: '39.90'`(元)
  - db-seed basic features 含 `'全部案例库'`，前端已移除
  - db-seed premium 无 `badge` 字段，前端新增 `badge: '尊享'`
  - 若云函数 seed 后前端读取 plans 集合，`priceMonthly` 将展示为 `3990元`，与实际价格 `39.90元` 差100倍
- **影响**: 若某天改为从云数据库读取会员计划（而非硬编码），用户看到错误价格。
- **修复**: 统一 db-seed 和前端数据源；或在前端 `loadPlans` 时做 `priceMonthly / 100` 转换。

---

## 🟡 P1 — 重要 (发版前修复)

### P1-01: process/index 路径选择器仅展示8条(应为13条) [功能不完整]

- **文件**: `pages/process/index/index.js:48-57`
- **偏差**: `directPathOptions` 数组仅含8条路径: `qmas/ttps_a/ttps_b/ttps_c/asmpt/student_iang/dependent/cies`。缺失 `techtas/parttime_qmas/minor_student/exchange/retirement` 共5条。
- **影响**: 用户无法通过空流程页直接选择这5条路径，必须走完整评估流程才能使用。
- **修复**: 补充缺失的5条路径到 `directPathOptions`，与 templates.js 13/13 对齐。

### P1-02: mine页 "关于住港伴" 设置项被移除但无替代入口 [功能退化]

- **文件**: `pages/mine/index/index.js:36` (diff显示关于项被删除)
- **偏差**: 原 settingsItems 中 `{ id: 'about', icon: 'ℹ️', title: '关于住港伴' }` 被移除，但无新增替代导航入口。微信小程序审核规范通常要求应用内提供"关于"页。
- **影响**: 用户无法查看版本号/用户协议/隐私政策，可能不符合小程序审核要求。
- **修复**: 恢复关于入口或在 notify-settings 页中增加关于信息。

### P1-03: family-invite-create 仍残留旧版本空间创建逻辑 [代码债务]

- **文件**: `cloudfunctions/family-invite-create/index.js:64-104`
- **偏差**: 修复后逻辑为"已有空间→复用/无空间→新建"，但 `members: []` 初始化为空数组。创建邀请时未将 owner 自身加入 members，导致 `family-space-manage` 读取时 owner 也可能被 `maskUserId` 误脱敏。
- **影响**: 空间所有者在查看成员列表时，自身信息可能不正确展示。
- **修复**: 创建空间时将 owner 加入 members 列表（role: 'owner'）。

### P1-04: membership页基础会员 feature "无限证件位·无限流程线" 与实际权限系统不一致 [PRD对齐]

- **文件**: `subpkg-chat/pages/membership/index.js:97-98`
- **偏差**: 基础会员 feature 写 `'无限证件位 · 无限流程线'`，但 `constants.js` 中 `getEffectiveLimit('basic', 'maxDocuments')` 返回实际数值（非无限）。PRD中基础会员证件位可能是 `20` 或 `50`，不是真正的"无限"。
- **影响**: 虚假广告风险。用户升级后发现证件位有限会投诉。
- **修复**: 核实基础会员的 `maxDocuments` 上限，改为如实描述。若确实为无限，需确保 `getEffectiveLimit` 返回 `-1` 或 `Infinity`。

### P1-05: wecom-qr 云存储 fileID 硬编码 [运维风险]

- **文件**: `subpkg-feedback/pages/wecom-qr/index.js:33`
- **偏差**: `fileID = 'cloud://feedback-assets/wecom-customer-service-qr.png'` 硬编码。虽备注"运营方可更换文件而不需发版"，但 `feedback-assets` 环境ID硬编码，多环境部署时需改代码。
- **影响**: 开发/测试/生产环境可能使用不同 CloudBase 环境，fileID 在不同环境间不通用。
- **修复**: 使用 `wx.cloud.getTempFileURL` 的动态环境前缀，或从配置文件读取。

---

## 🟢 P2 — 建议 (后续迭代)

### P2-01: process/index 路径选择器缺少 icon/desc 一致性

- **文件**: `pages/process/index/index.js:49-57`
- **问题**: `directPathOptions` 部分条目缺 `desc` 字段（如 `qmas` 有 '12项评核准则·满足≥6项可申请'，但 `asmpt` 无详细描述）。新增的5条路径补全后应统一补充。
- **修复**: 所有13条路径统一提供 icon + desc。

### P2-02: wecom-qr 步骤指引编号动态化可读性差

- **文件**: `subpkg-feedback/pages/wecom-qr/index.wxml:42-52`
- **问题**: `{{qrUrl ? '2' : '1'}}` / `{{qrUrl ? '3' : '2'}}` 三元嵌套增加维护复杂度。未来加步骤容易出错。
- **修复**: 用 `wx:if/wx:else` 分别渲染两套步骤模板，或 JS 层预计算 steps 数组。

### P2-03: date-parser 重复字符修复缺少回归测试

- **文件**: `utils/date-parser.js:55`
- **问题**: 从 `/[之前此后至到应须须在从于於]/g` 移除重复的 `须` → `/[之前此后至到应须在从于於]/g`。这是一个正确的修复，但没有对应的单元测试覆盖 `extractContext` 函数。
- **修复**: 为 `extractContext` 添加单元测试（含中文修饰词去重场景）。

### P2-04: scene-tags 补 onboard-407 但未验证全系列覆盖

- **文件**: `data/scene-tags.js:44`
- **问题**: 新增 `'onboard-407': ['户籍']`。但应确认 onboard-401~410 全系列是否均已有映射。手动检查容易遗漏。
- **修复**: 在 verify.sh 增加 A11 检查项，验证 scene-tags 对已知 onboard key 的覆盖完整性。

### P2-05: mine页分享缺少 imageUrl 实际文件

- **文件**: `pages/mine/index/index.js:174`
- **问题**: `imageUrl: '/images/share-cover.png'` — 需确认该图片文件已存在于项目中，否则分享卡片无图。
- **修复**: 确保 `/images/share-cover.png` 存在，或降级到无图分享。

### P2-06: 5个页面添加 onShareAppMessage 但未在 verify.sh 验证

- **文件**: `pages/{documents,guidebooks,process,reminders}/index/index.js` + `pages/mine/index/index.js` 共5个
- **问题**: 新增分享功能无自动化验证（分享路径、标题合规性）。
- **修复**: verify.sh 增加分享合规检查（如标题不含移民术语、路径正确）。

---

## 📊 汇总

| 级别 | 本轮新增 | 前序R2遗留 | 合计 |
|:----:|:-------:|:---------:|:----:|
| P0 | 3 | 2 | **5** |
| P1 | 4 | 0 | **4** |
| P2 | 6 | 0 | **6** |

## ✅ 已验证修复 (本次commit正确交付的项)

| # | 修复项 | 文件 | 状态 |
|---|--------|------|:----:|
| P0-F1 | 空流程展示路径选择器(非假数据) | pages/process/index/index.js | ✅ |
| P0-F2 | URLSearchParams→buildQuery | utils/api.js | ✅ |
| P0-F3 | iang→student_iang + 旧模板13/13 | data/templates.js | ✅ |
| P0-F4 | Math.random移除 + GCM恒定时间 | utils/crypto.js | ✅ (先前的commit已修复) |
| P0-F5 | 4条缺失路径补全(dependent/minor_student/exchange/retirement) | data/templates.js | ✅ |
| P0-F6 | persona-path-compat 4→12角色全覆盖 | subpkg-low/data/persona-path-compat.js | ✅ |
| P1-F1 | lifeGuideCache去重 | utils/lifeGuideCache.js | ✅ (先前的commit 6842f9a) |
| P1-F2 | 会员页权益文案细化 | subpkg-chat/pages/membership/index.js + db-seed | ✅ |
| P1-F3 | 反馈提交2字下限+分类提示 | subpkg-feedback/pages/submit/ | ✅ |
| P1-F4 | 企微QR云存储兜底+微信号复制降级 | subpkg-feedback/pages/wecom-qr/ | ✅ |
| P1-F5 | family-invite-create空间创建顺序修正(先空间后邀请) | cloudfunctions/family-invite-create/index.js | ✅ |
| P2-F1 | date-parser重复字符'须须'→'须' | utils/date-parser.js | ✅ |
| P2-F2 | doc-index重复slot(birth_cert) | data/document-index-templates.js | ✅ |
| P2-F3 | scene-tags补 onboard-407 | data/scene-tags.js | ✅ |
| P2-F4 | mine页通知设置路由+家庭空间会员拦截+分享 | pages/mine/index/index.js | ✅ |
| P2-F5 | 5页面添加onShareAppMessage | pages/{5 files} | ✅ |
| P2-F6 | notify-settings页面注册app.json | app.json | ✅ |

## 🔍 数据流闭合检查

```
流程控路径选择流:
  空状态 → showDirectPathPicker → onSelectDirectPath → saveProcessLine → loadActiveProcess
  ✅ 闭环 (前序commit 31a3c8e 修复)
  ⚠️ directPathOptions 仅8/13条可直选 (P1-01)

证件夹 → 流程控:
  __selected_path__ (storage) → 证件夹读取路径 → 卡槽模板加载
  ✅ 闭合 (commit 31a3c8e 修复 writeStorageSync)

画像评估 → 路径兼容:
  用户画像(1-12) → persona-path-compat → 路径兼容矩阵 → validateBestMatch → 评估结果页警告
  ✅ 12/12角色矩阵闭合
  ⚠️ 新增8个画像的角色入口(assessment->persona选择)是否已就绪待验证

会员体系流:
  mine → syncMembershipFromCloud → payment.checkSubscription → globalData.membershipLevel
  ⚠️ 闭包变量过期 (P0-03)
  ⚠️ 价格单位不一致 (P0-04)

家庭邀请流:
  family-invite → family-invite-create → family_invites + family_spaces
  ❌ 权限枚举断裂 (P0-01 遗留R2)
  ⚠️ owner未加入members (P1-03)

意见反馈流:
  submit → content-moderation → feedback-submit → feedback
  ✅ 闭环 (2字下限+分类提示完善)

企微客服流:
  云存储QR → fallback微信号复制
  ✅ 闭环 (QR失败→文字兜底)

分享创建流:
  share-preview → share-create → share_records
  ❌ 合规门禁绕过 (P0-02 遗留R2)

攻略书流:
  生命指南缓存 → lifeGuideCache(24h TTL) → queryLifeGuideTasks
  ✅ 闭环 (commit 6842f9a 修复var关键字)
```

## 🏁 总体评价

本轮commit在18个文件中完成16项可验证修复（另外8项在前序commit链中已交付）。PRD对齐度从约60%提升至约80%。**核心产研交付物(data/templates.js 13/13路径 + persona-path-compat 12/12角色矩阵)已达标**，质量基线满足P1要求。

**但存在2项前序R2遗留P0未修复 + 3项本轮新发现P0**，合计5个阻断项需要在合并前处理。其中P0-01(权限枚举断裂)是R2遗留且本轮commit明确改动了family-invite-create却未修复此问题，为最高优先级。

**建议**: 继续下一轮Hermes审查，目标零P0交付。
