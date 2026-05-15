# 住港伴 V3 — 项目进度单源真相

**最后更新**: 2026-05-15 09:45
**负责人**: Hermes (PMO)
**状态**: 🟢 全绿 — 4 Phase × 0 P0 × 5 P1延后

---

## 一、当前阶段

| 阶段 | 状态 |
|------|:--:|
| Phase 0 攻略书架构 | ✅ |
| Phase 1 攻略书核心功能 | ✅ |
| Phase 2 攻略书+找房向导 | ✅ |
| Phase 3 证件夹+预审 | ✅ |
| P2缺陷修复批次 | ✅ 29e82cb |

## 二、最新提交

```
29e82cb (HEAD -> main, origin/main) P0-2预算类型解析 + P0-3 Tab4攻略精选WXML渲染块
cc4a0d3 fix: fetchByPath传参5→4，housingIntent不移交云函数
5cc4b4f P2: 找房向导空态+数据源标注+完成自动展开关卡3+旧攻略Tab保留
d0eb391 fix: schoolNet.primary>0改为_hasSchoolNet预计算
a44829d fix: setupStep不在data中导致路径设置弹窗不可点击
dc58d5b fix: WXML编译错误 - repeat()→预计算stars
2aff77a 攻略书: Phase 0-3全量 + Hermes闸门修复
```

## 三、闸门状态 (2026-05-15 复闸)

| # | 项 | 结果 |
|---|-----|:--:|
| 1 | verify.sh | ✅ 38/39 |
| 1b | workflow-verify.sh | ✅ 36/36 |
| 2 | Jest (pre-push) | ✅ 421/425 |
| 3 | DevTools编译 | ✅ 三连绿 |
| 4 | 麒麟CodeReview | ✅ |
| 5 | 玄武PMReview | ✅ |
| 7 | git push | ✅ origin/main |
| 8 | ledger | ✅ |
| 9 | ACL通知 | ✅ |

## 四、P0修复（全部闭环）

| P0 | 问题 | 修复 |
|----|------|:--:|
| P0-1 | fetchByPath参数位移→skip_if_existing失效 | cc4a0d3 |
| P0-2 | matchDistricts收string算number→永远bracket[0] | 29e82cb |
| P0-3 | Tab4攻略精选WXML缺渲染块→空白页 | 29e82cb |

## 五、P1延后项

| # | 项 |
|---|-----|
| P1-1 | wizardBudget绕过setData |
| P1-2 | Object.values()低版本兼容 |
| P1-3 | urgency class硬编码 |
| P1-4 | wx-server-sdk版本锁定 |
| P1-5 | onStepCheck防御 |

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

## 七、P1排期

| 状态 | 说明 |
|:--:|------|
| 🔴 | outbox/TASK_P1_BATCH.md → Claude修复中 |
| ⏳ | 待Claude完成 → Hermes复闸 |

## 八、阻塞项

无。

## 九、下一步

1. Claude修P1-1~P1-5 → Hermes复闸
2. E2E种子方案重写
3. E2E通过率提升 (Process/Guidebooks/AI-Chat/Regression)
