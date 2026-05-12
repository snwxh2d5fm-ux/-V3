/**
 * 住港伴 v4.1 — 方案库 v1.0 (PRD v3.1)
 * 12用户画像 × 推荐路径 × 风险评级 × 备选方案
 * 确定性规则匹配，不入AI推理
 */

const { APPLICATION_PATHS } = require('./constants');

/**
 * 12用户画像定义
 */
const PERSONAS = {
  1: {
    id: 1,
    name: '名校应届毕业生',
    ageRange: [22, 28],
    education: { min: '本科', preferred: ['硕士'], eligibleSchool: true },
    experience: { years: [0, 3], hasFamous: false, hasIntl: false },
    income: { annual: '<250万港币' },
    family: '通常单身',
    capital: '<500万',
    coreNeed: '快速拿到身份+留港发展',
    matchWeight: { student_iang: 100, ttps_c: 80, qmas: 30 }
  },
  2: {
    id: 2,
    name: '在职专业人士',
    ageRange: [28, 40],
    education: { min: '本科', eligibleSchool: false },
    experience: { years: [3, 15], hasFamous: '可能', hasIntl: '可能' },
    income: { annual: '30-200万港币' },
    family: '已婚/有子女',
    capital: '<500万',
    coreNeed: '保留内地工作+获取香港身份',
    matchWeight: { qmas: 100, ttps_b: 70, asmpt: 50 }
  },
  3: {
    id: 3,
    name: '高收入人士',
    ageRange: [30, 60],
    education: { min: '不限', eligibleSchool: '不限' },
    experience: { years: [5, 35], hasFamous: '可能', hasIntl: '可能' },
    income: { annual: '≥250万港币' },
    family: '各种',
    capital: '不确定',
    coreNeed: '最快速通道获取身份',
    matchWeight: { ttps_a: 100, cies: 60, qmas: 40 }
  },
  4: {
    id: 4,
    name: '企业主/创业者',
    ageRange: [35, 55],
    education: { min: '不限', eligibleSchool: '不限' },
    experience: { years: [10, 30], hasFamous: false, hasIntl: '可能' },
    income: { annual: '>100万港币(可能达250万+)' },
    family: '已婚/有子女',
    capital: '1000万+',
    coreNeed: '香港身份+商业拓展',
    matchWeight: { ttps_a: 90, cies: 80, qmas: 50, asmpt: 60 }
  },
  5: {
    id: 5,
    name: '兼读制进修者',
    ageRange: [28, 45],
    education: { min: '本科', eligibleSchool: false },
    experience: { years: [5, 20], hasFamous: '可能', hasIntl: '可能' },
    income: { annual: '30-200万港币' },
    family: '各种',
    capital: '<500万',
    coreNeed: '以学习为跳板获取香港身份',
    matchWeight: { parttime_qmas: 100, student_iang: 60, qmas: 50 }
  },
  6: {
    id: 6,
    name: '名校本科毕业生',
    ageRange: [22, 28],
    education: { min: '本科', eligibleSchool: true },
    experience: { years: [0, 5], hasFamous: '可能', hasIntl: '可能' },
    income: { annual: '<250万港币' },
    family: '单身',
    capital: '<500万',
    coreNeed: '合资格大学学士快速通道',
    matchWeight: { ttps_b: 100, ttps_c: 100, student_iang: 80 }
  },
  7: {
    id: 7,
    name: '海外华人回流',
    ageRange: [25, 50],
    education: { min: '本科', eligibleSchool: '可能' },
    experience: { years: [3, 25], hasFamous: '可能', hasIntl: true },
    income: { annual: '差异大' },
    family: '各种',
    capital: '可能较高',
    coreNeed: '获取/恢复香港身份',
    matchWeight: { qmas: 80, ttps_b: 70, asmpt: 60, cies: 50 }
  },
  8: {
    id: 8,
    name: 'STEM专业人才',
    ageRange: [25, 40],
    education: { min: '硕士', preferred: ['博士'], eligibleSchool: '可能', major: 'STEM' },
    experience: { years: [2, 15], hasFamous: '可能', hasIntl: '可能' },
    income: { annual: '30-150万港币' },
    family: '各种',
    capital: '<500万',
    coreNeed: '科技人才通道获取身份',
    matchWeight: { techtas: 100, qmas: 80, asmpt: 60 }
  },
  9: {
    id: 9,
    name: '陪读家长',
    ageRange: [30, 50],
    education: { min: '不限', eligibleSchool: false },
    experience: { years: [0, 20], hasFamous: false, hasIntl: false },
    income: { annual: '30-150万港币' },
    family: '已婚+未成年子女',
    capital: '中等',
    coreNeed: '子女在港上学+家庭在港团聚',
    matchWeight: { dependent: 100, minor_student: 80, asmpt: 40 }
  },
  10: {
    id: 10,
    name: '高净值投资者',
    ageRange: [35, 65],
    education: { min: '不限', eligibleSchool: '不限' },
    experience: { years: [10, 40], hasFamous: false, hasIntl: false },
    income: { annual: 'N/A' },
    family: '各种',
    capital: '≥3000万港币',
    coreNeed: '投资获取香港身份',
    matchWeight: { cies: 100, ttps_a: 40 }
  },
  11: {
    id: 11,
    name: '交换/短期学生',
    ageRange: [18, 30],
    education: { min: '在读', eligibleSchool: '是' },
    experience: { years: [0, 2], hasFamous: false, hasIntl: false },
    income: { annual: 'N/A(学生)' },
    family: '单身',
    capital: '<500万',
    coreNeed: '短期在港学习(不构成永居)',
    matchWeight: { exchange: 100 }
  },
  12: {
    id: 12,
    name: '未成年学生(无陪读家长)',
    ageRange: [6, 18],
    education: { min: '在读中小学', eligibleSchool: false },
    experience: { years: [0, 0], hasFamous: false, hasIntl: false },
    income: { annual: 'N/A(未成年)' },
    family: '父母不陪读/需监护人',
    capital: 'N/A(以家庭为单位)',
    coreNeed: '在港完成中小学教育',
    matchWeight: { minor_student: 100, dependent: 60 }
  }
};

