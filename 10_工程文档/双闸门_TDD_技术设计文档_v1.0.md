# 双闸门方案 — 技术设计文档 (TDD) & 任务拆解

> 2026-05-21 | 对齐产品方案 v2.1 终稿 | V4 开发基线

---

# 第一部分：架构设计

## 一、技术栈

| 层 | 技术 | 版本/说明 |
|----|------|----------|
| 运行时 | 微信小程序原生 | 基础库 ≥ 2.25.0 |
| 云服务 | 腾讯 CloudBase | 云函数 + 数据库 + 认证 |
| 登录认证 | `wx.login` + `user-auth` 云函数 | 现有，无变更 |
| 测试 | Jest 29 | 现有 14 suites, 369 tests |
| 组件 | 原生自定义组件 | 无第三方 UI 库依赖 |

**本次不新增依赖**，全部基于现有技术栈。

---

## 二、系统架构

```
                        ┌─────────────────────────┐
                        │     app.globalData       │
                        │  isLoggedIn  userStatus  │
                        │  selectedPath  ...       │
                        └───────────┬─────────────┘
                                    │ 只读
              ┌─────────────────────┼─────────────────────┐
              │                     ▼                     │
              │         utils/decision-gate.js            │
              │         canMakeDecision()                 │
              │         → { ok, reason }                  │
              └────────┬───────────────┬──────────────────┘
                       │               │
               ok=true │               │ ok=false
                       ▼               ▼
              ┌────────────┐   ┌──────────────────────┐
              │ 正常执行    │   │  gate-sheet 组件      │
              │ 原有逻辑    │   │  (process/path-select)│
              └────────────┘   │  mode: login|identity │
                               │  ┌─────────────────┐  │
                               │  │ login 模式       │  │
                               │  │ wx.login →       │  │
                               │  │ user-auth CF →   │  │
                               │  │ saveSession →    │  │
                               │  │ check gate2      │  │
                               │  └────────┬────────┘  │
                               │           │            │
                               │  gate2 fail → switch   │
                               │  to identity mode      │
                               │  ┌─────────────────┐  │
                               │  │ identity 模式     │  │
                               │  │ navigateTo       │  │
                               │  │ status-select →  │  │
                               │  │ pageLifetimes    │  │
                               │  │ .show 重检闸门   │  │
                               │  └────────┬────────┘  │
                               │           │            │
                               │      gate-passed       │
                               │      → onGatePassed()  │
                               │      → 重新执行原入口   │
                               └──────────────────────┘

  ┌─────────────────────────────────────────────────────┐
  │  Toast 模式（轻量，用于子包和组件）                    │
  │  assessment-result  ──┐                             │
  │  floating-ai         ──┤─ canMakeDecision()          │
  │                       │  → fail → wx.showToast()     │
  │                       │  → pass → 正常执行            │
  └───────────────────────┴─────────────────────────────┘
```

---

## 三、组件架构 — gate-sheet

### 3.1 组件树

```
components/gate-sheet/
├── gate-sheet.js    ← 逻辑层
├── gate-sheet.json  ← { "component": true, "usingComponents": {} }
├── gate-sheet.wxml  ← 模板层
└── gate-sheet.wxss  ← 样式层
```

### 3.2 组件接口定义（API Contract）

**属性 (Properties):**

```typescript
interface GateSheetProperties {
  show: boolean;        // 是否显示半屏
  mode: 'login' | 'identity';  // 引导模式
  pathLabel?: string;   // 路径名称，用于 login 模式文案
}
```

**事件 (Events):**

```typescript
interface GateSheetEvents {
  'gate-passed': () => void;  // 闸门通过，调用方执行原逻辑
  'dismiss': () => void;      // 用户关闭，调用方清理状态
}
```

**内部方法 (Methods):**

| 方法 | 触发 | 行为 |
|------|------|------|
| `handleLogin()` | login 模式按钮点击 | `wx.login` → `user-auth` CF → `saveSession` → 检测闸门2 → 通过则 `gate-passed`，否则切换 `mode='identity'` |
| `handleGoIdentity()` | identity 模式按钮点击 | `wx.navigateTo('/pages/status-select/status-select')` |
| `handleDismiss()` | 关闭按钮点击 | `triggerEvent('dismiss')` |
| `_recheckGate()` | `pageLifetimes.show` | 从 status-select 返回后重检 `canMakeDecision()`，通过则 `gate-passed` |

**状态机:**

