# 麒麟代码审查报告

**审查日期:** 2026-05-18 20:40 HKT
**审查范围:** AI-Chat Phase1: cloudfunctions/ai-chat重写 + Chat页面重写 + 子包拆分 + desensitization-preview删除
**审查模型:** DeepSeek V4 Pro (麒麟 subagent)
**验证状态:** Hermes独立验证P0项

---

## P0 — 阻断级（上线前必须修复）

### P0-1: `pages/reminders/detail/detail` 未在 app.json 注册 ✅已独立确认
- **文件:** app.json
- **描述:** reminders/detail/detail 页面在12处被引用，但既不在主包 pages 数组(9项)也不在5个 subPackages 中
- **影响:** 提醒详情页完全不可用，所有导航报错 "page not found"
- **验证:** `python3 -c` 确认：主包9页、5子包均无此路径

### P0-2: ai-chat cloud 变量可能为 null 时调用 queryKnowledgeBase ✅已独立确认
- **文件:** cloudfunctions/ai-chat/index.js L27-35, L119
- **描述:** wx-server-sdk 初始化失败时 cloud=null，queryKnowledgeBase 直接调用 cloud.callFunction
- **影响:** 三级降级链路第二级从不执行，直接跳 fallback；错误日志误导

### P0-3: content-moderation 云函数目录不存在 ❌误报
- **验证:** cloudfunctions/content-moderation/ 目录存在

### P0-4: pages/index/index onShow 无条件 switchTab ⚠️设计模式
- **文件:** pages/index/index.js L16-19
- **描述:** 每次 onShow 都 switchTab 到 process/index，无 _routed 守卫
- **备注:** 页面定义为 v5 纯路由页，风险可控但建议加守卫

---

## P1 — 重要（尽快修复）

### P1-1: 对话历史明文存储
- **文件:** components/floating-ai/floating-ai.js L245, subpkg-chat/pages/chat/index.js L293
- **描述:** wx.setStorageSync 明文存储完整对话历史(50条),含用户敏感信息

### P1-2: K2 安全护栏客户端正则匹配缺陷
- **文件:** subpkg-chat/pages/chat/index.js L17-21
- **描述:** 正则无 /i 标志，客户端K2仅UI提示不拦截请求；与 prompts.js 服务端K2不同步

### P1-3: ai-chat 云函数未写入对话日志 ✅已独立确认
- **文件:** cloudfunctions/ai-chat/index.js
- **描述:** 全483行无 conversation_logs 写入代码。对话追踪链路断裂

### P1-4: context-builder.js 独立初始化 wx-server-sdk
- **文件:** cloudfunctions/ai-chat/context-builder.js L16-18
- **描述:** 独立 cloud.init() 可能与主云函数冲突

### P1-5: 子包迁移后部分导航路径需验证
- **文件:** subpkg-chat/pages/membership/index.js L227,231
- **描述:** orders/index 和 invoice-list/index 路径正确(已验证)，但 floating-ai 中 selectPathFromChat 仍有主包路径引用

---

## P2 — 建议

- P2-1: floating-ai 组件硬编码存储键名 vs chat 页面使用 constants
- P2-2: callCloudBaseAI 降级时 hardcode 'hy3-preview' 模型名
- P2-3: V5/V6 修正内容硬编码而非从 prompts.js 读取
- P2-4: autoDetectMode 意图识别词表不完整(CIES/TechTAS等)
- P2-5: desensitization-preview 删除确认干净 ✅
- P2-6: pages/home/home.js 模拟登录 session 可预测
- P2-7: AI 返回结构解析链式回退可能静默返回空字符串
- P2-8: quick_replies JSON.parse 无 schema 校验，无路径合法性检查

---

## 总结

| 级别 | 数量 | 关键项 |
|------|------|--------|
| P0 | 3 (1误报) | reminders/detail未注册、cloud null、index路由循环 |
| P1 | 5 | 历史明文、K2不同步、对话日志缺失、双重init、导航残留 |
| P2 | 8 | 键名不一致、降级硬编码、意图不全等 |
