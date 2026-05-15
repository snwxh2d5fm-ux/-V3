# PD盘点 — 双中枢方案敲定 + DSG合规审核

> 日期: 2026-05-15
> 作者: PD (Hermes)
> 任务: t_20195a9c
> 范围: Tab4流程控唯一中枢方案确认 + WXML/WXSS改动DSG合规审核

---

## 一、双中枢方案：已解决，需收尾

### 1.1 现状

| 中枢 | 页面 | 当前状态 |
|------|------|:--:|
| 旧中枢 | `pages/index/index` | ✅ 已降级为纯路由 (JS第17行 `switchTab→process/index`) |
| 新中枢 | `pages/process/index/index` (Tab4) | ✅ TabBar唯一流程控入口 |
| 指引牌 | `pages/guide/index/index` | ✅ 仅从Tab4工具栏可达 |
| 效率宝 | `pages/precheck/index/index` | ✅ 仅从Tab4工具栏可达 |
| 信息栏 | `pages/info/index/index` | ✅ 仅从Tab4工具栏可达 |

**结论**: DSG-1 P0-01 (双中枢冗余) 已在代码层面解决。旧中枢不再渲染内容，直接跳转至Tab4。

### 1.2 入口可达性验证

通过全项目 `navigateTo.*guide|precheck|info` 搜索：

| 入口来源 | 目标 | 状态 |
|----------|------|:--:|
| Tab4 process/index.js L88 | guide/index | ✅ 唯一入口 |
| Tab4 process/index.js L93 | precheck/index | ✅ 唯一入口 |
| Tab4 process/index.js L99 | info/index | ✅ 唯一入口 |
| playbook/index.js L124 | guide/detail | ⚪ 合法(子详情) |
| guide/index.js L175 | guide/detail | ⚪ 合法(自导航) |

**无旧中枢或其他页面导航到这些模块。** 单入口控制已验证。

### 1.3 工具栏交互模式确认

Tab4使用 **toolbar按钮 → navigateTo独立子页面** 模式（非内嵌inline tab）。此方案：

- ✅ 优点: 子页面保持独立代码维护性，导航栈清晰可返回
- ✅ 符合PRD v5 "流程控内嵌"语义（入口嵌入流程控，内容独立展示）
- ⚠️ 与旧 pages/index/index 的 inline tab 方案不同，但更优（避免Tab4页面过于庞大）

**PD确认**: 当前 toolbar→navigateTo 模式为最终方案。不需要将子模块内容inline到Tab4。

---

## 二、旧入口Deprecation方案

### 2.1 旧中枢 pages/index/index — 清理建议

| 项目 | 当前 | 建议 | 优先级 |
|------|------|------|:--:|
| JS | 18行 switchTab 纯路由 | ✅ 保留（作为登录后路由分发入口） | — |
| WXML | 298行 僵尸代码（永不渲染） | 清空为占位 `<view/>` 或删除注册 | P2 |
| app.json注册 | L5 首页注册 | 保留（需作为首个页面） | — |

**决策**: pages/index/index 保留作为路由分发页（app.json首页），但WXML僵尸代码清空为极简占位。这不影响功能——JS的 `onShow→switchTab` 在WXML渲染前即执行。

### 2.2 独立子页面 — 保持现状

guide/index, precheck/index, info/index 不需要标记 `@deprecated`。它们是合法子页面，入口唯一可控。

---

## 三、WXML/WXSS DSG合规审核

### 3.1 审核文件清单（本次盘点范围）

| # | 文件 | 类型 | DSG-3令牌得分 |
|:--:|------|------|:--:|
| 1 | `pages/process/index/index.wxml` | WXML | ⭐⭐ |
| 2 | `pages/process/index/index.wxss` | WXSS | ⭐⭐⭐ |
| 3 | `pages/guide/index/index.wxml` | WXML | ⭐⭐⭐⭐ |
| 4 | `pages/guide/index/index.wxss` | WXSS | ⭐⭐⭐⭐ |
| 5 | `pages/precheck/index/index.wxml` | WXML | ⭐⭐⭐⭐ |
| 6 | `pages/precheck/index/index.wxss` | WXSS | ⭐⭐ |
| 7 | `pages/info/index/index.wxml` | WXML | ⭐⭐⭐⭐ |
| 8 | `pages/info/index/index.wxss` | WXSS | ⭐⭐⭐⭐ |

### 3.2 P0 违规 — 阻塞项

#### P0-01: 流程控环形进度内联硬编码 (process/index/index.wxml L53)

```html
<!-- 当前 -->
style="background: conic-gradient({{progress >= 80 ? '#059669' : progress >= 50 ? '#2563EB' : '#EA580C'}} {{progress * 3.6}}deg, #F3F4F6 0deg)"
```

**问题**: 4个硬编码颜色在inline style中：
- `#059669` → 应为 `var(--color-success)` 
- `#2563EB` → 应为 `var(--color-primary)`（注意不是 #1a73e8）
- `#EA580C` → 应为 `var(--color-warning)`
- `#F3F4F6` → 应为 `var(--color-bg)`

**影响**: 如果全局令牌变更，此处不会同步；无法支持暗色模式。

**修复方向**: 将颜色判断移到JS `data` 中计算为CSS变量引用，WXML中使用 `style="background: conic-gradient({{ringColor}} {{progress * 3.6}}deg, var(--color-bg) 0deg)"`

#### P0-02: 效率宝进度面板8处硬编码 (precheck/index/index.wxss L12-19)

