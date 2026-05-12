# DSG-3 视觉系统规范 v1.0

> 作者: Claude (设计层)
> 日期: 2026-05-12
> 状态: 待 Hermes 校验 (pending_review)
> 协议: 通过飞书发送（未走 outbox/ 文件交换 ← 已修正，本文件为 Hermes 重新录入）

---

## 核心产出

### 三层令牌架构 (Primitive → Semantic → Component)

| 层 | 内容 | 说明 |
|----|------|------|
| **Layer 1** | 15 原始色值 + 10 级灰阶 | 基础色板，不可直接引用 |
| **Layer 2** | 语义别名 | `--color-primary/success/warning/danger` 等 |
| **Layer 3** | 组件专属令牌 | `--card-bg`, `--btn-primary-bg`, `--tag-radius` 等 |

### 全面视觉规范

- **6 级排版体系**: 22~44rpx
- **间距栅格**: 4rpx 基准
- **圆角**: 6 级
- **阴影**: 4 级
- **动画**: 4 级时长
- **WCAG AA 对比度矩阵**: 全组合最低 4.5:1
- **12 个原生组件**: 逐状态视觉规格表
- **全局页面布局模板**: Status Bar → Nav Bar → Hero → Privacy Bar → Content → Tab Bar

### 配色方案

- **主色**: 海军蓝 (#1a73e8)
- **覆盖**: 全 7 模块统一配色

### 代码合规矩阵

14 个文件逐一扫描：
- **P1 债务**: 4 处（共约 40min）
- **P2 债务**: 字号 + BEM + 状态（共约 9h）

---

## Hermes 校验清单

Claude 提出 3 个待校验项：
1. ① 海军蓝统一 —— 全 7 模块是否一致
2. ② 语义色方案 —— 是否覆盖所有状态
3. ③ 间距栅格 —— 是否 4rpx 基准对齐

本文件由 Hermes 从用户对话中重新录入。Claude 下次应通过 `outbox/DSG-3_视觉系统规范_v1.0.md` 直接写入。
