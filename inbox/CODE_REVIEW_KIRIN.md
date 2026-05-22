# 麒麟技术审查报告 — AI对话记录与反馈后台 TDD v1.0

**审查对象**: AI对话记录与反馈后台_技术设计文档_TDD_v1.0
**对照代码**: ai-chat/index.js (1494行) + admin-ai-quality/index.js (67行) + conversation_logs (实际数据132条)
**审查者**: 麒麟 (技术PM审查)
**审查时间**: 2026-05-22
**审查维度**: 架构合理性 / 代码一致性 / 任务拆解准确性 / 工时估算 / 依赖管理 / 缺失项

---

## 审查总览

| 维度 | 结论 | P0 | P1 | P2 |
|:--|:--:|:--:|:--:|:--:|
| 架构合理性 | ✅ 通过 | 0 | 1 | 1 |
| 代码一致性 | ⚠️ 有条件通过 | **2** | 2 | 1 |
| 任务拆解与工时 | ⚠️ 有条件通过 | 0 | 2 | 2 |
| 缺失项 | ⚠️ 有条件通过 | **1** | 2 | 1 |
| 安全与边界 | ✅ 通过 | 0 | 1 | 2 |

> 去重后合计 **P0=3, P1=7, P2=6**

---

## P0 — 阻断 (编码前必须修复)

### 代码一致性维度

#### P0-01: TDD假设user_openid不存在，但conversation_logs已有_openid [字段名不一致]

- **发现**: 逐行审查 ai-chat/index.js 的 `logConversation` 函数(L792-822):
  ```
  _openid: data.openid || null,   // ← 已存在!
  user_id: data.userId || null,   // ← 也已有
  ```
- **TDD假设**: conversation_logs"无 user_openid 字段"(§3.2)
- **实际情况**: `_openid` 字段已在v4.1-phase1写入。测试数据(session_id=verify_*)的_openid为null，但字段本身存在
- **影响**: TDD所有查询代码使用 `l.user_openid` / `doc.user_openid` — 与实际字段名 `_openid` 不一致，上线即报undefined
- **修复**: 全局替换TDD中 `user_openid` → `_openid`；user_profiles关联查询使用 `_openid` 匹配

#### P0-02: source_chunks应写入但TDD未指定ai-chat的具体修改位置 [实现规格不完整]

- **发现**: ai-chat的 `logConversation` 调用处(L1073-1084非流式, L1278-1298流式)。当前传入的 `sources: ragSources.map(s => s.title)` 仅为标题字符串数组
- **TDD遗漏**: 未给出source_chunks的字段提取逻辑和插入行号
- **影响**: 开发时需额外0.5天定位插入点和字段映射
- **修复**: TDD补充具体行号指引 —— 在logConversation调用时增加 `sourceChunks: ragResult.chunks.map(c => ({chunk_id: c._id, title: c.source_title, content_preview: (c.content||'').slice(0,80)}))`

### 缺失项

#### P0-03: conversation_corrections的审批流缺少approve/reject action [功能缺失]

- **发现**: TDD仅定义 `submitCorrection` action，未定义 `approveCorrection` / `rejectCorrection` action
- **PRD要求**: §4.3定义"运营B审核→采纳/驳回"的二次审核流程
- **影响**: 二次审核流程完全不可用——正确答案永远pending
- **修复**:
  1. 新增2个action: `approveCorrection`(params:{correctionId}) + `rejectCorrection`(params:{correctionId,reason})
  2. approveCorrection: status→approved + conversation_logs.has_correction→true
  3. rejectCorrection: status→rejected + 回退review_status
  4. 两个action需权限校验（仅pm/super_admin可审核）
  5. 新增对应任务(T-305:1.5SP, T-306:1.5SP)

---

## P1 — 重要 (开发中修复)

#### P1-01: listConversations的内存筛选有扩展性隐患但无迁移方案 [架构债务]
- 当前132条可接受。建议在TDD备注中标记技术债务及迁移触发条件(~2000条)

#### P1-02: submitCorrection中重复查询conversation_logs [性能问题]
- L633-634两次调用 `db.collection('conversation_logs').doc(conversationId).get()` —— 合并为单次查询

#### P1-03: TDD中validateApiKey与现有admin-ai-quality的内联鉴权两套并存 [重构风险]
- 统一所有action使用validateApiKey，替换现有main中的内联鉴权

#### P1-04: sanitize脱敏函数未覆盖中文姓名 [安全缺口—已知]
- 在对话审核场景中风险可控（审核者为内部人员），Phase 2评估NLP姓名识别

#### P1-05: T-101(ai-chat补偿字段)与当前未部署的ai-chat修复存在合并冲突 [排期冲突]
- 建议T-101与ai-chat-fixes-20260521的5项修复合并为同一个commit

#### P1-06: Sprint 1单日6.5SP偏高 [工时密度]
- 将T-108(部署验证0.5SP)移至D3上午，释放D2缓冲

#### P1-07: conversation_corrections缺少correctionType枚举校验 [参数校验缺口]
- submitCorrection增加白名单校验：`['factual_correction','supplementary','compliance_fix']`

---

## P2 — 建议 (后续迭代)

#### P2-01: 建议conversation_logs冗余存储path_label避免每次关联查询
#### P2-02: 缺少响应体超过6MB限制的处理（当前<5KB安全）
#### P2-03: Sprint 4缺少现有4个action的回归测试
#### P2-04: 缺少网关路由变更后的验证步骤
#### P2-05: 缺少前端网络故障自动重试机制
#### P2-06: "移民"正则排除列表需法务确认完整性
#### P2-07: admin-ai-quality的timeout需显式设置为30秒

---

## 与ai-chat实际代码的对照检查

| TDD声明 | ai-chat实际代码 | 结论 |
|------|------|:--:|
| "conversation_logs无user_openid" | `_openid: data.openid \|\| null` 已存在 | ❌ P0-01 |
| "需新增source_chunks字段" | 仅有 `rag_sources`(标题字符串数组) | ✅ 需新增 |
| "logConversation可扩展" | 函数接受data对象，无破坏性 | ✅ 可行 |
| "存量数据user_openid=null" | 测试数据的_openid为null | ⚠️ 需数据清洗 |

## 任务工时修正

| 任务 | 原SP | 建议SP | 理由 |
|------|:--:|:--:|------|
| T-101 (ai-chat补偿字段) | 3 | 2 | 实为1字段+1入参修改 |
| 新增 T-305 (approveCorrection) | — | 1.5 | P0-03新增 |
| 新增 T-306 (rejectCorrection) | — | 1.5 | P0-03新增 |
| T-108 (部署验证) | 0.5 | 移至D3 | 缓冲Sprint 1 |
| **修正总SP** | **24** | **27** | **修正工期: 7天** |

---

## 总体评价

TDD v1.0宏观架构合理。ai-chat实际代码对照发现3项P0：字段名不一致(_openid vs user_openid)、source_chunks实现位置未指定、审批流缺失。修正后TDD可升版v1.1进入开发。

**结论: 有条件通过 —— 修正P0-01/02/03后启动Sprint 0**

---

*本报告由麒麟（Claude技术PM审查）生成，基于TDD v1.0、ai-chat/index.js(1494行)、admin-ai-quality/index.js(67行)、conversation_logs(132条)的交叉分析。*
