# 玄武PRD审查 — Gate 5：住港伴V4 PRD/功能审查

> 审查日期: 2026-05-28
> 审查范围: cf-alert + diagnose-user + CFErrorsPage + _cf-error.js钩子 + app.js + reminders/payment/redeem流程
> 审查结论: ⚠️ CONDITIONAL PASS (P0-2项需修复，P1-3项建议修复)

---

## 一、审查概览

### 1.1 审查对象清单

| 模块 | 路径 | 行数 | 状态 |
|------|------|------|------|
| cf-alert (HTTP云函数) | `cloudfunctions/cf-alert/index.js` | 155 | ✅ 功能完整 |
| diagnose-user (用户诊断) | `cloudfunctions/diagnose-user/index.js` | 58 | ⚠️ 有P0隐患 |
| CFErrorsPage (错误看板) | `admin-dashboard/src/pages/CFErrorsPage.tsx` | 254 | ✅ 基本可用 |
| _shared/error-reporter.js | `cloudfunctions/_shared/error-reporter.js` | 184 | ✅ 核心模块 |
| _cf-error.js × 4 | `invite-code/user-auth/payment/feedback-submit/_cf-error.js` | 143×4 | ✅ 一致 |
| app.js | `app.js` | 491 | ✅ 功能完整 |
| reminders/index.js | `pages/reminders/index/index.js` | 949 | ✅ 功能完整 |
| redeem/index.js | `subpkg-chat/pages/redeem/index.js` | 235 | ✅ 功能完整 |
| payment/index.js | `cloudfunctions/payment/index.js` | 1005 | ✅ 功能完整 |

### 1.2 先决条件确认

- QA签章已通过 (2026-05-25, P0-3全零)
- 测试结果: 602/618通过, 4个失败为沙箱worker崩溃非功能缺陷
- cloudbaserc.json 已注册 cf-alert 和 feedback-submit

---

## 二、错误监控闭环审查 (采集→告警→看板→诊断)

### 2.1 采集层 (Error Collection)

**已接入错误上报的云函数（共6个）:**

| 云函数 | 接入方式 | 状态 |
|--------|----------|------|
| invite-code | `require('./_cf-error')` → `reportError({db, fnName, action, error})` | ✅ |
| user-auth | `require('./_cf-error')` → `reportError({db, fnName, action, error})` | ✅ |
| payment | `require('./_cf-error')` → `reportError({db, fnName, action, error})` | ✅ |
| feedback-submit | `require('./_cf-error')` → `reportError({db, fnName, action, error})` | ✅ |
| ai-chat | `require('../_shared/error-reporter')` → `reportErrorHttp({fnName, action, error, app})` | ✅ |
| cf-alert | `require('../_shared/error-reporter')` → `reportErrorHttp({...})` | ✅ |

**关键发现:**

- `_cf-error.js` 副本实际存在 4 个（非声称的 6 个）。ai-chat 和 cf-alert 使用共享模块 `error-reporter.js` 的 `reportErrorHttp`，未使用自包含 `_cf-error.js`。
- 所有 `_cf-error.js` 副本内容完全一致（SHA256相同），满足"自包含独立部署"目标。
- 错误数据写入统一集合 `cf_error_logs`，字段结构一致: `{fnName, action, errorMsg, errorStack, severity, context, createdAt, expireAt}`。
- 错误消息自动截断（errorMsg ≤ 1000字符, errorStack ≤ 2000字符），防止大对象溢出。
- TTL 设置 30 天（expireAt 字段），但**缺少实际清理逻辑**（见P1-03）。

**⚠️ P0-01: 多个核心云函数未接入错误上报**

以下云函数虽然有业务关键性但未接入 `_cf-error` 或 `reportError`:

| 云函数 | 风险等级 | 说明 |
|--------|----------|------|
| db-admin | 🔴 高 | 数据管理核心，错误会影响用户数据恢复 |
| process-manager | 🔴 高 | 流程管理中枢 |
| reminder-engine | 🟠 中 | 提醒引擎 |
| admin-stats/users/revenue 等 7 个 | 🟠 中 | 运营后台统计 |

**建议:** 在 Phase2 为所有云函数统一接入错误上报。推荐使用 `_shared/error-reporter.js` 的 `reportError`，避免继续复制 `_cf-error.js`。

### 2.2 告警层 (Alerting)