/**
 * 路径特征匹配规则
 * 输入: 用户profile特征
 * 输出: 匹配路径列表(按匹配度排序)
 */
function matchPersonaToPaths(profile) {
  const scores = {};

  // 画像3: 高收入 → 高才A
  if (profile.income >= 2500000) {
    scores[APPLICATION_PATHS.TTPS_A] = (scores[APPLICATION_PATHS.TTPS_A] || 0) + 100;
  }

  // 画像6: 名校本科+年轻 → 高才B/C
  if (profile.eligibleSchool === true && profile.experience < 3 && profile.age <= 28) {
    scores[APPLICATION_PATHS.TTPS_C] = (scores[APPLICATION_PATHS.TTPS_C] || 0) + 100;
  }
  if (profile.eligibleSchool === true && profile.experience >= 3) {
    scores[APPLICATION_PATHS.TTPS_B] = (scores[APPLICATION_PATHS.TTPS_B] || 0) + 100;
  }

  // 画像1: 名校毕业生 → 学生→IANG
  if (profile.age <= 28 && profile.education === '本科' &&
      profile.eligibleSchool === true && profile.experience <= 3) {
    scores[APPLICATION_PATHS.STUDENT_IANG] = (scores[APPLICATION_PATHS.STUDENT_IANG] || 0) + 90;
  }

  // 画像8: STEM → TechTAS
  if (profile.major === 'STEM' && profile.experience >= 2) {
    scores[APPLICATION_PATHS.TECHTAS] = (scores[APPLICATION_PATHS.TECHTAS] || 0) + 80;
  }

  // 画像10: 高净值 → CIES
  if (profile.capital >= 30000000) {
    scores[APPLICATION_PATHS.CIES] = (scores[APPLICATION_PATHS.CIES] || 0) + 100;
  }

  // 画像13: 退休规划 → 退休身份规划(CIES/家属/优才)
  if (profile.age >= 50 && (profile.capital >= 30000000 || profile.purpose === 'retirement')) {
    scores[APPLICATION_PATHS.RETIREMENT] = (scores[APPLICATION_PATHS.RETIREMENT] || 0) + 90;
  }
  // CIES高净值人士也可触发退休推荐(即使年龄未满50)
  if (profile.capital >= 30000000 && profile.purpose === 'retirement') {
    scores[APPLICATION_PATHS.RETIREMENT] = (scores[APPLICATION_PATHS.RETIREMENT] || 0) + 95;
  }

  // 画像4: 企业主+高收入
  if (profile.companyType === 'enterprise_owner' && profile.income >= 2500000) {
    scores[APPLICATION_PATHS.TTPS_A] = (scores[APPLICATION_PATHS.TTPS_A] || 0) + 85;
    scores[APPLICATION_PATHS.CIES] = (scores[APPLICATION_PATHS.CIES] || 0) + 60;
  }

  // 画像5: 兼读制 → 优才
  if (profile.studyType === 'parttime' && profile.age >= 28) {
    scores[APPLICATION_PATHS.PARTTIME_QMAS] = (scores[APPLICATION_PATHS.PARTTIME_QMAS] || 0) + 80;
  }

  // 画像9: 陪读家长 → 受养人/未成年学生
  // 仅当用户明确为陪读家长(persona 9)时才触发，避免在职人士误判
  if (profile.persona === 9 && profile.hasKids === true && profile.age >= 30) {
    scores[APPLICATION_PATHS.DEPENDENT] = (scores[APPLICATION_PATHS.DEPENDENT] || 0) + 60;
    if (profile.childAge < 18) {
      scores[APPLICATION_PATHS.MINOR_STUDENT] = (scores[APPLICATION_PATHS.MINOR_STUDENT] || 0) + 50;
    }
  }

  // 画像11: 交换/短期学生 → 交换生
  if (profile.studyType === 'exchange' && profile.age <= 30) {
    scores[APPLICATION_PATHS.EXCHANGE] = (scores[APPLICATION_PATHS.EXCHANGE] || 100);
  }

  // 画像12: 未成年学生(无陪读家长) → 未成年学生路径
  if (profile.age < 18 && !profile.hasParentCompanion) {
    scores[APPLICATION_PATHS.MINOR_STUDENT] = (scores[APPLICATION_PATHS.MINOR_STUDENT] || 0) + 100;
  }

  // 优才QMAS: 12项准则是/否评核（2025年11月改革后）
  // 满足≥6项准则即可申请，匹配度基于满足的准则数
  var qmasCriteria = 0;
  if (profile.age <= 50) qmasCriteria++;                                    // A
  if (profile.educationLevel >= 2) qmasCriteria++;                          // B1
  if (profile.major === 'STEM') qmasCriteria++;                             // B2
  // C1: 具备中英双语能力（同时选中"中文/粤语"且"英语流利"）
  var hasChinese = profile.language && (profile.language.includes('中文') || profile.language.includes('粤语'));
  var hasEnglishFluent = profile.language && profile.language.includes('英语流利');
  if (hasChinese && hasEnglishFluent) qmasCriteria++;
  if (profile.englishProficient === true) qmasCriteria++;                   // C2
  if (profile.experience >= 5) qmasCriteria++;                              // D1
  if (profile.hasFamous === true && profile.experience >= 3) qmasCriteria++;// D2
  if (profile.isTargetIndustry === true && profile.experience >= 3) qmasCriteria++; // D3
  if (profile.hasIntlExp === true && profile.experience >= 2) qmasCriteria++;// D4
  if (profile.income >= 1000000) qmasCriteria++;                            // E
  if (profile.companyType === 'enterprise_owner' && profile.capital >= 5000000) qmasCriteria++; // F1
  if (profile.companyType === 'enterprise_owner' && profile.hasListedCompany === true) qmasCriteria++; // F2

  if (qmasCriteria >= 6) {
    // 匹配度：6项=50, 7项=60, ..., 12项=100
    var qmasScore = Math.min(100, 50 + (qmasCriteria - 6) * 10);
    scores[APPLICATION_PATHS.QMAS] = (scores[APPLICATION_PATHS.QMAS] || 0) + qmasScore;
  }

  // 排序
  const results = Object.entries(scores)
    .filter(([, score]) => score > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4);

  return results.map(([path, score]) => ({
    path,
    matchScore: Math.min(score, 100),
    confidence: score >= 80 ? 'high' : score >= 50 ? 'medium' : 'low'
  }));
}

