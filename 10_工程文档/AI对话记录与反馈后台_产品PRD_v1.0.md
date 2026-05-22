# AI对话记录与反馈后台 — 产品PRD v1.0

> **文档编号**: ZGB-V4-PRD-004  
> **产品负责人**: 分PD（生活板块）  
> **评审日期**: 2026-05-22  
> **产品基线**: 住港伴V4运营后台 v1.0  
> **前置依赖**: 需求评审报告 v1.0（同日交付）  
> **关联文档**: AI-Chat产品运营方案v1.0、种子用户数据分析报告、V4运营后台与BI看板方案v1.1

---

## 一、产品定义

### 1.1 产品名称

**AI对话质量运营后台**（内部代号：AI Quality Workbench）

### 1.2 一句话定位

让运营团队能看见AI说了什么、判断AI说得对不对、纠正AI说错的地方——把"质量观测是盲的"变成"每句话都可追溯、可评判、可改进"。

### 1.3 产品目标

| 目标     | 衡量指标           | 基线                 | 目标值（D+14） |
| -------- | ------------------ | -------------------- | :------------: |
| 对话可见 | AI对话详情可查看率 | 0%（当前完全不可见） |      100%      |
| 质量可判 | 已标记对话占比     | 0%                   | ≥30%（~40条）  |
| 错误可纠 | 正确答案补充数     | 0条                  |     ≥20条      |
| 盲区可识 | 知识库缺口识别数   | 0                    |     ≥10个      |

### 1.4 用户画像

| 角色     | 使用场景                              | 使用频率 | 核心需求                |
| -------- | ------------------------------------- | :------: | ----------------------- |
| PM/PD    | 每周抽检20条对话，评估AI质量趋势      |    周    | 质量趋势图+导出标注数据 |
| 内容运营 | 每日审核新对话，标记质量+补充正确答案 |    日    | 快速标记+对比RAG来源    |
| 客服运营 | 查找特定用户对话，追溯问题根因        |   按需   | 按用户/问题类型筛选     |

### 1.5 产品边界

**做**：

- 对话日志的分页浏览和详情展开
- 四维质量标记（准确性/完整性/合规性/有用性）
- 低质量回复的正确答案补充（经二次审核）
- 基于标记数据的质量报告（仅统计层面）

**不做**：

- 自动触发AI模型重新训练或prompt自动调优
- 用户端展示"此回答已被人工审核"标记
- 标注任务分配和审核工作流系统
- AI辅助自动标注
- 全量对话数据导出
- 对话内容的全文搜索（仅支持结构化字段筛选）

---

## 二、功能架构

### 2.1 功能模块全景

```
AI质量运营后台
├── 1. 对话日志浏览器
│   ├── 1.1 分页列表（时间/模型/轮次数/质量标记状态）
│   ├── 1.2 多维度筛选器（日期范围/模型/质量标记/问题类型）
│   └── 1.3 对话详情面板（多轮展开+RAG来源引用）
├── 2. 质量标记系统
│   ├── 2.1 四维度评分器（准确性/完整性/合规性/有用性 1-5分）
│   ├── 2.2 综合标记（优秀≥18/合格12-17/需改进8-11/错误≤7）
│   └── 2.3 标记备注（自由文本+错误类型标签）
├── 3. 正确答案补充
│   ├── 3.1 正确回答编辑器（纯文本+来源引用）
│   ├── 3.2 内容安全预检（敏感词扫描）
│   └── 3.3 二次审核状态机（待审核→已采纳/已驳回）
├── 4. 质量报告
│   ├── 4.1 按模型评分分布
│   ├── 4.2 按问题类型聚类低分对话
│   └── 4.3 知识库盲区识别
└── 5. 数据导出
    └── 5.1 标注数据集导出（JSONL格式，供prompt engineering使用）
```

### 2.2 页面路由设计

| 路由                 | 页面组件                     | 说明                           |
| -------------------- | ---------------------------- | ------------------------------ |
| `/conversations`     | `ConversationReviewPage.tsx` | 对话日志列表（新页面）         |
| `/conversations/:id` | 内嵌详情面板（同页展开）     | 对话详情+质量标记+正确答案     |
| `/ai-quality`        | `AIQualityPage.tsx`（增强）  | 现有质量监控页增加质量报告入口 |