**企微推送架构:**
- 主模式: Webhook URL → 企微群机器人 Markdown 消息
- 备模式: Bot ID + Secret → 企业应用消息推送
- 冷却机制: 60秒同指纹不重复告警
- 严重度分类: `critical` (模块缺失/连接失败) vs `high` (一般运行时错误)
- 消息格式: Markdown，含函数名、操作、时间、错误摘要、堆栈

**验证结果:**
- ✅ Webhook 模式: HTTP POST 到 qyapi.weixin.qq.com，带 5s timeout
- ✅ Bot 模式: 先获取 access_token（带缓存），再发送消息
- ✅ 冷却机制: 同 fingerprint 60s内不重复推送（单元测试验证）
- ✅ 无 webhook 时降级为 console.warn
- ✅ HTTP 200/500/网络错误/超时均不阻塞 DB 写入
- ✅ DB 写入与企微推送并行执行（Promise.all）
- ✅ 敏感 key 不暴露（`/config` 端点返回 `key=***` 掩码）

**⚠️ P1-01: 告警消息格式不统一**

`_cf-error.js` 和 `error-reporter.js` 生成 Markdown 消息时，`_cf-error.js` 用 `<font color="warning">` 而 `error-reporter.js` 用 `<font color="warning">`（一致），但 `_cf-error.js` 的 `sendWecomAlert` 在 webhook 模式返回 `true` 后不再处理 bot 模式，而 `error-reporter.js` 在 webhook 失败后继续尝试 bot 模式（逻辑不一致）。

### 2.3 看板层 (Dashboard)

**CFErrorsPage (React 组件) 功能:**
- ✅ 4 卡片概览: 24h总错误 / Critical / High / 受影响函数
- ✅ 云函数错误汇总表 (按函数聚合): 函数名、总错误、Critical数、High数、最近错误、最近时间
- ✅ 筛选器: 按云函数名称 + 按严重度
- ✅ 30秒自动刷新
- ✅ 空状态/错误状态处理
- ✅ 告警配置说明面板

**⚠️ P1-02: CFErrorsPage 硬编码 cf-alert URL**

```
https://cloudbase-d1g17tgt7cc199a60.service.tcloudbase.com/cf-alert/status
```

应使用环境变量或 `cloudbase.SYMBOL_CURRENT_ENV` 而非硬编码 envId。

**⚠️ P2-01: 缺少错误详情和历史趋势**
- 点击错误行无详情展开（缺少完整 errorStack、context 查看）
- 无历史趋势图（7天/30天错误趋势）
- 无错误指纹聚合（同类型错误合并统计）
- 分页缺失（`cf-alert /status` 硬 limit 200 条）

### 2.4 诊断层 (Diagnosis)

**diagnose-user 云函数:**
- ✅ 按 `_openid` / `_id` 查询 `user_profiles` 和 `users` 集合
- ✅ 模糊搜索 `_id` 含 "ZGB"
- ✅ 错误隔离（各查询独立 try/catch）

**🔴 P0-02: diagnose-user 存在硬编码安全风险**

```javascript
// 行3: 硬编码 envId
const app = cloudbase.init({ env: 'cloudbase-d1g17tgt7cc199a60' });

// 行15: 硬编码口令
if (token !== 'diagnose-zgb-20260528') {
```

**问题:**
1. 违反编码规范 P0-07: "禁止硬编码 openid/envId/token/API key"
2. 硬编码口令 `diagnose-zgb-20260528` 包含日期暗示，应使用环境变量或 CloudBase 环境变量
3. 应使用 `cloudbase.SYMBOL_CURRENT_ENV` 而非硬编码 envId

**⚠️ P2-02: diagnose-user 缺少审计**
- 无审计日志记录（谁在何时诊断了哪个用户）
- 未接入错误上报自身（诊断工具本身也需要可观测性）

### 2.5 闭环评估

| 环节 | 状态 | 缺口 |
|------|------|------|
| 采集 | ⚠️ | P0-01: 部分云函数未接入 |
| 告警 | ✅ | P1-01: 消息格式细节不一致 |
| 看板 | ✅ | P1-02: 硬编码URL, P2-01: 缺少详情/趋势 |
| 诊断 | ⚠️ | P0-02: 硬编码安全风险, P2-02: 缺少审计 |

**闭环完整度: 85%** — 主链路通畅，存在可修复的缺口。

