# 住港伴 V4 — 运营后台与BI看板 技术设计文档 (TDD) v1.0

> 2026-05-21 | 对齐需求评审报告 v1.0 | V4 开发基线 | 8项P0已内置

---

# 第一部分：技术方案设计

## 一、技术栈

| 层           | 技术                                            | 版本/说明                              |
| :----------- | :---------------------------------------------- | :------------------------------------- |
| 运营后台前端 | React 18 + TypeScript + Vite                    | 新建项目，独立于小程序                 |
| UI 组件库    | shadcn/ui + Tailwind CSS                        | 与网页版设计语言统一                   |
| 图表库       | Recharts                                        | 轻量 React 原生图表                    |
| 认证         | CloudBase Web Auth（修正为方案B）               | 管理员独立 API Key + IP 白名单         |
| 后端         | CloudBase HTTP 云函数 (Node.js 18)              | admin-\* 系列，8个新函数               |
| 数据库       | CloudBase NoSQL（复用45个已有集合）             | 新增4个集合 + 扩展3个集合              |
| 定时任务     | CloudBase Timer 触发器                          | admin-data-lifecycle + daily_snapshot  |
| 小程序端     | 微信小程序原生（V3基线，不动）                  | 仅新增埋点 (15页 page_view + 20种事件) |
| 部署         | CloudBase 静态托管                              | 与网页版同一 envId                     |
| 测试         | Jest 29 (云函数) + React Testing Library (前端) | 两层测试独立运行                       |

## 二、系统架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────┐
│                   运营后台 Web App                        │
│  React 18 + TypeScript + Vite + shadcn/ui + Recharts     │
│  CloudBase JS SDK (Web)                                  │
│  鉴权: API Key + IP白名单                                 │
│  部署: CloudBase 静态托管                                  │
└──────────────┬──────────────────────────────────────────┘
               │ HTTPS (CloudBase Web SDK)
               ▼
┌──────────────────────────────────────────────────────────┐
│              CloudBase HTTP 云函数层 (8个)                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │admin-    │ │admin-    │ │admin-    │ │admin-    │    │
│  │stats     │ │users     │ │revenue   │ │codes     │    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │admin-    │ │admin-    │ │admin-    │ │admin-    │    │
│  │ai-quality│ │compliance│ │feedback  │ │lifecycle │    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
│                                                          │
│  鉴权: X-API-Key header + X-Admin-IP 校验                 │
│  超时: 30s | 内存: 256MB | 环境变量: ADMIN_API_KEYS       │
└──────────────┬──────────────────────────────────────────┘
               │ CloudBase NoSQL SDK
               ▼
┌──────────────────────────────────────────────────────────┐
│            CloudBase NoSQL 数据库 (49个集合)               │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐           │
│  │ 新增4集合   │ │ 扩展3集合   │ │ 新增索引6个 │           │
│  │ admin_users │ │ invite_codes│ │ user_events │           │
│  │ audit_trail │ │ invoices    │ │ invite_codes│           │
│  │ daily_snaps │ │ user_profiles│ │             │           │
│  │ page_view   │ │             │ │             │           │
│  └────────────┘ └────────────┘ └────────────┘           │
│  ┌──────────────────────────────────────────────┐        │
│  │ 复用45个已有集合: users/user_events/feedback/ │        │
│  │ conversation_logs/orders/life_guide_tasks/... │        │
│  └──────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────┘
               ▲ wx.cloud.callFunction
               │
┌──────────────────────────────────────────────────────────┐
│              小程序端 (V3基线，仅加埋点)                    │
│  utils/tracker.js (新增)                                 │
│  · 15核心页 page_view 埋点 (采样 1:10)                    │
│  · 20种业务事件埋点 (批量上传 10条/批)                     │
│  · 离线缓存 + 失败重试                                    │
└──────────────────────────────────────────────────────────┘
```

### 2.2 鉴权方案（修正P0-02）

**不采用**方案一中的 `ADMIN_TOKENS` 环境变量 + 临时 token（与 CloudBase Web Auth uid 不兼容）。

**采用方案B：HTTP 云函数 + 独立 API Key**

```
运营后台登录:
  1. 管理员在登录页输入邮箱 + 密码
  2. admin-stats 云函数校验凭据 → 返回 API Key (仅首次) + 角色信息
  3. 前端将 API Key 存入 sessionStorage
  4. 后续所有 admin-* 调用在 header 中携带 X-API-Key

云函数鉴权 (每个 admin-* 函数):
  1. 读取请求 header 中的 X-API-Key
  2. 从环境变量 ADMIN_API_KEYS (JSON) 解析白名单
  3. 比对 hash → 通过/拒绝
  4. 记录审计日志: admin_audit_trail.insert({ action: 'api_call', ... })

API Key 管理:
  - 每个管理员分配独立 API Key (uuid v4)
  - 环境变量存储: ADMIN_API_KEYS = '{"key1":"hash1","key2":"hash2"}'
  - API Key 在 admin_users 集合中以 bcrypt hash 存储
  - 支持轮换: admin_users.update({ apiKeyHash, keyRotatedAt })
```

### 2.3 数据流

```
小程序埋点 → usage-tracker(批量写入) → user_events / page_view_logs
  │                                        │
  │                                        ▼ (每日凌晨3:00)
  │                              admin-data-lifecycle (timer触发)
  │                              · 清理30天前 page_view_logs
  │                              · 导出180天前 user_events → JSONL → 云存储
  │                              · 生成 daily_stats_snapshots 快照
  │                                        │
  │                                        ▼
  │                              daily_stats_snapshots (宽表一行)
  │                                        │
  │                                        ▼ (运营后台请求时)
  └──────────────────────────→ admin-stats (聚合查询)
                                          │
                                          ▼
                                    运营后台仪表盘渲染
