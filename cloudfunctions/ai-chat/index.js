/**
 * 住港伴 v5.0 — AI 对话云函数 (ai-chat) 重大升级
 *
 * v5.0 改进:
 *   - RAG知识库集成: 每次对话前检索 knowledge_chunks
 *   - 多轮对话: 接受并利用对话历史
 *   - 流式响应: 支持 SSE streaming (HTTP trigger)
 *   - K2安全护栏: 注入禁止规则 + 检索后过滤
 *   - 对话日志: 记录每次对话的质量与安全标记
 *   - 三级降级: LLM → RAG直返 → 缓存响应
 *
 * 输入 (标准模式): { sessionId, message, mode, context, history }
 * 输入 (流式模式): HTTP POST with same JSON body
 * 输出 (标准): { code, data: { messageId, content, quickReplies, assessmentResult, sources } }
 * 输出 (流式): SSE stream
 *
 * 环境变量:
 *   DEEPSEEK_API_KEY  - DeepSeek API 密钥
 *   DEEPSEEK_MODEL    - 模型名称（默认 deepseek-chat）
 *   ENV_ID            - CloudBase 环境ID
 */
const cloudbase = require('@cloudbase/node-sdk');
const https = require('https');
const { URL } = require('url');
const prompts = require('./prompts');

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';
const MAX_HISTORY_TURNS = 10;
const RAG_TOP_K = 5;
const RAG_PREFILTER_MULTIPLIER = 5;

// ========== CloudBase 初始化 ==========
let db = null;
function getDb() {
  if (!db) {
    const app = cloudbase.init({ env: process.env.ENV_ID });
    db = app.database();
  }
  return db;
}

// ========== K2 安全过滤规则 ==========
const FORBIDDEN_PATTERNS = [
  /圆角边框|全息防伪|光变油墨|微缩文字|安全线/,
  /防伪特征|安全特征|anti-counterfeiting/i,
  /AES-256|PBKDF2|WASM沙箱|客户端加密/,
  /Canny|边缘检测|轮廓近似|OCR模型/,
  /校验位算法|MOD\s*11|checksum/,
  /vault_mode|privacy_level|validation_rules/,
];

function scanForK2Leak(text) {
  if (!text) return [];
  const triggered = [];
  for (let i = 0; i < FORBIDDEN_PATTERNS.length; i++) {
    if (FORBIDDEN_PATTERNS[i].test(text)) {
      triggered.push('K2_RULE_' + (i + 1));
    }
  }
  return triggered;
}

// ========== 中文分词（内联 jieba + n-gram fallback） ==========
let jieba = null;
try { jieba = require('nodejieba'); } catch(e) {}

function tokenize(text) {
  if (!text) return [];
  if (jieba) {
    try {
      return jieba.cut(text).filter(t => t.trim().length > 0);
    } catch(e) {}
  }
  return fallbackTokenize(text);
}

function fallbackTokenize(text) {
  const lower = text.toLowerCase();
  const tokens = [];
  const parts = lower.split(/\s+/);
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.length === 0) continue;
    if (/[一-鿿]/.test(part)) {
      for (let j = 0; j < part.length - 1; j++) {
        tokens.push(part.substring(j, j + 2));
      }
    } else {
      tokens.push(part);
    }
  }
  return tokens.filter(t => t.length > 0);
}

// ========== Phase 2.4: RAG 缓存 ==========
var ragCache = {};
var RAG_CACHE_TTL = 5 * 60 * 1000; // 5分钟

function getCacheKey(query, mode) {
  return (mode || 'general') + '::' + query.trim().toLowerCase();
}

function getCachedRAG(query, mode) {
  var key = getCacheKey(query, mode);
  var entry = ragCache[key];
  if (entry && (Date.now() - entry.ts) < RAG_CACHE_TTL) {
    return entry.data;
  }
  return null;
}

