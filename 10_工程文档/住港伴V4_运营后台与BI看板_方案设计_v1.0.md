# 住港伴 V4 — 运营后台与数据监控BI看板 方案设计 v1.0

## 文档信息

| 字段 | 内容 |
|:--|:--|
| 版本 | v1.0 |
| 日期 | 2026-05-21 |
| 作者 | 生活板块PD |
| 状态 | 方案拟定，待评审 |
| 地基 | 天枢(Hermes)雏形：sync_notion.py + Notion进度同步 + admin-db页面 |
| 前置依赖 | V3已发版（代码冻结）、V4副本已建立、CloudBase环境就绪 |

---

## 一、设计原则

### 1.1 为什么不能照搬祖脉

祖脉BI的核心逻辑是"通用小程序运营看板"：DAU/留存/页面PV/事件漏斗。对住港伴来说这套逻辑不够用，原因是：

- 住港伴的用户行为围绕**身份规划生命周期**展开（评估→选路径→办证件→等续签→冲永居），不是普通App的"打开→浏览→转化"
- 核心商业指标不是留存率，而是**路径选择准确率、试用转付费率、续签准备就绪度**
- 内容质量不是PV，而是**攻略书任务完成率、证件齐全度、提醒响应率**
- 需要**按签证类型分层**的群组分析，而不是通用用户分群
- AI对话质量监控是独立维度，直接影响合规风险

### 1.2 住港伴专属设计原则

1. **以身份路径为第一分析维度**：所有数据按"优才/高才/专才/IANG/受养人/续签/永居冲刺"分层，不做无意义的全局均值
2. **生命周期漏斗替代通用漏斗**：评估→选路径→开流程→加证件→设提醒→续签准备→永居冲刺，是这个业务独有的转化链
3. **信任指标优先于流量指标**：路径选择准确率、AI回答可溯源性、政策更新及时性，这些比DAU/PV更能反映产品价值
4. **合规红线内置到看板**：敏感词检测、K2信息泄露扫描、AI安全事件必须在看板首页
5. **运营后台与小程序解耦**：运营后台是独立Web应用，不放入小程序代码包，通过CloudBase云函数读写同一数据库

---

## 二、架构总览

### 2.1 三层架构

```
┌─────────────────────────────────────────────────────┐
│              运营后台 Web App (Desktop)               │
│  React + shadcn/ui + Recharts + CloudBase JS SDK     │
│  部署于 CloudBase 静态托管 或 CloudRun                  │
├─────────────────────────────────────────────────────┤
│              BI 数据聚合层 (CloudBase云函数)            │
│  admin-stats / admin-users / admin-revenue /          │
│  admin-ai-quality / admin-content / admin-compliance  │
├─────────────────────────────────────────────────────┤
│              数据采集层 (已有 + 新增埋点)               │
│  usage-tracker / conversation_logs / user_events      │
│  + audit_logs / orders / feedback / ocr_audit         │
└─────────────────────────────────────────────────────┘
```

### 2.2 与现有系统的关系

| 现有组件 | V4变更 |
|:--|:--|
| `pages/admin-db` (小程序内数据库管理) | 保留，作为移动端轻量运维入口 |
| `sync_notion.py` (天枢的进度同步) | 保留，继续同步开发进度 |
| `usage-tracker` 云函数 | 扩展，增加住港伴专属事件类型 |
| `cloudfunctions/db-admin` | 扩展，增加stats聚合查询 |
| `cloudfunctions/ai-eval` | 保留并增强 |
| `user_events` / `user_profiles` 集合 | 扩展字段，增加身份路径维度 |

### 2.3 技术选型

