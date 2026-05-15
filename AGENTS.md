# 住港伴 V3 — 执行模型 v4

## 项目定位

微信小程序原生 AI 香港身份规划伴侣。技术栈：原生小程序 + CloudBase + Jest E2E。

## 启动必读

**第一步必须读 PROGRESS.md** — 单源真相，包含当前阶段/闸门状态/阻塞项。

## 执行模型

```
WXSS/样式修复  → 麒麟玄武直接改（token替换、行号清理、CSS语法）
JS/WXML/云函数 → Claude MCP直连（Claude写 → 调Hermes verify/deploy）
闸门验证      → 麒麟玄武真机跑（verify.sh + Jest + DevTools编译）
进度跟踪      → PROGRESS.md + BI/DASHBOARD.md
天元          → 巡检 + 协调 + 对接琅琊
```

## 角色与权限

| 角色 | 职责 | 代码权限 |
|------|------|:-------:|
| 天元 (Hermes) | 巡检、协调、部署、闸门调度 | ❌ |
| Claude | JS/WXML/云函数/复杂逻辑 | ✅ 全部 |
| 麒麟 | 代码审查 + WXSS修复 + Jest测试 | ✅ WXSS |
| 玄武 | PM审查 + 静态闸门 + WXSS修复 | ✅ WXSS |
| 琅琊 | 决策审批 | — |

## 群聊 agent 实验结论 (2026-05-15)

多 agent 群聊模式已验证为不可行：
- agent 不能 @ agent → 无协作链
- 每次对话无记忆 → 信息不对称
- 需人工 @ 触发 → 无人推动

已删除所有 profile agent（PMO/盘古/天枢/马良/包拯/夸父/天衣/姜子牙）。
回归最简模型：Hermes + Claude + 麒麟玄武。

## 目录结构

```
住港伴V3-开发中/
├── AGENTS.md          ← 本文件
├── CLAUDE.md          ← Claude启动配置
├── PROGRESS.md        ← 单源真相
├── BI/DASHBOARD.md    ← BI看板
├── pages/             ← 小程序页面
├── cloudfunctions/    ← 云函数（Nodejs18.15）
├── scripts/           ← verify.sh / workflow-verify.sh
├── inbox/             ← Hermes工作区
├── outbox/            ← Claude交付区
└── docs/              ← 文档库
```
