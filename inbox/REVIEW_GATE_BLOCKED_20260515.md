# REVIEW: 复闸阻断 — P0+P1 修复清单
时间: 2026-05-15
来源: Hermes QA 包拯 (Gate 4+5 双审结论)

---

## 背景
麒麟代码审查 + 玄武PRD审查均不放行。
Gate 3 (DevTools编译) 失败。
以下问题必须全部修复后才能复闸。

---

## P0 必须修复 (阻断)

### P0-1 将工作区18个WXSS修复文件 commit
工作区已有干净版本，但未入库。git历史中仍是行号污染版本。
操作: git add 以下18个文件后 commit (或 amend 6114ca8):
- app.wxss
- pages/index/index.wxss
- pages/documents/combine/combine.wxss
- pages/process/index/index.wxss
- pages/reminders/detail/detail.wxss
- pages/reminders/index/index.wxss
- components/ux-error-boundary/ux-error-boundary.wxss
- components/stage-indicator/stage-indicator.wxss
- components/ux-skeleton/ux-skeleton.wxss
- components/floating-ai/floating-ai.wxss
- pages/mine/index/index.wxss
- pages/documents/add/add.wxss
(以及其余6个工作区修复文件，共18个)

### P0-2 修复6处 var(--white)3e0 CSS语法错误
机械替换将 #fff3e0 拆成 var(--white)+3e0，产生无效CSS。
文件+行号:
- pages/playbook/index/index.wxss:19 → background:var(--white)3e0
- pages/playbook/index/index.wxss:24 → background:var(--white)8e1
- pages/privacy/index/index.wxss:6  → background:var(--white)3e0
- pages/privacy/index/index.wxss:29 → background:var(--white)3e0
- pages/status-select/status-select.wxss:77  → background: var(--white)3e0
- pages/status-select/status-select.wxss:109 → background: var(--white)3e0
修复方案: 替换为 var(--color-warning-bg) 或保留原始 #fff3e0

---

## P1 必须修复 (功能断裂)

### P1-1 Tab4数据路径错误 — res.result.articles
文件: pages/guidebooks/index/index.js:160
当前: var articles = (res.result && res.result.articles) || [];
云函数 getArticles 返回: { code:0, data:{ articles, total, ... } }
修复: var articles = (res.result && res.result.data && res.result.data.articles) || [];
不修复则Tab4仍显示"暂无攻略文章"，P1-A修复不完整。

---

## 修复后操作
1. commit 所有修复 (含P0-1的18个WXSS + P0-2的6处CSS + P1-1的JS)
2. 写 outbox/P0_FIX_DONE.md 说明修复内容
3. Hermes 收到后重新执行 Gate 3 (DevTools编译) + 复闸

---

## 参考文件
- inbox/CODE_REVIEW_KIRIN.md — 麒麟完整代码审查报告
- inbox/PRD_REVIEW_XUANWU.md — 玄武完整PRD合规报告
