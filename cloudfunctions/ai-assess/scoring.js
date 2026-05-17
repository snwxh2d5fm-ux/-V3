/**
 * 住港伴 — 5路径评分引擎 (ai-assess/scoring)
 * 从旧版 Taro 云函数提取，适配新版原生框架
 *
 * 评估路径：QMAS / TTPS / ASMTP / IANG / 资本投资者入境
 * 评分规则基于 2026年香港入境政策
 */

var APPLICATION_PATHS = {
  QMAS: { id: 'qmas', name: '优才计划', fullName: '优秀人才入境计划' },
  TTPS: { id: 'ttps', name: '高才通', fullName: '高端人才通行证计划' },
  ASMPT: { id: 'asmpt', name: '专才', fullName: '输入内地人才计划' },
  IANG: { id: 'iang', name: 'IANG', fullName: '非本地毕业生留港/回港就业安排' },
  INVESTMENT: { id: 'inv', name: '资本投资者入境计划', fullName: '资本投资者入境计划' },
};

/**
 * 优才计划评分 (12项准则)
 * 新版（2025年11月起）：满足≥6项可获得申请资格
 */
function scoreQMAS(answers) {
  var criteriaMet = 0;
  var details = [];
  var maxCriteria = 12;

  // A. 年龄：是否50岁或以下
  var age = answers.age || '';
  if (age.indexOf('50岁') > -1 || age.indexOf('45-50') > -1 || age.indexOf('18-25') > -1 ||
      age.indexOf('26-30') > -1 || age.indexOf('31-39') > -1 || age.indexOf('40-44') > -1) {
    criteriaMet++;
    details.push('A. 年龄≤50岁 ✓');
  } else {
    details.push('A. 年龄>50岁 ✗');
  }

  // B1. 学历：是否持有合资格大学硕博学位
  var edu = answers.education || '';
  var school = answers.school || '';
  var isQualifiedUni = school.indexOf('QS') > -1 || school.indexOf('百强') > -1 ||
                       school.indexOf('香港') > -1 || school.indexOf('海外') > -1;
  if ((edu.indexOf('博士') > -1 || edu.indexOf('硕士') > -1) && isQualifiedUni) {
    criteriaMet++;
    details.push('B1. 合资格大学硕博学位 ✓');
  } else if (edu.indexOf('博士') > -1 || edu.indexOf('硕士') > -1) {
    // 有硕博但学校不在合资格名单，仍可能满足（合资格大学名单较宽）
    criteriaMet++;
    details.push('B1. 硕博学位 ✓（需确认是否合资格大学）');
  } else {
    details.push('B1. 无硕博学位 ✗');
  }

  // B2. 学历：是否STEM学科
  var major = answers.major || '';
  var stemFields = ['STEM', '科学', '科技', '工程', '数学', '技术'];
  var isStem = stemFields.some(function (f) { return major.indexOf(f) > -1; });
  if (isStem) {
    criteriaMet++;
    details.push('B2. STEM学科 ✓');
  } else {
    details.push('B2. 非STEM学科 ✗');
  }

  // C1. 语言：是否具备两种语言能力（中文+英文）
  var lang = answers.language || '';
  var hasEnglish = lang.indexOf('英语') > -1;
  var hasChinese = lang.indexOf('中文') > -1 || lang.indexOf('母语') > -1;
  // 选项如"英语（流利）"默认中文母语用户，视为双语
  var hasTwoLangs = (hasEnglish && hasChinese) || lang.indexOf('英语') > -1;
  if (hasTwoLangs) {
    criteriaMet++;
    details.push('C1. 两种语言能力 ✓');
  } else {
    details.push('C1. 两种语言能力不足 ✗');
  }

  // C2. 语言：英文是否达标（流利=达标）
  var isEnglishGood = lang.indexOf('流利') > -1 || lang.indexOf('雅思') > -1 ||
                      lang.indexOf('托福') > -1 || lang.indexOf('六级') > -1;
  if (isEnglishGood) {
    criteriaMet++;
    details.push('C2. 英文达标 ✓');
  } else {
    details.push('C2. 英文未达标 ✗');
  }

  // D1. 工作：是否5年以上学位程度经验
  var exp = answers.experience || '';
  if (exp.indexOf('5-10') > -1 || exp.indexOf('10年') > -1) {
    criteriaMet++;
    details.push('D1. 5年以上经验 ✓');
  } else {
    details.push('D1. 经验不足5年 ✗');
  }

  // D2. 工作：是否3年以上名企经验
  var company = answers.company || '';
  var isTopCompany = company.indexOf('500强') > -1 || company.indexOf('上市') > -1 ||
                     company.indexOf('知名') > -1 || company.indexOf('龙头') > -1;
  if (isTopCompany && (exp.indexOf('3-5') > -1 || exp.indexOf('5-10') > -1 || exp.indexOf('10年') > -1)) {
    criteriaMet++;
    details.push('D2. 3年以上名企经验 ✓');
  } else {
    details.push('D2. 无名企经验 ✗');
  }

  // D3. 工作：是否3年以上创新科技/金融/贸易行业经验
  var industry = answers.industry || '';
  var isTargetIndustry = ['金融', '会计', '资讯科技', '科技', '工程', '贸易'].some(function (i) {
    return industry.indexOf(i) > -1;
  });
  if (isTargetIndustry && (exp.indexOf('3-5') > -1 || exp.indexOf('5-10') > -1 || exp.indexOf('10年') > -1)) {
    criteriaMet++;
    details.push('D3. 3年以上创科/金融/贸易经验 ✓');
  } else {
    details.push('D3. 无创科/金融/贸易经验 ✗');
  }

  // D4. 工作：是否2年以上国际经验
  var hasIntlExp = company.indexOf('海外') > -1 || industry.indexOf('海外') > -1 ||
                   lang.indexOf('粤语') > -1;
  if (hasIntlExp && (exp.indexOf('3-5') > -1 || exp.indexOf('5-10') > -1 || exp.indexOf('10年') > -1)) {
    criteriaMet++;
    details.push('D4. 2年以上国际经验 ✓');
  } else {
    details.push('D4. 无国际经验 ✗');
  }

  // E. 收入：申请前一年收入是否≥100万港币
  var income = answers.income || '';
  // 注意顺序：先排除"50-100万"（含"100"子串但实际<100万），再匹配≥100万
  var isLowIncome = income.indexOf('低于') > -1 || income.indexOf('30万') > -1 ||
                    income.indexOf('30-50') > -1 || income.indexOf('50-100') > -1;
  var isHighIncome = (income.indexOf('100-250') > -1 || income.indexOf('250万') > -1 ||
                      income.indexOf('200万') > -1 || income.indexOf('300万') > -1 ||
                      income.indexOf('500万') > -1);
  if (isHighIncome) {
    criteriaMet++;
    details.push('E. 年收入≥100万港币 ✓');
  } else if (isLowIncome) {
    details.push('E. 年收入<100万港币 ✗');
  } else if (income.indexOf('100万') > -1) {
    // 精确"100万"选项（非50-100）
    criteriaMet++;
    details.push('E. 年收入≥100万港币 ✓');
  } else {
    details.push('E. 年收入<100万港币 ✗');
  }

  // F1. 企业：是否拥有年盈利≥500万港币企业
  var isBizOwner = company.indexOf('创业') > -1 || company.indexOf('自雇') > -1;
  if (isBizOwner && (income.indexOf('250万') > -1 || income.indexOf('100万') > -1 || income.indexOf('100-250') > -1)) {
    criteriaMet++;
    details.push('F1. 拥有盈利企业 ✓（需核实≥500万）');
  } else {
    details.push('F1. 无盈利企业 ✗');
  }

  // F2. 企业：是否持上市公司≥10%股权
  if (company.indexOf('上市') > -1) {
    criteriaMet++;
    details.push('F2. 上市公司持股 ✓（需核实≥10%）');
  } else {
    details.push('F2. 无上市公司持股 ✗');
  }

  var probability = Math.min(95, Math.max(15, Math.round((criteriaMet / maxCriteria) * 100)));
  var isQualified = criteriaMet >= 6;

  return {
    pathId: APPLICATION_PATHS.QMAS.id,
    pathName: APPLICATION_PATHS.QMAS.name,
    score: criteriaMet,
    maxScore: maxCriteria,
    probability: probability,
    isQualified: isQualified,
    details: details,
    summary: isQualified ? '满足申请资格（' + criteriaMet + '/12项准则）' : '暂不满足（' + criteriaMet + '/12项准则，需≥6项）',
    estimatedTimeline: '6-12个月',
    estimatedCost: 'HKD 1,500（含申请费+材料费）',
  };
}

