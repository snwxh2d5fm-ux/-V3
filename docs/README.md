# 住港伴 V3 — 知识库索引

**维护者**: MT天衣  
**最后更新**: 2026-05-15

## 目录结构

```
docs/
├── README.md          ← 本文件，知识库入口
├── sop/               ← 标准操作流程
│   ├── communication-flow.md   通讯流程/协同机制/审核/交付标准
│   ├── risk-response.md        风险应对预案
│   └── miniprogram-dev-standards.md  小程序开发规范
├── prd/               ← 产品需求文档（已发布版本）
├── dsg/               ← 设计系统审计
├── adr/               ← 架构决策记录
├── lessons/           ← 经验教训（实战沉淀）
└── templates/         ← 文档模板库
```

## 快速导航

| 场景 | 文档 |
|------|------|
| Hermes→Claude 通知怎么发 | sop/communication-flow.md §ACL通知协议 |
| Claude交付后怎么验收 | sop/communication-flow.md §交付标准 |
| 麒麟/玄武双审怎么走 | sop/communication-flow.md §双审机制 |
| DevTools编译失败 | sop/risk-response.md §R1 |
| automator WebSocket断连 | sop/risk-response.md §R3 |
| verify.sh假阳性 | sop/risk-response.md §R4 |
| ES5编码规范 | sop/miniprogram-dev-standards.md §ES5 |
| WXSS令牌规范 | sop/miniprogram-dev-standards.md §WXSS |
| 云函数规范 | sop/miniprogram-dev-standards.md §云函数 |

## 单源真相

**PROGRESS.md** 是项目进度的唯一真相源，不在本知识库中。