| 行 | 硬编码 | 应替换为 |
|:--:|------|------|
| L2 | `#F0FAF4` | `var(--color-success-bg)` 或新增令牌 |
| L12 | `#FFF` | `var(--color-bg-card)` |
| L13 | `#1F2937` | `var(--color-text-primary)` 或 `var(--gray-800)` |
| L15 | `#6B7280` | 陈旧V4值 → `var(--gray-500)` (#5E6773) |
| L16 | `#F3F4F6` | `var(--color-bg)` 或 `var(--gray-100)` |
| L17 | `#3B82F6` | `var(--color-primary)` (#1a73e8) |
| L18 | `#9CA3AF` | 陈旧V4值 → `var(--gray-400)` (#757F8C) |
| L19 | `#D1D5DB` | `var(--gray-300)` |

**影响**: 效率宝进度面板视觉与全局令牌脱节，WCAG AA对比度不达标。

### 3.3 P1 违规 — 重要

#### P1-01: process/index/index.wxss 非4rpx栅格值

| 值 | 出现 | 建议修正 |
|:--:|:--:|------|
| 14rpx | 多次 | → 12rpx 或 16rpx |
| 22rpx | ~5次 | → 20rpx 或 24rpx |
| 26rpx | ~3次 | → 24rpx 或 28rpx |
| 34rpx | 1次 | → 32rpx 或 36rpx |
| 10rpx | 2次 | → 8rpx 或 12rpx |

#### P1-02: process/index/index.wxml 内联样式中的圆角

L53: `border-radius: 20rpx` 硬编码在 WXML inline style 中。应通过 CSS class 控制。

#### P1-03: 无障碍缺失

本次审核的4个页面 WXML 中：
- `aria-label`: 仅 process/index 的 template-panel 有（L175），其余0处
- `aria-modal`: 仅 1处
- `role`: 仅 1处
- 图片 alt: 无需图片标签（使用emoji），不适用

### 3.4 P2 违规 — 改善

#### P2-01: guide/index/index.wxss 间距不统一

```css
.filter-cats { padding: 12rpx 32rpx; }  /* 32rpx 非标准卡片外边距 */
.guide-list { padding: 8rpx 32rpx; }    /* 同上 */
```
标准外边距应为 24rpx（app.wxss .card 定义）。

#### P2-02: 安全区缺失

审核的 4 个页面中：
- process/index/index.wxml: ✅ 有 `<view class="safe-area-bottom"></view>` (L186)
- guide/index/index.wxml: ❌ 无 safe-area
- precheck/index/index.wxml: ❌ 无 safe-area
- info/index/index.wxml: ❌ 无 safe-area

#### P2-03: BEM命名不一致

| 页面 | BEM使用 |
|------|:--:|
| process/index | ✅ 优秀 (phase-card__header, tool-btn__icon) |
| guide/index | ⚠️ 平面命名 (guide-icon, guide-title 而非 guide__icon) |
| precheck/index | ⚠️ 混合 (progress-card__title 正确, progress-bar__fill 正确) |
| info/index | ⚠️ 平面命名 (update-title, interp-text) |

---

## 四、综合评分

### 双中枢方案: ✅ 已解决 (1项收尾)

| 项 | 状态 |
|----|:--:|
| Tab4为唯一中枢 | ✅ |
| 旧中枢降级为路由 | ✅ |
| 模块入口唯一性 | ✅ |
| 僵尸WXML清理 | ⏳ P2待办 |

### DSG合规: 52/100 (D+)

| 维度 | 得分 | 说明 |
|------|:--:|------|
| 令牌使用率(WXSS) | 60/100 | guide/info优秀，precheck拖后腿 |
| 令牌使用率(WXML inline) | 30/100 | process/index环形进度硬编码 |
| 4rpx栅格对齐 | 65/100 | process/index.wxss有大量非对齐值 |
| 无障碍 | 15/100 | 仅1处aria-label |
| BEM规范 | 55/100 | process优秀，其余平面命名 |
| 安全区 | 25/100 | 仅process有safe-area |

---

## 五、行动项

### 🔴 P0 — 需 Claude 立即修复

| # | 问题 | 文件 | 预估 |
|:--:|------|------|:--:|
| 1 | 环形进度内联颜色→CSS变量 | process/index/index.wxml L53 | 20min |
| 2 | 效率宝进度面板8处硬编码→令牌 | precheck/index/index.wxss L2-L19 | 20min |

### 🟡 P1 — 排入下迭代

| # | 问题 | 文件 | 预估 |
|:--:|------|------|:--:|
| 3 | 非4rpx栅格值修正 | process/index/index.wxss | 30min |
| 4 | 无障碍标注(aria-label) | 4个WXML文件 | 15min |

### ⚪ P2 — 排期

| # | 问题 | 文件 | 预估 |
|:--:|------|------|:--:|
| 5 | 旧中枢WXML僵尸代码清空 | pages/index/index.wxml | 5min |
| 6 | 安全区补充 | guide/precheck/info WXML | 5min |
| 7 | guide/index间距统一24rpx | guide/index/index.wxss | 5min |

---

## 六、与UI马良的协作接口

UI马良负责WXSS视觉落地。本报告P0-01/P0-02两项硬编码问题，应由Claude修复代码，UI马良负责审核修复后的视觉效果是否符合DSG-3规范。

**UI马良待审核项**:
1. 环形进度颜色切换到CSS变量后，渐变视觉效果是否保持
2. 效率宝进度面板令牌替换后，WCAG AA对比度需重新验证
3. guide/index 外边距从32→24rpx后的视觉密度

---

*报告完毕。下一步: Claude修复P0 → Hermes复闸验证。*
