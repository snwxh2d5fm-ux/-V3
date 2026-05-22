# 玄武PRD审查报告 — commit 2ab08b2

**审查对象**: `2ab08b2` (玄武3P0+3P1+4P2全量修复)
**审查范围**: 3文件变更 — process/index/index.js + guidebooks/index/\*
**审查者**: 玄武 (via Hermes subagent)
**审查时间**: 2026-05-20
**PRD对照**: PRD v3.1 流程控/攻略书双模块
**验证基线**: verify.sh 通过 19/38 | Jest 365/365 passed

---

## 🔴 P0 — 阻断 (发版前必须修复)

### P0-01: completeAllSteps 早期返回泄露防重入标记和UI状态 [死锁]

- **文件**: `pages/process/index/index.js:178-289`
- **PRD条目**: 流程控 — 通道A「完成当前阶段」功能完整性
- **根因**: 将 `try...finally` 重构为 Promise 链 `.finally()` 后，6条早期返回路径不再经过 finally 清理块。旧代码的 `finally` 在 JavaScript 语义中会在 `return` 后仍执行，但 Promise 的 `.finally()` 只在 Promise 链被触发时才执行。

- **泄露路径**（全部不清理 `__completingAllSteps` 和 `completingStageIdx`）:

  | 行号 | 条件                                     | 后果                           |
  | ---- | ---------------------------------------- | ------------------------------ |
  | L183 | `__completingAllSteps` 已为 true（双击） | 死锁 + completingStageIdx 残留 |
  | L189 | `!phase`（阶段不存在）                   | 死锁 + 按钮永久灰显            |
  | L194 | `phase.status !== 'current'`             | 死锁 + 按钮永久灰显            |
  | L202 | 无 activeProcess 或其 stages 为空        | 死锁 + 按钮永久灰显            |
  | L220 | `!currentStage` 未找到对应阶段           | 死锁 + 按钮永久灰显            |
  | L230 | `pendingSteps.length === 0`              | 死锁 + 按钮永久灰显            |
  | L236 | `!processId`                             | 死锁 + 按钮永久灰显            |

- **影响**: 任意验证失败后，用户无法再次点击任何阶段的「完成当前阶段」按钮，必须杀进程重开页面。按钮UI永久灰显（completingStageIdx 不恢复为 -1）。

- **修复**:
  ```javascript
  completeAllSteps: function(e) {
    var index = parseInt(...) || -1;
    // 先检查防重入，再 setData
    if (this.__completingAllSteps) return;
    this.__completingAllSteps = true;
    this.setData({ completingStageIdx: index });

    // 统一清理函数
    var cleanup = function() {
      this.__completingAllSteps = false;
      this.setData({ completingStageIdx: -1 });
    }.bind(this);

    // 所有早期返回前调用 cleanup()
    if (!phase) { cleanup(); wx.showToast(...); return; }
    // ... 其余同理

    // Promise 链 .finally(cleanup)
  }
  ```
  关键：必须在所有 `return` 前显式调用 `cleanup()`，或将早期检查包裹回 `try...finally`。

---

### P0-02: 编码规范违规 — completeAllSteps Promise 链无超时保护 [合规红线]

- **文件**: `pages/process/index/index.js:244-261`
- **规范条目**: 住港伴编码规范第1条 — "异步调用必须有超时保护（最长 60s）"
- **代码**:
  ```javascript
  function processStep(si) {
    if (si >= pendingSteps.length) {
      return Promise.resolve(lastResult);
    }
    var st = pendingSteps[si];
    return wx.cloud.callFunction({     // ← 无超时保护
      name: 'process-manager',
      data: { action: 'completeStep', ... }
    }).then(function(res) { ... });
  }
  ```
- **偏差**: 递归 Promise 链中对每个 `wx.cloud.callFunction` 调用均无超时保护。若 `process-manager` 云函数因冷启动/网络问题挂起，用户将看到「推进中...」loading 无限持续，且 `wx.hideLoading()` 永远不会被调用。
- **影响**: 用户体验死锁（loading 遮罩无法关闭）+ 违反编码规范 P0 硬约束。
- **修复**: 对 `wx.cloud.callFunction` 包装超时 Promise：
  ```javascript
  function callWithTimeout(fn, timeout) {
    return Promise.race([
      fn,
      new Promise(function (_, reject) {
        setTimeout(function () {
          reject(new Error('TIMEOUT'));
        }, timeout);
      }),
    ]);
  }
  ```

---

### P0-03: completeAllSteps catch 块静默吞错 — 无日志/无上报 [可观测性断裂]

- **文件**: `pages/process/index/index.js:282-284`
- **编码规范条目**: 第1条 — "禁止空 catch 块" / 第5条 — "每层都要处理错误，绝不默默吞掉错误"
- **代码**:
  ```javascript
  }).catch(function() {                    // ← 无参数, 无日志
    wx.hideLoading();
    wx.showToast({ title: '网络异常，请重试', icon: 'none' });
  })
  ```