function setCachedRAG(query, mode, data) {
  var key = getCacheKey(query, mode);
  ragCache[key] = { ts: Date.now(), data: data };
  // 限制缓存大小
  var keys = Object.keys(ragCache);
  if (keys.length > 100) {
    var oldest = keys.sort(function(a, b) { return ragCache[a].ts - ragCache[b].ts; });
    for (var i = 0; i < 20; i++) delete ragCache[oldest[i]];
  }
}

// ========== HTTP 工具 ==========
function httpPostJson(url, body, headers, timeoutMs) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      method: 'POST',
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: Object.assign({
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body, 'utf8')
      }, headers || {}),
      timeout: timeoutMs || 20000
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          text: async () => data,
          json: async () => JSON.parse(data)
        });
      });
    });
    req.on('timeout', () => {
      req.destroy(new Error('Request timeout after ' + (timeoutMs || 20000) + 'ms'));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ========== RAG 检索 ==========
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function scoreByKeywords(chunks, keywords) {
  return chunks.map(c => {
    const contentLower = (c.content || '').toLowerCase();
    const titleLower = (c.source_title || '').toLowerCase();
    let score = 0;
    for (let i = 0; i < keywords.length; i++) {
      const esc = keywords[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(esc, 'gi');
      score += ((contentLower.match(regex) || []).length);
      score += ((titleLower.match(regex) || []).length) * 3;
    }
    return { chunk: c, score };
  }).sort((a, b) => b.score - a.score);
}

async function retrieveContext(query, mode, topK) {
  topK = topK || RAG_TOP_K;

  // Phase 2.4: 缓存优先
  var cached = getCachedRAG(query, mode);
  if (cached) {
    console.log('[ai-chat] RAG cache hit');
    return cached;
  }

  const ddb = getDb();
  const _ = ddb.command;

  // 构建领域过滤
  const where = { content_grade: _.in(['green', 'yellow']) };
  if (mode === 'assessment') {
    where.knowledge_domain = _.in(['QMAS', 'TTPS', 'ASMTP', 'IANG', 'CIES']);
  } else if (mode === 'solution_recommend') {
    where.knowledge_domain = _.in(['QMAS', 'TTPS', 'ASMTP', 'IANG', 'CIES', 'TechTAS']);
  }

  const keywords = tokenize(query);
  const fetchLimit = Math.min(topK * RAG_PREFILTER_MULTIPLIER, 500);
  let allChunks = [];

  try {
    // 关键词预筛: 构建content正则OR查询，最多用前5个关键词
    if (keywords.length > 0) {
      try {
        const keywordConditions = keywords.slice(0, 5).map(function(kw) {
          const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          return { content: ddb.RegExp({ regexp: escaped, options: 'i' }) };
        });
        const combinedWhere = _.and(where, _.or(keywordConditions));
        const res = await ddb.collection('knowledge_chunks')
          .where(combinedWhere)
          .limit(fetchLimit)
          .field({
            content: true, source_title: true, source_url: true,
            knowledge_domain: true, confidence: true, content_grade: true,
            embedding: true
          })
          .get();
        allChunks = res.data || [];
      } catch(e) {
        console.warn('[ai-chat] RAG keyword prefilter failed, falling back to batch:', e.message);
        allChunks = await fetchBatch(ddb, where, fetchLimit);
      }
    } else {
      allChunks = await fetchBatch(ddb, where, fetchLimit);
    }
  } catch(e) {
    console.error('[ai-chat] RAG retrieval error:', e.message);
    return { chunks: [], sources: [] };
  }

  if (allChunks.length === 0) {
    return { chunks: [], sources: [] };
  }

  // 关键词评分排序
  let scored;
  if (keywords.length > 0) {
    scored = scoreByKeywords(allChunks, keywords);
  } else {
    scored = allChunks.map(c => ({ chunk: c, score: 1 }));
  }

  // 如果有embedding，向量重排（对top 2x进行）
  const candidates = scored.filter(s => s.score > 0).slice(0, topK * 2);

  // 对高分候选进行K2安全过滤
  const safeCandidates = candidates.filter(s => {
    const leaks = scanForK2Leak(s.chunk.content);
    return leaks.length === 0;
  });

  const top = safeCandidates.slice(0, topK);

  // 构建格式化输出
  const sources = [];
  const seen = new Set();
  top.forEach(s => {
    const title = s.chunk.source_title || '';
    const url = s.chunk.source_url || '';
    if (title && !seen.has(title)) {
      seen.add(title);
      sources.push({ title, url, confidence: s.chunk.confidence || 'C', domain: s.chunk.knowledge_domain });
    }
  });

  const contextText = top.length > 0
    ? '\n\n[参考知识库——基于以下内容回答，标注来源]\n' +
      top.map((s, i) =>
        `[来源${i + 1}] ${s.chunk.source_title || '未知来源'} (置信度:${s.chunk.confidence || 'C'})\n${s.chunk.content}`
      ).join('\n\n')
    : '';

  var result = { chunks: top.map(s => s.chunk), sources, contextText };

  // Phase 2.4: 缓存写入
  if (top.length > 0) {
    setCachedRAG(query, mode, result);
  }

  return result;
}

async function fetchBatch(ddb, where, maxItems) {
  const fieldSpec = {
    content: true, source_title: true, source_url: true,
    knowledge_domain: true, confidence: true, content_grade: true,
    embedding: true
  };
  let all = [], offset = 0;
  const batchSize = Math.min(maxItems, 200);
  const maxBatches = Math.ceil(maxItems / batchSize);
  for (let b = 0; b < maxBatches; b++) {
    const res = await ddb.collection('knowledge_chunks')
      .where(where).skip(offset).limit(batchSize).field(fieldSpec).get();
    if (!res.data || res.data.length === 0) break;
    all = all.concat(res.data);
    offset += batchSize;
  }
  return all;
}

// ========== LLM 调用 ==========
function buildDeepSeekRequest(messages, mode, contextText, streamMode, sessionContext) {
  const systemPrompt = prompts.getSystemPrompt(mode, sessionContext);

  // Phase 3: 注入主动对话提示 + 自适应回答风格
  const proactiveHint = prompts.buildProactiveHint(sessionContext);
  const adaptiveStyle = prompts.buildAdaptiveStyle(messages);

  // 将RAG检索结果+主动提示+自适应注入system prompt
  const enhancedPrompt = systemPrompt + proactiveHint + adaptiveStyle + contextText;

  // Phase 3.3: A/B模型切换 — MODEL_AB_RATIO=5 则5%流量用备选模型
  var abRatio = parseInt(process.env.MODEL_AB_RATIO || '0');
  var modelName = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
  if (abRatio > 0 && Math.random() * 100 < abRatio) {
    modelName = process.env.MODEL_AB_ALT || 'deepseek-reasoner';
  }

  var req = {
    model: modelName,
    messages: [
      { role: 'system', content: enhancedPrompt }
    ].concat(messages),
    temperature: mode === 'qa' ? 0.3 : mode === 'assessment' ? 0.5 : 0.7,
    max_tokens: 2048,
    stream: !!streamMode,
  };

  // Phase 2: 评估模式使用JSON模式强制结构化输出
  if (mode === 'assessment') {
    req.response_format = { type: 'json_object' };
  }

  return req;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('API call timeout after ' + ms + 'ms')), ms)
    )
  ]);
}

