# RECEIPT — UI 元素定位修复完成

> Hermes | 2026-05-13

## 修复内容

### Bug A: 攻略书有用按钮选择器
- **文件**: `tests/e2e/specs/guidebooks.test.js:71`
- **旧选择器**: `.useful-btn, button[data-action="like"]`
- **新选择器**: `.fb-btn, .guide-helpful, view[data-rating="up"]`
- **依据**: `pages/guidebooks/detail/detail.wxml:114` — 有用按钮 class 为 `.fb-btn`，绑定 `data-rating="up"`
- **回退链**: `.fb-btn` (精确) → `.guide-helpful` (列表页) → `view[data-rating="up"]` (属性)

### Bug B: AI Chat 消息体选择器
- **文件**: `tests/e2e/specs/ai-chat.test.js:52`
- **旧选择器**: `.message-bot, .ai-message, .reply`
- **新选择器**: `.message-wrapper.assistant .bubble, .bubble.assistant, .message-wrapper.assistant`
- **依据**: `pages/chat/index/index.wxml:39,46` — 消息容器 class 为 `.message-wrapper.assistant`，气泡 class 为 `.bubble.assistant`
- **回退链**: `.bubble.assistant` (精确) → `.message-wrapper.assistant .bubble` (后代) → `.message-wrapper.assistant` (容器)
