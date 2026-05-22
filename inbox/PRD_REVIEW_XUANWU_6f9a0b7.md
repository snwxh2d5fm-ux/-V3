# 玄武PRD审查报告 — commit 6f9a0b7 (三Bug修复)

**审查对象**: `6f9a0b7` (hotfix: 恢复assessmentDone变量 / 重写currentStepIdx)
**审查范围**: 完成阶段循环 / 攻略书横幅 / ¥599无反应 — 三Bug联动
**审查者**: 玄武 (via Hermes subagent)
**审查时间**: 2026-05-20
**PRD对照**: PRD v3.1 流程控7阶段 / 攻略书双通道里程碑 / 支付体系
**审查维度**: PRD对齐 / UX / 功能完整性

---

## 📋 范围定义

按 DEPLOY_NOW.md 三Bug验收标准：

| #   | Bug          | 真机验证项                                                 | 涉及文件                                       |
| --- | ------------ | ---------------------------------------------------------- | ---------------------------------------------- |
| 1   | 完成阶段循环 | 选路径后显示"材料准备"而非"获批激活"；"完成阶段"按钮可点击 | pages/process/index/index.js                   |
| 2   | 攻略书横幅   | 关卡1-7可点击展开；锁定关卡显示🔒 + 解锁提示               | pages/guidebooks/index/index.{js,wxml}         |
| 3   | ¥599无反应   | 点击身份标签→弹窗→"支付¥599"有反应                         | components/status-badge/status-badge.{js,wxml} |

---

## 🔴 P0 — 阻断 (发版前必须修复)

### P0-01: currentStepIdx 重写后 phase2_onboarding 永远映射到步骤2 — 步骤3/4不可达 [功能断裂]

- **文件**: `pages/process/index/index.js:380-392`
- **PRD条目**: 流程控7阶段正确展示 — current阶段必须与实际 in_progress stage 对齐
- **代码**:
  ```javascript
  // 找到第一个 in_progress 的 stage 作为当前阶段
  var currentStepIdx = 0;
  for (var si = 0; si < allStages.length; si++) {
    if (allStages[si].status === 'in_progress') {
      var pid = allStages[si].phaseId || '';
      if (pid.includes('phase1') || pid.includes('evaluation')) currentStepIdx = 1;
      else if (pid.includes('phase2') || pid.includes('onboarding'))
        currentStepIdx = 2; // ← 硬编码2
      else if (pid.includes('phase3') || pid.includes('maintenance')) currentStepIdx = 5;
      else if (pid.includes('phase4') || pid.includes('pr')) currentStepIdx = 6;
      else currentStepIdx = 1;
      break;
    }
  }
  ```
- **偏差**:
  1. STAGE_BRIDGE_MAP 定义 phase2_onboarding 覆盖 UI 索引 2/3/4 (线上申请/等待获批/获批激活)
  2. 但 `currentStepIdx` 映射无论 phase2 内哪个子阶段 in_progress，始终 → 2
  3. 用户推进到"等待获批"(3)或"获批激活"(4)时，流程控页面仍高亮"线上申请"(2)
  4. 7阶段指示器(stageSteps)也基于 currentStepIdx 渲染，导致指示器与实际进度脱节
- **影响**: 用户在 phase2 子阶段推进后，流程控首页的阶段高亮和7步指示器永远停在步骤2，产生"进度丢失"的感知。完成阶段按钮也会出现在错误的阶段卡片上。
- **修复**:
  方案A (精确): 在 phase2 内按 `allStages[si].order` 细分映射:
  ```javascript
  else if (pid.includes('phase2') || pid.includes('onboarding')) {
    var phase2Stages = allStages.filter(function(s) {
      return (s.phaseId||'').includes('phase2') || (s.phaseId||'').includes('onboarding');
    });
    var total = phase2Stages.length;
    var order = allStages[si].order || 0;
    if (total <= 3) currentStepIdx = [2, 3, 4][order] ?? 4;
    else currentStepIdx = order < total/3 ? 2 : order < total*2/3 ? 3 : 4;
  }
  ```
  方案B (简单): phase2 映射到最后一个未完成的 UI 子阶段索引。

---

### P0-02: 全阶段完成时 currentStepIdx 兜底为1 — 显示"材料准备"为current [UX错误]

