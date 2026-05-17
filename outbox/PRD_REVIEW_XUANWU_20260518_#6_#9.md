# 玄武PM/PRD合规审查报告 — #6 Canvas图像脱敏 + #9 OCR信息展示

> 审查日期: 2026-05-18
> 审查范围: commit `0052305` — 4文件变更
> 涉及模块: 证件夹 (Documents Tab) — 证件详情页 + 智能材料清单
> 目标: 隐私体验 / UX影响 / 回归风险评估

---

## 一、变更概述

| # | 文件 | 变更 | 行数 |
|:--:|------|------|:--:|
| 1 | `pages/documents/detail/detail.js` | Canvas 2D图像脱敏管线 (renderMaskedImage→_doRenderMask→_drawPIIMasks) | +134/-26 |
| 2 | `pages/documents/detail/detail.wxml` | 脱敏图源切换 + PII浮层标签 + 隐藏Canvas | +16/-3 |
| 3 | `pages/documents/detail/detail.wxss` | `.pii-overlay-tag` 样式 | +15 |
| 4 | `pages/documents/combine/combine.wxss` | `.doc-ocr-info` OCR信息条样式 | +1 |

combine.js OCR逻辑已在上一个提交 (e8da3a9) 中实现，本次仅补CSS。

---

## 二、PRD对齐状态

| 功能点 | PRD/缺口要求 | 代码实现 | 状态 |
|--------|-------------|---------|:--:|
| 图像脱敏 L1 | 绝对脱敏: 马赛克/遮挡照片+PII区 | Canvas不透明黑块+🔒标签 | ✅ |
| 图像脱敏 L2 | 泛化脱敏: 半透明遮罩 | Canvas半透明蓝+竖线条纹+"泛化脱敏"标签 | ✅ |
| 图像脱敏 L3 | 可保留: 原图 | maskedImagePath清空,显示原图 | ✅ |
| 文本脱敏联动 | 切换L1/L2/L3同时刷新图像 | togglePIILevel()→renderMaskedImage() | ✅ |
| OCR信息展示 | 智能材料清单展示OCR姓名+证件号 | 提取name/idNumber,证件号脱敏前2后4 | ✅ |
| 隐私三态可视化 | 绿色卡片+🔒(PD全景评价) | `.pii-overlay-tag`红色标签显示当前态 | ⚠️ |

---

## 三、P0 阻断问题

### P0-01: previewImage() 脱敏逃逸 — 隐私严重泄漏

- **文件**: `pages/documents/detail/detail.js` L314-322
- **问题**: 点击脱敏图片后 `previewImage()` 展示的是 `doc.filePath`（原图），而非 `maskedImagePath`（脱敏图）。用户在 L1/L2 模式下点击「查看大图」会看到完全未脱敏的原图。
- **影响**: 隐私三态体系被绕过。任何人拿到手机、在L1脱敏界面点一下大图即可看到完整证件照片+所有文字信息。**使整个脱敏功能形同虚设。**
- **修复**: 
  ```
  previewImage() {
    var src = this.data.maskedImagePath || (this.data.doc && this.data.doc.filePath);
    if (src) wx.previewImage({ urls: [src], current: src });
  }
  ```
  注意: `maskedImagePath` 是 tempFilePath，`previewImage` 支持本地路径。

### P0-02: combine.js OCR脱敏不受全局PII等级控制

- **文件**: `pages/documents/combine/combine.js` L337-351
- **问题**: 智能材料清单中的OCR证件号脱敏是**硬编码**的前2后4 (`idStr.slice(0, 2) + '****' + idStr.slice(-4)`)，不读取 `PRIVACY_MODE` 存储。用户即使设为L3「可保留」模式，清单中仍显示脱敏证件号。与详情页的三态脱敏不一致。
- **影响**: 隐私控制体验割裂 — 同一证件在详情页看全、在清单中却脱敏。用户困惑。
- **修复**: `matchChecklist()` 中读取 `wx.getStorageSync('privacy_mode') || 'L1'`，L3时展示完整OCR数据。

### P0-03: 脱敏区域硬编码 — 仅适配中国身份证布局

