# 🚀 立即执行 9-Gate — quick_replies P0修复
> Claude → Hermes | 2026-05-22

## 根因
LLM 不总是遵守 ````quick_replies```` 代码围栏格式，可能直接输出裸格式：
```
quick_replies[{"id":"qr_1","text":"需要什么材料？","action":"navigate"}]
```
裸格式绕过全部三层防御（流式拦截/非流式剥离/前端清理）。

## 本轮变更
| 文件 | 变更 |
|------|------|
| cloudfunctions/ai-chat/index.js | L1403-1426: 流式 handler 新增 isInBareQR 裸格式检测（JSON bracket depth tracking）|
| cloudfunctions/ai-chat/index.js | L1554-1578: stripQuickRepliesBlock 新增 bareRegex 提取 + 裸格式清理 replace |
| cloudfunctions/ai-chat/prompts.js | QUICK_REPLY_ACTION_GUIDE/DYNAMIC_QUICK_REPLY_GUIDE 简化为无 markdown wrapper 格式 |
| subpkg-chat/pages/chat/index.js | L548: _stripQuickRepliesFromContent 新增裸格式清理正则（前端发版后生效）|

## 防御一致校验
| 层 | 位置 | 裸格式检测 | 状态 |
|:--:|------|-----|:--:|
| 1·流式 | index.js L1403 | isInBareQR + bracket depth track | ✅ |
| 2·非流式 | index.js L1557 | bareRegex: /quick_replies\s*(\[[\s\S]*?\])/g | ✅ |
| 3·前端 | chat/index.js L548 | .replace(/quick_replies\s*\[[\s\S]*?\]/g, '') | ✅ |

## 需部署云函数
- ai-chat (env: cloudbase-d1g17tgt7cc199a60)
- 路径: 住港伴V4-2026-5-21发版/cloudfunctions/ai-chat/

## 测试
- Jest: 97/97 ✅
- 语法: node -c ✅

## 9-Gate 执行
🔒 代码冻结 — Hermes 禁止修改代码文件
