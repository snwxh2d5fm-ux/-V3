# 住港伴 BI天枢 — 商业智能体系框架 v1.0

**版本**: 1.0 | **日期**: 2026-05-15
**负责人**: BI天枢 | **状态**: ✅ v1 交付
**依赖**: usage-tracker云函数(user_events+user_profiles) + WE分析 + CloudBase日志

---

## 一、架构总览 — 三层两线

```
┌─────────────────────────────────────────────────────────────────┐
│                    住港伴 BI天枢 三层两线                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────┐  ┌──────────────────────┐             │
│  │   市场数据层 🏪        │  │   运营数据层 📊        │             │
│  │   竞品/政策/行业        │──│   看板/报表/周报        │             │
│  │   policy_monitor     │  │   usage-tracker stats │             │
│  │   policy_snapshots   │  │   WE分析 Dashboard    │             │
│  └──────────┬───────────┘  └──────────┬───────────┘             │
│             │                         │                          │
│             └──────────┬──────────────┘                          │
│                        ▼                                         │
│  ┌──────────────────────────────────────────────────┐           │
│  │   产品数据层 📱 (地基)                              │           │
│  │   埋点体系 + CloudBase user_events + WE分析SDK    │           │
│  │   utils/tracker.js → usage-tracker → 事件流水     │           │
│  └──────────────────────────────────────────────────┘           │
│                                                                 │
│  两线:                                                           │
│  ① 用户行为线: page_view → event → conversion → retention        │
│  ② 商业转化线: visit → assess → register → pay → renew           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 二、三层职责

| 层 | 职责 | 数据源 | 交付物 | 更新频率 |
|---|------|--------|--------|:---:|
| 产品数据层 | 埋点规范、事件采集、会话追踪、特征工程 | user_events + WE分析SDK | 事件字典、埋点覆盖率报告 | 实时 |
| 运营数据层 | 核心KPI计算、看板、报表、异常告警 | user_events聚合 + user_profiles + orders | 日报/周报/月报、漏斗分析 | 每日 |
| 市场数据层 | 竞品监测、政策追踪、行业趋势、用户洞察 | policy_snapshots + 小红书采集 + 官网S级来源 | 政策简报、竞品月报、趋势周报 | 每周 |

## 三、核心指标金字塔

```
         ┌──────────┐
         │  LTV/CAC  │  ← 北极星 (商业健康)
         ├──────────┤
         │  付费转化  │  ← 商业指标
         ├──────────┤
         │ DAU 留 存 │  ← 核心三件套 (本框架重点)
         ├──────────┤
         │ PV UV 漏斗│  ← 基础指标
         └──────────┘
```

### 3.1 基础指标 (产品数据层)

| 指标 | 定义 | 计算方式 | 粒度 |
|------|------|---------|:---:|
| PV | 页面浏览次数 | user_events WHERE eventType='page_view' GROUP BY page | 小时/日 |
| UV | 独立访问用户数 | COUNT(DISTINCT _openid) FROM daily_active | 日 |
| DAU | 日活跃用户 | UV with any event | 日 |
| WAU | 周活跃用户 | UV over 7-day rolling window | 周 |
| MAU | 月活跃用户 | UV over 30-day rolling window | 月 |
| 新用户数 | 首次访问用户 | first_event.user_events | 日 |

### 3.2 留存指标 (运营数据层)

| 指标 | 定义 | 计算方式 |
|------|------|---------|
| 次日留存 | D0活跃用户D1仍活跃的占比 | D0∩D1 / D0 |
| 7日留存 | D0活跃用户D7仍活跃的占比 | D0∩D7 / D0 |
| 30日留存 | D0活跃用户D30仍活跃的占比 | D0∩D30 / D0 |
| 周留存率 | 自然周留存 | 当周∩上周 / 上周 |

### 3.3 转化漏斗 (运营数据层)

```
浏览首页 → 开始评估 → 完成评估 → 选择路径 → 创建流程 →
  100%       60%        40%        30%        20%
  → 添加证件 → 支付会员 → 7日回访
      15%        8%         5%
```

| 漏斗步骤 | 事件 | 目标转化率 |
|----------|------|:---:|
| 1. 曝光→访问 | page_view(home) | 100% |
| 2. 开始评估 | assessment_started | ≥60% |
| 3. 完成评估 | assessment_completed | ≥40% |
| 4. 选择路径 | path_selected | ≥30% |
| 5. 创建流程 | process_created | ≥20% |
| 6. 添加证件 | document_added | ≥15% |
| 7. 支付会员 | order_created→order_paid | ≥8% |
| 8. 7日回访 | any event within 7d of pay | ≥5% |

### 3.4 商业指标

| 指标 | 定义 | 计算方式 |
|------|------|---------|
| 付费转化率 | 付费用户/评估完成用户 | paid_users / assessment_completed |
| ARPU | 每用户平均收入 | SUM(amount) / paid_users |
| LTV (预估) | 用户生命周期价值 | ARPU × avg_lifetime_months |
| 流失率 | 30天无任何事件的用户/MAU | churned / MAU |
| 试用转化率 | 试用→付费 | paid_within_trial / trial_started |

## 四、数据流向

```
用户端 (小程序)                    云端 (CloudBase)
─────────────────                 ─────────────────

wx.onShow() ────┐
按钮点击 ────┐   │                usage-tracker云函数
表单提交 ────┤   │                    │
页面切换 ────┤   ├──→ tracker.js ──→  ├──→ user_events (事件流水)
支付完成 ────┘   │                    ├──→ user_profiles (画像更新)
                 │                    └──→ 实时聚合查询
WE分析SDK ───────┘
  └──→ WE分析Dashboard (零成本)
```

## 五、与现有系统集成

| 现有组件 | 集成方式 | 变更 |
|----------|---------|:---:|
| `usage-tracker` 云函数 | 直接使用，无需改动 | 无 |
| `utils/tracker.js` | 补全事件调用点 | 需 Claude 在各页面调用 |
| `user_events` 集合 | 当前事件类型不足，需扩展 | 新增事件类型 |
| `user_profiles` 集合 | 当前字段足够 | 无 |
| `policy_snapshots` | 接入市场数据层 | 需定时采集 cron |
| WE分析 | 配置Dashboard + 自定义事件 | 配置即可 |

## 六、v1 交付物清单

| # | 文件 | 说明 | 状态 |
|---|------|------|:---:|
| 1 | `docs/bi/framework.md` | 本文件，体系总设计 | ✅ |
| 2 | `docs/bi/events-taxonomy.md` | 事件字典 + 埋点规范 | ✅ |
| 3 | `docs/bi/kpi-dashboard.md` | 核心指标看板定义 | ✅ |
| 4 | `docs/bi/report-templates.md` | 日报/周报/月报模板 | ✅ |
| 5 | `docs/bi/market-intelligence.md` | 竞品+政策+趋势框架 | ✅ |
| 6 | `outbox/BI_analytics_cloud_function.md` | 给Claude: 分析云函数spec | ✅ |

## 七、技术债务 & 下一步

1. 🔴 **事件覆盖率** — 当前仅6种事件类型。需扩展到30+页面/按钮事件
2. 🔴 **DAU计算** — 当前无daily_active集合，需新增聚合逻辑
3. 🟡 **留存计算** — 需新增retention_cohort查询
4. 🟡 **WE分析配置** — 在小程序管理后台配置自定义事件
5. ⏳ **市场数据采集** — policy_monitor 需cron定时触发
6. ⏳ **告警规则** — 核心指标异常自动通知
