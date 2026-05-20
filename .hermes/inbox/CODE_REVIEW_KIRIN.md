# 麒麟 Code Review
> 2026-05-21 | commit `43992d3` | 审查范围：6文件 / +250 -109

## P0 (必须修) — 3项

| # | 文件 | 行 | 问题 | 严重性 | 建议修复 |
|---|------|-----|------|--------|----------|
| P0-CR-01 | `pages/path-select/index.js` | 94-95 | **PATH_RISK_LEVELS 回归丢失**：`riskLevel: 'medium'` 和 `totalCycle: '7年'` 硬编码，而 process/index 保留了 `constants.PATH_RISK_LEVELS[id]` 动态查找。不同路径（如高才通A类/CIES）的风险等级和周期不同，硬编码导致全部路径统一。 | 数据正确性 | 对齐 process/index.js:178-179 的 PATH_RISK_LEVELS 查找模式 |
| P0-CR-02 | `pages/path-select/index.js` | 46-62, `pages/process/index/index.js` | 129-145 | **DRY 严重违规**：phase2拆4子阶段的逻辑在两处完全重复（~20行），包括4个阶段定义、step切片、stages.push。未来修改需同步两处，极易遗漏导致行为不一致。 | 可维护性 | 提取到 `utils/phase-builder.js` 的 `buildPhase2Stages(phase)` 工厂函数 |
| P0-CR-03 | `pages/path-select/index.js` | 116-133 | **云函数调用无超时保护**：`wx.cloud.callFunction({name:'process-manager',...})` 无 timeout/promise.race 包裹。编码规范要求"异步调用必须有超时保护"。对比例：process/index 的同名调用也缺超时。 | 可靠性 | 包裹 Promise.race([callFn(), new Promise((_,r)=>setTimeout(r,8000))]) |

## P1 (建议修) — 7项

| # | 文件 | 行 | 问题 | 建议修复 |
|---|------|-----|------|----------|
| P1-CR-01 | `pages/path-select/index.js` | 46, `pages/process/index/index.js` | 130 | `includes('onboarding')` 过度匹配：可能误匹配任何含 "onboarding" 的阶段ID。虽当前模板只有 phase2_onboarding，但扩展性差。 | 改为 `p.id === 'phase2_onboarding'` 精确匹配 |
| P1-CR-02 | `pages/reminders/index/index.js` | 68,124 (`subpkg-process/.../milestone-verify/index.js`) | **`__milestone_events__` 数组无界增长**：每次里程碑通过追加事件，无清理/截断机制。用户完成全部5个里程碑后数组仍有6+项，每次 onShow 都全量读取。 | 在 `checkMilestoneReminders` 结尾截断：`events.slice(-10)` 或定期清理已处理事件 |
| P1-CR-03 | `pages/reminders/index/index.js` | 89-100 | **STAGE_CHAINS 每次 onShow 重新创建**：4条链×3-4项提醒的定义对象在函数体内，每次页面显示都重新分配。 | 提升到模块顶层 `var STAGE_CHAINS = {...}` |
| P1-CR-04 | `pages/reminders/index/index.js` | 117 | `existing.some(...)` 在每个链步骤内调用 `getAllReminders()` 读取存储——如果4个里程碑各触发3-4条链，最多16次 getAllReminders 调用。 | 在循环外调用一次，传递数组引用 |
| P1-CR-05 | `pages/path-select/index.js` | 100 | **`currentStage: '资格评估'` 与实际不符**：第78-87行已自动完成 phase1 并解锁 phase2_material_prep，currentStage 应为 '材料准备' 而非 '资格评估'。 | 改为 `currentStage: '材料准备'` |
| P1-CR-06 | `pages/process/index/index.js` | 339 | `wx.setStorageSync('__process_stage__', index)` — `completeAllSteps` 中 index 是 UI 阶段索引（已通过 `_toStepIdx` 映射），但设值前无 0~6 范围校验。极端情况（如 phase3 返回-1）可能写入负值。 | 添加 `Math.max(0, Math.min(6, index))` 边界保护 |
| P1-CR-07 | `subpkg-process/pages/milestone-verify/index.js` | 85-127 | **里程碑验证失去服务器端权威**：旧代码有三步验证链（verify→404→create→retry），新代码纯本地。如果用户清除 Storage 后重装小程序，里程碑状态丢失且无云端可恢复。 | 保留本地推进为主，但在后台异步调 cloud 做最终一致性同步 |

## P2 (可选) — 3项

| # | 文件 | 行 | 问题 |
|---|------|-----|------|
| P2-CR-01 | `subpkg-process/pages/milestone-verify/index.js` | 96-113 | 本地推进逻辑与 `_localAdvanceStage` 相似但不相同（里程碑版缺版本号递增、缺边界保护） |
| P2-CR-02 | `pages/reminders/index/index.js` | 62 | `checkMilestoneReminders()` 在 onShow 每次调用，但 `checkAutoGenerate()` 也每次调用——双检查链可能产生重叠提醒 |
| P2-CR-03 | `data/constants.js` | 290-292 | `ui_to_phase` 中索引 2,3,4 仍映射到 `phase2_onboarding`——新4子阶段 stageId（phase2_material_prep 等）不在映射表中。虽靠 `_toStepIdx` 的 includes 匹配兜底，但单一真相源原则被破坏 |
