# P1A 修复完成

时间: 2026-05-15
任务: NOTIFY_P1A_listArticles_20260515

## 变更

pages/guidebooks/index/index.js:158
  action: 'listArticles' → action: 'getArticles'

## 根因

云函数 guidebook 的 switch-case 没有 `listArticles` 分支，
导致命中 default 返回 { code: 400 }，articles 为 undefined，Tab4 显示"暂无攻略文章"。

## 状态

已修复，一行变更，无其他影响。
