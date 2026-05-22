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
 * v5.1 (Phase 2) 新增:
 *   - 混元 Embedding 语义 RAG (ZGB-AI-201)
 *   - 三路融合排序 (向量×0.5 + 关键词×0.3 + 扩展×0.2)
 *   - 多轮对话记忆摘要压缩 (ZGB-AI-202)
 *   - 置信度分级 high/medium/low (ZGB-AI-203)
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
 *   TENCENT_SECRET_ID - 腾讯云 SecretId (混元 Embedding)
 *   TENCENT_SECRET_KEY - 腾讯云 SecretKey (混元 Embedding)
 */
const cloudbase = require('@cloudbase/node-sdk');
const https = require('https');
const { URL } = require('url');
const prompts = require('./prompts');
const domainRouter = require('./domain-router');
// [V4.1-PHASE1] ZGB-AI-107: 四维画像构建器 + XML格式化
const { buildProfile } = require('./profile-builder');
const { buildUserProfileXml } = require('./context-builder');
const memory = require('./memory');

// [V4.1-PHASE2] ZGB-AI-201: 混元 embedding SDK (按需加载，SDK不可用时降级为纯关键词检索)
let hunyuanClient = null;
try {
  const HunyuanSDK = require('tencentcloud-sdk-nodejs-hunyuan');
  hunyuanClient = HunyuanSDK.hunyuan.v20230901.Client;
  console.debug('[ai-chat] 混元 embedding SDK 加载成功');
} catch (e) {
  console.warn('[ai-chat] 混元 embedding SDK 不可用，向量检索降级为纯关键词:', e.message);
}

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';
const MAX_HISTORY_TURNS = 10;
const RAG_TOP_K = 5;
const RAG_PREFILTER_MULTIPLIER = 5;

// ========== CloudBase 初始化 ==========
let _app = null;
let db = null;

// [V4.1-PHASE1] ZGB-AI-104: 提取app单例以支持getWXContext()
function getApp() {
  if (!_app) {
    _app = cloudbase.init({ env: process.env.ENV_ID });
  }
  return _app;
}

