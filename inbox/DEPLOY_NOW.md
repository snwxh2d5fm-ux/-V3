# 🚀 立即执行 9-Gate
> Claude → Hermes | 2026-05-18

## 本轮变更 (cf29a0c)
| 文件 | 变更 |
|------|------|
| `utils/normalizeTask.js` | 新增: 统一任务规范化管线, 消除5处 ad-hoc 转换 |
| `utils/lifeGuideCache.js` | fetchByPathLocal 改为同步返回 |
| `utils/onboarding-storage.js` | 全关卡解锁/housingIntent/housingWizardDone/family.applicable |
| `pages/guidebooks/index/index.js` | 方案C本地为主 + CloudBase增强 + 场景速查重构 |
| `pages/guidebooks/index/index.wxml` | `<text>`→`<view>`防截断 + 找房向导 + 了解详情弹窗 |
| `data/onboarding-tasks.js` | 优才3+3+2全量修正 + 年级年份修正 + 反推过关日 |
| `data/scene-tags.js` | 新增: 67项任务标签映射 |
| `data/guidebook-data.js` | 优才3+3+2修正 |
| `data/solution-library.js` | 优才3+3+2修正 |
| `data/rules/reminders.js` | 优才3+3+2修正 |
| `cloudfunctions/solution-engine/index.js` | 优才3+3+2修正 |
| `pages/guide/index/index.js` | 优才3+3+2修正 |
| `CLAUDE.md` | 新增项目文档 |

## 需部署云函数
无（本次全客户端改动）

## 测试校验 (由Hermes执行)
```bash
# L1+L2+L3
cd 住港伴V3-开发中 && node test-guidebook-full.cjs

# Jest回归
npx jest tests/jest/unit/guidebook-data.test.js tests/jest/unit/persona-compat.test.js tests/jest/unit/app-integrity.test.js --no-coverage
```

## 真机冒烟清单
- [ ] Tab0 关卡0→3 各展开3个任务卡片，步骤/贴士/坑点完整
- [ ] Tab1 分类标签(银行/教育/医疗/住房)过滤正常
- [ ] Tab1 点击"登记HA Go"卡片展开有内容
- [ ] Tab1 "了解详情"全屏弹窗内容完整
- [ ] Tab1 "加入我的生活指南"→自动跳Tab0展开对应关卡
- [ ] Tab2 统计面板+续签档案
- [ ] 找房向导横幅可见→三问→推荐区域

## 9-Gate 执行
🔒 代码冻结 — Hermes 禁止修改代码文件
