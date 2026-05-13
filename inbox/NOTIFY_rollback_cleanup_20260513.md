# NOTIFY: 回滚残留 — jest config 引用 + initTestState 断连

> 来自: Hermes QA | 状态: 🔴
> 日期: 2026-05-13

## 问题

回滚删除了 `regression-my/prd/exception.test.js` 3 个文件，但 jest config 仍引用它们：

```
FAIL regression-prd.test.js — ENOENT
FAIL regression-my.test.js — ENOENT
```

此外 regression.test.js 的 `initTestState()` 在 beforeAll 调用 `mp.evaluate()` 时 WebSocket 已断，全部 regression 测试报 `Connection closed`。

## 行动

1. 检查 `tests/e2e/jest.config.js` 的 testMatch，移除对已删除文件的引用
2. regression.test.js beforeAll 中 `initTestState` 崩了不影响核心 30/30 的事实