| 层级 | 技术 | 原因 |
|:--|:--|:--|
| 前端框架 | React 18 + TypeScript | 与网页版保持一致技术栈 |
| UI组件库 | shadcn/ui + Tailwind CSS | 与网页版设计语言统一 |
| 图表库 | Recharts | 轻量，React原生，满足运营看板需求 |
| 后端 | CloudBase云函数 (Node.js 18) | 复用现有CloudBase基础设施 |
| 数据库 | CloudBase NoSQL (已有45个集合) | 复用，新增3个运营集合 |
| 部署 | CloudBase 静态托管 | 与网页版同一环境，域名统一管理 |
| 认证 | CloudBase Web Auth + 管理员白名单 | 复用现有auth体系 |

---

## 三、运营后台模块设计

运营后台面向内部团队（PM/运营/内容/客服），按角色授权。

### 3.1 模块总览

| # | 模块 | 目标用户 | 核心功能 |
|:--:|:--|:--|:--|
| 1 | 用户总览 | PM/运营 | 按签证类型分群、注册趋势、活跃度、试用状态 |
| 2 | 路径分析 | PM | 13条路径分布、路径切换率、评估准确率 |
| 3 | 财务看板 | 运营/财务 | 收入趋势、订单明细、试用转化、发票管理 |
| 4 | 内容运营 | 内容运营 | 攻略书阅读排行、任务完成率、政策更新追踪 |
| 5 | AI质量监控 | PM/技术 | 准确率趋势、安全事件、成本追踪、响应耗时 |
| 6 | 合规与安全 | PM/法务 | 敏感词扫描、K2泄露告警、内容审核日志 |
| 7 | 客服工单 | 客服 | 用户反馈处理、状态追踪、企微机器人联动 |
| 8 | 系统健康 | 技术 | 云函数调用量/错误率、数据库容量、API延迟 |

### 3.2 模块一：用户总览

**核心卡片**（首页仪表盘）：
- 累计注册用户数（按签证类型分层：优才 X / 高才 X / 专才 X / IANG X / 受养人 X / 其他 X）
- 今日新增 / 本周新增 / 本月新增
- 活跃用户（7日/30日，定义为至少触发一次核心事件）
- 会员分布：免费试用 X / 年卡299 X / 专业版1999 X / 企业版6999 X
- 试用状态：进行中 X / 即将到期 X / 已到期锁定 X

**用户列表**（支持筛选/搜索/导出）：
- 字段：openid(脱敏)、昵称、签证类型、当前阶段、会员等级、注册时间、最近活跃
- 筛选器：签证类型 / 会员等级 / 注册时间段 / 活跃状态
- 操作：查看详情（完整用户画像）、手动锁定/解锁、赠送试用期

### 3.3 模块二：路径分析

这是**住港伴最核心的差异化分析维度**。

**路径分布饼图**：13条身份路径的当前选择分布
**路径切换桑基图**：用户从初始评估到最终选择的路径变化流（first_path → last_path）
**评估准确率**：系统评估推荐路径 vs 用户最终选择路径的匹配度
**路径来源分布**：assessment / manual / ai_chat 三种来源的比例
**阶段进度分布**：各签证类型用户在当前路径的阶段分布（Phase 1~4）

### 3.4 模块三：财务看板

**收入概览**：今日/本周/本月收入，环比增长率
**订单列表**：订单号、用户、金额、套餐、支付状态、时间
**试用转化漏斗**：
- 开始试用 → 创建流程 → 添加证件 → 设置提醒 → 完成首月 → 付费
- 每步转化率，按签证类型分层
**发票管理**：已申请/已开具状态追踪

### 3.5 模块四：内容运营

**攻略书阅读排行**：按文章阅读量排序（需要小程序上报阅读事件）
**任务完成率**：各life_guide_task的完成比例（已完成/总分配）
**政策更新追踪**：policy_updates集合的最新动态，标注影响范围
**搜索热词**：AI对话中的高频问题Top20（脱敏后展示）

### 3.6 模块五：AI质量监控