async function callDeepSeek(requestBody) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.warn('DEEPSEEK_API_KEY 未设置');
    return null;
  }

  const apiTimeout = 25000;
  try {
    const body = JSON.stringify(requestBody);
    console.log('[ai-chat] Calling DeepSeek, model:', requestBody.model, 'stream:', requestBody.stream);
    let response;

    if (typeof fetch === 'function') {
      const fetchPromise = fetch(DEEPSEEK_BASE_URL + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey,
        },
        body: body,
      });
      response = await withTimeout(fetchPromise, apiTimeout);
    } else {
      response = await httpPostJson(DEEPSEEK_BASE_URL + '/chat/completions', body, {
        'Authorization': 'Bearer ' + apiKey
      }, apiTimeout);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error('DeepSeek API error: ' + response.status + ' ' + errorText);
    }

    if (requestBody.stream) {
      return { stream: response, isStream: true };
    }

    const result = await response.json();
    console.log('[ai-chat] DeepSeek success, tokens:', JSON.stringify(result.usage));
    return { result, isStream: false };
  } catch (error) {
    console.error('[ai-chat] DeepSeek call failed:', error.message);
    return null;
  }
}

// ========== 降级响应 ==========
function buildFallbackResponse(retrievedChunks, mode) {
  if (retrievedChunks && retrievedChunks.length > 0) {
    const top = retrievedChunks.slice(0, 3);
    const content = '🔍 以下是根据知识库检索到的相关信息（AI服务暂时降级）：\n\n' +
      top.map((c, i) =>
        `**${c.source_title || '来源 ' + (i + 1)}**\n${(c.content || '').substring(0, 500)}\n`
      ).join('\n') +
      '\n⚠️ 当前AI大模型服务暂时不可用，以上为知识库直接检索结果。如需更精准的回答，请稍后重试。';
    return { content, quickReplies: undefined };
  }
  return null;
}