```
  [hidden] ──show=true──▶ [login mode]
                              │ handleLogin()
                              │ 成功 + gate2 pass
                              ▼
                         [gate-passed 事件]
                              
                              │ handleLogin()
                              │ 成功 + gate2 fail
                              ▼
                         [identity mode]
                              │ handleGoIdentity()
                              │ → navigateTo status-select
                              │ → 返回后 _recheckGate()
                              │   pass → [gate-passed 事件]
                              │   fail → [identity mode] 保持
                              
  [任意 mode] ──handleDismiss()──▶ [dismiss 事件] → [hidden]
```

---

## 四、数据模型

### 4.1 读取的 Storage 键（只读）

| 键 | 类型 | 来源 | 用途 |
|----|------|------|------|
| `__session__` | Object | `app.saveSession()` | `isLoggedIn` 判定（读 `.token` 字段） |
| `__user_status__` | String | `status-select/saveStatus()` | `userStatus` 兜底值 |

### 4.2 读取的 globalData 字段（只读）

| 字段 | 类型 | 来源 | 用途 |
|------|------|------|------|
| `isLoggedIn` | Boolean | `app.saveSession()` / `login.js` | 闸门1 |
| `userStatus` | String | `status-select/saveStatus()` | 闸门2 主值 |

### 4.3 写入的 Storage 键（gate-sheet login 模式）

| 键 | 操作 | 说明 |
|----|------|------|
| `__session__` | 写入 | `app.saveSession()` → 持久化 token+userInfo+userStatus |
| `user_data` | 写入 | 兼容旧版登录读取路径 |
| `__user_profile__` | 写入 | 兼容旧版 profile 读取 |

### 4.4 不写入的键（零副作用保证）

`canMakeDecision()` 和闸门阻断路径**不写入**以下任何键：
- `__active_process_id__`
- `__selected_path__`
- `__process_stage__`
- `__process_data_version__`
- `__milestone_events__`
- `__user_status__`

---

## 五、API 接口定义

### 5.1 `utils/decision-gate.js`

```typescript
/**
 * 双闸门决策判定
 * @returns { ok: boolean, reason: 'login' | 'identity' | null }
 *   - { ok: true }  → 允许执行决策
 *   - { ok: false, reason: 'login' }    → 需登录
 *   - { ok: false, reason: 'identity' } → 需确认身份状态
 */
function canMakeDecision(): GateResult;

interface GateResult {
  ok: boolean;
  reason: 'login' | 'identity' | null;
}
```

**内部常量：**

```javascript
var VALID_STATUSES = ['unapplied', 'submitted', 'approved', 'permanent'];
```

**判定逻辑伪代码：**

```
function canMakeDecision():
  app = getApp()
  if not (app?.globalData?.isLoggedIn):
    return { ok: false, reason: 'login' }
  
  us = app.globalData.userStatus 
    || wx.getStorageSync('__user_status__') 
    || ''
  
  if us is empty or us == 'skipped':
    return { ok: false, reason: 'identity' }
  
  return { ok: true }
```

### 5.2 gate-sheet 调用方集成接口

各页面对 `gate-sheet` 组件的集成遵循统一模式：

```
Page/Component 侧新增 data:
  showGateSheet: Boolean = false
  gateMode: String = ''
  pendingPathId: String = ''
  pendingPathLabel: String = ''

Page/Component 侧新增方法:
  onGatePassed(): void      // 闸门通过 → 清除 pending 状态 → 重新触发原入口
  onGateDismiss(): void     // 用户关闭 → 清除 pending 状态

每个决策入口函数体第一行:
  gate = canMakeDecision()
  if !gate.ok:
    this.setData({ showGateSheet: true, gateMode: gate.reason, pendingPathId: id, pendingPathLabel: label })
    return
```

---

# 第二部分：任务拆解

## 六、Story Points 基准

| SP | 含义 | 典型任务 |
|:--:|------|---------|
| 1 | 纯配置文件修改 | 注册组件、更新 json |
| 2 | 单文件小改动（<20行） | 加一行闸门检查 + Toast |
| 3 | 单文件中等改动（20-60行） | 入口加闸门 + 回调 + data 字段 |
| 5 | 新建文件或多文件联动 | 新建组件、WXML 结构调整 |
| 8 | 复杂组件或跨模块改动 | gate-sheet 全套（4文件）或路径卡片双层交互 |

---

## 七、Phase 1 — 闸门引擎 & 5 入口门禁（P0，8 任务，20 SP）

### T-001：新建 decision-gate 模块 [SP:3]