- **文件**: `pages/process/index/index.js:392`
- **代码**:
  ```javascript
  if (currentStepIdx === 0) currentStepIdx = 1; // 兜底: 材料准备
  ```
- **偏差**: 当所有 stages 都已完成 (`completed`) 或全部处于 `locked` 状态时，循环找不到任何 `in_progress` stage，`currentStepIdx` 保持 0 → 兜底为 1 (材料准备)。
- **影响**: 用户完成全部7步后，流程控首页会显示"材料准备"为 current 阶段（且步骤1-6全标记为pending），形成"进度回退"的假象。用户困惑。
- **修复**:
  1. 循环结束后检查是否有任何 stage 为 `in_progress`
  2. 若无 in_progress 但有 completed，设置 `currentStepIdx = 7` (超出范围)，渲染全部 done
  3. 若无任何 stage 有状态，兜底为 1 是正确的（新建流程）

```javascript
var hasAnyProgress = allStages.some(function (s) {
  return s.status === 'in_progress' || s.status === 'completed';
});
if (!hasAnyProgress)
  currentStepIdx = 1; // 全新流程
else if (currentStepIdx === 0) currentStepIdx = 7; // 全部完成 → 标记全done
```

---

### P0-03: ¥9.90 解锁按钮仍使用 async/await — 与 ¥599 按钮相同根因 [兼容性风险]

- **文件**: `pages/guidebooks/index/index.js:458`
- **PRD条目**: 支付按钮在低版本微信基础库上必须正常响应
- **代码**:
  ```javascript
  unlockAllPhasesPay: async function() {   // ← async
    var self = this;
    wx.showLoading({ title: '处理中...' });
    try {
      var res = await wx.cloud.callFunction({ ... });  // ← await
      ...
      wx.requestPayment({
        ...
        success: async function() {        // ← async
          var confirmRes = await wx.cloud.callFunction({ ... });  // ← await
        }
      });
    } catch(e) { ... }
  }
  ```
- **偏差**: 与 `00df063` 修复的 ¥599 按钮完全相同的根因 — async/await 在某些微信基础库版本中事件处理不可靠。¥599 已改为回调链 (`.then()`), 但 ¥9.90 解锁按钮未同步修复。
- **影响**: 攻略书 ¥9.90 横幅按钮在低版本微信上点击无反应（与 DEPLOY_NOW.md 验证项#2 相悖 — 横幅应该 work）。
- **修复**: 将 `unlockAllPhasesPay` 改为普通函数 + `.then()` 回调链，与 `status-badge/confirmPaywall` 对齐。

---

## 🟡 P1 — 重要 (发版前修复)

### P1-01: 攻略书 ¥9.90 横幅按钮使用 `<button>` 而非 `<view>`+catchtap [事件穿透风险]

- **文件**: `pages/guidebooks/index/index.wxml:51,56`
- **偏差**:
  1. 攻略书横幅内的两个按钮使用 `<button class="btn ...">`
  2. 但 `00df063` 修复已证明 `<button>` 在 WeChat 事件机制中会拦截父层 `bindtap`
  3. status-badge 的 ¥599 按钮已改为 `<view>` + `catchtap`，但攻略书横幅未同步
- **影响**: 部分设备上点击 ¥9.90 按钮时，事件被 button 自身消费而不传递到父 view 的 `bindtap`。虽然目前按钮没有自己的 bindtap 而是依赖父层，但如果 button 吞掉事件则按钮无响应。
- **修复**: 将两处 `<button>` 改为 `<view>`，或直接在 button 上加 `catchtap` 指向对应方法:
  ```html
  <view class="btn btn--sm btn--primary" catchtap="unlockAllPhasesPay">¥9.90 立即解锁</view>
  <view class="btn btn--sm btn--outline" catchtap="goMembership">查看会员</view>
  ```

---

### P1-02: 流程控 completeAllSteps 的 completingStageIdx 未防止 loading 态穿透 [UX缺陷]

- **文件**: `pages/process/index/index.js:183` 和 `pages/process/index/index.wxml:192-193`
- **偏差**:
  1. `completingStageIdx` 设置在 stageIndex 上用于禁用按钮
  2. WXML 中 `wx:if="{{completingStageIdx!==index}}"` 切换按钮显示
  3. 但 `__completingAllSteps` 防重入门控在 L179 先执行，`setData({ completingStageIdx })` 在 L183 后执行
  4. 如果 `__completingAllSteps` 已被上一个未完成的调用设为 true，第183行的 setData 永远不会执行 → 按钮UI不会更新为"推进中..."
