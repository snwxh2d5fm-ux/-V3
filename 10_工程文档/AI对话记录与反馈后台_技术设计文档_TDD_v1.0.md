# AI对话记录与反馈后台 — 技术设计文档 v1.1

> **文档编号**: ZGB-V4-TDD-004  
> **对应PRD**: ZGB-V4-PRD-004 (AI对话记录与反馈后台_产品PRD_v1.0)  
> **技术负责人**: 分PD（生活板块）  
> **日期**: 2026-05-22  
> **审查状态**: ✅ 麒麟代码评审通过（3P0已修复）  
> **v1.1变更**: 吸收麒麟审查P0-01(_openid字段名修正) + P0-02(ai-chat行号指引) + P0-03(审批流补全)

---

## 一、技术栈决策

### 1.1 技术栈总览

| 层 | 技术选型 | 版本 | 决策理由 |
|------|------|:--:|------|
| 前端框架 | React + TypeScript | 19.2 / 6.0 | 与现有admin-dashboard一致 |
| 构建工具 | Vite | 5.4 | 现有项目统一工具链 |
| CSS | Tailwind CSS | 3.4 | 现有项目样式方案 |
| UI组件 | shadcn/ui + lucide-react | latest | 现有项目组件库 |
| 图表 | Recharts | 3.8 | 现有项目图表方案 |
| 路由 | react-router-dom | 7.15 | 现有项目路由方案 |
| 后端运行时 | CloudBase云函数 (Node.js) | Nodejs18.15 | 现有admin-*函数统一运行时 |
| 后端SDK | @cloudbase/node-sdk | latest | CloudBase官方Node SDK |
| 数据库 | CloudBase NoSQL (文档型) | — | 现有数据层，49个集合 |
| HTTP网关 | CloudBase HTTP Service | — | 现有admin-*函数统一网关 |
| 鉴权 | API Key (SHA-256) | — | 现有admin_users + apiKeyHash方案 |

### 1.2 关键决策

**决策1: 不引入新服务**
所有新增能力在现有 `admin-ai-quality` 云函数中扩展(4→10 action)，不创建新云函数。理由：(1) 职能内聚——AI质量相关的所有操作归属同一函数；(2) 避免网关路由膨胀（已有8个admin-*路径）；(3) 共享鉴权和PII脱敏逻辑。

**决策2: 正确答案的合规扫描使用内联方案**
在 `submitCorrection` 中内联 `blockedPatterns` + 术语合规检测，不跨函数调用 `content-safety-check`。理由：(1) 避免Event函数间调用复杂度；(2) 规则数量少（~5条正则），维护成本低；(3) 代码注释声明同步义务。

**决策3: 前端不新增路由，使用AIQualityPage内嵌Tab**
在现有 `/admin/ai-quality` 页面中增加Tab切换（"质量总览" / "对话审核"），不新增独立路由。理由：(1) 避免Sidebar膨胀（已有12个菜单项）；(2) 两个视图共享AI质量上下文，Tab切换更自然；(3) 减少路由配置变更范围。

**决策4: conversation_logs补充source_chunks字段，_openid已存在无需新增**
`source_chunks` 需在ai-chat云函数写入时补充。`_openid` 经麒麟审查确认已存在（ai-chat L800: `_openid: data.openid || null`）。存量~132条数据的 `source_chunks` 标记为null，`_openid` 在测试数据(session_id=verify_*)中为null。

**ai-chat修改指引（麒麟P0-02修复）**：
- **文件**: `cloudfunctions/ai-chat/index.js`
- **位置1** (非流式, ~L1073-1084): `logConversation({...})` 调用中增加 `sourceChunks: ragResult.chunks.map(c => ({chunk_id: c._id, title: c.source_title, content_preview: (c.content||'').slice(0,80)}))`
- **位置2** (流式, ~L1278-1298): 同上
- **位置3** (降级, ~L1108-1119): 降级场景无ragResult.chunks，sourceChunks传 `[]`
- **位置4** (stream timeout, ~L1236-1253): 同上
- **logConversation函数内** (~L800后): 新增字段 `source_chunks: data.sourceChunks || null`
- **工作量修正**: T-101从3SP→2SP（实为1字段+4处调用点修改）

---

## 二、系统架构

### 2.1 架构全景图

