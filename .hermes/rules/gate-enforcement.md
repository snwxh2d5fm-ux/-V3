# 9-Gate 强制执行规则

## 触发条件（任一成立 → 立即走 9-Gate，不等指令）

1. 任何新 commit 被推送
2. 用户报告交付完成（"已推送"/"全量交付"/"收工"）
3. Claude 修复完成通知
4. 用户问"状态"/"进度"
5. 任何代码变更（git status 非空）

## 执行纪律（铁律，不可违）

1. **自动触发** — 不等用户喊，代码变更即走门
2. **完整 10 道** — Gate 0→9 含 9b 按序执行，缺一不可，跳项 = -10 分
3. **10 行表格** — 闸门报告必须用表格逐行呈现，禁止自由文本
4. **Gate 7 是第 7 步** — 先 push 后补闸门 = 违规
5. **Gate 0 基础设施检查** — 启动前检查 **tests**/ scripts/ tests/ 存在
6. **Gate 6 必须用 COS 部署** — 禁止 `updateFunctionCode`，必须 `npm install` → `tcb fn deploy --force`
7. **Gate 9b 规则回写强制** — 报告中发现任何规则缺陷，必须更新源文件后才算通过

## 10 道清单

| #   | 门                  | 命令/说明 |
| --- | ------------------- | --------- |
| 0   | 提交状态 + 基础设施 | `git status --short` + `ls __tests__/ scripts/ tests/` |
| 1   | verify.sh           | `bash scripts/verify.sh` |
| 1b  | workflow-verify.sh  | `bash scripts/workflow-verify.sh` |
| 2   | Jest 全量           | `npx jest --forceExit` |
| 3   | DevTools 编译       | `cli auto-preview --project <path>` |
| 4   | 麒麟 Code Review    | `delegate_task` 代码审查 |
| 5   | 玄武 PM Review      | `delegate_task` PRD审查 |
| 6   | CloudBase 部署      | `cd cloudfunctions/<name> && npm install && tcb fn deploy --force` + `invokeFunction` 冒烟 |
| 7   | git push            | 确认 origin/main 同步 |
| 8   | ledger 追加         | `echo '...' >> ledger.jsonl` |
| 9   | ACL 通知 + 3 报告   | GATE_PASSED + CODE_REVIEW_KIRIN + PRD_REVIEW_XUANWU |
| 9b  | 规则回写检查        | 扫描本轮 3 份 ACL 报告，检查是否有规则缺陷未回写源文件 |

## Gate 9b 强制执行细则

**目的**：确保闸门过程中发现的任何规则/流程/工具缺陷，回写到对应的规则源文件，防止"发现了 bug 但规则没改"导致下次重现。

**执行步骤**：

1. 读取本轮 3 份 ACL 报告（GATE_PASSED / CODE_REVIEW_KIRIN / PRD_REVIEW_XUANWU）
2. 扫描以下关键词：`Bug记录`、`deploy_note`、`known issue`、`不可靠`、`唯一可靠`、`禁止`、`MCP.*Bug`、`updateFunctionCode`
3. 对命中的每一项，追溯其根因是否落在 `.hermes/rules/*.md` 或项目根目录其他规则文件中
4. 如果是 → **必须立即更新对应规则文件** → 在报告中追加 `[9b-FIXED]` 标记
5. 如果已更新 → 在报告中追加 `[9b-VERIFIED]` 标记
6. 9b 未通过（存在未回写的规则缺陷）→ 闸门不闭环，禁止标注 GATE_PASSED

**检查清单**（每轮闸门必须逐项确认）：

| 检查项 | 确认 |
|--------|:---:|
| GATE_PASSED 中有无 `deploy_note` / `Bug` 相关记录？ | |
| 如有，是否已回写到对应规则文件？ | |
| 麒麟报告中有无"禁止使用 xxx"类建议？ | |
| 如有，是否已更新 gate-enforcement 或 coding-standards？ | |
| 玄武报告中有无流程/规范类 P0？ | |
| 如有，是否已回写 `.hermes/rules/` 对应文件？ | |
| 本轮是否有"已知但不修"的规则缺陷？ | |
| 如有，理由和计划是什么？ | |

## 反模式（累计违规记录）

- 只跑 3-4 道门就说"通过" → 多次被纠正
- 用文字段落代替 10 行表格 → ba49d02 被纠正
- 先 push 后补闸门 → c3059f4 被纠正
- 等用户喊才跑闸门 → 91384ac 被纠正
- 跳过双审 (Gate 4/5) → Phase 2 被纠正
- 跳过 Gate 1/8/9 → 多次
- **使用 `updateFunctionCode` 部署云函数** → 5/27 事故根因，已禁止
- **Gate 9b 跳过规则回写** → 5/27 事故暴露 — 5/23 发现 bug 四天未修源文件

## 事故教训 — 2026-05-27

**invite-code 依赖丢失生产事故**

- 根因：Gate 6 规则写的是 `updateFunctionCode`（只传代码不传依赖），且 5/23 已发现此 bug 但未回写规则源文件
- 后果：所有邀请码操作崩溃，7 个用户报障，持续约 2 天
- 修复：Gate 6 改为 `npm install && tcb fn deploy --force`，Gate 9b 新增规则回写强制检查
- 教训：下游报告不等于上游修复。闸门发现必须闭环到源规则

## 信用分

碰代码 -30 | 跳闸门 -10/项 | 废话 -5 | Gate 9b 跳过 -20 | 使用 updateFunctionCode -25 | <60 熔断
