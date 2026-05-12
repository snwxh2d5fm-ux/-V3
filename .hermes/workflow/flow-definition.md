# 住港伴 Harness Workflow — 流程定义

> 版本: 1.0
> 创建: 2026-05-12 (Phase H1)
> 对齐: Harness Engineering 文章第七章 7.6 节「三层 Workflow」

这是住港伴项目的**正式流程定义文件**。
它不是 Agent 提示词的附属品——它是所有 Agent 共同遵守的流程宪章。

---

## 一、七阶段流水线

```
需求分析 → 方案设计 → 闸门总控 → 开发实现 → 代码审查 → 测试验证 → 交付
  (R)        (D)        (G)        (Dev)      (Rev)       (T)       (PM)
```

| 阶段 | 编号 | 默认 Agent | 输入 | 输出 | 预计耗时 |
|------|:--:|-----------|------|------|:--:|
| 需求分析 | S1 | requirement-agent | 用户原始需求 + 项目上下文 | 结构化需求文档 | 视复杂度 |
| 方案设计 | S2 | design-agent | 需求文档 + CLAUDE.md | 技术方案文档（含模块影响分析） | 视复杂度 |
| 闸门总控 | S3 | gate-agent | 需求+方案文档 | 准入/打回判定 | 快速 |
| 开发实现 | S4 | dev-agent | 需求+方案+闸门结论 | 代码变更 + verify.sh 通过 | 视复杂度 |
| 代码审查 | S5 | review-agent | 需求+方案+代码 diff | 审查报告 | 视改动量 |
| 测试验证 | S6 | test-agent | 需求+方案+代码+审查报告 | 测试报告 + verify.sh 通过 | 视测试量 |
| 交付 | S7 | pm-agent | 全部文档+审查+测试+verify.sh | 交付结论 + 看板更新 | 快速 |

---

## 二、前进条件

每个阶段完成后，PM Agent 必须检查以下条件，全部满足才能移交下一阶段：

### S1→S2 条件
- [ ] 需求文档覆盖用户所有诉求
- [ ] 需求边界清晰（做什么、不做什么）
- [ ] 无模糊表述（"优化体验" → 具体化为可执行描述）

### S2→S3 条件
- [ ] 方案覆盖需求文档全部功能点
- [ ] 包含模块影响分析（哪些文件会被改动）
- [ ] 技术可行性已论证（不依赖不存在的 API/能力）

### S3→S4 条件
- [ ] 闸门判定为「准入」(APPROVED)
- [ ] 如为「条件准入」(CONDITIONAL)，条件已记录并可执行
- [ ] 需求+方案文档齐全且版本锁定

### S4→S5 条件
- [ ] 代码已修改
- [ ] `bash scripts/verify.sh` 通过（0 失败）
- [ ] 微信编译通过（无 error）
- [ ] CLAUDE.md 已同步更新（如有必要）

### S5→S6 条件
- [ ] 审查报告完整
- [ ] 无 CRITICAL 级问题
- [ ] 如有 HIGH 级问题，已修复并重审通过
- [ ] 审查已覆盖所有改动的文件

### S6→S7 条件
- [ ] verify.sh 全量通过
- [ ] 核心云函数 smoke test 通过
- [ ] 测试用例数未减少（或有合理解释）
- [ ] 无功能性 bug

### S7 完成标准
- [ ] verify.sh 通过（0 失败）
- [ ] 审查无 P0 阻塞项
- [ ] 云函数部署 invokeFunction 验证通过
- [ ] 无 K2/隐私违规
- [ ] 任务看板已更新

---

## 三、回退规则

| 回退场景 | 从 | 退回到 | 触发条件 |
|---------|---|--------|---------|
| 需求不清 | S3 | S1 | gate-agent 判定需求边界模糊、存在矛盾 |
| 方案不可行 | S3 | S2 | gate-agent 判定方案有致命缺陷 |
| 需求范围外改动 | S5 | S4 | review-agent 发现大量 scope creep |
| 实现偏离需求 | S5 | S4 | review-agent 发现 CRITICAL/HIGH 需求不一致 |
| 实现偏离方案 | S5 | S4 | review-agent 发现关键设计未被执行 |
| 测试失败 | S6 | S4 | test-agent 发现功能性 bug |
| verify.sh 不通过 | S6 | S4 | 任何门禁检查失败 |
| 流程资产不完整 | S4-S7 | PM(暂停) | workflow-verify.sh 发现资产缺失 |

### 回退计数规则
- 同阶段连续回退 2 次 → PM 必须要求对应 Agent 输出根因分析
- 同阶段连续回退 3 次 → PM 暂停流程，上报人类介入

---

## 四、并行规则

以下组合可以并行执行（不互相依赖）：
- 无。当前流水线严格串行。

以下动作可在 Agent 执行期间并行：
- PM 可同时更新任务看板
- 人类可同时做设计审计（DSG-1）

---

## 五、紧急通道

以下情况可跳过部分阶段，但必须在交付时注明跳过的阶段和理由：

| 紧急类型 | 可跳过 | 最低要求 |
|---------|--------|---------|
| 热修复（安全漏洞） | S1(简化需求)、S2 | S3(快速闸门) → S4 → S5+S6（合并） |
| 数据修正 | S1-S3（如果方案明显） | S4 → S5+S6 |
| 配置变更 | S1-S3 | S4(直接改) → S6(仅 verify.sh) |

**紧急通道仍需 verify.sh 通过。**

---

## 六、流程资产清单

PM Agent 在每个阶段开始前运行 `bash scripts/workflow-verify.sh` 检查以下资产完整性：

| 资产 | 路径 | 必须存在 |
|------|------|:--:|
| 流程定义 | `.hermes/workflow/flow-definition.md` | ✅ |
| 流程总览(L1) | `.hermes/workflow/workflow-overview.md` | ✅ |
| MCP评估 | `.hermes/workflow/mcp-evaluation.md` | ✅ |
| PM 契约 | `.hermes/workflow/agent-contracts/pm-agent.md` | ✅ |
| 需求分析契约 | `.hermes/workflow/agent-contracts/requirement-agent.md` | ✅ |
| 方案设计契约 | `.hermes/workflow/agent-contracts/design-agent.md` | ✅ |
| 闸门契约 | `.hermes/workflow/agent-contracts/gate-agent.md` | ✅ |
| 开发契约 | `.hermes/workflow/agent-contracts/dev-agent.md` | ✅ |
| 审查契约 | `.hermes/workflow/agent-contracts/review-agent.md` | ✅ |
| 测试契约 | `.hermes/workflow/agent-contracts/test-agent.md` | ✅ |
| 总验证脚本 | `scripts/verify.sh` | ✅ |
| 流程校验脚本 | `scripts/workflow-verify.sh` | ✅ |
| 任务看板 | `.hermes/task-board.yaml` | ✅ |
| dev-map | `CLAUDE.md` | ✅ |

---

## 七、版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0 | 2026-05-12 | 初版：七阶段流水线 + 前进条件 + 回退规则 + 紧急通道 |
| 1.1 | 2026-05-12 | H2 升级：新增 L1 流程总览 + MCP 评估 + 资产清单更新 |
