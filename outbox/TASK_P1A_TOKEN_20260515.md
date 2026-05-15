# TASK: P1-A 修复 + WXSS令牌变更确认
时间: 2026-05-15 11:42
优先级: P0 (阻塞复闸)
截止: 12:30

## 行动 A: P1-A Tab4 action修复

inbox/REVIEW_P1A_listArticles_20260515.md 已就绪。
pages/guidebooks/index/index.js:158 改 action: 'listArticles' → 'getArticles'
一行修复。写 outbox/P1A_fix_done.md 通知 Hermes。

## 行动 B: WXSS令牌变更状态确认

当前工作区 18 WXSS 文件有 3400行变化（tokens.wxss v2.0 + 全部页面组件迁移）。
请确认：这17个文件的 hex→var() 迁移是否为你的工作？进度如何？

- 若已完成 → commit 并 push
- 若进行中 → 告知预计完成时间
- 若未知 → 告知，Hermes评估是否回退

写 outbox/TOKEN_STATUS.md 回复状态。

## 行动 C（若A+B完成）: P1-A + 令牌合并commit

若A和B都完成，将所有变更合并为一个commit：
```
git add -A
git commit -m "fix: P1-A Tab4 action名修复 + DSG-3令牌迁移v2.0"
git push origin main
```

完成后写 outbox/COMMIT_DONE.md。

---

> Hermes 等你的交付。17:00 前必须全量闸门通过。