```
┌──────────────────────────────────────────────────────────────────┐
│                        用户端 (小程序)                             │
│  ai-chat 云函数 ──→ conversation_logs (写入时增加字段)             │
│                    source_chunks + _openid                    │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    运营后台 (React Web)                            │
│                                                                   │
│  AIQualityPage.tsx (增强)                                         │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Tab: "质量总览"          │ Tab: "对话审核"                    │ │
│  │ (现有4卡片+新增报告卡片)  │ ConversationReviewPanel.tsx(新)   │ │
│  │                          │  ├── ConversationList             │ │
│  │                          │  ├── ConversationDetail            │ │
│  │                          │  ├── ReviewForm (四维评分)         │ │
│  │                          │  └── CorrectionEditor (正确答案)   │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              │                                    │
│                       api.ts (新增4方法)                           │
└──────────────────────────────────────────────────────────────────┘
                              │
                     HTTP POST (JSON)
                     _apiKey SHA-256
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│              CloudBase HTTP Gateway (* domain)                     │
│              /admin-ai-quality → admin-ai-quality 云函数           │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                  admin-ai-quality 云函数 (扩展)                    │
│                                                                   │
│  现有4 action:         新增6 action:                              │
│  - getAIDashboard      - listConversations                       │
│  - getAccuracyTrend    - getConversationDetail                   │
│  - getTopQueries       - submitReview                            │
│  - getSafetyEvents     - submitCorrection                        │
│                        - approveCorrection  (P0-03)              │
│                        - rejectCorrection   (P0-03)              │
│                                                                   │
│  共享: validateApiKey() + sanitize() + auditLog()                │
└──────────────────────────────────────────────────────────────────┘
                              │
                    @cloudbase/node-sdk
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    CloudBase NoSQL 数据库                          │
│                                                                   │
│  现有集合:              新建集合:                                 │
│  - conversation_logs    - conversation_reviews                   │
│    (扩展3字段+1索引)    - conversation_corrections               │
│  - admin_users                                                    │
│  - admin_audit_trail                                              │
│  - knowledge_chunks                                               │
│  - user_profiles                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 数据流

```
[写入流]
ai-chat云函数
  └→ conversation_logs.add({
       ...原有字段(含_openid: data.openid),   // _openid已存在
       source_chunks: [{chunk_id, title, content_preview}],  // 新增
     })

[读取流 - 对话列表]
ConversationReviewPanel
  → api.listConversations({page, model?, reviewStatus?, ...})
  → POST /admin-ai-quality {action:"listConversations", params:{...}}
  → admin-ai-quality.listConversations()
  → db.collection('conversation_logs')
      .where(筛选条件)
      .orderBy('timestamp','desc')
      .skip/slimit 分页
  → 关联 user_profiles 获取 pathLabel
  → sanitize() 脱敏 query_preview
  → 返回分页列表

[读取流 - 对话详情]
ConversationDetail (点击展开)
  → api.getConversationDetail(conversationId)
  → POST /admin-ai-quality {action:"getConversationDetail", params:{conversationId}}
  → admin-ai-quality.getConversationDetail()
  → db.collection('conversation_logs').doc(conversationId).get()
  → 同时查 conversation_reviews (已有标记?) + conversation_corrections (已有纠正?)
  → sanitize() 脱敏所有 message.content
  → 返回完整详情

[写入流 - 质量标记]
ReviewForm 提交
  → api.submitReview({conversationId, scores, overall, errorTags, note})
  → POST /admin-ai-quality {action:"submitReview", params:{...}}
  → admin-ai-quality.submitReview()
  → 服务端校验: total_score = sum(scores) && overall范围匹配
  → 409检查: 同一reviewer+同一conversation_id不可重复标记
  → db.collection('conversation_reviews').add({...})
  → db.collection('conversation_logs').doc(id).update({review_status:'reviewed', review_count: _.inc(1)})
  → auditLog('review_conversation', ...)

[写入流 - 正确答案补充]
CorrectionEditor 提交
  → api.submitCorrection({conversationId, reviewId, correctAnswer, ...})
  → POST /admin-ai-quality {action:"submitCorrection", params:{...}}
  → admin-ai-quality.submitCorrection()
  → 422检查: 该对话overall ∈ {needs_improvement, wrong}
  → 内联合规扫描: blockedPatterns + "移民"/"投资移民"
  → 409检查: 该对话无pending状态的correction
  → db.collection('conversation_corrections').add({status:'pending', ...})
  → auditLog('submit_correction', ...)
```

---

## 三、数据库模型

### 3.1 新建集合 DDL

#### conversation_reviews

```javascript
// CloudBase NoSQL — 无需显式CREATE，通过代码创建索引
// 集合名: conversation_reviews

// 文档结构:
{
  _id: "auto-generated",
  conversation_id: "0667d90f6a0b07a200be163558ba2574",  // → conversation_logs._id
  reviewer: "pm@funway.hk",                               // admin_users.email
  scores: {
    accuracy: 3,       // 1-5
    completeness: 4,   // 1-5
    compliance: 5,     // 1-5
    usefulness: 1      // 1-5
  },
  total_score: 13,     // 4-20, 冗余字段
  overall: "good",     // excellent|good|needs_improvement|wrong
  error_tags: ["rag_mismatch", "outdated_policy"],
  note: "RAG未引用2025年最新综合计分制修订内容",
  reviewed_at: new Date("2026-05-22T10:30:00Z")
}

// 索引 (通过 writeNoSqlDatabaseStructure 创建):
// 1. conversation_id 普通索引
// 2. reviewer + reviewed_at 复合索引
// 3. overall + reviewed_at 复合索引
// 4. total_score 普通索引
```

#### conversation_corrections

```javascript
// 集合名: conversation_corrections

// 文档结构:
{
  _id: "auto-generated",
  conversation_id: "0667d90f6a0b07a200be163558ba2574",
  review_id: "auto-generated-review-id",
  original_query: "优才计划申请条件是?",
  original_response_summary: "香港优秀人才入境计划的主要条件包括: 1.年龄18周岁以上...",
  correct_answer: "2025年11月起，优才计划改为评核制，申请人需在12项评核准则中满足至少6项...",
  source_refs: ["knowledge_chunks:abc123", "URL:https://www.immd.gov.hk/..."],
  correction_type: "factual_correction",
  submitted_by: "content@funway.hk",
  reviewed_by: "pm@funway.hk",        // 审核后填入
  status: "pending",                   // pending|approved|rejected
  rejection_reason: "",                // status=rejected时必填
  submitted_at: new Date("2026-05-22T11:00:00Z"),
  approved_at: null
}

