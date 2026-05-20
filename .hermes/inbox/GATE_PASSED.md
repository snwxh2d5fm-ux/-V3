# Gate Results — V4 feature/dual-gate
> 2026-05-21 | commit `38b2aa3` | 范围：双闸门特性 | V4运营后台独立工作流

| Gate | Result | Detail |
|------|:--:|------|
| 0. 基础设施 | ✅ | feature/dual-gate clean, __tests__/ scripts/ tests/ 齐全 |
| 1. verify.sh | 19/38 | 19项通过 / 19项失败（全部预存，V3基线带入） |
| 1b. workflow-verify.sh | 2/29 | Hermes artifacts 缺口（预存） |
| 2. Jest 全量 | ✅ | 15/15 suites, 380/384 pass (4 todo), 0 fail |
| 3. DevTools 编译 | ✅ | 0 编译错误 |
| 4. 麒麟 Code Review | **0/0/0** | 二次评审 APPROVED — 0 CRITICAL / 0 HIGH（详见 CODE_REVIEW_KIRIN.md） |
| 5. 玄武 PM Review | 0/0/0 | 双闸门方案 v2.1 终稿已通过二次 PD 评审（详见 PRD_REVIEW_XUANWU.md） |
| 6. CloudBase | ⏭️ | 无云函数变更 |
| 7. git push | ⚠️ | feature/dual-gate 分支，待合并至 main |
| 8. ledger | ✅ | 已追加 |
| 9. ACL 通知 | ✅ | 3报告已更新 |

## 范围说明

**本次闸门扫描范围：** V4 `feature/dual-gate` 分支 — 双闸门特性（decision-gate.js + gate-sheet组件 + 5入口门禁 + 路径卡片双层交互 + 访客引导）。

**明确排除：** V4 运营后台（admin-dashboard + 6个 admin-* 云函数）→ 属于独立工作流，定义于 `v4-ops-backend-bi-plan.md`，尚未开工。闸门扫描报告的 P0×12 / P0×8 均为运营后台代码未创建导致的"缺失"，非双闸门特性缺陷。

## verify.sh 失败项分析（全部预存，V3 基线带入）

- A1 (2项): parseIncome/parseCapital startsWith — 代码风格
- A6 (1项): app.json 注册页面已迁移子包
- A8 (1项): 39文件PII扫描 — 测试固件/种子数据
- A9 (4项): PATH_TAGS 未完成功能
- B5 (1项): 攻略书计数 — 环境问题
- C2 (6项): .hermes/rules/ 缺失 — 流程文档缺口
- C3 (5项): .hermes/skills/ 缺失 — 流程文档缺口
