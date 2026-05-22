/**
 * batch-generate-guidebooks v1.0
 * 从 knowledge_chunks 批量提取 Q&A 内容 → 攻略书条目
 *
 * 支持的 action:
 *   generate   — 从 knowledge_chunks 中批量生成攻略（默认 50 条）
 *   stats      — 查看 knowledge_chunks 的内容统计
 *   export     — 返回生成的攻略 JSON（用于复制到 guidebook-data.js）
 *
 * 策略:
 *   1. 优先处理 green 级（官方政策表）→ 政策速查攻略
 *   2. 再处理 yellow 级（知乎采集长文）→ 生活经验攻略
 *   3. 按 source_title 聚合去重
 *   4. 规则化提取：标题→标题、##/数字/①→分段、Q:/A:→FAQ
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// ========== 分类映射 ==========
const DOMAIN_MAP = {
  QMAS: 'qmas',
  TTPS: 'ttps',
  ASMTP: 'asmpt',
  IANG: 'iang',
  LANDING: 'landing',
  RENEWAL: 'renewal',
  PR: 'pr_sprint',
  LIFE: 'life',
  TAX: 'life',
  EDUCATION: 'life',
  GENERAL: 'life',
  BANK: 'life',
  HOUSING: 'life',
  OTHER: 'other',
};

// 标题关键词 → 分类映射
const KEYWORD_CATEGORY = [
  { words: ['银行', '开户', '汇丰', '中银', '渣打', 'ZA Bank', '港卡'], cat: 'life' },
  { words: ['租房', '租金', '劏房', '屋苑', '地产'], cat: 'life' },
  { words: ['驾照', '换领', '运输署'], cat: 'life' },
  { words: ['教育', '学校', '学位', 'DSE', 'IB', '插班'], cat: 'life' },
  { words: ['医疗', '医院', '保险', '看病'], cat: 'life' },
  { words: ['税', '报税', '薪俸税', '税务'], cat: 'life' },
  { words: ['续签', 'renewal'], cat: 'renewal' },
  { words: ['永居', '永久居民', 'PR', '七年'], cat: 'pr_sprint' },
  { words: ['优才', 'QMAS', '12项准则'], cat: 'qmas' },
  { words: ['高才', 'TTPS', '高才通', '250万'], cat: 'ttps' },
  { words: ['专才', 'ASMTP', '雇主担保'], cat: 'asmpt' },
  { words: ['IANG', '学生签证', '毕业'], cat: 'iang' },
  { words: ['过关', '入境', '小白条', '身份证', '人事登记'], cat: 'landing' },
  { words: ['MPF', '强积金', '公积金'], cat: 'landing' },
  { words: ['CIES', '资本投资者', '3000万'], cat: 'pr_sprint' },
];

// ========== 根据关键词/domain 确定分类 ==========
function getCategory(content, domain) {
  if (domain && DOMAIN_MAP[domain]) return DOMAIN_MAP[domain];
  const text = (content || '').substring(0, 200);
  for (let i = 0; i < KEYWORD_CATEGORY.length; i++) {
    const kw = KEYWORD_CATEGORY[i];
    for (let j = 0; j < kw.words.length; j++) {
      if (text.indexOf(kw.words[j]) >= 0) return kw.cat;
    }
  }
  return 'life';
}

// ========== 提取标题（去掉知乎前缀、作者名等） ==========
function cleanTitle(raw) {
  if (!raw) return '未命名攻略';
  let t = raw
    // 去掉 markdown 标题符号
    .replace(/^#{1,3}\s*/g, '')
    // 去掉知乎来源标记
    .replace(/【[^】]*?中界海外[^】]*?】/g, '')
    .replace(/【最新】/g, '')
    .replace(/亲身体验：/g, '')
    // 去掉末尾标签
    .replace(/\s*【.*?】$/, '')
    .replace(/\s*—.*$/, '')
    // 去掉重复的 "一、xxx > 一、xxx" 模式
    .replace(/^(.{2,30}?)\s*[>＞]\s*\1\s*/, '$1')
    // 去掉重复 "xxx xxx" 模式
    .replace(/^(.{3,25})\s+\1\s*$/, '$1')
    // 压缩空白
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length > 40) t = t.substring(0, 37) + '...';
  return t || '未命名攻略';
}