- **文件**: `pages/documents/detail/detail.js` L181-187 `_drawPIIMasks()`
- **问题**: 4个脱敏区域 (照片/个人信息/住址/证件号) 使用固定百分比坐标，仅匹配中国第二代身份证布局。对于港澳通行证、护照、学位证书、银行流水等其他20+种证件类型，遮罩会覆盖完全错误的区域（例如在成绩单上遮住成绩数据而非个人信息）。
- **影响**: 非身份证类证件脱敏无意义或误导。证件夹支持8大分类20+种证件类型，但脱敏只适配1种。
- **修复方向**: 
  1. 短期: 根据 `doc.docType` 加载不同区域配置映射表
  2. 中期: 对接OCR返回的文字坐标 (`ocrData.textRegions`) 做语义级定位
  3. 兜底: 非身份证类型显示全图半透明遮罩+文字提示「非标准证件，建议手动检查」

---

## 四、P1 重要问题

### P1-01: Canvas临时文件无清理 — 存储泄漏

- **文件**: `pages/documents/detail/detail.js` L128-178
- **问题**: `wx.canvasToTempFilePath` 每次调用生成临时文件。切换脱敏级别(L1↔L2↔L3)、切换证件、反复进入详情页都会创建新文件。`onUnload` 无清理逻辑，临时文件持续累积。
- **影响**: 微信小程序本地存储上限200MB。重度使用者可能因临时文件耗尽存储。每个temp文件约100KB-2MB（取决于原图分辨率）。
- **修复**: 
  ```
  onUnload() {
    if (this.data._maskTimer) clearTimeout(this.data._maskTimer);
    // 清理上次的temp文件
    var prev = this.data.maskedImagePath;
    if (prev) {
      var fs = wx.getFileSystemManager();
      try { fs.unlinkSync(prev); } catch(e) {}
    }
  }
  ```

### P1-02: 300ms防抖导致原图闪烁

- **文件**: `pages/documents/detail/detail.js` L139-142
- **问题**: 页面初始加载时，WXML先渲染 `doc.filePath` 原图，300ms后才替换为 `maskedImagePath` 脱敏图。用户会看到原图短暂闪现。
- **影响**: 隐私保护存在300ms窗口期。截屏/快速浏览可能捕获原图。信任感削弱。
- **修复**: WXML初始显示加载占位符或纯色块，等 `maskedImagePath` 就绪后再显示。或者先在JS中置 `filePath: ''` → Canvas渲染完成 → 再显示。

### P1-03: `_maskTimer` 存储在 data 中导致无效 setData

- **文件**: `pages/documents/detail/detail.js` L15, L139
- **问题**: `_maskTimer` 定义为 data 属性，调用 `clearTimeout(this.data._maskTimer)` 会触发 setData 脏检查（虽然值为timer ID不会实际渲染）。应存储为 `this._maskTimer`（Page实例属性，非data）。
- **影响**: 微小性能开销，每次防抖触发一次无效的setData。
- **修复**: 将 `_maskTimer: null` 从 data 移到 Page() 实例属性。`clearTimeout(this._maskTimer)` 而非 `this.data._maskTimer`。

### P1-04: combine.js OCR姓名未脱敏

- **文件**: `pages/documents/combine/combine.js` L340
- **问题**: OCR姓名 (`found.ocrData.name`) 在清单中完整显示，不经过任何脱敏处理。详情页在L1下姓名显示为 `***`，但清单中显示全名。
- **影响**: 隐私不一致。用户离开详情页后，在清单中仍可看到完整姓名。
- **修复**: 同P0-02，读取全局 `PRIVACY_MODE`，L1时姓名显示为 `***`。

---

## 五、P2 建议

### P2-01: WXSS令牌违规

| 文件 | 行 | 硬编码 | 应替换 |
|------|:--:|------|------|
| `detail.wxss` | L226 | `rgba(239, 68, 68, 0.88)` | `var(--color-error)` + opacity |
| `detail.wxss` | L227 | `#FFFFFF` | `var(--color-text-on-primary)` |
| `detail.wxss` | L231 | `20rpx` (border-radius) | `var(--radius-md)` |
| `detail.wxss` | L230 | `6rpx` (padding) | `var(--spacing-xs)` 或 8rpx |
| `detail.wxss` | L229 | `22rpx` (font-size) | `var(--font-size-caption)` 或 20/24rpx |
| `combine.wxss` | L170 | `#EFF6FF` | `var(--color-primary-bg)` 或令牌 |
| `combine.wxss` | L170 | `22rpx` | `var(--font-size-sm)` 或 20/24rpx |

按SOP第二节要求，颜色/字号/间距应使用设计令牌变量。

### P2-02: Canvas 2D兼容性边界