// ========== 对话历史处理 ==========
function processHistory(history) {
  if (!history || !Array.isArray(history) || history.length === 0) return [];

  // 取最近N轮，每轮一对(user+assistant)
  const recent = [];
  let turnCount = 0;
  for (let i = history.length - 1; i >= 0 && turnCount < MAX_HISTORY_TURNS; i--) {
    const msg = history[i];
    if (msg.role === 'user') turnCount++;
    recent.unshift(msg);
  }

  // 为LLM格式化：只传role和content，assistant内容的超长部分截断
  return recent.map(msg => ({
    role: msg.role,
    content: msg.role === 'assistant'
      ? (msg.content || '').substring(0, 300)  // 截断长回复节省token
      : msg.content
  }));
}

// ========== 上下文压缩 ==========
function buildContextMessage(context) {
  if (!context || Object.keys(context).length === 0) return null;

  // 只提取关键字段，避免JSON dump浪费token
  const parts = [];
  if (context.selectedPath) {
    var pathLabels = { qmas: '优才计划(QMAS)', ttps_a: '高才通A类', ttps_b: '高才通B类', ttps_c: '高才通C类', asmpt: '专才计划(ASMTP)', student_iang: '学生→IANG', dependent: '受养人', permanent: '永居申请' };
    parts.push('用户当前路径: ' + (pathLabels[context.selectedPath] || context.selectedPath));
  }
  if (context.userStatus) {
    var statusLabels = { unapplied: '未申请', submitted: '已提交申请等待审批', approved: '已获批', permanent: '永居' };
    parts.push('用户状态: ' + (statusLabels[context.userStatus] || context.userStatus));
  }
  if (context.userSubStatus) {
    parts.push('职业身份: ' + context.userSubStatus);
  }
  if (context.activeProcess) {
    parts.push('当前阶段: ' + (context.activeProcess.currentStageId || ''));
  }
  if (context.membershipLevel) {
    parts.push('会员等级: ' + context.membershipLevel);
  }
  if (context.assessmentStep !== undefined) {
    parts.push('评估进度: 第' + (context.assessmentStep + 1) + '步');
  }
  if (context.page) {
    var pageHints = { guidebooks: '浏览攻略库', process: '管理申请流程', documents: '整理证件材料', reminders: '管理提醒', assessment: '资格评估中', mine: '个人中心' };
    parts.push('页面场景: ' + (pageHints[context.page] || context.page));
  }

  return parts.length > 0
    ? { role: 'user', content: '[用户背景] ' + parts.join('; ') }
    : null;
}