/**
 * 方案库路径详情（用于决策节点展示）
 */
const PATH_DETAILS = {
  [APPLICATION_PATHS.STUDENT_IANG]: {
    pathId: APPLICATION_PATHS.STUDENT_IANG,
    name: '赴港升学就业通道',
    phases: [
      { phase: 'phase1_evaluation', duration: '3-6月', actions: ['获学校offer', '启动学生签证(6-8周)', '办理港澳通行证+逗留D签注', '经济准备(首年30-40万)'], confidence: 'B' },
      { phase: 'phase2_onboarding', duration: '0-6月', actions: ['入境激活e-Visa(3月内)', '办理香港身份证(30天)', '银行开户+租房+注册'], confidence: 'A' },
      { phase: 'phase3_maintenance', duration: '1-6年', actions: ['全日制学习', '申请IANG', 'IANG就业/创业', '续签(2-3年/次)'], confidence: 'A' },
      { phase: 'phase4_pr_sprint', duration: '第6-7年', actions: ['整理7年记录', '准备解释信(如长离港)', '提交永居核实申请'], confidence: 'A' }
    ],
    decisionPoints: ['dp1_initial_path', 'dp2_student_to_work', 'dp3_renewal_strategy', 'dp5_pr_sprint', 'dp6_family_sync'],
    riskLevel: 'low',
    keyRisks: ['学生签证到期前未及时申请IANG→身份断档', '毕业延迟需及时申请签证延期', 'IANG续签时失业需30天内找到新雇主'],
    firstVisa: '学生签(13-14月)',
    totalCycle: '7-8年'
  },
  [APPLICATION_PATHS.TTPS_A]: {
    pathId: APPLICATION_PATHS.TTPS_A,
    name: '高才通A类·高收入通道',
    phases: [
      { phase: 'phase1_evaluation', duration: '1-2周', actions: ['核实年收入≥250万港币', '准备收入证明材料'], confidence: 'A' },
      { phase: 'phase2_onboarding', duration: '0-3月', actions: ['在线递交申请(审批4周)', '下载e-Visa', '赴港激活签证'], confidence: 'A' },
      { phase: 'phase3_maintenance', duration: '1-6年', actions: ['36月首次签证', '续签(就业/创业)', 'MPF+税单积累'], confidence: 'B' },
      { phase: 'phase4_pr_sprint', duration: '第6-7年', actions: ['提前6月准备续签材料', '整理在港记录', '递交永居申请'], confidence: 'A' }
    ],
    decisionPoints: ['dp1_initial_path', 'dp3_renewal_strategy', 'dp5_pr_sprint'],
    riskLevel: 'low',
    keyRisks: ['续签时需证明在港就业或经济活动', '高才A续签关注经济贡献'],
    firstVisa: '36月',
    totalCycle: '7年'
  },
  [APPLICATION_PATHS.TTPS_B]: {
    pathId: APPLICATION_PATHS.TTPS_B,
    name: '高才通B类·名校学士通道',
    phases: [
      { phase: 'phase1_evaluation', duration: '1-2周', actions: ['确认学士为合资格大学', '确认≥3年工作经验'], confidence: 'A' },
      { phase: 'phase2_onboarding', duration: '0-2月', actions: ['在线递交申请(审批4周)', '下载e-Visa', '赴港激活'], confidence: 'A' },
      { phase: 'phase3_maintenance', duration: '1-6年', actions: ['24月首次签证', '就业或创业', '续签'], confidence: 'B' },
      { phase: 'phase4_pr_sprint', duration: '第6-7年', actions: ['整理7年在港记录', '永居申请'], confidence: 'A' }
    ],
    decisionPoints: ['dp1_initial_path', 'dp3_renewal_strategy', 'dp5_pr_sprint'],
    riskLevel: 'low',
    keyRisks: ['毕业证需在5年内颁发(B类)', '续签需在港就业'],
    firstVisa: '24月',
    totalCycle: '7年'
  },
  [APPLICATION_PATHS.TTPS_C]: {
    pathId: APPLICATION_PATHS.TTPS_C,
    name: '高才通C类·应届生通道',
    phases: [
      { phase: 'phase1_evaluation', duration: '1-2周', actions: ['确认学士为合资格大学', '确认毕业≤5年', '确认配额可用(年度10000名)'], confidence: 'A' },
      { phase: 'phase2_onboarding', duration: '0-2月', actions: ['在线递交申请', '下载e-Visa', '赴港激活'], confidence: 'A' },
      { phase: 'phase3_maintenance', duration: '1-6年', actions: ['24月首次签证', '就业或创业', '续签'], confidence: 'B' },
      { phase: 'phase4_pr_sprint', duration: '第6-7年', actions: ['永居申请'], confidence: 'A' }
    ],
    decisionPoints: ['dp1_initial_path', 'dp3_renewal_strategy', 'dp4_category_switch', 'dp5_pr_sprint'],
    riskLevel: 'medium',
    keyRisks: ['年度配额10000名，先到先得', '续签需在港就业'],
    firstVisa: '24月',
    totalCycle: '7年'
  },
  [APPLICATION_PATHS.QMAS]: {
    pathId: APPLICATION_PATHS.QMAS,
    name: '优才计划·综合计分制',
    phases: [
      { phase: 'phase1_evaluation', duration: '1-3月', actions: ['12项准则自评(≥6项)', '准备赴港计划书', '收集学历+工作+资产证明'], confidence: 'B' },
      { phase: 'phase2_onboarding', duration: '0-6月', actions: ['递交申请(审批3-6月)', '获批24月签证', '赴港激活'], confidence: 'B' },
      { phase: 'phase3_maintenance', duration: '1-6年', actions: ['2+3+3续签模式', '证明「通常居住」', 'MPF+税单'], confidence: 'C' },
      { phase: 'phase4_pr_sprint', duration: '第6-7年', actions: ['证明在港「通常居住」7年', '永居申请'], confidence: 'B' }
    ],
    decisionPoints: ['dp1_initial_path', 'dp3_renewal_strategy', 'dp4_category_switch', 'dp5_pr_sprint', 'dp6_family_sync'],
    riskLevel: 'medium_low',
    keyRisks: ['「通常居住」无硬性天数要求，但建议≥180天/年', '踩线6项者竞争激烈', '续签需主动证明与港联系'],
    firstVisa: '24月',
    totalCycle: '7-8年'
  }
};