// 索引:
// 1. conversation_id 普通索引
// 2. status + submitted_at 复合索引
// 3. submitted_by 普通索引
```

### 3.2 现有集合扩展

#### conversation_logs (扩展3字段+1索引)

```javascript
// 现有字段保持不变，新增以下字段:

// 新增字段1: source_chunks (在ai-chat云函数写入时填充)
source_chunks: [
  {
    chunk_id: "7a3f2b1c...",           // knowledge_chunks._id
    title: "2025优才综合计分制修订",     // knowledge_chunks.title
    content_preview: "自2025年11月起..."  // 前80字
  }
]

// 新增字段2: _openid (在ai-chat云函数写入时填充)
_openid: "oxABC123..."

// 新增字段3-5: review_status / review_count / has_correction (admin-ai-quality写入)
review_status: "unreviewed",  // unreviewed|reviewed|corrected
review_count: 0,
has_correction: false

// 新增索引:
// review_status + timestamp 复合索引

// 存量数据处理:
// - source_chunks: null (前端展示"RAG来源未记录")
// - _openid: null (无法按路径筛选，列表显示"未知用户")
// - review_status: "unreviewed" (默认)
```

### 3.3 集合创建脚本

```javascript
// 在 CloudBase 控制台或通过 MCP 工具执行

// 步骤1: 创建 conversation_reviews 集合
await writeNoSqlDatabaseStructure({
  action: "createCollection",
  collectionName: "conversation_reviews"
});
// 然后创建索引...

// 步骤2: 创建 conversation_corrections 集合
await writeNoSqlDatabaseStructure({
  action: "createCollection",
  collectionName: "conversation_corrections"
});

// 步骤3: conversation_logs 新增索引
await writeNoSqlDatabaseStructure({
  action: "updateCollection",
  collectionName: "conversation_logs",
  updateOptions: {
    CreateIndexes: [{
      IndexName: "review_status_timestamp",
      MgoKeySchema: {
        MgoIsUnique: false,
        MgoIndexKeys: [
          { Name: "review_status", Direction: "1" },
          { Name: "timestamp", Direction: "-1" }
        ]
      }
    }]
  }
});
```

---

## 四、API实现规格

### 4.1 云函数改造概要

**文件**: `cloudfunctions/admin-ai-quality/index.js`  
**变更**: 从67行扩展到约320行  
**新增依赖**: 无（复用现有cloudbase + crypto）

**改造结构**:
```javascript
// 现有代码保留不变
const cloudbase = require('@cloudbase/node-sdk');
const crypto = require('crypto');
const app = cloudbase.init({ env: 'cloudbase-d1g17tgt7cc199a60' });
const db = app.database();
function sha256(s) { ... }
function sanitize(s) { ... }

// 新增: 提取鉴权为独立函数（现有代码内联）
async function validateApiKey(apiKey) {
  const kh = sha256(apiKey);
  const adm = await db.collection('admin_users')
    .where({ apiKeyHash: kh, status: 'active' }).limit(1).get();
  return adm.data.length ? adm.data[0] : null;
}

// 新增: 审计日志
async function auditLog(action, targetType, targetId, operator, detail) {
  await db.collection('admin_audit_trail').add({
    action, targetType, targetId, operator,
    detail: sanitize(String(detail).slice(0, 200)),
    timestamp: new Date()
  });
}

// 新增: 合规扫描（内联）
const BLOCKED_PATTERNS = [
  /自[杀残害]|自我了断|如何.*[死杀]|结束.*生命/i,
  /制造.*[枪炸弹]|武器.*制作|爆炸.*方法/i,
  /儿童.*色情|未成年.*性/i
];
const HK_TERM_PATTERNS = [/移民(?!局|署|官|法|政策|倾向|签证)/g, /投资移民/g];

function complianceScan(text) {
  for (const p of BLOCKED_PATTERNS) {
    if (p.test(text)) return { pass: false, reason: '内容安全检测不通过' };
  }
  for (const p of HK_TERM_PATTERNS) {
    if (p.test(text)) return { pass: false, reason: `含不合规术语: ${p.source}` };
  }
  return { pass: true };
}

// 新增: overall与total_score映射校验
const OVERALL_RANGES = {
  excellent: [18, 20],
  good: [12, 17],
  needs_improvement: [8, 11],
  wrong: [4, 7]
};

function validateOverall(overall, totalScore) {
  const [min, max] = OVERALL_RANGES[overall] || [0, 0];
  if (totalScore < min || totalScore > max) {
    return { valid: false, expectedRange: `${min}-${max}`, actual: totalScore };
  }
  return { valid: true };
}