```

---

## 三、数据库模型

### 3.1 新增集合

#### admin_users — 管理员账号

```javascript
{
  _id: "auto",
  uid: "cloudbase-web-auth-uid",          // CloudBase Web Auth 返回的 uid (修正P0-02)
  email: "admin@zgb.com",
  name: "管理员姓名",
  role: "super_admin|pm|ops|content|cs",
  apiKeyHash: "$2b$10$...",               // bcrypt hash of API key
  apiKeyLastUsed: ISODate,
  apiKeyRotatedAt: ISODate,
  loginAttempts: 0,
  lastLoginAt: ISODate,
  lastLoginIP: "192.168.1.1",
  status: "active|suspended",
  createdAt: serverDate,
  updatedAt: serverDate
}
// 索引: { uid: 1 } unique, { email: 1 } unique, { role: 1 }
```

#### admin_audit_trail — 运营操作审计（修正P0-08: append-only）

```javascript
{
  _id: "auto",
  adminUid: "操作者uid",
  adminName: "操作者姓名",
  action: "login|logout|api_call|view_data|export_data|generate_codes|revoke_code|
           issue_invoice|lock_user|unlock_user|extend_trial|delete_content|
           view_sensitive|permission_change|failed_attempt|rate_limit_hit",
  targetType: "user|order|content|feedback|invite_code|invoice|system",
  targetId: "操作对象ID",
  detail: { ... },                        // 操作详情(不含PII)
  ip: "请求来源IP",
  userAgent: "浏览器UA",
  success: true|false,
  failureReason: "错误原因(仅失败时)",
  createdAt: serverDate
}
// 索引: { adminUid: 1, createdAt: -1 }, { action: 1, createdAt: -1 }, { createdAt: -1 }
// 约束: 云函数层强制 insert-only, 禁止 update/delete
// 清理: 365天TTL
```

#### daily_stats_snapshots — 每日统计快照

```javascript
{
  _id: "auto",
  date: "2026-05-21",                    // YYYY-MM-DD
  // 用户指标
  totalUsers: 0, newUsers: 0, activeUsers: 0,
  usersByPath: { "qmas": 10, "ttps_b": 5, ... },
  usersByMembership: { "free_trial": 20, "annual_399": 3, ... },
  // 收入指标
  dailyRevenue: 0,                        // 分
  revenueByPlan: { "annual_399": 0, "pro_2999": 0, ... },
  orderCount: 0, completedOrderCount: 0,
  // AI指标
  aiConversations: 0, aiAccuracyAvg: 0,
  aiModes: { "qa": 0, "assessment": 0, "general": 0 },
  safetyEvents: 0,
  // 兑换码指标
  codesGenerated: 0, codesActivated: 0,
  // 开票指标
  invoicesRequested: 0, invoicesIssued: 0,
  // 客服指标
  feedbackSubmitted: 0, feedbackResolved: 0,
  // 页面热度 (数组格式，修正原宽表嵌套对象)
  pageViews: [
    { module: "guidebook", pv: 0, uv: 0 },
    { module: "documents", pv: 0, uv: 0 },
    { module: "reminders", pv: 0, uv: 0 },
    { module: "process", pv: 0, uv: 0 },
    { module: "ai_chat", pv: 0, uv: 0 },
    { module: "mine", pv: 0, uv: 0 }
  ],
  createdAt: serverDate
}
// 索引: { date: 1 } unique, { date: -1 }
```

#### page_view_logs — 页面访问日志（修正P0-03: 采样写入）

```javascript
{
  _id: "auto",
  _openid: "用户openid",
  page: "pages/guidebooks/index/index",
  from: "tabBar|navigate|redirect|switchTab",
  referrer: "pages/home/home",
  sessionId: "s_xxx",
  timeSpent: 45,                         // 秒 (仅 page_leave 时填充)
  tabActive: "guidebooks",               // 仅 TabBar 页面有值
  sampleRate: 0.1,                       // 采样率标记
  createdAt: serverDate
}
// 索引: { _openid: 1, createdAt: -1 }, { page: 1, createdAt: -1 }, { createdAt: 1 } (TTL: 30天)
// 清理: admin-data-lifecycle 每日删除 30 天前数据
// 采样: 客户端 Math.random() < sampleRate 才上报
```

### 3.2 扩展已有集合

**invite_codes 新增字段**:

```javascript
{
  codeType: "invite|redemption",         // 新增
  planId: "annual_399|pro_2999|enterprise_6999", // 新增(redemption专用)
  planName: "年卡",                       // 新增
  batchId: "batch_20260521_001",         // 新增
  batchName: "",                         // 新增
  maxActivations: 1,                     // 新增(默认1)
  activationCount: 0,                    // 新增
  generatedBy: "",                       // 新增
  generatedAt: ISODate,                  // 新增
  expiresAt: ISODate,                    // 新增
  note: ""                               // 新增
}
// 新增索引 (修正P0-07):
//   { codeType: 1, status: 1 }
//   { batchId: 1, codeType: 1 }
//   { planId: 1, status: 1 }
//   { generatedBy: 1, createdAt: -1 }
```

**invoices 新增字段**: (略，见方案 §3.4.6)

**user_profiles 新增字段**:

```javascript
{
  membershipTier: "free_trial|annual_399|pro_2999|enterprise_6999",
  activationSource: "invite_code|redemption_code|direct_pay|manual",
  activationCodeBatch: "",
  renewalReadinessScore: 0-100
}
```

**user_events 新增索引** (修正P0-07):

```javascript
// 新增索引:
//   { createdAt: -1 }                    // 时间范围查询
//   { openid: 1, createdAt: -1 }         // 用户时间线查询 (替代 openid_eventType 的粗扫描)
```

### 3.3 索引创建优先级 (Phase 1 部署前)

|  #  | 集合                  | 索引                              | 原因                     |
| :-: | :-------------------- | :-------------------------------- | :----------------------- |
|  1  | user_events           | `{createdAt: -1}`                 | admin-stats 日期范围查询 |
|  2  | user_events           | `{_openid: 1, createdAt: -1}`     | 用户时间线               |
|  3  | invite_codes          | `{codeType: 1, status: 1}`        | 邀请码/兑换码分类筛选    |
|  4  | invite_codes          | `{batchId: 1, codeType: 1}`       | 批次管理                 |
|  5  | invite_codes          | `{planId: 1, status: 1}`          | 套餐统计                 |
|  6  | invite_codes          | `{generatedBy: 1, createdAt: -1}` | 管理员操作记录           |
|  7  | admin_users           | `{uid: 1}` unique                 | 登录查询                 |
|  8  | admin_users           | `{email: 1}` unique               | 邮箱查询                 |
|  9  | admin_audit_trail     | `{adminUid: 1, createdAt: -1}`    | 管理员审计               |
| 10  | admin_audit_trail     | `{action: 1, createdAt: -1}`      | 操作类型审计             |
| 11  | page_view_logs        | `{_openid: 1, createdAt: -1}`     | 用户路径分析             |
| 12  | page_view_logs        | `{page: 1, createdAt: -1}`        | 页面热度统计             |
| 13  | daily_stats_snapshots | `{date: 1}` unique                | 快照查询                 |

---

## 四、API 接口定义

### 4.1 鉴权机制

所有 admin-\* 云函数使用 HTTP 触发器，请求格式：

```
POST /admin-stats HTTP/1.1
Content-Type: application/json
X-API-Key: <管理员API Key>
{
  "action": "getDashboard",
  "params": { ... }
}
```

响应格式：

```json
{
  "code": 0,
  "msg": "ok",
  "data": { ... }
}
```

错误码：
| code | 含义 |
|:--|:--|
| 0 | 成功 |
| 401 | 未认证（API Key缺失/无效） |
| 403 | 无权限（角色不足） |
| 429 | 速率限制（单IP 100次/分钟） |
| 400 | 参数错误 |
| 500 | 服务端异常 |

### 4.2 admin-stats 云函数

**用途**: 首页仪表盘聚合数据

| action       | 说明            | params            | 返回                                             |
| :----------- | :-------------- | :---------------- | :----------------------------------------------- | ------ | ------------------------ |
| getDashboard | 首页6项核心指标 | `{}`              | `{ totalUsers, newUsers7d, activeUsers7d, ... }` |
| getTrend     | 30天趋势数据    | `{ metric: "users | revenue                                          | ai" }` | `[{ date, value }, ...]` |

### 4.3 admin-users 云函数

**用途**: 用户管理

| action        | 说明           | params                                                             | 返回                          |
| :------------ | :------------- | :----------------------------------------------------------------- | :---------------------------- |
| listUsers     | 用户列表(分页) | `{ page, pageSize, filter: { visaType, membershipTier, status } }` | `{ total, list: [...] }`      |
| getUserDetail | 单用户详情     | `{ openid }`                                                       | `{ profile, events, orders }` |
| lockUser      | 锁定用户       | `{ openid, reason }`                                               | `{ ok }`                      |
| unlockUser    | 解锁用户       | `{ openid, reason }`                                               | `{ ok }`                      |
| extendTrial   | 延长试用       | `{ openid, days }`                                                 | `{ ok }`                      |

**权限**: ops+ 角色。lockUser/extendTrial 需 pm+ 角色。

### 4.4 admin-codes 云函数

**用途**: 邀请码 + 兑换码管理

| action        | 说明                 | params                                                              | 返回                                       |
| :------------ | :------------------- | :------------------------------------------------------------------ | :----------------------------------------- |
| listCodes     | 码列表(分页+筛选)    | `{ page, pageSize, filter: { codeType, batchId, planId, status } }` | `{ total, list: [...] }`                   |
| generateCodes | 批量生成             | `{ codeType, planId, count, expiresInDays, batchName }`             | `{ batchId, count, csvData }`              |
| revokeCode    | 单张作废             | `{ code }`                                                          | `{ ok }`                                   |
| revokeBatch   | 整批作废             | `{ batchId }`                                                       | `{ ok }`                                   |
| getCodeStats  | 统计                 | `{ codeType }`                                                      | `{ generated, activated, activationRate }` |
| exportCodes   | 导出CSV (需二次确认) | `{ batchId, confirmPassword }`                                      | `{ csvData (AES加密) }`                    |

**安全控制**:

- generateCodes: 单IP单日上限500张，需二次密码确认
- exportCodes: 需管理员密码二次确认，CSV加密压缩，写入审计日志 (P1-06)
- revokeCode/revokeBatch: 不可逆操作，需二次确认

### 4.5 admin-revenue 云函数

**用途**: 财务看板

| action            | 说明         | params                                                      | 返回                                      |
| :---------------- | :----------- | :---------------------------------------------------------- | :---------------------------------------- | --------- | ---------------------------------------- |
| getRevenueSummary | 收入概览     | `{ period: "today                                           | week                                      | month" }` | `{ totalRevenue, orderCount, avgOrder }` |
| listOrders        | 订单列表     | `{ page, pageSize, filter: { status, planId, dateRange } }` | `{ total, list: [...] }`                  |
| getTrialFunnel    | 试用转化漏斗 | `{ days: 30 }`                                              | `{ steps: [{ name, count, rate }, ...] }` |
| listInvoices      | 开票列表     | `{ page, pageSize, filter: { status } }`                    | `{ total, list: [...] }`                  |
| issueInvoice      | 开具发票     | `{ invoiceId, invoiceNumber, invoiceFile }`                 | `{ ok }`                                  |
| rejectInvoice     | 驳回开票     | `{ invoiceId, reason }`                                     | `{ ok }`                                  |

### 4.6 admin-ai-quality 云函数

**用途**: AI质量监控

| action               | 说明          | params                        | 返回                                                       |
| :------------------- | :------------ | :---------------------------- | :--------------------------------------------------------- |
| getAIDashboard       | AI看板        | `{ days: 7 }`                 | `{ conversations, accuracy, safetyEvents, cost, latency }` |
| getAccuracyTrend     | 准确率趋势    | `{ days: 30 }`                | `[{ date, avgAccuracy, evalCount }, ...]`                  |
| getTopicDistribution | 咨询主题分布  | `{ days: 30 }`                | `[{ topic, count, percentage }, ...]`                      |
| getTopQueries        | 高频问题Top20 | `{ days: 7 }`                 | `[{ query (脱敏), count, hasContent }, ...]`               |
| getSafetyEvents      | 安全事件列表  | `{ page, pageSize, days: 7 }` | `{ total, list: [{ time, type, query }, ...] }`            |

**安全约束** (修正P0-05):

- response_preview **绝对禁止**出现在任何返回数据中
- query 字段展示前必须过 PII 正则脱敏
- 词云输入前过 K2-leak-scanner 双重过滤

### 4.7 admin-compliance 云函数

**用途**: 合规与安全监控

| action                   | 说明         | params                                       | 返回                                                       |
| :----------------------- | :----------- | :------------------------------------------- | :--------------------------------------------------------- |
| getComplianceStatus      | 合规状态总览 | `{}`                                         | `{ sensitiveTerms, k2Leaks, contentModeration, ocrAudit }` |
| getContentModerationLogs | 内容审核日志 | `{ page, pageSize, filter: { type, days } }` | `{ total, list: [...] }`                                   |
| getPiiScanResults        | PII扫描结果  | `{ days: 7 }`                                | `{ scanned, found, sanitized }`                            |

### 4.8 admin-feedback 云函数

**用途**: 客服工单管理

| action               | 说明         | params                                               | 返回                                                |
| :------------------- | :----------- | :--------------------------------------------------- | :-------------------------------------------------- |
| listFeedback         | 反馈列表     | `{ page, pageSize, filter: { status, type, days } }` | `{ total, list: [...] }`                            |
| getFeedbackDetail    | 反馈详情     | `{ ticketId }`                                       | `{ ...feedback, content: 脱敏后的内容 }`            |
| updateFeedbackStatus | 更新状态     | `{ ticketId, status, reply }`                        | `{ ok }`                                            |
| getFeedbackStats     | 客服效率统计 | `{ days: 30 }`                                       | `{ total, resolved, avgResponseTime, closureRate }` |
| getCsQualityReport   | 客服质量报告 | `{ days: 30 }`                                       | `{ satisfactionRate, topIssues, ... }`              |

**安全约束** (修正P0-04):

- feedback.content 入库前经过 PII 自动脱敏
- getFeedbackDetail 返回前二次过滤 PII 正则
- 展示时敏感内容标记 `[已脱敏]`

### 4.9 admin-data-lifecycle 云函数（Timer 触发）

**用途**: 数据生命周期管理 (修正P0-06)

执行时间: 每日凌晨 3:00 (cron: `0 0 3 * * * *`)

| action                | 说明                                                                |
| :-------------------- | :------------------------------------------------------------------ |
| cleanPageViewLogs     | 删除 30 天前的 page_view_logs 记录                                  |
| archiveUserEvents     | 导出 180 天前的 user_events → JSONL → upload to 云存储 → 删除原记录 |
| generateDailySnapshot | 聚合当日数据 → 写入 daily_stats_snapshots                           |
| verifyDataIntegrity   | 校验: user_events 计数 vs daily_stats_snapshots 一致性              |

---

## 五、前端路由与组件树

### 5.1 路由表

```
/admin                          → DashboardPage       (首页仪表盘)
/admin/users                    → UserListPage         (用户列表)
/admin/users/:uid               → UserDetailPage       (用户详情)
/admin/codes                    → CodeManagePage       (邀请码+兑换码 双Tab)
/admin/ai-quality               → AIQualityPage        (AI质量监控)
/admin/compliance               → CompliancePage       (合规安全)
/admin/revenue                  → RevenuePage          (财务看板) [Phase 2]
/admin/content                  → ContentPage          (内容运营) [Phase 3]
/admin/feedback                 → FeedbackPage         (客服工单) [Phase 3]
/admin/system                   → SystemPage           (系统健康) [Phase 3]
/admin/settings                 → SettingsPage         (后台设置)
/admin/login                    → LoginPage            (管理员登录)
```

### 5.2 组件树 (Phase 1)

```
App
├── AuthProvider (API Key 管理 + 自动鉴权)
│   ├── LoginPage
│   │   └── LoginForm (email + password → API Key)
│   │
│   └── AppLayout (需鉴权)
│       ├── Sidebar
│       │   ├── NavItem: 仪表盘
│       │   ├── NavItem: 用户管理
│       │   ├── NavItem: 邀请码/兑换码
│       │   ├── NavItem: AI质量
│       │   ├── NavItem: 合规安全
│       │   └── NavItem: 设置
│       │
│       ├── DashboardPage
│       │   ├── MetricCard × 6 (核心指标卡片)
│       │   ├── TrendChart (30天趋势图)
│       │   ├── PathPieChart (路径分布饼图)
│       │   └── AlertBanner (P0告警卡片)
│       │
│       ├── UserListPage
│       │   ├── FilterBar (签证类型/会员/状态)
│       │   ├── UserTable (分页列表)
│       │   └── UserDetailPage
│       │       ├── ProfileCard
│       │       ├── TimelineChart (事件时间线)
│       │       └── ActionPanel (锁定/解锁/延长试用)
│       │
│       ├── CodeManagePage
│       │   ├── CodeTabs (邀请码 | 兑换码)
│       │   ├── GenerateForm (批量生成表单)
│       │   ├── CodeTable (分页列表 + 筛选)
│       │   └── CodeStatsPanel (激活率统计)
│       │
│       ├── AIQualityPage
│       │   ├── AccuracyTrendChart
│       │   ├── SafetyEventList
│       │   ├── TopicDistributionChart
│       │   └── TopQueriesTable (脱敏)
│       │
│       └── CompliancePage
│           ├── ComplianceStatusCards
│           ├── ModerationLogTable
│           └── PiiScanResultPanel
```

---

# 第二部分：任务拆解

## 六、任务列表 (Jira-like)

每个任务包含：编号、标题、描述、Story Points (SP)、依赖、验收标准。

### Phase 1: 种子期运营工具 (8天, 22 SP)

| ID         | 任务                                         | SP  | 依赖          | 描述                                                                                                                                                |
| :--------- | :------------------------------------------- | :-: | :------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| **V4-001** | React项目初始化 + CloudBase SDK接入          |  3  | —             | Vite + React 18 + TS + shadcn/ui + Tailwind + CloudBase JS SDK；配置静态托管部署；配置 eslint + prettier                                            |
| **V4-002** | 管理员登录页面 + AuthProvider                |  3  | V4-001        | LoginPage UI + API Key 获取/存储/自动携带；AuthProvider 全局鉴权状态管理；会话过期处理                                                              |
| **V4-003** | admin_users 集合创建 + API Key 种子          |  1  | —             | 创建集合 + 索引；创建初始 super_admin 账号；生成首个 API Key                                                                                        |
| **V4-004** | AppLayout + Sidebar + 路由                   |  2  | V4-001        | 后台整体布局（深色主题）；Sidebar导航；React Router 路由配置；响应式基础                                                                            |
| **V4-005** | admin-audit-trail 中间件                     |  2  | V4-002        | 所有 admin-\* 云函数统一鉴权中间件（X-API-Key校验 + IP白名单 + 速率限制 + 审计日志写入）                                                            |
| **V4-006** | admin-stats 云函数 + DashboardPage           |  5  | V4-005        | getDashboard + getTrend；首页6个核心指标卡片 + 30天趋势图 + 路径分布饼图 + 告警横幅                                                                 |
| **V4-007** | admin-codes 云函数 + CodeManagePage (邀请码) |  5  | V4-005        | listCodes/getCodeStats/generateCodes(邀请码)；邀请码Tab: 生成表单 + 列表 + 激活率统计                                                               |
| **V4-008** | 小程序埋点模块 utils/tracker.js              |  3  | —             | 15核心页 page_view 埋点(1:10采样)；20种业务事件埋点(批量10条/批上传)；离线缓存+失败重试                                                             |
| **V4-009** | P0修复合集                                   |  3  | V4-006,V4-007 | content-safety-check PII自动脱敏；K2过滤集成到admin-ai-quality；user_events/invite_codes 6个新索引；审计日志补齐5类事件；page_view_logs 30天TTL逻辑 |
| **V4-010** | admin-data-lifecycle 定时云函数              |  2  | —             | cleanPageViewLogs + generateDailySnapshot + verifyDataIntegrity；cron配置                                                                           |

**Phase 1 合计: 22 SP**

### Phase 2: 核心运营模块 (10天, 30 SP)

| ID         | 任务                                     | SP  | 依赖   | 描述                                                                                              |
| :--------- | :--------------------------------------- | :-: | :----- | :------------------------------------------------------------------------------------------------ |
| **V4-011** | admin-users 云函数 + UserListPage        |  5  | V4-005 | listUsers(分页+多条件筛选)；getUserDetail(完整画像)；UserListPage + UserDetailPage                |
| **V4-012** | 路径分析页面 + 桑基图                    |  5  | V4-008 | 基于 user_profiles + user_events 的路径分布饼图 + 路径切换桑基图；评估准确率；阶段进度分布        |
| **V4-013** | admin-revenue 云函数 + RevenuePage       |  5  | V4-005 | getRevenueSummary + listOrders + getTrialFunnel；收入概览卡片 + 订单列表 + 试用漏斗图             |
| **V4-014** | admin-codes 扩展 (兑换码)                |  3  | V4-007 | generateCodes(兑换码) + exportCodes(AES加密CSV) + revokeCode/revokeBatch；兑换码Tab               |
| **V4-015** | admin-ai-quality 云函数 + AIQualityPage  |  5  | V4-005 | getAIDashboard + getAccuracyTrend + getTopicDistribution + getTopQueries；AI质量看板(含P0-05修复) |
| **V4-016** | 续签准备就绪度 MVP                       |  3  | V4-011 | renewalReadinessScore 计算逻辑云函数；Admin用户详情页显示评分 + 高风险标记                        |
| **V4-017** | admin-compliance 云函数 + CompliancePage |  4  | V4-005 | getComplianceStatus + getContentModerationLogs；合规看板 + 审核日志                               |

**Phase 2 合计: 30 SP**

### Phase 3: 精细运营 (10天, 26 SP)

| ID         | 任务                                          | SP  | 依赖   | 描述                                                                                              |
| :--------- | :-------------------------------------------- | :-: | :----- | :------------------------------------------------------------------------------------------------ |
| **V4-018** | admin-content 云函数 + ContentPage            |  4  | V4-008 | 攻略书阅读排行 + 任务完成率 + 政策更新追踪 + 搜索热词 + 页面热度热力图                            |
| **V4-019** | admin-feedback 云函数 + FeedbackPage          |  5  | V4-005 | listFeedback(含P0-04 PII脱敏) + updateFeedbackStatus + getFeedbackStats；客服工单管理 + 效率统计  |
| **V4-020** | 开票管理模块                                  |  3  | V4-013 | listInvoices + issueInvoice + rejectInvoice；开票列表 + 开具/驳回 + 统计                          |
| **V4-021** | 系统健康监控页                                |  3  | V4-005 | 云函数调用量/错误率图表 + 数据库容量监控 + API延迟P50/P95                                         |
| **V4-022** | admin-data-lifecycle 增强 (archiveUserEvents) |  2  | V4-010 | user_events 180天归档到云存储 JSONL + 清理原记录                                                  |
| **V4-023** | 数据导出 + 定时报表                           |  3  | V4-006 | CSV/Excel导出功能；定时报表（周报/月报）通过Resend邮件发送                                        |
| **V4-024** | 日志清理TTL全面上线                           |  2  | V4-022 | page_view_logs 30天 / user_events 180天 / conversation_logs 365天 / audit_trail 365天 TTL全量启用 |
| **V4-025** | P1/P2收尾                                     |  4  | —      | P1-01~P1-06 收尾修复；Safari/iPad兼容性测试；响应式微调                                           |

**Phase 3 合计: 26 SP**

### 全量合计: 78 SP (28天)

---

# 第三部分：测试方案

## 七、测试不通过标准 (Test Failure Criteria)

### 7.1 阻断性标准 (P0 — 任一项不通过则禁止上线)

| #     | 标准                                           | 验证方式                                                  |
| :---- | :--------------------------------------------- | :-------------------------------------------------------- |
| TF-01 | admin-\* 云函数未经鉴权不可调用（401返回）     | 自动化测试：无API Key请求 → 期望 401                      |
| TF-02 | admin_audit_trail 审计日志不可被 update/delete | 自动化测试：尝试update audit_trail → 期望拒绝             |
| TF-03 | AI Quality 页面不包含 response_preview 字段    | 自动化测试：解析所有API返回 → 断言无 response_preview 键  |
| TF-04 | feedback content 入库前已完成 PII 脱敏         | 自动化测试：含手机号的 feedback → 期望 `[已脱敏的手机号]` |
| TF-05 | 兑换码 CSV 导出需二次密码确认                  | E2E测试：导出操作 → 期望弹出密码输入框                    |
| TF-06 | page_view_logs 写入采样率 ≤ 10%                | 自动化测试：批量生成100条 → 期望写入 ≤ 10 条              |
| TF-07 | admin-data-lifecycle 清理逻辑正确执行          | 自动化测试：插入31天前数据 → 触发lifecycle → 期望已删除   |
| TF-08 | 运营后台无敏感词（"移民""移民顾问"等）         | 静态扫描：grep 运营后台源码 → 期望 0 匹配                 |

### 7.2 功能完整性标准 (P1 — 任一项不通过则延期上线)

| #     | 标准                                     | 验证方式                                        |
| :---- | :--------------------------------------- | :---------------------------------------------- |
| TF-09 | 首页6项核心指标卡片数据正确展示          | E2E测试：对比admin-stats返回值与页面渲染数据    |
| TF-10 | 邀请码批量生成 → CSV下载 → 码面加密      | E2E测试：完整流程                               |
| TF-11 | 邀请码筛选（按状态/批次）返回正确结果    | 自动化测试：插入不同状态的码 → 筛选 → 断言结果  |
| TF-12 | 30天趋势图数据点不少于25天               | 自动化测试：调用getTrend → 断言data.length ≥ 25 |
| TF-13 | API速率限制生效（单IP 100次/分钟 = 429） | 自动化测试：101次连续调用 → 期望第101次返回 429 |
| TF-14 | 管理员登录失败5次后临时锁定15分钟        | 自动化测试：连续错误密码 → 断言第6次被拒绝      |

### 7.3 性能标准 (P2)

| #     | 标准                                   | 验证方式                                |
| :---- | :------------------------------------- | :-------------------------------------- |
| TF-15 | 首页仪表盘加载时间 < 3秒 (P95)         | 性能测试：Lighthouse 或 Chrome DevTools |
| TF-16 | admin-stats 云函数响应时间 < 2秒 (P95) | 云函数日志分析                          |
| TF-17 | 小程序埋点不影响页面切换性能 (+<50ms)  | 性能测试：埋点前后 onShow 耗时对比      |

## 八、测试用例

### 8.1 单元测试：admin-stats 云函数 (Jest)

```javascript
// tests/admin-stats.test.js
describe('admin-stats getDashboard', () => {
  it('returns 401 without API key', async () => {
    const res = await callFunction('admin-stats', { action: 'getDashboard' });
    expect(res.code).toBe(401);
  });

  it('returns dashboard data with valid API key', async () => {
    const res = await callFunction('admin-stats', { action: 'getDashboard' }, { apiKey: VALID_KEY });
    expect(res.code).toBe(0);
    expect(res.data).toHaveProperty('totalUsers');
    expect(res.data).toHaveProperty('newUsers7d');
    expect(res.data).toHaveProperty('activeUsers7d');
    expect(res.data).toHaveProperty('usersByPath');
    expect(res.data).toHaveProperty('aiAccuracyAvg');
    expect(res.data).toHaveProperty('safetyEvents');
  });

  it('rejects expired API key (403)', async () => {
    /* ... */
  });
  it('writes audit log on every call', async () => {
    /* ... */
  });
  it('returns 429 on rate limit exceeded', async () => {
    /* ... */
  });
});

