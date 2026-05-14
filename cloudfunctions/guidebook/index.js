/**
 * guidebook v1.0 — 攻略书云函数
 * PRD v4对齐: GB-01 内容采集与清洗 / GB-02 攻略组织结构 / GB-03 质量控制
 * 数据来源: guidebook_articles 集合 + 本地缓存
 * 
 * 支持的 action:
 *   getArticles     — 分页获取攻略文章列表（支持分类/排序）
 *   getArticleDetail — 获取单篇文章详情
 *   rateArticle     — 有用/没用评分
 *   getRecommended   — 身份状态驱动的智能推荐（PRD v4 §3.7.2）
 *   search          — 全文搜索
 *   getHotTags      — 热门标签
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// ============ PRD v3.1 五级置信度 ============
const CONFIDENCE_BADGE = {
  A: { label: 'A级·法源明确', color: '#059669', bg: '#ECFDF5' },
  B: { label: 'B级·政策明确', color: '#2563EB', bg: '#EFF6FF' },
  C: { label: 'C级·多数实践', color: '#EA580C', bg: '#FFF7ED' },
  D: { label: 'D级·合理推断', color: '#DC2626', bg: '#FEF2F2', banner: '⚠️ 以下内容基于合理推断，入境处有酌情权，建议个案咨询' },
  E: { label: 'E级·无法确认', color: '#9CA3AF', bg: '#F3F4F6', banner: '此问题建议直接咨询入境处或持证律师' }
};

// ============ 分类映射 ============
const DOMAIN_MAP = {
  'QMAS': 'qmas', 'TTPS': 'ttps', 'ASMTP': 'asmpt', 'IANG': 'iang',
  'LANDING': 'landing', 'RENEWAL': 'renewal', 'PR': 'pr_sprint', 'LIFE': 'life',
  'TAX': 'life', 'EDUCATION': 'life', 'OTHER': 'other'
};

exports.main = async (event) => {
  const { action } = event;
  try {
    switch (action) {
      case 'getArticles':     return await getArticles(event);
      case 'getArticleDetail': return await getArticleDetail(event.articleId);
      case 'rateArticle':     return await rateArticle(event);
      case 'getRecommended':  return await getRecommended(event);
      case 'search':          return await searchArticles(event);
      case 'getHotTags':      return await getHotTags();
      default:                return { code: 400, msg: '无效操作，支持: getArticles/getArticleDetail/rateArticle/getRecommended/search/getHotTags' };
    }
  } catch (err) {
    console.error('[guidebook]', err);
    return { code: 500, msg: '攻略书服务异常', error: err.message };
  }
};

// ============ 分页获取文章列表 ============
async function getArticles(event) {
  const { category = 'all', page = 1, pageSize = 20, sortBy = 'default' } = event;
  const skip = (page - 1) * pageSize;

  let query = {};
  if (category !== 'all') {
    const domainKey = Object.keys(DOMAIN_MAP).find(k => DOMAIN_MAP[k] === category);
    if (domainKey) query.knowledgeDomain = domainKey;
  }

  // 排序
  let orderField = 'usefulCount';
  let orderDir = 'desc';
  if (sortBy === 'latest') { orderField = 'publishedAt'; orderDir = 'desc'; }
  else if (sortBy === 'default') { orderField = 'usefulCount'; orderDir = 'desc'; }

  try {
    const countResult = await db.collection('guidebook_articles').where(query).count();
    const result = await db.collection('guidebook_articles')
      .where(query)
      .orderBy(orderField, orderDir)
      .skip(skip)
      .limit(pageSize)
      .get();

    const articles = result.data.map(enrichArticle);
    return {
      code: 0,
      data: {
        articles,
        total: countResult.total,
        page,
        pageSize,
        hasMore: skip + pageSize < countResult.total
      }
    };
  } catch (e) {
    console.log('[guidebook] getArticles DB失败，返回空:', e.message);
    return { code: 0, data: { articles: [], total: 0, page: 1, pageSize, hasMore: false } };
  }
}

// ============ 获取文章详情 ============
async function getArticleDetail(articleId) {
  if (!articleId) return { code: 400, msg: '缺少 articleId' };
  try {
    const result = await db.collection('guidebook_articles').doc(articleId).get();
    if (!result.data) return { code: 404, msg: '攻略不存在' };
    return { code: 0, data: enrichArticle(result.data) };
  } catch (e) {
    return { code: 404, msg: '攻略不存在或已被删除' };
  }
}

// ============ 评分 ============
async function rateArticle(event) {
  const { articleId, rating, previousRating } = event;
  if (!articleId || !rating) return { code: 400, msg: '缺少参数' };

  const openid = cloud.getWXContext().OPENID;
  try {
    const updateData = {};
    if (rating === 'up') {
      updateData.usefulCount = _.inc(1);
      if (previousRating === 'down') updateData.notUsefulCount = _.inc(-1);
    } else if (rating === 'down') {
      updateData.notUsefulCount = _.inc(1);
      if (previousRating === 'up') updateData.usefulCount = _.inc(-1);
    }

    await db.collection('guidebook_articles').doc(articleId).update({ data: updateData });

    // 记录用户评分
    await db.collection('guidebook_ratings').add({
      data: {
        _openid: openid,
        articleId,
        rating,
        ratedAt: db.serverDate()
      }
    }).catch(() => {}); // 重复评分忽略

    return { code: 0, msg: '评分成功' };
  } catch (e) {
    console.error('[guidebook] rateArticle失败:', e);
    return { code: 500, msg: '评分失败' };
  }
}

// ============ 身份状态驱动推荐 V3 双驱动 (PRD v4 §3.7.2) ============
async function getRecommended(event) {
  const { userStatus = 'unapplied', selectedPath, limit = 12 } = event;

  // ====== 状态画像 ======
  const STATE_PROFILE = {
    unapplied: {
      cats: { qmas: 10, ttps: 10, asmpt: 8, iang: 8, life: 3, other: 2 },
      tags: ['必读', '优才', '高才通', '专才', 'IANG', '身份规划', '政策'],
      reason: '未申请 · 推荐路径对比与资格评估攻略'
    },
    submitted: {
      cats: { qmas: 5, ttps: 5, renewal: 10, iang: 5, life: 3, other: 2 },
      tags: ['续签', '材料', '必读', '优才', '高才通', '身份规划', '政策'],
      reason: '已交件 · 推荐审批跟进与补件攻略'
    },
    approved: {
      cats: { landing: 10, life: 8, renewal: 8, pr_sprint: 5, other: 2 },
      tags: ['落地', '银行', '开户', '租房', '驾照', '医疗', '续签', '永居', '必读', '身份证', '过关', '拍照'],
      reason: '已获批 · 推荐赴港落地与续签规划攻略'
    },
    permanent: {
      cats: { life: 10, pr_sprint: 8, other: 2 },
      tags: ['永居', '护照', '教育', 'DSE', '国际学校', '医疗', '创业', '公司', '身份规划'],
      reason: '永居 · 推荐在港生活与护照办理攻略'
    }
  };

  // ====== 路径 → 标签映射（13条路径，全覆盖） ======
  const PATH_TAGS = {
    qmas:            ['优才', 'QMAS'],
    ttps_a:          ['高才通', 'TTPS', 'A类'],
    ttps_b:          ['高才通', 'TTPS', 'B/C类'],
    ttps_c:          ['高才通', 'TTPS', 'B/C类'],
    asmpt:           ['专才', 'ASMTP'],
    student_iang:    ['IANG', '学生', '毕业生'],
    techtas:         ['TechTAS', '科技'],
    cies:            ['CIES', '资本投资'],
    dependent:       ['受养人'],
    minor_student:   ['教育', '国际学校'],
    exchange:        ['IANG', '学生'],
    parttime_qmas:   ['优才', '专才'],
    retirement:       ['退休', 'CIES', '家属']
  };

  // ====== 路径标签映射 ======
  const PATH_LABELS = {
    qmas: '优才', ttps_a: '高才通', ttps_b: '高才通', ttps_c: '高才通',
    asmpt: '专才', student_iang: 'IANG', techtas: '科技人才',
    cies: '资本投资', dependent: '受养人', minor_student: '未成年学生',
    exchange: '交换生', parttime_qmas: '兼职优才', retirement: '退休身份规划'
  };

  const profile = STATE_PROFILE[userStatus] || STATE_PROFILE.unapplied;
  const pathTags = (selectedPath && PATH_TAGS[selectedPath]) ? PATH_TAGS[selectedPath] : [];

  try {
    // 获取所有文章（state profile 覆盖全范畴，不做 domain 预过滤）
    const result = await db.collection('guidebook_articles')
      .orderBy('usefulCount', 'desc')
      .limit(200)
      .get();

    // ====== 评分函数（双重驱动） ======
    function scoreArticle(article) {
      var score = 0;
      var cat = DOMAIN_MAP[article.knowledgeDomain] || 'life';
      var tags = article.topics || [];

      // 第一驱动力：身份路径匹配（+20分，精准命中）
      if (pathTags.length > 0) {
        for (var p = 0; p < pathTags.length; p++) {
          if (tags.indexOf(pathTags[p]) >= 0) { score += 20; break; }
        }
      }

      // 第二驱动力：状态匹配（category权重 + tag评分）
      score += (profile.cats[cat] || 0);
      var tagScore = 0;
      for (var t = 0; t < tags.length; t++) {
        if (profile.tags.indexOf(tags[t]) >= 0) tagScore += 3;
      }
      score += Math.min(tagScore, 15);

      return score;
    }

    // 评分排序
    var scored = result.data.map(function(a) {
      return { article: a, score: scoreArticle(a) };
    });
    scored.sort(function(a, b) { return b.score - a.score; });

    // 取前12个，同分类上限3篇
    var recommended = [];
    var catCount = {};
    for (var i = 0; i < scored.length; i++) {
      if (recommended.length >= limit) break;
      var cat = DOMAIN_MAP[scored[i].article.knowledgeDomain] || 'life';
      if ((catCount[cat] || 0) >= 3) continue;
      recommended.push(scored[i].article);
      catCount[cat] = (catCount[cat] || 0) + 1;
    }

    // 推荐理由
    var pathLabel = '';
    if (pathTags.length > 0) {
      pathLabel = ' · ' + (PATH_LABELS[selectedPath] || selectedPath) + '通道';
    }

    return {
      code: 0,
      data: {
        recommended: recommended.map(enrichArticle),
        total: recommended.length,
        reason: profile.reason + pathLabel
      }
    };
  } catch (e) {
    console.log('[guidebook] V3 getRecommended失败:', e.message);
    return { code: 0, data: { recommended: [], total: 0, reason: '' } };
  }
}

// ============ 搜索 ============
async function searchArticles(event) {
  const { query, limit = 20 } = event;
  if (!query) return { code: 400, msg: '搜索关键词不能为空' };
  try {
    const regex = db.RegExp({ regexp: query, options: 'i' });
    const result = await db.collection('guidebook_articles')
      .where(_.or([
        { title: regex },
        { summary: regex },
        { topics: _.in([query]) }
      ]))
      .orderBy('usefulCount', 'desc')
      .limit(limit)
      .get();
    return { code: 0, data: { articles: result.data.map(enrichArticle), total: result.data.length } };
  } catch (e) {
    console.log('[guidebook] search失败:', e.message);
    return { code: 0, data: { articles: [], total: 0 } };
  }
}

// ============ 热门标签 ============
async function getHotTags() {
  return {
    code: 0,
    data: {
      tags: ['证件照', '银行开户', '租房', '受养人', '税务', 'MPF', '驾照', '保险', '续签', '就业']
    }
  };
}

// ============ 文章数据增强 ============
function enrichArticle(article) {
  const domain = article.knowledgeDomain || 'LIFE';
  const category = DOMAIN_MAP[domain] || 'life';
  const confLevel = article.confidence || 'C';
  const badge = CONFIDENCE_BADGE[confLevel] || CONFIDENCE_BADGE.C;

  // 体系性修复: content/mergedContent → sections 格式转换
  var sections = article.sections || [];
  if (!sections.length) {
    var body = article.mergedContent || article.content || '';
    if (body) {
      sections = buildSections(body, article.title || '');
    }
  }

  return {
    id: article._id,
    articleId: article._id,
    title: article.title || '',
    summary: article.summary || '',
    content: article.content || '',
    mergedContent: article.mergedContent || '',
    sections: sections,
    contentType: (article.steps && article.steps.length) ? 'steps' : (article.faqAnswer ? 'faq' : 'article'),
    category,
    domain,
    topics: article.topics || [],
    steps: article.steps || [],
    pitfalls: article.pitfalls || [],
    materials: article.materials || [],
    sourceUrl: article.sourceUrl || '',
    sourcePlatform: article.sourcePlatform || '',
    usefulCount: article.usefulCount || 0,
    notUsefulCount: article.notUsefulCount || 0,
    totalRatings: (article.usefulCount || 0) + (article.notUsefulCount || 0),
    helpfulRatio: totalRatings(article) > 0
      ? Math.round((article.usefulCount / ((article.usefulCount + article.notUsefulCount) || 1)) * 100)
      : 0,
    rating: article.usefulCount > 100 ? (Math.round(article.usefulCount / 100) / 10).toFixed(1) : '0.0',
    grade: article.grade || 'yellow',
    confidence: confLevel,
    confidenceLabel: badge.label,
    confidenceColor: badge.color,
    confidenceBg: badge.bg,
    showBanner: confLevel === 'D' || confLevel === 'E',
    bannerText: badge.banner || '',
    hideContent: confLevel === 'E',
    wordCount: article.wordCount || 0,
    images: article.images || [],
    publishedAt: article.publishedAt || article.collectedAt || '',
    updatedAt: article.updatedAt || article.collectedAt || '',
    tags: article.topics || [],
    source: article.author || article.sourcePlatform || '用户贡献',
    faqTags: article.faqTags || [],
    isFaq: article.isFaq || false,
    faqAnswer: article.faqAnswer || ''
  };
}

// 将原始文本按自然段落拆分，识别标题标记构建 sections
function buildSections(body, title) {
  var sections = [];
  var paragraphs = body.split(/\n\n+/);
  var currentHeading = '';
  var currentBody = '';

  for (var i = 0; i < paragraphs.length; i++) {
    var p = paragraphs[i].trim();
    if (!p) continue;

    // 检测标题行: 【xxx】/ 一、/ 1. / ## / 以短行开头
    var isHeading = /^【[^】]+】/.test(p) ||
                    /^[一二三四五六七八九十]、/.test(p) ||
                    /^\d+[.、]/.test(p) && p.length < 40 ||
                    /^第[一二三四五六七八九十\d]+[步章]/.test(p) ||
                    p.length < 30 && !/[。；，]$/.test(p);

    if (isHeading) {
      if (currentBody) {
        sections.push({ heading: currentHeading || title, body: currentBody.trim() });
        currentBody = '';
      }
      currentHeading = p;
    } else {
      if (!currentHeading) currentHeading = title;
      currentBody += (currentBody ? '\n\n' : '') + p;
    }
  }

  if (currentBody) {
    sections.push({ heading: currentHeading || title, body: currentBody.trim() });
  }

  // 无自然分段 → 全文一段
  if (!sections.length) {
    sections = [{ heading: title, body: body }];
  }

  return sections;
}

function totalRatings(article) {
  return (article.usefulCount || 0) + (article.notUsefulCount || 0);
}
