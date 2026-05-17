/**
 * 住港伴 v3 — 证件索引模板系统 (PRD v4 §3.4.1)
 *
 * 根据 (status, selectedPath, mode) 三元组匹配证件槽位模板。
 * 每个槽位定义：需要什么证件、必需/建议/可选、最大数量、关联引导流程。
 *
 * Bug #23 修复: 补全13路径专属卡槽模板 + 路径优先匹配逻辑
 */

const INDEX_TEMPLATES = {

  // ============ 未申请 + 优才 ============
  'unapplied_qmas_application': {
    templateId: 'unapplied_qmas_application',
    status: 'unapplied', path: 'qmas', mode: 'application',
    totalRequired: 12,
    categories: [
      {
        categoryKey: 'identity', categoryName: '身份证明', categoryIcon: '🪪',
        slots: [
          { slotKey: 'id_card',      docName: '内地身份证',   docIcon: '🆔', requirement: 'required',    description: '人像面+国徽面', maxCount: 2 },
          { slotKey: 'hk_permit',    docName: '港澳通行证',   docIcon: '🛂', requirement: 'required',    description: '需含有效签注', maxCount: 2 },
          { slotKey: 'passport',     docName: '护照',         docIcon: '📘', requirement: 'recommended', description: '如有', maxCount: 1 },
          { slotKey: 'photo',        docName: '证件照',       docIcon: '📷', requirement: 'required',    description: '白底50×40mm', maxCount: 1 }
        ]
      },
      {
        categoryKey: 'education', categoryName: '学历证明', categoryIcon: '🎓',
        slots: [
          { slotKey: 'degree_cert',   docName: '学位证书',     docIcon: '📜', requirement: 'required', description: '最高学位', maxCount: 1 },
          { slotKey: 'transcript',    docName: '成绩单',       docIcon: '📊', requirement: 'required', description: '完整成绩单', maxCount: 1 },
          { slotKey: 'degree_auth',   docName: '学历认证',     docIcon: '✅', requirement: 'required', description: '学信网/留服认证', maxCount: 1 },
          { slotKey: 'language_cert', docName: '语言成绩',     docIcon: '🗣️', requirement: 'recommended', description: '雅思7+/托福94+', maxCount: 1 }
        ]
      },
      {
        categoryKey: 'employment', categoryName: '工作经历', categoryIcon: '💼',
        slots: [
          { slotKey: 'emp_proof',         docName: '工作证明信',     docIcon: '📋', requirement: 'required', description: '含职位+起止日期+职责', maxCount: -1 },
          { slotKey: 'recommendation',    docName: '推荐信',         docIcon: '✉️', requirement: 'required', description: '建议2-3封', maxCount: 3 },
          { slotKey: 'org_chart',         docName: '组织架构图',     docIcon: '📊', requirement: 'optional', description: '证明管理职级', maxCount: 1 }
        ]
      },
      {
        categoryKey: 'financial', categoryName: '资产证明', categoryIcon: '💰',
        slots: [
          { slotKey: 'income_proof',  docName: '收入证明',       docIcon: '💵', requirement: 'required', description: '过去一年≥100万HKD', maxCount: 1 },
          { slotKey: 'bank_statement',docName: '银行流水/存款证明', docIcon: '🏦', requirement: 'required', description: '近6个月', maxCount: 1 },
          { slotKey: 'tax_record',    docName: '纳税记录',       docIcon: '🧾', requirement: 'recommended', description: '个人所得税完税证明', maxCount: 1 }
        ]
      },
      {
        categoryKey: 'application', categoryName: '申请材料', categoryIcon: '📄',
        slots: [
          { slotKey: 'plan_statement',docName: '赴港计划书',     docIcon: '📝', requirement: 'required', description: '500字以内，说明赴港发展计划', maxCount: 1 },
          { slotKey: 'no_crime',      docName: '无犯罪记录证明', docIcon: '🔍', requirement: 'required', description: '户籍所在地派出所开具', maxCount: 1 }
        ]
      }
    ],
    overflowZone: { zoneKey: 'overflow', zoneName: '其他文件', zoneIcon: '📎', description: '补充材料，不限量' }
  },

  // ============ 未申请 + 高才A ============
  'unapplied_ttps_a_application': {
    templateId: 'unapplied_ttps_a_application',
    status: 'unapplied', path: 'ttps_a', mode: 'application',
    totalRequired: 6,
    categories: [
      {
        categoryKey: 'identity', categoryName: '身份证明', categoryIcon: '🪪',
        slots: [
          { slotKey: 'id_card',   docName: '内地身份证', docIcon: '🆔', requirement: 'required', maxCount: 2 },
          { slotKey: 'hk_permit', docName: '港澳通行证', docIcon: '🛂', requirement: 'required', maxCount: 2 },
          { slotKey: 'photo',     docName: '证件照',     docIcon: '📷', requirement: 'required', maxCount: 1 }
        ]
      },
      {
        categoryKey: 'financial', categoryName: '收入证明', categoryIcon: '💰',
        slots: [
          { slotKey: 'income_250w', docName: '年收入证明(≥250万HKD)', docIcon: '💵', requirement: 'required', description: '完税证明+银行流水+雇主证明', maxCount: 3 },
          { slotKey: 'company_docs',docName: '公司证明文件',          docIcon: '🏢', requirement: 'required', description: '营业执照+股权证明(如自雇)', maxCount: 2 }
        ]
      },
      {
        categoryKey: 'application', categoryName: '申请材料', categoryIcon: '📄',
        slots: [
          { slotKey: 'no_crime', docName: '无犯罪记录证明', docIcon: '🔍', requirement: 'required', maxCount: 1 }
        ]
      }
    ]
  },

  // ============ 未申请 + 高才B ============
  'unapplied_ttps_b_application': {
    templateId: 'unapplied_ttps_b_application',
    status: 'unapplied', path: 'ttps_b', mode: 'application',
    totalRequired: 5,
    categories: [
      {
        categoryKey: 'identity', categoryName: '身份证明', categoryIcon: '🪪',
        slots: [
          { slotKey: 'id_card',   docName: '内地身份证', docIcon: '🆔', requirement: 'required', maxCount: 2 },
          { slotKey: 'hk_permit', docName: '港澳通行证', docIcon: '🛂', requirement: 'required', maxCount: 2 },
          { slotKey: 'photo',     docName: '证件照',     docIcon: '📷', requirement: 'required', maxCount: 1 }
        ]
      },
      {
        categoryKey: 'education', categoryName: '学历证明', categoryIcon: '🎓',
        slots: [
          { slotKey: 'degree_cert', docName: '合资格大学学位证', docIcon: '📜', requirement: 'required', description: 'QS前100/Top30', maxCount: 1 }
        ]
      },
      {
        categoryKey: 'employment', categoryName: '工作经历', categoryIcon: '💼',
        slots: [
          { slotKey: 'emp_3y', docName: '3年工作证明', docIcon: '📋', requirement: 'required', description: '毕业后3年全职工作', maxCount: 1 }
        ]
      }
    ]
  },

  // ============ 高才通C类 (合资格学士<3年经验) ============
  'any_ttps_c_application': {
    templateId: 'any_ttps_c_application',
    status: 'any', path: 'ttps_c', mode: 'application',
    totalRequired: 6,
    categories: [
      {
        categoryKey: 'identity', categoryName: '身份证明', categoryIcon: '🪪',
        slots: [
          { slotKey: 'id_card',   docName: '内地身份证', docIcon: '🆔', requirement: 'required', maxCount: 2 },
          { slotKey: 'hk_permit', docName: '港澳通行证', docIcon: '🛂', requirement: 'required', maxCount: 2 },
          { slotKey: 'photo',     docName: '证件照',     docIcon: '📷', requirement: 'required', maxCount: 1 }
        ]
      },
      {
        categoryKey: 'education', categoryName: '学历证明', categoryIcon: '🎓',
        slots: [
          { slotKey: 'degree_cert', docName: '合资格大学学位证', docIcon: '📜', requirement: 'required', description: 'QS前100/内地Top10', maxCount: 1 },
          { slotKey: 'transcript',  docName: '成绩单',           docIcon: '📊', requirement: 'required', description: '完整成绩单', maxCount: 1 }
        ]
      },
      {
        categoryKey: 'application', categoryName: '申请材料', categoryIcon: '📄',
        slots: [
          { slotKey: 'no_crime', docName: '无犯罪记录证明', docIcon: '🔍', requirement: 'required', maxCount: 1 }
        ]
      }
    ]
  },

  // ============ 专才ASMTP (雇主sponsor) ============
  'any_asmpt_application': {
    templateId: 'any_asmpt_application',
    status: 'any', path: 'asmpt', mode: 'application',
    totalRequired: 8,
    categories: [
      {
        categoryKey: 'identity', categoryName: '身份证明', categoryIcon: '🪪',
        slots: [
          { slotKey: 'id_card',   docName: '内地身份证', docIcon: '🆔', requirement: 'required', maxCount: 2 },
          { slotKey: 'hk_permit', docName: '港澳通行证', docIcon: '🛂', requirement: 'required', maxCount: 2 },
          { slotKey: 'passport',  docName: '护照',         docIcon: '📘', requirement: 'recommended', maxCount: 1 },
          { slotKey: 'photo',     docName: '证件照',       docIcon: '📷', requirement: 'required', maxCount: 1 }
        ]
      },
      {
        categoryKey: 'education', categoryName: '学历/资质', categoryIcon: '🎓',
        slots: [
          { slotKey: 'degree_cert', docName: '学位证书', docIcon: '📜', requirement: 'required', description: '相关学历', maxCount: 1 },
          { slotKey: 'transcript',  docName: '成绩单',   docIcon: '📊', requirement: 'recommended', maxCount: 1 }
        ]
      },
      {
        categoryKey: 'employment', categoryName: '雇佣文件', categoryIcon: '💼',
        slots: [
          { slotKey: 'emp_letter',    docName: '雇主聘用书',   docIcon: '📋', requirement: 'required', description: '含职位+薪资+聘用期', maxCount: 1 },
          { slotKey: 'company_docs',  docName: '公司注册文件', docIcon: '🏢', requirement: 'required', description: '商业登记证+NAR1', maxCount: 2 },
          { slotKey: 'emp_proof',     docName: '工作经验证明', docIcon: '📁', requirement: 'required', description: '过往工作证明', maxCount: -1 }
        ]
      },
      {
        categoryKey: 'application', categoryName: '申请材料', categoryIcon: '📄',
        slots: [
          { slotKey: 'no_crime', docName: '无犯罪记录证明', docIcon: '🔍', requirement: 'required', maxCount: 1 }
        ]
      }
    ]
  },

  // ============ 赴港升学 (student_iang) ============
  'any_student_iang_application': {
    templateId: 'any_student_iang_application',
    status: 'any', path: 'student_iang', mode: 'application',
    totalRequired: 10,
    categories: [
      {
        categoryKey: 'identity', categoryName: '身份证明', categoryIcon: '🪪',
        slots: [
          { slotKey: 'id_card',   docName: '内地身份证', docIcon: '🆔', requirement: 'required', maxCount: 2 },
          { slotKey: 'hk_permit', docName: '港澳通行证', docIcon: '🛂', requirement: 'required', maxCount: 2 },
          { slotKey: 'passport',  docName: '护照',         docIcon: '📘', requirement: 'recommended', maxCount: 1 },
          { slotKey: 'photo',     docName: '证件照',       docIcon: '📷', requirement: 'required', maxCount: 1 }
        ]
      },
      {
        categoryKey: 'education', categoryName: '录取材料', categoryIcon: '🎓',
        slots: [
          { slotKey: 'admission_letter', docName: '录取通知书',  docIcon: '📨', requirement: 'required', description: '港校正式录取信', maxCount: 1 },
          { slotKey: 'degree_cert',      docName: '前置学历证书', docIcon: '📜', requirement: 'required', description: '最高学历证明', maxCount: 1 },
          { slotKey: 'transcript',       docName: '成绩单',       docIcon: '📊', requirement: 'required', description: '完整成绩单', maxCount: 1 },
          { slotKey: 'language_cert',    docName: '语言成绩',     docIcon: '🗣️', requirement: 'required', description: '雅思/托福成绩', maxCount: 1 }
        ]
      },
      {
        categoryKey: 'financial', categoryName: '资产证明', categoryIcon: '💰',
        slots: [
          { slotKey: 'bank_statement', docName: '银行存款证明', docIcon: '🏦', requirement: 'required', description: '覆盖首年学费+生活费', maxCount: 1 },
          { slotKey: 'funding_proof',  docName: '资金来源说明', docIcon: '💵', requirement: 'recommended', description: '奖学金/家庭资助证明', maxCount: 1 }
        ]
      },
      {
        categoryKey: 'application', categoryName: '申请材料', categoryIcon: '📄',
        slots: [
          { slotKey: 'student_visa', docName: '学生签证材料',   docIcon: '🛂', requirement: 'required', maxCount: 1 },
          { slotKey: 'no_crime',     docName: '无犯罪记录证明', docIcon: '🔍', requirement: 'required', maxCount: 1 }
        ]
      }
    ]
  },

  // ============ 兼读进修 (parttime_qmas) ============
  'any_parttime_qmas_application': {
    templateId: 'any_parttime_qmas_application',
    status: 'any', path: 'parttime_qmas', mode: 'application',
    totalRequired: 10,
    categories: [
      {
        categoryKey: 'identity', categoryName: '身份证明', categoryIcon: '🪪',
        slots: [
          { slotKey: 'id_card',   docName: '内地身份证', docIcon: '🆔', requirement: 'required', maxCount: 2 },
          { slotKey: 'hk_permit', docName: '港澳通行证', docIcon: '🛂', requirement: 'required', maxCount: 2 },
          { slotKey: 'passport',  docName: '护照',         docIcon: '📘', requirement: 'recommended', maxCount: 1 },
          { slotKey: 'photo',     docName: '证件照',       docIcon: '📷', requirement: 'required', maxCount: 1 }
        ]
      },
      {
        categoryKey: 'education', categoryName: '学历证明', categoryIcon: '🎓',
        slots: [
          { slotKey: 'degree_cert',      docName: '学位证书',     docIcon: '📜', requirement: 'required', description: '最高学位', maxCount: 1 },
          { slotKey: 'transcript',       docName: '成绩单',       docIcon: '📊', requirement: 'required', maxCount: 1 },
          { slotKey: 'degree_auth',      docName: '学历认证',     docIcon: '✅', requirement: 'required', description: '学信网/留服认证', maxCount: 1 },
          { slotKey: 'parttime_enrollment', docName: '兼读在读证明', docIcon: '📖', requirement: 'required', description: '兼读制课程注册证明', maxCount: 1 }
        ]
      },
      {
        categoryKey: 'employment', categoryName: '工作经历', categoryIcon: '💼',
        slots: [
          { slotKey: 'emp_proof',      docName: '工作证明信', docIcon: '📋', requirement: 'required', maxCount: -1 },
          { slotKey: 'recommendation', docName: '推荐信',     docIcon: '✉️', requirement: 'recommended', maxCount: 2 }
        ]
      },
      {
        categoryKey: 'application', categoryName: '申请材料', categoryIcon: '📄',
        slots: [
          { slotKey: 'plan_statement', docName: '赴港发展计划',   docIcon: '📝', requirement: 'required', maxCount: 1 },
          { slotKey: 'no_crime',       docName: '无犯罪记录证明', docIcon: '🔍', requirement: 'required', maxCount: 1 }
        ]
      }
    ]
  },

  // ============ 科技人才 (techtas) ============
  'any_techtas_application': {
    templateId: 'any_techtas_application',
    status: 'any', path: 'techtas', mode: 'application',
    totalRequired: 7,
    categories: [
      {
        categoryKey: 'identity', categoryName: '身份证明', categoryIcon: '🪪',
        slots: [
          { slotKey: 'id_card',   docName: '内地身份证', docIcon: '🆔', requirement: 'required', maxCount: 2 },
          { slotKey: 'hk_permit', docName: '港澳通行证', docIcon: '🛂', requirement: 'required', maxCount: 2 },
          { slotKey: 'passport',  docName: '护照',         docIcon: '📘', requirement: 'recommended', maxCount: 1 },
          { slotKey: 'photo',     docName: '证件照',       docIcon: '📷', requirement: 'required', maxCount: 1 }
        ]
      },
      {
        categoryKey: 'education', categoryName: '学历/专业资质', categoryIcon: '🎓',
        slots: [
          { slotKey: 'degree_cert', docName: 'STEM学位证书', docIcon: '📜', requirement: 'required', description: '科技相关领域学位', maxCount: 1 },
          { slotKey: 'transcript',  docName: '成绩单',       docIcon: '📊', requirement: 'recommended', maxCount: 1 }
        ]
      },
      {
        categoryKey: 'employment', categoryName: '工作/成就', categoryIcon: '💼',
        slots: [
          { slotKey: 'emp_proof',       docName: '工作证明信',   docIcon: '📋', requirement: 'required', description: '含科技职位描述', maxCount: -1 },
          { slotKey: 'tech_achievement', docName: '科技成果/专利', docIcon: '🏆', requirement: 'required', description: '专利/论文/项目成果', maxCount: 3 },
          { slotKey: 'recommendation',  docName: '推荐信',       docIcon: '✉️', requirement: 'recommended', maxCount: 2 }
        ]
      },
      {
        categoryKey: 'application', categoryName: '申请材料', categoryIcon: '📄',
        slots: [
          { slotKey: 'no_crime', docName: '无犯罪记录证明', docIcon: '🔍', requirement: 'required', maxCount: 1 }
        ]
      }
    ]
  },

  // ============ 投资者入境CIES (3000万) ============
  'any_cies_application': {
    templateId: 'any_cies_application',
    status: 'any', path: 'cies', mode: 'application',
    totalRequired: 8,
    categories: [
      {
        categoryKey: 'identity', categoryName: '身份证明', categoryIcon: '🪪',
        slots: [
          { slotKey: 'id_card',   docName: '内地身份证', docIcon: '🆔', requirement: 'required', maxCount: 2 },
          { slotKey: 'hk_permit', docName: '港澳通行证', docIcon: '🛂', requirement: 'required', maxCount: 2 },
          { slotKey: 'passport',  docName: '护照',         docIcon: '📘', requirement: 'required', maxCount: 1 },
          { slotKey: 'photo',     docName: '证件照',       docIcon: '📷', requirement: 'required', maxCount: 1 }
        ]
      },
      {
        categoryKey: 'financial', categoryName: '投资证明', categoryIcon: '💰',
        slots: [
          { slotKey: 'investment_proof', docName: '净资产证明(≥3000万HKD)', docIcon: '📊', requirement: 'required', description: '银行/审计出具资产证明', maxCount: 1 },
          { slotKey: 'bank_statement',   docName: '银行流水',               docIcon: '🏦', requirement: 'required', description: '近2年完整流水', maxCount: 1 },
          { slotKey: 'asset_proof',      docName: '资产来源证明',           docIcon: '📋', requirement: 'required', description: '合法来源说明+佐证', maxCount: -1 }
        ]
      },
      {
        categoryKey: 'application', categoryName: '申请材料', categoryIcon: '📄',
        slots: [
          { slotKey: 'no_crime', docName: '无犯罪记录证明', docIcon: '🔍', requirement: 'required', maxCount: 1 }
        ]
      }
    ]
  },

  // ============ 受养人签证 (dependent) ============
  'any_dependent_application': {
    templateId: 'any_dependent_application',
    status: 'any', path: 'dependent', mode: 'application',
    totalRequired: 9,
    categories: [
      {
        categoryKey: 'identity', categoryName: '身份证明', categoryIcon: '🪪',
        slots: [
          { slotKey: 'id_card',    docName: '内地身份证', docIcon: '🆔', requirement: 'required', maxCount: 2 },
          { slotKey: 'hk_permit',  docName: '港澳通行证', docIcon: '🛂', requirement: 'required', maxCount: 2 },
          { slotKey: 'passport',   docName: '护照',         docIcon: '📘', requirement: 'recommended', maxCount: 1 },
          { slotKey: 'photo',      docName: '证件照',       docIcon: '📷', requirement: 'required', maxCount: 1 }
        ]
      },
      {
        categoryKey: 'relationship', categoryName: '关系证明', categoryIcon: '💑',
        slots: [
          { slotKey: 'marriage_cert', docName: '结婚证(配偶)',  docIcon: '💍', requirement: 'required', description: '如配偶随行', maxCount: 1 },
          { slotKey: 'birth_cert',    docName: '出生证明(子女)', docIcon: '👶', requirement: 'required', description: '如子女随行', maxCount: 1 },
          { slotKey: 'household',     docName: '户口本',         docIcon: '📖', requirement: 'recommended', description: '证明家庭关系', maxCount: 2 }
        ]
      },
      {
        categoryKey: 'sponsor', categoryName: '保证人材料', categoryIcon: '👤',
        slots: [
          { slotKey: 'sponsor_id',        docName: '保证人香港身份证', docIcon: '🆔', requirement: 'required', maxCount: 1 },
          { slotKey: 'sponsor_income',    docName: '保证人收入证明',   docIcon: '💵', requirement: 'required', description: '证明可负担受养人生活', maxCount: 1 },
          { slotKey: 'sponsor_employment',docName: '保证人在职证明',   docIcon: '📋', requirement: 'required', maxCount: 1 }
        ]
      },
      {
        categoryKey: 'application', categoryName: '申请材料', categoryIcon: '📄',
        slots: [
          { slotKey: 'no_crime', docName: '无犯罪记录证明', docIcon: '🔍', requirement: 'required', maxCount: 1 }
        ]
      }
    ]
  },

  // ============ 未成年学生 (minor_student) ============
  'any_minor_student_application': {
    templateId: 'any_minor_student_application',
    status: 'any', path: 'minor_student', mode: 'application',
    totalRequired: 11,
    categories: [
      {
        categoryKey: 'identity', categoryName: '身份证明', categoryIcon: '🪪',
        slots: [
          { slotKey: 'birth_cert', docName: '出生证明',   docIcon: '👶', requirement: 'required', maxCount: 1 },
          { slotKey: 'id_card',    docName: '身份证',     docIcon: '🆔', requirement: 'required', maxCount: 2 },
          { slotKey: 'passport',   docName: '护照',       docIcon: '📘', requirement: 'required', maxCount: 1 },
          { slotKey: 'photo',      docName: '证件照',     docIcon: '📷', requirement: 'required', maxCount: 1 }
        ]
      },
      {
        categoryKey: 'education', categoryName: '入学材料', categoryIcon: '🎓',
        slots: [
          { slotKey: 'admission_letter', docName: '学校录取通知书', docIcon: '📨', requirement: 'required', maxCount: 1 },
          { slotKey: 'transcript',       docName: '成绩单',         docIcon: '📊', requirement: 'required', maxCount: 1 }
        ]
      },
      {
        categoryKey: 'guardian', categoryName: '监护人材料', categoryIcon: '👨‍👩‍👧',
        slots: [
          { slotKey: 'guardian_id',      docName: '监护人身份证明', docIcon: '🆔', requirement: 'required', maxCount: 2 },
          { slotKey: 'guardian_consent', docName: '监护人同意书',   docIcon: '📝', requirement: 'required', description: '公证/书面同意', maxCount: 1 },
          { slotKey: 'guardian_income',  docName: '监护人收入/资产证明', docIcon: '💵', requirement: 'required', maxCount: 1 }
        ]
      },
      {
        categoryKey: 'application', categoryName: '申请材料', categoryIcon: '📄',
        slots: [
          { slotKey: 'student_visa', docName: '学生签证申请',   docIcon: '🛂', requirement: 'required', maxCount: 1 },
          { slotKey: 'no_crime',     docName: '无犯罪记录证明', docIcon: '🔍', requirement: 'required', maxCount: 1 }
        ]
      }
    ]
  },

  // ============ 交换生/短期课程 (exchange) ============
  'any_exchange_application': {
    templateId: 'any_exchange_application',
    status: 'any', path: 'exchange', mode: 'application',
    totalRequired: 8,
    categories: [
      {
        categoryKey: 'identity', categoryName: '身份证明', categoryIcon: '🪪',
        slots: [
          { slotKey: 'id_card',   docName: '内地身份证', docIcon: '🆔', requirement: 'required', maxCount: 2 },
          { slotKey: 'passport',  docName: '护照',         docIcon: '📘', requirement: 'required', maxCount: 1 },
          { slotKey: 'photo',     docName: '证件照',       docIcon: '📷', requirement: 'required', maxCount: 1 }
        ]
      },
      {
        categoryKey: 'education', categoryName: '交换材料', categoryIcon: '🎓',
        slots: [
          { slotKey: 'admission_letter',    docName: '交换录取通知',   docIcon: '📨', requirement: 'required', maxCount: 1 },
          { slotKey: 'exchange_agreement',  docName: '交换协议/批准函', docIcon: '📋', requirement: 'required', description: '本校批准+对方接收', maxCount: 1 },
          { slotKey: 'transcript',          docName: '在校成绩单',     docIcon: '📊', requirement: 'required', maxCount: 1 }
        ]
      },
      {
        categoryKey: 'financial', categoryName: '资产证明', categoryIcon: '💰',
        slots: [
          { slotKey: 'bank_statement', docName: '银行存款证明', docIcon: '🏦', requirement: 'required', description: '覆盖交换期间费用', maxCount: 1 }
        ]
      },
      {
        categoryKey: 'application', categoryName: '申请材料', categoryIcon: '📄',
        slots: [
          { slotKey: 'no_crime', docName: '无犯罪记录证明', docIcon: '🔍', requirement: 'required', maxCount: 1 }
        ]
      }
    ]
  },

  // ============ 退休身份规划 (retirement) ============
  'any_retirement_application': {
    templateId: 'any_retirement_application',
    status: 'any', path: 'retirement', mode: 'application',
    totalRequired: 8,
    categories: [
      {
        categoryKey: 'identity', categoryName: '身份证明', categoryIcon: '🪪',
        slots: [
          { slotKey: 'id_card',   docName: '内地身份证', docIcon: '🆔', requirement: 'required', maxCount: 2 },
          { slotKey: 'hk_permit', docName: '港澳通行证', docIcon: '🛂', requirement: 'required', maxCount: 2 },
          { slotKey: 'passport',  docName: '护照',         docIcon: '📘', requirement: 'required', maxCount: 1 },
          { slotKey: 'photo',     docName: '证件照',       docIcon: '📷', requirement: 'required', maxCount: 1 }
        ]
      },
      {
        categoryKey: 'financial', categoryName: '退休资产', categoryIcon: '💰',
        slots: [
          { slotKey: 'retirement_fund', docName: '退休金/养老金证明', docIcon: '🏦', requirement: 'required', description: '证明稳定退休收入', maxCount: 1 },
          { slotKey: 'bank_statement',  docName: '银行存款证明',     docIcon: '💰', requirement: 'required', description: '近2年资产证明', maxCount: 1 },
          { slotKey: 'pension_proof',   docName: '年金/投资收益证明', docIcon: '📊', requirement: 'recommended', maxCount: 1 }
        ]
      },
      {
        categoryKey: 'application', categoryName: '申请材料', categoryIcon: '📄',
        slots: [
          { slotKey: 'plan_statement', docName: '退休生活计划书',   docIcon: '📝', requirement: 'required', description: '在港生活安排说明', maxCount: 1 },
          { slotKey: 'no_crime',       docName: '无犯罪记录证明',   docIcon: '🔍', requirement: 'required', maxCount: 1 }
        ]
      }
    ]
  },

  // ============ 通用默认模板 ============
  'default_application': {
    templateId: 'default_application',
    status: 'any', path: 'any', mode: 'application',
    totalRequired: 4,
    categories: [
      {
        categoryKey: 'identity', categoryName: '身份证明', categoryIcon: '🪪',
        slots: [
          { slotKey: 'id_card',   docName: '内地身份证', docIcon: '🆔', requirement: 'required', maxCount: 2 },
          { slotKey: 'hk_permit', docName: '港澳通行证', docIcon: '🛂', requirement: 'required', maxCount: 2 },
          { slotKey: 'photo',     docName: '证件照',     docIcon: '📷', requirement: 'required', maxCount: 1 }
        ]
      },
      {
        categoryKey: 'education', categoryName: '学历证明', categoryIcon: '🎓',
        slots: [
          { slotKey: 'degree_cert', docName: '学位证书', docIcon: '📜', requirement: 'required', maxCount: 1 }
        ]
      }
    ]
  }
};

