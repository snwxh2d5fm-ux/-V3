# 住港伴 V3 — usage-tracker v2 事件管道扩展方案

**作者**: BI天枢 (Hermes)
**日期**: 2026-05-15
**状态**: 🔴 待Claude实现
**依赖**: BI埋点SDK v2 (inbox/BI_埋点SDK_v2_设计方案.md)

---

## 一、现有状态

| 组件 | 能力 | 限制 |
|------|------|------|
| `utils/tracker.js` | 单条 fire-and-forget 上报 | 无批量、无离线、无采样 |
| `usage-tracker` 云函数 | 4个 action (track/stats/userProfile) | 统计查询O(n)扫描、无索引 |
| `user_events` 集合 | 原始事件存储 | 无事件命名空间、无pagePath |
| `user_profiles` 集合 | 路径偏好画像 | 仅path维度，缺页面/会话维度 |

## 二、v2 架构

```
                    ┌──────────────────────┐
                    │    bi-sdk (前端)       │
                    │  collector + reporter  │
                    └──────────┬───────────-┘
                               │ batch (每5条/10秒)
                               ▼
                    ┌──────────────────────┐
                    │  usage-tracker v2     │
                    │  ┌─────────────────┐  │
                    │  │ POST /batch     │  │  ← 批量写入 (主入口)
                    │  │ POST /track     │  │  ← 单条写入 (兼容旧)
                    │  │ POST /funnel    │  │  ← 漏斗查询
                    │  │ POST /retention │  │  ← 留存分析
                    │  │ POST /dashboard │  │  ← 仪表盘一键数据
                    │  │ POST /heatmap   │  │  ← 页面热力图
                    │  │ POST /stats     │  │  ← 统计 (旧,保留)
                    │  │ POST /profile   │  │  ← 画像查询 (旧)
                    │  └───────┬─────────┘  │
                    └──────────┼────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
      ┌──────────┐    ┌──────────────┐   ┌──────────────┐
      │user_events│    │user_sessions │   │page_heatmap  │
      │ (增强)    │    │  (新增)      │   │  (新增)      │
      └──────────┘    └──────────────┘   └──────────────┘
              │
              ▼
      ┌──────────────┐
      │funnel_snapshot│
      │  (新增)      │
      └──────────────┘
```

## 三、云函数 action 扩展

### 3.1 `batch` — 批量写入 (新)

```javascript
// Request
{
  action: 'batch',
  events: [
    {
      eventName: 'page:view',
      payload: { pagePath: 'pages/assessment/index' },
      sessionId: 's_xxx',
      timestamp: 1715760000000
    },
    // ... up to 50 events per batch
  ]
}

// Response
{
  code: 0,
  received: 45,
  written: 44,
  errors: [{ index: 23, msg: 'duplicate_1s' }]
}
```

**关键优化**:
- 一次写入最多50条（CloudBase写限制）
- 1秒内同session同事件去重
- 部分失败不影响其他事件
- 异步更新user_sessions（不阻塞返回）

### 3.2 `funnel` — 漏斗分析 (新)

```javascript
// Request
{
  action: 'funnel',
  funnelName: 'conversion',  // conversion | onboarding | deep
  startDate: '2026-05-01',
  endDate: '2026-05-15'
}

// Response (预计算)
{
  code: 0,
  data: {
    funnelName: 'conversion',
    period: '14天',
    totalUsers: 342,
    steps: [
      { step: 'assessment_started',     users: 342, rate: '100%', dropOff: '0%' },
      { step: 'assessment_completed',   users: 291, rate: '85%',  dropOff: '15%' },
      { step: 'path_selected',          users: 267, rate: '78%',  dropOff: '8%' },
      { step: 'process_created',        users: 198, rate: '58%',  dropOff: '26%' },
      { step: 'document_added',         users: 143, rate: '42%',  dropOff: '28%' },
      { step: 'payment_complete',       users:  42, rate: '12%',  dropOff: '71%' }
    ]
  }
}
```

**三个预定义漏斗**:

| 漏斗名 | 步骤序列 |
|--------|----------|
| `conversion` | 评估开始→评估完成→路径选择→流程创建→证件添加→支付完成 |
| `onboarding` | 首次启动→注册→评估→首路径→首任务完成 |
| `deep` | 启动→主页→攻略浏览→AI对话→分享→7日留存 |

