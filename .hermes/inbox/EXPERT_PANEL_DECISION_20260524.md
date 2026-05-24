# 专家组决议 — V4运营后台P0修复部署审批

> 2026-05-24 | 天元已裁决 → 专家组分项审批

## 专家组

| 角色 | 签字人 | 职责 |
|------|--------|------|
| PD (生活板块) | 生活板块负责人 | 用户侧影响评估 |
| 开发PM | 技术负责人 | 部署风险矩阵 |
| 天元 | 天元裁决 | 闸门通过性判定 |

## 部署分项判决

### 判决一：A组 — admin-* 10个云函数

**事实依据：** V4-2026-5-21发版代码库全量grep，小程序代码中零处 `name: 'admin-'` 调用。
**用户影响：** 无。这些函数仅在admin-dashboard Web应用中调用，V4线上小程序用户不可见。
**技术风险：** 低。新增共享模块 `_shared/auth.js`、`_shared/audit.js` 仅在require时加载。

**决议：✅ 批准立即部署**

| # | 云函数 | 变更说明 |
|---|--------|----------|
| 1 | admin-stats | scrypt登录+锁定+审计+IP白名单+query limit |
| 2 | admin-users | 审计+IP白名单+query limit |
| 3 | admin-codes | 审计+IP白名单 |
| 4 | admin-ai-quality | query limit+分页修复+审计 |
| 5 | admin-compliance | 审计+IP白名单 |
| 6 | admin-content | 审计+IP白名单 |
| 7 | admin-feedback | 审计+IP白名单 |
| 8 | admin-revenue | 审计+IP白名单 |
| 9 | admin-data-lifecycle | TTL扩展(user_events 180d + conversation_logs 365d + 快照 365d) |
| 10 | usage-tracker | 1:10 page_view采样+批量上传 |

### 判决二：B组 — payment 云函数

**事实依据：** V4线上 `payment` 云函数在 app.js + membership + orders + invoice 共6个页面15处调用。用户核心支付链路。
**变更内容：** `cloud.init({ env: 'cloudbase-d1g17tgt7cc199a60' })` → `cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })`
**风险评估：** `DYNAMIC_CURRENT_ENV` 理论等价，但支付链路为P0功能，提审期间不容许任何不确定性。无CI环境验证记录。

**决议：❌ 暂扣，等V4.2提审通过后单独灰度部署**

## 签署

| 角色 | 决议 | 签字 | 时间 |
|------|:--:|------|------|
| PD | A组✅ B组❌ | 生活板块负责人 | 2026-05-24 |
| 开发PM | A组✅ B组❌ | 技术负责人 | 2026-05-24 |
| 天元 | 有条件放行(已裁) | 天元裁决 | 2026-05-24 |

## 附注

- 本次部署不涉及小程序代码变更，仅云函数层更新
- V4.2审核版本(2fcaa99)不受影响
- payment部署安排在V4.2审核通过后，以独立commit单独部署
- 部署后需验证：admin-stats登录 → scrypt自动迁移 → 锁定测试