// ========== 对话日志 ==========
async function logConversation(data) {
  try {
    const ddb = getDb();
    await ddb.collection('conversation_logs').add({
      trace_id: data.traceId,
      session_id: data.sessionId,
      mode: data.mode,
      query: data.query,
      response_preview: (data.response || '').substring(0, 200),
      rag_sources: data.sources || [],
      model: data.model || (process.env.DEEPSEEK_MODEL || 'deepseek-chat'),
      tokens: data.tokens || {},
      latency_ms: data.latencyMs,
      degraded: data.degraded || false,
      degradation_tier: data.tier || 'llm',
      cache_hit: data.cacheHit || false,
      safety_triggered: data.safetyTriggered || [],
      timestamp: new Date(),
    }).catch(() => {});
  } catch(e) {
    // 日志失败不阻塞主流程
  }
}

// ========== 用户反馈处理 ==========
async function handleFeedback(params) {
  try {
    const ddb = getDb();
    await ddb.collection('conversation_feedback').add({
      messageId: params.messageId || '',
      feedback: params.feedback || 'unknown',
      timestamp: params.timestamp ? new Date(params.timestamp) : new Date(),
      sessionId: params.sessionId || '',
    });
    return { code: 200, message: 'ok', data: { recorded: true } };
  } catch(e) {
    console.warn('[ai-chat] Feedback recording failed:', e.message);
    return { code: 200, message: 'ok', data: { recorded: false } };
  }
}

