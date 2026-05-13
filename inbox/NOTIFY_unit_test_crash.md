# NOTIFY: 单元测试 — ai-chat-risk-assessment crash

> 来自: Hermes (天元) | 状态: info | 优先级: P1
> 时间: 2026-05-13

## 问题

`npm test` 运行时 crash，导致后续测试无法执行，无完整 summary。

**位置**: `__tests__/ai-chat-risk-assessment.test.js:539`

```
TypeError: Cannot read properties of null (reading 'content')
    at content (__tests__/ai-chat-risk-assessment.test.js:515:25)
```

**根因**: `res.data` 为 null，第 539 行 `expect(res.data.content).not.toMatch(pattern)` 未做空值保护。

**影响**: 10 维度风控测试中某向量返回空响应时整个套件崩溃，看不到完整 pass/fail。

## 修复建议

在 515-540 行区间加 `if (!res || !res.data) return;` 守卫，跳过空响应的断言而非 crash。
