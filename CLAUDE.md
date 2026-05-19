# 住港伴 V3 — 香港入境计划助手

微信小程序，帮助用户管理香港入境计划全流程：证件、提醒、攻略、AI对话。

## 技术栈
- 微信小程序 (原生)
- CloudBase (云函数/数据库/存储)
- DeepSeek AI (对话/评估)
- Jest 测试

## 目录结构
- `pages/` — 主包页面
- `subpkg-guide/`, `subpkg-docs/`, `subpkg-process/`, `subpkg-chat/`, `subpkg-low/` — 子包
- `cloudfunctions/` — 云函数
- `data/` — 数据文件 (常量、攻略卡片、方案库)
- `utils/` — 工具函数
- `components/` — 组件
- `scripts/verify.sh` — 总验证脚本
- `tests/` — 测试

## 编码规范（必读）

编码前必须阅读项目根目录的 `住港伴_编码规范_v1.0.md`，该文档基于全部 session、37 项 Bug 修复、130 文件代码审查归纳而成。核心约束速查：

- 异步调用必须有超时保护，禁止空 catch 块
- 状态变更必须双写 globalData + Storage
- 禁止硬编码 openid/envId/token，禁止 Math.random() 用于安全逻辑
- 禁止源代码含"投资移民""移民顾问"等敏感词（术语映射表见规范 §5.1）
- AI 生成内容必须经过 _escapeHTML() 转义
- WXML 标签严格配对，setData 大对象用 setTimeout 包裹防框架错误
- wx.cloud.init() 必须在 app.js onLaunch 第一行调用
- __session__ 必须用对象格式 { token, profile }，所有登录入口统一用 app.saveSession()
- 禁止永真断言（>=0 类），测试断言必须有具体期望值
- 数据模板必须覆盖全部 13 条路径

## 验证
- `bash scripts/verify.sh` — 总闸门（A类静态检查 + B类交付门槛 + C类工程一致性）
- `npx jest tests/smoke/ --verbose` — 冒烟测试
- `npx jest --forceExit` — 全量 Jest 测试
