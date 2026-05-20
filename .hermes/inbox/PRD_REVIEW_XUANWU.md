# 玄武 PRD 合规审查
> 2026-05-21 | commit `43992d3` | 对照：住港伴V3产品定义 + 攻略书PRD v6

## P0 合规问题 — 0项

本轮变更未发现 P0 级PRD偏离。phase2拆4子阶段的改动与 PRD v6.0 第3.2节"流程控7阶段进度引擎"一致，将获批激活阶段细化为4个可独立验证的里程碑节点。

## P1 偏差 — 3项

| # | 偏差 | PRD要求 | 当前实现 | 建议 |
|---|------|---------|----------|------|
| P1-PRD-01 | **path-select 风险等级硬编码** | V3产品定义 §2.1：13条路径各有独立 riskLevel/cycle（如 CIES 为 high/7年，高才通C为 medium/2+3+3年） | `pages/path-select/index.js:94-95` 硬编码 `riskLevel:'medium', totalCycle:'7年'`，全部路径统一 | 对齐 process/index.js 的 PATH_RISK_LEVELS 动态查找（P0-CR-01 同因） |
| P1-PRD-02 | **里程碑事件提醒覆盖不全** | 攻略书PRD v6 §4.3：提醒引擎应覆盖全部7个阶段的关键时间节点 | reminders 仅覆盖 phase2 的4个子阶段（preparation_done / application_submitted / awaiting_approval / approval_activated），phase1/phase3/phase4 里程碑事件未接入 | 扩展 STAGE_CHAINS 增加 evaluation_done / maintenance_milestone / pr_checkpoint 链 |
| P1-PRD-03 | **currentStage 展示与实际状态不一致** | V3产品定义 §3.4：流程控首页 currentStage 应反映"当前所在阶段" | path-select 创建流程后 `currentStage: '资格评估'`，但 phase1 已自动完成，实际阶段为"材料准备" | 修改为 `currentStage: '材料准备'`（P1-CR-05 同因） |

## P2 优化建议 — 4项

| # | 优化建议 | 背景 |
|---|----------|------|
| P2-PRD-01 | **phase2 子阶段与攻略书关卡解锁联动** | 拆为4阶段后，攻略书 guide_unlock_thresholds 可更细粒度：关卡3(入境手续)应在 phase2_submission 后解锁，而非 phase2 全局解锁 |
| P2-PRD-02 | **里程碑验证结果通知用户** | PRD v6 §5.1 提到"里程碑验证通过后推送模板消息"——当前仅 toast 提示，无订阅消息/模板消息通知 |
| P2-PRD-03 | **里程碑材料历史记录** | 用户多次上传同类型材料时，仅保留最新记录。PRD 建议保留历史版本供审计 |
| P2-PRD-04 | **提醒链截止日期与香港节假日对齐** | 当前 deadlines 为纯日期偏移（+1/+7/+14天），未考虑香港公众假期。如激活e-Visa的7天提醒落在公众假期可能导致用户误解 |