// ========== 提取描述（第一段内容摘要） ==========
function extractDesc(content) {
  if (!content) return '';
  const lines = content.split('\n');
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i].trim();
    if (
      !line ||
      line.startsWith('#') ||
      line.startsWith('**作者') ||
      line.startsWith('**来源') ||
      line.startsWith('目录')
    )
      continue;
    if (line.length > 15) return line.substring(0, 80).replace(/\*/g, '');
  }
  return '';
}

// ========== 提取第一段非元数据正文（fallback desc） ==========
function extractFirstRealParagraph(content) {
  if (!content) return '';
  const lines = content.split('\n');
  const skipPrefixes = [
    '**作者',
    '**来源',
    '**发文',
    '**采集',
    '**互动',
    '采集时间',
    '发文时间',
    '---',
    '# ',
    '## ',
    '目录',
    '参考自',
    'http',
  ];
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const line = lines[i].trim();
    if (!line || line === '\u200B') continue;
    let skip = false;
    for (let s = 0; s < skipPrefixes.length; s++) {
      if (line.indexOf(skipPrefixes[s]) === 0) {
        skip = true;
        break;
      }
    }
    if (skip) continue;
    if (line.length > 15) return line.replace(/\*/g, '').substring(0, 80);
  }
  return '';
}

// ========== 表格文本清洗 ==========
function cleanTableText(line) {
  // 表格分隔行 "|---|---|" → 跳过
  if (/^\|[\s\-:|]+\|$/.test(line)) return '';
  // 表格行 "| col1 | col2 |" → "col1：col2"
  if (/^\|.+\|$/.test(line)) {
    const cells = line.split('|').filter(function (c) {
      return c.trim();
    });
    if (cells.length >= 2) {
      return cells[0].trim() + '：' + cells.slice(1).join('；');
    }
    return cells.join('；');
  }
  return line;
}

// ========== 提取分段标题和正文 ==========
function extractSections(content) {
  if (!content) return [];
  const sections = [];
  let currentHeading = '';
  let currentBody = '';

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) continue;

    // 跳过元数据行
    if (
      line.startsWith('**作者') ||
      line.startsWith('**来源') ||
      line.startsWith('**发文') ||
      line.startsWith('**采集') ||
      line.startsWith('**互动') ||
      line.startsWith('---') ||
      line.startsWith('参考自') ||
      line.startsWith('推荐阅读') ||
      line.startsWith('相关咨询') ||
      line.startsWith('http') ||
      line.startsWith('图 |') ||
      line === '\u200B'
    )
      continue;

    // 表格清洗（非标题行）
    line = cleanTableText(line);
    if (!line) continue;

    // 检测段落标题（确保不是表格行残留）
    let isHeading = false;
    let headingText = line;
    if (/^#{1,3}\s/.test(line)) {
      isHeading = true;
      headingText = line.replace(/^#{1,3}\s*/, '');
    } else if (/^[一二三四五六七八九十]、/.test(line) && !/[\d%]/.test(line)) isHeading = true;
    else if (/^（[一二三四五六七八九十]）/.test(line)) isHeading = true;
    else if (/^\d+[\.、]/.test(line) && line.length < 25 && line.indexOf('|') < 0) isHeading = true;
    else if (/^(第[一二三四五六七八九十\d]+[步条节项章]|总结|写在前面|前言|注意)/.test(line)) isHeading = true;

    if (isHeading) {
      // 保存前一个 section
      if (currentHeading || currentBody) {
        sections.push({ heading: currentHeading || '概览', body: cleanBody(currentBody.trim()) });
      }
      currentHeading = headingText.replace(/\*/g, '').substring(0, 50);
      currentBody = '';
    } else {
      // 累积正文
      if (currentBody.length < 400) {
        currentBody += (currentBody ? '。' : '') + line.replace(/\*/g, '').substring(0, 150);
      }
    }
  }

  // 最后一个 section
  if (currentHeading || currentBody) {
    sections.push({ heading: currentHeading || '概览', body: cleanBody(currentBody.trim()).substring(0, 500) });
  }

  if (sections.length === 0) {
    sections.push({ heading: '', body: cleanBody(content.replace(/\n/g, '。').replace(/\*/g, '').substring(0, 500)) });
  }

  // 去重：合并同标题的 section，删除空 section
  const deduped = [];
  const seenHeadings = {};
  for (let d = 0; d < sections.length; d++) {
    const h = sections[d].heading;
    const b = sections[d].body;
    if (!b) continue; // 跳过空 body
    if (seenHeadings[h]) {
      // 合并到已有 section
      for (let dd = 0; dd < deduped.length; dd++) {
        if (deduped[dd].heading === h) {
          deduped[dd].body += '。' + b;
          break;
        }
      }
    } else {
      seenHeadings[h] = true;
      deduped.push(sections[d]);
    }
  }
  return deduped.slice(0, 8);
}

