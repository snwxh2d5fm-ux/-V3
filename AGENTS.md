# 住港伴 V3 — Hermes Agent 项目配置

## 项目定位

微信小程序原生 AI 香港身份规划伴侣。技术栈：原生小程序 + CloudBase + Jest E2E。

## 启动必读

**第一步必须读 PROGRESS.md** — 单源真相，包含当前阶段/闸门状态/阻塞项。

## 角色体系

| Agent | 职责 | 代码权限 |
|-------|------|:-------:|
| PMO | 项目进度、任务分派、向琅琊汇报 | ❌ |
| PD盘古 | 产品方案、PRD维护、功能验证 | ❌ |
| QA包拯 | 9道闸门、测试执行、双审调度 | ❌ |
| BI天枢 | 数据规范、埋点、看板、报表 | ❌ |
| UI马良 | 页面设计、WXSS令牌落地 | WXSS only |
| ITPM夸父 | CloudBase、Claude通讯、进度跟催 | ❌ |
| MT天衣 | 文档规范、知识库、技能维护 | ❌ |
| 天元 | Agent训练、模型配置、能力升级 | ❌ |
| Claude | 唯一代码来源 | ✅ 全部 |

**铁律：代码只有一个来源 — Claude。其他 Agent 发现 Bug → 写 inbox → ACL 通知 Claude。**

## 目录结构

```
住港伴V3-开发中/
├── AGENTS.md          ← 本文件，Hermes项目感知入口
├── CLAUDE.md          ← Claude启动配置
├── PROGRESS.md        ← 单源真相（进度/闸门/阻塞）
├── pages/             ← 小程序页面
├── cloudfunctions/    ← 云函数（Nodejs18.15）
├── data/              ← 模板数据与常量
├── utils/             ← 工具函数
├── __tests__/         ← 单元测试（Jest）
├── tests/e2e/         ← E2E测试（miniprogram-automator）
├── scripts/           ← verify.sh / workflow-verify.sh
├── inbox/             ← Hermes工作区（任务/通知/报告）
├── outbox/            ← Claude交付区
├── docs/              ← 文档库（见下）
└── DSG-2/ DSG-3/      ← 设计系统审计
```

## 文档库结构（docs/）

```
docs/
├── README.md                          ← 知识库索引（快速导航）
├── sop/
│   ├── communication-flow.md          ← 通讯流程/ACL协议/双审/交付标准
│   ├── risk-response.md               ← 风险应对预案（R1-R10）
│   └── miniprogram-dev-standards.md   ← 小程序开发规范（ES5/WXSS/云函数/K2）
├── lessons/
│   └── lessons-learned.md             ← 经验教训（L001-L007）
├── templates/
│   ├── bug-report-template.md         ← Bug报告模板（四要素）
│   ├── acl-notify-template.md         ← ACL通知文件模板
│   └── gate-report-template.md        ← 闸门报告模板（3份）
├── prd/       ← 产品需求文档（已发布版本）
├── dsg/       ← 设计系统审计
└── adr/       ← 架构决策记录
```
