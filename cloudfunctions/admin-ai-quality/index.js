// 住港伴 V4 — admin-ai-quality: AI质量监控 + 对话审核反馈后台 (V4.2)
// response_preview 绝对禁止原始返回 — P0-05: getConversationDetail已做sanitize脱敏
const cloudbase = require('@cloudbase/node-sdk');
const crypto = require('crypto');
const app = cloudbase.init({ env: 'cloudbase-d1g17tgt7cc199a60' });
const db = app.database();
const _ = db.command;

function sha256(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}
function sanitize(s) {
  return (s || '')
    .replace(/1[3-9]\d{9}/g, '[手机号]')
    .replace(/[A-Z]\d{6,8}/g, '[证件号]')
    .replace(/[\w.-]+@[\w.-]+/g, '[邮箱]');
}

// ====== 鉴权 ======
async function validateApiKey(apiKey) {
  if (!apiKey) return null;
  const kh = sha256(apiKey);
  const adm = await db.collection('admin_users').where({ apiKeyHash: kh, status: 'active' }).limit(1).get();
  return adm.data.length ? adm.data[0] : null;
}

// ====== 审计日志 ======
async function auditLog(action, targetType, targetId, operator, detail) {
  try {
    await db.collection('admin_audit_trail').add({
      action,
      targetType,
      targetId,
      operator,
      detail: sanitize(String(detail).slice(0, 200)),
      timestamp: new Date(),
    });
  } catch (_) {}
}

// ====== 合规扫描 ======
const BLOCKED_PATTERNS = [
  /自[杀残害]|自我了断|如何.*[死杀]|结束.*生命/i,
  /制造.*[枪炸弹]|武器.*制作|爆炸.*方法/i,
  /儿童.*色情|未成年.*性/i,
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

// ====== 评分校验 ======
const OVERALL_RANGES = { excellent: [18, 20], good: [12, 17], needs_improvement: [8, 11], wrong: [4, 7] };
function validateOverall(overall, totalScore) {
  const [min, max] = OVERALL_RANGES[overall] || [0, 0];
  if (totalScore < min || totalScore > max) return { valid: false, expectedRange: `${min}-${max}`, actual: totalScore };
  return { valid: true };
}

// ====== 现有4个action ======
async function aiDashboard(p) {
  const days = p.days || 7;
  const [convCnt, safetyCnt, costSum] = await Promise.all([
    db.collection('conversation_logs').count(),
    db
      .collection('conversation_logs')
      .where({ 'safety_triggered.0': _.neq(null) })
      .count(),
    db.collection('conversation_logs').get(),
  ]);
  let totalCost = 0;
  let totalTokens = 0;
  (costSum.data || []).forEach((c) => {
    totalTokens += (c.tokens || {}).total_tokens || 0;
  });
  totalCost = Math.round((totalTokens / 1000000) * 0.14 * 100) / 100;
  return {
    code: 0,
    data: { conversations: convCnt.total, safetyEvents: safetyCnt.total, estimatedCostRMB: totalCost, totalTokens },
  };
}

async function accuracyTrend(p) {
  const evals = await db
    .collection('eval_results')
    .orderBy('createdAt', 'desc')
    .limit(p.days || 30)
    .get();
  const byDay = {};
  (evals.data || []).forEach((e) => {
    const d = (e.createdAt || '').toString().slice(0, 10);
    if (!byDay[d]) byDay[d] = { scores: [], count: 0 };
    byDay[d].scores.push(e.score || 0);
    byDay[d].count++;
  });
  const trend = Object.entries(byDay).map(([date, v]) => ({
    date,
    avgAccuracy: Math.round(v.scores.reduce((a, b) => a + b, 0) / v.scores.length),
    count: v.count,
  }));
  return { code: 0, data: trend };
}

async function topQueries(p) {
  const logs = await db.collection('conversation_logs').orderBy('timestamp', 'desc').limit(100).get();
  const queries = {};
  (logs.data || []).forEach((l) => {
    const q = sanitize(l.query || '').slice(0, 40);
    if (q) queries[q] = (queries[q] || 0) + 1;
  });
  const top = Object.entries(queries)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([q, c]) => ({ query: q, count: c }));
  return { code: 0, data: top };
}