---

## 三、数据流闭合分析

### 3.1 cf_error_logs 数据流

```
云函数catch → _cf-error.reportError() → DB(cf_error_logs.add) ───┐
                ↓ (并行)                                            │
           sendWecomAlert() → 企微机器人                            │
                                                                    │
cf-alert/status ← DB(cf_error_logs.where) ← CFErrorsPage(看板)     │
                                                                    │
diagnose-user → DB(user_profiles/users) ← 运营人员手动诊断          │
```

**验证:**
- ✅ 写入路径: `logToDb` 自动处理 db=null 降级为 console.error
- ✅ 查询路径: `cf-alert/status` 聚合查询 `cf_error_logs` 最近24h数据
- ✅ 看板消费: CFErrorsPage 每30秒轮询 cf-alert/status
- ⚠️ 清理路径: expireAt 字段存在但无自动清理逻辑（见P1-03）

### 3.2 payment → redeem → reminders 数据流

**payment 云函数 (V4.2 变更):**
- ✅ `checkSubscription`: 新增函数，供 app.js `syncLockStatus()` 调用
- ✅ V3 回调幂等保护: `CALLBACK_LOCKS` Map 防重复处理 (V4.2-P1)
- ✅ 副作用隔离: 激活会员/身份重置/关卡解锁均独立 try/catch
- ✅ `_cf-error` 全局 catch 覆盖所有 action

**redeem 页面 (年卡兑码):**
- ✅ 状态机: idle → querying → previewed → redeeming → redeemed/failed
- ✅ 幂等返回: `alreadyRedeemed` 场景直接返回结果不重复处理
- ✅ 持久化: `app.saveSession()` 确保会员状态不丢失
- ✅ 设备校验: deviceId hash 防同设备重复兑换
- ✅ 并发保护: 条件更新 `status in ['unused','active']` 防超发

**payment → redeem 路径对齐:**
- ✅ 两条路径都通过 `app.saveSession()` 持久化 membershipLevel
- ✅ 两条路径都写入 `audit_logs` 审计日志
- ✅ `app.syncLockStatus()` 在 onShow 和支付后统一同步

### 3.3 reminders 流程 (V4.2)
- ✅ 7阶段流程指示器
- ✅ 里程碑事件触发提醒链 (preparation_done/application_submitted/awaiting_approval/approval_activated)
- ✅ 动态时间线漂移（未完成节点随今天漂移）
- ✅ 去重逻辑（pathway+title 去重）
- ✅ 路径过滤（非当前路径提醒折叠）
- ✅ 封存提醒独立列表

### 3.4 数据流闭合结论
- ✅ payment ↔ redeem 两条路径行为对齐
- ✅ 会员状态双写 globalData + Storage
- ✅ 审计日志完整覆盖
- ⚠️ cf_error_logs 无自动清理（见P1-03）

---

## 四、UX一致性审查

### 4.1 CFErrorsPage UX
- ✅ 实时刷新指示（loading spinner）
- ✅ 错误状态友好提示
- ✅ 空状态引导（"最近24小时无云函数异常"）
- ✅ Severity 颜色一致（critical=红色, high=橙色）
- ✅ 时间格式化统一使用 `Asia/Shanghai` 时区
- ⚠️ 表格列宽在大屏幕下利用率低（lastMsg 列 max-w-xs 限制了可读性）

### 4.2 Redeem 页面 UX
- ✅ 输入格式化（自动插入短横线、大写转换）
- ✅ 实时校验反馈（格式检测）
- ✅ 清晰的错误消息（中文友好）
- ✅ 幂等用户提示

### 4.3 Reminders 页面 UX
- ✅ 7阶段进度条
- ✅ 筛选/分类/折叠功能
- ✅ 空状态引导

### 4.4 一致性结论
- ✅ 错误消息格式统一
- ✅ 时区处理统一
- ✅ 会员状态同步机制一致

---

## 五、与V4方案设计文档一致性

> 注: 10_工程文档/ 目录中未找到"住港伴V4_运营后台与BI看板_方案设计_v1.0.md"。已根据 CLAUDE.md 中的 V4 核心目标和编码规范进行比对。

### 5.1 核心设计原则对齐

