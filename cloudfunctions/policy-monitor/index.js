/**
 * policy-monitor — 香港入境政策动态监控 v3
 * 定时任务：抓取入境处官网更新，解析政策变更
 * 仅存储政策摘要，不存储任何用户 PII
 *
 * PRD v3 覆盖: PL-01~PL-04
 * 数据源: policy_sources + content_rules 集合
 * 触发器：定时触发（建议每日 10:00 和 16:00）
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 内存缓存
let _sourcesCache = null;
let _keywordsCache = null;
let _cacheExpiry = 0;
const CACHE_TTL = 600000; // 10分钟

exports.main = async (event, context) => {
  const { action } = event || {};

  try {
    switch (action) {
      case 'check':          return await runPolicyCheck();
      case 'getUpdates':     return await getRecentUpdates(event?.limit || 20);
      case 'getByCategory':  return await getByCategory(event?.category);
      case 'getSources':     return await getSources(event?.category);
      case 'addSource':      return await addSource(event);
      case 'addUpdate':      return await addPolicyUpdate(event);
      default:               return await runPolicyCheck();
    }
  } catch (err) {
    console.error('[policy-monitor]', err);
    return { code: 500, msg: '政策监控服务异常', error: err.message };
  }
};

/**
 * 加载政策来源（从 DB，带缓存）
 */
async function _loadSources() {
  const now = Date.now();
  if (_sourcesCache && now < _cacheExpiry) return _sourcesCache;

  const result = await db.collection('policy_sources')
    .where({ isActive: true }).get();

  _sourcesCache = result.data;
  return result.data;
}

/**
 * 加载关键词分类（从 content_rules，带缓存）
 */
async function _loadKeywords() {
  const now = Date.now();
  if (_keywordsCache && now < _cacheExpiry) return _keywordsCache;

  const result = await db.collection('content_rules')
    .where({ ruleType: 'policy_keyword', isActive: true }).get();

  // 构建关键词分类映射
  const categories = {};
  for (const rule of result.data) {
    const cat = rule.category || 'general';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(...(rule.keywords || []));
  }

  _keywordsCache = categories;
  _cacheExpiry = now + CACHE_TTL;
  return categories;
}

/**
 * 运行政策检查
 * PL-01: 对每个来源进行内容抓取和变更检测
 * 实际部署时需配合云函数 HTTP 调用或 Puppeteer 获取页面内容
 */
async function runPolicyCheck() {
  const updates = [];
  const now = new Date();
  const sources = await _loadSources();

  for (const source of sources) {
    try {
      // 对比上次抓取
      const prevSnapshot = await db.collection('policy_snapshots')
        .where({ source: source.name })
        .orderBy('checkedAt', 'desc')
        .limit(1)
        .get();

      const prevContent = prevSnapshot.data.length > 0
        ? prevSnapshot.data[0].contentHash
        : '';

      // 骨架：记录检查时间
      // 实际部署时替换为真实的 HTTP 抓取 + 内容 hash
      const snapshot = {
        source: source.name,
        category: source.category,
        url: source.url,
        checkedAt: now,
        contentHash: '', // 实际应为内容的 hash
        hasChanges: false,
        changes: []
      };

      await db.collection('policy_snapshots').add({ data: snapshot });
      updates.push(snapshot);
    } catch (e) {
      console.warn(`[policy-monitor] 检查 ${source.name} 失败:`, e.message);
    }
  }

  return {
    code: 0,
    data: {
      checkedAt: now.toISOString(),
      sourcesChecked: updates.length,
      updates
    }
  };
}

/**
 * 获取最近的更新
 * PL-02: 从 policy_updates 集合查询
 */
async function getRecentUpdates(limit) {
  const result = await db.collection('policy_updates')
    .orderBy('publishedAt', 'desc')
    .limit(Math.min(limit, 50))
    .get();

  return {
    code: 0,
    data: result.data.map(u => ({
      id: u._id,
      title: u.title,
      summary: u.summary,
      category: u.category,
      impact: u.impact,
      publishedAt: u.publishedAt,
      source: u.source,
      relevantTo: u.relevantTo || []
    }))
  };
}

/**
 * 按类别获取更新
 */
async function getByCategory(category) {
  const result = await db.collection('policy_updates')
    .where({ category })
    .orderBy('publishedAt', 'desc')
    .limit(20)
    .get();

  return { code: 0, data: result.data };
}

/**
 * 获取政策来源列表
 */
async function getSources(category) {
  const query = { isActive: true };
  if (category) query.category = category;

  const result = await db.collection('policy_sources')
    .where(query).orderBy('priority', 'desc').get();

  return {
    code: 0,
    data: result.data.map(s => ({
      id: s._id,
      name: s.name,
      url: s.url,
      category: s.category,
      description: s.description,
      checkInterval: s.checkInterval,
      priority: s.priority,
      lastCheckedAt: s.lastCheckedAt
    }))
  };
}

/**
 * 添加政策来源
 */
async function addSource(event) {
  const { name, url, category, description, checkInterval, priority } = event;
  if (!name || !url) return { code: 400, msg: '名称和URL不能为空' };

  // 去重
  const existing = await db.collection('policy_sources')
    .where({ name }).count();
  if (existing.total > 0) return { code: 409, msg: '来源已存在' };

  await db.collection('policy_sources').add({
    data: {
      name, url,
      category: category || 'general',
      description: description || '',
      checkInterval: checkInterval || 'daily',
      priority: priority || 5,
      isActive: true,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  });

  // 刷新缓存
  _sourcesCache = null;
  _cacheExpiry = 0;

  return { code: 0, msg: 'ok' };
}

/**
 * 添加政策更新记录
 * PL-03: 人工录入或自动检测到的政策变更
 */
async function addPolicyUpdate(event) {
  const { title, summary, category, impact, source, relevantTo, publishedAt } = event;
  if (!title) return { code: 400, msg: '标题不能为空' };

  // 自动关键词分类
  const keywords = await _loadKeywords();
  const autoCategories = _categorizeContent(summary || title, keywords);

  const result = await db.collection('policy_updates').add({
    data: {
      title,
      summary: summary || '',
      category: category || autoCategories[0] || 'general',
      impact: impact || 'medium',
      source: source || 'manual',
      relevantTo: relevantTo || [],
      publishedAt: publishedAt || new Date().toISOString(),
      autoCategories,
      createdAt: db.serverDate()
    }
  });

  // PL-04: 检查是否有指引受此政策影响
  if (relevantTo?.length > 0) {
    await cloud.callFunction({
      name: 'guide-service',
      data: {
        action: 'checkPolicyImpact',
        policySnapshotId: result._id
      }
    });
  }

  return { code: 0, data: { id: result._id } };
}

/**
 * 分类关键词匹配（用于自动标注政策变更类型）
 */
function _categorizeContent(text, keywords) {
  if (!text || !keywords) return [];
  const categories = {};
  for (const [cat, kws] of Object.entries(keywords)) {
    for (const kw of kws) {
      if (text.toLowerCase().includes(kw.toLowerCase())) {
        categories[cat] = (categories[cat] || 0) + 1;
      }
    }
  }
  return Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .map(([cat]) => cat);
}