function getDb() {
  if (!db) {
    db = getApp().database();
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
try {
  jieba = require('nodejieba');
} catch (e) {}

function tokenize(text) {
  if (!text) return [];
  if (jieba) {
    try {
      return jieba.cut(text).filter((t) => t.trim().length > 0);
    } catch (e) {}
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
  return tokens.filter((t) => t.length > 0);
}

// ========== Phase 2.4: RAG 缓存 ==========
const ragCache = {};
const RAG_CACHE_TTL = 5 * 60 * 1000; // 5分钟

function getCacheKey(query, mode) {
  return (mode || 'general') + '::' + query.trim().toLowerCase();
}

function getCachedRAG(query, mode) {
  const key = getCacheKey(query, mode);
  const entry = ragCache[key];
  if (entry && Date.now() - entry.ts < RAG_CACHE_TTL) {
    return entry.data;
  }
  return null;
}

function setCachedRAG(query, mode, data) {
  const key = getCacheKey(query, mode);
  ragCache[key] = { ts: Date.now(), data: data };
  // 限制缓存大小
  const keys = Object.keys(ragCache);
  if (keys.length > 100) {
    const oldest = keys.sort(function (a, b) {
      return ragCache[a].ts - ragCache[b].ts;
    });
    for (let i = 0; i < 20; i++) delete ragCache[oldest[i]];
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
      headers: Object.assign(
        {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body, 'utf8'),
        },
        headers || {},
      ),
      timeout: timeoutMs || 20000,
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          text: async () => data,
          json: async () => JSON.parse(data),
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
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// [V4.1-PHASE2] ZGB-AI-201: 应用层向量 top-K 检索
// 对 chunks 中所有包含 embedding 字段的分块计算余弦相似度
function vectorSearch(queryEmbedding, chunks, topK) {
  if (!queryEmbedding || !Array.isArray(queryEmbedding) || queryEmbedding.length === 0) return [];
  if (!chunks || chunks.length === 0) return [];
  const scored = chunks.map(function (chunk) {
    let score = 0;
    if (chunk.embedding && Array.isArray(chunk.embedding) && chunk.embedding.length > 0) {
      score = cosineSimilarity(queryEmbedding, chunk.embedding);
    }
    return { chunk: chunk, score: score };
  });
  return scored
    .filter(function (s) {
      return s.score > 0;
    })
    .sort(function (a, b) {
      return b.score - a.score;
    })
    .slice(0, topK || 20);
}

// [V4.1-PHASE2] ZGB-AI-201: 三路融合排序 (向量×0.5 + 关键词×0.3 + 扩展×0.2)
// 将不同检索策略的结果按加权得分合并，去重后返回排序结果
function fusionRank(vectorResults, keywordResults, extensionResults) {
  const combined = new Map();

  // 向量结果: 权重 0.5
  for (let vi = 0; vi < vectorResults.length; vi++) {
    const vItem = vectorResults[vi];
    if (!vItem.chunk || !vItem.chunk._id) continue;
    const vKey = String(vItem.chunk._id);
    combined.set(vKey, {
      chunk: vItem.chunk,
      fusionScore: (vItem.score || 0) * 0.5,
    });
  }

  // 关键词结果: 权重 0.3
  for (let ki = 0; ki < keywordResults.length; ki++) {
    const kItem = keywordResults[ki];
    if (!kItem.chunk || !kItem.chunk._id) continue;
    const kKey = String(kItem.chunk._id);
    const existing = combined.get(kKey);
    const kScore = (kItem.score || 0.5) * 0.3;
    if (existing) {
      existing.fusionScore += kScore;
    } else {
      combined.set(kKey, {
        chunk: kItem.chunk,
        fusionScore: kScore,
      });
    }
  }

  // 扩展/同义结果: 权重 0.2
  const extList = extensionResults || [];
  for (let ei = 0; ei < extList.length; ei++) {
    const eItem = extList[ei];
    if (!eItem.chunk || !eItem.chunk._id) continue;
    const eKey = String(eItem.chunk._id);
    const existing2 = combined.get(eKey);
    const eScore = (eItem.score || 0.4) * 0.2;
    if (existing2) {
      existing2.fusionScore += eScore;
    } else {
      combined.set(eKey, {
        chunk: eItem.chunk,
        fusionScore: eScore,
      });
    }
  }

  return Array.from(combined.values()).sort(function (a, b) {
    return b.fusionScore - a.fusionScore;
  });
}

function scoreByKeywords(chunks, keywords) {
  return chunks
    .map((c) => {
      const contentLower = (c.content || '').toLowerCase();
      const titleLower = (c.source_title || '').toLowerCase();
      let score = 0;
      for (let i = 0; i < keywords.length; i++) {
        const esc = keywords[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(esc, 'gi');
        score += (contentLower.match(regex) || []).length;
        score += (titleLower.match(regex) || []).length * 3;
      }
      return { chunk: c, score };
    })
    .sort((a, b) => b.score - a.score);
}

// [V4.1-PHASE2] ZGB-AI-201: 混元 embedding API 调用
// REQ-009增强: 1500ms超时降级 + 客户端复用 + LRU缓存(50条)
let hunyuanClientInstance = null;
function getHunyuanClient() {
  if (hunyuanClientInstance) return hunyuanClientInstance;
  if (!hunyuanClient) return null;
  if (!process.env.TENCENT_SECRET_ID || !process.env.TENCENT_SECRET_KEY) return null;
  try {
    hunyuanClientInstance = new hunyuanClient({
      credential: {
        secretId: process.env.TENCENT_SECRET_ID,
        secretKey: process.env.TENCENT_SECRET_KEY,
      },
      region: 'ap-guangzhou',
    });
    return hunyuanClientInstance;
  } catch (e) {
    return null;
  }
}

const EMBEDDING_CACHE = {};
const EMBEDDING_CACHE_SIZE = 50;
const EMBEDDING_TIMEOUT_MS = 1500;

function getEmbeddingCacheKey(text) {
  return (text || '').trim().substring(0, 80).toLowerCase();
}

function getCachedEmbedding(text) {
  const key = getEmbeddingCacheKey(text);
  const entry = EMBEDDING_CACHE[key];
  if (entry) return entry;
  return null;
}

function setCachedEmbedding(text, embedding) {
  const key = getEmbeddingCacheKey(text);
  EMBEDDING_CACHE[key] = embedding;
  const keys = Object.keys(EMBEDDING_CACHE);
  if (keys.length > EMBEDDING_CACHE_SIZE) {
    // 超过上限时删除最老的25条
    const removeCount = keys.length - EMBEDDING_CACHE_SIZE + 25;
    for (let i = 0; i < Math.min(removeCount, keys.length); i++) {
      delete EMBEDDING_CACHE[keys[i]];
    }
  }
}

// 返回 1024维 Float32 数组，失败返回 null（触发降级）
async function getEmbedding(text) {
  const client = getHunyuanClient();
  if (!client) return null;

  // LRU 缓存优先
  const cachedEmb = getCachedEmbedding(text);
  if (cachedEmb) {
    console.debug('[ai-chat] Embedding cache hit');
    return cachedEmb;
  }

  try {
    // 1500ms 超时，超时回退关键词排序（专家评审 C1）
    const resp = await Promise.race([
      client.GetEmbedding({ Input: (text || '').substring(0, 2048) }),
      new Promise(function (_, reject) {
        setTimeout(function () {
          reject(new Error('Embedding API timeout after ' + EMBEDDING_TIMEOUT_MS + 'ms'));
        }, EMBEDDING_TIMEOUT_MS);
      }),
    ]);
    if (resp && resp.Data && resp.Data[0] && resp.Data[0].Embedding) {
      const emb = resp.Data[0].Embedding;
      setCachedEmbedding(text, emb);
      return emb;
    }
    return null;
  } catch (e) {
    console.warn('[ai-chat] getEmbedding failed:', e.message);
    return null;
  }
}

async function retrieveContext(query, mode, topK, detectedDomain) {
  topK = topK || RAG_TOP_K;

  // Phase 2.4: 缓存优先（domain变化时缓存key自然不同）
  const cacheKey = getCacheKey(query, mode + (detectedDomain ? '_' + detectedDomain : ''));
  const cached = getCachedRAG(query, mode + (detectedDomain ? '_' + detectedDomain : ''));
  if (cached) {
    console.debug('[ai-chat] RAG cache hit');
    return cached;
  }

  const ddb = getDb();
  const _ = ddb.command;

  // 构建领域过滤
  let where = { content_grade: _.in(['green', 'yellow']) };

  // REQ-008: qa模式使用领域意图识别结果
  if (mode === 'qa' && detectedDomain) {
    where = domainRouter.applyDomainFilter(where, detectedDomain, _);
  } else if (mode === 'assessment') {
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
        const keywordConditions = keywords.slice(0, 5).map(function (kw) {
          const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          return { content: ddb.RegExp({ regexp: escaped, options: 'i' }) };
        });
        const combinedWhere = _.and(where, _.or(keywordConditions));
        const res = await ddb
          .collection('knowledge_chunks')
          .where(combinedWhere)
          .limit(fetchLimit)
          .field({
            content: true,
            source_title: true,
            source_url: true,
            knowledge_domain: true,
            confidence: true,
            content_grade: true,
            embedding: true,
          })
          .get();
        allChunks = res.data || [];
      } catch (e) {
        console.warn('[ai-chat] RAG keyword prefilter failed, falling back to batch:', e.message);
        allChunks = await fetchBatch(ddb, where, fetchLimit);
      }
    } else {
      allChunks = await fetchBatch(ddb, where, fetchLimit);
    }
  } catch (e) {
    console.error('[ai-chat] RAG retrieval error:', e.message);
    return { chunks: [], sources: [], contextText: '', fusionResults: [], avgScore: 0 };
  }

  if (allChunks.length === 0) {
    return { chunks: [], sources: [], contextText: '', fusionResults: [], avgScore: 0 };
  }

  // [V4.1-PHASE2] ZGB-AI-201: 尝试获取用户查询的向量嵌入 (非阻塞，失败则降级)
  let queryEmbedding = null;
  try {
    queryEmbedding = await getEmbedding(query);
    if (queryEmbedding) {
      console.debug('[ai-chat] 向量嵌入获取成功，维度:', queryEmbedding.length);
    }
  } catch (e) {
    console.warn('[ai-chat] 向量嵌入获取失败，降级为纯关键词检索:', e.message);
  }

  // 关键词评分排序
  let scored;
  if (keywords.length > 0) {
    scored = scoreByKeywords(allChunks, keywords);
  } else {
    scored = allChunks.map((c) => ({ chunk: c, score: 1 }));
  }

  // [V4.1-PHASE2] ZGB-AI-201: 向量检索 + 融合排序
  let vectorResults = [];
  let fusionResults = [];
  if (queryEmbedding) {
    // 对全部 chunks 进行向量相似度计算
    vectorResults = vectorSearch(queryEmbedding, allChunks, topK * 3);

    // 三路融合排序: 向量 x 0.5 + 关键词 x 0.3 + 扩展(同义词) x 0.2
    fusionResults = fusionRank(vectorResults, scored, []);
    const fusionTop5Avg =
      fusionResults.length > 0
        ? fusionResults.slice(0, 5).reduce(function (s, r) {
            return s + r.fusionScore;
          }, 0) / Math.min(5, fusionResults.length)
        : 0;
    console.debug('[ai-chat] 融合排序完成，top-5 平均分:', fusionTop5Avg.toFixed(4));
  }

  // 选择排序结果: 向量融合优先，关键词兜底
  const rankedResults = fusionResults.length > 0 ? fusionResults : scored;

  // 统一分数过滤
  const candidates = rankedResults
    .filter(function (s) {
      const sc = s.score !== undefined ? s.score : s.fusionScore || 0;
      return sc > 0;
    })
    .slice(0, topK * 2);

  // 对高分候选进行K2安全过滤
  const safeCandidates = candidates.filter((s) => {
    const leaks = scanForK2Leak((s.chunk && s.chunk.content) || '');
    return leaks.length === 0;
  });

  const top = safeCandidates.slice(0, topK);

  // [V4.1-PHASE2] ZGB-AI-203: 计算融合排序 top-3 平均分供置信度参考
  let avgFusionScore = 0;
  if (fusionResults.length > 0) {
    const confScores = fusionResults.slice(0, 3).map(function (r) {
      return r.fusionScore || 0;
    });
    avgFusionScore =
      confScores.length > 0
        ? confScores.reduce(function (a, b) {
            return a + b;
          }, 0) / confScores.length
        : 0;
  }

  // 构建格式化输出
  const sources = [];
  const seen = new Set();
  top.forEach((s) => {
    const title = s.chunk.source_title || '';
    const url = s.chunk.source_url || '';
    if (title && !seen.has(title)) {
      seen.add(title);
      sources.push({ title, url, confidence: s.chunk.confidence || 'C', domain: s.chunk.knowledge_domain });
    }
  });

  const contextText =
    top.length > 0
      ? '\n\n[参考知识库——基于以下内容回答，标注来源]\n' +
        top
          .map(
            (s, i) =>
              `[来源${i + 1}] ${s.chunk.source_title || '未知来源'} (置信度:${s.chunk.confidence || 'C'})\n${s.chunk.content}`,
          )
          .join('\n\n')
      : '';

  // [V4.1-PHASE2] 返回融合排序结果供置信度计算
  const result = {
    chunks: top.map((s) => s.chunk),
    sources,
    contextText,
    fusionResults: fusionResults, // 供置信度计算
    avgScore: avgFusionScore, // 供置信度分级
  };

  // Phase 2.4: 缓存写入（domain-aware key）
  const cacheData = { chunks: top.map((s) => s.chunk), sources, contextText, fusionResults: [], avgScore: 0 };
  if (top.length > 0) {
    const domainSuffix = detectedDomain
      ? Array.isArray(detectedDomain)
        ? detectedDomain.join(',')
        : detectedDomain
      : '';
    setCachedRAG(query, mode + (domainSuffix ? '_' + domainSuffix : ''), cacheData);
  }

  return result;
}

async function fetchBatch(ddb, where, maxItems) {
  const fieldSpec = {
    content: true,
    source_title: true,
    source_url: true,
    knowledge_domain: true,
    confidence: true,
    content_grade: true,
    embedding: true,
  };
  let all = [],
    offset = 0;
  const batchSize = Math.min(maxItems, 200);
  const maxBatches = Math.ceil(maxItems / batchSize);
  for (let b = 0; b < maxBatches; b++) {
    const res = await ddb
      .collection('knowledge_chunks')
      .where(where)
      .skip(offset)
      .limit(batchSize)
      .field(fieldSpec)
      .get();
    if (!res.data || res.data.length === 0) break;
    all = all.concat(res.data);
    offset += batchSize;
  }
  return all;
}

// [V4.1-PHASE2] ZGB-AI-203: 置信度分级计算
// 基于 fusionRank top-3 平均分数和 RAG 命中源数量
// 阈值: high >=0.75(且>=3源), medium >=0.5(且>=2源), low <0.5
function computeConfidence(fusionResults, sources) {
  const hitCount = (sources && sources.length) || 0;
  if (hitCount === 0) {
    return { level: 'low', label: 30, hasConfidence: false };
  }

  // 取 top-3 平均融合分数
  const topScores = (fusionResults || []).slice(0, 3).map(function (r) {
    return r.fusionScore || 0;
  });
  const avgScore =
    topScores.length > 0
      ? topScores.reduce(function (a, b) {
          return a + b;
        }, 0) / topScores.length
      : 0;

  let level, numericScore;
  if (avgScore >= 0.75 && hitCount >= 3) {
    level = 'high';
    numericScore = 90;
  } else if (avgScore >= 0.5 && hitCount >= 2) {
    level = 'medium';
    numericScore = 65;
  } else {
    level = 'low';
    numericScore = 35;
  }

  return {
    level: level,
    label: numericScore,
    hasConfidence: true,
    avgScore: avgScore,
    hitCount: hitCount,
  };
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
  const abRatio = parseInt(process.env.MODEL_AB_RATIO || '0');
  let modelName = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
  if (abRatio > 0 && Math.random() * 100 < abRatio) {
    modelName = process.env.MODEL_AB_ALT || 'deepseek-reasoner';
  }

  const req = {
    model: modelName,
    messages: [{ role: 'system', content: enhancedPrompt }].concat(messages),
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
    new Promise((_, reject) => setTimeout(() => reject(new Error('API call timeout after ' + ms + 'ms')), ms)),
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
    console.debug('[ai-chat] Calling DeepSeek, model:', requestBody.model, 'stream:', requestBody.stream);
    let response;

    if (typeof fetch === 'function') {
      const fetchPromise = fetch(DEEPSEEK_BASE_URL + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + apiKey,
        },
        body: body,
      });
      response = await withTimeout(fetchPromise, apiTimeout);
    } else {
      response = await httpPostJson(
        DEEPSEEK_BASE_URL + '/chat/completions',
        body,
        {
          Authorization: 'Bearer ' + apiKey,
        },
        apiTimeout,
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error('DeepSeek API error: ' + response.status + ' ' + errorText);
    }

    if (requestBody.stream) {
      return { stream: response, isStream: true };
    }

    const result = await response.json();
    console.debug('[ai-chat] DeepSeek success, tokens:', JSON.stringify(result.usage));
    return { result, isStream: false };
  } catch (error) {
    console.error('[ai-chat] DeepSeek call failed:', error.message);
    return null;
  }
}

// ========== 降级响应 ==========
function buildFallbackResponse(retrievedChunks, mode, tier) {
  tier = tier || 'L3';
  if (retrievedChunks && retrievedChunks.length > 0) {
    const top = retrievedChunks.slice(0, 3);
    const sourcesList = top
      .map(function (c, i) {
        return '**' + (c.source_title || '来源 ' + (i + 1)) + '**\n' + (c.content || '').substring(0, 500) + '\n';
      })
      .join('\n');
    const tierNote =
      tier === 'L2'
        ? '⚠️ AI大模型服务暂时降级（L2·RAG直返），以上为知识库直接检索结果。'
        : '⚠️ AI服务当前不可用（L3·兜底引导），建议查阅入境处官网或稍后重试。';
    const content = '[' + tier + '·服务降级] ' + tierNote + '\n\n' + sourcesList;
    return { content: content, quickReplies: undefined };
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
  return recent.map((msg) => ({
    role: msg.role,
    content:
      msg.role === 'assistant'
        ? (msg.content || '').substring(0, 300) // 截断长回复节省token
        : msg.content,
  }));
}

// [V4.1-PHASE2] ZGB-AI-202: 多轮对话记忆 — 摘要压缩
// 当 history > 5 轮时，将最早3轮压缩为1条摘要消息
// 超过 5 轮的对话，早期轮次用一句话摘要保留核心上下文
function compressHistory(history, maxTurns) {
  if (!history || !Array.isArray(history) || history.length === 0) return [];

  maxTurns = maxTurns || 5;

  // 计算轮数 (每2条消息=1轮: user+assistant)
  const turnCount = Math.ceil(history.length / 2);

  if (turnCount <= maxTurns) {
    return history;
  }

  // 需要压缩: 取最早3轮进行摘要 (3轮 = 6条消息)
  const earlyTurns = history.slice(0, 6);
  const recentTurns = history.slice(6);

  // 构建摘要消息
  const summaryLines = earlyTurns.map(function (m) {
    const prefix = m.role === 'user' ? '用户: ' : '助手: ';
    return prefix + (m.content || '').substring(0, 100);
  });
  const summaryText = summaryLines.join('\n');

  const summaryEntry = {
    role: 'user',
    content: '[对话摘要] 以下为之前对话的摘要：\n' + summaryText.substring(0, 500),
  };

  return [summaryEntry].concat(recentTurns);
}

// ========== 上下文压缩 ==========
function buildContextMessage(context) {
  if (!context || Object.keys(context).length === 0) return null;

  // 只提取关键字段，避免JSON dump浪费token
  const parts = [];
  if (context.selectedPath) {
    const pathLabels = {
      qmas: '优才计划(QMAS)',
      ttps_a: '高才通A类',
      ttps_b: '高才通B类',
      ttps_c: '高才通C类',
      asmpt: '专才计划(ASMTP)',
      student_iang: '学生→IANG',
      dependent: '受养人',
      permanent: '永居申请',
    };
    parts.push('用户当前路径: ' + (pathLabels[context.selectedPath] || context.selectedPath));
  }
  if (context.userStatus) {
    const statusLabels = {
      unapplied: '未申请',
      submitted: '已提交申请等待审批',
      approved: '已获批',
      permanent: '永居',
    };
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
    const pageHints = {
      guidebooks: '浏览攻略库',
      process: '管理申请流程',
      documents: '整理证件材料',
      reminders: '管理提醒',
      assessment: '资格评估中',
      mine: '个人中心',
    };
    parts.push('页面场景: ' + (pageHints[context.page] || context.page));
  }

  return parts.length > 0 ? { role: 'user', content: '[用户背景] ' + parts.join('; ') } : null;
}

// ========== 对话日志 ==========
// [V4.1-PHASE1] ZGB-AI-104: 监控字段扩展 (+ user_id, turn_number, rag_hit_count, stream_enabled)
// [V4.1-PHASE2] ZGB-AI-203: 新增 confidence_level 字段
async function logConversation(data) {
  try {
    const ddb = getDb();
    await ddb
      .collection('conversation_logs')
      .add({
        trace_id: data.traceId,
        session_id: data.sessionId,
        mode: data.mode,
        _openid: data.openid || null,
        query: data.query,
        response_preview: (data.response || '').substring(0, 200),
        rag_sources: data.sources || [],
        model: data.model || process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        tokens: data.tokens || {},
        latency_ms: data.latencyMs,
        degraded: data.degraded || false,
        degradation_tier: data.tier || 'llm',
        cache_hit: data.cacheHit || false,
        safety_triggered: data.safetyTriggered || [],
        // [V4.1-PHASE1] 新字段
        user_id: data.userId || null,
        turn_number: data.turnNumber || 0,
        rag_hit_count: data.ragHitCount || 0,
        stream_enabled: data.streamEnabled || false,
        // [V4.1-PHASE2] ZGB-AI-203: 置信度字段
        confidence_level: data.confidenceLevel || null,
        // [V4.2] AI对话反馈后台: RAG来源详情
        source_chunks: data.sourceChunks || null,
        timestamp: new Date(),
      })
      .catch(() => {});
  } catch (e) {
    // 日志失败不阻塞主流程
  }
}

// ========== 用户反馈处理 ==========
// [V4.1-PHASE1] ZGB-AI-103: 反馈闭环 — 新字段 + 幂等约束
async function handleFeedback(params, openid) {
  try {
    const ddb = getDb();
    const _ = ddb.command;
    const message_id = params.message_id || params.messageId || '';
    const session_id = params.session_id || params.sessionId || '';
    const rating = params.rating !== undefined ? Number(params.rating) : params.feedback === 'like' ? 1 : 0;

    // 幂等检查: 同(_openid, message_id)不重复写入
    if (message_id) {
      const existing = await ddb
        .collection('conversation_feedback')
        .where({ _openid: openid, message_id: message_id })
        .limit(1)
        .get();
      if (existing.data && existing.data.length > 0) {
        return { code: 409, message: 'DUPLICATE_FEEDBACK', data: { recorded: false } };
      }
    }

    // 写入新字段
    await ddb.collection('conversation_feedback').add({
      _openid: openid || params._openid || '',
      session_id: session_id,
      message_id: message_id,
      rating: rating,
      tags: params.tags || [],
      comment: params.comment || '',
      createdAt: new Date(),
    });
    return { code: 200, message: 'ok', data: { recorded: true } };
  } catch (e) {
    console.warn('[ai-chat] Feedback recording failed:', e.message);
    return { code: 200, message: 'ok', data: { recorded: false } };
  }
}

// [V4.1-PHASE1] ZGB-AI-104: 获取下一轮次号
async function getNextTurnNumber(sessionId) {
  if (!sessionId) return 1;
  try {
    const ddb = getDb();
    const res = await ddb.collection('conversation_logs').where({ session_id: sessionId }).count();
    return (res.total || 0) + 1;
  } catch (e) {
    console.warn('[ai-chat] getNextTurnNumber failed:', e.message);
    return 1;
  }
}

// ========== 云函数入口 ==========
exports.main = async function (event, context) {
  const startTime = Date.now();

  // 兼容 HTTP trigger 和 event trigger
  const params = event.body && typeof event.body === 'string' ? JSON.parse(event.body) : event;

  // [V4.1-PHASE1] 从WXContext提取openid (兼容HTTP trigger)
  let openid = '';
  try {
    const wxCtx = getApp().getWXContext();
    openid = wxCtx.OPENID || '';
  } catch (e) {
    // HTTP trigger下getWXContext不可用
  }
  if (!openid && params._openid) {
    openid = params._openid;
  }

  // ====== 反馈动作处理 (非对话路径) ======
  if (params.action === 'feedback') {
    return handleFeedback(params, openid);
  }

  const sessionId = params.sessionId || 'sess_' + Date.now();
  const message = params.message;
  const mode = params.mode || 'general';
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

  // [V4.1-PHASE1] 计算本轮次号
  let turnNumber = 0;
  getNextTurnNumber(sessionId)
    .then(function (n) {
      turnNumber = n;
    })
    .catch(function () {});

  try {
    // ====== Step 0: 领域意图识别 (REQ-008) ======
    // qa 模式自动检测问题所属路径领域，精准过滤 RAG 来源
    let detectedDomain = null;
    if (chatMode === 'qa' || chatMode === 'assessment') {
      detectedDomain = domainRouter.detectDomain(message, chatMode);
      if (detectedDomain) {
        const domainLabel = Array.isArray(detectedDomain) ? detectedDomain.join(',') : detectedDomain;
        console.debug('[ai-chat] Domain detected:', domainLabel);
      }
    }

    // ====== Step 1: RAG 检索 + 用户画像 (并行) ======
    // [V4.1-PHASE1] ZGB-AI-107: RAG + 画像并行查询，任一失败不阻塞另一路
    const [ragResult, profileData] = await Promise.all([
      retrieveContext(message, chatMode, undefined, detectedDomain),
      buildProfile(openid).catch(function () {
        return { hasData: false };
      }),
    ]);
    ragSources = ragResult.sources || [];

    // [V4.1-PHASE2] ZGB-AI-203: 计算置信度
    const confidenceInfo = computeConfidence(ragResult.fusionResults || [], ragResult.sources || []);
    const confidenceLevel = confidenceInfo.level;
    const hasConfidence = confidenceInfo.hasConfidence;

    // [V4.1-PHASE2] ZGB-AI-203: 在 system prompt 中注入置信度指令
    let confidenceDirective = '';
    if (hasConfidence) {
      if (confidenceLevel === 'high') {
        confidenceDirective =
          '\n\n【当前回答置信度: 高】你本次回答基于多项可靠来源，可以直接断言语气，并标注具体来源名称。';
      } else if (confidenceLevel === 'medium') {
        confidenceDirective = '\n\n【当前回答置信度: 中】你本次回答基于有限来源，建议在适当位置添加"建议核实"的提示。';
      } else {
        confidenceDirective =
          '\n\n【当前回答置信度: 低】你本次回答缺乏直接支撑来源，必须在末尾明确声明"以上信息仅供参考，请以入境处最新公告为准"。';
      }
    }

    // [V4.1-PHASE1] 构建画像XML上下文，注入system prompt
    const profileContext = buildUserProfileXml(profileData);
    // [V4.1-PHASE2] 注入置信度指令
    const enhancedContextText = ragResult.contextText + profileContext + confidenceDirective;

    // ====== Step 2: 构建消息 ======
    // [V4.1-PHASE2] ZGB-AI-202: 多轮对话记忆
    // REQ-010: 服务端记忆加载 + 合并去重 (专家评审 C3 双重校验)
    // K5: 500ms超时不阻塞主流程
    let serverMemory = [];
    try {
      const ddb = getDb();
      serverMemory = await Promise.race([
        memory.loadRecentMemory(sessionId, openid, ddb),
        new Promise(function (resolve) {
          setTimeout(function () {
            resolve([]);
          }, 500);
        }),
      ]);
      if (serverMemory.length > 0) {
        console.debug('[ai-chat] Server memory loaded:', serverMemory.length, 'messages');
      }
    } catch (e) {
      console.warn('[ai-chat] Server memory loading skipped:', e.message);
    }

    // 合并服务端记忆与客户端历史（客户端为时间锚点）
    let mergedHistory = memory.mergeHistory(history && history.length > 0 ? history : [], serverMemory);
    // 限制最多10条消息（5轮）
    mergedHistory = memory.trimMemory(mergedHistory, 10);

    const historyMsgs =
      mergedHistory.length > 0
        ? mergedHistory.length > 10
          ? compressHistory(mergedHistory, 5)
          : processHistory(mergedHistory)
        : [];
    const contextMsg = buildContextMessage(sessionContext);

    const messages = [];
    if (contextMsg) messages.push(contextMsg);
    for (let i = 0; i < historyMsgs.length; i++) {
      messages.push(historyMsgs[i]);
    }
    messages.push({ role: 'user', content: message });

    // ====== Step 3: 调用 LLM（含RAG上下文） ======
    const requestBody = buildDeepSeekRequest(messages, chatMode, enhancedContextText, streamMode, sessionContext);
    const apiResult = await callDeepSeek(requestBody);

    let content, quickReplies, assessmentResult;

    if (apiResult && !apiResult.isStream) {
      // 非流式响应
      const llmResult = apiResult.result;
      if (llmResult && llmResult.choices && llmResult.choices.length > 0) {
        content = llmResult.choices[0].message.content;

        // [V4.1-PHASE2] REQ-011: 置信度后处理拦截层 (专家评审 C4)
        // 正则提取 [置信度: X·标签]，格式异常时降级为无标注（不阻塞回复）
        var confidenceLabel = extractConfidenceLabel(content);
        if (confidenceLabel) {
          console.debug('[ai-chat] Confidence labeled:', confidenceLabel.level);
        }

        // Phase 2: 如果评估模式+JSON模式，解析结构化输出
        if (chatMode === 'assessment') {
          const parsed = parseAssessmentJSON(content);
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
            const detectedDim = detectAssessmentDim(content);
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

        // [V4.1-PHASE2 FIX] 剥离 ```quick_replies 代码块，防止代码漏出到UI
        const stripped = stripQuickRepliesBlock(content);
        content = stripped.cleanedContent;
        if (!quickReplies || quickReplies.length === 0) {
          quickReplies = stripped.quickReplies;
        }

        // 扫描回答中的K2泄露
        safetyTriggered = scanForK2Leak(content);

        // 记录日志
        const tokens = llmResult.usage || {};
        logConversation({
          traceId,
          sessionId,
          mode: chatMode,
          query: message,
          response: content,
          sources: ragSources.map((s) => s.title),
          model: requestBody.model,
          tokens,
          latencyMs: Date.now() - startTime,
          degraded: false,
          safetyTriggered,
          // [V4.1-PHASE1] 监控字段
          userId: openid,
          openid: openid,
          turnNumber: turnNumber,
          ragHitCount: ragSources.length,
          streamEnabled: streamMode,
          // [V4.1-PHASE2] ZGB-AI-203: 置信度字段
          confidenceLevel: confidenceLevel,
          // [V4.2] AI对话反馈后台: RAG来源详情
          sourceChunks: (ragResult.chunks || []).map((c) => ({
            chunk_id: c._id,
            title: c.source_title || '',
            content_preview: (c.content || '').slice(0, 80),
          })),
        }).catch(() => {});
      }
    } else if (apiResult && apiResult.isStream) {
      // 流式响应——在HTTP trigger下转发SSE
      if (context.httpContext && streamMode) {
        return handleStreamResponse(
          apiResult.stream,
          traceId,
          sessionId,
          chatMode,
          message,
          ragSources,
          startTime,
          safetyTriggered,
          context,
          openid,
          turnNumber,
          streamMode,
          confidenceLevel,
          hasConfidence,
        );
      }
      // 非HTTP环境下不支持流式，返回提示
      return respond(400, '流式响应需要HTTP trigger', null, context);
    }

    if (!content) {
      // ====== Step 4: 降级——RAG直接返回 ======
      // REQ-012: 降级链L1/L2/L3标注 — 无LLM结果=至少L2
      const fallbackTier = apiResult ? 'L2' : 'L3';
      const fallback = buildFallbackResponse(ragResult.chunks, chatMode, fallbackTier);
      if (fallback) {
        content = fallback.content;
        quickReplies = fallback.quickReplies;
      } else {
        content =
          '抱歉，AI服务暂时不可用。建议您查阅香港入境事务处官方网站（www.immd.gov.hk）获取最新信息。如需个案建议，请咨询持牌律师。';
      }
      degraded = true;

      logConversation({
        traceId,
        sessionId,
        mode: chatMode,
        query: message,
        response: content,
        sources: ragSources.map((s) => s.title),
        model: 'fallback',
        tokens: {},
        latencyMs: Date.now() - startTime,
        degraded: true,
        safetyTriggered,
        // [V4.1-PHASE1] 监控字段
        userId: openid,
        openid: openid,
        turnNumber: turnNumber,
        ragHitCount: ragSources.length,
        streamEnabled: streamMode,
        // [V4.1-PHASE2] ZGB-AI-203: 置信度字段
        confidenceLevel: confidenceLevel,
        sourceChunks: [],
      }).catch(() => {});
    }

    // ====== 评估模式快捷回复 (Phase 2: 由LLM输出dim驱动) ======
    if (chatMode === 'assessment' && !quickReplies && !assessmentResult) {
      // 降级: JSON解析失败时用旧step索引
      const step = (sessionContext && sessionContext.assessmentStep) || 0;
      quickReplies = generateAssessmentQuickReplies(step);
    }

    // [V4.1-PHASE2] ZGB-AI-203: 在响应中包含置信度信息
    return respond(
      200,
      'ok',
      {
        messageId: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        content,
        quickReplies,
        assessmentResult,
        sources: ragSources,
        traceId,
        degraded,
        confidence_level: confidenceLevel,
        hasConfidence: hasConfidence,
        confidence_label: confidenceLabel || null, // REQ-011: A-E五级语义化标注
      },
      context,
    );
  } catch (error) {
    console.error('[ai-chat] Fatal error:', error);
    logConversation({
      traceId,
      sessionId,
      mode: chatMode,
      query: message,
      response: 'ERROR: ' + (error.message || 'unknown'),
      sources: [],
      model: 'error',
      tokens: {},
      latencyMs: Date.now() - startTime,
      degraded: true,
      safetyTriggered,
      // [V4.1-PHASE1] 监控字段
      userId: openid,
      openid: openid,
      turnNumber: turnNumber,
      ragHitCount: ragSources.length,
      streamEnabled: streamMode,
      // [V4.1-PHASE2] ZGB-AI-203: 置信度字段
      confidenceLevel: null,
    }).catch(() => {});

    return respond(500, 'AI对话服务异常：' + (error.message || '未知错误'), null, context);
  }
};

// ========== 流式响应处理 ==========
// [V4.1-PHASE1] ZGB-AI-104+107: 新增参数 + 流式超时检测(10s idle)
// [V4.1-PHASE2] ZGB-AI-203: 新增 confidenceLevel/hasConfidence 参数注入 done event
async function handleStreamResponse(
  streamResponse,
  traceId,
  sessionId,
  mode,
  query,
  sources,
  startTime,
  safetyTriggered,
  ctx,
  openid,
  turnNumber,
  streamMode,
  confidenceLevel,
  hasConfidence,
) {
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
    Connection: 'keep-alive',
    'X-Trace-Id': traceId,
  });

  // 先发送元数据
  res.write(
    'data: ' +
      JSON.stringify({
        type: 'meta',
        traceId: traceId,
        sessionId: sessionId,
        mode: mode,
        sources: sources.map(function (s) {
          return s.title;
        }),
      }) +
      '\n\n',
  );

  try {
    let fullContent = '';
    const reader = streamResponse.body;
    let buffer = '';
    let timedOut = false;
    let lastTokenTime = Date.now();
    const IDLE_TIMEOUT_MS = 10000; // [V4.1-PHASE1] 10s idle timeout

    // [V4.1-PHASE1] 超时检测轮询
    const timeoutPoller = setInterval(function () {
      if (timedOut) return;
      if (Date.now() - lastTokenTime >= IDLE_TIMEOUT_MS) {
        timedOut = true;
        console.debug('[ai-chat] Stream idle timeout after', IDLE_TIMEOUT_MS, 'ms');
      }
    }, 1000);

    for await (const chunk of reader) {
      if (timedOut) break;
      buffer += chunk.toString();
      lastTokenTime = Date.now();
      const linesArr = buffer.split('\n');
      buffer = linesArr.pop() || '';

      for (const line of linesArr) {
        if (line.startsWith('data: ')) {
          const data = line.substring(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullContent += delta;
              // 流式token级拦截: 在```代码块区间内不转发token
              var blockStart = fullContent.lastIndexOf('```');
              var isInCodeBlock = blockStart !== -1 && fullContent.indexOf('```', blockStart + 3) === -1;
              // [V4.1-PHASE2 FIX] 也拦截裸 quick_replies[...] 无代码围栏的泄漏
              // P0: 使用正则允许 quick_replies 与 [ 之间的空格/换行，防止 LLM 空格绕过
              var qrBareMatch = fullContent.match(/quick_replies\s*\[/);
              var qrBareIdx = qrBareMatch ? qrBareMatch.index : -1;
              var qrBareLen = qrBareMatch ? qrBareMatch[0].length : 0;
              var isInBareQR = false;
              if (qrBareIdx !== -1 && !isInCodeBlock) {
                // 确认 quick_replies[ 不在已完成代码块内
                var prevFenceClose = fullContent.lastIndexOf('```', qrBareIdx);
                var prevFenceOpen = qrBareIdx > 3 ? fullContent.lastIndexOf('```', qrBareIdx - 3) : -1;
                if (prevFenceOpen === -1 || prevFenceClose > prevFenceOpen) {
                  // 检查 JSON 数组是否已闭合
                  var afterQR = fullContent.substring(qrBareIdx + qrBareLen);
                  var depth = 1, inStr = false, closed = false;
                  for (var qi = 0; qi < afterQR.length; qi++) {
                    var ch = afterQR[qi];
                    if (ch === '"' && (qi === 0 || afterQR[qi - 1] !== '\\')) inStr = !inStr;
                    if (!inStr) {
                      if (ch === '[' || ch === '{') depth++;
                      else if (ch === ']' || ch === '}') depth--;
                      if (depth === 0) { closed = true; break; }
                    }
                  }
                  isInBareQR = !closed;
                }
              }
              var shouldSuppress = isInCodeBlock || isInBareQR;
              if (!shouldSuppress) {
                res.write('data: ' + JSON.stringify({ type: 'token', content: delta }) + '\n\n');
              }
            }
          } catch (e) {}
        }
      }
    }

    clearInterval(timeoutPoller);

    // [V4.1-PHASE1] 超时截断: 追加"..."并记录timeout事件
    if (timedOut) {
      fullContent += '\n\n...';
      res.write('data: ' + JSON.stringify({ type: 'token', content: '\n\n...' }) + '\n\n');
      // 记录timeout事件到conversation_logs
      try {
        const ddb = getDb();
        ddb
          .collection('conversation_logs')
          .add({
            session_id: sessionId,
            trace_id: traceId,
            _openid: openid || '',
            query: query,
            response_preview: '[STREAM_TIMEOUT] truncated at ' + fullContent.length + ' chars',
            model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
            degraded: true,
            degradation_tier: 'stream_timeout',
            user_id: openid || null,
            turn_number: turnNumber || 0,
            rag_hit_count: sources ? sources.length : 0,
            stream_enabled: true,
            confidence_level: confidenceLevel || null,
            timestamp: new Date(),
          })
          .catch(function () {});
      } catch (logErr) {}
    }

    // 发送完成标记
    // [V4.1-PHASE2 FIX] 剥离 ```quick_replies 代码块，防止代码漏出到UI
    const strippedStream = stripQuickRepliesBlock(fullContent);
    const cleanContent = strippedStream.cleanedContent;
    const streamQuickReplies = strippedStream.quickReplies;

    const finalSafety = scanForK2Leak(cleanContent);
    const allSafety = [...new Set([...safetyTriggered, ...finalSafety])];

    // K3: 流式done event提取A-E置信度标签, 与流式/非流式响应结构一致
    const streamConfidenceLabel = extractConfidenceLabel(cleanContent);
    // [V4.1-PHASE2] ZGB-AI-203: done event 中包含置信度信息
    res.write(
      'data: ' +
        JSON.stringify({
          type: 'done',
          content: cleanContent,
          quick_replies: streamQuickReplies,
          safety_triggered: allSafety,
          trace_id: traceId,
          confidence_level: confidenceLevel || 'low',
          hasConfidence: hasConfidence || false,
          confidence_label: streamConfidenceLabel || null,
        }) +
        '\n\n',
    );

    if (!timedOut) {
      logConversation({
        traceId: traceId,
        sessionId: sessionId,
        mode: mode,
        query: query,
        response: cleanContent,
        sources: sources.map(function (s) {
          return s.title;
        }),
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        tokens: {},
        latencyMs: Date.now() - startTime,
        degraded: false,
        safetyTriggered: allSafety,
        // [V4.1-PHASE1] 监控字段
        userId: openid || '',
        openid: openid || '',
        turnNumber: turnNumber || 0,
        ragHitCount: sources ? sources.length : 0,
        streamEnabled: true,
        // [V4.1-PHASE2] ZGB-AI-203: 置信度字段
        confidenceLevel: confidenceLevel || null,
        sourceChunks: [],
      }).catch(() => {});
    }
  } catch (e) {
    res.write('data: ' + JSON.stringify({ type: 'error', message: e.message }) + '\n\n');
  }

  res.end();
}
// ========== quick_replies 代码块剥离 ==========
// 从 LLM 返回的 content 中剥离 ```quick_replies 代码块
// 返回 { cleanedContent, quickReplies } — cleanedContent 不含 quick_replies 块
function stripQuickRepliesBlock(content) {
  if (!content || typeof content !== 'string') {
    return { cleanedContent: content || '', quickReplies: [] };
  }

  let quickReplies = [];

  // 匹配 ```quick_replies[...JSON...]``` — 不要求JSON前后有换行
  const blockRegex = /```quick_replies\s*\n?([\s\S]*?)```/g;
  let match;

  while ((match = blockRegex.exec(content)) !== null) {
    try {
      const jsonStr = (match[1] || '').trim();
      if (jsonStr.startsWith('[') && jsonStr.endsWith(']')) {
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed) && parsed.length > 0) {
          quickReplies = quickReplies.concat(parsed);
        }
      }
    } catch (e) {
      console.warn('[ai-chat] stripQuickReplies JSON parse failed:', e.message, 'json:', (match[1]||'').substring(0, 80));
    }
  }

  // [V4.1-PHASE2 FIX] 回退: 匹配裸 quick_replies[...] 无代码围栏
  // LLM 可能忽略 ``` 格式指令，直接将 JSON 接在 quick_replies 关键字后
  if (quickReplies.length === 0) {
    const bareRegex = /quick_replies\s*(\[[\s\S]*?\])/g;
    while ((match = bareRegex.exec(content)) !== null) {
      try {
        const jsonStr = (match[1] || '').trim();
        if (jsonStr.startsWith('[') && jsonStr.endsWith(']')) {
          const parsed = JSON.parse(jsonStr);
          if (Array.isArray(parsed) && parsed.length > 0) {
            quickReplies = quickReplies.concat(parsed);
          }
        }
      } catch (e) {
        console.warn('[ai-chat] stripQuickReplies bare parse failed:', e.message);
      }
    }
  }

  // 从 content 中移除所有 ```quick_replies ... ``` 块
  let cleaned = content.replace(/```quick_replies[\s\S]*?```/g, '');
  // [V4.1-PHASE2 FIX] 回退: 移除裸 quick_replies[...] 无代码围栏的泄漏
  // LLM 可能不遵守 ``` 围栏格式，直接将 JSON 数组接在关键字后
  // P0: 去掉 $/gm 锚点，覆盖行中、行尾、文末三种场景
  cleaned = cleaned.replace(/quick_replies\s*\[[\s\S]*?\]/g, '');
  // 清理残留多余空行
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

  console.debug('[ai-chat] stripQuickReplies: removed', quickReplies.length, 'quick replies, content length before/after:', content.length, '/', cleaned.length);

  return {
    cleanedContent: cleaned,
    quickReplies: quickReplies.slice(0, 5),
  };
}

