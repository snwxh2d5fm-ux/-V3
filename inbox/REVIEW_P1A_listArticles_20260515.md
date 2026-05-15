# REVIEW: Tab4攻略精选 action名不匹配 [P1-A]
时间: 2026-05-15
发现: 玄武+麒麟双审

## 现状
pages/guidebooks/index/index.js:158 调用:
  wx.cloud.callFunction({ name: 'guidebook', data: { action: 'listArticles', limit: 50 } })

cloudfunctions/guidebook/index.js switch-case 只有:
  getArticles / getArticleDetail / rateArticle / getRecommended / search / getHotTags

'listArticles' 命中 default 分支返回 { code: 400, msg: '无效操作...' }
→ res.result.articles 为 undefined → articles 数组为空 → 用户只看到"暂无攻略文章"

## 期望
Tab4切换后能正确加载并展示攻略文章列表

## 涉及文件
- pages/guidebooks/index/index.js 第158行

## 修复方案
将 action: 'listArticles' 改为 action: 'getArticles'
一行修改，无其他影响。

## 优先级
P1 — Tab4功能实质不可用，需本迭代修复