// 现有 exports.main 扩展 switch
exports.main = async (event) => {
  // ... 现有 body 解析逻辑 ...
  const admin = await validateApiKey(_apiKey);
  if (!admin) return { code: 401, msg: '无效的 API Key' };

  try {
    switch (action) {
      // 现有4个action
      case 'getAIDashboard': return aiDashboard(params);
      case 'getAccuracyTrend': return accuracyTrend(params);
      case 'getTopQueries': return topQueries(params);
      case 'getSafetyEvents': return safetyEvents(params);
      // 新增4个action
      case 'listConversations': return listConversations(params);
      case 'getConversationDetail': return getConversationDetail(params);
      case 'submitReview': return submitReview(params, admin);
      case 'submitCorrection': return submitCorrection(params, admin);
      case 'approveCorrection': return approveCorrection(params, admin);   // P0-03
      case 'rejectCorrection': return rejectCorrection(params, admin);     // P0-03
      default: return { code: 400, msg: '无效操作: ' + action };
    }
  } catch (err) { return { code: 500, msg: err.message }; }
};
```

### 4.2 新增Action实现规格

#### action: listConversations

```javascript
async function listConversations(p) {
  const page = Math.max(1, p.page || 1);
  const pageSize = Math.min(50, Math.max(1, p.pageSize || 20));
  
  // 构建筛选条件
  const where = {};
  if (p.model) where.model = p.model;
  if (p.dateFrom || p.dateTo) {
    where.timestamp = {};
    if (p.dateFrom) where.timestamp['$gte'] = new Date(p.dateFrom).getTime();
    if (p.dateTo) where.timestamp['$lte'] = new Date(p.dateTo + 'T23:59:59').getTime();
  }
  
  // 查询对话
  let query = db.collection('conversation_logs')
    .where(Object.keys(where).length ? where : {})
    .orderBy('timestamp', 'desc');
  
  // review_status/overall筛选在内存中完成（因为关联conversation_reviews）
  // 当数据量>5000条时改为聚合查询
  
  const totalResult = await query.count();
  const logs = await query.skip((page - 1) * pageSize).limit(pageSize).get();
  
  // 批量获取review状态和path标签
  const ids = logs.data.map(l => l._id);
  const openids = [...new Set(logs.data.map(l => l._openid).filter(Boolean))];
  
  const [reviews, profiles] = await Promise.all([
    ids.length ? db.collection('conversation_reviews').where({ conversation_id: db.command.in(ids) }).get() : { data: [] },
    openids.length ? db.collection('user_profiles').where({ _openid: db.command.in(openids) }).get() : { data: [] }
  ]);
  
  // 构建索引
  const reviewMap = {};
  reviews.data.forEach(r => { reviewMap[r.conversation_id] = r; });
  const profileMap = {};
  profiles.data.forEach(p => { profileMap[p._openid] = p; });
  
  // 脱敏+组装
  const list = logs.data.map(l => {
    const review = reviewMap[l._id];
    return {
      _id: l._id,
      timestamp: l.timestamp,
      _openid_prefix: l._openid ? l._openid.slice(0, 8) : 'unknown',
      query_preview: sanitize(l.query || '').slice(0, 60),
      model: l.model || 'unknown',
      round_count: 1,  // 当前数据结构无轮次字段，默认1
      duration_ms: l.latency_ms || 0,
      review_status: review ? (l.has_correction ? 'corrected' : 'reviewed') : (l.review_status || 'unreviewed'),
      has_correction: !!l.has_correction,
      overall_rating: review ? review.overall : undefined,
      path_label: l._openid && profileMap[l._openid] 
        ? (profileMap[l._openid].selectedPath || '未选择') 
        : undefined
    };
  });
  
  // pathType筛选（内存过滤）
  let filteredList = list;
  if (p.pathType && p.pathType !== '全部') {
    filteredList = list.filter(l => l.path_label === p.pathType);
  }
  if (p.overall && p.overall !== '全部') {
    filteredList = list.filter(l => l.overall_rating === p.overall);
  }
  if (p.reviewStatus && p.reviewStatus !== '全部') {
    filteredList = list.filter(l => l.review_status === p.reviewStatus);
  }
  
  return {
    code: 0,
    data: {
      total: filteredList.length,
      page, pageSize,
      list: filteredList
    }
  };
}
```

#### action: getConversationDetail

```javascript
async function getConversationDetail(p) {
  const { conversationId } = p;
  if (!conversationId) return { code: 400, msg: '缺少 conversationId' };
  
  const log = await db.collection('conversation_logs').doc(conversationId).get();
  if (!log.data.length) return { code: 404, msg: '对话不存在' };
  
  const doc = log.data[0];
  
  // 并行获取review和correction
  const [reviewRes, correctionRes, profileRes] = await Promise.all([
    db.collection('conversation_reviews').where({ conversation_id: conversationId }).limit(1).get(),
    db.collection('conversation_corrections').where({ conversation_id: conversationId, status: 'approved' }).limit(1).get(),
    doc._openid ? db.collection('user_profiles').where({ _openid: doc._openid }).limit(1).get() : { data: [] }
  ]);
  
  // 组装messages（当前数据结构: 仅单轮query+response_preview）
  const messages = [
    { role: 'user', content: sanitize(doc.query || ''), tokens: 0 },
    { 
      role: 'assistant', 
      content: sanitize(doc.response_preview || ''), 
      tokens: doc.tokens?.total_tokens || 0,
      source_chunks: doc.source_chunks || null,  // P0-01: 存量数据为null
      safety_triggered: doc.safety_triggered || []
    }
  ];
  
  return {
    code: 0,
    data: {
      _id: doc._id,
      timestamp: doc.timestamp,
      _openid_prefix: doc._openid ? doc._openid.slice(0, 8) : 'unknown',
      path_label: profileRes.data[0]?.selectedPath || '未选择',
      messages,
      review: reviewRes.data[0] ? {
        scores: reviewRes.data[0].scores,
        overall: reviewRes.data[0].overall,
        error_tags: reviewRes.data[0].error_tags,
        note: reviewRes.data[0].note,
        reviewer: reviewRes.data[0].reviewer,
        reviewed_at: reviewRes.data[0].reviewed_at
      } : null,
      correction: correctionRes.data[0] ? {
        correct_answer: correctionRes.data[0].correct_answer,
        source_refs: correctionRes.data[0].source_refs,
        status: correctionRes.data[0].status,
        submitted_at: correctionRes.data[0].submitted_at
      } : null,
      is_test_data: (doc.session_id || '').startsWith('verify_')
    }
  };
}
```

#### action: submitReview

```javascript
async function submitReview(p, admin) {
  const { conversationId, scores, overall, errorTags, note } = p;
  
  // 参数校验
  if (!conversationId) return { code: 400, msg: '缺少 conversationId' };
  if (!scores || !overall) return { code: 400, msg: '缺少 scores/overall' };
  
  const { accuracy, completeness, compliance, usefulness } = scores;
  if ([accuracy, completeness, compliance, usefulness].some(v => v < 1 || v > 5)) {
    return { code: 400, msg: 'scores各维度必须在1-5之间' };
  }
  
  const totalScore = accuracy + completeness + compliance + usefulness;
  const rangeCheck = validateOverall(overall, totalScore);
  if (!rangeCheck.valid) {
    return { code: 400, msg: `overall "${overall}" 与总分 ${totalScore} 不匹配（期望范围: ${rangeCheck.expectedRange}）` };
  }
  
  // 检查对话是否存在
  const log = await db.collection('conversation_logs').doc(conversationId).get();
  if (!log.data.length) return { code: 404, msg: '对话不存在' };
  
  // 409: 同一人不可重复标记同一条
  const existing = await db.collection('conversation_reviews')
    .where({ conversation_id: conversationId, reviewer: admin.email }).limit(1).get();
  if (existing.data.length) return { code: 409, msg: '你已标记过这条对话' };
  
  // 写入
  const reviewDoc = {
    conversation_id: conversationId,
    reviewer: admin.email,
    scores: { accuracy, completeness, compliance, usefulness },
    total_score: totalScore,
    overall,
    error_tags: errorTags || [],
    note: (note || '').slice(0, 500),
    reviewed_at: new Date()
  };
  const result = await db.collection('conversation_reviews').add(reviewDoc);
  
  // 更新conversation_logs状态
  await db.collection('conversation_logs').doc(conversationId).update({
    review_status: 'reviewed',
    review_count: db.command.inc(1)
  });
  
  // 审计日志
  await auditLog('review_conversation', 'conversation_logs', conversationId, admin.email, 
    `标记为 ${overall}, 总分${totalScore}`);
  
  return { code: 0, data: { reviewId: result.id, total_score: totalScore } };
}
```

#### action: submitCorrection

```javascript
async function submitCorrection(p, admin) {
  const { conversationId, reviewId, correctAnswer, sourceRefs, correctionType } = p;
  
  // 参数校验
  if (!conversationId || !correctAnswer) return { code: 400, msg: '缺少必填字段' };
  if (correctAnswer.length > 2000) return { code: 400, msg: '正确答案限2000字' };
  
  // 合规扫描
  const scan = complianceScan(correctAnswer);
  if (!scan.pass) return { code: 400, msg: scan.reason };
  
  // 422: 前置条件——必须已有低分标记
  const review = await db.collection('conversation_reviews').doc(reviewId || '').get();
  if (!review.data.length) return { code: 404, msg: '标记不存在' };
  if (!['needs_improvement', 'wrong'].includes(review.data[0].overall)) {
    return { code: 422, msg: '仅低分标记(需改进/错误)可补充正确答案' };
  }
  
  // 409: 该对话不可有pending状态的correction
  const pending = await db.collection('conversation_corrections')
    .where({ conversation_id: conversationId, status: 'pending' }).limit(1).get();
  if (pending.data.length) return { code: 409, msg: '该对话已有待审核的正确答案' };
  
  // 写入
  const correctionDoc = {
    conversation_id: conversationId,
    review_id: reviewId,
    original_query: sanitize((await db.collection('conversation_logs').doc(conversationId).get()).data[0]?.query || '').slice(0, 80),
    original_response_summary: sanitize((await db.collection('conversation_logs').doc(conversationId).get()).data[0]?.response_preview || '').slice(0, 120),
    correct_answer: correctAnswer,
    source_refs: sourceRefs || [],
    correction_type: correctionType || 'factual_correction',
    submitted_by: admin.email,
    status: 'pending',
    submitted_at: new Date()
  };
  const result = await db.collection('conversation_corrections').add(correctionDoc);
  
  await auditLog('submit_correction', 'conversation_logs', conversationId, admin.email, 
    `提交正确答案, 类型: ${correctionType}`);
  
  return { code: 0, data: { correctionId: result.id, status: 'pending' } };
}

