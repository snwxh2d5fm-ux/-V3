# 麒麟代码审查报告 — 0cd4e12 → 00df063（4项真机修复）

**审查日期**: 2026-05-20 15:30 HKT
**审查范围**: 0cd4e12..00df063（2 commits, 14 files, +555/-121）
**审查类型**: 代码质量 + 安全 + 真机兼容性 + 前序P0追踪
**审查人**: Hermes Agent（麒麟）

---

## 一、审查范围总览

| # | Commit | 修复内容 |
|---|--------|----------|
| 1 | `0cd4e12` | mergeProgress 补齐全部8关（空关卡也渲染） |
| 2 | `a505b14` | 家庭邀请接收方输入 / PDF重试修复 / 反馈字数10字 / 流程控stepId修复 |
| 3 | `00df063` | ¥599按钮完全重写（移除async→回调链） |

### 涉及文件矩阵

| 文件 | 修改性质 | 行数变化 |
|------|----------|:--:|
| `pages/guidebooks/index/index.js` | mergeProgress 8关补齐 | +6 |
| `pages/process/index/index.js` | 流程控 stepId 修复（STAGE_BRIDGE_MAP） | +23/-16 |
| `components/status-badge/status-badge.js` | ¥599按钮 async→回调链重写 | +56/-68 |
| `utils/pdf-generator.js` | retry 机制修复（slotKey属性→参数传递） | +5/-9 |
| `pages/documents/index/index.js` | PDF空文档检测（3层校验） | +11 |
| `subpkg-feedback/pages/submit/index.js` | 反馈字数下限 2→10 | +1/-1 |
| `subpkg-feedback/pages/submit/index.wxml` | 反馈字数文案更新 | +4/-4 |
| `subpkg-share/pages/family-invite/index.js` | 家庭邀请：接收方姓名 + 手动输入 + 分享 | +38 |
| `subpkg-share/pages/family-invite/index.wxml` | 家庭邀请UI：接收方输入 + 接收入口 | +16/-2 |
| `subpkg-share/pages/family-invite/index.wxss` | 家庭邀请样式 | +68 |
| `.hermes/rules/gate-enforcement.md` | Gate规则（元数据） | +46 |
| `inbox/GATE_PASSED.md` | 闸门报告更新 | +14/-8 |
| `inbox/PM_REVIEW_XUANWU_SPRINT3.md` | 玄武PM审查报告（193行） | 新建 |
| `inbox/REVIEW_family_pdf_fix.md` | 需求文档 | 新建 |
| `ledger.jsonl` | 台账追加 | +1 |

---

## 二、逐项修复审查

### 修复1: mergeProgress 补齐全部8关（0cd4e12）

**改动**: `pages/guidebooks/index/index.js` lines 300-305
```javascript
// TC-3.1.1 fix: 补齐全部8关 (空关卡也渲染)
for (var p = 0; p <= 7; p++) {
  if (!phaseMap[p]) {
    phaseMap[p] = { phase: p, name: phaseNames[p] || ('关卡' + p), totalRequired: 0, totalTasks: 0, requiredCompleted: 0, unlocked: true };
  }
}
```

**评估**: ✅ 正确
- 根因诊断准确：phaseMap 仅从 tasks 构建，无任务的关卡被跳过
- 修复方案正确：遍历0~7补齐缺失关卡，默认条目 `totalTasks=0, unlocked=true`
- 与 `data/onboarding-paths.js` 的 `assemblePath` 函数中已存在的 `FULL_PHASES` 对齐，双向一致性保证
- 空关卡 `unlocked: true` 合理——无任务自然无需解锁判定

**无新增问题**。

---

### 修复2: ¥599按钮完全重写（00df063）

**改动**: `components/status-badge/status-badge.js` `confirmPaywall` 函数（lines 115-178）

**旧代码问题**（真机复现）:
- `async confirmPaywall()` — async/await 在部分旧版微信基础库上不支持
- 先 `setData({ showPaywall: false })` 再执行业务逻辑 → 弹窗消失后用户看不到处理中状态
- Promise reject 后的 catch 块中未区分取消和真实错误

**新代码结构**: 回调链（非 async）
```
confirmPaywall → showModal → success回调
  ├─ 取消 → return（弹窗保持）
  └─ 确认 → setData({ showPaywall: false }) → callFunction('payment', 'identityReset')
       └─ .then → requestPayment
            ├─ success → confirmPayment + clearStorages + redirect
            └─ fail → toast（排除取消）
```