| 项 | 内容 |
|----|------|
| 文件 | `utils/decision-gate.js` (新建) |
| 描述 | 实现 `canMakeDecision()` 函数，读 `globalData.isLoggedIn` + `globalData.userStatus`，兜底读 `Storage.__user_status__`，返回 `{ok, reason}` |
| 验收 | Jest 单元测试覆盖 8 种状态组合，全部通过 |
| 依赖 | 无 |
| 备注 | 内部常量 `VALID_STATUSES = ['unapplied','submitted','approved','permanent']`；不检查 `isLocked`（见 PD 决策）；异常 Storage 值降级为 `reason:'identity'` |

### T-002：process/onSelectDirectPath 闸门 [SP:3]

| 项 | 内容 |
|----|------|
| 文件 | `pages/process/index/index.js` (修改) |
| 描述 | `onSelectDirectPath` 函数体第一行插入 `canMakeDecision()` 检查；失败时 setData `{showGateSheet, gateMode, pendingPathId, pendingPathLabel}` 并 return |
| 验收 | 未登录/skipped 用户点击路径卡片 → Sheet 弹出，流程线未创建 |
| 依赖 | T-001 |

### T-003：process/selectTemplate 闸门 [SP:3]

| 项 | 内容 |
|----|------|
| 文件 | `pages/process/index/index.js` (修改) |
| 描述 | `selectTemplate` 函数体第一行插入 `canMakeDecision()` 检查；阻断时不覆写 `userStatus`；gate-passed 回调恢复模板面板 |
| 验收 | skipped 用户选模板 → 闸门阻断，`userStatus` 仍为 `'skipped'`；gate-passed 后模板面板可重新打开 |
| 依赖 | T-001 |
| 备注 | 本任务额外处理 `pendingTemplateId` 标志位以支持 gate-passed 恢复 |

### T-004：process 页面 data 字段 & 回调方法 [SP:2]

| 项 | 内容 |
|----|------|
| 文件 | `pages/process/index/index.js` (修改) |
| 描述 | data 增加 `showGateSheet/gateMode/pendingPathId/pendingPathLabel/pendingTemplateId`；新增 `onGatePassed()` 和 `onGateDismiss()` 方法 |
| 验收 | gate-passed 事件触发后 pendingPathId 被清除，原入口被重调 |
| 依赖 | T-002, T-003 |

### T-005：path-select/onSelect 闸门 [SP:3]

| 项 | 内容 |
|----|------|
| 文件 | `pages/path-select/index.js` (修改) |
| 描述 | `onSelect` 函数体第一行插入 `canMakeDecision()` 检查；失败时 setData 打开 Sheet；新增 `onGatePassed`/`onGateDismiss` 回调 + data 字段 |
| 验收 | 未登录/skipped 用户在 path-select 页面选路径 → Sheet 弹出 |
| 依赖 | T-001 |

### T-006：assessment-result 闸门 [SP:2]

| 项 | 内容 |
|----|------|
| 文件 | `subpkg-low/pages/assessment-result/index.js` (修改) |
| 描述 | `app.globalData.selectedPath = path` 之前插入 `canMakeDecision()`；失败时 `wx.showToast({title:'请先登录'/ '请先确认身份状态', icon:'none'})` 并 return |
| 验收 | 未登录/skipped 用户评估后无法设置 selectedPath，Toast 提示正确 |
| 依赖 | T-001 |
| 备注 | Toast 模式，子包不能使用主包 gate-sheet 组件 |

### T-007：floating-ai 闸门 [SP:2]

| 项 | 内容 |
|----|------|
| 文件 | `components/floating-ai/floating-ai.js` (修改) |
| 描述 | `selectPathFromChat` 函数体第一行插入 `canMakeDecision()`；失败时 Toast 引导文案（未登录：`登录后可保存路径选择`，skipped：`请先在「我的」补选身份状态后选择路径`）并 return |
| 验收 | 未登录/skipped 用户采纳 AI 推荐路径 → Toast 提示，selectedPath 未被写入 |
| 依赖 | T-001 |
| 备注 | Toast 模式，组件内无法嵌套 Sheet |

### T-008：Phase 1 Jest 测试 [SP:2]

| 项 | 内容 |
|----|------|
| 文件 | `__tests__/decision-gate.test.js` (新建) |
| 描述 | 覆盖 canMakeDecision() 的 8 种状态组合 + Storage 损坏容错 4 种异常值；mock `getApp().globalData` 和 `wx.getStorageSync` |
| 验收 | 新增测试全部通过，全量 Jest 保持 365+ pass |
| 依赖 | T-001 |

---

## 八、Phase 2 — gate-sheet 组件 & skip-banner 移除（P1，5 任务，14 SP）

