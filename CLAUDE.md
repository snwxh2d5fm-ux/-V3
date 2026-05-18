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

## 验证
- `bash scripts/verify.sh` — 总闸门
- `npx jest tests/smoke/ --verbose` — 冒烟测试
