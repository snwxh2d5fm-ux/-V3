# UI Token 迁移质量审计报告

**审计人**: UI马良
**日期**: 2026-05-15
**范围**: 49 个 WXSS 文件（1 tokens.wxss + 1 app.wxss + 36 页面 + 11 组件）

---

## 1. 执行摘要

| 指标 | 数值 |
|------|------|
| Tokens 定义数量 | **65** (11 类别) |
| 兼容别名 (app.wxss) | **17** |
| var() 引用总数 | **1601** |
| hex 硬编码残留 | **317** (29 文件) |
| **Token 迁移率** | **83.5%** |
| 语法 Bug | **1** (阻断级) |
| 真未定义 Token | **1** |

**结论: 不可 commit。** 存在 1 个 CSS 语法错误和 317 处 hex 硬编码，需修复后再提交。

---

## 2. tokens.wxss v2.0 完整性评估

### ✅ 通过

| 类别 | Token 数 | 示例 |
|------|----------|------|
| 主色系统 | 3 | `--color-primary`, `--color-primary-dark`, `--color-primary-light` |
| 中性色 | 6 | `--color-text-primary`, `--color-bg-page`, `--color-border` |
| 语义色 | 8 | `--color-success`, `--color-warning`, `--color-error` + bg 变体 |
| 品牌渐变 | 6 | `--gradient-header`, `--gradient-hero`, `--gradient-vault` |
| 灰阶 | 10 | `--gray-50` → `--gray-900` |
| 间距 | 6 | `--space-xs` → `--space-2xl` (4rpx 栅格) |
| 圆角 | 6 | `--radius-xs` → `--radius-pill` |
| 字号 | 6 | `--font-xs` → `--font-xxl` |
| 阴影 | 4 | `--shadow-sm` → `--shadow-lg` |
| 动效 | 4 | `--duration-fast/slow`, `--easing` |
| Z-Index | 6 | `--z-base` → `--z-toast` |

### ⚠️ 建议补充

- 缺少 `--green-dark` token（app.wxss 中硬编码 `#047857`）
- 缺少品牌色半透明变体（如 `rgba(26,115,232,0.2)` 多处硬编码）

---

## 3. app.wxss 兼容别名层

app.wxss 在 `page {}` 中定义 17 个别名，形成双层架构：

```
app.wxss (别名层)
  ├── --blue        → var(--color-primary)
  ├── --blue-dark   → var(--color-primary-dark)
  ├── --blue-light  → var(--color-primary-light)
  ├── --green       → var(--color-success)
  ├── --green-light → var(--color-success-bg)
  ├── --green-dark  → #047857          ← ⚠️ 唯一硬编码别名
  ├── --orange      → var(--color-warning)
  ├── --orange-light→ var(--color-warning-bg)
  ├── --red         → var(--color-error)
  ├── --red-light   → var(--color-error-bg)
  ├── --white       → var(--color-bg-card)
  ├── --color-bg    → var(--color-bg-page)
  └── --color-text  → var(--color-text-primary)
```

**评价**: 设计合理。但 `--green-dark` 应改为 `var(--color-success)` 或新增 `--color-success-dark` token。

---

## 4. 🔴 阻断级问题

### Bug #1 — status-select.wxss:313 CSS 语法错误

```css
/* ❌ 当前 — 渲染失败 */
.local-capture__scan {
  background: var(--color-bg-card)BEB;  /* "BEB" 是拼接垃圾 */
}

/* ✅ 应为 */
.local-capture__scan {
  background: var(--color-bg-card);
}
```

文件: `pages/status-select/status-select.wxss` 第 313 行
影响: 扫描动画区域背景色完全失效
严重度: **P0 — 阻断**

---

## 5. 💀 真未定义 Token

| Token | 使用位置 | 状态 |
|-------|---------|------|
| `--color-danger` | `pages/milestone-verify/milestone-verify.wxss` | ❌ 未定义 — 应为 `var(--color-error)` |

其他脚本报告的"未定义" token（如 `--color-text`、`--blue`、`--white`）实际在 app.wxss 别名层定义，为误报。

---

## 6. hex 硬编码分布

### 6.1 未迁移文件 (hex > 80%)

| 文件 | hex | var | 迁移率 |
|------|-----|-----|--------|
| `pages/mine/settings/settings.wxss` | 9 | 0 | **0%** |
| `pages/privacy/index/index.wxss` | 32 | 2 | **5.9%** |
| `pages/playbook/index/index.wxss` | 30 | 5 | **14.3%** |
| `pages/mine/orders/index.wxss` | 15 | 9 | **37.5%** |
| `pages/mine/invoice/detail.wxss` | 16 | 7 | **30.4%** |
| `pages/mine/invoice/list.wxss` | 13 | 8 | **38.1%** |
| `pages/mine/invoice/apply.wxss` | 18 | 13 | **41.9%** |
| `pages/mine/orders/detail.wxss` | 19 | 17 | **47.2%** |

