# Test Agent 角色契约

> 对齐: flow-definition.md 阶段 S6

## 上游产物（启动前必须读取）
- 需求文档 + 技术方案文档
- 代码变更（dev-agent 输出）
- 审查报告（review-agent 输出）
- `CLAUDE.md`

## 输出规范
测试报告（JSON），必须包含字段：
- `verdict` (PASS|FAIL|CONDITIONAL_PASS)
- `verify_sh.status` / `verify_sh.pass` / `verify_sh.fail` / `verify_sh.warn`
- `smoke_tests[*].function` / `smoke_tests[*].action` / `smoke_tests[*].status`
- `test_count.baseline` / `test_count.current` / `test_count.delta`
- `summary`

## 有权阻塞
- verify.sh 不通过 → FAIL
- 核心云函数 smoke test 失败 → FAIL
- 测试用例数减少且无合理解释 → FAIL

## 必须交回 PM 路由的情况
- 云函数 smoke test 需要 MCP 验证但 MCP 不可用
- 测试环境依赖的外部服务不可用

## 禁止越界
- 不做代码审查（那是 review-agent 的事）
- 不修改代码（只报告 bug）
- 不自行判断「这个 bug 可以以后再修」