// 新增: approveCorrection (P0-03修复)
async function approveCorrection(p, admin) {
  const { correctionId } = p;
  if (!correctionId) return { code: 400, msg: '缺少 correctionId' };
  
  // 权限校验: 仅pm/super_admin可审核
  if (!['pm', 'super_admin'].includes(admin.role)) {
    return { code: 403, msg: '无审核权限' };
  }
  
  const corr = await db.collection('conversation_corrections').doc(correctionId).get();
  if (!corr.data.length) return { code: 404, msg: '正确答案不存在' };
  if (corr.data[0].status !== 'pending') return { code: 409, msg: '该正确答案已处理' };
  
  await db.collection('conversation_corrections').doc(correctionId).update({
    status: 'approved',
    reviewed_by: admin.email,
    approved_at: new Date()
  });
  
  await db.collection('conversation_logs').doc(corr.data[0].conversation_id).update({
    review_status: 'corrected',
    has_correction: true
  });
  
  await auditLog('approve_correction', 'conversation_corrections', correctionId, admin.email, '采纳正确答案');
  return { code: 0, data: { status: 'approved' } };
}

// 新增: rejectCorrection (P0-03修复)
async function rejectCorrection(p, admin) {
  const { correctionId, reason } = p;
  if (!correctionId) return { code: 400, msg: '缺少 correctionId' };
  if (!reason) return { code: 400, msg: '驳回必须填写原因' };
  
  if (!['pm', 'super_admin'].includes(admin.role)) {
    return { code: 403, msg: '无审核权限' };
  }
  
  const corr = await db.collection('conversation_corrections').doc(correctionId).get();
  if (!corr.data.length) return { code: 404, msg: '正确答案不存在' };
  if (corr.data[0].status !== 'pending') return { code: 409, msg: '该正确答案已处理' };
  
  await db.collection('conversation_corrections').doc(correctionId).update({
    status: 'rejected',
    reviewed_by: admin.email,
    rejection_reason: reason.slice(0, 200),
    approved_at: new Date()  // 实际为rejected_at，复用字段
  });
  
  // 回退conversation_logs状态
  await db.collection('conversation_logs').doc(corr.data[0].conversation_id).update({
    review_status: 'reviewed'
  });
  
  await auditLog('reject_correction', 'conversation_corrections', correctionId, admin.email, `驳回: ${reason.slice(0,100)}`);
  return { code: 0, data: { status: 'rejected' } };
}
```

---

## 五、前端实现规格

### 5.1 文件变更清单

| 文件 | 操作 | 说明 |
|------|:--:|------|
| `src/pages/AIQualityPage.tsx` | 修改 | 增加Tab切换 + 质量报告卡片 |
| `src/pages/ConversationReviewPanel.tsx` | **新建** | 对话审核主面板（列表+详情+标记+纠正） |
| `src/lib/api.ts` | 修改 | 新增4个API方法 |
| `src/types/index.ts` | 修改 | 新增7个类型定义 |
| `src/components/layout/Sidebar.tsx` | 不修改 | 不新增菜单项（使用Tab内嵌） |
| `src/App.tsx` | 不修改 | 不新增路由 |

### 5.2 新增TypeScript类型

```typescript
// src/types/index.ts 新增