describe('admin-stats getTrend', () => {
  it('returns 30 data points for users metric', async () => {
    const res = await callFunction('admin-stats', { action: 'getTrend', params: { metric: 'users', days: 30 } });
    expect(res.code).toBe(0);
    expect(res.data.length).toBeLessThanOrEqual(30);
    res.data.forEach((d) => {
      expect(d).toHaveProperty('date');
      expect(d).toHaveProperty('value');
    });
  });

  it('defaults to 30 days when days not specified', async () => {
    /* ... */
  });
  it('rejects invalid metric type (400)', async () => {
    /* ... */
  });
});
```

### 8.2 单元测试：admin-codes 云函数 (Jest)

```javascript
describe('admin-codes generateCodes', () => {
  it('generates specified number of invite codes', async () => {
    const res = await callFunction('admin-codes', {
      action: 'generateCodes',
      params: { codeType: 'invite', count: 10, expiresInDays: 30 },
    });
    expect(res.code).toBe(0);
    expect(res.data.codes.length).toBe(10);
    expect(res.data.batchId).toBeDefined();
  });

  it('rejects count > 500 (400)', async () => {
    /* ... */
  });
  it('requires password confirmation for count > 10', async () => {
    /* ... */
  });
  it('generated codes have ZGB- prefix', async () => {
    const res = await callFunction('admin-codes', {
      action: 'generateCodes',
      params: { codeType: 'invite', count: 1 },
    });
    expect(res.data.codes[0]).toMatch(/^ZGB-/);
  });
  it('redemption codes include planId', async () => {
    /* ... */
  });
  it('writes audit log on generate', async () => {
    /* ... */
  });
});