**评估**: ⚠️ 部分修复，仍有3个问题

#### P0-1: 支付失败后状态不可恢复
**位置**: `status-badge.js:128`
**问题**: `self.setData({ showPaywall: false })` 在调用 `wx.cloud.callFunction` **之前**执行。如果 callFunction 返回 `code !== 0`（如支付创建失败），paywall 已关闭，用户无法重试——必须刷新页面。
**影响**: 真机上支付创建失败时弹窗消失，用户困惑，无重试入口
**修复建议**: 将 `self.setData({ showPaywall: false })` 移到 `requestPayment` 的 `success` 回调中（即支付真正成功后）

#### P0-2: confirmPayment 失败静默吞噬
**位置**: `status-badge.js:151-155`
```javascript
wx.cloud.callFunction({
  name: 'payment',
  data: { action: 'confirmPayment', orderId: paymentData.orderId }
}).catch(function() {}); // ← 静默吞噬
```
**问题**: 注释说"V3回调可能已处理"，但这假设不可靠。若 V3 回调延迟或失败，服务端订单状态不一致。
**影响**: 用户付了钱但订单可能未标记为已支付，导致后续状态不一致
**修复建议**: 至少 `console.error` 记录失败信息；或改为带重试的确认逻辑

#### P1-1: 缺少支付处理中的 loading 状态
**问题**: 用户确认后 paywall 关闭 → 调用云函数 → 拉起微信支付，中间有1-3秒无反馈
**影响**: 用户体验差，可能以为卡死
**修复建议**: 关闭 paywall 前先 `wx.showLoading({ title: '创建订单中...' })`，在 `requestPayment` 调用前 `wx.hideLoading()`

---

### 修复3: status-badge WXML 无障碍

**改动范围**: status-badge 组件整体（WXML + JS）

**WXML 审查** (`components/status-badge/status-badge.wxml`):
- Line 16: `role="dialog" aria-modal="true"` ✅ 正确
- Line 16: 使用 `bindtap="closePaywall"` 在 overlay 层 → 点击蒙层关闭 ✅
- Lines 26-27: 使用 `catchtap` 阻止事件冒泡 ✅
- Line 16: `aria-label="切换身份状态确认"` 硬编码 ⚠️

**评估**: ⚠️ 基本正确，1个P2问题

#### P2-1: aria-label 与实际 Modal 标题不一致
**WXML** `aria-label="切换身份状态确认"` vs **JS Modal** `title: '确认重置身份状态'`
**影响**: 屏幕阅读器用户听到的与视觉不同
**修复**: 将 aria-label 改为 `{{paywallTitle}}` 并从 JS data 中动态设置

---

### 修复4: assemblePath FULL_PHASES + 流程控 stepId 修复

#### 4a. assemblePath FULL_PHASES（未变更，但架构对齐）

**现状** (`data/onboarding-paths.js:193`):
```javascript
var unlockedPhases = FULL_PHASES; // FULL_PHASES = [0,1,2,3,4,5,6,7]
```
- assemblePath 已正确返回全部8关
- guidebooks rebuildPhases → assemblePath → mergeProgress 链路完整

**评估**: ✅ 数据层已正确实现，本次 mergeProgress fix（修复1）补齐了UI层显示

#### 4b. 流程控 advanceStage stepId 修复（a505b14）

**改动**: `pages/process/index/index.js` lines 157-227

**旧代码问题**: 
- 使用 `phase.steps`（UI层的 phase 对象）访问步骤
- `stepId: step.stepId || step.id` 防御性（ID 字段不统一）
- `stageToUiStage(phase.stageId || phase.id, index)` 传递 index 冗余

**新代码**:
- 从 `app.globalData.activeProcess.stages` 取数据（数据层，字段统一）
- `STAGE_BRIDGE_MAP.ui_to_phase[index]` 将 UI index 映射到 stageId
- `stepId: st.stepId` 直接使用数据层标准字段
- `wx.setStorageSync('__process_stage__', index)` 存储 UI index（不经过 bridge 转换）

**评估**: ✅ 正确，架构改进
- 数据流向清晰：UI index → BRIDGE.ui_to_phase → stageId → process-manager
- 移除了桥接函数的冗余调用
- `__process_stage__` 现在存储纯数字 index（0-6），与 `guide_unlock_thresholds` 的期望一致