### T-009：gate-sheet 组件新建 [SP:8]

| 项 | 内容 |
|----|------|
| 文件 | `components/gate-sheet/gate-sheet.{js,wxml,wxss,json}` (4 文件新建) |
| 描述 | 实现双模式半屏组件。properties: `show/mode/pathLabel`。events: `gate-passed/dismiss`。login 模式含完整登录链路。identity 模式含 status-select 跳转+返回重检。附 8 秒超时保护 |
| 验收 | 组件独立可用，login 模式完成登录+saveSession，identity 模式跳转+返回重检 |
| 依赖 | T-001 |
| 备注 | 这是 Phase 2 的核心任务，也是整体架构中代码量最大的单任务 |

### T-010：process 页面集成 gate-sheet [SP:2]

| 项 | 内容 |
|----|------|
| 文件 | `pages/process/index/index.json` + `index.wxml` (修改) |
| 描述 | json 注册 `"gate-sheet": "/components/gate-sheet/gate-sheet"`；wxml 末尾插入 `<gate-sheet show="{{showGateSheet}}" mode="{{gateMode}}" pathLabel="{{pendingPathLabel}}" bind:gate-passed="onGatePassed" bind:dismiss="onGateDismiss"/>`；删除 skip-banner 代码块 (line 25-32) |
| 验收 | Sheet 可正常弹出/关闭；skip-banner 不渲染 |
| 依赖 | T-009, T-004 |

### T-011：path-select 页面集成 gate-sheet [SP:2]

| 项 | 内容 |
|----|------|
| 文件 | `pages/path-select/index.json` + `index.wxml` (修改) |
| 描述 | 同 T-010，json 注册 + wxml 插入 gate-sheet 标签 |
| 验收 | Sheet 可正常弹出/关闭 |
| 依赖 | T-009, T-005 |

### T-012：documents 页面删除 skip-banner [SP:1]

| 项 | 内容 |
|----|------|
| 文件 | `pages/documents/index/index.wxml` (修改) |
| 描述 | 删除 `skip-banner` 代码块 (line 22-25)。保留 `goSelectIdentity()` 方法不删除（供旧首页引用） |
| 验收 | skipped 用户进入证件夹 → 无 skip-banner 横幅 |
| 依赖 | 无 |

### T-013：Phase 2 Jest 测试 [SP:1]

| 项 | 内容 |
|----|------|
| 文件 | `__tests__/gate-sheet.test.js` (新建) |
| 描述 | 组件单元测试：模拟 login 模式渲染 + identity 模式渲染 + dismiss 事件触发 |
| 验收 | 新增测试通过 |
| 依赖 | T-009 |

---

## 九、Phase 3 — 路径卡片双层交互（P1，2 任务，7 SP）

### T-014：路径卡片展开/收起逻辑 [SP:3]

| 项 | 内容 |
|----|------|
| 文件 | `pages/process/index/index.js` (修改) |
| 描述 | data 新增 `expandedPathId: ''`；新增 `togglePathExpand(e)` 方法，点击卡片切换展开/收起；展开后显示路径简介（name/cycle/riskLevel/desc）和「选择此路径」按钮 |
| 验收 | 点击卡片展开详情（无需登录）；再次点击收起；展开的卡片有「选择此路径」按钮 |
| 依赖 | T-002, T-004 |

### T-015：路径卡片 WXML 结构改造 [SP:4]

| 项 | 内容 |
|----|------|
| 文件 | `pages/process/index/index.wxml` (修改) |
| 描述 | 改造 `direct-path-picker` 内的 `picker-item`：卡片主体 `bindtap="togglePathExpand"`；展开区 `wx:if="{{expandedPathId===item.id}}"` 显示简介+「选择此路径」按钮 `bindtap="onSelectDirectPath"` |
| 验收 | 卡片外观不变；展开区内容完整；按钮绑定正确；已登录用户点击按钮正常创建流程 |
| 依赖 | T-014, T-010 |

---

## 十、Phase 4 — 访客引导按钮（P2，2 任务，4 SP）

### T-016：证件夹底部引导按钮 [SP:2]

| 项 | 内容 |
|----|------|
| 文件 | `pages/documents/index/index.wxml` (修改) |
| 描述 | 访客态（`!isLoggedIn` 且空状态）底部增加 `「登录后开始管理证件」` 按钮，`bindtap="goLogin"` 跳转登录页 |
| 验收 | 访客看到引导按钮；已登录用户看不到 |
| 依赖 | 无 |