**今日对话量** / **7日趋势**
**准确率**：最近20题评估均分，按评估类型分组（QA/评估/通用）
**安全事件计数**：内容审核拦截次数，K2信息泄露检测告警
**成本追踪**：累计API费用，日均费用趋势
**响应耗时**：P50/P95/P99延迟
**模式分布**：QA对话 / 路径评估 / 文档生成 / 通用问答

### 3.7 模块六：合规与安全

**敏感词扫描状态**：代码合规检查通过率，最近一次扫描时间
**内容审核日志**：被拦截的消息数、拦截原因分类
**K2信息泄露告警**：AI回答中包含不应披露的政策细节的次数
**OCR审计**：证件识别请求量、脱敏链路完整性

### 3.8 模块七：客服工单

**反馈列表**：状态筛选（待处理/处理中/已回复/已关闭）
**企微机器人状态**：消息收发量、自动回复率
**用户满意度**：反馈处理后的用户评分

### 3.9 模块八：系统健康

**云函数调用量**：各函数24h调用次数、错误率
**数据库容量**：各集合文档数、存储大小、索引状态
**API延迟**：云函数P50/P95响应时间

---

## 四、BI看板核心指标体系

### 4.1 一级指标（首页仪表盘）

| 指标 | 定义 | 数据源 |
|:--|:--|:--|
| 累计用户 | 总注册用户数 | users |
| 日活用户 | 当日触发核心事件的独立用户数 | user_events |
| 路径分布 | 各签证类型的用户数和占比 | user_profiles |
| 付费转化率 | 付费用户 / 试用到期用户 | users + orders |
| AI准确率 | 最近20题评估均分 | eval_results |
| 安全事件 | 今日内容审核拦截 + K2告警数 | content_moderation_logs |
| 月收入 | 当月订单实收总额 | orders |
| 合规状态 | 敏感词通过 / K2检测正常 / 政策更新同步 | 多项 |

### 4.2 二级指标（各模块详情页）

**用户维度**：
- 新用户7日留存率（注册后7天内再次活跃）
- 用户平均会话时长
- 路径切换率（改变了初始路径选择的用户占比）
- 试用到期转化率（到期后7天内付费的比例）

**内容维度**：
- 攻略书人均阅读篇数
- 任务完成率（已完成任务/总分配任务）
- 提醒响应率（已处理的提醒/总推送提醒）
- 证件齐全度（已添加证件数/应添加证件数）

**AI维度**：
- 对话轮次均值（单次对话的平均轮数）
- RAG命中率（AI回答中有知识库来源的比例）
- 用户满意度（对话后点赞/点踩比例）
- API成本/对话（平均每次对话的模型调用成本）

**商业维度**：
- ARPU（每用户平均收入）
- LTV预估（基于用户路径阶段的付费概率加权）
- 续费率（年卡到期后续费的比例）
- 客单价分布

### 4.3 专属复合指标

**续签准备就绪度**（住港伴核心指标）：
```
续签准备分 = 证件齐全度×0.3 + 居住记录完整度×0.25 
            + 提醒设置率×0.2 + 流程完成度×0.15 + AI评估分×0.1
```
按用户展示，用于识别"高风险续签失败"用户，提前干预。

**内容健康度**（攻略书质量指标）：
```
内容健康分 = 引用官方政策覆盖率×0.4 + 最近更新时间×0.3 
            + 用户完成率×0.2 + 用户反馈×0.1
```

---

## 五、数据采集增强方案

### 5.1 现有埋点盘点

已有 `usage-tracker` 云函数采集的事件类型：

| 事件 | 状态 | 
|:--|:--|
| assessment_started / assessment_completed | 已有 |
| path_selected | 已有 |
| process_created | 已有 |
| document_added | 已有 |

### 5.2 需新增的住港伴专属事件

