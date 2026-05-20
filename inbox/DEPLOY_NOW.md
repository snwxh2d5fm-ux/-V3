# 🚀 立即执行 9-Gate
> Claude → Hermes | 2026-05-20

## 本轮变更

| 文件 | 变更 |
|------|------|
| `pages/process/index/index.js` | currentStepIdx 重写：直接查 in_progress stage 映射，根除阶段跳转 |
| `pages/guidebooks/index/index.js` | onPhaseTap 移除 `unlocked !== false` 门控，锁定关卡可展开 |
| `pages/process/index/index.wxml` | 版本标记 v2.1 |
| `cloudfunctions/process-manager/index.js` | 小修复同步 |
| `pages/guidebooks/index/index.wxml` | 关卡锁定提示 + 图标判断修复 (prior) |
| `components/status-badge/status-badge.wxml` | `<button>`→`<view>` + catchtap (prior) |
| `components/status-badge/status-badge.js` | confirmPaywall 普通函数 + Modal 先于 setData (prior) |

## 需部署云函数

无（本轮纯前端修复）

## 9-Gate 执行
🔒 代码冻结 — Hermes 禁止修改代码文件

## 真机待验证
1. 流程控：选路径后显示"材料准备"而非"获批激活"；"完成阶段"按钮可点击
2. 攻略书：关卡1-7可点击展开；锁定关卡显示🔒 + 解锁提示
3. ¥599：点击身份标签 → 弹窗 → "支付¥599"有反应