// 补充所有12条路径详情
const ALL_PATH_DETAILS = {
  ...PATH_DETAILS,
  [APPLICATION_PATHS.PARTTIME_QMAS]: {
    pathId: APPLICATION_PATHS.PARTTIME_QMAS,
    name: '兼读制→优才/专才→永居',
    decisionPoints: ['dp1_initial_path', 'dp4_category_switch', 'dp5_pr_sprint'],
    riskLevel: 'medium_high',
    keyRisks: ['兼读制不能申IANG(A级确认)', '旅游签短期入境上课属法律灰色地带(D级)', '需毕业后另寻路径获取身份'],
    firstVisa: '—',
    totalCycle: '7-9年'
  },
  [APPLICATION_PATHS.ASMTP]: {
    pathId: APPLICATION_PATHS.ASMTP,
    name: '专才计划·雇主担保',
    decisionPoints: ['dp1_initial_path', 'dp3_renewal_strategy', 'dp4_category_switch', 'dp5_pr_sprint'],
    riskLevel: 'medium',
    keyRisks: ['绑雇主: 换雇主需重新申请', '雇主撤回sponsor则身份中断'],
    firstVisa: '~2年',
    totalCycle: '7年'
  },
  [APPLICATION_PATHS.TECHTAS]: {
    pathId: APPLICATION_PATHS.TECHTAS,
    name: '科技人才入境计划',
    decisionPoints: ['dp1_initial_path', 'dp3_renewal_strategy', 'dp5_pr_sprint'],
    riskLevel: 'low',
    keyRisks: ['需符合合资格科技领域', '需合资格雇主sponsor'],
    firstVisa: '2年',
    totalCycle: '7年'
  },
  [APPLICATION_PATHS.CIES]: {
    pathId: APPLICATION_PATHS.CIES,
    name: '资本投资者入境计划',
    decisionPoints: ['dp1_initial_path', 'dp5_pr_sprint'],
    riskLevel: 'low',
    keyRisks: ['需持续持有合资格资产', '资产变现需谨慎(影响身份)'],
    firstVisa: '—',
    totalCycle: '8-9年'
  },
  [APPLICATION_PATHS.DEPENDENT]: {
    pathId: APPLICATION_PATHS.DEPENDENT,
    name: '受养人签证',
    decisionPoints: ['dp6_family_sync'],
    riskLevel: 'low',
    keyRisks: ['受养人签证跟随主申', '受养人独立申请永居需等主申获批', '学生签证受养人不得在港工作 [A]'],
    firstVisa: '跟随主申',
    totalCycle: '7年(跟随主申)'
  },
  [APPLICATION_PATHS.MINOR_STUDENT]: {
    pathId: APPLICATION_PATHS.MINOR_STUDENT,
    name: '未成年学生签证',
    decisionPoints: ['dp1_initial_path', 'dp6_family_sync'],
    riskLevel: 'medium',
    keyRisks: ['需指定在港监护人', '监护人变更需通知入境处', '未满18岁申请受限'],
    firstVisa: '按学制',
    totalCycle: '7-10年'
  },
  [APPLICATION_PATHS.EXCHANGE]: {
    pathId: APPLICATION_PATHS.EXCHANGE,
    name: '交流交换项目',
    decisionPoints: [],
    riskLevel: 'low',
    keyRisks: ['交换期不构成永居时长', '不能申IANG', '到期必须离港'],
    firstVisa: '短期学生签(4-6月)',
    totalCycle: '4-6月(不构成永居路径)'
  },

  [APPLICATION_PATHS.RETIREMENT]: {
    pathId: APPLICATION_PATHS.RETIREMENT,
    name: '退休身份规划',
    decisionPoints: ['dp1_initial_path', 'dp5_pr_sprint'],
    riskLevel: 'medium',
    keyRisks: [
      'CIES需维持3000万投资至永居获批',
      '通过家属签证退休需主申维持身份',
      '退休期间不在港天数须控制(每半年入境1次)'
    ],
    firstVisa: '24月(CIES)/跟随主申(家属)',
    totalCycle: '8-9年(CIES)/跟随主申(家属)',
    phases: [
      { phase: 'phase1_evaluation', duration: '2-4周', actions: [
        '评估资产规模(CIES需证明3000万可投资资产)',
        '确认退休身份路径(CIES投资/家属签证/优才评分)',
        '准备资产来源证明文件(银行流水/完税证明/资产评估)',
        '如选择CIES:预约合资格金融中介开立投资账户'
      ], confidence: 'A' },
      { phase: 'phase2_onboarding', duration: '3-6月', actions: [
        'CIES:完成3000万港币合资格投资(股票/债券/基金/保险)',
        '提交CIES申请至入境事务处(投推署预先审核)',
        '或通过家属签证(配偶/子女为香港居民)申请受养人身份',
        '获批后领取香港身份证'
      ], confidence: 'A' },
      { phase: 'phase3_maintenance', duration: '7-8年', actions: [
        'CIES:每年提交投资组合审核报告至投推署',
        'CIES:投资收益可自由支配，但本金不得撤回',
        '每6个月至少入境1次维持身份连续性',
        '每年续签1次(CIES)或跟随主申续签(家属)'
      ], confidence: 'B' },
      { phase: 'phase4_pr_sprint', duration: '1-2年', actions: [
        '连续居住满7年申请永居',
        'CIES:提交投资维持证明+居住记录',
        '准备通常居住证明材料(水电单/银行账单/税单/社团记录)',
        '提交ROP145表申请核实永居资格'
      ], confidence: 'A' }
    ]
  }

};

