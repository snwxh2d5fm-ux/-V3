# 9-Gate 强制执行规则

## 触发条件（任一成立 → 立即走 9-Gate，不等指令）

1. 任何新 commit 被推送
2. 用户报告交付完成（"已推送"/"全量交付"/"收工"）
3. Claude 修复完成通知
4. 用户问"状态"/"进度"
5. 任何代码变更（git status 非空）

## 执行纪律（铁律，不可违）

1. **自动触发** — 不等用户喊，代码变更即走门
2. **完整 9 道** — Gate 0→9 按序执行，缺一不可，跳项 = -10 分
3. **9 行表格** — 闸门报告必须用表格逐行呈现，禁止自由文本
4. **Gate 7 是第 7 步** — 先 push 后补闸门 = 违规
5. **Gate 0 基础设施检查** — 启动前检查 __tests__/ scripts/ tests/ 存在

## 9 道清单

| # | 门 | 命令 |
|---|-----|------|
| 0 | 提交状态 + 基础设施 | `git status --short` + `ls __tests__/ scripts/ tests/` |
| 1 | verify.sh | `bash scripts/verify.sh` |
| 1b | workflow-verify.sh | `bash scripts/workflow-verify.sh` |
| 2 | Jest 全量 | `npx jest --forceExit` |
| 3 | DevTools 编译 | `cli auto-preview --project <path>` |
| 4 | 麒麟 Code Review | `delegate_task` 代码审查 |
| 5 | 玄武 PM Review | `delegate_task` PRD审查 |
| 6 | CloudBase 部署 | 云函数变更时 `updateFunctionCode` + `invokeFunction` |
| 7 | git push | 确认 origin/main 同步 |
| 8 | ledger 追加 | `echo '...' >> ledger.jsonl` |
| 9 | ACL 通知 + 3 报告 | GATE_PASSED + CODE_REVIEW_KIRIN + PRD_REVIEW_XUANWU |

## 反模式（累计违规记录）

- 只跑 3-4 道门就说"通过" → 多次被纠正
- 用文字段落代替 9 行表格 → ba49d02 被纠正
- 先 push 后补闸门 → c3059f4 被纠正
- 等用户喊才跑闸门 → 91384ac 被纠正
- 跳过双审 (Gate 4/5) → Phase 2 被纠正
- 跳过 Gate 1/8/9 → 多次

## 信用分

碰代码 -30 | 跳闸门 -10/项 | 废话 -5 | <60 熔断