// ========== 内容安全：去平台名/作者/ID/推广 + 二创改写 ==========

// 黑名单词库（正则模式 + 替换提示）
const REDACT_PATTERNS = [
  // --- 平台/APP名 → 去品牌化 ---
  { re: /知乎/g, sub: '知识社区' },
  { re: /微信公众号/g, sub: '公众号' },
  { re: /微信/g, sub: '' }, // 独立"微信"直接去掉
  { re: /微博/g, sub: '社交平台' },
  { re: /小红书/g, sub: '社区' },
  { re: /淘宝/g, sub: '电商平台' },
  // --- 推广类：wx/微信ID/邀请码 ---
  { re: /wx[：:]\s*[a-zA-Z0-9_-]+/gi, sub: '' },
  { re: /WX[：:]\s*[a-zA-Z0-9_-]+/g, sub: '' },
  { re: /邀请码[：:]\s*[a-zA-Z0-9]+/gi, sub: '' },
  { re: /使用我的邀请码[^。]+/g, sub: '' },
  { re: /加微信[^。]+/g, sub: '通过正规渠道咨询' },
  { re: /私信[^。]+/g, sub: '咨询专业人士' },
  { re: /后台私聊[^。]+/g, sub: '' },
  { re: /扫码[^。]+/g, sub: '' },
  // --- 作者/机构名 → 泛化 ---
  { re: /作者[：:]\s*\S+/g, sub: '' },
  { re: /【[^】]*?中界海外[^】]*?】/g, sub: '' },
  { re: /维途私校/g, sub: '教育机构' },
  { re: /港漂攒钱日记/g, sub: '' },
  { re: /VC妈咪/g, sub: '' },
  { re: /雪球滚动日记/g, sub: '' },
  { re: /小界/g, sub: '顾问' },
  { re: /博主/g, sub: '分享者' },
  // --- 手机号/联系方式 ---
  { re: /1[3-9]\d{9}/g, sub: '[已脱敏]' },
  { re: /[\w.+-]+@[\w-]+\.[\w.]+/g, sub: '[已脱敏]' },
  { re: /咨询[：:]\s*\[已脱敏[^\]]*\]/g, sub: '' },
  // --- 推广引导语 ---
  { re: /记得关注[^~。]+~/g, sub: '' },
  { re: /欢迎关注[^~。]+~/g, sub: '' },
  { re: /点击自测[^。]+/g, sub: '' },
  { re: /➡\s*[^~。]+~/g, sub: '' },
  { re: /相关咨询[，,]请[+]?[^。]+/g, sub: '' },
  { re: /推荐阅读[\s\S]{0,50}?(?=\n\n|$)/g, sub: '' },
  // --- URL ---
  { re: /https?:\/\/[^\s。]+/g, sub: '' },
  { re: /http:\/\/[^\s。]+/g, sub: '' },
  // --- 图片标记 ---
  { re: /图\s*\|[^。\n]+/g, sub: '' },
  { re: /二维码[^。]+/g, sub: '' },
  { re: /\(下图\)/g, sub: '' },
];