/**
 * 决策节点方案对比数据
 */
const DECISION_COMPARISONS = {
  dp2_student_to_work: {
    options: [
      { option: 'A', label: 'IANG', passRate: '>95%', cycle: '2+2+3', risk: '低', note: '不绑雇主，毕业即可申请' },
      { option: 'B', label: '优才', passRate: '~70%', cycle: '2+3+3', risk: '中', note: '12项准则≥6项，6-12月审批' },
      { option: 'C', label: '专才', passRate: '>90%', cycle: '视雇主', risk: '中', note: '需有香港雇主sponsor' },
      { option: 'D', label: '高才B/C', passRate: '>95%', cycle: '2+3+3', risk: '低', note: '须合资格大学学士' }
    ]
  },
  dp3_renewal_strategy: {
    options: [
      { option: 'A', label: '雇主续签', passRate: '高', risk: '低', note: '传统方式，需雇主配合提供ID990B' },
      { option: 'B', label: '自雇续签', passRate: '中高', risk: '中', note: '注册香港公司+实际运营+租办公室' },
      { option: 'C', label: '创业续签', passRate: '中', risk: '中高', note: '需证明业务在港实际运营(收入+雇员+办公)' }
    ]
  }
};

module.exports = {
  PERSONAS,
  ALL_PATH_DETAILS,
  DECISION_COMPARISONS,
  matchPersonaToPaths
};
