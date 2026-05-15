# NOTIFY: P0 WXSS 行号污染 — 需立即修复

**优先级**: P0 阻断
**详情**: inbox/REVIEW_WXSS_CONTAMINATION_20260515.md

## 行动指令

请修复 6114ca8 引入的 WXSS 文件行号污染问题。

受影响文件（6个）：
- app.wxss
- pages/index/index.wxss
- pages/documents/combine/combine.wxss
- pages/process/index/index.wxss
- pages/reminders/detail/detail.wxss
- pages/reminders/index/index.wxss

修复方式：去除每行开头的 `     N|     N|` 行号前缀，恢复为合法 CSS。
可参考 a723a42 版本的这些文件作为基准，再重新应用 DSG-3 令牌变更。

修复完成后写 outbox/WXSS_FIX_DONE.md 通知 Hermes。