- **影响**: 快速双击"完成阶段"按钮时，第一个点击进入执行但按钮未变灰，用户可能以为没点到而再次点击（虽然被防重入门控拦截，但无视觉反馈）。
- **修复**: 将 `completingStageIdx` 的 setData 移到 `__completingAllSteps` 检查之前:
  ```javascript
  completeAllSteps: async function(e) {
    if (this.__completingAllSteps) return;
    this.setData({ completingStageIdx: e.currentTarget.dataset.stageIndex }); // ← 提前
    this.__completingAllSteps = true;
    ...
  }
  ```

---

### P1-03: loadActiveProcess 的 phases 缺少 completed 全阶段检测 — 与 currentStepIdx 耦合 [逻辑不完整]

- **文件**: `pages/process/index/index.js:395-420`
- **偏差**:
  1. `phases` 的 status 计算完全依赖 `currentStepIdx` 变量
  2. `currentStepIdx` 来自 stages 的 `in_progress` 状态查找
  3. 但 `phases.map` 中 `i < currentStepIdx → 'done'` 只能标记前面的步骤为完成
  4. 如果 stage 的 `status === 'completed'` 但不在 in_progress 查找范围内（如 phase2 的子阶段 3/4），它们对应的 UI 步骤就不会被标记为 'done'
- **影响**: phase2_onboarding 的子阶段完成后，UI 步骤 3 (等待获批) 和 4 (获批激活) 可能显示为 'pending' 而非 'done'，即使对应的 stage 已经是 completed。
- **修复**: phases 构建时增加对已完成 stage 的二次校验:
  ```javascript
  // 检查该 UI 步骤对应的所有 stages 是否全部完成
  var stepStages = stepMaterials[i];
  var allStepStagesDone =
    stepStages.length > 0 &&
    stepStages.every(function (s) {
      return s.status === 'completed';
    });
  if (allStepStagesDone && i > currentStepIdx) {
    status = 'done'; // 即使 currentStepIdx 未覆盖，已完成也应标记 done
  }
  ```

---

## 🟢 P2 — 建议 (后续迭代)

### P2-01: assessmentDone 变量仅用于资格评估步骤 — 与 currentStepIdx 计算分离后可简化

- **文件**: `pages/process/index/index.js:393`
- **说明**: `assessmentDone = !!activeProcess` 在第393行计算，但 `currentStepIdx` 已经不再依赖它。`assessmentDone` 现在仅用于 phases.map 中判断 hasAssessBtn 的步骤状态。这两个变量的计算逻辑已经完全解耦，但放在相邻位置容易让人误以为有关联。
- **建议**: 将 `assessmentDone` 移到 phases.map 的闭包内，或加注释说明解耦关系。

### P2-02: guidebooks 横幅 hasLockedPhases 依赖 init() 的异步结果 — 初次加载可能闪烁

- **文件**: `pages/guidebooks/index/index.js:46` (WXML) 和 `init()` 方法
- **说明**: `hasLockedPhases` 在 `init()` 中通过 `mergeProgress` 异步计算。在本地数据立即渲染后、CloudBase 数据合并前，`hasLockedPhases` 的值可能不准确（本地数据可能全部解锁，但 CloudBase 合并后发现有锁定的相位）。
- **影响**: 横幅可能在页面加载后短暂消失再出现（闪烁）。
- **建议**: 在 `init()` 的本地渲染阶段使用保守值 (hasLockedPhases: true)，等 CloudBase 合并后再精确计算。

### P2-03: ¥599 confirmPayment 调用不等待结果 — 本地清除后云端可能未确认

- **文件**: `components/status-badge/status-badge.js:152-155`
- **代码**:
  ```javascript
  wx.cloud
    .callFunction({
      name: 'payment',
      data: { action: 'confirmPayment', orderId: paymentData.orderId },
    })
    .catch(function () {});
  ```
- **说明**: confirmPayment 是 fire-and-forget — 本地 storage 已清除、页面已跳转，但 confirmPayment 可能因网络原因失败。虽然有 V3 回调兜底，但回调可能延迟。
- **影响**: 极低概率下用户支付成功但云端状态未更新，身份重置不完全。
- **建议**: 至少 await confirmPayment 结果，失败时提示用户或重试。

