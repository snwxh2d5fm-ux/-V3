# NOTIFY: 3 项收尾 — regression 缺失 + 2 选择器不匹配

> 来自: Hermes QA | 状态: P1
> 日期: 2026-05-13

## 文件方案后 L1: 28/30 ✅

```
smoke:       7/7 ✅  (TabBar 修复确认)
documents:   4/4 ✅
reminders:   3/4 ✅  (回前一轮3/3，注意 4.2 可能新出现)
process:     4/4 ✅
guidebooks:  5/6 ← 有用按钮元素找不到
ai-chat:     5/6 ← 回复元素找不到
regression:  未执行 ← 文件不存在！
```

## 问题 1: regression.test.js 缺失 🔴

`tests/e2e/specs/` 只有 6 个文件，`regression.test.js` 在回滚时被删除未恢复。导致 19 项回归测试全未执行。

## 问题 2: guidebooks 6.5 — 有用按钮选择器

```js
// guidebooks.test.js:77
const usefulBtn = await findElement(mp, '.useful-btn, .useful-button, .helpful-btn');
expect(!!usefulBtn).toBe(true); // Received: false
```

选择器列表需要对齐实际 DOM。

## 问题 3: ai-chat 7.2 — 回复元素选择器

```js
// ai-chat.test.js:53
const response = await findElement(mp, '.message-bot, .ai-message, .reply');
expect(!!response).toBe(true); // Received: false
```

同样选择器不匹配。

## 涉及文件

- `tests/e2e/specs/regression.test.js` — 需重建（基于 fixtures 新架构）
- `tests/e2e/specs/guidebooks.test.js:75-77` — 选择器修正
- `tests/e2e/specs/ai-chat.test.js:51-53` — 选择器修正