export interface ConversationListItem {
  _id: string;
  timestamp: string;
  _openid_prefix: string;
  query_preview: string;
  model: string;
  round_count: number;
  duration_ms: number;
  review_status: 'unreviewed' | 'reviewed' | 'corrected';
  has_correction: boolean;
  overall_rating?: 'excellent' | 'good' | 'needs_improvement' | 'wrong';
  path_label?: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  tokens: number;
  source_chunks?: Array<{
    chunk_id: string;
    title: string;
    content_preview: string;
  }> | null;
  safety_triggered?: string[];
}

export interface ConversationDetail {
  _id: string;
  timestamp: string;
  _openid_prefix: string;
  path_label: string;
  messages: ConversationMessage[];
  review: ReviewRecord | null;
  correction: CorrectionRecord | null;
  is_test_data: boolean;
}

export interface ReviewScores {
  accuracy: number;
  completeness: number;
  compliance: number;
  usefulness: number;
}

export interface ReviewRecord {
  scores: ReviewScores;
  overall: string;
  error_tags: string[];
  note: string;
  reviewer: string;
  reviewed_at: string;
}

export interface CorrectionRecord {
  correct_answer: string;
  source_refs: string[];
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
}

export interface SubmitReviewParams {
  conversationId: string;
  scores: ReviewScores;
  overall: string;
  errorTags?: string[];
  note?: string;
}
```

### 5.3 新增API方法

```typescript
// src/lib/api.ts 新增

import type { PaginatedResponse, ConversationListItem, ConversationDetail } from '@/types';

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

### 5.4 组件树