### 3.3 `retention` — 留存分析 (新)

```javascript
// Request
{
  action: 'retention',
  metric: 'day7',     // day1 | day7 | day30
  startDate: '2026-05-01',
  endDate: '2026-05-07'
}

// Response
{
  code: 0,
  data: {
    metric: 'day7',
    cohorts: [
      { date: '05-01', newUsers: 48, d1: '63%', d3: '42%', d7: '29%' },
      { date: '05-02', newUsers: 52, d1: '58%', d3: '38%', d7: '25%' },
      // ...
    ]
  }
}
```

### 3.4 `dashboard` — 一键仪表盘 (新)

```javascript
// Request
{ action: 'dashboard' }

// Response (一次性返回所有关键指标)
{
  code: 0,
  data: {
    today: {
      activeUsers: 127,
      newUsers: 18,
      totalEvents: 892,
      avgSessionDuration: '4m32s',
      conversionRate: '12%'
    },
    week: { /* same shape */ },
    month: { /* same shape */ },
    topPages: [
      { pagePath: 'pages/assessment/index', views: 342 },
      { pagePath: 'pages/guidebooks/index/index', views: 218 },
      // ...
    ],
    topFunnels: { /* from funnel snapshots */ }
  }
}
```

### 3.5 `heatmap` — 页面热力图 (新)

```javascript
// Request
{
  action: 'heatmap',
  pagePath: 'pages/assessment/index',
  days: 7
}

// Response
{
  code: 0,
  data: {
    pagePath: 'pages/assessment/index',
    period: '7天',
    totalViews: 342,
    avgStayDuration: '2m18s',
    avgScrollDepth: 65,       // 平均滚动到65%
    bounceRate: '18%',        // 仅浏览一页即离开
    entryRate: '42%',         // 作为首屏进入的比例
    exitRate: '22%',          // 作为最后页离开的比例
    dailyBreakdown: [
      { date: '05-09', views: 48, avgStay: '2m05s', avgScroll: 62 },
      // ...
    ]
  }
}
```

## 四、数据库集合变更

### 4.1 user_events — 增强现有字段

```javascript
// 新增字段（非破坏性，保持向后兼容）
{
  // 现有字段保持不变
  _openid, eventType, payload, platform, appVersion, createdAt, sessionId,
  
  // v2 新增
  eventName: 'biz:assessment_complete',  // 新命名空间
  pagePath: 'pages/assessment/index',    // 页面路径
  priority: 0,                           // 0=P0 1=P1 2=P2 3=P3
  deviceInfo: {                          // 设备信息
    model: 'iPhone 14 Pro',
    system: 'iOS 18.0',
    pixelRatio: 3,
    screenWidth: 393,
    screenHeight: 852
  }
}
```

**索引需求**:
```
- eventName + createdAt (漏斗查询)
- eventType + createdAt (向后兼容)
- pagePath + createdAt (热力图)
- sessionId (会话关联)
- _openid + createdAt (用户查询)
```

### 4.2 user_sessions — 新增

```javascript
{
  _id: auto,
  _openid: 'xxx',
  sessionId: 's_1715760000_a1b2',
  startTime: 1715760000000,
  endTime: 1715760300000,
  duration: 298,              // 秒
  pageCount: 7,               // 浏览页面数
  eventCount: 42,             // 事件总数
  entryPage: 'pages/index/index',
  exitPage: 'pages/assessment/index',
  entryScene: 1001,           // 微信启动场景值
  deviceModel: 'iPhone 14 Pro',
  system: 'iOS 18.0',
  createdAt: ServerDate
}
```

### 4.3 page_heatmap — 新增（每日聚合）

```javascript
{
  _id: auto,
  pagePath: 'pages/assessment/index',
  date: '2026-05-15',         // YYYY-MM-DD
  viewCount: 48,
  uniqueUsers: 42,
  avgStayDuration: 138,       // 秒
  avgScrollDepth: 65,         // 百分比(25/50/75/100)
  bounceCount: 8,             // 单页离开 = exit
  entryCount: 20,             // 入口页
  exitCount: 11,              // 离开页
  createdAt: ServerDate
}
```

### 4.4 funnel_snapshot — 新增（每日快照）

