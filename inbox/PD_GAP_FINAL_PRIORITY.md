# PD 缺口优先级终审

> PD盘古 · 2026-05-15 11:40
> 来源: outbox/PD_GAP_INVENTORY_v1.md
> 终审: 6项缺口 → 4项本轮 / 2项延后

---

## 终审结论

| 缺口 | 评级 | 本轮 | 理由 | 估时 |
|------|:--:|:--:|------|:--:|
| 攻略书v6对齐 | P0 | **Y** | 47篇内容资产是产品核心价值，云端V1与本地V3推荐分裂→用户看到跳变结果，不可接受 | Phase A: 4h Claude |
| 信息栏数据活水 | P0 | **Y** | 3条硬编码假数据是产品级事故。信息差是香港身份产品差异化命脉，必须活起来 | Phase A: 3h Claude + 1h 配置 |
| 设计令牌落地 | P1 | **Y** | tokens.wxss是设计基础设施，32/100审计分是视觉债务。Phase A产出文件即可，不要求全量迁移 | Phase A: 3h Claude(马良协作) |
| Reminder产品对齐 | P1 | **Y** | 规则链补全是数据级改动，不涉及架构。TPg/GEP/CIES/受养人4条链缺数据→低成本高价值 | Phase A: 2h Claude |
| Onboarding引导 | P2 | **N** | 需要完整3步递进式设计+前端实现+测评引擎，3周+工期。先做方案设计，延至下轮 | 方案: 2h PD, 开发: 延后 |
| 付费锁屏策略 | P2 | **N** | 免费层限制需先落地6项功能限量+价值感知弹窗+提醒链，2-3周。延至Onboarding之后 | 方案: 2h PD, 开发: 延后 |

---

## 本轮4项详析

### 1. 攻略书v6对齐 — P0 ✅ 本轮

**终审判定**: 全量v6(三驱动/富媒体/CMS)跨度3-4周不可本轮。本轮只做Phase A — 云端推荐引擎对齐本地V3。

**Phase A 交付物**:
1. `cloudfunctions/guidebook/index.js` → 升级到 V3 推荐算法(PATH_TAGS + STATE_PROFILE 双驱动)
2. `cloudfunctions/guidebook/` → 搜索结果为空时返回 tags 提示
3. `pages/guidebooks/` → 搜索框UI(已有入口,补后端)

**估时**: Claude 4h (2h云函数 + 1h搜索接口 + 1h联调)

**延后部分**: 行为埋点→三驱动/富媒体卡片/CMS面板 → 下轮

---

### 2. 信息栏数据活水 — P0 ✅ 本轮

**终审判定**: 3条硬编码是产品事故。本轮接入2个RSS源 + 动态渲染, 解决"完全静态"问题。

**Phase A 交付物**:
1. `cloudfunctions/policy-feed/index.js` → 定时拉取入境处公告 + 劳工及福利局RSS
2. `pages/info/index/index.js` → 数据源切换为CloudBase集合,去除硬编码
3. `pages/info/index/index.wxml` → 动态列表渲染(按时间倒序)

**估时**: Claude 3h + Hermes 配置 1h(RSS源URL/定时cron)

**延后部分**: affected-paths标注/模板消息推送/AI解读 → 下轮

---

### 3. 设计令牌落地 — P1 ✅ 本轮

**终审判定**: tokens.wxss + app.wxss @import 是一锤子基础设施。产出文件即生效,不需要逐文件迁移。先有令牌,逐步替换。

**Phase A 交付物**:
1. `styles/tokens.wxss` → 三层令牌全量CSS变量(15色板+语义别名+组件令牌)
2. `app.wxss` → @import tokens.wxss
3. `outbox/` → 逐文件迁移清单(36文件×优先级)

**估时**: Claude 2h + 马良 1h(色板校验)

**延后部分**: P1债务修复(导航/按钮/标签/链接4处40min)→可下周; P2批量修正→下轮

---

### 4. Reminder产品对齐 — P1 ✅ 本轮

**终审判定**: 规则链补全是纯数据层改动。8→12条链,新增TPg/GEP/CIES/受养人。无架构风险。

**Phase A 交付物**:
1. `data/timeline-templates.js` → 新增TPg/GEP/CIES/受养人路径的时间线事件模板
2. `cloudfunctions/reminder-engine/` → 规则链从8条扩展到12条(v2.1 minor)

**估时**: Claude 2h (数据模板 + 规则链注册)

**延后部分**: 证件到期联动/政策联动/日历导出 → 下轮

---

## 延后2项理由

### Onboarding引导 — 延后

不是不做,是先做方案。3步递进式(测评→阶段→任务)需要完整交互设计+前端新页面+测评引擎。当前P0/P1债务未清,不急于做P2体验项。

**建议**: 本轮产出 `docs/prd/onboarding-design.md` 方案文档(PD 2h), 下轮开发。

### 付费锁屏策略 — 延后

免费层限制(FREE_LIMITS实际生效)是付费锁屏的前提——没有"体验→受限"的感知,锁屏就没有转化。而免费层6项功能限量需要贯穿多个模块(AI对话/攻略书/证件/推荐/政策推送)。

**建议**: 先做免费层设计→方案文档→下轮开发。本轮不动。

---

## 本轮总估时

| 角色 | 工作 | 估时 |
|------|------|:--:|
| Claude | 4项Phase A开发 | 11h |
| 马良(UI) | tokens.wxss色板校验 | 1h |
| Hermes(PD) | 2项方案文档 | 4h |
| Hermes(PM) | RSS源配置+CloudBase cron | 1h |
| **合计** | | **17h** (~2工作日) |

---

## outbox分派

| 缺口 | outbox文件 | 指派 |
|------|-----------|------|
| 攻略书v6 Phase A | `outbox/TASK_GAP_GUIDEBOOK_V6_A.md` | Claude |
| 信息栏 Phase A | `outbox/TASK_GAP_INFO_FEED_A.md` | Claude |
| 设计令牌 Phase A | `outbox/TASK_GAP_TOKENS_A.md` | Claude + 马良 |
| Reminder Phase A | `outbox/TASK_GAP_REMINDER_A.md` | Claude |
| Onboarding方案 | `docs/prd/onboarding-design.md` | PD |
| 付费锁屏方案 | `docs/prd/paywall-strategy.md` | PD |

---

> PD盘古 · 终审完成 · 2026-05-15 11:40
> 下一站: PM → outbox分派Claude + 更新PROGRESS.md
