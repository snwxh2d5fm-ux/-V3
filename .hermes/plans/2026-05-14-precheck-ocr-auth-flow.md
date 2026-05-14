---
date: 2026-05-14
status: dispatched → Claude (outbox/TASK_precheck-ocr-auth-flow.md)
feature: precheck-ocr-auth-flow
---

# 效率宝预审流程优化 — OCR授权+进度条 实现方案

> **For Hermes:** 使用 subagent-driven-development 逐 Task 实现。
> **For Claude:** 这是独立的方案设计文档，不包含代码实现，仅定义流程、组件、数据流和验收标准。

**目标:** 在「开始预审」按钮行为中插入OCR授权确认步骤，将OCR识别作为独立阶段展示进度，完成后再跳转预检详情。

**架构:** 不改动后端云函数，纯前端改造——新增授权弹窗组件 + 改造 index 页 runCheck 流程为三阶段流水线（授权→OCR→预审→跳转）。

**涉及文件:**
- `pages/precheck/index/index.js` — 核心改造
- `pages/precheck/index/index.wxml` — 进度面板增强 + 授权弹窗 wxml
- `pages/precheck/index/index.wxss` — 新增授权弹窗样式
- `utils/preaudit.js` — 新增 `ocrDocuments()` 方法

---

## 1. 当前流程 vs 目标流程

### 当前 (有Bug)
```
点击"开始预审" → 检查材料 → 逐个调ocr-service(传imagePath←bug!)
  → batchCheck → 跳check页
```
问题:
- 没有OCR授权确认，直接就开始读取文件
- 传 `imagePath` 而非 `fileID`，ocr-service 实际收不到文件 (参照 document-ocr-verification skill pitfall)
- OCR和预审混在一个 Promise.all 里，进度百分比计算不准
- "材料仅在本地处理" 文案与实际调云函数矛盾

### 目标
```
点击"开始预审"
  → Step 0: 弹出授权弹窗（说明OCR读取文件、隐私承诺、预估耗时）
  → 用户点"授权并开始"
  → Step 1: OCR预处理阶段（进度条 0-60%）
      逐个文档: uploadFile(_ocr_temp) → ocr-service(action:'ocr') → deleteFile → 缓存ocrData
  → Step 2: 规则预审阶段（进度条 60-100%）
      batchCheck(docs_with_ocr) → preaudit-engine
  → 完成 → 跳转 check 页（带完整ocrData）
```

---

## 2. 三阶段流水线设计

### 阶段 0: OCR授权确认 (新增)

**触发:** 用户点击"开始预审"，且证件夹有材料

**组件:** 内联授权弹窗（不新建component，用 wxml 条件渲染 + wxss 遮罩层）

**弹窗内容:**
```
┌─────────────────────────────┐
│  🔍 预审授权               │
│                             │
│  效率宝需要读取您的证件照片  │
│  以进行OCR文字识别。         │
│                             │
│  • 照片将临时上传至云端处理  │
│  • 识别完成后立即删除       │
│  • 不上传原始材料至任何服务器│
│  • 仅提取文字字段用于规则比对│
│                             │
│  预计耗时: 约 {N} 分钟      │
│  ({M} 份材料)              │
│                             │
│  [取消]  [🔒 授权并开始]    │
└─────────────────────────────┘
```

**关键文案要点 (对应文档OCR验证skill的隐私说明):**
- 必须声明"临时上传—识别完成即刻删除"
- 绿色安全标识 (`linear-gradient green` + 🔒)
- 预估耗时基于文档数: `max(1, ceil(count * 0.3))` 分钟

**状态变量:**
```
showAuthModal: false       // 弹窗显隐
authAccepted: false         // 用户是否已授权
```

### 阶段 1: OCR预处理 (改造)

**进度范围:** 0% → 60%
**预计耗时文案:** "正在识别证件 n/total… 预计还需约N分钟"

**核心逻辑 (替换当前 index.js:73-99):**

新增 `utils/preaudit.js` 方法：

```javascript
async function ocrDocuments(docs, onProgress) {
  // onProgress({ current, total, percent, status })
  var total = docs.length;
  var results = [];

  for (var i = 0; i < docs.length; i++) {
    var d = docs[i];

    // 已有OCR数据 → 跳过
    if (d.ocrData) {
      results.push(d);
      onProgress({ current: i+1, total: total,
                   percent: Math.round(((i+1)/total)*60),
                   status: 'skipped' });
      continue;
    }

    try {
      // 1. 上传临时文件
      var fileID = d.cloudFileID;
      if (!fileID && d.filePath) {
        var uploadRes = await wx.cloud.uploadFile({
          cloudPath: '_ocr_temp/precheck_' + Date.now() + '_' + i + '.jpg',
          filePath: d.filePath
        });
        fileID = uploadRes.fileID;
      }

      if (!fileID) {
        results.push(d);
        onProgress({ current: i+1, total: total,
                     percent: Math.round(((i+1)/total)*60),
                     status: 'no_file' });
        continue;
      }

      // 2. 调 ocr-service (传 fileID，不是 imagePath!)
      var ocrRes = await wx.cloud.callFunction({
        name: 'ocr-service',
        data: { action: 'ocr', fileID: fileID }
      });

      if (ocrRes.result && ocrRes.result.code === 0 && ocrRes.result.data) {
        d.ocrData = ocrRes.result.data.fields || ocrRes.result.data;
      }

      // 3. 删除临时文件
      wx.cloud.deleteFile({ fileList: [fileID] }).catch(function(){});

    } catch(e) {
      console.error('[preaudit] OCR失败:', e);
    }

    results.push(d);
    onProgress({ current: i+1, total: total,
                 percent: Math.round(((i+1)/total)*60),
                 status: 'done' });
  }

  return results;
}
```

