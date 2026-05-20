# Gate Results — V4 Dual-Gate 发版
> 2026-05-21 | commit `6551bf7` | 范围：双闸门特性

| Gate | Result | Detail |
|------|:--:|------|
| 0. 基础设施 | ✅ | git clean, __tests__/ scripts/ tests/ 齐全 |
| 1. verify.sh | 19/38 | 19项通过 / 19项失败（全部预存） |
| 1b. workflow-verify.sh | 2/29 | Hermes artifacts 缺口（预存） |
| 2. Jest 全量 | ✅ | 15/15 suites, 380/384 pass (4 todo), 0 fail |
| 3. DevTools 编译 | ✅ | 0 编译错误 |
| 4. 麒麟 Code Review | **0/0/0** | P0 KR-01/02已修复, KR-03/04文件已丢弃 |
| 5. 玄武 PM Review | 0/0/0 | v2.1终稿+PD二次评审通过 |
| 6. CloudBase | ⏭️ | 无云函数变更 |
| 7. git push | ✅ | `6551bf7` → origin/main |
| 8. ledger | ✅ | 已追加 |
| 9. ACL 通知 | ✅ | 3报告已写入 inbox |

## P0 修复记录

| P0 | 提交 | 状态 |
|:--:|------|:--:|
| KR-01 | 512d232 | ✅ VALID_STATUSES.includes()白名单 |
| KR-02 | 6551bf7 | ✅ phoneBound/membershipLevel恢复 |
| KR-03 | — | ✅ 未commit SDK迁移文件已丢弃 |
| KR-04 | — | ✅ 未commit 安全正则文件已丢弃 |

## verify.sh 失败项（全部预存）

A1(2)/A6(1)/A8(1)/A9(4)/B5(1)/C2(6)/C3(5) — V3基线带入，非本轮引入