```javascript
// 攻略书相关
guidebook_article_view    // 攻略文章阅读（含articleId, visaType, timeSpent）
guidebook_task_complete   // 任务标记完成（含taskId, taskCategory）
guidebook_task_skip       // 任务跳过（含reason）

// 证件夹相关
document_ocr_start        // OCR识别开始（含docType, fileSize）
document_ocr_complete     // OCR识别完成（含docType, fieldCount, confidence）
document_pdf_combine      // PDF拼接（含docCount, totalPages）

// 提醒器相关
reminder_created          // 提醒创建（含ruleId, deadlineDate）
reminder_responded        // 提醒响应（含action: done/snooze/skip）
reminder_push_sent        // 推送发送（含channel: subscription_msg/wecom/sms）

// AI对话相关（已由conversation_logs覆盖，此处补充业务事件）
ai_answer_helpful         // 用户点赞
ai_answer_unhelpful       // 用户点踩（含reason）
ai_source_click           // 用户点击AI回答中的来源链接

// 付费相关
trial_started             // 开始试用（含source: invite_code/direct/assessment）
order_created             // 下单（含planId, amount, couponCode）
order_paid                // 支付成功
subscription_renewed      // 续费

// 分享相关
share_card_generated      // 生成分享卡片
share_card_opened         // 分享卡片被打开
family_invite_sent        // 家庭邀请发送
family_invite_accepted    // 家庭邀请接受
```

### 5.3 数据采集原则

- **客户端上报，云端落库**：小程序通过 `wx.cloud.callFunction({ name: 'usage-tracker' })` 上报
- **异步非阻塞**：所有埋点不阻塞用户操作，失败不影响主流程
- **隐私优先**：不上报具体证件内容、聊天原文，仅上报事件类型和脱敏元数据
- **采样策略**：高频事件（如页面滚动）不采集，只采集关键决策点

---

## 六、云函数扩展计划

### 6.1 新增云函数

| 函数名 | 用途 | 调用方 |
|:--|:--|:--|
| `admin-stats` | 运营后台首页聚合数据（多集合并行查询） | 运营后台 |
| `admin-users` | 用户列表查询/筛选/导出 | 运营后台 |
| `admin-revenue` | 收入统计/订单查询/转化漏斗 | 运营后台 |
| `admin-ai-quality` | AI准确率趋势/安全事件/成本 | 运营后台 |
| `admin-content` | 攻略书阅读排行/任务统计/搜索热词 | 运营后台 |
| `admin-compliance` | 敏感词/内容审核/K2告警聚合 | 运营后台 |

### 6.2 扩展现有云函数

| 函数名 | 新增action |
|:--|:--|
| `usage-tracker` | 新增 `stats:lifecycle_funnel`（身份生命周期漏斗）、`stats:cohort_retention`（按签证类型群组留存） |
| `db-admin` | 新增 `action:aggregateStats`（跨集合聚合查询） |
| `ai-eval` | 新增 `action:daily_quality_report`（每日AI质量日报） |

### 6.3 API鉴权

所有 `admin-*` 云函数通过以下方式鉴权：
- 调用方传入 `adminToken`，云函数与 `ADMIN_TOKENS` 环境变量比对
- 运营后台登录后获取临时token，有效期2小时
- 管理员账号白名单存储在 `admin_users` 集合中

---

## 七、数据库扩展

### 7.1 新增集合

```javascript
// admin_users — 管理员账号
{
  _id: "auto",
  openid: "管理员对应的微信openid",
  role: "super_admin | pm | ops | content | cs",
  name: "姓名",
  createdAt: serverDate,
  updatedAt: serverDate
}

// admin_operation_logs — 运营操作审计
{
  _id: "auto",
  adminOpenid: "操作者openid",
  action: "lock_user | unlock_user | extend_trial | delete_content | ...",
  targetType: "user | order | content | feedback",
  targetId: "操作对象ID",
  detail: { ... },
  createdAt: serverDate
}

// daily_stats_snapshots — 每日统计快照（用于趋势图）
{
  _id: "auto",
  date: "2026-05-21",
  totalUsers: 1234,
  newUsers: 12,
  activeUsers: 89,
  payingUsers: 45,
  dailyRevenue: 29900, // 分
  aiConversations: 234,
  aiAccuracyAvg: 85.5,
  safetyEvents: 3,
  // ... 其他每日聚合指标
}
```