```
AIQualityPage.tsx (修改)
├── TabBar: "质量总览" | "对话审核"
│
├── [Tab: 质量总览] 现有内容保留
│   ├── 4个MetricCard (总对话 / 安全事件 / 预估成本 / 总Tokens)
│   ├── 高频问题Top 20
│   └── 新增: 质量报告卡片
│       ├── 模型评分对比 (Hunyuan vs DeepSeek)
│       ├── 标注进度条 ("已标记 X/132")
│       └── 知识库盲区 Top 5
│
└── [Tab: 对话审核] → ConversationReviewPanel.tsx (新建)
    ├── 筛选栏 (日期/模型/状态/质量/路径)
    ├── ConversationList
    │   └── ConversationRow × N (时间/用户/摘要/模型/标记状态)
    └── ConversationDetail (选中展开, 同页左右布局)
        ├── 对话区: MessageBubble × N
        │   └── SourceChunkBadge × N (RAG来源标签)
        ├── ReviewForm
        │   ├── ScoreSlider × 4 (准确性/完整性/合规性/有用性)
        │   ├── OverallRadio (优秀/合格/需改进/错误)
        │   ├── ErrorTagCheckbox × 5
        │   └── NoteTextarea
        └── CorrectionEditor (条件渲染: overall ∈ {需改进,错误})
            ├── CorrectAnswerTextarea
            ├── SourceRefInput
            └── SubmitButton → status=pending
```

### 5.5 状态管理

不引入Redux/Zustand等状态库。使用React内置的 `useState` + `useCallback`，数据流为：

```
ConversationReviewPanel (父组件)
  ├── state: conversations[], selectedId, loading, filters
  │
  ├── ConversationList (展示)
  │   └── props: conversations, selectedId, onSelect
  │
  └── ConversationDetail (展示+交互)
      ├── props: detail, loading
      ├── 内部: reviewForm state, correctionText state
      └── 回调: onSubmitReview, onSubmitCorrection → 更新父组件 conversations[]
```

---

## 六、任务拆解

### 6.1 史诗级任务清单

| Epic | 描述 | SP | 依赖 |
|------|------|:--:|------|
| E1 | ai-chat云函数补偿字段 | 2 | — |
| E2 | conversation_reviews + conversation_corrections 集合创建 | 2 | — |
| E3 | admin-ai-quality 云函数扩展 (6 action) | 8 | E2 |
| E4 | AIQualityPage Tab改造 + 质量报告卡片 | 3 | — |
| E5 | ConversationReviewPanel (列表+详情+标记+纠正+审批) | 9 | E3 |
| E6 | 联调测试 + 验收 | 3 | E1-E5 |

**总SP: 27 | 预计工期: 7天**

### 6.2 Sprint级任务拆解

#### Sprint 0: 前置修复 (D0, 0.5天)

| ID | 任务 | SP | 负责人 | 交付物 |
|------|------|:--:|------|------|
| T-001 | 读取conversation_logs实际字段结构 | 0.5 | 后端 | 字段清单确认 |
| T-002 | admin_users新增测试运营账号 | 0.5 | 后端 | admin_users +1记录 |
| T-003 | 确认content-safety-check调用可行性 | 0.5 | 后端 | 方案确认 (内联/跨函数) |

#### Sprint 1: 数据层 + 后端 (D1-D2, 2天)

| ID | 任务 | SP | 负责人 | 交付物 |
|------|------|:--:|------|------|
| T-101 | ai-chat/index.js: 写入conversation_logs时增加source_chunks字段(4处调用点) | 2 | 后端 | 修改ai-chat云函数 |
| T-102 | 创建conversation_reviews集合 + 4个索引 | 1 | 后端 | 集合+索引 |
| T-103 | 创建conversation_corrections集合 + 3个索引 | 1 | 后端 | 集合+索引 |
| T-104 | conversation_logs新增review_status复合索引 | 0.5 | 后端 | 索引 |
| T-105 | admin-ai-quality: 提取validateApiKey + auditLog + complianceScan | 1 | 后端 | 云函数重构 |
| T-106 | admin-ai-quality: 实现listConversations action | 2 | 后端 | listConversations可用 |
| T-107 | admin-ai-quality: 实现getConversationDetail action | 2 | 后端 | getConversationDetail可用 |
| T-108 | 部署admin-ai-quality + 网关验证 | 0.5 | 后端 | 4个新action可调通 |

#### Sprint 2: 前端核心 (D3-D4, 2天)

| ID | 任务 | SP | 负责人 | 交付物 |
|------|------|:--:|------|------|
| T-201 | types/index.ts 新增7个类型定义 | 0.5 | 前端 | 类型文件 |
| T-202 | api.ts 新增4个API方法 | 0.5 | 前端 | API方法 |
| T-203 | AIQualityPage.tsx Tab改造 | 1 | 前端 | Tab切换可用 |
| T-204 | ConversationReviewPanel: 筛选栏 + ConversationList | 2 | 前端 | 列表页可用 |
| T-205 | ConversationReviewPanel: ConversationDetail对话区 | 2 | 前端 | 详情展开可用 |
| T-206 | ConversationReviewPanel: ReviewForm四维评分器 | 2 | 前端 | 标记提交可用 |

#### Sprint 3: 前端交互 + 审批 + 报告 (D5-D6, 2天)

| ID | 任务 | SP | 负责人 | 交付物 |
|------|------|:--:|------|------|
| T-301 | ConversationReviewPanel: CorrectionEditor | 1.5 | 前端 | 正确答案编辑器 |
| T-305 | admin-ai-quality: 实现approveCorrection action | 1.5 | 后端 | approveCorrection可用 |
| T-306 | admin-ai-quality: 实现rejectCorrection action | 1.5 | 后端 | rejectCorrection可用 |
| T-307 | ConversationReviewPanel: 审批面板（采纳/驳回按钮+驳回原因） | 1 | 前端 | 审批面板可用 |
| T-302 | 质量报告卡片（AIQualityPage Tab1增强） | 1 | 前端 | 报告卡片 |
| T-303 | 键盘快捷键 + 快速审核模式 | 1 | 前端 | 快捷键可用 |
| T-304 | 错误状态处理（空数据/加载/异常/脱敏空） | 1 | 前端 | 错误状态覆盖 |