// ========== 云函数入口 ==========
exports.main = async function (event, context) {
  const startTime = Date.now();

  // 兼容 HTTP trigger 和 event trigger
  const params = (event.body && typeof event.body === 'string')
    ? JSON.parse(event.body)
    : event;

  // ====== 反馈动作处理 (非对话路径) ======
  if (params.action === 'feedback') {
    return handleFeedback(params);
  }

  const sessionId = params.sessionId || ('sess_' + Date.now());
  const message = params.message;
  const mode = (params.mode || 'general');
  const sessionContext = params.context || {};
  const history = params.history || [];
  const streamMode = params.stream === true;

  // 参数校验
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return respond(400, '消息内容不能为空', null, context);
  }

  const validModes = ['assessment', 'qa', 'general', 'solution_recommend'];
  const chatMode = validModes.indexOf(mode) > -1 ? mode : 'general';

  // 内联内容安全预检: 极端敏感词直接拦截
  const blockedPatterns = [
    /(自杀|自残|自我伤害).*(方法|方式|怎么|如何)/,
    /(制造|制作).*(炸弹|爆炸物|武器|毒药)/,
    /(儿童|未成年).*(色情|性虐待|剥削)/,
  ];
  for (let i = 0; i < blockedPatterns.length; i++) {
    if (blockedPatterns[i].test(message)) {
      console.warn('[ai-chat] Content blocked by safety pre-check');
      return respond(400, '您的消息包含不被支持的内容，请重新输入。', null, context);
    }
  }

  const traceId = 'trace_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  let degraded = false;
  let safetyTriggered = [];
  let ragSources = [];

  try {
    // ====== Step 1: RAG 检索 ======
    const ragResult = await retrieveContext(message, chatMode);
    ragSources = ragResult.sources || [];

    // ====== Step 2: 构建消息 ======
    const historyMsgs = processHistory(history);
    const contextMsg = buildContextMessage(sessionContext);

    const messages = [];
    if (contextMsg) messages.push(contextMsg);
    for (let i = 0; i < historyMsgs.length; i++) {
      messages.push(historyMsgs[i]);
    }
    messages.push({ role: 'user', content: message });

    // ====== Step 3: 调用 LLM（含RAG上下文） ======
    const requestBody = buildDeepSeekRequest(messages, chatMode, ragResult.contextText, streamMode, sessionContext);
    const apiResult = await callDeepSeek(requestBody);

    let content, quickReplies, assessmentResult;

    if (apiResult && !apiResult.isStream) {
      // 非流式响应
      const llmResult = apiResult.result;
      if (llmResult && llmResult.choices && llmResult.choices.length > 0) {
        content = llmResult.choices[0].message.content;

        // Phase 2: 如果评估模式+JSON模式，解析结构化输出
        if (chatMode === 'assessment') {
          var parsed = parseAssessmentJSON(content);
          if (parsed) {
            if (parsed.status === 'asking') {
              content = parsed.question || content;
              quickReplies = generateQuickRepliesByDim(parsed.dim);
            } else if (parsed.status === 'done') {
              content = '评估完成！';
              assessmentResult = parsed;
            }
          } else {
            // 自然语言回退: 从答案文本检测维度
            var detectedDim = detectAssessmentDim(content);
            if (detectedDim) {
              quickReplies = generateQuickRepliesByDim(detectedDim);
            }
            // 仍尝试旧格式
            assessmentResult = parseAssessmentResult(content);
          }
        } else {
          // 非评估模式仍用旧格式
          assessmentResult = parseAssessmentResult(content);
        }

        // 扫描回答中的K2泄露
        safetyTriggered = scanForK2Leak(content);

        // 记录日志
        const tokens = llmResult.usage || {};
        logConversation({
          traceId, sessionId, mode: chatMode, query: message,
          response: content, sources: ragSources.map(s => s.title),
          model: requestBody.model, tokens,
          latencyMs: Date.now() - startTime,
          degraded: false, safetyTriggered
        }).catch(() => {});
      }
    } else if (apiResult && apiResult.isStream) {
      // 流式响应——在HTTP trigger下转发SSE
      if (context.httpContext && streamMode) {
        return handleStreamResponse(apiResult.stream, traceId, sessionId, chatMode, message, ragSources, startTime, safetyTriggered, context);
      }
      // 非HTTP环境下不支持流式，返回提示
      return respond(400, '流式响应需要HTTP trigger', null, context);
    }

    if (!content) {
      // ====== Step 4: 降级——RAG直接返回 ======
      const fallback = buildFallbackResponse(ragResult.chunks, chatMode);
      if (fallback) {
        content = fallback.content;
        quickReplies = fallback.quickReplies;
      } else {
        content = '抱歉，AI服务暂时不可用。建议您查阅香港入境事务处官方网站（www.immd.gov.hk）获取最新信息。如需个案建议，请咨询持牌律师。';
      }
      degraded = true;

      logConversation({
        traceId, sessionId, mode: chatMode, query: message,
        response: content, sources: ragSources.map(s => s.title),
        model: 'fallback', tokens: {},
        latencyMs: Date.now() - startTime,
        degraded: true, safetyTriggered
      }).catch(() => {});
    }

    // ====== 评估模式快捷回复 (Phase 2: 由LLM输出dim驱动) ======
    if (chatMode === 'assessment' && !quickReplies && !assessmentResult) {
      // 降级: JSON解析失败时用旧step索引
      const step = (sessionContext && sessionContext.assessmentStep) || 0;
      quickReplies = generateAssessmentQuickReplies(step);
    }

    return respond(200, 'ok', {
      messageId: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      content, quickReplies, assessmentResult,
      sources: ragSources,
      traceId,
      degraded,
    }, context);

  } catch (error) {
    console.error('[ai-chat] Fatal error:', error);
    logConversation({
      traceId, sessionId, mode: chatMode, query: message,
      response: 'ERROR: ' + (error.message || 'unknown'),
      sources: [], model: 'error', tokens: {},
      latencyMs: Date.now() - startTime,
      degraded: true, safetyTriggered
    }).catch(() => {});

    return respond(500, 'AI对话服务异常：' + (error.message || '未知错误'), null, context);
  }
};

