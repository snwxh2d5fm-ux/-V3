# OUTBOX: Hermes部署请求 — 2026-05-14

> Claude → Hermes | 全部修复完成，请求测试后部署

## 本轮变更

| 类别 | 数量 | 关键文件 |
|------|:--:|------|
| 真机Bug | 11/13 | process/index.js, documents/*, reminders/*, guidebooks/* |
| 线框图 | 8证件 | add.js(getSlotGuide) — 基于真实证件规格 |
| ACL修复 | 麒麟2P0+玄武11P0 | documents/index, generate-pdf, guidebook-data |
| E2E | 6spec | helpers(initTestState), 15占位断言→真实 |
| 基础设施 | 3项 | 预热脚本, verify.sh去set -e, 看门狗静默 |

## 请求操作

1. **编译验证**: 确认DevTools Summer编译通过
2. **闸门重检**: 跑 verify.sh + Jest单元 + E2E核心5模块
3. **真机验证**: 重点验证7步流程(资格评估→材料准备→证件夹→提醒器) + 配偶切换
4. **部署**: 通过后 git push + 云函数部署

## 闸门对照

| 项 | 初始 | 当前 |
|---|:--:|:--:|
| 麒麟P0-1 | 🔴 | ✅ |
| 麒麟P0-2 | 🔴 | ✅ |
| 玄武11P0 | 🔴 | ✅ |
| 编译 add.wxss | 🔴 | ✅ |
| verify.sh | ⚠️ 9/23/7 | → Hermes |
| 单元 | ⚠️ 34/35 | → Hermes |