**与当前bug的差异:**
| 项目 | 当前 (bug) | 修复后 |
|------|-----------|--------|
| 云函数参数 | `imagePath: d.filePath` | `fileID: uploadRes.fileID` |
| action | `recognize` | `ocr` (与 documents/add 统一) |
| 执行方式 | Promise.all 并发 | 串行 (逐个上传/OCR/删除) |
| 进度更新 | 仅更新百分比 | percent + current/total + status |

### 阶段 2: 规则预审 (保持现有逻辑)

**进度范围:** 60% → 100%

保持现有 batchCheck 调用不变，阶段切换时:
```
progressStep: '规则预审'
progressPercent: 60→65→...→100
progressText: '正在逐项核验材料…'
```

### 阶段 3: 跳转

`wx.navigateTo` 到 check 页，携带完整结果。

---

## 3. 进度面板改造

### wxml 结构 (替换 index.wxml:19-30)

```xml
<view class="progress-overlay" wx:if="{{showProgress}}">
  <view class="progress-card">
    <text class="progress-card__title">{{progressTitle}}</text>
    <text class="progress-card__step">{{progressStep}}</text>

    <!-- 进度条 -->
    <view class="progress-bar">
      <view class="progress-bar__fill" style="width:{{progressPercent}}%"></view>
    </view>

    <!-- 详细进度 -->
    <text class="progress-card__detail">{{progressDetail}}</text>

    <!-- 预估时间 -->
    <text class="progress-card__estimate">{{progressEstimate}}</text>

    <!-- 安全承诺 (仅在OCR阶段显示) -->
    <view class="progress-card__privacy" wx:if="{{progressPhase === 'ocr'}}">
      <text>🔒 识别完成后立即删除临时文件，不留存</text>
    </view>
  </view>
</view>
```

### 新增 data 字段 (index.js)

```javascript
data: {
  // ... 现有字段
  showAuthModal: false,       // 授权弹窗
  authAccepted: false,        // 用户已授权
  progressPhase: '',          // 'ocr' | 'preaudit'
  progressTitle: '',          // 进度标题
  progressDetail: '',         // 详细进度文案
  progressEstimate: '',       // 预计剩余时间
  ocrTotal: 0,               // 待OCR文档总数
  ocrDone: 0                 // 已OCR文档数
}
```

---

## 4. 授权弹窗样式 (index.wxss 新增)

```css
/* 遮罩层 */
.auth-modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5); z-index: 1000;
  display: flex; align-items: center; justify-content: center;
}

/* 弹窗卡片 */
.auth-modal {
  width: 85vw; max-width: 340px;
  background: #fff; border-radius: 16px; padding: 28px 24px 20px;
}

.auth-modal__title {
  font-size: 18px; font-weight: 700; text-align: center;
  margin-bottom: 12px; color: #111827;
}

.auth-modal__desc {
  font-size: 14px; color: #6B7280; text-align: center;
  margin-bottom: 16px; line-height: 1.6;
}

/* 安全声明 - 绿色渐变背景 */
.auth-modal__privacy {
  background: linear-gradient(135deg, #ECFDF5, #D1FAE5);
  border-radius: 12px; padding: 16px;
  margin: 16px 0;
}

.auth-modal__privacy-icon {
  font-size: 28px; text-align: center; margin-bottom: 8px;
}

.auth-modal__privacy-title {
  font-size: 16px; font-weight: 600; color: #059669; text-align: center;
}

.auth-modal__privacy-list {
  margin-top: 10px; font-size: 13px; color: #065F46; line-height: 1.8;
}

.auth-modal__privacy-item::before {
  content: '• '; color: #10B981;
}

.auth-modal__estimate {
  font-size: 13px; color: #9CA3AF; text-align: center;
  margin-top: 12px;
}

/* 按钮行 */
.auth-modal__actions {
  display: flex; gap: 12px; margin-top: 20px;
}

.auth-modal__btn {
  flex: 1; padding: 12px 0; border-radius: 10px;
  font-size: 15px; font-weight: 600; text-align: center;
}

.auth-modal__btn--cancel {
  background: #F3F4F6; color: #6B7280;
}

.auth-modal__btn--confirm {
  background: linear-gradient(135deg, #059669, #10B981);
  color: #fff;
}
```