**特征**: mine 子模块（settings/invoice/orders）几乎全部未迁移。

### 6.2 部分迁移文件 (hex 30-70%)

| 文件 | hex | var |
|------|-----|-----|
| `pages/status-select/status-select.wxss` | 38 | 41 |
| `pages/playbook/detail/detail.wxss` | 8 | 5 |
| `pages/documents/detail/detail.wxss` | 19 | 27 |
| `pages/reminders/detail/detail.wxss` | 11 | 113 |
| `pages/membership/index/index.wxss` | 10 | 45 |

### 6.3 优秀迁移文件 (hex < 5%)

| 文件 | hex | var | 迁移率 |
|------|-----|-----|--------|
| `app.wxss` | 2 | 159 | **98.7%** |
| `pages/guidebooks/index/index.wxss` | 2 | 166 | **98.8%** |
| `pages/documents/add/add.wxss` | 4 | 133 | **97.1%** |
| `pages/reminders/index/index.wxss` | 1 | 56 | **98.2%** |
| `pages/process/index/index.wxss` | 0 | 56 | **100%** |

---

## 7. 常见 hex 模式及映射建议

审计中发现反复出现的硬编码 hex，以下是映射建议：

| 硬编码 hex | 使用次数 | 语义 | 应迁移至 |
|-----------|---------|------|---------|
| `#f5f5f5` | ~25 | 浅灰背景 | `var(--gray-100)` 或 `var(--color-bg-page)` |
| `#fff` / `#ffffff` | ~40 | 白色/卡片 | `var(--color-bg-card)` |
| `#202124` | ~20 | 深色文字 | `var(--color-text-primary)` |
| `#5f6368` | ~18 | 次要文字 | `var(--color-text-secondary)` |
| `#999` | ~15 | 弱化文字 | `var(--color-text-muted)` |
| `#888` | ~12 | 描述文字 | `var(--gray-400)` |
| `#f0f0f0` | ~8 | 分割线 | `var(--color-border)` |
| `#0d904f` | ~10 | 成功绿 | `var(--color-success)` |
| `#e37400` | ~5 | 警告橙 | `var(--color-warning)` |
| `#d93025` | ~5 | 错误红 | `var(--color-error)` |
| `#1565c0` / `#1a73e8` | ~6 | 主色蓝 | `var(--color-primary)` |
| `#e8f5e9` | ~8 | 成功背景 | `var(--color-success-bg)` |
| `#fff3e0` | ~6 | 警告背景 | `var(--color-warning-bg)` |
| `#ffebee` | ~4 | 错误背景 | `var(--color-error-bg)` |

---

## 8. 修复优先级建议

### P0 — 阻断 (1 项)
1. 修复 `pages/status-select/status-select.wxss:313` 的 `var(--color-bg-card)BEB` → `var(--color-bg-card)`

### P1 — 高优 (6 项)
2. `pages/mine/settings/settings.wxss` — 9 hex → 全部迁移
3. `pages/privacy/index/index.wxss` — 32 hex → 全部迁移
4. `pages/playbook/index/index.wxss` — 30 hex → 全部迁移
5. `pages/playbook/detail/detail.wxss` — 8 hex → 全部迁移
6. `pages/status-select/status-select.wxss` — 剩余 37 hex → 全部迁移
7. `--color-danger` → 统一为 `--color-error` 或添加别名

### P2 — 中优 (mine 子模块 5 文件)
8. `pages/mine/invoice/*` (3 文件) + `pages/mine/orders/*` (2 文件) — 共 81 hex

### P3 — 低优
9. `tokens.wxss` — 补充 `--green-dark` token
10. `app.wxss` — 修复 `#FFF` (L80) 和 `--green-dark: #047857` (L11)

---

## 9. 最终判定

| 闸门 | 结果 |
|------|------|
| Token 定义完整性 | ✅ 通过 (65 token, 11 类别) |
| 别名层设计 | ✅ 通过 (17 别名, 双层架构) |
| var() 引用正确性 | ❌ 1 个语法Bug + 1 个真未定义 |
| hex 硬编码清零 | ❌ 317 处残留 (29 文件) |
| **总体** | **❌ 不可 commit** |

**修复量估算**: 约 2-4 小时 Claude 工时（317 hex → var() 替换）。

**建议**: 先修复 P0 Bug → 分派 Claude 批量迁移 hex → 二次审计确认后 commit。
