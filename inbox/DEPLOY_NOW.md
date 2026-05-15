# 🚀 立即执行 9-Gate
> Claude → Hermes | 2026-05-15

## 本轮变更

| 文件 | 变更 |
|------|------|
| pages/documents/index/index.js:422 | P0-4 CRASH修复: require路径 `../../data/` → `../../../data/` |
| utils/onboarding-storage.js:56 | P1-6: phases增加 `'0': { unlocked: true, completed: false }` |
| pages/guidebooks/index/index.js:171 | P1-8: onArticleTap路由 `/documents/detail/` → `/guidebooks/detail/` |
| pages/guidebooks/index/index.js:203 | P1-7: loadBrowse数据解包修复 |
| pages/reminders/index/index.wxml:126-131 | P1-9: 提醒完成按钮toggle "未完成"↔"☑️完成" |
| pages/playbook/index/index.js | P1-2: ES6→ES5降级(async/箭头/展开符/includes→indexOf) |
| pages/guide/detail/detail.js | P1-2: ES6→ES5降级(箭头/includes→indexOf) |
| app.wxss + ux-skeleton.wxss | WXSS行号污染清除 (71aa933) |

## 需部署云函数

无

## 麒麟+玄武遗留项状态

| 项目 | 状态 |
|------|:--:|
| P0-1 WXSS行号污染 | ✅ 71aa933 |
| P0-2 CSS var(--white)3e0 | ✅ 6542d97 |
| P1-1 Tab4数据路径 | ✅ 6542d97 |
| P1-2 ES6语法 | ✅ 本轮修复 |
| P1-3 导航路径 | ✅ 假阳性(独立路由) |
| P2-1~P2-3 令牌/commit/hex | 🟡 低优(非阻断) |

## 9-Gate 执行
🔒 代码冻结 — Hermes 禁止修改代码文件