#### Sprint 4: 联调验收 (D6-D7, 1天)

| ID | 任务 | SP | 负责人 | 交付物 |
|------|------|:--:|------|------|
| T-401 | 前后端联调（list + detail + submit） | 2 | 全栈 | 联调通过 |
| T-402 | PII脱敏验证 | 0.5 | 测试 | 脱敏测试通过 |
| T-403 | 权限验证（cs无标记权限等） | 0.5 | 测试 | 权限测试通过 |
| T-404 | E2E：浏览→标记→纠正 全流程 | 1 | 测试 | E2E通过 |

### 6.3 关键路径

```
T-101 (ai-chat补偿字段, 3SP)
  └→ T-107 (getConversationDetail依赖source_chunks)
       └→ T-205 (前端详情区)
            └→ T-206 (ReviewForm)
                 └→ T-301 (CorrectionEditor)
                      └→ T-404 (E2E全流程)

关键路径总SP: 13SP (占总量54%)
```

---

## 七、测试策略

### 7.1 单元测试（云函数）

```javascript
// cloudfunctions/admin-ai-quality/__tests__/admin-ai-quality.test.js

describe('admin-ai-quality 新增action', () => {
  describe('listConversations', () => {
    it('应返回分页对话列表');
    it('应按model筛选');
    it('应按日期范围筛选');
    it('应返回脱敏后的query_preview');
    it('应关联user_profiles获取path_label');
    it('无对话时应返回空列表');
  });

  describe('getConversationDetail', () => {
    it('应返回完整对话详情');
    it('不存在的conversationId应返回404');
    it('应并行获取review和correction');
    it('source_chunks为null时应正常返回');
    it('应标记is_test_data=true对于verify_前缀session');
  });

  describe('submitReview', () => {
    it('应成功提交四维评分');
    it('overall与total_score不匹配时应返回400');
    it('scores超范围(0或6)应返回400');
    it('重复标记同一条应返回409');
    it('应写入audit_log');
    it('应更新conversation_logs.review_status');
  });

  describe('submitCorrection', () => {
    it('应成功提交正确答案');
    it('合规扫描不通过应返回400');
    it('无低分标记应返回422');
    it('已有pending的correction应返回409');
    it('正确答案超2000字应返回400');
  });

  describe('complianceScan', () => {
    it('应拦截自残相关关键词');
    it('应拦截武器制造关键词');
    it('应拦截"移民"字眼');
    it('应拦截"投资移民"字眼');
    it('"移民局"不应被误拦');
  });
});
```

### 7.2 集成测试关键场景

| 场景 | 步骤 | 期望 |
|------|------|------|
| 浏览→标记→纠正完整流程 | 打开列表→筛选→点击对话→评分→提交→补充答案 | 全流程无报错 |
| PII脱敏验证 | 查找含手机号/证件号/邮箱的对话 | 内容已被替换 |
| 权限矩阵 | cs角色访问标记功能 | 提交被拒绝 |
| 并发标记 | 2人同时标记不同对话 | 互不冲突 |

---

## 八、部署计划

### 8.1 部署顺序

1. **数据库**: 创建2个新集合 + 创建4个索引 (无停机)
2. **ai-chat云函数**: 更新代码，部署新版本 (影响: 新对话开始记录source_chunks+_openid)
3. **admin-ai-quality云函数**: 更新代码，部署新版本 (影响: 新增4个action可用)
4. **前端构建**: `npm run build` → 上传到静态托管 `/admin/`

### 8.2 回滚方案

- 云函数: 保留旧版本，新版本异常时通过CloudBase控制台回滚
- 数据库: 新集合只增不删，回滚时仅需断开前端引用
- 前端: 重新上传旧版本dist

---

## 九、附录

### A. 文件变更总量

| 类型 | 新建 | 修改 | 不变 |
|------|:--:|:--:|:--:|
| 云函数 | 0 | 2 (ai-chat, admin-ai-quality) | 7 |
| 前端页面/组件 | 1 (ConversationReviewPanel) | 1 (AIQualityPage) | 20+ |
| 前端lib/types | 0 | 2 (api.ts, types/index.ts) | — |
| 数据库集合 | 2 | 1 (conversation_logs扩展) | 47 |
| 路由/Sidebar | 0 | 0 | — |

### B. 性能预估

| 操作 | 数据量级 | 预估耗时 |
|------|------|:--:|
| listConversations (首页) | 132条 | <500ms |
| listConversations (含path筛选) | 132条 + 关联查询 | <800ms |
| getConversationDetail | 单条 + 2关联查询 | <300ms |
| submitReview | 单次写入 + 1更新 + 1审计 | <200ms |
| submitCorrection | 合规扫描 + 1写入 + 1审计 | <300ms |

### C. 变更记录

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-05-22 | 初始版本，基于PRD v1.0 + 玄武审查报告 |
| v1.1 | 2026-05-22 | 吸收麒麟审查3P0：_openid字段名修正、ai-chat行号指引、审批流补全(approveCorrection/rejectCorrection)；SP 24→27，工期6.5→7天 |