/**
 * 匹配索引模板 — Bug #23修复: 路径优先匹配（any_前缀支持全部13路径+状态无关）
 * @param {string} status - 用户状态 (unapplied/submitted/approved/permanent)
 * @param {string} path - 申请路径 (qmas/ttps_a/ttps_b/asmpt/student_iang/...)
 * @param {string} mode - 模式 (application/renewal)
 * @returns {object} 匹配的索引模板
 */
function matchTemplate(status, path, mode) {
  // 1) 精确匹配: 状态_路径_模式
  var exactKey = status + '_' + path + '_' + mode;
  if (INDEX_TEMPLATES[exactKey]) return INDEX_TEMPLATES[exactKey];

  // 2) 路径优先匹配: 任意状态_路径_模式 (Bug #23: 确保路径被读取使用)
  var pathModeKey = 'any_' + path + '_' + mode;
  if (INDEX_TEMPLATES[pathModeKey]) return INDEX_TEMPLATES[pathModeKey];

  // 3) 其他已知状态前缀匹配同一路径 (例: 用户submitted后仍能命中unapplied_qmas模板)
  var KNOWN_STATUSES = ['unapplied', 'submitted', 'approved', 'permanent', 'renewal', 'skipped'];
  for (var i = 0; i < KNOWN_STATUSES.length; i++) {
    var altKey = KNOWN_STATUSES[i] + '_' + path + '_' + mode;
    if (INDEX_TEMPLATES[altKey]) return INDEX_TEMPLATES[altKey];
  }

  // 4) 状态兜底: 状态_任意_模式
  var statusModeKey = status + '_any_' + mode;
  if (INDEX_TEMPLATES[statusModeKey]) return INDEX_TEMPLATES[statusModeKey];

  // 5) 最终fallback
  return INDEX_TEMPLATES['default_application'];
}

