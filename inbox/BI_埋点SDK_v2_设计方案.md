# 住港伴 V3 — BI埋点SDK v2 设计方案

**作者**: BI天枢 (Hermes)
**日期**: 2026-05-15
**版本**: v2.0
**状态**: 🔴 待Claude实现

---

## 一、设计目标

当前 `utils/tracker.js` 是一个轻量级的 fire-and-forget 上报工具，缺乏结构化事件体系。
v2 升级为**完整的埋点SDK**，满足：

1. **事件分类体系** — 不是零散的 eventType 字符串，而是结构化的事件命名空间
2. **页面自动埋点** — onShow/onHide 自动采集，不依赖开发者在每页手动调用
3. **用户行为链路** — session + page flow + conversion funnel 完整追踪
4. **非WE分析独立** — 不依赖微信分析平台，数据在自己CloudBase数据库
5. **向后兼容** — 现有 `tracker.track(eventType, payload)` 调用无需修改

---

## 二、事件分类体系

### 2.1 事件命名空间 (三层)

```
domain:action:detail
```

| 域 | 说明 | 示例 |
|----|------|------|
| `app` | 应用生命周期 | `app:launch`, `app:background`, `app:foreground` |
| `page` | 页面生命周期 | `page:view`, `page:leave`, `page:share` |
| `user` | 用户行为 | `user:click`, `user:input`, `user:swipe` |
| `biz` | 业务事件 | `biz:assessment_complete`, `biz:path_select` |
| `error` | 异常事件 | `error:api_fail`, `error:render_fail` |
| `perf` | 性能事件 | `perf:page_load`, `perf:api_latency` |

### 2.2 完整事件表

#### 自动采集（SDK内部自动上报，无需业务代码调用）

| 事件名 | 触发时机 | 关键字段 |
|--------|----------|----------|
| `app:launch` | onLaunch | scene, query, referrerInfo |
| `app:background` | onHide(onApp) | stayDuration |
| `app:foreground` | onShow(onApp) | - |
| `page:view` | onShow(perPage) | pagePath, pageId, query |
| `page:leave` | onHide(perPage) | stayDuration, scrollDepth |
| `page:scroll_depth` | onPageScroll | depth (25/50/75/100) |
| `error:js` | onError / App.onUnhandledRejection | errorMsg, stack, pagePath |

#### 手动调用（业务代码显式调用）

| 事件名 | 说明 | payload |
|--------|------|---------|
| `biz:assessment_start` | 开始评估 | persona, answers |
| `biz:assessment_complete` | 评估完成 | persona, recommendedPath, score |
| `biz:path_select` | 选择路径 | pathType, pathLabel, source(assessment/manual/ai_chat) |
| `biz:path_switch` | 切换路径 | fromPath, toPath, switchCount |
| `biz:process_create` | 创建流程 | processType, pathType |
| `biz:process_step_complete` | 完成步骤 | stepId, stepName, duration |
| `biz:document_add` | 添加证件 | docType, docCategory |
| `biz:document_ocr` | OCR识别 | docType, result(ok/fail), latency |
| `biz:guidebook_view` | 查看攻略 | guidebookId, section |
| `biz:guidebook_bookmark` | 收藏攻略 | guidebookId |
| `biz:housing_search` | 找房搜索 | district, budget, housingType |
| `biz:housing_view_detail` | 查看房源详情 | estateId |
| `biz:ai_chat_start` | AI对话开始 | chatContext |
| `biz:ai_chat_message` | AI消息 | role(user/assistant), length |
| `biz:ai_chat_rating` | AI评分 | rating(1-5) |
| `biz:payment_start` | 支付开始 | productId, amount |
| `biz:payment_complete` | 支付完成 | orderId, amount |
| `user:click` | 通用点击 | elementId, pagePath, text |
| `user:share` | 分享 | from, target |

#### 性能事件（条件采样 10%）

| 事件名 | 触发时机 | 关键字段 |
|--------|----------|----------|
| `perf:page_load` | 页面首次渲染完成 | pagePath, loadTime, fcp |
| `perf:api_latency` | 云函数调用完成 | apiName, latency, status |

### 2.3 事件优先级

| 优先级 | 说明 | 采样策略 |
|--------|------|:--------:|
| P0 | 核心业务漏斗 | 100% |
| P1 | 用户行为 | 100% |
| P2 | 探索性 | 50% |
| P3 | 调试/性能 | 10% |

---

## 三、SDK架构设计

### 3.1 文件结构

```
utils/
├── tracker.js          ← (旧) 保留向后兼容，内部调用 tracker-v2
├── bi-sdk/
│   ├── index.js        ← SDK入口: 自动挂载 + 导出 track()
│   ├── events.js       ← 事件定义：命名空间 + 优先级表
│   ├── collector.js    ← 采集器：app/page生命周期劫持
│   ├── reporter.js     ← 上报器：队列 + 批量 + 离线缓存
│   ├── session.js      ← 会话管理：sessionId + pageFlow
│   ├── sampling.js     ← 采样器：按优先级采样
│   └── types.d.js      ← JSDoc类型定义
```

### 3.2 SDK入口 (bi-sdk/index.js)

```
// 在 app.js 第一行引入：
// var biSdk = require('./utils/bi-sdk/index');
// biSdk.init(app);

module.exports = {
  init(app),       // 初始化：注入app/page生命周期钩子
  track(event, payload),  // 手动上报
  setUser(userId),        // 设置用户标识
  setPageContext(ctx),    // 设置页面上下文（page.onShow调用）
  getSession(),           // 获取当前会话信息
  flush()                 // 手动刷队列
}
```

### 3.3 采集器 (collector.js)