### 2.3 与现有AIQualityPage的关系

现有 `AIQualityPage.tsx` 保留为**AI质量总览仪表盘**，新增功能通过以下路径关联：

- AIQualityPage增加"查看对话详情"快捷入口（点击高频问题跳转至筛选后的对话列表）
- AIQualityPage增加"质量报告卡片"（简要版评分分布）
- 对话日志浏览器作为独立页面承载详细操作

---

## 三、数据模型

### 3.1 新建集合：conversation_reviews

```yaml
集合名: conversation_reviews
说明: 存储运营人员对AI对话的质量标记

字段定义:
  _id: string # 自动生成
  conversation_id: string # → conversation_logs._id
  reviewer: string # 标记人 email（来自 admin_users）
  scores:
    accuracy: int # 准确性 1-5
    completeness: int # 完整性 1-5
    compliance: int # 合规性 1-5
    usefulness: int # 有用性 1-5
  total_score: int # 四维总分 4-20（冗余字段，方便排序）
  overall: enum # excellent | good | needs_improvement | wrong
  error_tags: string[] # ['factual_error','outdated_policy','rag_mismatch','compliance_breach','incomplete_answer']
  note: string # 标记备注（自由文本，限500字）
  reviewed_at: timestamp # 标记时间

索引:
  - conversation_id: 普通索引（查询某对话的所有标记）
  - reviewer + reviewed_at: 复合索引（按标记人+时间查询）
  - overall + reviewed_at: 复合索引（按质量等级+时间查询）
  - total_score: 普通索引（评分排序）
```

### 3.2 新建集合：conversation_corrections

```yaml
集合名: conversation_corrections
说明: 存储运营人员对低质量回复的正确答案补充

字段定义:
  _id: string # 自动生成
  conversation_id: string # → conversation_logs._id
  review_id: string # → conversation_reviews._id
  original_query: string # 用户原始问题（脱敏后，截断80字）
  original_response_summary: string # AI原始回复摘要（脱敏后，截断120字）
  correct_answer: string # 正确答案（纯文本，经过content-safety-check预检）
  source_refs:
    string[] # 正确答案引用的来源
    # 格式: "knowledge_chunks:{chunk_id}" 或 "URL:https://..."
  correction_type: enum # factual_correction | supplementary | compliance_fix
  submitted_by: string # 提交人 email
  reviewed_by: string # 审核人 email（二次审核）
  status: enum # pending | approved | rejected
  rejection_reason: string # 驳回原因（status=rejected时必填）
  submitted_at: timestamp # 提交时间
  approved_at: timestamp # 审核通过时间

索引:
  - conversation_id: 普通索引
  - status + submitted_at: 复合索引
  - submitted_by: 普通索引
```

### 3.3 现有集合扩展：conversation_logs

```yaml
新增字段（不修改已有数据，仅新增字段定义）:
  review_status: enum                      # unreviewed | reviewed | corrected
    default: "unreviewed"
  review_count: int                        # 被标记次数（支持多人标记同一条）
    default: 0
  has_correction: boolean                  # 是否有已采纳的正确答案
    default: false

新增索引:
  - review_status + timestamp: 复合索引（按审核状态筛选）
```

### 3.4 数据关系图

```
conversation_logs (129条, 已有)
    │
    ├── 1:1 ──→ conversation_reviews (新建)    # 一条对话可被标记
    │               │
    │               └── 1:1 ──→ conversation_corrections (新建)  # 低分标记可补充正确答案
    │
    └── 引用 ──→ knowledge_chunks (8779条, 已有)  # RAG来源追溯

eval_results (100条, 已有)
    │
    └── 关联 ──→ conversation_logs   # 现有自动评估结果，作为人工标注的参考基线
```

### 3.5 PD架构约束

以下约束来自分PD的数据库优先架构原则，开发时必须遵守：

**约束1: 正确答案不入库knowledge_chunks**
正确答案补充存入 `conversation_corrections` 集合，不直接写入 `knowledge_chunks`。若需升级为知识库内容，必须经过标准数据管线流程（清洗→校验→评估打标），不可绕过。

**约束2: 对话日志关联RAG来源**
`getConversationDetail` action返回的每条AI回复必须包含 `source_chunks` 字段（引用的knowledge_chunks片段ID列表），使审核者能追溯AI推理依据。