// ========== 流式响应处理 ==========
async function handleStreamResponse(streamResponse, traceId, sessionId, mode, query, sources, startTime, safetyTriggered, ctx) {
  // 当云函数作为HTTP trigger时，context.httpContext存在
  // CloudBase HTTP访问服务支持SSE流式转发
  const httpCtx = ctx.httpContext;
  if (!httpCtx || !httpCtx.response) {
    // 无法流式，回退到非流式处理
    return respond(400, '当前环境不支持流式响应', { traceId }, ctx);
  }

  const res = httpCtx.response;
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Trace-Id': traceId,
  });

  // 先发送元数据
  res.write(`data: ${JSON.stringify({
    type: 'meta',
    traceId, sessionId, mode,
    sources: sources.map(s => s.title),
  })}\n\n`);

  try {
    let fullContent = '';
    const reader = streamResponse.body;
    let buffer = '';

    for await (const chunk of reader) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.substring(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullContent += delta;
              res.write(`data: ${JSON.stringify({ type: 'token', content: delta })}\n\n`);
            }
          } catch(e) {}
        }
      }
    }

    // 发送完成标记
    const finalSafety = scanForK2Leak(fullContent);
    const allSafety = [...new Set([...safetyTriggered, ...finalSafety])];

    res.write(`data: ${JSON.stringify({
      type: 'done',
      content: fullContent,
      safety_triggered: allSafety,
      trace_id: traceId,
    })}\n\n`);

    logConversation({
      traceId, sessionId, mode, query,
      response: fullContent, sources: sources.map(s => s.title),
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      tokens: {}, latencyMs: Date.now() - startTime,
      degraded: false, safetyTriggered: allSafety
    }).catch(() => {});

  } catch(e) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: e.message })}\n\n`);
  }

  res.end();
}

// ========== 辅助函数 ==========
function respond(code, message, data, ctx) {
  const body = { code, message, data: data || null };
  // 如果是在HTTP trigger上下文中，需要用res.json返回
  return body;
}

// Phase 2: 评估维度→快捷回复映射
var ASSESS_DIM_OPTIONS = {
  age: ['18-25岁', '26-30岁', '31-39岁', '40-44岁', '45-50岁', '50岁以上'],
  edu: ['博士', '硕士（MBA）', '硕士（其他）', '本科', '大专及以下'],
  school: ['QS世界百强', '985/211高校', '香港高校', '海外知名大学', '其他院校'],
  major: ['STEM', '金融/会计', '法律', '医学/护理', '教育', '其他'],
  industry: ['金融/会计', '资讯科技', '工程/制造', '教育', '医疗/护理', '法律', '地产/建筑', '其他'],
  experience: ['< 3年', '3-5年', '5-10年', '10年+'],
  position: ['高管', '高级经理', '经理/主管', '高级专业人员', '专业人员', '初级'],
  income: ['250万港币+', '100-250万', '50-100万', '30-50万', '低于30万'],
  company: ['世界500强/上市公司', '知名企业', '中小企业', '创业/自雇', '自由职业'],
  language: ['中文（母语）', '英语（流利）', '英语（一般）', '粤语', '其他外语'],
  family: ['单身', '已婚无子女', '已婚有子女（1个）', '已婚有子女（2个+）']
};

function generateQuickRepliesByDim(dim) {
  if (!dim) return undefined;
  var opts = ASSESS_DIM_OPTIONS[dim];
  if (!opts) return undefined;
  return opts.map(function(text, i) {
    return { id: dim + '_' + i, text: text };
  });
}

// Phase 2: 自然语言回退——从LLM问题文本检测评估维度
var DIM_KEYWORDS = {
  age: /年龄|几岁|岁数/,
  edu: /学历|学位|博士|硕士|本科|大专|MBA|Ph\.D/,
  school: /学校|院校|毕业.*哪|QS|985|211|百强|海外.*大学|香港.*大学/,
  major: /专业|学科|STEM|金融|会计|法律|医学|教育|工程/,
  industry: /行业|从事.*什么|哪个.*领域|金融|科技|教育|医疗/,
  experience: /工作.*年|经验|年限|干了.*多久/,
  position: /职位|岗位|title|高管|经理|主管|CXO|VP|Director/,
  income: /收入|年薪|月薪|工资|年包|多少.*钱|万/,
  company: /公司|企业|雇主|500强|上市|创业|自雇|自由职业/,
  language: /语言|英文|英语|粤语|雅思|托福|六级|母语/,
  family: /家庭|婚姻|结婚|单身|子女|孩子|小孩/,
};

function detectAssessmentDim(question) {
  if (!question) return null;
  for (var dim in DIM_KEYWORDS) {
    if (DIM_KEYWORDS[dim].test(question)) return dim;
  }
  return null;
}

function parseAssessmentJSON(content) {
  if (!content) return null;
  try {
    // JSON模式输出直接是合法JSON
    var trimmed = content.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      var parsed = JSON.parse(trimmed);
      if (parsed.status && (parsed.status === 'asking' || parsed.status === 'done')) {
        return parsed;
      }
    }
  } catch(e) {
    console.warn('[ai-chat] JSON模式解析失败，降级到自然语言:', e.message);
    // 降级: 尝试从markdown代码块中提取JSON
    try {
      var mdMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (mdMatch) {
        var inner = JSON.parse(mdMatch[1].trim());
        if (inner.status && (inner.status === 'asking' || inner.status === 'done')) return inner;
      }
    } catch(e2) {}
  }
  // 降级: 旧格式ASSESS_RESULT:
  return null;
}

function parseAssessmentResult(content) {
  const marker = 'ASSESS_RESULT:';
  const idx = content.indexOf(marker);
  if (idx === -1) return undefined;
  try {
    const jsonStr = content.substring(idx + marker.length).trim();
    const start = jsonStr.indexOf('{');
    const end = jsonStr.lastIndexOf('}');
    if (start === -1 || end === -1) return undefined;
    return JSON.parse(jsonStr.substring(start, end + 1));
  } catch (e) {
    console.error('[ai-chat] Failed to parse assessment:', e);
    return undefined;
  }
}

function generateAssessmentQuickReplies(step) {
  const questions = [
    { id: 'age', options: ['18-25岁', '26-30岁', '31-39岁', '40-44岁', '45-50岁', '50岁以上'] },
    { id: 'edu', options: ['博士', '硕士（MBA）', '硕士（其他）', '本科', '大专及以下'] },
    { id: 'school', options: ['QS世界百强', '985/211高校', '香港高校', '海外知名大学', '其他院校'] },
    { id: 'major', options: ['STEM（科学/技术/工程/数学）', '金融/会计', '法律', '医学/护理', '教育', '其他'] },
    { id: 'industry', options: ['金融/会计', '资讯科技', '工程/制造', '教育', '医疗/护理', '法律', '地产/建筑', '其他'] },
    { id: 'experience', options: ['< 3年', '3-5年', '5-10年', '10年+'] },
    { id: 'position', options: ['高管（CXO/VP/Director）', '高级经理/团队负责人', '经理/主管', '高级专业人员', '专业人员', '初级'] },
    { id: 'income', options: ['250万港币+', '100-250万', '50-100万', '30-50万', '低于30万'] },
    { id: 'company', options: ['世界500强/上市公司', '知名企业/行业龙头', '中小企业', '创业/自雇', '自由职业'] },
    { id: 'language', options: ['中文（母语）', '英语（流利）', '英语（一般）', '粤语', '其他外语'] },
    { id: 'family', options: ['单身', '已婚无子女', '已婚有子女（1个）', '已婚有子女（2个+）'] },
  ];

  if (step >= 0 && step < questions.length) {
    return questions[step].options.map((text, i) => ({
      id: questions[step].id + '_' + i, text
    }));
  }
  return undefined;
}
