# 🚀 立即执行 9-Gate — 全量安全审查修复
> Claude → Hermes | 2026-05-18

## 本轮变更 (代码审查+安全修复，20个文件)

| 文件 | 变更 |
|------|------|
| cloudfunctions/document-manager/index.js | P0: deleteDoc 加 _openid 归属验证 |
| cloudfunctions/user-auth/index.js | P0: Token 从伪JWT改为HMAC-SHA256签名 |
| cloudfunctions/payment/index.js | P0: 删除查单失败信任前端降级；S-11: V3回调签名强制开启 |
| cloudfunctions/db-admin/index.js | P1: 管理操作加 ADMIN_OPENIDS 白名单 |
| cloudfunctions/reminder-engine/index.js | P1: scanExpiringToday 加 openid 过滤 |
| cloudfunctions/ocr-service/index.js | P1: abuse检查 fail-open → fail-safe |
| cloudfunctions/ai-assess/index.js | 假数据修复: similarCases 改查DB |
| cloudfunctions/batch-generate-guidebooks/index.js | 假数据修复: helpful/rating 清零 |
| cloudfunctions/policy-monitor/index.js | 虚壳修复: runPolicyCheck 接入HTTP抓取+SHA-256 |
| cloudfunctions/ai-chat/index.js | v5同步(RAG+日志+sources→生产) |
| cloudfunctions/ai-chat/prompts.js | V8术语+V6反旧计分+K2规则 |
| subpkg-chat/pages/chat/index.js | P0: formatReplyContent 加 HTML实体编码防XSS |
| subpkg-chat/pages/settings/index.js | P1: deleteAccount 加云函数服务端删除 |
| pages/home/home.js | P0: 删除模拟登录桩代码，接入user-auth |
| pages/login/login.js | P1: fallback token 日期→随机字节 |
| utils/crypto.js | P0: crypto.subtle→wx.getRandomValues+纯JS AES |
| utils/ocr.js | 错误处理: identifyDocType catch从resolve改reject |
| utils/tracker.js | 空catch块→console.warn |
| components/progress-bar/progress-bar.js | computed块→observers(微信不支持computed) |
| components/status-badge/status-badge.js | 身份切换从toast→跳转会员页 |

## 需部署云函数 (12个)
document-manager, user-auth, payment, db-admin, reminder-engine, ocr-service, ai-assess, batch-generate-guidebooks, policy-monitor, ai-chat

## 无需部署云函数 (前端+工具层8个文件)
chat, settings, home, login, crypto, ocr(util), tracker, progress-bar, status-badge

## 9-Gate 执行
🔒 代码冻结 — Hermes 禁止修改代码文件

## 重点检查项
- Gate 4 麒麟: 验证20个文件的P0修复是否完整（S-01~S-12）
- Gate 5 玄武: 验证V8术语合规 + ai-chat K2护栏生效
- Gate 6 CloudBase: 12个云函数逐一部署验证
- Gate 1 verify.sh: 重点扫 crypto.js 和 payment 降级逻辑

{"ts":"2026-05-18T23:00:00+08:00","from":"claude","action":"deploy_request","detail":"全量安全审查修复: 6个P0+5个P1+3个虚壳+2个假数据修复, 20个文件, 12个云函数待部署","state":"pending_hermes_9gate"}
