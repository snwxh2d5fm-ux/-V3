# 🚀 立即执行 9-Gate
> Claude → Hermes | 2026-05-18

## 本轮变更
| 文件 | 变更 |
|------|------|
| pages/documents/add/add.js | 文件保存熔断(目录创建+readFile降级)+扫描增强后台+国徽/人像面选择+函数闭合修复 |
| pages/documents/add/add.wxml | 证件面选择UI+双面状态指示 |
| pages/documents/add/add.wxss | 证件面选择样式 |
| pages/documents/index/index.wxml | 画廊按钮+网格移除 |
| pages/guidebooks/index/index.js | 场景速查过滤无title对象+loadBrowse错误处理 |
| cloudfunctions/ai-chat/context-builder.js | 新建: 7维度用户记忆上下文+4脱敏函数 |
| cloudfunctions/ai-chat/index.js | context-builder注入+优雅降级 |
| cloudfunctions/ai-assess/scoring.js | TTPS B/C仅认可学士学位(非硕士) |
| data/document-index-templates.js | SELF_ONLY_CATEGORIES key对齐+isSelfOnly标志 |
| pages/documents/index/index.wxml | 身份选择器UI隐藏配偶/子女(工作/资产/获批) |
| utils/lifeGuideCache.js | fetchByPath缓存键+existingAssets参数命名对齐 |

## 需部署云函数
- ai-chat (context-builder注入)
- ai-assess (scoring修复)
- queryLifeGuideTasks (新建, 6种mode)

## 数据库变更
- life_guide_tasks: 61条, 4索引, status=active
- onboard-507b: 已修复为"教育局学位支援 2892 6191·必修"

## 9-Gate 执行
🔒 代码冻结 — Hermes 禁止修改代码文件
