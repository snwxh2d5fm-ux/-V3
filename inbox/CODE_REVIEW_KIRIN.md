# 麒麟代码审查报告

**审查日期:** 2026-05-18 21:20 HKT
**审查范围:** commit 4cfd6b8 — 12文件安全修复 (P0安全6+P1安全5+虚壳3+假数据2+架构4)
**验证状态:** Hermes独立验证全部P0项

---

## P0 — 阻断级

### P0-1: Token降级生成全零令牌 ✅已确认
- **文件:** pages/login/login.js L158-161
- **描述:** `cloudLogin()`降级token逻辑: `Array.from(new Uint8Array(16)).map(...)` — 检查了`wx.getRandomValues`存在但从未调用。`Uint8Array(16)`创建全零数组，所有用户降级token相同 `"0000000000000000"`
- **影响:** 会话可被任意劫持
- **验证:** 代码确认 `wx.getRandomValues(arr)` 调用不存在

### P0-2: V3支付回调签名条件性跳过 ✅已确认
- **文件:** cloudfunctions/payment/index.js L399-412
- **描述:** `if (v3Key && wechatSig)` — apiV3Key未配置时静默跳过所有签名验证
- **影响:** 伪造POST请求即可激活任意会员
- **验证:** 条件检查结构确认

---

## P1 — 重要

### P1-1: db-admin 空白名单全员管理员
- **文件:** cloudfunctions/db-admin/index.js L11-14
- **描述:** `isAdmin()` 在 `ADMIN_OPENIDS.length===0` 时返回 true
- **影响:** 未配环境变量时任何用户可执行 emergencyCleanK2 等破坏性操作

### P1-2: formatAssessmentResult 缺少HTML转义
- **文件:** subpkg-chat/pages/chat/index.js L283-294
- **描述:** LLM输出的 assessmentResult 字段直接拼接,未经过 _escapeHTML
- **影响:** 通过 rich-text 组件可注入XSS

### P1-3: ai-chat System Prompt 注入风险
- **文件:** cloudfunctions/ai-chat/prompts.js L85-90
- **描述:** 用户消息可注入伪造JSON触发parseAssessmentJSON误解析

### P1-4: document-manager saveDoc _openid验证缺失
- **文件:** cloudfunctions/document-manager/index.js L28-31
- **描述:** 更新文档时直接用 coll.doc(_id).update() 不验证归属

### P1-5: ocr.js identifyDocType reject后调用方未防护
- **文件:** utils/ocr.js L83-85
- **描述:** resolve→reject语义变更,调用方可能未处理rejection

---

## P2 — 建议 (6项)
- P2-1: payment buildAuthorization body签名语义
- P2-2: ai-chat parseAssessmentJSON 空catch块
- P2-3: ai-chat RAG缓存无内存上限
- P2-4: policy-monitor 无SSRF防护
- P2-5: batch-generate rating/helpful归零缺迁移
- P2-6: db-admin emergencyCleanK2缺二次确认

## 正面评价
- _escapeHTML+formatReplyContent 基础XSS防护正确
- user-auth HMAC token显著提升
- ocr.js fail-open→fail-safe原则正确
- db-admin ADMIN_OPENIDS白名单方向正确(需修空列表逻辑)

## 总结
| 级别 | 数量 | 关键风险 |
|:--:|:--:|------|
| P0 | 2 | Token全零(会话劫持) + 支付签名跳过(零成本会员) |
| P1 | 5 | 管理权限暴露 + XSS注入 + prompt注入 + 跨用户覆盖 + reject兼容 |
| P2 | 6 | 签名规范/降级逻辑/SSRF/数据质量/破坏性操作防护 |
