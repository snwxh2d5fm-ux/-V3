# REVIEW: 6f9a0b7 双审发现 — 3 P0 + 2 P1

**日期**: 2026-05-20
**来源**: Hermes 9-Gate (麒麟+玄武)
**优先级**: P0

---

## P0-01 [玄武] currentStepIdx: phase2_onboarding 永远映射步骤2

**文件**: `pages/process/index/index.js:378-391`
**问题**: 新增的 `currentStepIdx` 仅按 `phaseId` 粗粒度映射。phase2 覆盖 UI 步骤 2/3/4，但新逻辑全部映射到 `currentStepIdx=2`。`stepMaterials` 构建时有正确的子步拆分 (行354-369)，但两处不同步。
**影响**: 用户在步骤3(等待获批)或步骤4(获批激活)时，UI 错误标记步骤2为 current
**修复**: `in_progress` 命中后复用 `stepMaterials` 的子步逻辑反查实际 stepIdx

## P0-02 [玄武] 全阶段完成时 currentStepIdx=1 进度回退

**文件**: `pages/process/index/index.js:388-391`
**问题**: 所有 stages 完成时兜底 `currentStepIdx = 1`，显示"材料准备"为 current
**影响**: 用户看到进度回退假象
**修复**: 全完成时 `currentStepIdx = ui_stages.length - 1` (最后一步) 或 `= 7` (完成态)

## P0-03 [玄武] ¥9.90 攻略书解锁按钮仍用 async/await

**文件**: `pages/guidebooks/index/index.js`
**问题**: ¥9.90 按钮未同步 ¥599 的 `<button>→<view>` + 回调链修复，仍残留 async/await
**影响**: 与 ¥599 相同根因 — WeChat button 事件机制兼容性
**修复**: 同步应用 `<button>→<view>` + `.then()` 链

## P1-01 [麒麟] currentStepIdx 与 stepMaterials 粒度不同步

**文件**: `pages/process/index/index.js:354-369` vs `378-391`
**问题**: 两段代码做相同的 phaseId→index 映射，规则不一致
**修复**: 提取 `mapPhaseIdToStepIndex(phaseId, order)` 两处共用

## P1-02 [麒麟] completingStageIdx 可能为 undefined

**文件**: `pages/process/index/index.js:183`
**问题**: `e.currentTarget.dataset.stageIndex` 未做空值校验
**修复**: `parseInt(e.currentTarget?.dataset?.stageIndex) || -1`

---

## 铁律

仅修改上述文件，不动其他代码。P0-01/02/03 优先修复。
