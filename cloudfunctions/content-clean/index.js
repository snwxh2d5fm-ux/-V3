/**
 * content-clean — 内容合规清洗 v3
 * 对用户生成内容（UGC）进行合规检测与清洗
 * 确保不展示任何 PII、违规或敏感内容
 *
 * PRD v3 覆盖: CC-01~CC-04
 * 数据源: content_rules 集合（PII 模式 + 违规关键词）
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// PII 检测模式（硬编码 — 正则引擎核心）
const PII_PATTERNS = [
  { name: 'CN_ID', pattern: /\d{17}[\dXx]/g, label: '中国身份证号', level: 'L1' },
  { name: 'HK_ID', pattern: /[A-Z]{1,2}\d{6}\([0-9A]\)/g, label: '香港身份证号', level: 'L1' },
  { name: 'PASSPORT', pattern: /[A-Z]\d{8}/g, label: '通行证号', level: 'L1' },
  { name: 'PHONE_CN', pattern: /1[3-9]\d{9}/g, label: '手机号', level: 'L1' },
  { name: 'PHONE_HK', pattern: /[5-9]\d{7}/g, label: '香港电话', level: 'L1' },
  { name: 'EMAIL', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, label: '邮箱', level: 'L2' },
  { name: 'SALARY', pattern: /(?:月薪|年薪|工资|Salary)\s*[:：]?\s*[HKD$￥\d,.]+\s*(?:万|k|K|w|W)?/g, label: '薪资信息', level: 'L2' }
];

// 内存缓存
let _blockedKeywords = null;
let _blockedRegex = null;
let _cacheExpiry = 0;
const CACHE_TTL = 300000; // 5分钟

exports.main = async (event, context) => {
  const { action, text, textList } = event;

  try {
    switch (action) {
      case 'scan':        return await scanText(text);
      case 'batchScan':   return await batchScan(textList || []);
      case 'clean':       return await cleanText(text);
      case 'getRules':    return await getRules();
      case 'addRule':     return await addRule(event);
      case 'refreshRules':return await refreshRules();
      default:            return { code: 400, msg: '无效操作' };
    }
  } catch (err) {
    console.error('[content-clean]', err);
    return { code: 500, msg: '内容清洗服务异常', error: err.message };
  }
};

/**
 * 加载违规关键词（从 DB，带缓存）
 */
async function _loadBlockedKeywords() {
  const now = Date.now();
  if (_blockedKeywords && now < _cacheExpiry) {
    return { keywords: _blockedKeywords, regex: _blockedRegex };
  }

  const result = await db.collection('content_rules')
    .where({ ruleType: "blocked_keyword", isActive: true }).limit(200).get();

  const keywords = [];
  const regexPatterns = [];

  for (const rule of result.data) {
    if (rule.keywords?.length) {
      keywords.push(...rule.keywords.map(k => ({
        keyword: k,
        category: rule.category || 'general',
        severity: rule.severity || 'high'
      })));
    }
    if (rule.pattern) {
      try {
        regexPatterns.push({
          category: rule.category || 'general',
          regex: new RegExp(rule.pattern, rule.flags || 'gi'),
          label: rule.label || rule.category
        });
      } catch (e) {
        console.warn(`[content-clean] 无效正则: ${rule.pattern}`);
      }
    }
  }

  _blockedKeywords = keywords;
  _blockedRegex = regexPatterns;
  _cacheExpiry = now + CACHE_TTL;

  return { keywords, regex: regexPatterns };
}

/**
 * 扫描单段文本
 * CC-01: PII 泄露 + 违规关键词检测
 */
async function scanText(text) {
  if (!text || typeof text !== 'string') {
    return { code: 400, msg: '文本内容为空' };
  }

  const findings = [];

  // PII 检测
  for (const { name, pattern, label, level } of PII_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      findings.push({
        type: 'PII_LEAK',
        name,
        label,
        level,
        count: matches.length,
        samples: matches.slice(0, 3)
      });
    }
  }

  // 违规关键词检测（从 DB）
  const { keywords, regex } = await _loadBlockedKeywords();

  for (const { keyword, category, severity } of keywords) {
    if (text.includes(keyword)) {
      findings.push({
        type: 'BLOCKED_KEYWORD',
        keyword,
        category,
        severity
      });
    }
  }

  // 正则模式匹配
  for (const { category, regex: re, label } of regex) {
    re.lastIndex = 0;
    const matches = text.match(re);
    if (matches) {
      findings.push({
        type: 'PATTERN_MATCH',
        category,
        label,
        count: matches.length,
        samples: matches.slice(0, 3)
      });
    }
  }

  return {
    code: 0,
    data: {
      clean: findings.length === 0,
      findings,
      scannedAt: new Date().toISOString()
    }
  };
}

