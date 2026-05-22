/**
 * rag-search — RAG检索服务 v1.0
 *
 * 三层 K2 防误读过滤:
 *   Layer 1 (检索前/builtWhere): visibility != 'internal' + source 排除 + content_grade 过滤
 *   Layer 2 (检索后/filterForbiddenChunks): 扫描 K2 关键词, 命中则丢弃
 *   Layer 3 (返回字段/fetchBatch): 携带 visibility + source, 供上游二次判定
 *
 * 支持 action:
 *   keyword    — 关键词搜索 (content 字段)
 *   vector     — 向量相似度搜索 (需传入 queryEmbedding)
 *   hybrid     — 混合搜索 (关键词 + 向量)
 *   count      — 统计满足过滤条件的总数
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// ============================================================
//  Layer 2: 检索后 K2 禁止模式扫描 (POST_RETRIEVAL)
// ============================================================
const POST_RETRIEVAL_FORBIDDEN_PATTERNS = [
  '圆角边框',
  '防伪特征',
  '光变油墨',
  '微缩文字',
  '全息防伪',
  '安全特征',
  '校验位算法',
  'Canny',
  'AES-256',
  'PBKDF2',
  'WASM',
  'OCR模型',
  'validation_rules',
  'vault_mode',
  'privacy_level',
  'MOD 11',
  'MOD11',
  '边缘检测',
  '轮廓近似',
  '安全线',
  '防伪底纹',
];

function filterForbiddenChunks(chunks) {
  return chunks.filter(function (c) {
    const text = c.content || (c.chunk && c.chunk.content) || '';
    for (let i = 0; i < POST_RETRIEVAL_FORBIDDEN_PATTERNS.length; i++) {
      if (text.indexOf(POST_RETRIEVAL_FORBIDDEN_PATTERNS[i]) !== -1) {
        console.debug('[rag-search V7] filtered K2 content:', POST_RETRIEVAL_FORBIDDEN_PATTERNS[i]);
        return false;
      }
    }
    return true;
  });
}

// ============================================================
//  Layer 1: 构建 where 条件 (BUILD_WHERE)
// ============================================================
function buildWhere(filters) {
  const where = {};

  // 原有: knowledge_domain 过滤
  if (filters && filters.knowledge_domain) {
    where.knowledge_domain = filters.knowledge_domain;
  }

  // V7 L1a: visibility 过滤 — 默认排除 internal 内容
  if (filters && filters.visibility) {
    where.visibility = filters.visibility;
  } else {
    // 默认: 排除 internal，只返回 public 和 conditional
    where.visibility = _.neq('internal');
  }

  // V7 L1b: source 过滤 — 支持排除特定来源
  if (filters && filters.source_exclude && Array.isArray(filters.source_exclude) && filters.source_exclude.length > 0) {
    where.source = _.nin(filters.source_exclude);
  }

  // 原有: content_grade 过滤
  if (filters && filters.content_grade) {
    where.content_grade = filters.content_grade;
  } else {
    // 默认: 只返回 green 和 yellow
    where.content_grade = _.in(['green', 'yellow']);
  }

  return where;
}

// ============================================================
//  Layer 3: 返回字段 (FETCH)
// ============================================================
function getFetchFields() {
  return {
    content: true,
    source_title: true,
    knowledge_domain: true,
    confidence: true,
    content_grade: true,
    source_url: true,
    // V7 新增: 携带 visibility + source 供上游判定
    visibility: true,
    source: true,
    doc_id: true,
    name_zh: true,
    content_hash: true,
  };
}

// ============================================================
//  搜索实现
// ============================================================

/**
 * 关键词搜索 — 对 content 字段做正则匹配
 */
async function keywordSearch(query, filters, topK) {
  topK = topK || 10;
  const where = buildWhere(filters);

  try {
    const pattern = db.RegExp({ regexp: query, options: 'i' });
    where.content = pattern;

    const res = await db.collection('knowledge_chunks').where(where).field(getFetchFields()).limit(topK).get();

    let results = res.data || [];

    // Layer 2: 检索后 K2 过滤
    results = filterForbiddenChunks(results);

    return {
      results: results.slice(0, topK),
      total: results.length,
      filtered_by_k2: (res.data || []).length - results.length,
    };
  } catch (e) {
    console.error('[rag-search] keywordSearch error:', e.message);
    return { results: [], total: 0, error: e.message };
  }
}

/**
 * 向量相似度搜索 (简化版: 使用 dot-product 近似, 适合低维度场景)
 * @param {Array} queryEmbedding - 查询向量
 */
