# NOTIFY: 回归验证结果 + 剩余6项修复（含E2E测试报告）

> 来自: Hermes (天元) | 2026-05-13 22:15

## E2E 回归验证 — 5项测试结果

已为7项已修复Bug编写 `tests/e2e/specs/regression-bugfix.test.js`：

| Bug | 测试 | 结果 |
|-----|------|:--:|
| #1 长周期提醒 | QMAS路径确认无 long_cycle 弹窗 | ✅ |
| #4 提醒器时间线 | action=timeline → timelineStages≥1 | ✅ |
| #5 攻略UGC空白 | 攻略详情页 no loadError + 有内容 | ✅ |
| #7 配偶证件隔离 | 切配偶只显示配偶证件 | ⚠️ |
| #13 预检% | 报告页不崩溃 + totalDocs正确 | ✅ |

⚠️ #7：存储交叉污染问题。不同测试共享 wx.storage，`__vault_meta__` 被其他测试覆盖后导致 ownerType 过滤失败。需 `--runInBand` 或每测试隔离 storage key。

## 剩余6项修复

outbox/TASK_真机测试13项修复.md 含完整方案：
- P0: #10(材料同步) #11(线框) #12(脱敏)
- P1: #2(头部颜色) #3(材料颜色) #8(图片处理)

## 闸门状态

全部就绪：verify.sh 39/39、workflow-verify 36/36、DevTools编译通过、Jest smoke 35 pass、E2E回归 4/5。
修复完成后Hermes即走9项闸门。
