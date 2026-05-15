# 玄武PRD对齐审查报告 — cc4a0d3 + 29e82cb
时间: 2026-05-15
审查人: 玄武 (PM Review subagent)

## P0 修复验证

### P0-1: fetchByPath参数修复 — PASS
- 攻略书加载链路完整: fetchByPath → queryLifeGuideTasks → 数据返回 → 渲染
- housingIntent不传云函数设计合理（云函数不消费该字段）

### P0-2: 找房向导预算匹配 — PASS
- 5个预算档位(b1~b5)全部正确转换为数值
- matchDistricts可正确返回区域推荐

### P0-3: Tab4攻略精选渲染块 — PASS(结构)
- WXML结构完整，四要素齐备
- 但存在P1-A数据层断链（见下）

## P1 问题

### P1-A: Tab4攻略精选云函数action名不匹配 [阻断]
- 文件: pages/guidebooks/index/index.js:158
- 现状: 前端调用 action:'listArticles'，云函数guidebook只支持'getArticles'
- 影响: Tab4切换后articles始终为空，用户只看到"暂无攻略文章"，功能实质不可用
- 修复: 将前端 action 改为 'getArticles'（一行修改）

### P1-B: BUDGET_BRACKETS b4/b5边界值重叠
- 文件: data/district-data.js:507-508
- b4.max=60000，b5.min=60000，budget=60000被归入b4
- 当前无实际影响（bracket不用于限价过滤），但逻辑隐患存在

## P2 问题

### P2-A: loadArticles失败无错误提示
- 用户无法区分"无内容"和"加载失败"，缺少重试入口

### P2-B: article-list scroll-view高度约束
- 部分机型calc()可能不生效，建议min-height兜底

### P2-C: onArticleTap导航路径未encodeURIComponent
- id含特殊字符时可能导航失败

## 总结

3个P0修复方向正确，代码结构符合PRD预期。
主要风险: P1-A Tab4实际无法展示文章，建议本次复闸前一并修复。
