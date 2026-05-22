/**
 * 住港伴 v4.1 — 五级置信度框架 (PRD v3.1)
 *
 * 基于 V5 Answer Key 校验结果
 * A: Cap.115/基本法明确，无争议 ~55%
 * B: 入境处政策明确，有公开指引 ~30%
 * C: 多数实践一致，入境处有酌情权 ~10%
 * D: 法律/政策未明确，合理推断 ~4%
 * E: 无法确认，须个案咨询 ~1%
 */

const CONFIDENCE = {
  A: {
    level: 'A',
    label: '法源明确',
    fullLabel: 'A级·法源明确',
    description: 'Cap.115/基本法明确，无争议',
    color: '#059669',
    bg: '#ECFDF5',
    border: '#A7F3D0',
    textColor: '#047857',
    icon: '📜',
    showBanner: false,
    isAuthoritative: true,
    canAutoApply: true,
  },
  B: {
    level: 'B',
    label: '政策明确',
    fullLabel: 'B级·政策明确',
    description: '入境处政策明确，有公开指引',
    color: '#2563EB',
    bg: '#EFF6FF',
    border: '#BFDBFE',
    textColor: '#1D4ED8',
    icon: '📋',
    showBanner: false,
    isAuthoritative: true,
    canAutoApply: true,
  },
  C: {
    level: 'C',
    label: '多数实践',
    fullLabel: 'C级·多数实践',
    description: '多数实践一致，入境处有酌情权',
    color: '#EA580C',
    bg: '#FFF7ED',
    border: '#FED7AA',
    textColor: '#C2410C',
    icon: '📊',
    showBanner: false,
    isAuthoritative: false,
    canAutoApply: false,
    needsConfirmation: true,
  },
  D: {
    level: 'D',
    label: '合理推断',
    fullLabel: 'D级·合理推断',
    description: '法律/政策未明确，合理推断',
    color: '#DC2626',
    bg: '#FEF2F2',
    border: '#FECACA',
    textColor: '#B91C1C',
    icon: '💡',
    showBanner: true,
    bannerText: '⚠️ 以下内容基于合理推断，入境处有酌情权，建议个案咨询',
    isAuthoritative: false,
    canAutoApply: false,
  },
  E: {
    level: 'E',
    label: '无法确认',
    fullLabel: 'E级·无法确认',
    description: '无法确认，须个案咨询',
    color: '#9CA3AF',
    bg: '#F3F4F6',
    border: '#E5E7EB',
    textColor: '#6B7280',
    icon: '❓',
    showBanner: true,
    bannerText: '此问题建议直接咨询入境处或持证律师',
    isAuthoritative: false,
    canAutoApply: false,
    hideContent: true,
  },
};

/**
 * 法源强度标注
 */
const LEGAL_SOURCE = {
  STATUTE: { type: 'statute', label: '法典', icon: '📜', weight: 5, description: '成文法条文' },
  POLICY: { type: 'policy', label: '政策', icon: '📋', weight: 4, description: '入境处公开政策' },
  PRECEDENT: { type: 'precedent', label: '判例', icon: '⚖️', weight: 3, description: '司法判例' },
  PRACTICE: { type: 'practice', label: '惯例', icon: '📊', weight: 2, description: '行政惯例' },
  INFERENCE: { type: 'inference', label: '推断', icon: '💡', weight: 1, description: '合理推断' },
};

/**
 * 法律条文引用格式规范
 * Cap.115 → 《入境条例》(第115章)
 * 基本法 → 《基本法》
 * 入境处指引 → 入境处指引(ID XXX)
 */
const LEGAL_CITATION_FORMAT = {
  cap115: { prefix: '《入境条例》(Cap.115)', separator: 's.' },
  basicLaw: { prefix: '《基本法》', separator: '第' },
  immdGuide: { prefix: '入境处指引', separator: '(ID ' },
};

/**
 * 置信度驱动的展示规则
 */
function getConfidenceDisplay(level) {
  const c = CONFIDENCE[level];
  if (!c) return CONFIDENCE.D;

  return {
    level: c.level,
    label: c.fullLabel,
    color: c.color,
    bg: c.bg,
    icon: c.icon,
    showBanner: c.showBanner || false,
    bannerText: c.bannerText || '',
    hideContent: c.hideContent || false,
    isAuthoritative: c.isAuthoritative || false,
  };
}

/**
 * 判断规则是否可自动生效
 * A/B级: 自动生效
 * C级: 需用户确认后生效
 * D级: 不建议作为规则
 */
function getRuleAutoApply(level) {
  if (level === 'A' || level === 'B') return 'auto';
  if (level === 'C') return 'confirm';
  return 'disabled';
}

/**
 * 格式化法律条文引用
 * @param {string} type - 'cap115' | 'basicLaw' | 'immdGuide'
 * @param {string} ref  - 's.11(8)' | '第24条' | '910'
 */
function formatLegalCitation(type, ref) {
  const fmt = LEGAL_CITATION_FORMAT[type];
  if (!fmt) return ref;
  return `${fmt.prefix} ${fmt.separator}${ref}`;
}

/**
 * P0法律条文修正映射表 (V5校验)
 */
const P0_LEGAL_FIXES = {
  // s.2A → s.11(8): 入境处处长对逗留条件的酌情权
  's.2A': {
    wrong: 's.2A (居留权定义)',
    correct: 's.11(8) (入境处处长酌情权)',
    reason: 's.2A定义「居留权」(right of abode)，非「视为合法逗留」机制',
    confidence: 'B',
  },
  // s.42 → s.38A: 虚假陈述
  's.42': {
    wrong: 's.42 (船长/机长未提交船员/乘客名单)',
    correct: 's.38A (向入境事务主任或入境事务助理员作出虚假陈述)',
    reason: '虚假陈述条文为s.38A，非s.42',
    confidence: 'A',
  },
};

/**
 * P0政策修正 (V5校验)
 */
const P0_POLICY_FIXES = {
  student_dependent: {
    title: '学生签证受养人政策',
    wrongStatement: '学生签证不可携带受养人',
    correctStatement: '学位课程学生签证持有人可以携带配偶和未满18岁未婚子女以受养人身份来港',
    restrictions: '受养人不得在港工作；受养人可在港学习；须证明有足够经济能力',
    exception: 'VPAS高级文凭学生(2025年10月起)不可携带受养人',
    effectiveDate: '持续有效',
    confidence: 'A',
    source: '入境处受养人签证政策；Study in Hong Kong官方指引',
  },
  student_work: {
    title: '学生签证工作限制',
    wrongStatement: '学生签证持有人在学期间每周限工作20小时，寒暑假可全职',
    correctStatement: '自2023年11月(研究生)及2024年11月(本科生)起，全日制非本地学生的工作限制已暂时取消',
    conditions: '需通过学校向入境处申请NOL(不反对通知书)；交换生和访问学生不适用',
    caveat: '此安排属临时措施(2025年检讨中，可能调整)',
    effectiveDate: '2023-11(研究生) / 2024-11(本科生)',
    confidence: 'A',
    source: '政府新闻公报2024年10月18日；2023年施政报告',
  },
};

module.exports = {
  CONFIDENCE,
  LEGAL_SOURCE,
  LEGAL_CITATION_FORMAT,
  getConfidenceDisplay,
  getRuleAutoApply,
  formatLegalCitation,
  P0_LEGAL_FIXES,
  P0_POLICY_FIXES,
};