/**
 * 仅本人可见的分类 — 这些材料天然属于申请人本人，配偶/子女无需提供
 * 工作经历、资产证明、申请材料（赴港计划书/无犯罪记录等）均只显示本人材料
 */
var SELF_ONLY_CATEGORIES = ['work', 'assets', 'approved', 'employment', 'financial', 'application'];

/**
 * 计算槽位运行时状态
 * @param {object} template - 索引模板
 * @param {Array} uploadedDocs - 已上传证件列表
 * @param {string} ownerType - 当前所属人 ('self'|'spouse'|'child')，不传则不过滤
 * @returns {Array} 含 fillStatus 的分类+槽位
 */
function computeSlotStates(template, uploadedDocs, ownerType) {
  return template.categories.map(function(cat) {
    // 仅本人分类：始终按 'self' 过滤，不受身份切换影响
    var effectiveOwner = (SELF_ONLY_CATEGORIES.indexOf(cat.categoryKey) !== -1) ? 'self' : ownerType;

    var slots = cat.slots.map(function(slot) {
      var uploaded = uploadedDocs.filter(function(d) {
        // 0) 所属人过滤：旧数据无 ownerType 视为 'self'
        if (effectiveOwner) {
          var docOwner = d.ownerType || 'self';
          if (docOwner !== effectiveOwner) return false;
        }
        // 1) 精确 slotKey 匹配（从卡槽点击添加的）
        if (d.slotKey && slot.slotKey && d.slotKey === slot.slotKey) return true;
        // 2) docType 匹配 slotKey（OCR识别或分类推导的 docType）
        if (d.type && slot.slotKey && d.type === slot.slotKey) return true;
        // 3) 分类+名称模糊匹配兜底（category 匹配 + name 含 docName）
        if (d.category && d.name && slot.docName) {
          if (d.category === cat.categoryKey && d.name.indexOf(slot.docName) !== -1) return true;
        }
        return false;
      });
      var count = uploaded.length;
      var fillStatus = 'empty';
      if (count >= slot.maxCount && slot.maxCount > 0) fillStatus = 'filled';
      else if (count > 0) fillStatus = 'partial';

      // 检查过期
      var hasExpiring = uploaded.some(function(d) {
        if (!d.validTo) return false;
        var days = Math.ceil((new Date(d.validTo) - new Date()) / 86400000);
        return days >= 0 && days < 90;
      });
      if (hasExpiring && fillStatus === 'filled') fillStatus = 'expiring_soon';
      if (uploaded.some(function(d) { return d.expired; })) fillStatus = 'expired';

      return {
        slotKey: slot.slotKey,
        docName: slot.docName,
        docIcon: slot.docIcon,
        requirement: slot.requirement,
        description: slot.description,
        maxCount: slot.maxCount,
        fillStatus: fillStatus,
        uploadedDocs: uploaded.map(function(d) {
          var backName = slot.slotKey === 'hk_permit' ? '签注面' : (slot.slotKey === 'passport' ? '信息页' : '国徽面');
          var label = d.photoSide === 'front' ? '人像面' : (d.photoSide === 'back' ? backName : '');
          d.sideLabel = label;
          return d;
        }),
        uploadedCount: count
      };
    });

    var required = slots.filter(function(s) { return s.requirement === 'required'; });
    var filled = required.filter(function(s) { return s.fillStatus === 'filled'; }).length;

    return {
      categoryKey: cat.categoryKey,
      categoryName: cat.categoryName,
      categoryIcon: cat.categoryIcon,
      slots: slots,
      categoryProgress: { filled: filled, total: required.length },
      isSelfOnly: SELF_ONLY_CATEGORIES.indexOf(cat.categoryKey) !== -1
    };
  });
}

module.exports = {
  INDEX_TEMPLATES,
  matchTemplate,
  computeSlotStates
};
