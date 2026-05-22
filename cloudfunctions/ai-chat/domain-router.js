/**
 * 住港伴 v5.1 — 领域意图识别器 (REQ-008)
 *
 * 基于12条路径的关键词词典，对用户消息进行领域意图识别，
 * 返回最匹配的 knowledge_domain，用于 RAG 检索的领域过滤。
 *
 * 评分策略：精确匹配 > 同义词 > 子串匹配
 * 多意图 query 取最高分路径
 * 无匹配返回 null（全域检索）
 */
const DOMAIN_KEYWORDS = {
  QMAS: {
    exact: ["优才", "优秀人才入境计划", "QMAS"],
    synonyms: ["综合计分制", "成就计分制", "12项评核准则", "是/否判断", "满足6项"],
    partials: ["优才", "评核", "准则", "计分"],
  },
  TTPS: {
    exact: ["高才通", "高端人才通行证计划", "TTPS"],
    synonyms: ["高才A类", "高才B类", "高才C类", "250万年薪", "250万收入", "百强大学"],
    partials: ["高才", "250万", "百强"],
  },
  ASMTP: {
    exact: ["专才", "输入内地人才计划", "ASMTP"],
    synonyms: ["工作签证", "雇主担保", "内地人才"],
    partials: ["专才", "雇主", "担保"],
  },
  IANG: {
    exact: ["IANG", "非本地毕业生留港", "回港就业安排"],
    synonyms: ["毕业留港", "学生转IANG", "毕业后签证"],
    partials: ["IANG", "毕业", "留港", "非本地"],
  },
  CIES: {
    exact: ["资本投资者入境计划", "CIES", "新资本投资者"],
    synonyms: ["投资移民", "3000万投资", "资产配置入境"],
    partials: ["3000万", "投资", "CIES", "资本"],
  },
  TechTAS: {
    exact: ["科技人才入境计划", "TechTAS"],
    synonyms: ["科技签证", "技术人才"],
    partials: ["科技人才", "TechTAS"],
  },
  STUDENT: {
    exact: ["学生签证", "全日制", "来港读书", "来港留学"],
    synonyms: ["进修", "兼读制", "DSE", "文凭试"],
    partials: ["学生", "读书", "留学", "学校", "国际学校", "大学", "硕士", "博士"],
  },
  DEPENDENT: {
    exact: ["受养人签证", "受养人"],
    synonyms: ["配偶签证", "子女签证", "亲属来港"],
    partials: ["受养人", "配偶", "子女"],
  },
  PERMANENT: {
    exact: ["永居", "永久居民", "永久性居民"],
    synonyms: ["居留权", "通常居住", "核实永久居民", "7年转永居"],
    partials: ["永居", "永久", "居留", "7年"],
  },
  TAX: {
    exact: ["薪俸税", "利得税", "物业税"],
    synonyms: ["税率", "报税", "税务居民", "CRS"],
    partials: ["税", "税率", "报税"],
  },
  RENEWAL: {
    exact: ["续签", "续期", "签证延期"],
    synonyms: ["续签条件", "续签材料", "续签流程"],
    partials: ["续签", "续期", "延期"],
  },
  GENERAL: {
    exact: [],
    synonyms: [],
    partials: ["香港", "身份", "入境", "签证"],
  },
};

// 权重: exact 10分, synonym 5分, partial 1分
const WEIGHTS = { exact: 10, synonym: 5, partial: 1 };

/**
 * 计算单个路径的匹配得分
 * @param {string} queryLower - 小写化用户问题
 * @param {object} keywords - 路径关键词词典
 * @returns {number} 加权总分
 */
function scoreDomain(queryLower, keywords) {
  var total = 0;

  // 精确匹配（完整短语）
  for (var i = 0; i < keywords.exact.length; i++) {
    if (queryLower.indexOf(keywords.exact[i].toLowerCase()) !== -1) {
      total += WEIGHTS.exact;
    }
  }

  // 同义词匹配
  for (var j = 0; j < keywords.synonyms.length; j++) {
    if (queryLower.indexOf(keywords.synonyms[j].toLowerCase()) !== -1) {
      total += WEIGHTS.synonym;
    }
  }

  // 子串匹配（短词，容易命中，权重低）
  for (var k = 0; k < keywords.partials.length; k++) {
    if (queryLower.indexOf(keywords.partials[k].toLowerCase()) !== -1) {
      total += WEIGHTS.partial;
    }
  }

  return total;
}