**约束3: 所有标记数据支持按身份路径分层**
`conversation_logs` 已有关联 `user_openid`，查询时应通过 `user_profiles.selectedPath` 关联，使质量报告可按身份路径（优才/高才/专才/IANG/受养人/续签/永居）分层分析。

**约束4: PII脱敏不可绕过**
`getConversationDetail` 返回的 query/response 必须经过 `sanitize()` 脱敏（手机号/证件号/邮箱正则替换）。运营后台不提供"查看原始内容"开关。

---

## 四、交互流程

### 4.1 主流程：浏览→标记→纠正

```
 对话日志列表（分页，默认按时间倒序）
    │
    ├── [筛选] 日期范围 / 模型 / 质量状态 / 问题类型
    │
    ├── 点击某条对话 → 展开详情面板
    │     │
    │     ├── 【对话区】用户问题 ↔ AI回复（多轮展开）
    │     │     └── 每轮AI回复下方显示：引用来源 / tokens / 耗时
    │     │
    │     ├── 【标记区】四维评分器 + 综合标记 + 备注
    │     │     └── 提交后：列表状态更新 + 若标记为"需改进/错误"，显示"补充正确答案"入口
    │     │
    │     └── 【纠正区】（仅低分标记可见）
    │           ├── 正确回答文本编辑器
    │           ├── 来源引用（手动输入或从知识库选择）
    │           └── 提交 → 进入二次审核 → 审核通过 → conversation_logs.has_correction = true
    │
    └── 返回列表，继续审核下一条
```

### 4.2 快速审核模式（键盘快捷键）

为降低运营人员的标注疲劳，支持键盘快捷操作：

| 快捷键 | 操作                                            |
| :----: | ----------------------------------------------- |
|  ← →   | 上一条/下一条对话                               |
|  1-4   | 快速标记：优秀/合格/需改进/错误（跳过详细评分） |
| Enter  | 确认提交标记                                    |
|  Esc   | 关闭详情面板                                    |
|   C    | 打开正确答案编辑器                              |

### 4.3 二次审核流程

```
运营A提交正确答案
    │
    ├── content-safety-check 自动预检
    │     ├── 通过 → 状态 = pending
    │     └── 不通过 → 拒绝提交，提示敏感词位置
    │
    └── 运营B（另一人）审核
          ├── 采纳 → status = approved, conversation_logs.has_correction = true
          │     └── 正确答案进入"候选增强语料池"（仅供查看，不入库knowledge_chunks）
          └── 驳回 → status = rejected, 填写驳回原因
                └── 运营A可查看驳回原因并重新提交
```

### 4.4 错误状态处理

| 状态           | 展示                                            | 用户操作     |
| -------------- | ----------------------------------------------- | ------------ |
| 加载中         | Spin + "正在加载对话..."                        | —            |
| 空数据         | "暂无对话记录 — 等待用户开始使用AI Chat"        | —            |
| 筛选无结果     | "没有符合条件的对话 — 尝试调整筛选条件"         | 清除筛选按钮 |
| 云函数异常     | "加载失败 — 请刷新重试" + 错误信息              | 刷新按钮     |
| 脱敏后内容为空 | "此条对话经脱敏后无可展示内容 — 已标记为待复核" | —            |
| 标记提交失败   | Toast提示"标记提交失败，请重试"                 | 重试按钮     |

---

## 五、API设计

### 5.1 云函数扩展：admin-ai-quality

现有4个action（getAIDashboard / getAccuracyTrend / getTopQueries / getSafetyEvents），新增4个action：

#### 5.1.1 listConversations

