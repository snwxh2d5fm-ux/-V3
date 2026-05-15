# 麒麟代码审查报告 — cc4a0d3 + 29e82cb
时间: 2026-05-15
审查人: 麒麟 (Code Review subagent)

## P0 修复验证

### P0-1: fetchByPath 参数 5→4 — PASS
- pages/guidebooks/index/index.js:72 调用4参，与 utils/lifeGuideCache.js:194 定义完全一致
- housingIntent不传云函数合理（云函数从未消费该字段）

### P0-2: matchDistricts 预算类型修复 — PASS
- string budgetId → BUDGET_BRACKETS.min 数值，类型链完整
- 5档预算(b1~b5)全部覆盖，string===string比较正确

### P0-3: Tab4 WXML渲染块 — PASS
- 骨架屏/列表/空态/导航四要素齐备
- onArticleTap → navigateTo detail 路径存在

## P1 问题

### P1-1: housingIntent 数据孤岛
- 文件: pages/guidebooks/index/index.js:283, utils/onboarding-storage.js:42-51
- 现状: step===3收集housingIntent写入setupData，但initOnboarding的pathParams不含此字段，静默丢弃
- 建议: 明确保留或删除该字段的收集逻辑

### P1-2: loadArticles 无错误状态反馈
- 文件: pages/guidebooks/index/index.js:163-165
- 现状: fail回调只清loading，不设错误标志，空态无法区分"无内容"和"加载失败"
- 建议: 增加 articleLoadError 状态

## P2 问题

### P2-1: onArticleTap URL未encodeURIComponent
- 文件: pages/guidebooks/index/index.js:172
- 建议: encodeURIComponent(id)

### P2-2: wizardResults stars边界
- 文件: pages/guidebooks/index/index.js:351
- familyFriendly=0时显示1颗星，语义不准确

### P2-3: Promise.finally兼容性
- 文件: pages/guidebooks/index/index.js:58
- iOS 9/Android 4.x旧版WebView不支持，建议改为.then().catch()

### P2-4: article-list scroll-view高度
- 文件: pages/guidebooks/index/index.wxss:145
- calc()在部分低版本基础库可能不生效，建议增加min-height兜底
