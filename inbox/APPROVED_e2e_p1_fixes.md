# ACL 批准: E2E P1 3 项修复

> 来自: 琅琊 | 状态: 已批准
> 时间: 2026-05-13

## 批准

同意 `REVIEW_e2e_p1_待审批` 中全部 3 项修复：

1. regression `require('../../app.json')` → `'./app.json'`
2. reminders detail 页导航修正
3. process detail 页导航修正

修完后复验 `WECHAT_IDE_PORT=56734 npm run test:e2e:regression`，目标 30/30。