describe('admin-codes exportCodes', () => {
  it('requires password confirmation', async () => {
    const res = await callFunction('admin-codes', {
      action: 'exportCodes',
      params: { batchId: 'test' },
    });
    expect(res.code).toBe(400); // missing password
  });

  it('returns AES-encrypted CSV data', async () => {
    const res = await callFunction('admin-codes', {
      action: 'exportCodes',
      params: { batchId: 'test', confirmPassword: CORRECT_PW },
    });
    expect(res.data.csvData).toBeDefined();
    // 验证 AES-256 加密格式
    expect(res.data.csvData).toMatch(/^[A-Za-z0-9+/=]+$/);
  });
});
```

### 8.3 安全测试：PII 脱敏 (Jest)

```javascript
describe('content-safety-check PII sanitization', () => {
  it('replaces Chinese mobile numbers', () => {
    const input = '我的手机号是13812345678，请联系我';
    const output = sanitizePII(input);
    expect(output).not.toContain('13812345678');
    expect(output).toContain('[已脱敏的手机号]');
  });

  it('replaces HK ID numbers', () => {
    const input = '港澳通行证号C1234567';
    const output = sanitizePII(input);
    expect(output).not.toContain('C1234567');
    expect(output).toContain('[已脱敏的证件号]');
  });

  it('replaces email addresses', () => {
    const input = '发我邮箱 test@example.com';
    const output = sanitizePII(input);
    expect(output).not.toContain('test@example.com');
    expect(output).toContain('[已脱敏的邮箱]');
  });

  it('handles multiple PII in one string', () => {
    const input = '电话13812345678 邮箱test@example.com';
    const output = sanitizePII(input);
    expect(output).not.toContain('138');
    expect(output).not.toContain('test@');
  });

  it('returns empty string for null/undefined input', () => {
    expect(sanitizePII(null)).toBe('');
    expect(sanitizePII(undefined)).toBe('');
  });
});
```

### 8.4 集成测试：admin-audit-trail append-only (Jest)

```javascript
describe('admin-audit-trail append-only constraint', () => {
  it('insert succeeds', async () => {
    const res = await db.collection('admin_audit_trail').add({ data: { ... } });
    expect(res._id).toBeDefined();
  });

  it('update is rejected by cloud function layer', async () => {
    // 通过云函数间接测试：admin-stats 中的审计日志写入
    // 云函数层应使用 .add() 而非 .doc().update()
    // 验证：审计日志集合中无可更新的文档
    const logs = await db.collection('admin_audit_trail').limit(1).get();
    if (logs.data.length > 0) {
      await expect(
        db.collection('admin_audit_trail').doc(logs.data[0]._id).update({ data: { action: 'tampered' } })
      ).rejects.toThrow();
    }
  });
});
```

### 8.5 前端组件测试：MetricCard (React Testing Library)

```typescript
describe('MetricCard', () => {
  it('renders with label and value', () => {
    render(<MetricCard label="累计用户" value={1234} />);
    expect(screen.getByText('累计用户')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
  });

  it('shows trend arrow when change prop provided', () => {
    render(<MetricCard label="累计用户" value={1234} change={12} />);
    expect(screen.getByText('+12')).toBeInTheDocument();
  });

  it('renders negative trend in red', () => {
    render(<MetricCard label="日活" value={89} change={-5} />);
    const trend = screen.getByText('-5');
    expect(trend).toHaveClass('text-red-500');
  });

  it('shows loading skeleton when loading prop true', () => {
    render(<MetricCard label="累计用户" value={0} loading={true} />);
    expect(screen.getByTestId('metric-card-skeleton')).toBeInTheDocument();
  });

  it('shows "--" when value is null for empty state', () => {
    render(<MetricCard label="AI准确率" value={null} />);
    expect(screen.getByText('--')).toBeInTheDocument();
  });
});
```

### 8.6 E2E测试：运营后台登录流程 (Playwright)

```typescript
test('admin can login and see dashboard', async ({ page }) => {
  await page.goto('/admin/login');
  await page.fill('[data-testid="email-input"]', 'admin@zgb.com');
  await page.fill('[data-testid="password-input"]', 'correct-password');
  await page.click('[data-testid="login-button"]');

  // 应跳转到仪表盘
  await expect(page).toHaveURL('/admin');
  // 6个核心指标卡片应出现
  await expect(page.locator('[data-testid="metric-card"]')).toHaveCount(6);
  // Sidebar 应出现
  await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
});

test('login fails with wrong password', async ({ page }) => {
  await page.goto('/admin/login');
  await page.fill('[data-testid="email-input"]', 'admin@zgb.com');
  await page.fill('[data-testid="password-input"]', 'wrong-password');
  await page.click('[data-testid="login-button"]');
  await expect(page.locator('[data-testid="login-error"]')).toBeVisible();
});

test('unauthenticated user redirected to login', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL('/admin/login');
});