// ========== 辅助函数 ==========
// [V4.1-PHASE2] REQ-011: 置信度后处理拦截层
// 专家评审 C4: 正则提取 [置信度: A-E·标签]，格式异常降级无标注
const CONFIDENCE_SEMANTIC = {
  A: '非常可靠',
  B: '比较可靠',
  C: '建议核实',
  D: '可能有误',
  E: '仅供参考',
};

function extractConfidenceLabel(content) {
  if (!content) return null;
  // 匹配 [置信度: X·标签] 格式
  // K2: 兼容全角/半角冒号和分隔符
  const regex = /\[置信度[：:]\s*([A-E])[·\-]\s*([^\]]+)\]/;
  const match = content.match(regex);
  if (!match) return null;
  const level = match[1];
  const label = match[2] || '';
  // 验证等级有效
  if (!CONFIDENCE_SEMANTIC[level]) return null;
  return {
    level: level,
    label: label,
    semantic: CONFIDENCE_SEMANTIC[level],
    raw: match[0],
  };
}

function respond(code, message, data, ctx) {
  const body = { code, message, data: data || null };
  // 如果是在HTTP trigger上下文中，需要用res.json返回
  return body;
}

// Phase 2: 评估维度→快捷回复映射
const ASSESS_DIM_OPTIONS = {
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
  family: ['单身', '已婚无子女', '已婚有子女（1个）', '已婚有子女（2个+）'],
};

