# 住港伴 V3 — 项目进度单源真相

**最后更新**: 2026-05-15 11:40
**负责人**: Hermes (PMO)
**状态**: 🟢 P1复闸完成 — 7/9 Gate通过 (ledger+ACL待补) | CloudBase部署建议中

---

## 一、当前阶段

| 阶段 | 状态 |
|------|:--:|
| Phase 0 攻略书架构 | ✅ |
| Phase 1 攻略书核心功能 | ✅ |
| Phase 2 攻略书+找房向导 | ✅ |
| Phase 3 证件夹+预审 | ✅ |
| P0缺陷修复批次 | ✅ 29e82cb |
| P1缺陷修复批次 | ✅ a723a42 |

## 二、最新提交

```
a723a42 (HEAD -> main, origin/main) fix: P1批次 — wizardBudget走setData/Object.values兼容/urgency预计算/wx-server-sdk锁版本/steps缺失防御
ac328d7 docs: CLAUDE.md增强 — 启动必读PROGRESS.md/编码规范/已知陷阱/闸门顺序/K2红线
29e82cb fix: P0-2预算类型解析 + P0-3 Tab4攻略精选WXML渲染块
```

## 三、P1修复进度 — ✅ 完成

| P1 | 问题 | 修复 |
|----|------|:--:|
| P1-1 | wizardBudget绕过setData | a723a42 |
| P1-2 | Object.values()兼容 | a723a42 |
| P1-3 | urgency class硬编码 | a723a42 |
| P1-4 | wx-server-sdk版本锁定(22文件) | a723a42 |
| P1-5 | task.steps缺失防御 | a723a42 |

## 四、闸门状态 (P1复闸进行中)

| # | 项 | 结果 |
|---|-----|:--:|
| 1 | verify.sh | ✅ 38/39 (A8 PII预存) |
| 1b | workflow-verify.sh | ✅ 36/36 |
| 2 | Jest | ✅ 421/425 |
| 3 | DevTools编译 | ✅ build通过 (preview粘滞已知) |
| 4 | 麒麟CodeReview | ✅ 通过 |
| 5 | 玄武PMReview | ✅ 通过 |
| 7 | git push | ✅ a723a42 |
| 8 | ledger | ⏳ |
| 9 | ACL通知 | ⏳ |

## 五、P0修复（全部闭环）

| P0 | 问题 | 修复 |
|----|------|:--:|
| P0-1 | fetchByPath参数位移→skip_if_existing失效 | cc4a0d3 |
| P0-2 | matchDistricts收string算number→永远bracket[0] | 29e82cb |
| P0-3 | Tab4攻略精选WXML缺渲染块→空白页 | 29e82cb |

## 六、E2E测试

| 层级 | 通过率 |
|------|:--:|
| Smoke | 14/14 (100%) |
| Documents | 5/5 (100%) |
| Reminders | 5/5 (100%) |
| Process | 1/4 (25%) |
| Guidebooks | 4/6 (67%) |
| AI-Chat | 4/6 (67%) |
| Regression | 6/19 (32%) |
| **总** | **59% (29/49)** |

## 七、看门狗inbox积压

✅ 已清零 (2026-05-15 MT天衣归档)

| 文件 | 处理 | 原因 |
|------|------|------|
| WATCHDOG_部署_deploy_urgent.md | 归档 | P1 a723a42已push，部署建议中 |
| WATCHDOG_任务_TASK_bug8_rotate_fix.md | 归档 | 13a37ad已修复旋转裁切 |
| WATCHDOG_任务_TASK_单元测试细化.md | 归档 | outbox无对应TASK，孤儿通知 |

## 八、阻塞项

无。P1已提交a723a42。

## 九、商业价值交付物

| 交付物 | 状态 | 说明 |
|--------|:--:|------|
| 攻略书(Tab 0-2) | ✅ | 生命关卡+任务卡片+进度追踪 |
| 找房向导 | ✅ | 35区匹配引擎+budget驱动推荐 |
| 证件夹+预审 | ✅ | OCR识别+K2安全隔离 |
| 攻略精选(Tab 3) | ✅ | 47篇文章资产渲染 (29e82cb修复) |
| AI对话 | ✅ | CloudBase AI SDK集成 |
| 隐私保护 | ✅ | 上传即删+加密+PII扫描 |

## 十、产品缺口盘点 (PD 2026-05-15)

全景盘点报告: outbox/PD_PANORAMA_v2.md (七大模块摸底+DSG-1复核+6缺口)
前置盘点: outbox/PD_GAP_INVENTORY_v1.md。6 项缺口：

### DSG-1 审计复核 (v2.0 — 54/100 D+)

| 维度 | 得分 | 5项P0修复状态 |
|------|:--:|------|
| 设计令牌一致性 | 42/100 | P0-03 floating-ai/home令牌旁路: 🔴未修 |
| 组件库状态覆盖 | 38/100 | P0-04 零aria+零alt: 🔴未修 |
| 排版与间距系统 | 35/100 | P0-05 playbook/guidebooks命名冲突: 🔴未修 |
| 无障碍与移动适配 | 22/100 | P0-01 双中枢冗余: ⚠️部分(pages/index已降级) |
| 信息架构与导航 | 55/100 | P0-02 reminders/list/list死页面: 🔴未验证 |

| 优先级 | 缺口 | 状态 |
|:--:|------|:--:|
| P0 | 攻略书v6对齐（推荐分裂+搜索缺失+行为驱动） | 🔴 待分派 |
| P0 | 信息栏数据活水（3条硬编码→政策RSS+推送） | 🔴 待分派 |
| P1 | 设计令牌落地（32/100审计分→tokens.wxss） | 🔴 待分派 |
| P1 | Reminder产品对齐（规则链补全+证件联动） | 🔴 待分派 |
| P2 | Onboarding引导（3步递进式→测评+任务） | 🟡 排期中 |
| P2 | 付费锁屏策略（免费层限制+价值感知+裂变） | 🟡 排期中 |

## 十二、下一步

1. 🔴 outbox/TASK_GUIDEBOOK_V6.md + TASK_INFO_FEED.md → Claude（P0 攻略书+信息栏）
2. 🟡 CloudBase重新部署 (22云函数package.json版本锁定需触发部署生效)
3. ⏳ P1 设计令牌 + Reminder → 排入下迭代
4. ⏳ E2E种子方案重写 → 提升通过率
5. ⏳ 清理看门狗积压
6. ⏳ ledger + ACL通知补完
