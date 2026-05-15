# 📤 Outbox — BI天枢分析云函数 + 埋点集成

**To**: Claude (唯一代码来源)
**From**: BI天枢
**Date**: 2026-05-15
**Priority**: P1
**Deps**: `utils/tracker.js` (已有), `cloudfunctions/usage-tracker` (已有)

---

## 任务1: usage-tracker 扩展 — DAU/留存查询

当前 `usage-tracker` 的 `getStats` 只支持 path_preference / funnel / user_summary。
需要新增以下统计查询：

### 1.1 DAU查询 (action=stats, type=dau)

```javascript
// 输入: { action: 'stats', type: 'dau', days: 7 }
// 返回:
{
  code: 0,
  data: {
    daily: [
      { date: '2026-05-14', dau: 287, newUsers: 42 },
      { date: '2026-05-13', dau: 256, newUsers: 38 },
      // ...最近days天
    ]
  }
}
```

实现: 按天 GROUP BY 统计 `user_events` 中 DISTINCT `_openid`

### 1.2 留存查询 (action=stats, type=retention)

```javascript
// 输入: { action: 'stats', type: 'retention', targetDate: '2026-05-14', dayN: 7 }
// 返回:
{
  code: 0,
  data: {
    targetDate: '2026-05-14',
    cohortSize: 42,  // D0活跃用户数
    dayN: 7,
    retained: 10,     // D0∩D7用户数
    rate: 0.238       // 23.8%
  }
}
```

### 1.3 事件摘要 (action=stats, type=event_summary)

```javascript
// 输入: { action: 'stats', type: 'event_summary', days: 7 }
// 返回: 各类事件count + 去重用户数
{
  code: 0,
  data: {
    period: '7天',
    events: [
      { eventType: 'page_view', count: 12400, uniqueUsers: 1890 },
      { eventType: 'assess_start', count: 980, uniqueUsers: 980 },
      // ...
    ]
  }
}
```

### 1.4 热门内容 (action=stats, type=top_content)

```javascript
// 输入: { action: 'stats', type: 'top_content', days: 7, limit: 10 }
// 返回: 按 guide_view_detail 统计的 articleId topN
```

---

## 任务2: 新建 daily_stats 聚合集合 (集合: daily_stats)

每日00:05由定时触发器写入前一天聚合数据，避免重复计算。

```javascript
// Schema
{
  date: '2026-05-14',       // 字符串日期
  dau: 287,                  // 日活
  wau: 1890,                 // 周活(滚动)
  mau: 5200,                 // 月活(滚动)
  newUsers: 42,              // 新增用户
  eventCounts: {             // 各事件总数
    assess_completed: 35,
    path_selected: 28,
    document_added: 12,
    process_created: 15,
    chat_send: 89
  },
  revenue: 384,              // 日收入(¥)
  orderCount: 6,             // 订单数
  paidUsers: 6,              // 付费用户数
  funnel: [287, 160, 35, 28, 15, 12, 6],  // 各步count
  createdAt: serverDate
}
```

### 实现方式

新增云函数 `daily-aggregator`:

```javascript
// 功能: 每日00:05执行
// 1. 统计昨日 user_events (DAU/新用户/事件分布)
// 2. 统计昨日 orders (收入/订单数)
// 3. 计算漏斗
// 4. 写入 daily_stats 集合
// 5. 可选: 更新 PROGRESS.md 健康度数据
```

Timer触发器配置: `0 5 0 * * * *` (每天00:05)

---

## 任务3: 页面级埋点集成

在每个页面的 `onShow` 中调用 `utils/tracker.js`:

```javascript
// 每个 page.js 的 onShow 中加入:
const { track } = require('../../utils/tracker');

Page({
  onShow() {
    track('page_view', { page: 'pages/assessment/index' });
  }
});
```

### 需要集成的页面清单 (P1 优先):

| 页面路径 | 事件 | 优先级 |
|---------|------|:---:|
| pages/assessment/index | page_view | P1 |
| pages/assessment/result | page_view | P1 |
| pages/guidebooks/index | page_view | P1 |
| pages/guidebooks/detail | page_view | P1 |
| pages/process/index | page_view | P1 |
| pages/documents/index | page_view | P1 |
| pages/documents/add | page_view | P1 |
| pages/documents/detail | page_view | P1 |
| pages/precheck/index | page_view | P1 |
| pages/chat/index | page_view | P1 |
| pages/membership/index | page_view | P1 |
| pages/mine/index | page_view | P1 |
| pages/guide/index | page_view | P2 |
| pages/reminders/index | page_view | P2 |
| pages/login | page_view | P2 |

### app.js 全局事件 (P0 优先):

```javascript
// app.js
const { track } = require('./utils/tracker');

App({
  onLaunch(opts) {
    track('app_launch', { scene: opts.scene, path: opts.path });
  },
  onShow(opts) {
    track('app_show', { scene: opts.scene });
  },
  onHide() {
    // 获取当前页面
    const pages = getCurrentPages();
    const page = pages.length > 0 ? pages[pages.length-1].route : '';
    track('app_hide', { page });
  },
  onError(msg) {
    track('error', { errorType: 'js', message: msg });
  }
});
```

---

## 任务4: WE分析自定义事件配置

在小程序管理后台 → WE分析 → 自定义事件，添加以下事件:
- `assess_completed`
- `path_selected`
- `process_created`  
- `document_added`
- `order_paid`
- `chat_send`

配置后可在WE分析Dashboard中直接查看漏斗。

---

## 验收标准

- [ ] `usage-tracker` stats 新增 dau/retention/event_summary/top_content 四种查询
- [ ] `daily-aggregator` 云函数创建 + timer触发器配置
- [ ] `daily_stats` 集合创建
- [ ] app.js 全局事件注入
- [ ] 12个P1页面 onShow 添加 page_view track
- [ ] WE分析自定义事件配置
- [ ] 本地测试: 打开任意3个页面 → user_events中出现对应记录
