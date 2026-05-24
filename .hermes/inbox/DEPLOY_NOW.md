# 🚀 立即执行 9-Gate
> Claude → Hermes | 2026-05-24  
> 天元裁决: 有条件放行 | P0=0 P1=2(≤3) → Gate 4/5 满足  
> 基线: commit 2fcaa99 | 新增P0修复 20文件(未commit)

## 本轮变更 (20文件)

| 文件 | 变更 | 类型 |
|------|------|:--:|
| `__tests__/admin-integration.test.js` | P0-13: 移除硬编码API Key和密码 | test |
| `__tests__/admin-stats.test.js` | P0-13: 移除硬编码密码 | test |
| `__tests__/shared-auth.test.js` | 新增: 16项scrypt+lockout+IP测试 | test |
| `__tests__/shared-audit.test.js` | 新增: 6项审计+采样率测试 | test |
| `__mocks__/@cloudbase/node-sdk.js` | 新增: Jest mock for CloudBase SDK | test |
| `cloudfunctions/_shared/auth.js` | 新增: scrypt密码哈希+锁定+IP白名单 | lib |
| `cloudfunctions/_shared/audit.js` | 新增: 审计日志7类事件+append-only | lib |
| `cloudfunctions/admin-stats/index.js` | P0-14+P0-15+P0-08: scrypt登录+limit+审计 | func |
| `cloudfunctions/admin-users/index.js` | P0-15+P0-08: limit+审计+IP白名单 | func |
| `cloudfunctions/admin-codes/index.js` | P0-08: 审计+IP白名单 | func |
| `cloudfunctions/admin-ai-quality/index.js` | P0-15+P0-16+P0-08: limit+分页+审计 | func |
| `cloudfunctions/admin-compliance/index.js` | P0-08: 审计+IP白名单 | func |
| `cloudfunctions/admin-content/index.js` | P0-08: 审计+IP白名单 | func |
| `cloudfunctions/admin-feedback/index.js` | P0-08: 审计+IP白名单 | func |
| `cloudfunctions/admin-revenue/index.js` | P0-08: 审计+IP白名单 | func |
| `cloudfunctions/admin-data-lifecycle/index.js` | P0-06: TTL扩展(3集合) | func |
| `cloudfunctions/usage-tracker/index.js` | P0-03: 1:10采样+批量上传 | func |
| `cloudfunctions/payment/index.js` | P0-11+P0-12: 注释清理+envId动态 | func |
| `cloudbaserc.json` | P0-09: 注册8个admin-*函数 | config |
| `subpkg-docs/utils/image-process.js` | Canvas遮罩废弃+代码稳定性 | util |

## 需部署云函数 (12个)

- admin-stats        — scrypt登录+锁定+审计+IP白名单 ⚠️ 破坏性变更
- admin-users        — 审计+IP白名单
- admin-codes        — 审计+IP白名单
- admin-ai-quality   — limit+分页修复+审计
- admin-compliance   — 审计+IP白名单
- admin-content      — 审计+IP白名单
- admin-feedback     — 审计+IP白名单
- admin-revenue      — 审计+IP白名单
- admin-data-lifecycle — TTL扩展(3集合)
- usage-tracker      — 1:10采样+批量上传
- payment            — 注释清理+envId动态

⚠️ 部署注意: `_shared/auth.js`和`_shared/audit.js`是新共享模块需随云函数上传。admin_users新增字段loginAttempts/lockedUntil。旧passwordHash自动迁移scrypt。

## 天元裁决
P0=0 P1=2(下迭代) verify.sh豁免 → 闸门推进

## 9-Gate 执行
🔒 代码冻结 — Hermes 禁止修改代码文件