### T-017：提醒器底部引导按钮 [SP:2]

| 项 | 内容 |
|----|------|
| 文件 | `pages/reminders/index/index.wxml` (修改) |
| 描述 | 访客态（`!isLoggedIn` 且空状态）底部增加 `「登录后自动生成提醒」` 按钮，`bindtap="goLogin"` 跳转登录页 |
| 验收 | 访客看到引导按钮；已登录用户看不到 |
| 依赖 | 无 |

---

## 十一、Phase 5 — AI & status-badge 优化（P2，2 任务，4 SP）

### T-018：AI Chat 第3条消息引导 [SP:2]

| 项 | 内容 |
|----|------|
| 文件 | `subpkg-chat/pages/chat/index.js` (修改) |
| 描述 | 在 AI 回复逻辑中，若用户未登录且消息数 ≥ 3，回复末尾追加 `\n\n💡 登录后可保存对话记录，享受个性化路径推荐` |
| 验收 | 第3条消息后回复包含引导文案；第1-2条不含；已登录用户不含 |
| 依赖 | 无 |

### T-019：status-badge skipped 状态路径标签优化 [SP:2]

| 项 | 内容 |
|----|------|
| 文件 | `components/status-badge/status-badge.js` (修改) |
| 描述 | `onTapPath()` 中增加判断：若 `userStatus === 'skipped'`，不跳转 path-select，改为 `wx.navigateTo('/pages/status-select/status-select')` |
| 验收 | skipped 用户点击路径标签 → 跳转身份选择页而非路径选择页；非 skipped 用户行为不变 |
| 依赖 | 无 |

---

## 十二、依赖图

```
Phase 1 ────────────────────────────────────────┐
  T-001 (decision-gate)                         │
    ├── T-002 (onSelectDirectPath)              │
    ├── T-003 (selectTemplate)                  │
    ├── T-005 (path-select)                     │
    ├── T-006 (assessment-result)               │
    ├── T-007 (floating-ai)                     │
    └── T-008 (Jest)                            │
  T-004 (process callbacks) ← depends T-002,003 │
                                                 │
Phase 2 ────────────────────────────────────────┤
  T-009 (gate-sheet) ← depends T-001            │
    ├── T-010 (process integration) ← T-004,009 │
    ├── T-011 (path-select integration) ← T-005,009 │
    └── T-013 (Jest) ← T-009                   │
  T-012 (documents skip-banner) 独立             │
                                                 │
Phase 3 ────────────────────────────────────────┤
  T-014 (expandedPathId logic) ← T-002,004      │
  T-015 (WXML restructure) ← T-014,010          │
                                                 │
Phase 4 ────────────────────────────────────────┘
  T-016 (documents guide button)  独立
  T-017 (reminders guide button)  独立

Phase 5 ────────────────────────────────────────
  T-018 (AI chat guide)  独立
  T-019 (status-badge)   独立
```

**关键依赖标注：Phase 1 和 Phase 2 必须连续完成。** Phase 1 的 T-002/003/004/005 在代码中引用了 `showGateSheet` / `gateMode` / `gate-sheet` 组件，但这些 UI 元素在 Phase 2 才被创建。若 Phase 1 独立部署 → 运行时组件未注册错误。**建议 Phase 1+2 作为一个 Milestone 合并测试。**

---

## 十三、工时汇总

| Phase | 任务数 | SP 合计 | 预估人天 (1SP≈0.5d) |
|-------|:-----:|:------:|:-----------------:|
| Phase 1 | 8 | 20 | 10 |
| Phase 2 | 5 | 14 | 7 |
| Phase 3 | 2 | 7 | 3.5 |
| Phase 4 | 2 | 4 | 2 |
| Phase 5 | 2 | 4 | 2 |
| **合计** | **19** | **49** | **24.5** |

含测试和联调 buffer（×1.3），总估算 **32 人天**，约 **6-7 个工作日**（单人全职）。

---

## 十四、里程碑

| Milestone | Phase | 交付标准 |
|-----------|:-----:|---------|
| M1 — 核心闸门 | 1+2 | 5 个入口全部被闸门保护；gate-sheet 组件可用；验收标准 F01-F06 通过 |
| M2 — 体验优化 | 3 | 路径卡片可展开查看详情；已登录用户体验零回归 |
| M3 — 引导闭环 | 4+5 | 访客在各 Tab 有明确登录引导；skipped 用户不被卡死路径 |
| M4 — 发布就绪 | 全量 | 18 条验收不通过标准全部通过；Jest 365+ pass；真机 5 场景走通 |
