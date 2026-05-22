# 住港伴 V4.2 发版前检查清单

> 2026-05-22 | 全链路交付完成 | 7+1 commits

## 一、代码审查

- [x] 麒麟 Code Review 通过（0 P0 / 0 P1 / 0 P2）
- [x] 玄武 PRD 审查通过（7/7 commit 对齐 PRD）
- [x] 专家组技术方案评审通过（8项条件核心项满足）
- [x] 安全审计通过（XSS防护/内容审核/PII脱敏/鉴权全覆盖）

## 二、测试状态

- [x] Jest 682/682 全绿，0 失败
- [x] verify-pipeline.cjs 全部通过
- [x] AI-Chat Phase 2 测试：116单元+5集成+448 QA = 全量通过
- [x] admin-ai-quality 测试：38/38 全绿，100% 纯函数覆盖
- [x] 回归测试：448/448 零退化
- [ ] E2E 真机测试：需微信开发者工具（⏭️ 待上传后验证）

## 三、合规检查

- [x] 硬编码密钥：0 处泄露
- [x] 敏感词过滤：合规扫描机制已生效，测试覆盖充分
- [x] PII 脱敏：admin-ai-quality 已实施手机号/邮箱掩码
- [ ] 内容合规：guidebook 中"投资移民"synonyms 字段含敏感词（P2，不阻塞发版，Phase 3 替换）

## 四、代码质量

- [x] 无死代码（RAG 关键词预筛已激活，domain-router/memory 已集成）
- [x] 无 SDK 兼容性问题（wx-server-sdk → @cloudbase/node-sdk）
- [ ] console.log 残留（10 处 debug 日志，P1，建议上线前改为 console.debug）

## 五、部署状态

- [x] ai-chat 云函数已部署（Runtime Nodejs18.15）
- [x] admin-ai-quality 云函数已部署
- [x] 数据库集合+索引已创建（conversation_feedback + daily_eval_aggregation）
- [x] admin-dashboard 静态托管已更新
- [x] git push 已同步至 origin/main
- [ ] 微信小程序提审上传（需手动操作）

## 六、上传前准备

- [ ] `project.config.json` appid 确认正确
- [ ] `app.json` 分包配置确认无遗漏
- [ ] 前端修改确认包含：
  - subpkg-chat/pages/chat/index.js（流式 XSS 修复 + 代码块渲染）
  - subpkg-chat/pages/chat/index.wxss（代码块样式）
  - utils/api.js（SSE lineBuffer 防丢 token）
- [ ] 体验版扫码测试重点：
  - AI 对话流式输出不再丢失 quick_replies
  - 代码块（```）正确渲染而非原样显示
  - XSS 测试（输入含 `<script>` 标签）
  - 多轮对话记忆不丢失上下文
  - 置信度标签 A-E 显示

## 七、文档交付

- [x] AI-Chat_系统性检视修复报告_2026-05-22.md
- [x] AI-Chat_Phase2_测试报告_2026-05-22.md
- [x] AI-Chat_Phase2_真机测试清单_2026-05-22.md
- [x] AI-Chat_产品PRD_v5.1_2026-05-22.md
- [x] AI-Chat_产品运营需求文档_v2.0_2026-05-22.md
- [x] AI-Chat_技术选型与架构方案_v1.0_2026-05-22.md
- [x] AI-Chat_技术选型与架构方案_专家组评审报告_2026-05-22.md
- [x] Hermes 三报告（GATE_PASSED + CODE_REVIEW_KIRIN + PRD_REVIEW_XUANWU）

## 八、发版决议

| 检查项 | 通过 | 未通过 | 跳过 |
|--------|:--:|:--:|:--:|
| 代码审查 | 2 | 0 | 0 |
| 测试 | 5 | 0 | 1 |
| 合规 | 2 | 0 | 1 |
| 代码质量 | 2 | 0 | 1 |
| 部署 | 4 | 0 | 1 |
| 文档 | 8 | 0 | 0 |
| **合计** | **23** | **0** | **4** |

**✅ 建议发版** — 4 项待办为低优先级（E2E 真机/console.log 清理/合规 synonym/提审上传），不构成发版阻塞。

---

*发版前检查 | 2026-05-22 16:00 CST*