采用**劫持生命周期**而非轮询：

1. `init(app)` → 包装 App() 的 onLaunch/onShow/onHide
2. 在每个页面通过 getCurrentPages() 注入，或通过 Mixin 方式
3. 自动采集：`app:launch`, `app:background`, `app:foreground`, `page:view`, `page:leave`, `page:scroll_depth`

### 3.4 上报器 (reporter.js) — 关键设计

```
┌────────┐   ┌─────────┐   ┌──────────┐   ┌──────────────┐
│ track() ├──→│ 采样器   ├──→│ 事件队列  ├──→│ 批量上报      │
└────────┘   │ (10-100%)│   │ (内存500) │   │ (每5条/10秒) │
             └─────────┘   └────┬─────┘   └──────┬───────┘
                                │                 │
                                ▼                 ▼
                         ┌──────────────┐  ┌──────────────┐
                         │ 离线缓存      │  │ wx.cloud     │
                         │ (wx.storage)  │  │ .callFunction │
                         └──────────────┘  └──────┬───────┘
                                                  │
                                                  ▼
                                         ┌────────────────┐
                                         │ usage-tracker   │
                                         │ (云函数)        │
                                         └────────┬───────┘
                                                  │
                                                  ▼
                                         ┌────────────────┐
                                         │ user_events     │
                                         │ (CloudBase集合) │
                                         └────────────────┘
```

**队列策略**：
- 内存队列：最多500条，防止内存溢出
- 批量上报：每5条或每10秒（取先到者）
- 离线缓存：wx.setStorage 兜底，网络恢复后重放
- 去重：同一事件 1 秒内去重

### 3.5 会话管理 (session.js)

```
Session {
  sessionId: "s_1715760000_a1b2",
  startTime: 1715760000000,
  pageFlow: [
    { page: "pages/index/index", enterTime: xxx, leaveTime: xxx, scrollDepth: 75 },
    { page: "pages/assessment/index", enterTime: xxx, leaveTime: null },
  ],
  eventCount: 42,
  firstEventTime: 1715760000000,
  lastEventTime: 1715760100000
}
```

---

## 四、数据管道扩展 (usage-tracker v2)

### 4.1 usage-tracker 云函数增强

现有功能：track / stats / userProfile 三个 action
v2 增加：batch / funnel / retention / dashboard

```javascript
// 新增 action
case 'batch':        // 批量写入事件
case 'funnel':       // 实时漏斗查询
case 'retention':    // 留存分析
case 'dashboard':    // 仪表盘一键数据
case 'heatmap':      // 页面热力图（page:view 聚合）
```

### 4.2 数据库集合设计

```
user_events (现有) ← 增强：增加命名空间事件
  - _openid, eventType → eventName (二选一，向后兼容)
  - pagePath, sessionId, timestamp
  - payload (JSON)

user_sessions (新增)
  - _openid, sessionId
  - startTime, endTime, duration
  - pageCount, eventCount
  - entryPage, exitPage

page_heatmap (新增)
  - pagePath, date
  - viewCount, avgStayDuration, avgScrollDepth
  - bounceRate (单页离开率)

funnel_snapshot (新增)
  - funnelName, date
  - steps: [{name, count, dropOff}]
```

### 4.3 自动采集触发点

不需要业务代码改动，SDK自动在以下位置注入：

1. **app.js** → `biSdk.init(app)` — 一行代码启动
2. **每个页面自动挂载** — 通过 Page() 包装实现，开发者无需在每页调用 `page:view`

---

## 五、与 WE分析 的关系

| 对比 | WE分析 | 自建SDK |
|------|--------|---------|
| 数据归属 | 腾讯平台 | CloudBase自有 |
| 自定义事件 | 有限 | 无限自定义 |
| 实时查询 | 延迟1h+ | 近实时 |
| 数据导出 | 受限 | SQL/API自由查询 |
| 用户画像 | 基础 | 与业务数据关联 |
| 费用 | 免费 | 云函数调用+数据库读 |

**策略**: 双轨并行 — WE分析保留作为兜底，自建SDK为主力。

---

## 六、向后兼容

旧的 `utils/tracker.js` 调用保持不变：

```javascript
var { track } = require('../../utils/tracker');
track('assessment_completed', { persona: 1, score: 85 });
```

v2 SDK自动映射旧事件名 → 新命名空间：
- `assessment_completed` → `biz:assessment_complete`
- `path_selected` → `biz:path_select`
- `process_created` → `biz:process_create`
- `document_added` → `biz:document_add`

---

## 七、实现优先级

| 优先级 | 模块 | 工作量 | 依赖 |
|:-------|------|:------:|------|
| P0 | 事件分类体系 (events.js) | 0.5d | 无 |
| P0 | SDK入口 + 向后兼容 (index.js + tracker.js) | 0.5d | events.js |
| P1 | 采集器 (collector.js — app/page生命周期) | 1d | index.js |
| P1 | 上报器 (reporter.js — 队列+批量+离线) | 0.5d | collector.js |
| P1 | 会话管理 (session.js) | 0.5d | collector.js |
| P2 | usage-tracker v2 云函数增强 | 1d | reporter.js |
| P2 | 采样器 (sampling.js) | 0.5d | reporter.js |
| P3 | 数据库集合 (sessions/heatmap/funnel) | 0.5d | usage-tracker v2 |

---

## 八、下一步

1. **本方案审批**: 琅琊审阅 → 放行后分派给 Claude 实现
2. **Notion看板**: BI天枢并行搭建 Notion 同步（见 inbox/BI_Notion看板方案.md）
3. **实现**: Claude 按优先级顺序实现 SDK 模块