// 二创改写词库（常见表述→原创表述）
const REWRITE_PATTERNS = [
  { re: /保姆级教程/g, sub: '完整指南' },
  { re: /本文首发于/g, sub: '' },
  { re: /全文仅个人体验[^。]+。/g, sub: '' },
  { re: /不代表所有地区所有银行要求[^。]+。/g, sub: '' },
  { re: /不代表投资建议[^。]*。/g, sub: '' },
  { re: /亲身体验[：:]/g, sub: '' },
  { re: /本人[^，]{2,6}刚/g, sub: '有申请人' },
  { re: /我帮\d+\+客户[^，]+/g, sub: '根据多位申请人反馈' },
  { re: /作为协助\d+[＋+]\s*客户[^，]+/g, sub: '根据实践经验' },
  { re: /我多方打听[^，]+/g, sub: '经了解' },
  { re: /在我的热心肠驱动下[^，]+/g, sub: '' },
  { re: /我给大家整理好了/g, sub: '以下是' },
  { re: /我给大家/g, sub: '' },
  { re: /必须和大家说/g, sub: '需要说明' },
  { re: /直接放干货/g, sub: '以下是核心内容' },
  { re: /全是我们团队亲自实测过/g, sub: '经过验证' },
];

function redactContent(text) {
  if (!text) return '';

  // 第一轮：去平台/作者/ID
  for (let i = 0; i < REDACT_PATTERNS.length; i++) {
    text = text.replace(REDACT_PATTERNS[i].re, REDACT_PATTERNS[i].sub);
  }

  // 第二轮：二创改写（去个人化表述）
  for (let j = 0; j < REWRITE_PATTERNS.length; j++) {
    text = text.replace(REWRITE_PATTERNS[j].re, REWRITE_PATTERNS[j].sub);
  }

  // 第三轮：清理残留
  text = text
    .replace(/[\\n\\r]{2,}/g, '\n') // 合并多余空行
    .replace(/^\s+|\s+$/g, '') // 去首尾空白
    .replace(/\s{2,}/g, ' ') // 合并多余空格
    .replace(/[,，。；;]{2,}/g, function (m) {
      return m[0];
    }); // 合并重复标点

  return text;
}

// ========== 正文清理 ==========
function cleanBody(body) {
  body = redactContent(body); // ★ 先过安全层
  return body
    .replace(/[。.]{2,}/g, '。')
    .replace(/^\s*[。.]\s*/, '')
    .replace(/\s+[。.]/g, '。')
    .replace(/[\\\\n\\\\r]+/g, '')
    .trim();
}

// ========== 提取精选金句/要点 ==========
function extractFeatures(content) {
  if (!content) return [];
  const features = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // 提取以 ✓ ✅ ⚠️ 💡 开头的要点
    if (/^[✓✅⚠️💡🔴🟢❶❷❸❹❺]/.test(line)) {
      const f = line.substring(1).trim().replace(/\*/g, '').substring(0, 40);
      if (f) features.push(f);
    }
    // 提取以 - • · — 开头的列表项
    if (/^[-•·—]/.test(line)) {
      const f2 = line.substring(1).trim().replace(/\*/g, '').substring(0, 40);
      if (f2 && features.indexOf(f2) < 0) features.push(f2);
    }
  }
  return features.slice(0, 6);
}

// ========== 提取标签 ==========
function extractTags(content, domain) {
  const tags = [];
  if (domain && domain !== 'GENERAL') tags.push(domain.toLowerCase());
  const keywords = ['银行', '开户', '租房', '驾照', '教育', '医疗', '税', '强积金', '续签', '永居'];
  for (let i = 0; i < keywords.length; i++) {
    if (content.indexOf(keywords[i]) >= 0 && tags.indexOf(keywords[i]) < 0) {
      tags.push(keywords[i]);
    }
  }
  return tags.slice(0, 4);
}

// ========== 从正文提取标题（用于 yellow chunk 缺少 source_title 时） ==========
function extractTitleFromContent(content) {
  if (!content) return '';
  // 找第一个 "# " 或 "## " 标题行
  const lines = content.split('\n');
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i].trim();
    // 跳过元数据行
    if (
      line.startsWith('**作者') ||
      line.startsWith('**来源') ||
      line.startsWith('**发文') ||
      line.startsWith('**采集') ||
      line.startsWith('**互动') ||
      line === '---' ||
      line === '\u200B'
    )
      continue;
    // 匹配 "# xxx" 标题
    const m = line.match(/^#{1,3}\s+(.+)/);
    if (m) return cleanTitle(m[1]);
  }
  return '';
}

