# 玄武PRD审查报告

**审查日期:** 2026-05-18 20:40 HKT
**审查范围:** AI-Chat Phase1 PRD对齐、功能完整性、UX设计、数据流闭合
**审查模型:** DeepSeek V4 Pro (玄武 subagent)
**验证状态:** Hermes独立验证P0项

---

## P0 — 阻断级（上线前必须修复）

### P0-1: conversation_logs 写入链路完全缺失 ✅已独立确认
- **文件:** cloudfunctions/ai-chat/index.js
- **描述:** 云函数对话完成后直接 return，无任何 `db.collection('conversation_logs').add()` 调用
- **PRD对照:** DEPLOY_NOW.md 声称 conversation_logs 集合+索引已创建，但代码未实现写入
- **影响:** 对话日志收集缺失，T8验证项永远无法通过
- **验证:** grep conversation_logs cloudfunctions/ai-chat/index.js → 0 matches

### P0-2: sources 字段数据流断裂 ✅已独立确认
- **文件:** cloudfunctions/ai-chat/index.js L463-473 vs subpkg-chat/pages/chat/index.js L142
- **描述:** 前端期望 `res.data.sources`（数组），后端只返回 `source`（字符串）
- **影响:** WXML 中 `📎 参考来源` 标注永远不显示，来源透明性形同虚设
- **验证:** return 结构中仅含 source:'rag'/'cloudbase-ai'/'fallback'，无 sources 数组

---

## P1 — 重要（发布前应修复）

### P1-1: 反馈按钮功能链路断裂
- **文件:** subpkg-chat/pages/chat/index.js L336-351 + cloudfunctions/ai-chat/index.js
- **描述:** 前端调用 `wx.cloud.callFunction({ name: 'ai-chat', data: { action: 'feedback' } })`，云函数无 action==='feedback' 处理分支
- **影响:** 用户点击反馈按钮只有 toast，数据丢失

### P1-2: floating-ai 组件功能缺失
- **文件:** components/floating-ai/floating-ai.js + .wxml
- **描述:** 相比 subpkg-chat 页面缺少: K2安全横幅、sources来源标注、反馈按钮
- **影响:** 两个AI入口体验不一致

### P1-3: preloadRule 覆盖不完整
- **文件:** app.json L69-82
- **描述:** 仅配置 guide/docs/process 三个子包预加载，chat(9页)和 low 子包缺失
- **影响:** AI对话首屏加载延迟

### P1-4: RAG 仅作降级方案
- **文件:** cloudfunctions/ai-chat/index.js L413-428
- **描述:** RAG 仅在 CloudBase AI 失败后使用，成功时不注入知识库内容
- **影响:** AI回答缺乏知识库佐证，与"RAG增强+AI双引擎"定位不符

### P1-5: 子包页面导航路径不一致风险
- **文件:** E2E测试 tests/e2e/specs/ai-chat.test.js L24
- **描述:** 仍引用旧路径 `/pages/chat/index/index`，子包迁移后应为 `/subpkg-chat/pages/chat/index`

---

## P2 — 建议（后续迭代优化）

- P2-1: floating-ai 版本标识过时 (v4.1 → 应为 v5.0)
- P2-2: sources 展示条件依赖 index===messages.length-2，渲染期间可能遗漏
- P2-3: K2安全横幅仅前端正则触发，缺少服务端协同
- P2-4: 多轮历史首条 role 无校验(需以 user 开头)
- P2-5: T8验证项 conversation_logs 写入方法不可行(因P0-1)
- P2-6: desensitization-preview 删除后无机能退化 ✅确认

---

## 总结

| 级别 | 数量 | 关键问题 |
|------|------|---------|
| P0 | 2 | conversation_logs写入缺失 + sources数据流断裂 |
| P1 | 5 | 反馈链路断裂、floating-ai功能缺失、preloadRule不完整、RAG降级定位偏差、导航路径风险 |
| P2 | 6 | 版本标识、UI健壮性、安全协同等 |

**核心风险:** 两大Phase1核心功能(对话日志+来源标注)形同虚设。反馈功能完全不可用。