function generateQuickRepliesByDim(dim) {
  if (!dim) return undefined;
  const opts = ASSESS_DIM_OPTIONS[dim];
  if (!opts) return undefined;
  return opts.map(function (text, i) {
    return { id: dim + '_' + i, text: text };
  });
}

// Phase 2: 自然语言回退——从LLM问题文本检测评估维度
const DIM_KEYWORDS = {
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
  for (const dim in DIM_KEYWORDS) {
    if (DIM_KEYWORDS[dim].test(question)) return dim;
  }
  return null;
}

function parseAssessmentJSON(content) {
  if (!content) return null;
  try {
    // JSON模式输出直接是合法JSON
    const trimmed = content.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const parsed = JSON.parse(trimmed);
      if (parsed.status && (parsed.status === 'asking' || parsed.status === 'done')) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[ai-chat] JSON模式解析失败，降级到自然语言:', e.message);
    // 降级: 尝试从markdown代码块中提取JSON
    try {
      const mdMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (mdMatch) {
        const inner = JSON.parse(mdMatch[1].trim());
        if (inner.status && (inner.status === 'asking' || inner.status === 'done')) return inner;
      }
    } catch (e2) {}
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
    {
      id: 'industry',
      options: ['金融/会计', '资讯科技', '工程/制造', '教育', '医疗/护理', '法律', '地产/建筑', '其他'],
    },
    { id: 'experience', options: ['< 3年', '3-5年', '5-10年', '10年+'] },
    {
      id: 'position',
      options: ['高管（CXO/VP/Director）', '高级经理/团队负责人', '经理/主管', '高级专业人员', '专业人员', '初级'],
    },
    { id: 'income', options: ['250万港币+', '100-250万', '50-100万', '30-50万', '低于30万'] },
    { id: 'company', options: ['世界500强/上市公司', '知名企业/行业龙头', '中小企业', '创业/自雇', '自由职业'] },
    { id: 'language', options: ['中文（母语）', '英语（流利）', '英语（一般）', '粤语', '其他外语'] },
    { id: 'family', options: ['单身', '已婚无子女', '已婚有子女（1个）', '已婚有子女（2个+）'] },
  ];

  if (step >= 0 && step < questions.length) {
    return questions[step].options.map((text, i) => ({
      id: questions[step].id + '_' + i,
      text,
    }));
  }
  return undefined;
}