```
Action: listConversations
Method: POST
Auth: _apiKey (SHA-256)

Request:
{
  action: "listConversations",
  params: {
    page: number,           // 页码，默认1
    pageSize: number,       // 每页条数，默认20，最大50
    model?: string,         // 模型筛选: 'hunyuan' | 'deepseek'
    reviewStatus?: string,  // 审核状态: 'unreviewed' | 'reviewed' | 'corrected'
    overall?: string,       // 质量筛选: 'excellent' | 'good' | 'needs_improvement' | 'wrong'
    dateFrom?: string,      // 开始日期 YYYY-MM-DD
    dateTo?: string,        // 结束日期 YYYY-MM-DD
    pathType?: string       // 身份路径筛选: 'qmas' | 'ttps_a' | ...
  }
}

Response:
{
  code: 0,
  data: {
    total: number,
    page: number,
    pageSize: number,
    list: [{
      _id: string,
      timestamp: string,
      user_openid_prefix: string,    // openid前8位
      query_preview: string,         // 首条用户问题（脱敏，截断60字）
      model: string,
      round_count: number,
      duration_ms: number,
      review_status: string,
      has_correction: boolean,
      overall_rating?: string,
      path_label?: string            // 身份路径中文标签
    }]
  }
}
```

#### 5.1.2 getConversationDetail

```
Action: getConversationDetail
Method: POST
Auth: _apiKey

Request:
{
  action: "getConversationDetail",
  params: {
    conversationId: string   // conversation_logs._id
  }
}

Response:
{
  code: 0,
  data: {
    _id: string,
    timestamp: string,
    user_openid_prefix: string,
    path_label: string,
    messages: [{
      role: 'user' | 'assistant',
      content: string,              // 脱敏后内容
      tokens: number,
      source_chunks?: [{            // 仅assistant消息
        chunk_id: string,
        title: string,
        content_preview: string     // 引用的知识片段预览（前80字）
      }],
      safety_triggered?: string[]
    }],
    review: {                       // 已有的标记（如果存在）
      scores: { accuracy, completeness, compliance, usefulness },
      overall: string,
      error_tags: string[],
      note: string,
      reviewer: string,
      reviewed_at: string
    } | null,
    correction: {                   // 已有的正确答案（如果存在且已采纳）
      correct_answer: string,
      source_refs: string[],
      status: string,
      submitted_at: string
    } | null
  }
}
```

#### 5.1.3 submitReview

```
Action: submitReview
Method: POST
Auth: _apiKey

Request:
{
  action: "submitReview",
  params: {
    conversationId: string,
    scores: {
      accuracy: 1-5,
      completeness: 1-5,
      compliance: 1-5,
      usefulness: 1-5
    },
    overall: 'excellent' | 'good' | 'needs_improvement' | 'wrong',
    errorTags?: string[],
    note?: string                  // 限500字
  }
}

Response:
{
  code: 0,
  data: {
    reviewId: string,
    total_score: number
  }
}

错误:
- 400: 参数校验失败（分数范围/overall值与total_score不匹配）
- 401: 缺少或无效的API Key
- 404: 对话不存在
- 409: 该对话已被当前用户标记（同一人不可重复标记同一条）
```

#### 5.1.4 submitCorrection

```
Action: submitCorrection
Method: POST
Auth: _apiKey

Request:
{
  action: "submitCorrection",
  params: {
    conversationId: string,
    reviewId: string,
    correctAnswer: string,         // 限2000字
    sourceRefs: string[],
    correctionType: 'factual_correction' | 'supplementary' | 'compliance_fix'
  }
}

前置条件:
- 该对话必须已有标记且overall ∈ {needs_improvement, wrong}
- correctAnswer 需经过内联敏感词扫描（复用 ai-chat 的 blockedPatterns）

Response:
{
  code: 0,
  data: {
    correctionId: string,
    status: 'pending'
  }
}

错误:
- 400: 参数校验失败 / 敏感词检测不通过
-401: 缺少或无效的API Key
- 404: 对话或标记不存在
- 409: 该对话已有pending状态的正确答案
- 422: 前置条件不满足（无标记或标记非低分）
```

### 5.2 前端API客户端扩展

在 `src/lib/api.ts` 中新增4个方法：

```typescript
// AI Quality - Conversation Review
export const listConversations = (p: Record<string, unknown>) =>
  call<PaginatedResponse<ConversationListItem>>('/admin-ai-quality', { action: 'listConversations', params: p });

export const getConversationDetail = (conversationId: string) =>
  call<ConversationDetail>('/admin-ai-quality', { action: 'getConversationDetail', params: { conversationId } });

export const submitReview = (p: Record<string, unknown>) =>
  call<{ reviewId: string; total_score: number }>('/admin-ai-quality', { action: 'submitReview', params: p });

export const submitCorrection = (p: Record<string, unknown>) =>
  call<{ correctionId: string; status: string }>('/admin-ai-quality', { action: 'submitCorrection', params: p });
```