/**
 * 高才通评分
 */
function scoreTTPS(answers) {
  var income = answers.income || '';
  var school = answers.school || '';
  var edu = answers.education || '';
  var exp = answers.experience || '';

  var candidates = [];

  // A类：年收入≥250万港币
  var isHighIncome = income.indexOf('250万') > -1 || income.indexOf('300万') > -1 ||
                     income.indexOf('500万') > -1;
  if (isHighIncome) {
    candidates.push('A类');
  }

  // B类：合资格大学学士学位 + 过去5年内≥3年工作经验
  // C类：合资格大学学士学位 + 过去5年内<3年工作经验（年度配额10000）
  // ⚠️ 高才通B/C仅认可合资格大学「学士学位」，硕士/博士不单独构成资格
  var isQualifiedUni = school.indexOf('QS') > -1 || school.indexOf('百强') > -1;
  var hasBachelors = edu.indexOf('本科') > -1 || edu.indexOf('学士') > -1;
  if (isQualifiedUni && hasBachelors) {
    // 注意 "1-3年" 含 "3年" 子串，需先排除
    var isShortExp = exp.indexOf('1-3') > -1 || exp.indexOf('1年') > -1 || exp.indexOf('以下') > -1;
    var has3yrExp = (exp.indexOf('3-5') > -1 || exp.indexOf('5-10') > -1 || exp.indexOf('10年') > -1);
    if (has3yrExp && !isShortExp) {
      candidates.push('B类');
    } else {
      candidates.push('C类（限额）');
    }
  }

  var classCount = candidates.length;
  var probability = classCount > 0 ? Math.min(95, 75 + classCount * 10) : 20;

  return {
    pathId: APPLICATION_PATHS.TTPS.id,
    pathName: APPLICATION_PATHS.TTPS.name,
    score: classCount,
    maxScore: 3,
    probability: probability,
    isQualified: classCount > 0,
    details: candidates.length > 0
      ? ['符合条件：' + candidates.join('/')]
      : ['未达到A/B/C类硬性门槛'],
    summary: candidates.length > 0
      ? '符合' + candidates.join('/') + '条件'
      : '暂不符合高才通条件',
    estimatedTimeline: '1-3个月',
    estimatedCost: 'HKD 230（官方申请费）',
  };
}

