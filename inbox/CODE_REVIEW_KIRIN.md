# 麒麟 Code Review
> 攻略书模块 v6 全量变更 | 2026-05-14

## P0 (必须修)
无。

## P1 (建议修)
| # | 文件 | 问题 | 建议修复 |
|---|------|------|---------|
| 1 | index.js:mergeProgress | `currentPhase` 锁定逻辑简单粗暴——超前进度 > currentPhase 的关卡直接灰显，但没有区分"未解锁"和"已解锁但未到达" | 用 `progress.phases[phase].unlocked` 标记替代 `phase > progress.currentPhase` 判断 |
| 2 | onboarding-storage.js | `exportChecklist()` 生成的文本缺少 `docType` 的中文映射（如 `address`→`住址证明`） | 在export时加入 `docCategory` 中文映射表 |
| 3 | lifeGuideCache.js | `fetchByPath` 的缓存键只含 `{vt}-{fs}-{ar}`，未包含 `existingAssets`。同一路径但资产不同的用户会命中相同缓存 | 将 `existingAssets.join(',')` 加入缓存键后缀 |

## P2 (可选)
| # | 文件 | 问题 |
|---|------|------|
| 4 | index.wxml | 找房向导的 `wizardResults` 列表未做空态处理——如果 `matchDistricts` 返回空数组，UI空白 |
| 5 | district-data.js | 35区数据未标注数据采集时间和数据来源，时效性不可追溯 |
| 6 | index.wxss | `urgency-required/suggest/optional` 通过拼接 class 名判断，`.wxml` 中 `task.urgency==='必修'?'required'` 硬编码了枚举值 |

## 已闭环 (历史P0)
| P0 | 状态 |
|----|:--:|
| P0-3 guidebooks.test.js:31 `>=0` 永真断言 | ✅ 已修复为 `toBe(8)` |
| P0-4 guidebooks.test.js:63 条件守卫静默通过 | ✅ 已移除if守卫, 加 pre-assertion |
| P0-5 ai-chat.test.js:113 `null \|\| !!el` | ✅ 已验证: 断言在if块外，`!!null=false` 可正确失败 |
| 合规敏感词11处 | ✅ 扫描确认0 violations |
| wx mock基础设施 | ✅ setup.js 已创建, 29单测全部pass |