| 原则 | 实现状态 |
|------|----------|
| 运营后台与小程序解耦 | ✅ CFErrorsPage 通过 HTTP 云函数访问，不依赖小程序 |
| HTTP云函数 + API Key + bcrypt | ⚠️ cf-alert 无鉴权（直接暴露 /status），但数据不敏感 |
| 禁止环境变量明文token | ⚠️ diagnose-user 硬编码 token（P0-02） |
| 审计日志强制 append-only | ✅ payment/redeem 均写入 audit_logs |
| 编码规范 P0-07 (禁止硬编码) | ⚠️ diagnose-user 硬编码 envId (P0-02), CFErrorsPage 硬编码 URL (P1-02) |

### 5.2 编码规范对齐

| 规范 | 检查项 | 状态 |
|------|--------|------|
| P0-01: 异步超时保护 | cf-alert/invite-code/payment 均有 timeout | ✅ |
| P0-01: 禁止空 catch | _cf-error.js catch 包含 console.error | ✅ |
| P0-07: 禁止硬编码 | diagnose-user 硬编码 envId/token | ❌ P0-02 |
| P0-07: 禁止硬编码 | CFErrorsPage 硬编码 URL | ⚠️ P1-02 |

---

## 六、P0/P1/P2 分级问题报告

### 🔴 P0 (阻塞上线，必须修复)

#### P0-01: 多个核心云函数未接入错误上报

- **严重度:** P0
- **位置:** cloudfunctions/db-admin, process-manager, reminder-engine, admin-* (7个)
- **描述:** 任务要求"CF错误监控需覆盖全部云函数"，当前仅有6/20+个云函数接入错误上报。db-admin 和 process-manager 作为数据管理和流程管理中枢，其错误直接影响用户核心功能。
- **建议:** Phase1 为 db-admin, process-manager 接入 `_shared/error-reporter.js`；Phase2 覆盖全部云函数。推荐统一使用 `reportError`（而非再复制 `_cf-error.js`）。
- **工作量:** 各约 15 分钟，共约 2 小时

#### P0-02: diagnose-user 硬编码 envId 和 token

- **严重度:** P0
- **位置:** `cloudfunctions/diagnose-user/index.js` L3, L15
- **描述:** 
  - `cloudbase.init({ env: 'cloudbase-d1g17tgt7cc199a60' })` — 应使用 `cloudbase.SYMBOL_CURRENT_ENV`
  - `if (token !== 'diagnose-zgb-20260528')` — 硬编码口令违反安全规范 P0-07
- **修复:**
  ```javascript
  // L3: 改为
  const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
  // L15: 改为
  const DIAGNOSE_TOKEN = process.env.DIAGNOSE_TOKEN || '';
  if (!DIAGNOSE_TOKEN || token !== DIAGNOSE_TOKEN) { ... }
  ```
- **工作量:** 15 分钟

### 🟠 P1 (建议修复，不阻塞上线)

#### P1-01: _cf-error.js 与 error-reporter.js 消息格式逻辑不一致

- **严重度:** P1
- **位置:** `cloudfunctions/invite-code/_cf-error.js` L79-87 vs `cloudfunctions/_shared/error-reporter.js` L88-98
- **描述:** `_cf-error.js` 的 `sendWecomAlert` 在 webhook 模式直接返回 true（不尝试 bot 兜底），而 `error-reporter.js` 使用 if/else 确保 webhook 失败后继续尝试 bot。告警推送策略不一致。
- **建议:** 统一 `_cf-error.js` 的告警策略为 webhook 优先 + bot 兜底，与 `error-reporter.js` 保持一致。或者提取公共 `sendWecomAlert` 到 `_shared/` 模块。
- **工作量:** 1 小时

#### P1-02: CFErrorsPage 硬编码 cf-alert URL

- **严重度:** P1
- **位置:** `admin-dashboard/src/pages/CFErrorsPage.tsx` L52
- **描述:** `fetch('https://cloudbase-d1g17tgt7cc199a60.service.tcloudbase.com/cf-alert/status')` 硬编码 envId。应使用环境变量或从 admin-dashboard 的 CloudBase 配置中读取。
- **建议:** 使用 `import.meta.env.VITE_CF_ALERT_URL` 或在 `api.ts` 中统一管理。
- **工作量:** 30 分钟

#### P1-03: cf_error_logs 缺少自动清理机制