- **对比**: 同一 commit 的 guidebooks P2-03 修复明确添加了 `console.error('[guidebooks] confirmPayment失败:', err)`。但 process/index.js 的 catch 块完全未记录错误详情。
- **影响**: 线上问题排查时无任何错误上下文，无法区分「网络超时」「云函数权限错误」「参数不合法」等不同失败原因。showToast 对用户始终显示相同的「网络异常」，用户反复重试无效。
- **修复**: 与 guidebooks 保持一致，添加 `console.error` 日志：
  ```javascript
  }).catch(function(err) {
    console.error('[completeAllSteps] Promise链失败:', err);
    wx.hideLoading();
    wx.showToast({ title: '网络异常，请重试', icon: 'none' });
  })
  ```

---

## 🟡 P1 — 重要 (发版前修复)

### P1-01: \_toStepIdx 未知phaseId 兜底映射使用数组索引而非 order 字段 [映射偏差]

- **文件**: `pages/process/index/index.js:400-403`
- **PRD条目**: 流程控 — 7步指示器进度准确性
- **代码**:
  ```javascript
  if (mapped === -1) {
    var ratio = allStages.length > 1 ? si / (allStages.length - 1) : 0;
    //                                        ^^ 用的是数组索引, 非 stage.order
    mapped = Math.max(1, Math.min(6, Math.round(ratio * 6)));
  }
  ```
- **偏差**: 变量 `si` 是 `allStages` 数组的**遍历索引**（for 循环变量），而非 stage 自身的 `order` 字段。若 stages 数组顺序与 order 不一致（如经过排序、插入等操作），映射结果会偏离正确步骤。
- **修复**: 改用 stage 自身的 order 字段计算比例：
  ```javascript
  var orders = allStages.map(function (s) {
    return s.order || 0;
  });
  var minOrder = Math.min.apply(null, orders);
  var maxOrder = Math.max.apply(null, orders);
  var range = maxOrder - minOrder || 1;
  var ratio = (allStages[si].order - minOrder) / range;
  ```

---

### P1-02: \_loadBrowseLocal 未同步 isMember 参数传递 [功能遗漏]

- **文件**: `pages/guidebooks/index/index.js:738`
- **偏差**: 该 commit 在主数据加载路径（L156）新增了 `isMember` 参数传递给 `fetchByPathLocal`，但 `_loadBrowseLocal` 方法（L738，deprecated 标记）仍使用旧的 4 参数签名。
- **代码对比**:

  ```javascript
  // L156 主路径 — 已更新 ✅
  localResult = cache.fetchByPathLocal(
    params.visaType,
    params.familyStatus,
    params.arrivalScenario,
    params.existingAssets,
    isMember,
  );

  // L738 _loadBrowseLocal — 未更新 ❌
  var result = cache.fetchByPathLocal(
    params.visaType,
    params.familyStatus,
    params.arrivalScenario,
    params.existingAssets,
  );
  ```

- **影响**: 若 `_loadBrowseLocal` 仍被调用（虽标记 deprecated 但未被移除），会员用户在该路径下看到的内容不会反映会员解锁状态。
- **修复**: 同步更新 `_loadBrowseLocal` 调用签名，或直接移除此 deprecated 方法。

---

### P1-03: P1-02 "双击反馈" 与 P0-01 存在因果关系 [设计决策复审]

- **文件**: `pages/process/index/index.js:180-183`
- **决策**: 将 `setData({ completingStageIdx: index })` 移至 `__completingAllSteps` guard 之前，以提供"快速双击时按钮立即变灰"的视觉反馈。
- **分析**: 此设计在**正常路径**（非双击、无错误）下工作正常。但：
  1. 与 P0-01 早期返回泄露共同作用时，错误路径下的 completingStageIdx 永久残留
  2. 即使修复 P0-01，如果用户在 `setData` 后、`cleanup` 前快速连续点击不同阶段的按钮，会看到错误的灰显指示
- **建议**: 修复 P0-01 后重新评估此设计。替代方案：使用局部状态追踪而非全局 setData（如 `this.__completingIdx`），仅在真正开始处理时 setData。

---

## 🟢 P2 — 建议 (后续迭代)

### P2-01: completeAllSteps 成功路径未刷新攻略书联动状态

- **文件**: `pages/process/index/index.js:277`
- **说明**: `self.loadActiveProcess()` 仅更新流程控页面数据，但攻略书页面可能需要知道流程推进（关卡解锁）。当前依靠 `__process_stage__` Storage 键同步，但 `mergeProgress` 是攻略书 init 时调用，如果攻略书页面已在后台，不会自动感知阶段推进。
- **建议**: 在 completeAllSteps 成功后触发攻略书页面数据刷新（如通过 globalData 标记 + onShow 检查）。

---

### P2-02: P2-02 !loading 防闪烁可能掩盖真正的加载失败

- **文件**: `pages/guidebooks/index/index.wxml:46`
- **代码**: `wx:if="{{!loading && !isMember && hasLockedPhases}}"`
- **分析**: 正常路径下 `loading` 必然为 false 时才渲染此横幅，正确。但若 `loading` 因异常未正确置 false（代码中有 catch 路径设置 `loading: false`，覆盖率完整），则横幅永不显示。低风险但建议在 `onError` 中增加兜底 `loading: false`。
- **当前状态**: 代码中 `init()` 的 catch 路径、`fetchByPath` 的 catch 路径均已设置 `loading: false`，覆盖完整 ✅。

