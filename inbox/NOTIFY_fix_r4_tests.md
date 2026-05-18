# NOTIFY: 修复 ai-chat R4.1 + R4.3 测试

**日期**: 2026-05-19
**优先级**: P1 (阻塞 push)

---

pre-push hook 拦截: `__tests__/ai-chat-risk-assessment.test.js` R4.1 (500 vs 200) + R4.3 (res.data null TypeError)。

请读取 `inbox/REVIEW_fix_r4_tests.md`，修复后 commit + push。
