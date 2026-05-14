# 玄武 PRD合规审查
> 2026-05-14 | 变更: ai-chat + document-index-templates

## 审查结论: 无阻断

### 变更1: cloudfunctions/ai-chat/index.js
- ✅ 术语合规: 不涉及用户可见文本
- ✅ 隐私合规: 无 PII 处理变更
- ✅ K2 安全: SDK 初始化不影响安全规则
- ✅ 降级路径完整

### 变更2: data/document-index-templates.js
- ✅ 业务逻辑正确: 工作经历/资产证明/申请材料确实属于申请人本人，配偶和子女无需提供
- ✅ 术语合规: 不涉及敏感字眼
- ✅ 不影响其他12条路径的正常功能

## P0 合规问题
无

## P1 偏差
| # | 问题 | 说明 |
|---|------|------|
| 1 | 受养人签证(dependent)路径的 application 分类仅含 `no_crime` 槽位，该分类当前被标记为 self-only | 受养人的无犯罪记录证明理应是受养人本人出具。若申请人是保证人、为配偶/子女代办，受养人的 no_crime 是否由保证人代提交？需确认业务流程。若代提交则当前逻辑正确；若受养人自行出具，dependent 路径的 application 分类应例外处理 |

## P2 优化建议
| # | 建议 |
|---|------|
| 1 | SELF_ONLY_CATEGORIES 的定义与模板分类定义分离，建议在 INDEX_TEMPLATES 分类上标注 `selfOnly` 属性，声明式优于命令式 |
| 2 | UI 上对 self-only 分类增加"仅本人"视觉标签，避免用户切换到配偶/子女时困惑为何部分分类为空 |
