/**
 * 住港伴 v5.1 — 画像×路径兼容矩阵
 * 用于评估结果页校验：用户身份画像 vs 推荐路径是否合理
 * 
 * 三级兼容:
 *   compatible  ✅ 适合该画像的标准路径
 *   conditional ⚠️ 可能但不典型（需额外条件）
 *   incompatible ❌ 与该画像身份矛盾（除非特殊情况）
 */
const PERSONAS = {
  STUDENT: 1,      // 在校学生
  EMPLOYED: 2,     // 在职人士
  OWNER: 4,        // 企业主
  OVERSEAS: 7      // 海外华人
};

const COMPATIBILITY = {
  compatible:   { label: '✅ 适合',        cls: 'compatible',   color: '#059669', bg: '#ECFDF5' },
  conditional:  { label: '⚠️ 需确认条件',   cls: 'conditional',  color: '#EA580C', bg: '#FFF7ED' },
  incompatible: { label: '❌ 通常不适合',    cls: 'incompatible', color: '#DC2626', bg: '#FEF2F2' }
};

/**
 * 矩阵: persona → { pathKey: compatibilityLevel }
 */
const MATRIX = {
  [PERSONAS.STUDENT]: {
    student_iang:    'compatible',   // 全日制学生 → IANG 是主路径
    ttps_c:          'compatible',   // 合资格大学应届 → 高才C
    exchange:        'compatible',   // 交换生路径
    ttps_b:          'conditional',  // 需 ≥3年经验，应届生通常不满足
    dependent:       'conditional',  // 作为配偶/父母的受养人
    minor_student:   'conditional',  // 仅限 <18岁
    parttime_qmas:   'conditional',  // 兼读制进修
    qmas:            'incompatible', // 需工作经验/收入，应届生通常不够
    ttps_a:          'incompatible', // 需年收入 ≥HK$250万
    asmpt:           'incompatible', // 需雇主担保+通常≥2年经验
    techtas:         'incompatible', // 需雇主+经验
    cies:            'incompatible', // 需 ≥HK$3,000万净资产
    retirement:      'incompatible'  // 退休路径不适用在校学生
  },

  [PERSONAS.EMPLOYED]: {
    qmas:            'compatible',   // 在职专业人士主路径
    ttps_b:          'compatible',   // 合资格学士+≥3年经验
    ttps_a:          'compatible',   // 高收入通道
    asmpt:           'compatible',   // 香港雇主担保
    techtas:         'compatible',   // STEM+香港雇主
    cies:            'compatible',   // 高净值（资产≥3000万）
    retirement:      'conditional',  // 需年龄≥50+资产≥3000万或CIES投资
    ttps_c:          'conditional',  // <3年经验，在职但年限短
    dependent:       'conditional',  // 作为配偶受养人（如配偶为主申）
    student_iang:    'conditional',  // 回校深造场景
    parttime_qmas:   'conditional',  // 兼读制进修后转路径
    exchange:        'incompatible', // 交换生不适用在职人士
    minor_student:   'incompatible'  // 未成年不适用
  },

  [PERSONAS.OWNER]: {
    ttps_a:          'compatible',   // 企业主高收入 → 高才A
    cies:            'compatible',   // 资本投资主路径
    retirement:      'compatible',   // 企业主退休规划 → CIES/家属签证
    qmas:            'compatible',   // 优才（企业主背景加分）
    asmpt:           'compatible',   // 在港注册公司 → 自雇专才
    ttps_b:          'conditional',  // 需合资格学士+经验
    techtas:         'conditional',  // 科技企业主
    dependent:       'conditional',  // 通过家庭成员
    student_iang:    'incompatible', // 企业主不适用学生路径
    ttps_c:          'incompatible', // 应届生通道
    exchange:        'incompatible',
    minor_student:   'incompatible',
    parttime_qmas:   'incompatible'  // 企业主不需进修跳板
  },

  [PERSONAS.OVERSEAS]: {
    qmas:            'compatible',   // 海外华人主路径
    ttps_b:          'compatible',   // 合资格学士+经验+国际经验加分
    ttps_a:          'compatible',   // 高收入通道
    asmpt:           'compatible',   // 香港雇主
    cies:            'compatible',   // 高净值
    retirement:      'compatible',   // 海外华人退休到香港 → CIES
    techtas:         'conditional',  // STEM背景
    dependent:       'conditional',  // 家庭团聚
    ttps_c:          'conditional',  // 需合资格学士+<3年经验
    student_iang:    'incompatible', // 不适用于海外已就业人士
    exchange:        'incompatible',
    minor_student:   'incompatible',
    parttime_qmas:   'incompatible'
  }
};

/**
 * 获取某个路径对某个画像的兼容级别
 * @param {number} persona - 画像ID (1|2|4|7)
 * @param {string} path - 路径key (如 'qmas', 'ttps_a')
 * @returns {object} { level, label, color, bg }
 */
function getCompatibility(persona, path) {
  if (!MATRIX[persona]) {
    return { level: 'conditional', ...COMPATIBILITY.conditional };
  }
  const level = MATRIX[persona][path] || 'conditional';
  return { level, ...COMPATIBILITY[level] };
}

/**
 * 检查最佳匹配是否兼容当前画像
 * @returns {{ ok: boolean, warning: string|null }}
 */
function validateBestMatch(persona, bestPath) {
  const comp = getCompatibility(persona, bestPath);
  if (comp.level === 'incompatible') {
    return {
      ok: false,
      warning: `你选择的身份「${getPersonaName(persona)}」与推荐路径「${bestPath}」通常不匹配。建议检查评估答案是否准确，或考虑切换身份状态后重新评估。`
    };
  }
  if (comp.level === 'conditional') {
    return {
      ok: true,
      warning: `该路径在「${getPersonaName(persona)}」身份下需要额外条件才能成立。请确认你满足路径的具体要求。`
    };
  }
  return { ok: true, warning: null };
}

function getPersonaName(persona) {
  const names = { 1: '在校学生', 2: '在职人士', 4: '企业主', 7: '海外华人' };
  return names[persona] || '未知';
}

module.exports = {
  PERSONAS,
  COMPATIBILITY,
  MATRIX,
  getCompatibility,
  validateBestMatch,
  getPersonaName
};