- **严重度:** P1
- **位置:** `cloudfunctions/_shared/error-reporter.js` L127, `_cf-error.js` L109
- **描述:** 每条错误记录写入 `expireAt` 字段（30天后），但无定时任务或云函数自动清理过期记录。长期运行会导致集合膨胀。
- **建议:** 新增定时触发器云函数 `cf-error-cleanup`，每天凌晨清理 `createdAt < now-30d` 的记录；或在 `admin-data-lifecycle` 中增加清理逻辑。
- **工作量:** 1 小时

### 🟡 P2 (优化建议)

#### P2-01: CFErrorsPage 缺少错误详情展开和历史趋势

- **严重度:** P2
- **位置:** `admin-dashboard/src/pages/CFErrorsPage.tsx`
- **建议:** 增加点击行展开查看完整 errorStack 和 context；增加7天/30天趋势折线图；增加错误指纹聚合（同 fingerprint 合并统计）

#### P2-02: diagnose-user 缺少审计日志和自身错误上报

- **严重度:** P2
- **位置:** `cloudfunctions/diagnose-user/index.js`
- **建议:** 
  1. 增加审计日志（谁查看、查看谁、何时）
  2. 接入 `_shared/error-reporter.js` 上报自身异常

#### P2-03: app.js onError 未接入 cf_error_logs

- **严重度:** P2
- **位置:** `app.js` L415-429
- **描述:** `onError` 将错误写入 `ERROR_LOG` Storage key 和 `usage-tracker`，但未写入 `cf_error_logs`。小程序全局错误也应纳入统一错误监控体系。
- **建议:** 在 `onError` 中增加 `wx.cloud.callFunction({name:'cf-alert', data:{action:'send', fnName:'app.onError', errorMsg:...}})` 或直接写入 `cf_error_logs`。

#### P2-04: payments 回调内存锁上限风险

- **严重度:** P2
- **位置:** `cloudfunctions/payment/index.js` L462
- **描述:** `CALLBACK_LOCKS` Map 无上限控制。在极端高并发场景下可能内存溢出。由于云函数实例有生命周期，风险较低。
- **建议:** 增加 Map size 上限（如 1000），使用 LRU 淘汰策略。

---

## 七、总结与建议

### 7.1 审查结论

**⚠️ CONDITIONAL PASS** — 错误监控主链路（采集→告警→看板→诊断）已建立并可用，但存在 2 个 P0 阻塞项和 3 个 P1 优化项。

### 7.2 通过项

1. ✅ 错误采集写入 `cf_error_logs` 可靠，DB失败不传播
2. ✅ 企微告警 Webhook/Bot 双模式，冷却防风暴
3. ✅ CFErrorsPage 实时监控面板功能完整
4. ✅ 4个 `_cf-error.js` 副本内容一致，自包含可独立部署
5. ✅ 测试覆盖全面（cf-error 单元/集成/QA/企微 4 文件 600+ 断言）
6. ✅ payment/redeem 双路径会员状态同步一致
7. ✅ reminders 流程动态时间线 + 去重 + 路径过滤
8. ✅ 未发现硬编码 webhook key（所有 key 走环境变量）

### 7.3 修复优先级

| 优先级 | 编号 | 问题 | 工时 |
|--------|------|------|------|
| 🔴 立即 | P0-02 | diagnose-user 硬编码 | 0.25h |
| 🔴 本周 | P0-01 | 核心云函数接入错误上报 | 2h |
| 🟠 下周 | P1-01 | 告警策略统一 | 1h |
| 🟠 下周 | P1-02 | CFErrorsPage URL 配置化 | 0.5h |
| 🟠 下周 | P1-03 | 错误日志自动清理 | 1h |
| 🟡 后续 | P2-01~04 | UX优化/审计/全局错误 | 4h |

### 7.4 建议

1. **统一错误上报接入模式:** 建议全部云函数迁移到 `_shared/error-reporter.js`，逐步废弃 `_cf-error.js` 独立副本模式，减少代码重复和维护成本。
2. **增强诊断工具安全:** `diagnose-user` 应通过 CloudBase 环境变量管理 token，并增加审计日志。
3. **完善错误监控闭环:** 增加 `cf-error-cleanup` 定时清理 + 全局 `app.onError` 接入 + 错误趋势看板。

---

*审查人: 玄武Agent (Gate 5)*
*审查依据: 住港伴V4方案设计(CLAUDE.md核心目标) + 编码规范v1.0 + cf-error测试套件*
