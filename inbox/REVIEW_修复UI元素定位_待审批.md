# 🔒 RESTRICTED — UI 元素定位修复

> P2 | Hermes | 2026-05-13

## 现状

三机 E2E 稳定性已修复（WebSocket/TabBar/initTestState），但 2 个测试因元素选择器不匹配持续失败：

### Bug A: 攻略书有用按钮 [P2]
- 文件: `tests/e2e/specs/guidebooks.test.js:77`
- 现象: `expect(!!usefulBtn).toBe(true)` → false
- 涉及函数: `findElement(mp, 'selector')` 没找到有用按钮
- 可能原因: 按钮用了自定义组件，选择器需加 `>>>` 穿透 shadow DOM，或页面加载异步渲染

### Bug B: AI Chat 消息体 [P2]
- 文件: `tests/e2e/specs/ai-chat.test.js:53`
- 现象: `findElement(mp, '.message-bot, .ai-message, .reply')` 未命中
- 可能原因: 消息组件异步渲染，选择器需更新为当前 WXML 实际 class