/**
 * 专才评分
 */
function scoreASMPT(answers) {
  var industry = answers.industry || '';
  var exp = answers.experience || '';
  var edu = answers.education || '';

  var score = 0;
  var details = [];

  // 默认假设用户已有/可获取香港雇主担保
  score += 2;
  details.push('需香港雇主担保（假设有）');

  if (edu.indexOf('硕士') > -1 || edu.indexOf('博士') > -1) {
    score++;
    details.push('高学历 ✓');
  } else if (edu.indexOf('本科') > -1) {
    score++;
    details.push('本科学历 ✓');
  }

  if (exp.indexOf('3-5') > -1 || exp.indexOf('5-10') > -1 || exp.indexOf('10年') > -1 || exp.indexOf('3年') > -1) {
    score++;
    details.push('有工作经验 ✓');
  }

  var inDemandIndustries = ['金融', '资讯科技', '科技', '工程', '医疗', '法律'];
  if (inDemandIndustries.some(function (i) { return industry.indexOf(i) > -1; })) {
    score++;
    details.push('紧缺行业 ✓');
  }

  var probability = Math.min(85, 50 + score * 10);

  return {
    pathId: APPLICATION_PATHS.ASMPT.id,
    pathName: APPLICATION_PATHS.ASMPT.name,
    score: score,
    maxScore: 5,
    probability: probability,
    isQualified: true, // 专才只要有雇主担保即可
    details: details,
    summary: '需落实香港雇主担保',
    estimatedTimeline: '2-4个月',
    estimatedCost: 'HKD 500（含申请费）',
  };
}

/**
 * IANG评分
 */
function scoreIANG(answers) {
  var school = answers.school || '';
  var edu = answers.education || '';

  var isHKGrad = school.indexOf('香港') > -1;
  var hasDegree = edu.indexOf('本科') > -1 || edu.indexOf('硕士') > -1 || edu.indexOf('博士') > -1;

  if (isHKGrad && hasDegree) {
    return {
      pathId: APPLICATION_PATHS.IANG.id,
      pathName: APPLICATION_PATHS.IANG.name,
      score: 2,
      maxScore: 2,
      probability: 90,
      isQualified: true,
      details: ['符合IANG条件（香港高校毕业生）'],
      summary: '适合香港高校毕业生',
      estimatedTimeline: '1-2个月',
      estimatedCost: 'HKD 230',
    };
  }

  return {
    pathId: APPLICATION_PATHS.IANG.id,
    pathName: APPLICATION_PATHS.IANG.name,
    score: 0,
    maxScore: 2,
    probability: 15,
    isQualified: false,
    details: ['非香港高校毕业生'],
    summary: '非香港高校毕业生不适合此路径',
    estimatedTimeline: '-',
    estimatedCost: '-',
  };
}

/**
 * 资本投资者入境计划对照
 */
function scoreInvestment(answers) {
  var income = answers.income || '';
  var score = 0;

  if (income.indexOf('250万') > -1) { score++; }

  var probability = 30 + score * 20;

  return {
    pathId: APPLICATION_PATHS.INVESTMENT.id,
    pathName: APPLICATION_PATHS.INVESTMENT.name,
    score: score,
    maxScore: 2,
    probability: Math.min(80, probability),
    isQualified: false, // 默认不满足（需≥3000万资产，不在评估问题范围内）
    details: ['资本投资者入境计划需≥3000万港币资产', '需提供资金来源证明'],
    summary: '需要大额资产证明',
    estimatedTimeline: '3-6个月',
    estimatedCost: 'HKD 30,000,000+（投资额）',
  };
}

module.exports = {
  APPLICATION_PATHS: APPLICATION_PATHS,
  scoreQMAS: scoreQMAS,
  scoreTTPS: scoreTTPS,
  scoreASMPT: scoreASMPT,
  scoreIANG: scoreIANG,
  scoreInvestment: scoreInvestment,
};