### 7.2 扩展已有集合

`user_profiles` 增加字段：
```javascript
{
  membershipTier: "free_trial | annual_299 | pro_1999 | enterprise_6999",
  trialStartAt: ISODate,
  trialEndAt: ISODate,
  isLocked: false,
  onboardingCompleted: false,
  lastActiveAt: ISODate,
  renewalReadinessScore: 0-100,  // 续签准备就绪度
  primaryVisaType: "qmas | ttps | asmptp | iang | dependent | ..."
}
```

---

## 八、运营后台前端技术方案

### 8.1 路由设计

```
/admin                    → 首页仪表盘（6个核心指标卡片 + 趋势图）
/admin/users              → 用户列表 + 筛选 + 详情
/admin/users/:openid      → 单个用户完整画像
/admin/paths              → 路径分析与分布
/admin/revenue            → 财务看板
/admin/revenue/orders     → 订单列表
/admin/content            → 内容运营
/admin/ai-quality         → AI质量监控
/admin/compliance         → 合规与安全
/admin/feedback           → 客服工单
/admin/system             → 系统健康
/admin/settings           → 后台设置（管理员管理、令牌配置）
```

### 8.2 首页仪表盘布局

```
┌──────────────────────────────────────────────────────┐
│  住港伴运营后台              admin@example.com [退出]  │
├──────────┬──────────┬──────────┬──────────┬──────────┤
│ 累计用户  │ 今日新增  │ 日活(7日) │ 付费转化率 │ AI准确率  │
│  1,234   │   +12    │   89     │  34.2%   │  85.5%   │
├──────────┴──────────┴──────────┴──────────┴──────────┤
│                    用户增长趋势 (30天)                  │
│              [折线图: 总用户/新用户/活跃]               │
├──────────────────────────────────────────────────────┤
│   路径分布饼图          │     试用转化漏斗             │
│  [按签证类型]           │  开始试用 → 创建流程 → ...    │
├──────────────────────────────────────────────────────┤
│         AI质量趋势 (7天)                               │
│   [折线图: 准确率 + 柱状图: 对话量]                    │
├──────────────────────────────────────────────────────┤
│  P0告警卡片（仅在异常时显示）                          │
│  🔴 敏感词未通过  🔴 K2泄露告警  🟡 云函数错误率>1%   │
└──────────────────────────────────────────────────────┘
```

### 8.3 设计规范

- 使用与网页版一致的设计Token（Dark-first深色主题）
- shadcn/ui组件库保持UI一致性
- Recharts图表配色方案：蓝色系为主色调，告警使用红色/橙色
- 响应式布局：优先桌面端（1920×1080），兼顾平板

---

## 九、实施路线图

### Phase 1：基础设施（Week 1-2，5月21日-6月4日）

| 任务 | 预估工时 | 产出 |
|:--|:--:|:--|
| V4项目初始化（React+Vite+shadcn/ui） | 1天 | 可运行的空白运营后台 |
| CloudBase Web Auth接入 + 管理员鉴权 | 2天 | 登录流程可用 |
| `admin-stats` 云函数开发 + 首页仪表盘 | 3天 | 6个核心指标卡片可用 |
| `daily_stats_snapshots` 定时快照 + 趋势图 | 2天 | 30天趋势图可用 |
| 数据采集增强：小程序端新增埋点 | 2天 | 住港伴专属事件开始采集 |

**Phase 1交付物**：可登录的运营后台首页，显示核心业务指标和趋势图。

### Phase 2：核心模块（Week 3-4，6月5日-6月18日）