// GENERIC_INTENT 匹配这些词则说明是无明确领域的通用问答
var GENERIC_WORDS = ["你好", "谢谢", "帮助", "能做什么", "功能", "介绍一下"];

/**
 * 检测用户消息的领域意图
 * @param {string} message - 用户消息
 * @param {string} mode - 对话模式 (qa|assessment|general|solution_recommend)
 * @returns {string|null} knowledge_domain 或 null（全域检索）
 *
 * 策略：
 *   assessment 模式: 始终过滤主流5条路径
 *   qa 模式: 领域明确时叠加过滤，否则 null
 *   general/solution_recommend: 不强制过滤
 */
function detectDomain(message, mode) {
  if (!message || typeof message !== "string") return null;

  var lower = message.toLowerCase().trim();

  // 极短消息不做意图识别（"你好"/"谢谢"等）
  if (lower.length < 3) return null;

  // K4: 先计算领域得分, 仅当无任何领域匹配时才检查通用问候
  // 避免"请介绍一下优才"被"介绍一下"拦截而跳过QMAS领域识别
  var scored = [];
  var domains = Object.keys(DOMAIN_KEYWORDS);
  for (var d = 0; d < domains.length; d++) {
    var domain = domains[d];
    var score = scoreDomain(lower, DOMAIN_KEYWORDS[domain]);
    if (score > 0) {
      scored.push({ domain: domain, score: score });
    }
  }

  // 无任何领域匹配时, 通用问候/功能询问不走领域过滤
  if (scored.length === 0) {
    for (var g = 0; g < GENERIC_WORDS.length; g++) {
      if (lower.indexOf(GENERIC_WORDS[g]) !== -1) return null;
    }
  }

  // 按得分降序排序
  scored.sort(function (a, b) {
    return b.score - a.score;
  });

  // assessment 模式：始终返回主流5条路径的组合过滤
  if (mode === "assessment") {
    // 如果有明确领域意图且得分≥10（至少一次精确匹配或两次同义词），使用该领域
    if (scored.length > 0 && scored[0].score >= 10) {
      return scored[0].domain;
    }
    // 否则返回主流路径的OR过滤
    return ["QMAS", "TTPS", "ASMTP", "IANG", "CIES"];
  }

  // qa 模式：有明确领域意图时叠加过滤
  if (mode === "qa") {
    // 得分≥10且与第二名差距≥5时为明确意图
    if (scored.length > 0 && scored[0].score >= 10) {
      var isClear =
        scored.length === 1 || scored[0].score - scored[1].score >= 5;
      if (isClear) {
        return scored[0].domain;
      }
    }
    // 意图不明确，返回null走全域检索
    return null;
  }

  // general/solution_recommend：不强制过滤
  return null;
}

/**
 * 将 detectDomain 结果合并到 RAG 查询条件中
 * @param {object} baseWhere - 基础 where 条件
 * @param {string|array|null} domain - detectDomain 返回值
 * @param {object} dbCommand - CloudBase db.command
 * @returns {object} 合并后的 where 条件
 */
function applyDomainFilter(baseWhere, domain, dbCommand) {
  if (!domain) return baseWhere;

  var _ = dbCommand;
  var domainWhere = {};

  if (Array.isArray(domain)) {
    domainWhere.knowledge_domain = _.in(domain);
  } else if (typeof domain === "string") {
    domainWhere.knowledge_domain = domain;
  }

  // 合并基础条件与领域条件
  if (Object.keys(domainWhere).length > 0) {
    return _.and(baseWhere, domainWhere);
  }

  return baseWhere;
}

module.exports = {
  detectDomain,
  applyDomainFilter,
  DOMAIN_KEYWORDS,
};