test('5 failed login attempts locks account', async ({ page }) => {
  for (let i = 0; i < 5; i++) {
    await page.fill('[data-testid="email-input"]', 'admin@zgb.com');
    await page.fill('[data-testid="password-input"]', 'wrong');
    await page.click('[data-testid="login-button"]');
  }
  // 第6次
  await page.fill('[data-testid="password-input"]', 'correct-password');
  await page.click('[data-testid="login-button"]');
  await expect(page.locator('[data-testid="login-locked"]')).toBeVisible();
});
```

### 8.7 E2E测试：邀请码生成流程 (Playwright)

```typescript
test('admin can generate invite codes', async ({ page }) => {
  await loginAsAdmin(page);
  await page.click('[data-testid="nav-codes"]');
  await page.click('[data-testid="tab-invite"]');

  // 填写生成表单
  await page.fill('[data-testid="code-count"]', '10');
  await page.selectOption('[data-testid="code-expiry"]', '30');
  await page.fill('[data-testid="batch-name"]', 'E2E测试批次');
  await page.click('[data-testid="generate-button"]');

  // 二次确认
  await page.fill('[data-testid="confirm-password"]', 'admin-password');
  await page.click('[data-testid="confirm-generate"]');

  // 验证结果
  await expect(page.locator('[data-testid="generate-success"]')).toBeVisible();
  await expect(page.locator('[data-testid="code-row"]')).toHaveCount(10);
});
```

---

## 九、环境配置

### 9.1 CloudBase 环境变量

```bash
# admin-* 云函数共享的环境变量
ADMIN_API_KEYS='{"key1":"$2b$10$hash1","key2":"$2b$10$hash2"}'    # bcrypt hash 列表
ADMIN_IP_WHITELIST='["10.0.0.1","192.168.1.0/24"]'                # IP白名单 (可选)
RATE_LIMIT_PER_MINUTE=100                                          # 单IP速率限制
PAGE_VIEW_SAMPLE_RATE=0.1                                          # 页面PV采样率
PII_PATTERNS='{"phone":"1[3-9]\\d{9}","hkid":"[A-Z]\\d{6}\\(?\\d\\)?","email":"[\\w.-]+@[\\w.-]+"}' # PII脱敏正则
ENCRYPTION_KEY='aes-256-key-32-bytes-xxxxx'                       # 兑换码CSV加密密钥
ADMIN_SESSION_TTL_SECONDS=7200                                     # 管理员会话2小时
MAX_LOGIN_ATTEMPTS=5
LOGIN_LOCK_MINUTES=15
```

### 9.2 CloudBase 静态托管配置

```json
{
  "websiteConfig": {
    "indexDocument": "index.html",
    "errorDocument": "index.html" // SPA fallback
  }
}
```

### 9.3 安全域名

```bash
# 运营后台开发/生产域名
localhost:5173       # Vite dev server
localhost:4173       # Vite preview
admin.zgb.funway.hk  # 生产域名 (待DNS配置)
```

---

## 十、技术风险缓解表

| 风险                       | 等级 | 缓解措施                                     | 验证方式       |
| :------------------------- | :--: | :------------------------------------------- | :------------- |
| API Key 泄露               |  🔴  | bcrypt 哈希存储 + 定期轮换 + IP 白名单       | 渗透测试       |
| NoSQL 写入超免费额度       |  🔴  | 1:10 采样 + 批量上传 + TTL 自动清理          | 监控 dashboard |
| 云函数冷启动导致慢响应     |  🟡  | admin-stats 单次聚合首页数据；其他页按需加载 | 性能测试       |
| 桑基图大数据量前端渲染卡顿 |  🟡  | page_view_logs 采样后限制查询窗口7天         | 性能测试       |
| 小程序埋点影响页面切换     |  🟡  | 异步非阻塞 + 批量延迟上传                    | 真机测试       |

---

_文档结束。本 TDD 为 V4 Phase 1 开发基线，对齐需求评审报告 v1.0 的 8 项 P0 修复和修正路线图。_
