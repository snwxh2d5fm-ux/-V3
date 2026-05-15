# 住港伴 BI天枢 — 核心指标看板 v1.0

**版本**: 1.0 | **日期**: 2026-05-15
**数据源**: usage-tracker云函数 → user_events + user_profiles + orders
**看板工具**: WE分析 (零成本) + CloudBase聚合查询 (深度分析)

---

## 一、看板架构

```
                    WE分析 Dashboard (概览层)
                    ├── DAU/MAU 趋势
                    ├── 页面PV/UV
                    ├── 来源渠道分布
                    └── 实时在线
                              │
                              ▼
                    CloudBase 聚合查询 (分析层)
                    ├── 漏斗转化率
                    ├── 留存分析
                    ├── 路径偏好分布
                    ├── 支付转化
                    └── 用户画像概览
                              │
                              ▼
                    自定义报表 (深度层)
                    ├── 用户分群分析
                    ├── 功能使用热力
                    ├── 流失预警
                    └── A/B实验结果
```

## 二、看板KPI总览

### 2.1 日常监控看板 (Daily Dashboard)

| KPI | 目标 | 告警阈值 | 计算查询 |
|-----|:---:|:---:|------|
| DAU | >500 | <200 🔴 | WE分析 |
| 新用户数 | >50/日 | <20/日 🔴 | WE分析 |
| 评估完成数 | >30/日 | <10/日 🟡 | `user_events` count(eventType='assess_completed', 24h) |
| 路径选择数 | >20/日 | <5/日 🟡 | `user_events` count(eventType='path_selected', 24h) |
| 证件添加数 | >10/日 | <3/日 🟡 | `user_events` count(eventType='document_added', 24h) |
| 支付订单数 | >5/日 | <1/日 🔴 | `orders` count(status='paid', 24h) |
| 支付金额 | >¥500/日 | <¥100/日 🟡 | `orders` sum(amount, status='paid', 24h) |
| AI对话数 | >20/日 | <5/日 | `user_events` count(eventType='chat_send', 24h) |
| 崩溃率 | <1% | >3% 🔴 | WE分析 |

### 2.2 周度分析看板 (Weekly Dashboard)

| KPI | 目标 | 计算方式 |
|-----|:---:|------|
| WAU | >2000 | `user_events` COUNT DISTINCT _openid 7d |
| 7日留存 | >25% | D0活跃∩D7活跃 / D0活跃 |
| 周环比 | >+5% | (本周 - 上周) / 上周 |
| 漏斗各步周转化 | 见漏斗定义 | 周度聚合 |
| 付费转化率 | >8% | paid / assess_completed |
| 用户路径分布 | - | usage-tracker stats type='path_preference' |
| 攻略阅读TOP10 | - | `user_events` count by guide_detail_view |

### 2.3 月度健康看板 (Monthly Dashboard)

| KPI | 目标 | 计算方式 |
|-----|:---:|------|
| MAU | >5000 | `user_events` COUNT DISTINCT _openid 30d |
| 30日留存 | >15% | D0活跃∩D30活跃 / D0活跃 |
| MRR (月经常收入) | >¥10000 | SUM(amount) 本月paid |
| ARPU | >¥30 | MRR / MAU |
| 付费用户数 | >200 | COUNT DISTINCT _openid from paid orders |
| 流失率 | <20% | 30d无事件/MAU |
| 功能热力排名 | - | `user_events` count group by eventType |

## 三、漏斗查询SQL/NoSQL

### 3.1 日漏斗 (CloudBase聚合)

```javascript
// usage-tracker → action=stats, type=funnel, days=1
// 返回各步count
```

### 3.2 用户分群漏斗

```javascript
// 按路径(user_profiles.selectedPath)分组的漏斗
// 按渠道(user_profiles.pathSource)分组的漏斗
```

## 四、留存计算

### 4.1 次日留存算法

```
D0_users = user_events WHERE date=targetDay GROUP BY _openid
D1_users = user_events WHERE date=targetDay+1 GROUP BY _openid
retention = |D0_users ∩ D1_users| / |D0_users|
```

### 4.2 留存看板数据

| 日期 | 新增 | D1留存 | D7留存 | D14留存 | D30留存 |
|------|:---:|:---:|:---:|:---:|:---:|
| 05-01 | 45 | 48% | 22% | 15% | 11% |
| 05-02 | 52 | 52% | 25% | - | - |
| ... | ... | ... | ... | ... | ... |

## 五、告警规则

| 规则ID | 条件 | 级别 | 通知方式 |
|--------|------|:---:|------|
| ALERT-DAU-DROP | DAU < 前日×60% | 🔴 | WE分析告警 + PROGRESS.md标注 |
| ALERT-CRASH | 崩溃率 > 3% | 🔴 | WE分析告警 |
| ALERT-FUNNEL | 任一步骤周环比下降 >30% | 🟡 | BI周报标注 |
| ALERT-ZERO-PAY | 连续3日支付=0 | 🔴 | PROGRESS.md标注 + 催看 |
| ALERT-RETENTION | 次日留存 < 15% | 🟡 | BI周报标注 |

## 六、数据采集频率

| 数据 | 频率 | 方式 |
|------|:---:|------|
| 事件实时写入 | 实时 | usage-tracker |
| WE分析Dashboard | 实时 | WE分析SDK (自动) |
| 日聚合 (DAU/漏斗) | 每日 00:05 | 云函数定时触发器 |
| 周报生成 | 每周一 08:00 | BI Agent手动/Cron |
| 月报生成 | 每月1日 08:00 | BI Agent手动/Cron |
| 日聚合结果缓存 | 每日 | daily_stats 集合 |
| 用户画像更新 | 实时 | path_selected事件触发 |