---

## 六、安全与合规设计

### 6.1 PII脱敏策略

采用与 `admin-ai-quality/index.js` 现有 `sanitize()` 函数一致的脱敏规则：

| 类型   | 正则                                   | 替换                        |
| ------ | -------------------------------------- | --------------------------- |
| 手机号 | `1[3-9]\d{9}`                          | `[手机号]`                  |
| 证件号 | `[A-Z]\d{6,8}`                         | `[证件号]`                  |
| 邮箱   | `[\w.-]+@[\w.-]+`                      | `[邮箱]`                    |
| 姓名   | 不做自动替换（中文姓名识别准确率不足） | 运营人员如发现PII可手动标记 |

脱敏位置：云函数返回数据时执行，前端不可绕过。

### 6.2 合规敏感词扫描

正确答案提交前执行内联扫描，复用 `ai-chat/index.js` 中的 `blockedPatterns`（自残方法/武器制造/儿童色情），并额外增加：

- "移民" 字眼检测（符合香港身份规划术语合规要求）
- "投资移民" 检测（已被香港政府于2015年暂停）

### 6.3 审计日志

所有标记和纠正操作写入 `admin_audit_trail`（已有集合），包含：

- `action`: `review_conversation` / `submit_correction` / `approve_correction` / `reject_correction`
- `targetType`: `conversation_logs` / `conversation_corrections`
- `targetId`: 对应记录ID
- `detail`: 操作摘要（脱敏后）
- `operator`: 操作人email
- `timestamp`: 操作时间

### 6.4 RBAC权限

| 角色        | 浏览对话 | 标记质量 | 补充正确答案 | 审核正确答案 | 导出数据 |
| ----------- | :------: | :------: | :----------: | :----------: | :------: |
| super_admin |    ✅    |    ✅    |      ✅      |      ✅      |    ✅    |
| pm          |    ✅    |    ✅    |      ✅      |      ✅      |    ✅    |
| ops         |    ✅    |    ✅    |      ✅      |      ❌      |    ❌    |
| content     |    ✅    |    ✅    |      ✅      |      ❌      |    ❌    |
| cs          |    ✅    |    ❌    |      ❌      |      ❌      |    ❌    |

---

## 七、前端页面原型（关键界面描述）

### 7.1 对话日志列表页

```
┌─────────────────────────────────────────────────────────────┐
│ AI 对话审核                                   [质量报告 →]  │
│ 129条对话 · 0条已标记 · 0条已纠正                            │
├─────────────────────────────────────────────────────────────┤
│ [筛选栏]                                                    │
│ 日期: [2026-05-15] ~ [2026-05-22]  模型: [全部 ▼]          │
│ 质量: [全部 ▼]  状态: [全部 ▼]  路径: [全部 ▼]              │
│                                  [清除筛选] [刷新]          │
├─────────────────────────────────────────────────────────────┤
│ 时间         用户      问题摘要           模型    轮次 标记  │
│ ─────────── ──────── ────────────────── ────── ──── ────── │
│ 05-21 18:30  oxABC123 优才计划申请条件...  deepseek  3  ○  │
│ 05-21 17:15  oxDEF456 高才通A类收入证明... hunyuan   2  ●  │
│ 05-21 16:02  oxGHI789 受养人签证续签流程... deepseek  1  ◉  │
│ ...                                                         │
│                                     ← 上一页  1/7  下一页 → │
└─────────────────────────────────────────────────────────────┘

图例: ○未标记 ●已标记(合格) ◉已标记(需改进) ◎已纠正
```

### 7.2 对话详情+标记面板（同屏左右布局）