// ========== 为单条 chunk 生成攻略条目 ==========
function chunkToArticle(chunk, index) {
  const content = chunk.content || '';
  // 优先 source_title，如果是 DB-xxx 则从正文提取
  let rawTitle = chunk.source_title || '';
  if (/^DB-/.test(rawTitle) || rawTitle.length < 5) {
    const fromContent = extractTitleFromContent(content);
    if (fromContent) rawTitle = fromContent;
  }
  const title = redactContent(cleanTitle(rawTitle));
  const domain = chunk.knowledge_domain || 'GENERAL';
  const category = getCategory(content, domain);
  let desc = extractDesc(content);
  // 如果 desc 是元数据（采集时间等），重新提取
  if (/^(采集时间|发文时间)/.test(desc) || desc.length < 10) {
    desc = extractFirstRealParagraph(content);
  }
  desc = redactContent(desc); // ★ 过安全层
  const sections = extractSections(content);
  const features = extractFeatures(content);
  const tags = extractTags(content, domain);
  const confidence = chunk.content_grade === 'green' ? 'B' : 'C';
  const articleId = 'auto_' + category + '_' + (index + 1).toString().padStart(3, '0');

  return {
    id: articleId,
    icon: getIcon(category),
    title: title,
    category: category,
    contentType: sections.length > 1 ? 'article' : 'faq',
    confidence: confidence,
    source: chunk.source_type === 'official' ? '入境处官网' : '社区经验汇总',
    rating: 0.0,
    helpful: 0,
    tags: tags,
    updated: '2026-05-10',
    desc: desc || '从知识库自动提取',
    applicableConditions: '',
    sections: sections,
    features: features,
    pitfalls: [],
    materials: [],
  };
}

function getIcon(cat) {
  const icons = {
    qmas: '🎯',
    ttps: '💰',
    asmpt: '💼',
    iang: '🎓',
    landing: '🛃',
    renewal: '🔄',
    pr_sprint: '🏁',
    life: '📌',
  };
  return icons[cat] || '📄';
}

// ========== 主入口 ==========
exports.main = async function (event) {
  const action = event.action || 'generate';
  const limit = event.limit || 50;
  const skip = event.skip || 0;

  try {
    if (action === 'stats') return await getStats();
    if (action === 'export') return await exportArticles(event.maxResults || 100, skip);
    return await generate(limit, skip);
  } catch (err) {
    return { code: -1, msg: err.message || String(err) };
  }
};

// ========== 统计数据 ==========
async function getStats() {
  const greenCount = await db.collection('knowledge_chunks').where({ content_grade: 'green' }).count();
  const yellowCount = await db.collection('knowledge_chunks').where({ content_grade: 'yellow' }).count();

  // 统计 green 的 source_title 数量
  const greenSources = await db
    .collection('knowledge_chunks')
    .where({ content_grade: 'green' })
    .field({ source_title: true })
    .limit(200)
    .get();

  // 统计 yellow 的 source_title 数量
  const yellowSources = await db
    .collection('knowledge_chunks')
    .where({ content_grade: 'yellow' })
    .field({ source_title: true })
    .limit(200)
    .get();

  const greenUniq = {},
    yellowUniq = {};
  const greenList = greenSources.data || [];
  const yellowList = yellowSources.data || [];
  for (let i = 0; i < greenList.length; i++) {
    greenUniq[greenList[i].source_title || ''] = true;
  }
  for (let j = 0; j < yellowList.length; j++) {
    yellowUniq[yellowList[j].source_title || ''] = true;
  }

  return {
    code: 0,
    data: {
      greenCount: greenCount.total,
      yellowCount: yellowCount.total,
      greenUniqueSources: Object.keys(greenUniq).length,
      yellowUniqueSources: Object.keys(yellowUniq).length,
    },
  };
}

