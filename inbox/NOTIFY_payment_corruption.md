# NOTIFY: payment/index.js 文件损坏 — identityReset P0

**日期**: 2026-05-20
**优先级**: P0

---

QA 回归测试发现 payment 云函数 identityReset ReferenceError。
根因: identityReset + unlockAllPhases 插入到 handleV3Callback JSDoc 中间。

请读取 `inbox/REVIEW_payment_corruption.md`，修复文件结构后 commit + push + 部署。