async function safetyEvents(p) {
  const logs = await db
    .collection('conversation_logs')
    .where({ 'safety_triggered.0': _.neq(null) })
    .orderBy('timestamp', 'desc')
    .limit(50)
    .get();
  return {
    code: 0,
    data: (logs.data || []).map((l) => ({
      time: l.timestamp,
      query: sanitize(l.query || '').slice(0, 60),
      triggers: l.safety_triggered,
    })),
  };
}

// ====== V4.2 新增: 对话审核 ======

// listConversations — 分页对话列表
async function listConversations(p) {
  const page = Math.max(1, p.page || 1);
  const pageSize = Math.min(50, Math.max(1, p.pageSize || 20));

  const where = {};
  if (p.model) where.model = p.model;
  if (p.dateFrom || p.dateTo) {
    where.timestamp = {};
    if (p.dateFrom) where.timestamp['$gte'] = new Date(p.dateFrom).getTime();
    if (p.dateTo) where.timestamp['$lte'] = new Date(p.dateTo + 'T23:59:59').getTime();
  }

  const totalResult = await db
    .collection('conversation_logs')
    .where(Object.keys(where).length ? where : {})
    .count();
  const logs = await db
    .collection('conversation_logs')
    .where(Object.keys(where).length ? where : {})
    .orderBy('timestamp', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();

  const ids = logs.data.map((l) => l._id);
  const openids = [...new Set(logs.data.map((l) => l._openid).filter(Boolean))];

  const [reviews, profiles] = await Promise.all([
    ids.length
      ? db
          .collection('conversation_reviews')
          .where({ conversation_id: _.in(ids) })
          .get()
      : { data: [] },
    openids.length
      ? db
          .collection('user_profiles')
          .where({ _openid: _.in(openids) })
          .get()
      : { data: [] },
  ]);

  const reviewMap = {};
  reviews.data.forEach((r) => {
    reviewMap[r.conversation_id] = r;
  });
  const profileMap = {};
  profiles.data.forEach((p) => {
    profileMap[p._openid] = p;
  });

  let filteredList = logs.data.map((l) => {
    const review = reviewMap[l._id];
    return {
      _id: l._id,
      timestamp: l.timestamp,
      _openid_prefix: l._openid ? l._openid.slice(0, 8) : 'unknown',
      query_preview: sanitize(l.query || '').slice(0, 60),
      model: l.model || 'unknown',
      round_count: 1,
      duration_ms: l.latency_ms || 0,
      review_status: review ? (l.has_correction ? 'corrected' : 'reviewed') : l.review_status || 'unreviewed',
      has_correction: !!l.has_correction,
      overall_rating: review ? review.overall : undefined,
      path_label: l._openid && profileMap[l._openid] ? profileMap[l._openid].selectedPath || '未选择' : undefined,
    };
  });

  // 内存筛选
  if (p.pathType) filteredList = filteredList.filter((l) => l.path_label === p.pathType);
  if (p.overall) filteredList = filteredList.filter((l) => l.overall_rating === p.overall);
  if (p.reviewStatus) filteredList = filteredList.filter((l) => l.review_status === p.reviewStatus);

  return { code: 0, data: { total: filteredList.length, page, pageSize, list: filteredList } };
}

// getConversationDetail — 对话详情+标记+纠正
async function getConversationDetail(p) {
  const { conversationId } = p;
  if (!conversationId) return { code: 400, msg: '缺少 conversationId' };

  const log = await db.collection('conversation_logs').doc(conversationId).get();
  if (!log.data.length) return { code: 404, msg: '对话不存在' };
  const doc = log.data[0];

  const [reviewRes, correctionRes, profileRes] = await Promise.all([
    db.collection('conversation_reviews').where({ conversation_id: conversationId }).limit(1).get(),
    db
      .collection('conversation_corrections')
      .where({ conversation_id: conversationId, status: 'approved' })
      .limit(1)
      .get(),
    doc._openid ? db.collection('user_profiles').where({ _openid: doc._openid }).limit(1).get() : { data: [] },
  ]);

  const messages = [
    { role: 'user', content: sanitize(doc.query || ''), tokens: 0 },
    {
      role: 'assistant',
      content: sanitize(doc.response_preview || ''),
      tokens: doc.tokens?.total_tokens || 0,
      source_chunks: doc.source_chunks || null,
      safety_triggered: doc.safety_triggered || [],
    },
  ];

  return {
    code: 0,
    data: {
      _id: doc._id,
      timestamp: doc.timestamp,
      _openid_prefix: doc._openid ? doc._openid.slice(0, 8) : 'unknown',
      path_label: profileRes.data[0]?.selectedPath || '未选择',
      messages,
      review: reviewRes.data[0]
        ? {
            scores: reviewRes.data[0].scores,
            overall: reviewRes.data[0].overall,
            error_tags: reviewRes.data[0].error_tags,
            note: reviewRes.data[0].note,
            reviewer: reviewRes.data[0].reviewer,
            reviewed_at: reviewRes.data[0].reviewed_at,
          }
        : null,
      correction: correctionRes.data[0]
        ? {
            correct_answer: correctionRes.data[0].correct_answer,
            source_refs: correctionRes.data[0].source_refs,
            status: correctionRes.data[0].status,
            submitted_at: correctionRes.data[0].submitted_at,
          }
        : null,
      is_test_data: (doc.session_id || '').startsWith('verify_'),
    },
  };
}

// submitReview — 提交质量标记
async function submitReview(p, admin) {
  const { conversationId, scores, overall, errorTags, note } = p;
  if (!conversationId || !scores || !overall) return { code: 400, msg: '缺少必填字段' };

  const { accuracy, completeness, compliance, usefulness } = scores;
  if ([accuracy, completeness, compliance, usefulness].some((v) => v < 1 || v > 5)) {
    return { code: 400, msg: 'scores各维度必须在1-5之间' };
  }

  const totalScore = accuracy + completeness + compliance + usefulness;
  const rangeCheck = validateOverall(overall, totalScore);
  if (!rangeCheck.valid) {
    return {
      code: 400,
      msg: `overall "${overall}" 与总分 ${totalScore} 不匹配（期望范围: ${rangeCheck.expectedRange}）`,
    };
  }

  const log = await db.collection('conversation_logs').doc(conversationId).get();
  if (!log.data.length) return { code: 404, msg: '对话不存在' };

  const existing = await db
    .collection('conversation_reviews')
    .where({ conversation_id: conversationId, reviewer: admin.email })
    .limit(1)
    .get();
  if (existing.data.length) return { code: 409, msg: '你已标记过这条对话' };

  const result = await db.collection('conversation_reviews').add({
    conversation_id: conversationId,
    reviewer: admin.email,
    scores: { accuracy, completeness, compliance, usefulness },
    total_score: totalScore,
    overall,
    error_tags: errorTags || [],
    note: (note || '').slice(0, 500),
    reviewed_at: new Date(),
  });

  await db
    .collection('conversation_logs')
    .doc(conversationId)
    .update({
      review_status: 'reviewed',
      review_count: _.inc(1),
    });

  await auditLog(
    'review_conversation',
    'conversation_logs',
    conversationId,
    admin.email,
    `标记为 ${overall}, 总分${totalScore}`,
  );
  return { code: 0, data: { reviewId: result.id, total_score: totalScore } };
}

// submitCorrection — 提交正确答案
async function submitCorrection(p, admin) {
  const { conversationId, reviewId, correctAnswer, sourceRefs, correctionType } = p;
  if (!conversationId || !correctAnswer) return { code: 400, msg: '缺少必填字段' };
  if (correctAnswer.length > 2000) return { code: 400, msg: '正确答案限2000字' };

  const scan = complianceScan(correctAnswer);
  if (!scan.pass) return { code: 400, msg: scan.reason };

  const review = await db
    .collection('conversation_reviews')
    .doc(reviewId || '')
    .get();
  if (!review.data.length) return { code: 404, msg: '标记不存在' };
  if (!['needs_improvement', 'wrong'].includes(review.data[0].overall)) {
    return { code: 422, msg: '仅低分标记(需改进/错误)可补充正确答案' };
  }

  const pending = await db
    .collection('conversation_corrections')
    .where({ conversation_id: conversationId, status: 'pending' })
    .limit(1)
    .get();
  if (pending.data.length) return { code: 409, msg: '该对话已有待审核的正确答案' };

  const logDoc = await db.collection('conversation_logs').doc(conversationId).get();
  const doc = logDoc.data[0] || {};

  const result = await db.collection('conversation_corrections').add({
    conversation_id: conversationId,
    review_id: reviewId,
    original_query: sanitize(doc.query || '').slice(0, 80),
    original_response_summary: sanitize(doc.response_preview || '').slice(0, 120),
    correct_answer: correctAnswer,
    source_refs: sourceRefs || [],
    correction_type: correctionType || 'factual_correction',
    submitted_by: admin.email,
    status: 'pending',
    submitted_at: new Date(),
  });

  await auditLog(
    'submit_correction',
    'conversation_logs',
    conversationId,
    admin.email,
    `提交正确答案, 类型: ${correctionType}`,
  );
  return { code: 0, data: { correctionId: result.id, status: 'pending' } };
}

// approveCorrection — 采纳正确答案 (P0-03)
async function approveCorrection(p, admin) {
  const { correctionId } = p;
  if (!correctionId) return { code: 400, msg: '缺少 correctionId' };
  if (!['pm', 'super_admin'].includes(admin.role)) return { code: 403, msg: '无审核权限' };

  const corr = await db.collection('conversation_corrections').doc(correctionId).get();
  if (!corr.data.length) return { code: 404, msg: '正确答案不存在' };
  if (corr.data[0].status !== 'pending') return { code: 409, msg: '该正确答案已处理' };

  await db.collection('conversation_corrections').doc(correctionId).update({
    status: 'approved',
    reviewed_by: admin.email,
    approved_at: new Date(),
  });
  await db.collection('conversation_logs').doc(corr.data[0].conversation_id).update({
    review_status: 'corrected',
    has_correction: true,
  });
  await auditLog('approve_correction', 'conversation_corrections', correctionId, admin.email, '采纳正确答案');
  return { code: 0, data: { status: 'approved' } };
}

// ====== Phase 3: 看板API — 对话漏斗 ======
async function conversationFunnel(p) {
  const days = p.days || 7;
  const since = new Date(Date.now() - days * 86400000);
  const col = db.collection('conversation_logs');
  const fbCol = db.collection('conversation_feedback');
  const total = await col.where({ timestamp: _.gte(since) }).count();
  return {
    code: 200,
    data: {
      stages: [
        { name: '总请求', count: total.total || 0 },
        { name: 'LLM调用', count: total.total || 0 },
        { name: '流式完成', count: total.total || 0 },
        { name: '反馈提交', count: (await fbCol.where({ timestamp: _.gte(since) }).count()).total || 0 },
        {
          name: '差评复核',
          count: (await fbCol.where({ timestamp: _.gte(since), feedback: 'inaccurate' }).count()).total || 0,
        },
      ],
    },
  };
}

// ====== Phase 3: 看板API — 用户画像分布 ======
async function profileAnalytics(p) {
  const days = p.days || 7;
  const since = new Date(Date.now() - days * 86400000);
  const col = db.collection('conversation_logs');
  const modes = ['general', 'qa', 'assessment', 'solution_recommend'];
  const modeData = [];
  for (let i = 0; i < modes.length; i++) {
    const m = modes[i];
    const cnt = await col.where({ mode: m, timestamp: _.gte(since) }).count();
    modeData.push({ dimension: '对话模式', value: m, count: cnt.total || 0 });
  }
  return { code: 200, data: { modeDistribution: modeData, totalUsers: 0 } };
}

// ====== Phase 3: 看板API — 反馈闭环 ======
async function feedbackLoop(p) {
  const days = p.days || 7;
  const since = new Date(Date.now() - days * 86400000);
  const fb = db.collection('conversation_feedback');
  const total = await fb.where({ timestamp: _.gte(since) }).count();
  const inaccurate = await fb.where({ timestamp: _.gte(since), feedback: 'inaccurate' }).count();
  const safety = await fb.where({ timestamp: _.gte(since), feedback: 'safety' }).count();
  return {
    code: 200,
    data: {
      stages: [
        { name: '总反馈', count: total.total || 0 },
        { name: '回答不准确', count: inaccurate.total || 0 },
        { name: '可能泄露信息', count: safety.total || 0 },
        { name: '日均反馈', count: Math.round((total.total || 0) / Math.max(1, days)) },
      ],
      rate: { inaccurateRate: total.total ? Math.round((inaccurate.total / total.total) * 100) : 0 },
    },
  };
}

// rejectCorrection — 驳回正确答案 (P0-03)
async function rejectCorrection(p, admin) {
  const { correctionId, reason } = p;
  if (!correctionId || !reason) return { code: 400, msg: '缺少 correctionId/reason' };
  if (!['pm', 'super_admin'].includes(admin.role)) return { code: 403, msg: '无审核权限' };

  const corr = await db.collection('conversation_corrections').doc(correctionId).get();
  if (!corr.data.length) return { code: 404, msg: '正确答案不存在' };
  if (corr.data[0].status !== 'pending') return { code: 409, msg: '该正确答案已处理' };

  await db
    .collection('conversation_corrections')
    .doc(correctionId)
    .update({
      status: 'rejected',
      reviewed_by: admin.email,
      rejection_reason: reason.slice(0, 200),
      approved_at: new Date(),
    });
  await db.collection('conversation_logs').doc(corr.data[0].conversation_id).update({ review_status: 'reviewed' });
  await auditLog(
    'reject_correction',
    'conversation_corrections',
    correctionId,
    admin.email,
    `驳回: ${reason.slice(0, 100)}`,
  );
  return { code: 0, data: { status: 'rejected' } };
}

// ====== 主入口 ======
exports.main = async (event) => {
  let body = event;
  if (event.body && typeof event.body === 'string') {
    try {
      body = JSON.parse(event.body);
    } catch (_) {}
  }
  const { action, params = {}, _apiKey } = body;

  const admin = await validateApiKey(_apiKey);
  if (!admin) return { code: 401, msg: '无效的 API Key' };

  try {
    switch (action) {
      case 'getAIDashboard':
        return aiDashboard(params);
      case 'getAccuracyTrend':
        return accuracyTrend(params);
      case 'getTopQueries':
        return topQueries(params);
      case 'getSafetyEvents':
        return safetyEvents(params);
      case 'listConversations':
        return listConversations(params); // V4.2
      case 'getConversationDetail':
        return getConversationDetail(params); // V4.2
      case 'submitReview':
        return submitReview(params, admin); // V4.2
      case 'submitCorrection':
        return submitCorrection(params, admin); // V4.2
      case 'approveCorrection':
        return approveCorrection(params, admin); // V4.2 P0-03
      case 'rejectCorrection':
        return rejectCorrection(params, admin); // V4.2 P0-03
      // Phase 3: 3基础看板API
      case 'getConversationFunnel':
        return conversationFunnel(params);
      case 'getProfileAnalytics':
        return profileAnalytics(params);
      case 'getFeedbackLoop':
        return feedbackLoop(params);
      default:
        return { code: 400, msg: '无效操作: ' + action };
    }
  } catch (err) {
    return { code: 500, msg: err.message };
  }
};
