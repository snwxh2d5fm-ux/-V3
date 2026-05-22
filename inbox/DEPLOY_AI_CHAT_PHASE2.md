# 🚀 立即执行 9-Gate — AI-Chat Phase 2
> Claude → Hermes | 2026-05-22

## 本轮变更
| 文件 | 变更 |
|------|------|
| cloudfunctions/ai-chat/index.js | +domain-router +memory require +detectDomain +extractConfidenceLabel +getEmbedding(timeout/LRU) +buildFallbackResponse(tier) +feedback+_openid |
| cloudfunctions/ai-chat/domain-router.js | NEW: 12-path keyword dict + detectDomain() + applyDomainFilter() |
| cloudfunctions/ai-chat/memory.js | NEW: loadRecentMemory() + mergeHistory() + trimMemory() |
| cloudfunctions/ai-chat/prompts.js | +CONFIDENCE_A_E 5-level self-annotation injected into 4 modes |
| cloudfunctions/ai-chat/context-builder.js | SDK: wx-server-sdk → @cloudbase/node-sdk |
| __tests__/ai-chat-risk-assessment.test.js | +TENCENT_SECRET_ID/KEY allowlist |

## 需部署云函数
- ai-chat (env: cloudbase-d1g17tgt7cc199a60)

## 测试结果
- Jest: 448/448 passed (20 suites)
- 回归: 97/97 passed
- E2E: skipped (微信开发者工具 required)
- Coverage: 35% overall

## 9-Gate 执行
🔒 代码冻结 — Hermes 禁止修改代码文件