| 任务 | 预估工时 | 产出 |
|:--|:--:|:--|
| `admin-users` + 用户列表/详情页 | 2天 | 用户管理可用 |
| 路径分析页面（饼图+桑基图） | 2天 | 路径分析可用 |
| `admin-revenue` + 财务看板 | 2天 | 收入/订单/转化可用 |
| `admin-ai-quality` + AI质量监控页 | 2天 | AI质量看板可用 |
| `admin-compliance` + 合规安全页 | 2天 | 合规监控可用 |

**Phase 2交付物**：运营团队可日常使用的完整运营后台。

### Phase 3：精细运营（Week 5-6，6月19日-7月2日）

| 任务 | 预估工时 | 产出 |
|:--|:--:|:--|
| `admin-content` + 内容运营页 | 2天 | 内容分析可用 |
| 客服工单模块 + 企微机器人联动 | 2天 | 客服工作台可用 |
| 系统健康监控页 | 2天 | 运维监控可用 |
| 续签准备就绪度评分系统 | 2天 | 风险用户识别 |
| 数据导出（CSV/Excel）+ 定时报表邮件 | 2天 | 报表自动化 |

**Phase 3交付物**：功能完整的运营后台 + BI看板。

---

## 十、与天枢雏形的关系

天枢此前交付了：
- `sync_notion.py` — PROGRESS.md → Notion进度同步脚本
- `admin-db` 页面 — 小程序内的数据库管理入口

V4方案在此基础上：
- **保留** `sync_notion.py`，继续用于开发进度同步到Notion
- **保留** `admin-db` 小程序页面，作为移动端轻量运维入口
- **新增** 独立Web运营后台，承担主力运营工作
- **升级** `usage-tracker` 从通用事件追踪 → 住港伴专属生命周期事件体系

不做的事情：
- 不把运营后台放进小程序代码包（体积限制+交互体验差）
- 不依赖Notion作为运营数据库（Notion是开发进度看板，不是生产运营工具）
- 不照搬祖脉的通用漏斗指标（DAU/留存/PV在身份规划业务中意义有限）

---

## 十一、风险与依赖

| 风险 | 等级 | 缓解措施 |
|:--|:--:|:--|
| 用户量小导致统计偏差 | 🟡 | 先做绝对值统计，不做过度细分；等用户量>1000后再做群组分析 |
| 数据采集完整性 | 🟡 | 埋点异步上报+失败重试；关键事件双写（Storage + CloudBase） |
| 管理员账号安全 | 🔴 | 强制CloudBase Web Auth + IP白名单 + 操作审计日志 |
| CloudBase免费额度超限 | 🟡 | 监控数据库读写次数；daily_stats_snapshots定时聚合减少实时查询 |
| 开发资源冲突 | 🟡 | Phase 1可与网页版并行开发（共享技术栈）；Phase 2-3视优先级调整 |

---

## 十二、附录：关键数据查询示例

### A. 路径分布查询（admin-stats云函数）
```javascript
// 按签证类型统计用户分布
const profiles = await db.collection('user_profiles')
  .field({ selectedPath: true, pathLabel: true })
  .get();

const distribution = {};
profiles.data.forEach(p => {
  const key = p.selectedPath || 'unknown';
  distribution[key] = (distribution[key] || 0) + 1;
});
```

### B. 试用转化漏斗（admin-revenue云函数）
```javascript
// 从user_events提取漏斗数据
const steps = [
  'trial_started',
  'process_created', 
  'document_added',
  'reminder_created',
  'order_paid'
];

const funnel = {};
for (const step of steps) {
  const res = await db.collection('user_events')
    .where({ eventType: step })
    .count();
  funnel[step] = res.total;
}
```

### C. 续签准备就绪度（user_profiles定期计算）
```javascript
// 定时云函数每日计算每个用户的续签准备分
// readinessScore = docCompleteness*0.3 + stayRecordCompleteness*0.25 
//                 + reminderSetupRate*0.2 + processCompletion*0.15 + aiAssessment*0.1
```

---

*文档结束。本方案为v1.0初稿，待技术评审和产品评审后迭代。*
