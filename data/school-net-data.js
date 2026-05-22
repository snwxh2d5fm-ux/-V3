/**
 * 校网选择向导数据
 * 数据来源: 教育局公开资料 + PRD v6.2 关卡5
 * 四大名校网 + 第二梯队 + 新来港推荐
 */
module.exports = [
  // ═══ 四大名校网 ═══
  {
    net: 11,
    name: '中西区',
    tier: '名校网',
    level: '小学',
    schools: '圣保罗男女附小/圣士提反女小/英华女校',
    vibe: '全港第一校网, Band1率最高',
    familyRating: 5,
    budgetHint: '高',
    region: '港岛',
  },
  {
    net: 12,
    name: '湾仔区',
    tier: '名校网',
    level: '小学',
    schools: '玛利曼/圣保禄/嘉诺撒圣方济各',
    vibe: '女校资源丰富, 国际学校集中',
    familyRating: 5,
    budgetHint: '高',
    region: '港岛',
  },
  {
    net: 34,
    name: '何文田',
    tier: '名校网',
    level: '小学',
    schools: '喇沙/玛利诺修院/拔萃小学',
    vibe: '约20间Band1环绕, 男校+女校均衡',
    familyRating: 5,
    budgetHint: '高',
    region: '九龙',
  },
  {
    net: 41,
    name: '九龙塘',
    tier: '名校网',
    level: '小学',
    schools: '拔萃男书院附小/九龙塘宣道/耀中',
    vibe: '低密度豪宅区, 国际名校云集',
    familyRating: 5,
    budgetHint: '高',
    region: '九龙',
  },

  // ═══ 第二梯队 ═══
  {
    net: 31,
    name: '油尖旺',
    tier: '第二梯队',
    level: '小学',
    schools: '油麻地天主教/循道学校',
    vibe: '交通便利, 校网覆盖油尖旺核心区',
    familyRating: 3,
    budgetHint: '中',
    region: '九龙',
  },
  {
    net: 32,
    name: '大角嘴',
    tier: '第二梯队',
    level: '小学',
    schools: '大角嘴天主教/塘尾道官立',
    vibe: '新兴住宅区, 性价比之选',
    familyRating: 3,
    budgetHint: '中',
    region: '九龙',
  },
  {
    net: 35,
    name: '红磡',
    tier: '第二梯队',
    level: '小学',
    schools: '黄埔宣道/圣公会奉基',
    vibe: '交通枢纽, 红馆文化地标',
    familyRating: 3,
    budgetHint: '中',
    region: '九龙',
  },
  {
    net: 48,
    name: '观塘',
    tier: '第二梯队',
    level: '小学',
    schools: '观塘官立/圣公会基显',
    vibe: '九龙东新兴商业核心, 旧区重建中',
    familyRating: 2,
    budgetHint: '中低',
    region: '九龙',
  },
  {
    net: 62,
    name: '荃湾',
    tier: '第二梯队',
    level: '小学',
    schools: '荃湾官立/海坝街官立',
    vibe: '交通四通八达, 荃湾广场生活便利',
    familyRating: 3,
    budgetHint: '中',
    region: '新界',
  },
  {
    net: 88,
    name: '沙田',
    tier: '第二梯队',
    level: '小学',
    schools: '沙田官立/培基/浸信会吕明才',
    vibe: '大型新市镇, 优质中小学密集',
    familyRating: 4,
    budgetHint: '中',
    region: '新界',
  },

  // ═══ 新来港推荐 ═══
  {
    net: 71,
    name: '屯门',
    tier: '新来港推荐',
    level: '小学',
    schools: '屯门官立/保良局方王锦全',
    vibe: '校网密集, 生活成本低, 新来港家庭首选',
    familyRating: 4,
    budgetHint: '低',
    region: '新界',
  },
  {
    net: 74,
    name: '元朗',
    tier: '新来港推荐',
    level: '小学',
    schools: '元朗官立/光明学校',
    vibe: '新界西核心, 传统与现代交融',
    familyRating: 4,
    budgetHint: '低',
    region: '新界',
  },
  {
    net: 80,
    name: '上水',
    tier: '新来港推荐',
    level: '小学',
    schools: '上水官立/凤溪创新',
    vibe: '跨境学童首选, 邻近深圳罗湖',
    familyRating: 3,
    budgetHint: '低',
    region: '新界',
  },
  {
    net: 72,
    name: '天水围',
    tier: '新来港推荐',
    level: '小学',
    schools: '天水围官立/伊利沙伯旧生会',
    vibe: '大型公屋社区, 设施齐全',
    familyRating: 3,
    budgetHint: '低',
    region: '新界',
  },

  // ═══ 中学 ═══
  {
    net: 'HK1',
    name: '中西区(中学)',
    tier: '名校网',
    level: '中学',
    schools: '圣保罗男女/英皇书院/圣士提反女',
    vibe: '港岛传统名校集中地',
    familyRating: 5,
    budgetHint: '高',
    region: '港岛',
  },
  {
    net: 'KL3',
    name: '九龙城区(中学)',
    tier: '名校网',
    level: '中学',
    schools: '喇沙书院/玛利诺修院/拔萃男',
    vibe: '九龙最强势中学校网',
    familyRating: 5,
    budgetHint: '高',
    region: '九龙',
  },
  {
    net: 'NT7',
    name: '沙田区(中学)',
    tier: '第二梯队',
    level: '中学',
    schools: '沙田官立/培侨书院/浸信会吕明才',
    vibe: '新界最强中学校网, Band1率领先',
    familyRating: 4,
    budgetHint: '中',
    region: '新界',
  },
];

