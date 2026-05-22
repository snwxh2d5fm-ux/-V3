# 住港伴 V4 — 运营后台与BI看板版本

V3代码基线（已发正式版，代码冻结），V4基于V3副本扩展运营后台和数据监控BI看板。

## 技术栈

- 微信小程序 (原生) — V3基线，不新增页面
- React 18 + TypeScript + Vite + shadcn/ui — **运营后台Web App（新增）**
- CloudBase (云函数/数据库/存储) — 复用V3基础设施
- DeepSeek AI (对话/评估) — 不变
- Recharts — BI图表
- Jest 测试

## 目录结构（V4新增/变更）

- `pages/`, `subpkg-*/` — V3基线，代码冻结，V4不再修改
- `cloudfunctions/` — V3云函数保留，新增 `admin-stats/admin-users/admin-revenue/admin-ai-quality/admin-content/admin-compliance`
- `admin-dashboard/` — **运营后台Web App（新增）**，React前端项目
- `data/` — 数据文件 (常量、攻略卡片、方案库)
- `utils/` — 工具函数
- `components/` — 组件
- `scripts/verify.sh` — 总验证脚本
- `tests/` — 测试
- `10_工程文档/` — 方案设计文档

## V4核心目标

1. 建立住港伴专属运营后台（Web独立应用，不放入小程序代码包）
2. 建立数据监控BI看板（按身份路径维度分析，不做通用DAU/PV）
3. 增强数据采集埋点（住港伴生命周期事件体系）
4. 复用V3 CloudBase基础设施，新增聚合统计云函数

## 设计文件（必读）

开发前必须按以下顺序阅读 4 份文档：

1. `10_工程文档/住港伴V4_运营后台与BI看板_方案设计_v1.0.md` — **产品方案**：八大模块+BI指标体系+29种事件埋点+三阶段路线图
2. `10_工程文档/住港伴V4_运营后台与BI看板_需求评审报告_v1.0.md` — **需求评审**：四角色评审结论、8项P0修复清单、修正路线图(Phase1 8天)
3. `10_工程文档/住港伴V4_运营后台与BI看板_TDD_v1.0.md` — **技术设计文档**：技术栈+系统架构+数据库模型+API接口+任务拆解(78SP)+测试方案
4. `10_工程文档/住港伴V4_运营后台与BI看板_DevPM评审报告_v1.0.md` — **DevPM评审**：5项DPM修正、SP重新估算(22→31SP)、Phase1修正为10天2人并行

## 关键设计原则

- **以身份路径为第一分析维度**：所有数据按签证类型分层（优才/高才/专才/IANG/受养人/续签/永居）
- **生命周期漏斗替代通用漏斗**：评估→选路径→开流程→加证件→设提醒→续签准备→永居冲刺
- **合规红线内置到看板**：敏感词检测/K2泄露/内容审核必须在首页
- **运营后台与小程序解耦**：独立Web应用通过CloudBase SDK读写同一数据库
- **不照搬祖脉通用逻辑**：住港伴是身份规划工具，不是通用App
- **运营后台鉴权**：HTTP云函数 + API Key + bcrypt hash + IP白名单，不可用环境变量明文token (P0-02)
- **AI对话数据**：response_preview 绝对禁止出现在运营后台任何页面 (P0-05)
- **用户反馈**：feedback.content 入库前必须 PII 自动脱敏 (P0-04)
- **审计日志**：admin_audit_trail 强制 append-only，禁止 update/delete (P0-08)
- **页面埋点**：采样率 10%，批量上传 10条/批，不阻塞主流程 (P0-03)

## 编码规范（必读）

编码前必须阅读项目根目录的 `住港伴_编码规范_v1.0.md`，该文档基于全部 session、37 项 Bug 修复、130 文件代码审查归纳而成。核心约束速查：

- 异步调用必须有超时保护，禁止空 catch 块
- 状态变更必须双写 globalData + Storage
- 禁止硬编码 openid/envId/token，禁止 Math.random() 用于安全逻辑
- 禁止源代码含"投资移民""移民顾问"等敏感词（术语映射表见规范 §5.1）
- AI 生成内容必须经过 \_escapeHTML() 转义
- WXML 标签严格配对，setData 大对象用 setTimeout 包裹防框架错误
- wx.cloud.init() 必须在 app.js onLaunch 第一行调用
- **session** 必须用对象格式 { token, profile }，所有登录入口统一用 app.saveSession()
- 禁止永真断言（>=0 类），测试断言必须有具体期望值
- 数据模板必须覆盖全部 13 条路径

## 验证

- `bash scripts/verify.sh` — 总闸门（A类静态检查 + B类交付门槛 + C类工程一致性）
- `npx jest tests/smoke/ --verbose` — 冒烟测试
- `npx jest --forceExit` — 全量 Jest 测试
- `cd admin-dashboard && npm run dev` — 运营后台本地开发服务器
