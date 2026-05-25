# 应急预案与责任矩阵 — V4运营后台P0修复部署

> 2026-05-24 | 触发条件: V4线上用户受影响

## 一、故障场景与回滚方案

### 场景A: usage-tracker 崩溃（概率: 低）

**触发**: CloudBase日志出现 usage-tracker 500/超时，或admin-dashboard显示0新事件

**用户影响**: 🟢 无感知。app.js调用已 `.catch(function(){})` 兜底，埋点事件静默丢失。

**回滚步骤** (预计5分钟):
1. `cd cloudfunctions/usage-tracker && git checkout 3061683 -- index.js`
2. 部署回旧版本: `tcb fn deploy usage-tracker`
3. 验证: admin-dashboard出现新usage事件即恢复

**验证方式**: app.js中 `wx.cloud.callFunction({name:'usage-tracker'}).catch()` 静默丢弃，用户侧零异常。仅需检查CloudBase日志无 `TypeError` 即确认恢复。

### 场景B: admin-stats scrypt登录失败（概率: 低-中）

**触发**: 管理员登录admin-stats返回 401/500

**用户影响**: 🟢 无。admin-stats仅被admin-dashboard调用，V4小程序用户不使用。

**回滚步骤** (预计10分钟):
1. 检查CloudBase日志定位具体错误
2. 如需回滚: `git checkout 3061683 -- cloudfunctions/admin-stats/` 并重新部署
3. 回滚后管理员使用原密码可正常登录（旧SHA-256逻辑）
4. ⚠️ 如在scrypt模式下登录过的管理员，需手动重置 passwordHash 字段（取备份值或使用SHA-256重新哈希临时密码）

### 场景C: _shared/ 模块加载失败（概率: 极低）

**触发**: 任一admin-*函数返回 "Cannot find module '../_shared/auth'" 

**用户影响**: 🟢 无。仅admin-dashboard调用受影响。

**回滚步骤** (预计5分钟):
1. 确认 CloudBase 部署包含 `_shared/` 目录（查看函数代码包）
2. 如缺失: 重新部署，确保 `functionRootPath` 指向 `cloudfunctions/` 父目录
3. 如仍失败: 临时将 `_shared/auth.js` 内容内联到各admin-*函数中，重新部署

### 场景D: 数据库写入异常（概率: 极低）

**触发**: admin_audit_trail 集合写入失败，CloudBase日志报 permission denied

**用户影响**: 🟢 无。审计日志写入已 `.catch()` 保护，不影响主业务流程。

**恢复**: 检查集合权限配置，确保允许 `add` 操作。

## 二、影响等级判定

| 影响等级 | 定义 | 本次部署风险 |
|:--:|------|:--:|
| P0 | 用户核心功能中断（支付/登录/证件夹） | **不可能** — 未部署任何用户调用的函数 |
| P1 | 用户可感知的功能异常 | **不可能** — usage-tracker静默失败 |
| P2 | 后台管理功能异常 | **可能** — admin-dashboard登录受影响 |
| P3 | 非功能指标异常（埋点/日志/审计） | **可能** — usage追踪或审计日志中断 |

## 三、责任矩阵

### 3.1 事前责任（部署决策）

| 责任方 | 职责 | 执行状态 |
|--------|------|:--:|
| **PD** | 确认部署对象不影响V4线上用户链路 | ✅ 亲自grep全量代码，admin-*零处调用 |
| **开发PM** | 独立验证技术风险+依赖链+回滚可行性 | ✅ 独立grep全量代码+读取9函数require链 |
| **Claude** | 代码质量+测试覆盖 | ✅ 41/41单元+544/544回归 |
| **天元** | 闸门通过性裁定 | ✅ 有条件放行 |

### 3.2 事中责任（故障响应）

| 责任方 | 职责 | 响应时间 |
|--------|------|:--:|
| **开发PM** | 第一时间发现异常（监控CloudBase日志） | 部署后30分钟内 |
| **Claude** | 定位根因+执行回滚+验证恢复 | 发现问题后10分钟内 |
| **PD** | 判断用户是否有实际影响+决定是否需要公告 | 如需公告, 30分钟内 |

### 3.3 事后责任（复盘）

| 责任方 | 职责 |
|--------|------|
| **开发PM** | 输出故障复盘报告（根因+时间线+修复+预防） |
| **PD** | 判定是否需要产品层改进（监控/告警/降级） |
| **天元** | 更新闸门规则（如本次暴露了测试盲区） |

### 3.4 一票否决触发条件

以下任一条件满足时，立即执行全量回滚：

1. CloudBase日志出现任一admin-*函数500错误率 > 5%
2. V4线上用户的 payment 云函数出现异常（即使与本次部署无关，也应排查是否是环境变更连锁影响）
3. usage-tracker 连续3次调用返回非 `code: 0` 响应

## 四、部署后验证清单

| 验证项 | 方法 | 期望结果 | 执行人 |
|--------|------|----------|:--:|
| admin-stats 登录 | 调用adminLogin | 返回apiKey | Claude |
| admin-stats scrypt迁移 | 使用旧SHA-256密码登录 | passwordHash自动更新为scrypt格式 | Claude |
| admin-stats 锁定 | 连续5次错误密码 | 返回429 + "已锁定" | Claude |
| usage-tracker 采样 | 查看CloudBase日志 | 出现 "sampled_out" 日志 | Claude |
| admin-data-lifecycle | 手动触发 | 清理日志无异常 | Claude |

## 五、沟通升级路径

```
发现异常 → 开发PM评估(5分钟) → 
  ├─ P3级(埋点/审计) → 记录defect, 不升级
  ├─ P2级(admin后台) → 通知PD, Claude修复
  └─ P1/P0级(用户影响) → 通知天元+琅琊, 5分钟内执行回滚
```