// ── 权重配置 ──
const SN_WEIGHTS = {
  academic: 35, // 学术实力（familyRating + tier）
  budgetMatch: 25, // 预算匹配度
  regionMatch: 20, // 区域匹配度
  family: 20, // 家庭友好度
};

// ── 等级映射 ──
const TIER_SCORE = { 名校网: 5, 第二梯队: 3, 新来港推荐: 2.5 };

// ── 预算映射 ──
const BUDGET_SCORE = { 高: 3, 中: 2, 低: 1 };

/**
 * 匹配推荐校网 v2 — 加权多因子评分
 * @param {string} level — '幼儿园' | '小学' | '中学' | 'all'
 * @param {string} region — '港岛' | '九龙' | '新界' | 'all'
 * @param {string} budget — '低' | '中' | '高'
 * @returns {Array} 匹配的校网列表 (最多5条)
 */
module.exports.matchSchoolNets = function (level, region, budget) {
  const all = module.exports;
  const filtered = [];

  for (var i = 0; i < all.length; i++) {
    var net = all[i];
    if (typeof net.net !== 'number' && typeof net.net !== 'string') continue;
    if (level !== 'all' && net.level !== level) continue;
    if (region !== 'all' && net.region !== region) continue;
    filtered.push(net);
  }

  if (filtered.length === 0) {
    // 放宽区域限制
    for (i = 0; i < all.length; i++) {
      const n = all[i];
      if (typeof n.net !== 'number' && typeof n.net !== 'string') continue;
      if (level !== 'all' && n.level !== level) continue;
      filtered.push(n);
    }
  }

  // 加权评分
  const scored = [];
  for (i = 0; i < filtered.length; i++) {
    var net = filtered[i];
    var s = {};

    // 学术实力
    s.academic = (TIER_SCORE[net.tier] || 2) / 5;

    // 预算匹配
    const netBudgetScore = BUDGET_SCORE[net.budgetHint] || 2;
    const userBudgetScore = BUDGET_SCORE[budget] || 2;
    s.budgetMatch = 1 - Math.abs(netBudgetScore - userBudgetScore) / 2;

    // 区域匹配（精确匹配满分，跨区递减）
    s.regionMatch = region === net.region ? 1 : region === 'all' ? 0.8 : 0.4;

    // 家庭友好度
    s.family = net.familyRating / 5;

    // 加权总分
    var total = 0;
    Object.keys(SN_WEIGHTS).forEach(function (k) {
      total += s[k] * SN_WEIGHTS[k];
    });

    scored.push({
      net: net.net,
      name: net.name,
      tier: net.tier,
      level: net.level,
      schools: net.schools,
      vibe: net.vibe,
      region: net.region,
      familyRating: net.familyRating,
      budgetHint: net.budgetHint,
      score: Math.round(total * 10) / 10,
    });
  }

  scored.sort(function (a, b) {
    return b.score - a.score;
  });
  return scored.slice(0, 5);
};
