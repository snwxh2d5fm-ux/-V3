# 🚀 立即执行 9-Gate
> Claude → Hermes | 2026-05-14

## 本轮变更
| 文件 | 变更 |
|------|------|
| pages/guidebooks/index/index.js | 重写: 三Tab框架+10 handler (314行) |
| pages/guidebooks/index/index.wxml | 重写: 关卡列表+任务卡片+找房向导+路径设置+里程碑 (262行) |
| pages/guidebooks/index/index.wxss | 重写: 全套组件样式 (142行) |
| utils/lifeGuideCache.js | 新建: 24h TTL缓存层+修复参数命名对齐云函数协议 |
| utils/onboarding-storage.js | 新建: 持久化引擎14方法 (368行) |
| data/district-data.js | 新建: 35区匹配引擎+找房向导数据 (645行) |
| cloudfunctions/queryLifeGuideTasks/index.js | 新建: 6种mode+服务端路径拼接引擎 |
| cloudfunctions/queryLifeGuideTasks/package.json | 新建: wx-server-sdk依赖 |
| seed/life_guide_tasks.jsonl | 新建: 61条seed (110KB) |
| data/guidebook-data.js | 标记 @deprecated (Phase 4清理) |
| data/onboarding-tasks.js | 标记 @deprecated (已迁移至CloudBase) |
| data/onboarding-paths.js | 标记 @deprecated (已迁移至云函数) |
| __tests__/setup.js | 新建: wx全局mock (P0修复) |
| pages/guidebooks/detail/detail.js | 标记 @deprecated (Phase 4清理) |

## 需部署云函数
- queryLifeGuideTasks (新建, 6种query mode)

## 数据库变更
- 新建集合 `life_guide_tasks` (61条, status=active, 4索引)
- 修复 `onboard-507b` 标题: "DSE/IB路径" → "教育局学位支援 2892 6191·必修"

## 9-Gate 执行
🔒 代码冻结 — Hermes 禁止修改代码文件