---

### P2-03: 编码规范 — 递归 Promise 链缺少深度限制

- **文件**: `pages/process/index/index.js:244-261`
- **说明**: `processStep` 递归调用本身无深度限制。若 `pendingSteps` 因异常包含大量步骤（如数百个），递归可能触及调用栈限制。实际 `pendingSteps` 来自 stage.steps 过滤，规模通常 <20，风险极低。
- **建议**: 添加防御性上限：`if (si >= pendingSteps.length || si > 50) return Promise.resolve(lastResult);`

---

### P2-04: currentStepIdx 未检查阶段6(永居)边界

- **文件**: `pages/process/index/index.js:423`
- **代码**: `currentStepIdx = Math.min(lastCompletedIdx + 1, 6);` — 正确限制了最大值为 6（步骤索引范围 1-7，7 是「全部完成」状态）。
- **说明**: 边界处理正确 ✅。但 `_toStepIdx` 中 phase4→6 的硬编码返回 6 意味着永居阶段永远映射到步骤 6，即使 phase4 有多个子阶段。确认这是预期行为。
- **状态**: 与 PRD 7步框架一致（永居是最后一步），无需修改。

---

## 📊 汇总

| 级别 | 数量 | 关键项                                       |
| :--: | :--: | -------------------------------------------- |
|  P0  |  3   | 防重入死锁 / 无超时保护 / catch静默吞错      |
|  P1  |  3   | 兜底映射偏差 / isMember遗漏 / 设计复审       |
|  P2  |  4   | 联动刷新 / loading兜底 / 递归深度 / 边界确认 |

---

## ✅ 已验证修复 (本次commit正确交付的项)

| #     | 修复项                                          | 文件                   |     状态      |
| ----- | ----------------------------------------------- | ---------------------- | :-----------: |
| P0-F1 | \_toStepIdx phase2 order归一化 (localOrder计算) | process/index/index.js |      ✅       |
| P0-F2 | currentStepIdx多重兜底 (全完成→7, 推算, ratio)  | process/index/index.js |      ✅       |
| P0-F3 | unlockAllPhasesPay 无 async (前序已修)          | —                      |      ✅       |
| P1-F1 | button→view 消除事件穿透                        | guidebooks/index.wxml  |      ✅       |
| P1-F3 | phases完成材料检测 (doneCount===materialCount)  | process/index/index.js |      ✅       |
| P2-F1 | assessmentDone 注释解耦说明                     | process/index/index.js |      ✅       |
| P2-F2 | 解锁横幅 !loading 防初次闪烁                    | guidebooks/index.wxml  |      ✅       |
| P2-F3 | confirmPayment catch 添加 console.error         | guidebooks/index.js    |      ✅       |
| P2-F4 | async/await→Promise 递归链 (低版本微信兼容)     | process/index/index.js | ✅ (结构正确) |

---

## 🔍 数据流闭合检查

```
流程控「完成当前阶段」流 (通道A):
  tap按钮 → completeAllSteps → process-manager(completeStep)×N → loadActiveProcess → setData
  ❌ 早期返回路径未清理防重入标记 (P0-01)
  ❌ 云函数调用无超时保护 (P0-02)
  ❌ catch 无错误日志 (P0-03)
  ✅ Promise 链结构正确 (P2-F4)

攻略书「付费解锁」流:
  tap → confirmPayment → 支付回调 → init → mergeProgress
  ✅ catch 已有 console.error (P2-F3)
  ✅ 横幅 !loading 防闪烁 (P2-F2)
  ✅ isMember 参数传递 (P0-F1 主路径)
  ⚠️ _loadBrowseLocal 遗漏 (P1-02)

流程控「currentStepIdx 映射」流:
  allStages → _toStepIdx (归一化order) → currentStepIdx (3级兜底)
  ✅ phase2 order归一化正确 (P0-F1)
  ✅ 3级兜底逻辑完整 (P0-F2)
  ⚠️ 未知phaseId兜底使用数组索引 (P1-01)
```

---

## 🏁 总体评价

本 commit 在 3 个文件中完成了声称的 10 项修复中的 9 项（P0-03 为前序 commit 验证通过）。**Phase2 order 归一化和 currentStepIdx 多重兜底**这两个核心逻辑修复正确且必要。攻略书的 3 项改进（防闪烁、错误日志、button→view）均为正向增量。

**但 `completeAllSteps` 的重构引入了 3 个 P0 级问题**，其中 P0-01（死锁）是最严重的回归 — 它将旧代码 `try...finally` 的清理保证替换为 Promise `.finally()`，导致 7 条早期返回路径全部泄露防重入标记和 UI 状态。P0-02（无超时保护）违反编码规范第 1 条硬约束。P0-03（静默吞错）违反编码规范第 1/5 条。

**建议**: 修复 3 个 P0 后重新提交。P1-01（数组索引→order 字段）建议一并修复以消除潜在映射偏差。
