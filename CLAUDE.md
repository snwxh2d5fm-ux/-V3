# 住港伴 V3

微信小程序项目。Taro 3.6.31 脚手架编译为原生 `.wxml/.wxss/.js` CommonJS，后端 CloudBase（腾讯云开发）。

## 技术栈
- 前端: 微信原生小程序（.wxml/.wxss/.js CommonJS）
- 后端: CloudBase 云函数（Node.js 18）
- 数据库: CloudBase NoSQL（life_guide_tasks 等集合）
- 测试: Jest + E2E（Playwright）

## 目录
- `pages/` — 页面
- `data/` — 数据模块（onboarding-tasks.js 等）
- `utils/` — 工具函数
- `cloudfunctions/` — 云函数
- `tests/` — 测试