```
┌──────────────────────────────┬──────────────────────────────┐
│ ← 返回列表          [上一条] [下一条]                         │
│                              │                              │
│ 用户: oxABC123**             │  ★ 质量标记                   │
│ 路径: 优才计划               │                              │
│ 时间: 2026-05-21 18:30       │  准确性  ○○○●○  3/5          │
│ 模型: deepseek-v3.2          │  完整性  ○○○●●  4/5          │
│ 耗时: 3.2s · 420 tokens     │  合规性  ○○●●●  5/5          │
│                              │  有用性  ○○○○○  1/5          │
│ ─────────────────────────── │  总分: 13/20                 │
│                              │                              │
│ 👤 用户: 优才计划申请条件是?  │  综合标记:                   │
│     香港优才需要什么材料？   │  ○ 优秀  ● 合格              │
│                              │  ○ 需改进  ○ 错误            │
│ 🤖 AI:  香港优秀人才入境计划 │                              │
│     (简称"优才计划")的申请..│  错误类型:                    │
│     主要条件包括:           │  ☐ 事实错误  ☐ 政策过时      │
│     1. 年龄: 18周岁以上     │  ☑ RAG引用错误  ☐ 合规风险   │
│     2. 财政要求: ...        │  ☐ 回答不完整                │
│                              │                              │
│     📎 引用来源:             │  备注:                       │
│     knowledge_chunks:7a3f   │  RAG未引用2025年最新            │
│     "2023优才政策解读"       │  综合计分制修订内容，          │
│                              │  评分标准已过时              │
│ 👤 用户: 那综合计分制呢?     │                              │
│                              │          [提交标记]          │
│ 🤖 AI:  综合计分制是优才... │                              │
│                              ├──────────────────────────────┤
│     📎 引用来源:             │  📝 补充正确答案              │
│     (无引用来源)             │  (标记为"需改进"或"错误"时    │
│                              │   显示此面板)                │
│                              │                              │
│                              │  [正确回答文本框...]          │
│                              │                              │
│                              │  来源引用: [添加来源]        │
│                              │                              │
│                              │  [提交审核]                  │
└──────────────────────────────┴──────────────────────────────┘
```

### 7.3 质量报告页（AIQualityPage增强）

在现有4个指标卡片基础上，新增：

- **模型评分对比卡片**：Hunyuan vs DeepSeek 平均分对比（柱状图）
- **问题类型低分分布**：续签/税务/证件/升学/工作/生活 六类问题的需要改进率
- **知识库盲区列表**：RAG召回为空的高频问题Top 10
- **标注进度**："已标记 X/129 (Y%)，本周新增 Z 条"

---

## 八、开发排期

### 8.1 前置修复（D0，0.5天）

| 任务                                   | 说明                                                     |
| -------------------------------------- | -------------------------------------------------------- |
| 修复 admin-ai-quality 云函数运行时异常 | 当前 getArticleRanking 调用报 FUNCTION_INVOCATION_FAILED |
| 验证 conversation_logs 集合可读写      | 确认 admin-ai-quality 的 db 引用正常                     |

### 8.2 第一阶段：对话浏览+标记（D0-D2，2天）

| 任务                                               | 工时  | 交付物              |
| -------------------------------------------------- | :---: | ------------------- |
| admin-ai-quality 新增 listConversations action     | 0.5天 | 云函数扩展          |
| admin-ai-quality 新增 getConversationDetail action | 0.5天 | 云函数扩展          |
| ConversationReviewPage 列表页                      | 0.5天 | 前端页面            |
| ConversationReviewPage 详情+标记面板               | 0.5天 | 前端页面            |
| 联调+类型定义                                      | 0.5天 | types/index.ts 更新 |

### 8.3 第二阶段：正确答案补充（D3-D5，2.5天）

| 任务                                          | 工时  | 交付物     |
| --------------------------------------------- | :---: | ---------- |
| admin-ai-quality 新增 submitReview action     | 0.5天 | 云函数扩展 |
| admin-ai-quality 新增 submitCorrection action | 0.5天 | 云函数扩展 |
| 正确答案编辑器+二次审核面板                   | 0.5天 | 前端页面   |
| conversation_reviews 集合创建+索引            | 0.5天 | 数据库     |
| conversation_corrections 集合创建+索引        | 0.5天 | 数据库     |

### 8.4 第三阶段：质量报告+验收（D6-D7，1.5天）

| 任务                               | 工时  | 交付物   |
| ---------------------------------- | :---: | -------- |
| AIQualityPage 增强（质量报告卡片） | 0.5天 | 前端增强 |
| 键盘快捷键+快速审核模式            | 0.5天 | 前端增强 |
| E2E测试+验收                       | 0.5天 | 测试报告 |

**总排期: 6.5天（含前置修复）**

### 8.5 依赖项