### P2-04: completeAllSteps 使用 async/await — 与 ¥599 按钮修复方向不一致

- **文件**: `pages/process/index/index.js:177`
- **代码**: `completeAllSteps: async function(e) {`
- **说明**: CODE_REVIEW_KIRIN 已标记此为 P2-6: "completeStep 仍用 async/await（与 ¥599 按钮修复方向相反）"。虽然 completeAllSteps 不在按钮事件路径上（它通过 handleStep 触发），但为了一致性和低版本兼容，建议统一迁移到 .then() 链。
- **建议**: 下一轮统一替换所有 async/await 为 .then() 回调链。

---

## 📊 汇总

| 级别 | 数量 | 关键项                                                                                  |
| :--: | :--: | --------------------------------------------------------------------------------------- |
|  P0  |  3   | phase2映射断裂 / 全完成兜底错误 / ¥9.90 async残留                                       |
|  P1  |  3   | button→view未同步 / loading态穿透 / phases完成检测缺失                                  |
|  P2  |  4   | assessmentDone解耦 / 横幅闪烁 / confirmPayment fire-and-forget / completeAllSteps async |

---

## ✅ 已验证修复 (本轮正确交付的项)

| #   | 修复项                                                       | 文件                                            |         状态         |
| --- | ------------------------------------------------------------ | ----------------------------------------------- | :------------------: |
| F1  | assessmentDone 变量恢复                                      | pages/process/index/index.js:393                |          ✅          |
| F2  | completingStageIdx loading状态                               | pages/process/index/index.js:38,183,286         |          ✅          |
| F3  | currentStepIdx 从 in_progress 而非 materials 计算            | pages/process/index/index.js:378-392            | ✅ (但有P0-01/P0-02) |
| F4  | isMilestone / milestoneDocType 注入 phases                   | pages/process/index/index.js:412-413            |          ✅          |
| F5  | guidebooks onPhaseTap 移除 unlocked 门控 (前序commit)        | pages/guidebooks/index/index.js:922-930         |          ✅          |
| F6  | ¥599 confirmPaywall 普通函数 + Modal先于setData (前序commit) | components/status-badge/status-badge.js:115-178 |          ✅          |

---

## 🔍 数据流闭合检查

```
流程控阶段推进流:
  onSelectDirectPath → saveProcessLine(stages填充) → loadActiveProcess
  → currentStepIdx(查in_progress) → phases状态计算 → WXML渲染
  ⚠️ phase2子阶段不可达 (P0-01)
  ⚠️ 全完成→兜底为1 (P0-02)
  ⚠️ completed阶段可能显示为pending (P1-03)

流程控完成阶段流:
  completeAllSteps → cloud.callFunction(process-manager/completeStep)
  → loadActiveProcess → 刷新UI
  ⚠️ loading态防重入时序 (P1-02)
  ⚠️ async/await兼容性 (P2-04)

攻略书解锁流:
  mergeProgress → 三级解锁判定 → hasLockedPhases → ¥9.90横幅
  ⚠️ ¥9.90按钮 async残留 (P0-03)
  ⚠️ 按钮事件穿透 (P1-01)

¥599支付流:
  onTapIdentity → showPaywall → confirmPaywall(回调链) → payment云函数 → requestPayment
  ✅ 主链路正确 (前序commit已修复)
  ⚠️ confirmPayment fire-and-forget (P2-03)
```

---

## 🏁 总体评价

本轮 commit 6f9a0b7 在 `pages/process/index/index.js` 中正确恢复了 `assessmentDone` 变量并新增了 `completingStageIdx` loading 态。`currentStepIdx` 重写为基于 `in_progress` stage 查找的方向是正确的（根除了之前基于 materials 状态的不稳定计算）。

**但 3 个 P0 阻断项必须在合并前修复**:

- **P0-01 (最高优先级)**: phase2_onboarding 的 UI 子阶段映射断裂 → 步骤3/4永远不可达
- **P0-02**: 全阶段完成时 currentStepIdx 兜底为1 → 进度回退假象
- **P0-03**: ¥9.90 按钮 async 未同步修复 → 与 ¥599 按钮相同根因

P0-01 和 P0-02 是同一段代码的两个边界问题，建议一次修复。P0-03 是 ¥599 修复的遗漏项，修改量小。

**建议**: 修复 3 个 P0 后重新走 Hermes 审查，目标零 P0 交付。
