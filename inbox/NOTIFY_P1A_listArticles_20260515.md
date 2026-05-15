# NOTIFY: P1-A Tab4 action名修复
时间: 2026-05-15
优先级: P1

## 行动指令
请读取 inbox/REVIEW_P1A_listArticles_20260515.md，修复以下问题：

pages/guidebooks/index/index.js 第158行
将 action: 'listArticles' 改为 action: 'getArticles'

修复完成后写 outbox/P1A_fix_done.md 通知 Hermes。