/**
 * 批量扫描文本
 * CC-02: 支持多条文本批量检测
 */
async function batchScan(textList) {
  const results = [];
  for (let i = 0; i < textList.length; i++) {
    const res = await scanText(textList[i]);
    results.push({ index: i, ...res.data });
  }
  return {
    code: 0,
    data: {
      total: results.length,
      cleanCount: results.filter(r => r.clean).length,
      results
    }
  };
}

/**
 * 清洗文本 — 将 PII 替换为脱敏占位符
 * CC-03: 云端兜底清洗
 */
async function cleanText(text) {
  if (!text || typeof text !== 'string') {
    return { code: 400, msg: '文本内容为空' };
  }

  let cleaned = text;

  // 替换身份证号
  cleaned = cleaned.replace(/\d{17}[\dXx]/g, '****')
    .replace(/[A-Z]{1,2}\d{6}\([0-9A]\)/g, '****')
    .replace(/[A-Z]\d{8}/g, '****')
    .replace(/1[3-9]\d{9}/g, '****')
    .replace(/[5-9]\d{7}/g, '****')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '****');

  // 薪资脱敏
  cleaned = cleaned.replace(
    /(?:月薪|年薪|工资|Salary)\s*[:：]?\s*[HKD$￥\d,.]+\s*(?:万|k|K|w|W)?/g,
    '****'
  );

  // DB 中的自定义脱敏规则
  const customCleanRules = await db.collection('content_rules')
    .where({ ruleType: "sanitize_pattern", isActive: true }).limit(200).get();

  for (const rule of customCleanRules.data) {
    if (rule.pattern) {
      try {
        const re = new RegExp(rule.pattern, rule.flags || 'gi');
        cleaned = cleaned.replace(re, rule.replacement || '****');
      } catch (e) {
        console.warn(`[content-clean] 无效清洗规则: ${rule.pattern}`);
      }
    }
  }

  return {
    code: 0,
    data: {
      original: text,
      cleaned,
      wasModified: cleaned !== text
    }
  };
}

/**
 * 获取内容清洗规则
 * CC-04: 管理端查询规则列表
 */
async function getRules() {
  const keywordsResult = await db.collection('content_rules')
    .where({ ruleType: "blocked_keyword", isActive: true }).limit(200).get();

  const sanitizeResult = await db.collection('content_rules')
    .where({ ruleType: "sanitize_pattern", isActive: true }).limit(200).get();

  const piiResult = await db.collection('content_rules')
    .where({ ruleType: "pii_pattern", isActive: true }).limit(200).get();

  return {
    code: 0,
    data: {
      blockedKeywords: keywordsResult.data,
      sanitizePatterns: sanitizeResult.data,
      piiPatterns: PII_PATTERNS.map(p => ({
        name: p.name, label: p.label, level: p.level
      })),
      dbPiiPatterns: piiResult.data,
      totalRules: keywordsResult.data.length + sanitizeResult.data.length + piiResult.data.length
    }
  };
}

/**
 * 添加内容规则
 */
async function addRule(event) {
  const { ruleType, category, keywords, pattern, flags, replacement, label, severity } = event;
  if (!ruleType) return { code: 400, msg: 'ruleType 不能为空' };

  const validTypes = ['blocked_keyword', 'sanitize_pattern', 'pii_pattern', 'policy_keyword'];
  if (!validTypes.includes(ruleType)) {
    return { code: 400, msg: `无效 ruleType: ${ruleType}` };
  }

  await db.collection('content_rules').add({
    data: {
      ruleType,
      category: category || 'general',
      keywords: keywords || [],
      pattern: pattern || null,
      flags: flags || 'gi',
      replacement: replacement || '****',
      label: label || null,
      severity: severity || 'medium',
      isActive: true,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  });

  // 刷新缓存
  _blockedKeywords = null;
  _blockedRegex = null;
  _cacheExpiry = 0;

  return { code: 0, msg: 'ok' };
}

/**
 * 刷新规则缓存
 */
async function refreshRules() {
  _blockedKeywords = null;
  _blockedRegex = null;
  _cacheExpiry = 0;
  await _loadBlockedKeywords();
  return { code: 0, msg: '规则缓存已刷新' };
}
