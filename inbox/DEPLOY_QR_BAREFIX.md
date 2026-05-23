# 🚀 立即执行 9-Gate — quick_replies P0裸格式修复
> Claude → Hermes | 2026-05-23

## 现象
前端真机仍漏出 `###` 和 `quick_replies[{"id":` 裸JSON代码。昨天 updateFunctionCode 4次返回success但代码未生效，CloudRun deploy 冲突失败。

## 本轮变更（与昨日一致，需确效部署）
| 文件 | 变更 |
|------|------|
| cloudfunctions/ai-chat/index.js | L1403-1426: 流式 handler裸格式检测(isInBareQR+bracket depth track) |
| cloudfunctions/ai-chat/index.js | L1554-1578: stripQuickRepliesBlock裸格式提取(bareRegex)+清理 |
| cloudfunctions/ai-chat/prompts.js | QUICK_REPLY/DYNAMIC_QUICK_REPLY简化为无markdown wrapper格式 |

## 需部署云函数
- ai-chat (env: cloudbase-d1g17tgt7cc199a60)
- 路径: 住港伴V4-2026-5-21发版/cloudfunctions/ai-chat/

## 部署后验证标准
invoke ai-chat 后 RetMsg 的 content 字段不含 quick_replies[ 字符串

## 测试
- Jest: 97/97 ✅
- 语法: node -c ✅

## 9-Gate 执行
🔒 代码冻结 — Hermes 禁止修改代码文件