| 依赖                            |     状态     | 说明                  |
| ------------------------------- | :----------: | --------------------- |
| admin-ai-quality 云函数修复     |   🔴 待修    | D0解决                |
| conversation_logs 集合可用      |  ✅ 已就绪   | 129条数据             |
| admin_users 集合有至少2名用户   | ⚠️ 当前仅1人 | 需新增1名测试运营账号 |
| content-safety-check 云函数可用 |  ✅ 已部署   | 用于正确答案预检      |
| admin_audit_trail 集合可用      |  ✅ 已就绪   | 8条记录               |

---

## 九、验收标准

### 9.1 功能验收

| 验收项       | 验收标准                                | 验收方式 |
| ------------ | --------------------------------------- | :------: |
| 对话列表加载 | 分页加载129条对话，<2秒响应             |   手动   |
| 筛选器       | 按模型/日期/路径筛选结果正确            |   手动   |
| 对话详情     | 多轮消息完整展示，含引用来源            |   手动   |
| PII脱敏      | 对话内容中手机号/证件号/邮箱已被替换    |  自动化  |
| 质量标记     | 四维评分提交成功，数据库写入正确        |  自动化  |
| 正确答案提交 | 正确答案经过content-safety-check预检    |  自动化  |
| 二次审核     | 审核人可采纳/驳回，状态流转正确         |   手动   |
| 权限控制     | cs角色无标记权限，ops/content无审核权限 |  自动化  |
| 审计日志     | 每次标记/纠正操作均有审计记录           |  自动化  |

### 9.2 性能验收

| 指标             | 标准                            |
| ---------------- | ------------------------------- |
| 对话列表首页加载 | <2s（129条数据量级）            |
| 对话详情展开     | <1s                             |
| 标记提交响应     | <500ms                          |
| 并发标记         | 支持2人同时标记不同对话互不冲突 |

### 9.3 安全验收

| 验收项                     | 标准                       |
| -------------------------- | -------------------------- |
| 无API Key拒绝访问          | 返回401                    |
| 错误API Key拒绝访问        | 返回401                    |
| submitCorrection敏感词拦截 | 返回400含错误位置          |
| PII原始内容不可达          | 前端/API返回均为脱敏后内容 |

---

## 十、风险与对策

| 风险                                     |        影响        | 缓解                                                 |
| ---------------------------------------- | :----------------: | ---------------------------------------------------- |
| admin-ai-quality云函数异常修复耗时超预期 |       D0延期       | 如修复复杂，先绕过异常action，新action独立于现有代码 |
| 运营团队标注动力不足                     |    标记量不达标    | 快速审核模式(快捷键)+进度可视化                      |
| 正确答案质量参差不齐                     |     审核负担重     | 二次审核+提供RAG原文对比锚点                         |
| 129条对话样本分布不均                    | 部分身份路径无对话 | 暂时仅做整体统计，按路径分层待对话量增长后启用       |

---

## 十一、附录

### A. 术语对齐

| 术语                  | 定义                                                             |
| --------------------- | ---------------------------------------------------------------- |
| 质量标记 (review)     | 运营人员对单条对话的人工评分                                     |
| 正确答案 (correction) | 运营人员对低质量回复的人工纠正                                   |
| 二次审核 (approval)   | 另一运营人员对正确答���的复核                                    |
| 候选增强语料池        | 已审核的正确答案集合（不入库knowledge_chunks，仅供内容工程参考） |
| 四维评分              | 准确性×完整性×合规性×有用性，每个维度1-5分                       |

### B. 与运营方案的对齐

本文档的实施对应AI-Chat产品运营方案v1.0中：

- Phase 1 (D0-D7): "补建反馈闭环+基础监控" — 本PRD的D0-D3
- Phase 2 (D8-D21): "质量运营金字塔(反馈→自动评估→人工抽检→RAG质量)" — 本PRD的D4-D7

### C. 与BI方案的对齐

V4运营后台与BI看板方案v1.1中：

- §3.6 AI质量监控 → 本PRD在此基础上新增对话审核能力
- admin-ai-quality 云函数 → 本PRD新增4个action

### D. 变更记录

| 版本 | 日期       | 变更                           |
| ---- | ---------- | ------------------------------ |
| v1.0 | 2026-05-22 | 初始版本，基于需求评审报告v1.0 |