```javascript
{
  _id: auto,
  funnelName: 'conversion',
  date: '2026-05-15',
  totalUsers: 48,
  steps: [
    { step: 'assessment_started',    users: 48, dropOffPct: 0 },
    { step: 'assessment_completed',  users: 41, dropOffPct: 15 },
    { step: 'path_selected',         users: 38, dropOffPct: 7 },
    { step: 'process_created',       users: 22, dropOffPct: 42 },
    { step: 'document_added',        users: 15, dropOffPct: 32 },
    { step: 'payment_complete',      users:  3, dropOffPct: 80 }
  ],
  createdAt: ServerDate
}
```

## 五、定时任务

### 5.1 每日漏斗快照 (CloudBase定时触发)

```javascript
// 每天凌晨2点运行，计算前一天的漏斗快照
// 写入 funnel_snapshot 集合
exports.main = async () => {
  const yesterday = getYesterdayDate();
  // 对每个漏斗定义，查询user_events计算steps
  for (const funnelName of ['conversion', 'onboarding', 'deep']) {
    const snapshot = await computeFunnel(funnelName, yesterday);
    await db.collection('funnel_snapshot').add({ data: snapshot });
  }
};
```

### 5.2 每日热力图 (CloudBase定时触发)

```javascript
// 每天凌晨3点运行，聚合前一天页面数据
exports.main = async () => {
  const yesterday = getYesterdayDate();
  const topPages = await getTopPages(yesterday);
  
  for (const pagePath of topPages) {
    const stats = await computePageStats(pagePath, yesterday);
    await db.collection('page_heatmap').add({ data: stats });
  }
};
```

## 六、性能考量

| 指标 | v1 (当前) | v2 (目标) |
|------|----------|----------|
| 单事件写入延迟 | ~200ms | ~50ms (批量) |
| 批量写入(50条) | N/A | ~300ms |
| 漏斗查询(30天) | 6次count全扫描 | 预计算 <100ms |
| 仪表盘查询 | N/A | <500ms |
| 离线缓存 | 无 | wx.storage + 重放 |

**关键优化策略**:
1. **批量写入** — 50条/次，减少云函数调用次数
2. **预计算** — 漏斗和热力图每日凌晨计算，查询读快照
3. **session异步更新** — batch返回后再更新user_sessions，不阻塞前端
4. **索引策略** — eventName+createdAt 复合索引覆盖90%查询

## 七、与 reminder-engine 的事件桥接

现有的 `utils/rule-engine.js` 中已定义事件触发器：
- `visa_activated` → 续签提醒
- `visa_expiring` → 到期提醒
- `pr_eligible` → 永居资格提醒
- `iang_24mo_expiring` → IANG到期提醒
- `qmas_assessment_started` → 评估提醒
- `ttps_24mo_expiring` → TTPS到期提醒

v2管道统一接入方式：
```javascript
// bi-sdk 上报业务事件
biSdk.track('biz:visa_activated', { activationDate: '2026-05-15' });
biSdk.track('biz:visa_expiring', { expiryDate: '2026-07-01' });

// usage-tracker v2 新增 action: 'trigger'
// 云函数写事件后，检查是否需要触发提醒
// 如果触发 → 调用 reminder-engine 云函数
```

## 八、实现清单

| 优先级 | 任务 | 文件 | 工作量 |
|:-------|------|------|:------:|
| P0 | usage-tracker 添加 batch action | cloudfunctions/usage-tracker/index.js | 0.5d |
| P0 | batch 去重 + 部分失败容错 | 同上 | 0.5d |
| P1 | 创建 user_sessions 集合 + 索引 | CloudBase console | 0.25d |
| P1 | 创建 page_heatmap 集合 + 索引 | CloudBase console | 0.25d |
| P1 | 创建 funnel_snapshot 集合 + 索引 | CloudBase console | 0.25d |
| P1 | dashboard action 实现 | usage-tracker/index.js | 0.5d |
| P1 | funnel action 实现 | usage-tracker/index.js | 1d |
| P2 | retention action 实现 | usage-tracker/index.js | 1d |
| P2 | heatmap action 实现 | usage-tracker/index.js | 0.5d |
| P2 | 每日漏斗快照定时任务 | cloudfunctions/daily-funnel-snapshot/ | 0.5d |
| P2 | 每日热力图定时任务 | cloudfunctions/daily-heatmap/ | 0.5d |
| P3 | event→reminder 桥接 | usage-tracker + reminder-engine | 0.5d |
