# 住港伴 BI天枢 — 埋点事件字典 v1.0

**版本**: 1.0 | **日期**: 2026-05-15
**依赖**: utils/tracker.js → cloudfunctions/usage-tracker → user_events集合

---

## 一、事件命名规范

```
{domain}_{action}

domain: page | assess | path | process | doc | pay | chat | guide | reminder | setting
action: view | start | complete | submit | cancel | click | add | delete | switch
```

示例: `assess_start`, `doc_add`, `pay_order_complete`

## 二、通用属性 (每条事件必带)

| 属性 | 类型 | 说明 | 示例 |
|------|------|------|------|
| sessionId | string | 会话ID，由tracker.js自动管理 | "s_1715772000_a3k2" |
| platform | string | 微信客户端平台 | "ios" / "android" |
| appVersion | string | 小程序版本号 | "3.0.0" |
| page | string | 当前页面路径 | "pages/assessment/index" |
| timestamp | serverDate | 服务端时间戳 | 自动 |
| _openid | string | 用户标识 | 自动 |

## 三、事件定义

### 3.1 全局事件 (自动采集)

| 事件名 | 触发时机 | 属性 | 优先级 |
|--------|---------|------|:---:|
| `app_launch` | 小程序启动 | scene(场景值), path | P0 |
| `app_show` | 切回前台 | prevPage, duration_hidden_ms | P0 |
| `app_hide` | 切到后台 | page, duration_ms | P0 |
| `page_view` | 页面显示 (onShow) | page, referrer | P1 |
| `page_leave` | 页面隐藏 (onHide) | page, duration_ms | P1 |
| `error` | JS异常 / 云函数失败 | errorType, message, stack | P1 |

### 3.2 评估流程

| 事件名 | 触发时机 | 额外属性 | 现有 |
|--------|---------|---------|:---:|
| `assess_start` | 点击"开始评估" | source (home_banner / tab / guide) | ✅ |
| `assess_answer` | 每题选择后 | questionIndex, answerValue | ❌ |
| `assess_complete` | 评估提交完成 | resultPersona, resultPaths, duration_s | ✅ |
| `assess_view_result` | 查看评估结果页 | personaId, recommendedPaths | ❌ |
| `assess_restart` | 点击"重新评估" | - | ❌ |

### 3.3 路径选择

| 事件名 | 触发时机 | 额外属性 | 现有 |
|--------|---------|---------|:---:|
| `path_select` | 用户选定路径 | pathType, pathLabel, source(assess/manual/chat) | ✅ |
| `path_switch` | 用户切换路径 | fromPath, toPath, reason | ❌ |
| `path_detail_view` | 查看路径详情 | pathType | ❌ |

### 3.4 流程管理

| 事件名 | 触发时机 | 额外属性 | 现有 |
|--------|---------|---------|:---:|
| `process_create` | 创建新流程 | templateId, pathName | ✅ |
| `process_phase_advance` | 阶段前进 | phase, prevPhase | ❌ |
| `process_milestone_check` | 里程碑核验 | milestoneKey, passed | ❌ |
| `process_view` | 查看流程详情 | templateId, currentPhase | ❌ |

### 3.5 证件管理

| 事件名 | 触发时机 | 额外属性 | 现有 |
|--------|---------|---------|:---:|
| `doc_add_start` | 点击添加证件 | docType | ❌ |
| `doc_upload` | 上传图片完成 | docType, fileSize, duration_ms | ❌ |
| `doc_ocr_complete` | OCR识别完成 | docType, ocrSuccess, fieldsExtracted | ❌ |
| `doc_add_complete` | 证件添加成功 | docType, slotKey, mode | ✅ |
| `doc_view` | 查看证件详情 | docType | ❌ |
| `doc_delete` | 删除证件 | docType, reason | ❌ |

### 3.6 预审

| 事件名 | 触发时机 | 额外属性 | 现有 |
|--------|---------|---------|:---:|
| `precheck_start` | 发起预审 | processType, docCount | ❌ |
| `precheck_complete` | 预审结果返回 | passed, riskLevel, issueCount | ❌ |
| `precheck_view_report` | 查看预审报告 | riskItems, score | ❌ |