#### P2-2: advanceStage 函数过长（~70行）
**问题**: 函数内包含数据获取、校验、步骤收集、循环调用、结果处理，违反 AGENTS.md 50行限制
**影响**: 可维护性
**修复建议**: 拆分为 `_getCurrentStageData(index)` / `_completePendingSteps(...)` / `_handleAdvanceResult(...)`

---

## 三、其他关键改动审查

### 3.1 PDF retry 修复（a505b14）

**改动**: `utils/pdf-generator.js` lines 46-47, 59-63
```diff
-function generateSlotPDF(slotKey, slotName, uploadedDocs) {
+function generateSlotPDF(slotKey, slotName, uploadedDocs, _retryCount) {
+  var retryCount = _retryCount || 0;
   var docCount = (uploadedDocs || []).length;
-  var retryCount = slotKey._pdfRetry || 0;
```

**根因（前序P0持续3轮）**: `slotKey._pdfRetry` — JS 允许在原始值（string）上设属性但该属性不持久，GC后丢失，递归时 retryCount 始终从0开始 → 无限递归风险

**新方案**: 通过函数参数传递 `retryCount`，明确控制在3次上限

**评估**: ✅ P0-03 已修复。移除了3处冗余的 `slotKey._pdfRetry = 0`

**残留问题**:
- **P1-2**: 缓存失效仅比较 docCount 而非内容摘要 — 用户替换相同数量的照片时旧缓存不失效
- **P2-3**: vault 目录 PDF 文件无自动清理机制

### 3.2 反馈字数 2→10（a505b14）

**改动**: `subpkg-feedback/pages/submit/index.js:153` + `index.wxml`

| 位置 | 旧值 | 新值 | 状态 |
|------|------|------|:--:|
| JS: checkCanSubmit | `>= 2` | `>= 10` | ✅ |
| WXML: card-label | `至少2字` | `至少10字` | ✅ |
| WXML: submit-hint | `至少2个字` | `至少10个字` | ✅ |
| WXML: count-hint (line 39) | `至少输入2个字` | **未改** | ❌ |

#### P1-3: 字数提示文案残留
**位置**: `subpkg-feedback/pages/submit/index.wxml:39`
```html
<text class="count-hint" wx:if="{{contentLen > 0 && contentLen < 10}}">至少输入2个字</text>
```
**问题**: 条件已改为 `< 10`，但提示文案仍显示"至少输入2个字"。用户看到红色提示"至少输入2个字"但实际需要10字才能提交
**影响**: P1 — 直接误导用户，UX明显缺陷
**修复**: 将 line 39 改为 `至少输入10个字`

### 3.3 家庭空间邀请（a505b14）

**改动**: `subpkg-share/pages/family-invite/` (index.js +46, wxml +16, wxss +68)

**新增功能**:
- ✅ 创建邀请时输入接收方姓名 → 传给 `family-invite-create` 云函数
- ✅ 手动输入邀请码入口（`accept-entry` 卡片 + `onGoAccept` 跳转）
- ✅ `button open-type="share"` 一键微信分享（`onShareAppMessage`）
- ✅ 权限白名单、角色白名单、自分禁止、防重复加入

**评估**: ⚠️ 功能完整，3个问题

#### P0-3: cloudbaserc.json 缺少4个云函数注册
**已验证**: 根 `cloudbaserc.json` 的 `functions` 数组中注册了19个云函数，但以下4个不存在：

| 云函数 | 目录存在 | cloudbaserc.json | 影响 |
|--------|:---:|:---:|------|
| `family-invite-create` | ✅ | ❌ | 线上部署不会创建此函数 → 邀请创建失败 |
| `family-invite-accept` | ✅ | ❌ | 同上 → 接受邀请失败 |
| `family-space-manage` | ✅ | ❌ | 同上 → 成员管理失败 |
| `generate-pdf` | ✅ | ❌ | 同上 → PDF合成失败 |

**影响**: P0 阻塞 — 线上环境4个功能完全不可用
**修复**: 在 `cloudbaserc.json` 的 `functions` 数组中补入：
```json
{ "name": "family-invite-create", "timeout": 15 },
{ "name": "family-invite-accept", "timeout": 15 },
{ "name": "family-space-manage", "timeout": 15 },
{ "name": "generate-pdf", "timeout": 30 }
```

