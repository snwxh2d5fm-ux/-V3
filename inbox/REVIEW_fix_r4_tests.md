# REVIEW: ai-chat-risk-assessment.test.js R4.1 + R4.3 修复

**日期**: 2026-05-19
**来源**: pre-push hook 拦截
**优先级**: P1 (阻塞 push)

---

## 问题

commit `829b504` 恢复闸门基础设施后，pre-push hook 拦截了 2 个预存测试失败：

### R4.1 (L289-299): 审核不可用时预期200实际500

```javascript
test('R4.1 审核不可用时放行而非拒绝服务', async () => {
    const savedKey = process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;

    global.cloud.callFunction = () => Promise.reject(new Error('Service unavailable'));
    const res = await aiChat.main({ message: '正常问题', mode: 'qa' }, {});
    expect(res.code).toBe(200);  // ← 失败: 实际返回 500
```

当前 ai-chat 云函数在 `callFunction` reject 时返回 500 而非 200。要么修测试匹配当前行为（500），要么修云函数降级为 200。

### R4.3 (L318-332): res.data 为 null 导致 TypeError

```javascript
test('R4.3 Review 审核时...', async () => {
    global.cloud.callFunction = () => Promise.resolve({
      result: { data: { suggestion: 'Review' } }
    });
    const res = await aiChat.main({ message: '优才', mode: 'qa' }, {});
    expect(res.data.content).toContain('⚠️');  // ← TypeError: res.data is null
```

mock 返回 `{ suggestion: 'Review' }` 但 ai-chat 函数在该路径下 `res.data` 为 null。需检查云函数 Review 分支是否正确设置 data。

## 修复指引

1. R4.1: 两种方向 — 改测试 `expect(res.code).toBe(500)` 或修云函数降级路径
2. R4.3: 需追踪 ai-chat/index.js 中 `suggestion === 'Review'` 的数据流，确保 data.content 有值
3. 修复后本地跑: `npx jest __tests__/ai-chat-risk-assessment.test.js -t "R4.1|R4.3"`

## 铁律

仅修改 `__tests__/ai-chat-risk-assessment.test.js` 或 `cloudfunctions/ai-chat/index.js`，不动其他文件。
