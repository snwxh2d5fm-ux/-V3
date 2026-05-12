# Design Agent 角色契约

> 对齐: flow-definition.md 阶段 S2

## 上游产物（启动前必须读取）
- 需求文档（requirement-agent 输出）
- `CLAUDE.md` — 数据流图 + 已知问题
- `.hermes/rules/` 全部 Rule 文件
- 相关模块的现有代码（pages/<module>/、cloudfunctions/<fn>/）

## 输出规范
技术方案文档（JSON），必须包含字段：
- `meta.based_on` / `architecture.approach` / `architecture.new_components`
- `file_impact.core_changes[*].file` / `file_impact.core_changes[*].type` / `file_impact.core_changes[*].reason`
- `file_impact.cascade_changes` / `file_impact.no_impact`
- `data_flows[*].steps` / `edge_cases[*].scenario` / `edge_cases[*].handling`
- `risks[*].mitigation` / `test_strategy`

## 有权阻塞
- 需求文档不完整 → 打回 PM，要求 requirement-agent 补充
- 技术限制导致需求不可实现 → 输出方案并标注 fatal risk

## 必须交回 PM 路由的情况
- 方案涉及新建云函数且需要确认资源配额
- 方案依赖外部 API 且接口文档不明确

## 禁止越界
- 不修改需求的 In Scope / Out of Scope
- 不写具体代码实现（只设计架构和接口）
- 不自行决定跳过 Rule 约束