#### P1-4: WXML 条件恒真
**位置**: `family-invite/index.wxml:212`
```html
<view class="card accept-entry" wx:if="{{hasSpace || !hasSpace}}">
```
`hasSpace || !hasSpace` 恒为 true。代码意图是"始终显示接收入口"，但写法令人困惑
**修复**: 直接移除此 `wx:if` 或改为明确的 `wx:if="{{true}}"` (但建议移除)

#### P2-4: 分享卡片无预览图
**位置**: `family-invite/index.js:321` `imageUrl: ''`
**影响**: 微信聊天中分享卡片仅显示文字，转化率低

#### P2-5: 邀请码格式不友好
使用 `crypto.randomBytes(12).toString('hex')` → 24位纯 hex 字符串。系统内 `invite-code` 云函数已使用 `ZGB-XXXX-XXXX` 分段格式

---

## 四、前序P0追踪

| # | P0 | 状态 | 本轮验证 |
|---|-----|:--:|------|
| P0-A | pdf-generator 栈溢出 | ✅ **已修复** | retryCount 改为参数传递 |
| P0-B | share-create 缺登录校验 | ❌ **未修复** | 不在本轮改动范围，但先前已确认存在 |
| P0-C | cloudbaserc 缺云函数注册 | ❌ **未修复** | 4个函数仍然缺失 |
| P0-D | process/index completeStep async/await | ⚠️ **新发现** | 本轮修复了 advanceStage，但 `completeStep` 仍用 async/await |

---

## 五、P0/P1/P2 汇总

### P0（阻塞发布 — 必须合并前修复）

| # | 模块 | 问题 | 严重性 |
|---|------|------|:--:|
| P0-1 | status-badge | 支付失败后 paywall 已关闭，用户无法重试 | 功能缺陷 |
| P0-2 | status-badge | confirmPayment 失败静默吞噬，订单状态可能不一致 | 数据一致 |
| P0-3 | cloudbaserc | 4个云函数未注册（family-invite-* + family-space-manage + generate-pdf） | 功能不可用 |

### P1（高优先级 — 本Sprint修复）

| # | 模块 | 问题 |
|---|------|------|
| P1-1 | status-badge | 支付处理中无 loading 反馈（1-3秒无反应） |
| P1-2 | PDF | 缓存失效仅比 docCount 而非内容摘要 |
| P1-3 | 反馈 | WXML 字数提示仍显示"至少输入2个字"（实际需10字） |
| P1-4 | 家庭空间 | WXML 条件恒真 `hasSpace \|\| !hasSpace` |
| P1-5 | process/index | onShow setTimeout 调用空函数 `checkDisclaimerNeeded()` |
| P1-6 | process/index | 死代码：7个 data 变量 + 3个方法未清理 |

### P2（建议优化）

| # | 模块 | 问题 |
|---|------|------|
| P2-1 | status-badge | aria-label 硬编码与 Modal 标题不一致 |
| P2-2 | process/index | advanceStage 函数过长（~70行，超过50行限制） |
| P2-3 | PDF | vault 目录 PDF 文件无自动清理 |
| P2-4 | 家庭空间 | 分享卡片无预览图 |
| P2-5 | 家庭空间 | 邀请码格式不友好（24位 hex vs 分段格式） |
| P2-6 | process/index | completeStep 仍用 async/await（与 ¥599 按钮修复方向相反） |

---

## 六、总体评估

| 维度 | 评分 | 说明 |
|------|:--:|------|
| 修复有效性 | ⭐⭐⭐⭐ | 4项修复中 mergeProgress/PF retry/流程控stepId 3项完全正确 |
| 代码质量 | ⭐⭐⭐ | ¥599按钮重写引入2个P0；反馈字数残留1个P1 |
| 部署就绪 | ⭐⭐ | P0-3: 4个云函数未注册 → 线上功能不可用 |
| 文件合规 | ⭐⭐⭐ | commit粒度合理，无临时文件，无硬编码密钥 |

**结论**: 3个P0必须在合并前修复。P0-3（cloudbaserc注册）是最紧急的阻塞项。¥599按钮重写在解决async兼容问题的同时引入了状态管理缺陷，需要二次修正。

---

*审查标准: AGENTS.md / 微信小程序真机规范 / ECC编码标准*