### 3.7 支付

| 事件名 | 触发时机 | 额外属性 | 现有 |
|--------|---------|---------|:---:|
| `pay_view_plans` | 查看会员方案 | - | ❌ |
| `pay_order_create` | 创建订单 | planId, period, amount | ❌ |
| `pay_order_complete` | 支付成功 | planId, amount, duration_ms | ❌ |
| `pay_order_fail` | 支付失败 | planId, failReason | ❌ |

### 3.8 AI对话

| 事件名 | 触发时机 | 额外属性 | 现有 |
|--------|---------|---------|:---:|
| `chat_start` | 进入对话 | mode(assess/qa/general) | ❌ |
| `chat_send` | 发送消息 | mode, messageLength, sessionId | ❌ |
| `chat_response` | 收到回复 | mode, responseLength, latency_ms | ❌ |
| `chat_feedback` | 点赞/踩 | mode, rating(1/0), sessionId | ❌ |
| `chat_end` | 退出对话(反切) | mode, sessionId, duration_ms, msgCount | ❌ |

### 3.9 攻略书

| 事件名 | 触发时机 | 额外属性 | 现有 |
|--------|---------|---------|:---:|
| `guide_view_list` | 查看攻略列表 | domain(QMAS/TTPS/IANG) | ❌ |
| `guide_view_detail` | 查看文章详情 | articleId, domain | ❌ |
| `guide_search` | 搜索攻略 | query, resultCount | ❌ |
| `guide_feedback` | 有用/无用 | articleId, useful(bool) | ❌ |

### 3.10 提醒

| 事件名 | 触发时机 | 额外属性 | 现有 |
|--------|---------|---------|:---:|
| `reminder_create` | 创建提醒 | type, deadline, confidence | ❌ |
| `reminder_complete` | 标记完成 | type, duration_days | ❌ |
| `reminder_snooze` | 延迟提醒 | type, snoozeDuration | ❌ |

### 3.11 设置/个人中心

| 事件名 | 触发时机 | 额外属性 | 现有 |
|--------|---------|---------|:---:|
| `setting_privacy_change` | 修改隐私设置 | mode, changed | ❌ |
| `setting_membership_view` | 查看会员页 | level, daysLeft | ❌ |
| `setting_login` | 登录成功 | loginType | ❌ |
| `profile_view` | 查看个人中心 | membershipLevel | ❌ |

## 四、优先级 & 实施计划

| 优先级 | 数量 | 说明 | 目标阶段 |
|:---:|:---:|------|:---:|
| P0 | 6 | 全局+漏斗核心事件 (automatic) | 立即 |
| P1 | 12 | 页面浏览+核心交互 | v1.1 |
| P2 | 15 | 细节交互+反馈 | v1.2 |
| P3 | 5 | 设置/边缘事件 | v1.3 |

### P0 立即实施 (app.js 全局注入)

```javascript
// app.js onLaunch / onShow / onHide 中注入
const { track } = require('./utils/tracker');

App({
  onLaunch(opts) {
    track('app_launch', { scene: opts.scene, path: opts.path });
  },
  onShow(opts) {
    track('app_show', { scene: opts.scene });
  },
  onHide() {
    track('app_hide', { page: getCurrentPage() });
  },
  onError(msg) {
    track('error', { errorType: 'js', message: msg });
  }
});
```

### P1 页面上报 (Claude实现 — 见 outbox)

每个 page.onShow() 中调用: `track('page_view', { page: 'pages/xxx/index' })`

## 五、现有事件 vs 需新增

| 状态 | 事件数 | 事件 |
|:---:|:---:|------|
| ✅ 已有 | 6 | assess_started, assess_completed, path_selected, process_created, document_added, page_view(部分) |
| ❌ 需new | 28 | 见上方各模块标记 |
| 🔧 需改造 | 2 | assess_started → assess_start (统一命名) |

## 六、数据治理

- 所有事件写入 `user_events` 集合，保留90天后归档至 `user_events_archive`
- PII 脱敏: openid 由云函数自动注入，不上传手机号/身份证
- 事件数据仅用于聚合统计，不做单用户行为追踪
- 采集频率: 同一事件5秒内去重(sessionId + eventType)