// ========== 批量生成 ==========
async function generate(limit, skip) {
  skip = skip || 0;
  const articles = [];
  const seenSources = {};
  let skipped = 0;

  // 第一优先：green 级官方内容
  const greenRes = await db
    .collection('knowledge_chunks')
    .where({ content_grade: 'green' })
    .field({ content: true, source_title: true, knowledge_domain: true, source_type: true, content_grade: true })
    .limit(200)
    .get();

  const greenChunks = greenRes.data || [];
  for (let i = 0; i < greenChunks.length; i++) {
    const chunk = greenChunks[i];
    const src = chunk.source_title || '';
    if (seenSources[src]) continue;
    seenSources[src] = true;
    if (skipped < skip) {
      skipped++;
      continue;
    }
    articles.push(chunkToArticle(chunk, articles.length));
    if (articles.length >= limit) break;
  }

  // 第二优先：yellow 级社区内容
  if (articles.length < limit) {
    const remaining = limit - articles.length;
    const yellowRes = await db
      .collection('knowledge_chunks')
      .where({ content_grade: 'yellow' })
      .field({ content: true, source_title: true, knowledge_domain: true, source_type: true, content_grade: true })
      .limit(Math.max(400, remaining * 3))
      .get();

    const yellowChunks = yellowRes.data || [];
    for (let j = 0; j < yellowChunks.length; j++) {
      const yChunk = yellowChunks[j];
      const ySrc = yChunk.source_title || '';
      if (seenSources[ySrc]) continue;
      seenSources[ySrc] = true;
      if (skipped < skip) {
        skipped++;
        continue;
      }
      articles.push(chunkToArticle(yChunk, articles.length));
      if (articles.length >= limit) break;
    }
  }

  // === 内容安全审核 ===
  const moderatedArticles = [];
  let blockedCount = 0;
  for (let k = 0; k < articles.length; k++) {
    const article = articles[k];
    try {
      const modRes = await cloud.callFunction({
        name: 'content-moderation',
        data: {
          action: 'moderateText',
          content: (
            (article.title || '') +
            ' ' +
            (article.desc || '') +
            ' ' +
            (article.sections || [])
              .map(function (s) {
                return s.body || '';
              })
              .join(' ')
          ).substring(0, 9000),
          dataId: article.id,
          source: 'batch-generate-guidebooks',
        },
      });
      const modData = modRes.result && modRes.result.data ? modRes.result.data : {};
      article.moderation = {
        suggestion: modData.suggestion || 'Pass',
        label: modData.label || 'Normal',
        score: modData.score || 0,
        keywords: modData.keywords || [],
      };
      if (modData.suggestion === 'Block' && !modData.degraded) {
        blockedCount++;
        continue; // 跳过被拦截的文章
      }
    } catch (modErr) {
      console.debug('[batch-generate] 审核失败，默认放行:', article.id, modErr.message);
      article.moderation = { suggestion: 'Pass', label: 'Normal', score: 0, keywords: [], degraded: true };
    }
    moderatedArticles.push(article);
  }

  // 统计各分类数量
  const catCounts = {};
  for (let m = 0; m < moderatedArticles.length; m++) {
    const c = moderatedArticles[m].category;
    catCounts[c] = (catCounts[c] || 0) + 1;
  }

  return {
    code: 0,
    data: {
      totalGenerated: moderatedArticles.length,
      totalBeforeModeration: articles.length,
      blockedCount: blockedCount,
      categoryCounts: catCounts,
      articles: moderatedArticles,
    },
  };
}

// ========== 导出 ==========
async function exportArticles(maxResults, skip) {
  const result = await generate(maxResults, skip);
  if (result.code !== 0) return result;

  // 格式化为可直接粘贴到 guidebook-data.js 的 JS 对象
  const articles = result.data.articles;
  let output = '// ==================== 自动生成攻略条目 ====================\n';
  output += '// 从 knowledge_chunks 批量提取，时间: ' + new Date().toISOString() + '\n';
  output += '// 总计: ' + articles.length + ' 条\n\n';

  for (let i = 0; i < articles.length; i++) {
    const a = articles[i];
    // 使用 JSON 序列化但格式化换行
    const json = JSON.stringify(a, null, 2);
    output += '  ' + a.id + ': ' + json + ',\n\n';
  }

  return { code: 0, data: { count: articles.length, jsBody: output } };
}