- Canvas 2D (`type="2d"`) 需要基础库 ≥ 2.9.0 (2019年7月)。当前主流基础库已远超此版本，风险极低但仍建议在 `app.json` 中设置 `"miniprogramRequired": "2.9.0"`。
- `canvas.createImage()` 在 iOS 上部分版本可能有跨域限制。`wx.getImageInfo` 返回本地路径通常无问题。

### P2-03: L2泛化脱敏的竖线密集渲染

- `_drawPIIMasks()` L209-213: L2模式下循环绘制竖线 (`for (var i = 0; i < rw; i += 10)`)。对2000px宽图片，绘制200条竖线。若图片过大（如高分辨率扫描件6000px）可能造成短暂卡顿。
- 建议: 先缩放Canvas到合理尺寸（如max 1920px宽），减少绘制量。

### P2-04: accessibility 缺失

- Canvas内容无替代文本。视障用户无法感知脱敏状态。
- `.pii-overlay-tag` 使用 `pointer-events: none` 正确（不阻挡点击），但无 `aria-label`。
- 建议: 在 `.image-area` 上添加 `aria-label="{{currentPIILevel === 'L1' ? '证件图片已脱敏' : currentPIILevel === 'L2' ? '证件图片泛化脱敏' : '证件图片'}}"`

### P2-05: OCR信息展示无空状态处理

- `combine.wxss` 新增 `.doc-ocr-info`，但 combine.js L337-351 中当 `ocrInfo` 为空时仍会渲染空的 `<view class="doc-ocr-info">`（如果WXML渲染该字段）。需确认空字符串时不渲染该节点。

---

## 六、综合评分

| 维度 | 得分 | 说明 |
|------|:--:|------|
| **隐私安全性** | 45/100 🔴 | P0-01预览逃逸致命, P0-03仅适配身份证 |
| **PRD对齐度** | 70/100 🟡 | 三态模型正确但实现不完整 |
| **UX一致性** | 50/100 🔴 | 详情页vs清单OCR脱敏不一致, 名单脱敏规则分裂 |
| **代码健壮性** | 55/100 🟡 | 无清理逻辑, _maskTimer在data中, 区域硬编码 |
| **DSG令牌合规** | 0/100 🔴 | 新增WXSS全部硬编码, 零令牌变量 |
| **ES5合规** | 70/100 🟡 | 新增代码合规, 但预存const未清理 |
| **综合** | **48/100 D+** | 3个P0必须修复合入前 |

---

## 七、行动项

### 🔴 P0 — 立即修复（合入前阻塞）

| # | 问题 | 文件 | 预估 |
|:--:|------|------|:--:|
| 1 | previewImage()展示原图→展示脱敏图 | detail.js L314 | 5min |
| 2 | combine.js OCR脱敏读取全局PII等级 | combine.js L337 | 10min |
| 3 | 脱敏区域从docType读取映射表 | detail.js L181 | 30min |

### 🟡 P1 — 本迭代修复

| # | 问题 | 文件 | 预估 |
|:--:|------|------|:--:|
| 4 | onUnload清理Canvas临时文件 | detail.js | 10min |
| 5 | 原图闪烁→占位符预加载 | detail.js + wxml | 15min |
| 6 | _maskTimer移出data | detail.js L15 | 2min |
| 7 | combine.js OCR姓名也按PII等级脱敏 | combine.js | 5min |

### ⚪ P2 — 排期

| # | 问题 | 文件 | 预估 |
|:--:|------|------|:--:|
| 8 | 新增WXSS全部替换为令牌变量 | detail.wxss + combine.wxss | 15min |
| 9 | 大图Canvas绘制性能优化 | detail.js | 10min |
| 10 | 无障碍aria-label补全 | detail.wxml | 5min |
| 11 | 空OCR信息不渲染空节点 | combine.wxml | 2min |

---

## 八、结论

本次变更的产品方向正确——图像脱敏是证件夹隐私三态体系的关键缺失环节。代码架构合理（Canvas 2D离屏渲染 + 防抖 + 分级遮罩）。

但存在**3个P0阻断问题**必须在合入前修复：
1. **previewImage脱敏逃逸** — 一点大图即见原图，整个脱敏功能失效
2. **OCR脱敏不一致** — 清单与详情页使用不同脱敏规则
3. **区域仅适配身份证** — 20+种证件类型覆盖不足

修复上述3项P0后，变更可通过PRD合规审查。P1/P2问题建议在本迭代内跟进。

---

> 玄武PM审查 · 完成 · 2026-05-18