---

## 5. 任务拆解 (实现顺序)

### Task 0: ocrDocuments 工具方法
- **文件:** `utils/preaudit.js`
- **内容:** 新增 `ocrDocuments(docs, onProgress)` 导出方法
- **要点:** 串行处理、fileID 非 imagePath、零留存、onProgress 回调
- **验证:** module.exports 新增该函数，import 后可调用

### Task 1: 授权弹窗 — wxml
- **文件:** `pages/precheck/index/index.wxml`
- **内容:** 在按钮上方添加授权弹窗的 wxml 条件块 (wx:if="{{showAuthModal}}")
- **要点:** 遮罩层 + 卡片 + 隐私声明(绿色渐变) + 双按钮

### Task 2: 授权弹窗 — wxss
- **文件:** `pages/precheck/index/index.wxss`
- **内容:** 添加弹窗全部样式（上述第4节）

### Task 3: 授权弹窗 — js 交互
- **文件:** `pages/precheck/index/index.js`
- **内容:** showAuth/hideAuth/onAuthConfirm/onAuthCancel 方法 + data 字段
- **要点:** 点击"开始预审"→setData({showAuthModal:true})，确认→hideModal+进runCheckPipeline

### Task 4: runCheck 改造为 runCheckPipeline
- **文件:** `pages/precheck/index/index.js`
- **内容:** 
  - 原有 runCheck() 前半段（检查材料）保留
  - 检查通过后 → showAuthModal 而非直接跑OCR
  - 新增 runCheckPipeline() 方法:
    - 阶段1: preaudit.ocrDocuments() 进度 0-60%
    - 阶段2: preaudit.batchCheck() 进度 60-100%
    - 阶段3: navigateTo check 页
- **要点:** 阶段切换时更新 progressPhase/progressTitle/progressDetail

### Task 5: 进度面板文案增强
- **文件:** `pages/precheck/index/index.wxml` + `index.js`
- **内容:** 进度面板增加 progressPhase 相关的条件渲染
- **要点:** OCR阶段显示"🔒 识别完成后立即删除临时文件"，预审阶段不显示

### Task 6: 错误处理 + 边界情况
- 无网络 → 阶段1 catch 后标记 `ocrFailed`，跳 check 页带空 ocrData（规则引擎输出"识别库未命中"）
- ocr-service 返回空 → 不阻断，继续规则预审
- 用户取消授权 → 只关弹窗，不做任何操作
- 证件夹为空 → 提示先添加材料（保持现有逻辑）
- 全部文档已有 ocrData → 跳过OCR，直接进阶段2

### Task 7: 端到端验证
- 模拟有 ocrData 的文档 → 跳过OCR直接预审
- 模拟无 ocrData 的文档 → 经过完整OCR→预审流程
- 授权弹窗取消 → 不触发任何操作
- 检查 check 页接收到的数据是否携带完整 ocrData
- WeChat DevTools 编译无 error

---

## 6. 验收标准

| # | 标准 | 验证方式 |
|---|------|---------|
| 1 | 点击"开始预审" → 弹出授权弹窗（非直接开始） | DevTools 点击验证 |
| 2 | 授权弹窗包含: 🔒图标 + 绿色安全说明 + 预估耗时 + 双按钮 | 视觉检查 |
| 3 | 点击"取消" → 弹窗关闭，不执行任何操作 | 行为验证 |
| 4 | 点击"授权并开始" → 弹窗关闭 → 进入进度面板 | 行为验证 |
| 5 | OCR阶段显示"正在识别证件 n/N" + 预计剩余时间 | 进度文案验证 |
| 6 | OCR阶段底部显示"🔒 识别完成后立即删除临时文件" | 隐私文案验证 |
| 7 | 预审阶段显示"正在逐项核验材料…" | 文案验证 |
| 8 | 进度条百分比连续增长（0→60→100） | 进度动画验证 |
| 9 | 完成后自动跳转 check 页 | 导航验证 |
| 10 | check 页能获取到 OCR 后的 extracted_fields 数据 | 数据链路验证 |
| 11 | 云端 _ocr_temp 目录无残留文件 | CloudBase 控制台验证 |
| 12 | check 页不再出现"识别库未命中"（OCR已在前置阶段完成） | 回归验证 |

---

## 7. 不做什么

- 不新建独立组件文件 — 内联在 index 页即可，保持简单
- 不改动 ocr-service 云函数 — 复用现有 action:'ocr'
- 不改动 preaudit-engine — 复用现有 batchCheck
- 不改动 check 页和 report 页 — 它们只接收数据展示
- 不做并发OCR — 串行更稳定，进度条更准确
