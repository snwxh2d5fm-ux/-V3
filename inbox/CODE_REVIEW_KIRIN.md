# 麒麟 Code Review
> 2026-05-14 | 变更: ai-chat + document-index-templates

## 审查结论: 无阻断

### 变更1: cloudfunctions/ai-chat/index.js (+13行)
- ✅ 优先复用 `global.cloud`（兼容 Jest mock 测试环境）
- ✅ 生产环境走 `require('wx-server-sdk')` + `cloud.init()`
- ✅ 缺失时优雅降级为 null，已有 try/catch 包裹调用点
- ✅ 与其他云函数 SDK 初始化模式一致

### 变更2: data/document-index-templates.js (+9行)
- ✅ SELF_ONLY_CATEGORIES 覆盖 employment/financial/application 三类
- ✅ effectiveOwner 逻辑清晰：仅本人分类始终用 'self'，其他分类跟随身份切换器
- ✅ 不影响 identity/education/relationship/sponsor/guardian 分类的正常过滤

## P0 (必须修)
无

## P1 (建议修)
| # | 文件 | 问题 | 建议修复 |
|---|------|------|---------|
| 1 | data/document-index-templates.js:553 | SELF_ONLY_CATEGORIES 硬编码在函数外，若未来新增"仅本人"分类需修改两处 | 可考虑在模板分类定义中加 `selfOnly: true` 标记，computeSlotStates 读取该标记 |
| 2 | cloudfunctions/ai-chat/index.js | global.cloud 降级为 null 时，后续 cloud.callFunction 调用仍会静默失败 | 可增加 fallback 日志或前端错误提示 |

## P2 (可选)
| # | 文件 | 问题 |
|---|------|------|
| 1 | data/document-index-templates.js | SELF_ONLY_CATEGORIES 使用 indexOf 查找，分类数少(≤10)性能无影响，但可改用对象字面量 `{employment:1,financial:1,application:1}` |