async function vectorSearch(queryEmbedding, filters, topK) {
  topK = topK || 10;
  const where = buildWhere(filters);

  try {
    // 注: CloudBase NoSQL 不原生支持向量运算。
    // 实际部署时建议使用 CloudBase 的 MySQL 向量扩展或外部向量数据库。
    // 此处提供简化版: 拉取满足 where 条件的记录做内存距离计算。
    const res = await db
      .collection('knowledge_chunks')
      .where(where)
      .field(getFetchFields())
      .limit(200) // 候选池
      .get();

    const candidates = res.data || [];

    // 内存向量相似度 (cosine via dot product)
    const scored = candidates.map(function (c) {
      const emb = c.embedding;
      if (!emb || !Array.isArray(emb) || emb.length === 0) {
        return { chunk: c, score: 0 };
      }
      let dot = 0;
      let normA = 0;
      let normB = 0;
      for (let i = 0; i < emb.length; i++) {
        dot += (queryEmbedding[i] || 0) * emb[i];
        normA += (queryEmbedding[i] || 0) * (queryEmbedding[i] || 0);
        normB += emb[i] * emb[i];
      }
      const score = normA > 0 && normB > 0 ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
      return { chunk: c, score: score };
    });

    scored.sort(function (a, b) {
      return b.score - a.score;
    });
    const top = scored.slice(0, topK).map(function (s) {
      return s.chunk;
    });

    // Layer 2: 检索后 K2 过滤
    const beforeCount = top.length;
    top = filterForbiddenChunks(top);

    return {
      results: top,
      total: top.length,
      filtered_by_k2: beforeCount - top.length,
    };
  } catch (e) {
    console.error('[rag-search] vectorSearch error:', e.message);
    console.warn(
      '[rag-search] vectorSearch degraded: RegExp search failed, falling back to batch fetch',
      e.stack || e.message,
    );
    return {
      results: [],
      total: 0,
      error: e.message,
      degraded: true,
      degradation_reason: 'RegExp search failed: ' + e.message,
    };
  }
}

/**
 * 混合搜索: 关键词 + 向量结果合并去重
 */
async function hybridSearch(query, queryEmbedding, filters, topK) {
  topK = topK || 10;

  const kwPromise = keywordSearch(query, filters, topK * 2);
  const vecPromise = queryEmbedding
    ? vectorSearch(queryEmbedding, filters, topK * 2)
    : Promise.resolve({ results: [], total: 0 });

  const kwRes = await kwPromise;
  const vecRes = await vecPromise;

  // 按 content_hash 去重
  const seen = {};
  let merged = [];

  function add(chunk) {
    if (!chunk.content_hash) {
      merged.push(chunk);
      return;
    }
    if (!seen[chunk.content_hash]) {
      seen[chunk.content_hash] = true;
      merged.push(chunk);
    }
  }

  for (let i = 0; i < kwRes.results.length; i++) add(kwRes.results[i]);
  for (let j = 0; j < vecRes.results.length; j++) add(vecRes.results[j]);

  // Layer 2: 检索后 K2 过滤 (防御性 — keywordSearch/vectorSearch 内部已过滤)
  const beforeCount = merged.length;
  merged = filterForbiddenChunks(merged);

  return {
    results: merged.slice(0, topK),
    total: Math.min(merged.length, topK),
    filtered_by_k2: beforeCount - merged.length,
    keyword_total: kwRes.total,
    vector_total: vecRes.total,
  };
}

// ============================================================
//  主入口
// ============================================================
exports.main = async function (event) {
  const action = event.action || 'keyword';
  const query = event.query || '';
  const queryEmbedding = event.queryEmbedding || null;
  const filters = event.filters || {};
  let topK = event.topK || 10;

  // HIGH-2: topK 上限保护，防止调用方传入过大值导致超时
  if (topK > 100) topK = 100;

  try {
    switch (action) {
      case 'keyword':
        return { ok: true, data: await keywordSearch(query, filters, topK) };

      case 'vector':
        if (!queryEmbedding) {
          return { ok: false, error: 'vector search requires queryEmbedding' };
        }
        return { ok: true, data: await vectorSearch(queryEmbedding, filters, topK) };

      case 'hybrid':
        return { ok: true, data: await hybridSearch(query, queryEmbedding, filters, topK) };

      case 'count': {
        const where = buildWhere(filters);
        const countRes = await db.collection('knowledge_chunks').where(where).count();
        return { ok: true, data: { total: countRes.total } };
      }

      default:
        return { ok: false, error: 'unknown action: ' + action };
    }
  } catch (err) {
    console.error('[rag-search] error:', err);
    return { ok: false, error: err.message || String(err) };
  }
};
