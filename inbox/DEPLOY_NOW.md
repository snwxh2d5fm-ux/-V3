# 🚀 立即执行 9-Gate
> Claude → Hermes | 2026-05-14

## 本轮变更

### 变更 1: cloud 漏初始化修复
| 文件 | 变更 |
|------|------|
| cloudfunctions/ai-chat/index.js | +13行：补充缺失的 wx-server-sdk 初始化，修复 cloud.callFunction() 报 ReferenceError |

**根因**: ai-chat/index.js 调用 `cloud.callFunction('rag-search')` 和 `cloud.callFunction('content-moderation')`，但从未 `require('wx-server-sdk')` 或初始化 cloud 对象。其他所有云函数均有此导入，ai-chat 是唯一遗漏。

**修复**: 优先复用 `global.cloud`（测试 mock），生产环境走 `require('wx-server-sdk')` + `cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })`，缺失时优雅降级为 null。

### 变更 2: 证件夹 — 工作经历/资产证明/申请材料仅本人可见
| 文件 | 变更 |
|------|------|
| data/document-index-templates.js | +9行：新增 SELF_ONLY_CATEGORIES 常量 + computeSlotStates 分类级 effectiveOwner 逻辑 |

**背景**: 证件夹页面顶部有"本人/配偶/子女"切换器，但工作经历(employment)、资产证明(financial)、申请材料(application)三类材料天然属于申请人本人，配偶和子女无需提供。

**修复**: 在 `computeSlotStates()` 中，当处理 employment/financial/application 三个分类时，始终按 `ownerType='self'` 过滤材料，不受身份切换器影响。身份证明、学历证明、关系证明、保证人材料、监护人材料等分类继续跟随切换器正常过滤。

## 需部署云函数
- cloudfunctions/ai-chat

## 验证
- node -c ✅ 两文件语法通过
- Jest 14/14 unit tests pass ✅ (document-templates.test.js)
- Jest 16/16 suites, 421/425 pass ✅ (全量)

## 9-Gate 执行
🔒 代码冻结 — Hermes 禁止修改代码文件
