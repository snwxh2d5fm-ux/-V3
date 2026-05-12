/**
 * 住港伴 v4.1 — 100+条提醒规则库 (Reminder Rule Library)
 * ============================================================
 * 覆盖12条身份路径 × 全生命周期10阶段
 * 每条规则：触发事件 + 提醒项(文案/偏移天数/提醒时间点)
 * 
 * 框架: rule_id → trigger(event+date_field) → reminders[]
 * 阶段: eval(评估) / prep(准备) / apply(申请) / wait(等待)
 *       / active(激活) / settle(抵港) / maintain(维持)
 *       / renewal(续签) / pr(永居) / ongoing(持续)
 *
 * 更新: 2026-05-11 — 从8条扩展至110条
 */
module.exports = [
  // ═══════════════════════════════════════════════════════════
  // 一、通用规则 (Universal · 所有路径适用)
  // ═══════════════════════════════════════════════════════════

  // ── 护照/旅行证件 ──
  {
    rule_id: 'R_PASSPORT_EXPIRY',
    trigger: { event: 'passport_expiring', date_field: 'passportExpiry' },
    reminders: [
      { label: '护照即将到期，提前预约换发', offset_days: 0, alerts: [180, 90, 60, 30, 14, 7] },
      { label: '护照已到期 — 紧急换发', offset_days: 0, alerts: [0] }
    ]
  },
  {
    rule_id: 'R_EEP_EXPIRY',
    trigger: { event: 'eep_expiring', date_field: 'eepExpiry' },
    reminders: [
      { label: '回乡证到期预警，提前预约换领', offset_days: 0, alerts: [180, 90, 60, 30, 14, 7] }
    ]
  },
  {
    rule_id: 'R_PERMIT_EXPIRY',
    trigger: { event: 'permit_expiring', date_field: 'permitExpiry' },
    reminders: [
      { label: '港澳通行证到期预警', offset_days: 0, alerts: [365, 180, 90, 60, 30, 14, 7, 3] },
      { label: '港澳通行证签注页不足 — 需加签', offset_days: 0, alerts: [90, 60, 30] }
    ]
  },

  // ── 签证/身份 ──
  {
    rule_id: 'R_VISA_EXPIRY_GENERAL',
    trigger: { event: 'visa_expiring', date_field: 'visaExpiry' },
    reminders: [
      { label: '签证到期预警 — 启动续签准备', offset_days: 0, alerts: [180, 120, 90, 60, 30, 14, 7, 3] },
      { label: '签证到期 — 逾期逗留属违法', offset_days: 0, alerts: [7, 3, 1] }
    ]
  },
  {
    rule_id: 'R_HKID_RENEWAL',
    trigger: { event: 'hk_id_expiring', date_field: 'hkIdExpiry' },
    reminders: [
      { label: '香港身份证到期，预约换领', offset_days: 0, alerts: [90, 60, 30, 14, 7] }
    ]
  },

  // ── 住址证明 ──
  {
    rule_id: 'R_ADDRESS_PROOF',
    trigger: { event: 'address_changed', date_field: 'moveInDate' },
    reminders: [
      { label: '更新住址证明（水电煤账单/租约）', offset_days: 30, alerts: [30, 14, 7] },
      { label: '向入境处申报地址变更', offset_days: 30, alerts: [30, 14, 7] }
    ]
  },
  {
    rule_id: 'R_ADDRESS_PROOF_QUARTERLY',
    trigger: { event: 'quarterly_check', date_field: 'checkDate' },
    reminders: [
      { label: '季度住址证明更新检查（保留最近3个月账单）', offset_days: 0, alerts: [14, 7, 3] }
    ]
  },

  // ── 税务 ──
  {
    rule_id: 'R_TAX_FILING',
    trigger: { event: 'tax_year_start', date_field: 'taxYearStart' },
    reminders: [
      { label: '薪俸税报税表发出 — 注意查收', offset_days: 30, alerts: [30, 14, 7] },
      { label: '薪俸税申报截止 — 逾期罚款', offset_days: 30, alerts: [30, 14, 7, 3, 1] },
      { label: '保留报税表副本(续签/永居用)', offset_days: 30, alerts: [30, 14] }
    ]
  },
  {
    rule_id: 'R_TAX_PROVISIONAL',
    trigger: { event: 'provisional_tax_due', date_field: 'dueDate' },
    reminders: [
      { label: '暂缴税缴纳到期', offset_days: 0, alerts: [30, 14, 7, 3] }
    ]
  },

  // ── 强积金MPF ──
  {
    rule_id: 'R_MPF_CONTRIBUTION',
    trigger: { event: 'mpf_monthly', date_field: 'contributionDate' },
    reminders: [
      { label: '雇主MPF供款检查（每月10号前）', offset_days: 0, alerts: [14, 7, 3] },
      { label: '自愿性MPF供款（税务抵扣）', offset_days: 0, alerts: [60, 30] }
    ]
  },
  {
    rule_id: 'R_MPF_ANNUAL',
    trigger: { event: 'mpf_annual_statement', date_field: 'statementDate' },
    reminders: [
      { label: 'MPF年度权益报表查收（续签/永居必备）', offset_days: 0, alerts: [30, 14, 7] }
    ]
  },

  // ── 银行 ──
  {
    rule_id: 'R_BANK_ACCOUNT_OPEN',
    trigger: { event: 'hk_arrival', date_field: 'arrivalDate' },
    reminders: [
      { label: '抵港后开立香港银行账户', offset_days: 14, alerts: [14, 7, 3] }
    ]
  },
  {
    rule_id: 'R_BANK_STATEMENT',
    trigger: { event: 'bank_statement_needed', date_field: 'statementDate' },
    reminders: [
      { label: '银行月结单保存(续签/永居地址证明用)', offset_days: 0, alerts: [30, 14, 7] }
    ]
  },

  // ── 医疗 ──
  {
    rule_id: 'R_MEDICAL_INSURANCE',
    trigger: { event: 'hk_arrival', date_field: 'arrivalDate' },
    reminders: [
      { label: '购买香港医疗保险', offset_days: 30, alerts: [30, 14] },
      { label: '医疗保续保提醒', offset_days: 335, alerts: [60, 30, 14] }
    ]
  },

  // ── 租房 ──
  {
    rule_id: 'R_RENTAL_CONTRACT',
    trigger: { event: 'rental_contract_expiring', date_field: 'contractExpiry' },
    reminders: [
      { label: '租约到期 — 续约或搬离', offset_days: 0, alerts: [90, 60, 30, 14, 7] },
      { label: '退租 — 申请退还按金', offset_days: 0, alerts: [30, 14, 7] }
    ]
  },

  // ── 家庭 ──
  {
    rule_id: 'R_DEPENDENT_VISA',
    trigger: { event: 'dependent_visa_expiring', date_field: 'expiryDate' },
    reminders: [
      { label: '受养人签证到期 — 跟随主申续签', offset_days: 0, alerts: [180, 90, 60, 30, 14, 7] }
    ]
  },
  {
    rule_id: 'R_CHILD_SCHOOL',
    trigger: { event: 'school_year_start', date_field: 'enrollmentDate' },
    reminders: [
      { label: '子女入学申请/插班报名', offset_days: 0, alerts: [180, 90, 60, 30] },
      { label: '准备子女在学证明(续签用)', offset_days: 0, alerts: [60, 30, 14] }
    ]
  },

  // ── 驾照 ──
  {
    rule_id: 'R_DRIVING_LICENSE',
    trigger: { event: 'hk_arrival', date_field: 'arrivalDate' },
    reminders: [
      { label: '内地驾照免试换领香港驾照（抵港后）', offset_days: 90, alerts: [90, 60, 30] }
    ]
  },

  // ═══════════════════════════════════════════════════════════
  // 二、路径专项规则 (Path-Specific)
  // ═══════════════════════════════════════════════════════════

  // ==================== 路径1: student_iang ====================
  // 全日制学生→IANG→永居
  {
    rule_id: 'R_STUDENT_APPLY',
    trigger: { event: 'school_application_start', date_field: 'appStartDate' },
    reminders: [
      { label: '港校申请季开始 — 准备申请材料', offset_days: 0, alerts: [90, 60, 30] },
      { label: '语言成绩提交截止', offset_days: 0, alerts: [60, 30, 14, 7] },
      { label: '推荐信收集（联系教授/上司）', offset_days: 0, alerts: [60, 30, 14] },
      { label: '个人陈述定稿', offset_days: 0, alerts: [30, 14, 7] }
    ]
  },
  {
    rule_id: 'R_STUDENT_OFFER',
    trigger: { event: 'offer_expected', date_field: 'offerDeadline' },
    reminders: [
      { label: '录取结果公布 — 注意查收邮件', offset_days: 0, alerts: [30, 14, 7] },
      { label: '确认接受offer并缴付留位费', offset_days: 0, alerts: [14, 7, 3] }
    ]
  },
  {
    rule_id: 'R_STUDENT_VISA',
    trigger: { event: 'student_visa_start', date_field: 'visaAppDate' },
    reminders: [
      { label: '启动学生签证申请(审批6-8周)', offset_days: 0, alerts: [60, 45, 30, 14] },
      { label: '学生签证材料寄送入境处', offset_days: 0, alerts: [14, 7, 3] },
      { label: '学生签证获批 — 下载e-Visa', offset_days: 56, alerts: [14, 7, 3] }
    ]
  },
  {
    rule_id: 'R_STUDENT_PRE_DEPARTURE',
    trigger: { event: 'student_visa_approved', date_field: 'approvalDate' },
    reminders: [
      { label: '办理港澳通行证+逗留D签注', offset_days: 7, alerts: [14, 7, 3] },
      { label: '预订赴港机票/车票', offset_days: 30, alerts: [30, 14, 7] },
      { label: '经济准备(首年30-40万港币)', offset_days: 60, alerts: [60, 30, 14] },
      { label: '预订在港住宿(学校宿舍/私人租房)', offset_days: 90, alerts: [90, 60, 30] }
    ]
  },
  {
    rule_id: 'R_STUDENT_ARRIVAL',
    trigger: { event: 'student_arrival', date_field: 'arrivalDate' },
    reminders: [
      { label: '入境激活学生签证(3个月内)', offset_days: 0, alerts: [90, 60, 30, 14, 7] },
      { label: '办理香港身份证(30天内)', offset_days: 0, alerts: [30, 21, 14, 7] },
      { label: '银行开户+手机号办理', offset_days: 0, alerts: [30, 14, 7] },
      { label: '学校报到注册', offset_days: 0, alerts: [14, 7, 3] }
    ]
  },
  {
    rule_id: 'R_STUDENT_SEMESTER',
    trigger: { event: 'semester_start', date_field: 'startDate' },
    reminders: [
      { label: '新学期选课/注册', offset_days: 0, alerts: [14, 7, 3] },
      { label: '学费缴付截止', offset_days: 0, alerts: [30, 14, 7] }
    ]
  },
  {
    rule_id: 'R_STUDENT_GRADUATION',
    trigger: { event: 'graduation_approaching', date_field: 'gradDate' },
    reminders: [
      { label: '毕业前3个月准备IANG申请', offset_days: 0, alerts: [90, 60, 30] },
      { label: '确认学分数满足毕业要求', offset_days: 0, alerts: [60, 30] },
      { label: '毕业典礼 — 邀请家人赴港', offset_days: 0, alerts: [90, 60, 30] }
    ]
  },
  {
    rule_id: 'R_STUDENT_IANG_APPLY',
    trigger: { event: 'iang_application', date_field: 'applyDate' },
    reminders: [
      { label: 'IANG申请启动(毕业后6个月内免雇主)', offset_days: 0, alerts: [180, 90, 60, 30, 14] },
      { label: '准备IANG材料：ID990A+学位证+成绩单', offset_days: 0, alerts: [30, 14, 7] },
      { label: '递交IANG申请(审批2-4周)', offset_days: 0, alerts: [14, 7, 3] }
    ]
  },
  {
    rule_id: 'R_STUDENT_IANG_ACTIVATE',
    trigger: { event: 'iang_approved', date_field: 'approvalDate' },
    reminders: [
      { label: 'IANG获批 — 领取签证标签', offset_days: 0, alerts: [14, 7, 3] },
      { label: 'IANG就业/创业启动', offset_days: 0, alerts: [90, 60, 30] },
      { label: '学生签证→IANG身份转换确认', offset_days: 0, alerts: [30, 14, 7] }
    ]
  },

  // ==================== 路径2: parttime_qmas ====================
  // 兼读制→优才/专才→永居
  {
    rule_id: 'R_PARTTIME_ENROLL',
    trigger: { event: 'parttime_application', date_field: 'appDate' },
    reminders: [
      { label: '兼读制课程申请', offset_days: 0, alerts: [90, 60, 30] },
      { label: '确认兼读制不构成在港居留', offset_days: 0, alerts: [14, 7] }
    ]
  },
  {
    rule_id: 'R_PARTTIME_ATTENDANCE',
    trigger: { event: 'parttime_class', date_field: 'classDate' },
    reminders: [
      { label: '兼读制上课 — 安排赴港行程', offset_days: 0, alerts: [14, 7, 3] },
      { label: '旅游/商务签短期入境上课 ⚠️法律灰色地带', offset_days: 0, alerts: [30, 14] }
    ]
  },
  {
    rule_id: 'R_PARTTIME_PATH_SWITCH',
    trigger: { event: 'parttime_graduation', date_field: 'gradDate' },
    reminders: [
      { label: '兼读制毕业 — 决策：全日制转换 vs 独立申请路径', offset_days: 0, alerts: [180, 90, 60, 30] },
      { label: '准备优才/专才/高才独立申请', offset_days: 0, alerts: [90, 60, 30] }
    ]
  },

  // ==================== 路径3: ttps_a ====================
  // 高才通A类(≥250万)
  {
    rule_id: 'R_TTPSA_INCOME_VERIFY',
    trigger: { event: 'ttpsa_preparation', date_field: 'prepDate' },
    reminders: [
      { label: '核实年收入≥250万港币(纳税/审计)', offset_days: 0, alerts: [90, 60, 30] },
      { label: '准备收入证明材料：税单/银行流水/公司证明', offset_days: 0, alerts: [60, 30, 14, 7] }
    ]
  },
  {
    rule_id: 'R_TTPSA_APPLY',
    trigger: { event: 'ttpsa_application', date_field: 'applyDate' },
    reminders: [
      { label: '在线递交高才通A类申请(审批~4周)', offset_days: 0, alerts: [60, 30, 14, 7] },
      { label: '申请受理 — 等待审批', offset_days: 0, alerts: [30, 14, 7] }
    ]
  },
  {
    rule_id: 'R_TTPSA_APPROVED',
    trigger: { event: 'ttpsa_approved', date_field: 'approvalDate' },
    reminders: [
      { label: '高才A获批 — 下载e-Visa(36月)', offset_days: 0, alerts: [7, 3, 1] },
      { label: '赴港激活签证(3个月内)', offset_days: 0, alerts: [90, 60, 30, 14, 7] }
    ]
  },
  {
    rule_id: 'R_TTPSA_RENEWAL',
    trigger: { event: 'ttpsa_renewal_prep', date_field: 'renewalDate' },
    reminders: [
      { label: '高才A续签准备(到期前6个月)', offset_days: 0, alerts: [180, 120, 90, 60] },
      { label: '整理在港就业/经济活动证据', offset_days: 0, alerts: [90, 60, 30] },
      { label: '续签材料：雇佣合约+粮单+MPF+税单', offset_days: 0, alerts: [30, 14, 7] },
      { label: '高才A续签递交', offset_days: 0, alerts: [14, 7, 3] }
    ]
  },

  // ==================== 路径4: ttps_b ====================
  // 高才通B类(合资格学士+3年经验)
  {
    rule_id: 'R_TTPSB_ELIGIBILITY',
    trigger: { event: 'ttpsb_preparation', date_field: 'prepDate' },
    reminders: [
      { label: '确认学士为合资格大学(毕业≤5年)', offset_days: 0, alerts: [90, 60, 30] },
      { label: '确认≥3年工作经验', offset_days: 0, alerts: [60, 30] }
    ]
  },
  {
    rule_id: 'R_TTPSB_APPLY',
    trigger: { event: 'ttpsb_application', date_field: 'applyDate' },
    reminders: [
      { label: '在线递交高才通B类申请(审批~4周)', offset_days: 0, alerts: [60, 30, 14, 7] },
      { label: '提交合资格学士学位证书+工作经验证明', offset_days: 0, alerts: [14, 7, 3] }
    ]
  },
  {
    rule_id: 'R_TTPSB_RENEWAL',
    trigger: { event: 'ttpsb_renewal_prep', date_field: 'renewalDate' },
    reminders: [
      { label: '高才B续签准备(到期前6个月)', offset_days: 0, alerts: [180, 120, 90, 60] },
      { label: '在港就业/创业证明收集', offset_days: 0, alerts: [90, 60, 30] },
      { label: '高才B续签递交', offset_days: 0, alerts: [30, 14, 7] }
    ]
  },

  // ==================== 路径5: ttps_c ====================
  // 高才通C类(合资格学士<3年经验)
  {
    rule_id: 'R_TTPSC_QUOTA_CHECK',
    trigger: { event: 'ttpc_preparation', date_field: 'prepDate' },
    reminders: [
      { label: '确认合资格大学学士(毕业≤5年)', offset_days: 0, alerts: [90, 60, 30] },
      { label: '检查年度配额(10000名) — 先到先得', offset_days: 0, alerts: [90, 60, 30] }
    ]
  },
  {
    rule_id: 'R_TTPSC_APPLY',
    trigger: { event: 'ttpc_application', date_field: 'applyDate' },
    reminders: [
      { label: '高才C申请递交(配额竞争 — 建议尽早)', offset_days: 0, alerts: [60, 30, 14, 7] },
      { label: '配额确认 — 如配额用完需等明年', offset_days: 0, alerts: [14, 7, 3] }
    ]
  },

  // ==================== 路径6: qmas ====================
  // 优才计划(12准则≥6)
  {
    rule_id: 'R_QMAS_ASSESS',
    trigger: { event: 'qmas_preparation', date_field: 'prepDate' },
    reminders: [
      { label: '12项准则自评(需≥6项)', offset_days: 0, alerts: [90, 60, 30] },
      { label: '准备赴港计划书', offset_days: 0, alerts: [60, 30, 14] },
      { label: '收集学历+工作+资产证明', offset_days: 0, alerts: [60, 30, 14, 7] }
    ]
  },
  {
    rule_id: 'R_QMAS_APPLY',
    trigger: { event: 'qmas_application', date_field: 'applyDate' },
    reminders: [
      { label: '递交优才申请(审批3-6月)', offset_days: 0, alerts: [30, 14, 7, 3] },
      { label: '申请受理 — 入境处可能要求补件', offset_days: 30, alerts: [30, 14] },
      { label: '优才审批进度查询(每月)', offset_days: 0, alerts: [90, 60, 30] }
    ]
  },
  {
    rule_id: 'R_QMAS_APPROVED',
    trigger: { event: 'qmas_approved', date_field: 'approvalDate' },
    reminders: [
      { label: '优才获批 — 领取24月签证', offset_days: 0, alerts: [7, 3, 1] },
      { label: '赴港激活签证+办理身份证', offset_days: 0, alerts: [90, 60, 30] }
    ]
  },
  {
    rule_id: 'R_QMAS_RESIDENCY',
    trigger: { event: 'qmas_maintaining', date_field: 'startDate' },
    reminders: [
      { label: '在港「通常居住」记录维护(建议≥180天/年)', offset_days: 0, alerts: [180, 90, 60] },
      { label: '在港消费/社交/社团活动记录留存', offset_days: 0, alerts: [90, 60, 30] }
    ]
  },
  {
    rule_id: 'R_QMAS_RENEWAL',
    trigger: { event: 'qmas_renewal_prep', date_field: 'renewalDate' },
    reminders: [
      { label: '优才续签准备(2+3+3模式)', offset_days: 0, alerts: [180, 120, 90, 60] },
      { label: '证明在港「通常居住」— 整理证据', offset_days: 0, alerts: [90, 60, 30] },
      { label: '优才续签递交', offset_days: 0, alerts: [30, 14, 7] }
    ]
  },

  // ==================== 路径7: asmpt ====================
  // 专才ASMTP(雇主sponsor)
  {
    rule_id: 'R_ASMTP_EMPLOYER',
    trigger: { event: 'asmpt_preparation', date_field: 'prepDate' },
    reminders: [
      { label: '确认香港雇主sponsor资格', offset_days: 0, alerts: [90, 60, 30] },
      { label: '证明职位无法由本地人填补', offset_days: 0, alerts: [60, 30] },
      { label: '雇主递交专才申请(审批4-6周)', offset_days: 0, alerts: [30, 14, 7] }
    ]
  },
  {
    rule_id: 'R_ASMTP_APPLY',
    trigger: { event: 'asmpt_application', date_field: 'applyDate' },
    reminders: [
      { label: '专才申请材料：雇佣合约+公司支持信+学历证明', offset_days: 0, alerts: [30, 14, 7] },
      { label: '专才审批 — 等待入境处决定', offset_days: 0, alerts: [30, 14, 7] }
    ]
  },
  {
    rule_id: 'R_ASMTP_JOB_CHANGE',
    trigger: { event: 'asmpt_employer_change', date_field: 'changeDate' },
    reminders: [
      { label: '更换雇主 — 需重新申请专才(不可自动转换)', offset_days: 0, alerts: [90, 60, 30] },
      { label: '离职前确认新雇主sponsor已获批', offset_days: 0, alerts: [30, 14, 7] }
    ]
  },
  {
    rule_id: 'R_ASMTP_RENEWAL',
    trigger: { event: 'asmpt_renewal_prep', date_field: 'renewalDate' },
    reminders: [
      { label: '专才续签(需雇主继续sponsor)', offset_days: 0, alerts: [90, 60, 30] },
      { label: '雇主准备ID990B担保表格', offset_days: 0, alerts: [60, 30, 14] },
      { label: '专才续签递交', offset_days: 0, alerts: [14, 7, 3] }
    ]
  },

  // ==================== 路径8: techtas ====================
  // 科技人才TechTAS
  {
    rule_id: 'R_TECHTAS_ELIGIBILITY',
    trigger: { event: 'techtas_preparation', date_field: 'prepDate' },
    reminders: [
      { label: '确认符合合资格科技领域', offset_days: 0, alerts: [90, 60, 30] },
      { label: '确认合资格雇主sponsor', offset_days: 0, alerts: [90, 60, 30] },
      { label: '准备科技成就/专利/论文材料', offset_days: 0, alerts: [60, 30, 14] }
    ]
  },
  {
    rule_id: 'R_TECHTAS_APPLY',
    trigger: { event: 'techtas_application', date_field: 'applyDate' },
    reminders: [
      { label: 'TechTAS申请递交', offset_days: 0, alerts: [30, 14, 7, 3] }
    ]
  },

  // ==================== 路径9: cies ====================
  // CIES资本投资者入境(3000万)
  {
    rule_id: 'R_CIES_ASSET_VERIFY',
    trigger: { event: 'cies_preparation', date_field: 'prepDate' },
    reminders: [
      { label: '核实净资产≥3000万港币', offset_days: 0, alerts: [180, 90, 60] },
      { label: '选择合资格投资组合', offset_days: 0, alerts: [90, 60, 30] },
      { label: '会计师出具净资产证明', offset_days: 0, alerts: [60, 30, 14] }
    ]
  },
  {
    rule_id: 'R_CIES_APPLY',
    trigger: { event: 'cies_application', date_field: 'applyDate' },
    reminders: [
      { label: 'CIES申请递交(投资→审批→获批)', offset_days: 0, alerts: [30, 14, 7] }
    ]
  },
  {
    rule_id: 'R_CIES_MAINTAIN',
    trigger: { event: 'cies_maintaining', date_field: 'startDate' },
    reminders: [
      { label: '持续持有合资格资产 — 年度检查', offset_days: 0, alerts: [365, 180, 90, 60] },
      { label: '资产组合调整 — 需确保不低于3000万', offset_days: 0, alerts: [90, 60, 30] }
    ]
  },

  // ==================== 路径10: dependent ====================
  // 受养人(配偶/子女)
  {
    rule_id: 'R_DEPENDENT_APPLY',
    trigger: { event: 'dependent_application', date_field: 'applyDate' },
    reminders: [
      { label: '受养人签证申请(跟随主申)', offset_days: 0, alerts: [90, 60, 30] },
      { label: '准备关系证明(结婚证/出生证)', offset_days: 0, alerts: [30, 14, 7] }
    ]
  },
  {
    rule_id: 'R_DEPENDENT_PR_ELIGIBLE',
    trigger: { event: 'dependent_7year_approaching', date_field: 'sevenYearDate' },
    reminders: [
      { label: '受养人满7年 — 可独立申请永居', offset_days: 0, alerts: [365, 180, 90] }
    ]
  },
  {
    rule_id: 'R_DEPENDENT_SPOUSE_WORK',
    trigger: { event: 'dependent_visa_issued', date_field: 'issueDate' },
    reminders: [
      { label: '配偶受养人可在港工作(主申非学生签)', offset_days: 0, alerts: [90, 60, 30] }
    ]
  },

  // ==================== 路径11: minor_student ====================
  // 未成年学生(父母不陪读)
  {
    rule_id: 'R_MINOR_GUARDIAN',
    trigger: { event: 'minor_student_prep', date_field: 'prepDate' },
    reminders: [
      { label: '指定在港监护人', offset_days: 0, alerts: [180, 90, 60] },
      { label: '监护人变更 — 需通知入境处', offset_days: 0, alerts: [30, 14, 7] }
    ]
  },
  {
    rule_id: 'R_MINOR_SCHOOL',
    trigger: { event: 'minor_enrollment', date_field: 'enrollDate' },
    reminders: [
      { label: '在港学校报名/插班', offset_days: 0, alerts: [180, 90, 60, 30] },
      { label: '学期开始 — 报到注册', offset_days: 0, alerts: [14, 7, 3] }
    ]
  },

  // ==================== 路径12: exchange ====================
  // 交换生/短期课程
  {
    rule_id: 'R_EXCHANGE_APPLY',
    trigger: { event: 'exchange_application', date_field: 'applyDate' },
    reminders: [
      { label: '交换项目申请', offset_days: 0, alerts: [90, 60, 30] },
      { label: '短期学生签证申请', offset_days: 0, alerts: [60, 30, 14] }
    ]
  },
  {
    rule_id: 'R_EXCHANGE_DEPARTURE',
    trigger: { event: 'exchange_end', date_field: 'endDate' },
    reminders: [
      { label: '交换期结束 — 到期必须离港(不构成永居)', offset_days: 0, alerts: [30, 14, 7, 3] },
      { label: '交换期不构成永居时长', offset_days: 0, alerts: [90, 60, 30] }
    ]
  },

  // ═══════════════════════════════════════════════════════════
  // 三、获批后通用规则 (Post-Approval · 所有路径获批后)
  // ═══════════════════════════════════════════════════════════

  {
    rule_id: 'R_APPROVAL_ACTIVATE',
    trigger: { event: 'approval_received', date_field: 'approvalDate' },
    reminders: [
      { label: '领取签证/进入许可', offset_days: 0, alerts: [14, 7, 3] },
      { label: '更新港澳通行证签注(如有)', offset_days: 7, alerts: [14, 7, 3] },
      { label: '赴港激活签证(3个月内)', offset_days: 0, alerts: [90, 60, 30, 14, 7, 3] }
    ]
  },
  {
    rule_id: 'R_ACTIVATION_ARRIVAL',
    trigger: { event: 'visa_activated', date_field: 'activationDate' },
    reminders: [
      { label: '入境领取小白条(务必保管)', offset_days: 0, alerts: [1, 0] },
      { label: '申办香港身份证(30天内)', offset_days: 0, alerts: [30, 21, 14, 7, 3] },
      { label: '领取香港身份证(约2周后)', offset_days: 14, alerts: [14, 10, 7, 3] }
    ]
  },

  // ═══════════════════════════════════════════════════════════
  // 四、续签通用规则 (Renewal · 所有需续签的路径)
  // ═══════════════════════════════════════════════════════════

  {
    rule_id: 'R_RENEWAL_PREP_UNIVERSAL',
    trigger: { event: 'renewal_prep_universal', date_field: 'visaExpiry' },
    reminders: [
      { label: '续签材料准备启动(到期前半年)', offset_days: -180, alerts: [180, 120, 90] },
      { label: '整理在港居住证明(租约/水电煤)', offset_days: -90, alerts: [90, 60, 30] },
      { label: '整理在港工作证明(雇佣合约/粮单)', offset_days: -90, alerts: [90, 60, 30] },
      { label: '整理税务记录(薪俸税报税表)', offset_days: -90, alerts: [90, 60, 30] },
      { label: '整理MPF供款记录', offset_days: -90, alerts: [90, 60, 30] },
      { label: '续签申请递交', offset_days: -30, alerts: [60, 30, 14, 7, 3] },
      { label: '签证到期预警 — 逾期逗留属违法', offset_days: 0, alerts: [30, 14, 7, 3, 1] }
    ]
  },
  {
    rule_id: 'R_RENEWAL_DOCUMENTS',
    trigger: { event: 'renewal_documents', date_field: 'renewalDate' },
    reminders: [
      { label: '推荐信时效性(建议3个月内)', offset_days: -90, alerts: [75, 60] },
      { label: '确保所有地址一致(住址/银行/报税)', offset_days: -30, alerts: [30, 14, 7] },
      { label: '续签材料清单逐项核对', offset_days: -14, alerts: [14, 7, 3] }
    ]
  },

  // ═══════════════════════════════════════════════════════════
  // 五、永居冲刺通用规则 (PR Sprint)
  // ═══════════════════════════════════════════════════════════

  {
    rule_id: 'R_PR_PREP_7YEAR',
    trigger: { event: 'pr_7year_approaching', date_field: 'sevenYearDate' },
    reminders: [
      { label: '永居倒计时1年 — 开始整理7年全部记录', offset_days: -365, alerts: [365, 180, 90] },
      { label: '永居倒计时半年 — 准备解释信(如有长离港)', offset_days: -180, alerts: [180, 90, 60] },
      { label: '永居材料清单检查', offset_days: -90, alerts: [90, 60, 30, 14, 7] },
      { label: '提前6个月准备续签材料(确保身份不断档)', offset_days: -180, alerts: [180, 90, 60] }
    ]
  },
  {
    rule_id: 'R_PR_APPLY',
    trigger: { event: 'pr_eligible', date_field: 'sevenYearDate' },
    reminders: [
      { label: '永居申请启动 — 填写R0P145申请表', offset_days: 0, alerts: [90, 60, 30] },
      { label: '整理7年出入境记录', offset_days: 0, alerts: [60, 30, 14] },
      { label: '证明在港「通常居住」满7年', offset_days: 0, alerts: [90, 60, 30] },
      { label: '递交永居核实申请', offset_days: 0, alerts: [30, 14, 7, 3] },
      { label: '永居面试准备', offset_days: 30, alerts: [30, 14, 7] }
    ]
  },
  {
    rule_id: 'R_PR_POST_APPROVAL',
    trigger: { event: 'pr_approved', date_field: 'approvalDate' },
    reminders: [
      { label: '永居获批 — 办理永久居民身份证', offset_days: 0, alerts: [30, 14, 7] },
      { label: '申请香港特区护照', offset_days: 0, alerts: [90, 60, 30] }
    ]
  },

  // ═══════════════════════════════════════════════════════════
  // 六、年度/周期性提醒 (Annual/Cyclical)
  // ═══════════════════════════════════════════════════════════

  {
    rule_id: 'R_ANNUAL_TAX',
    trigger: { event: 'annual_tax_check', date_field: 'aprilDate' },
    reminders: [
      { label: '香港税务年度开始(4月) — 整理上年度收入记录', offset_days: 0, alerts: [30, 14, 7] },
      { label: '薪俸税报税季节(5-6月) — 查收报税表', offset_days: 30, alerts: [30, 14, 7] }
    ]
  },
  {
    rule_id: 'R_ANNUAL_DOCUMENT_REVIEW',
    trigger: { event: 'annual_document_check', date_field: 'checkDate' },
    reminders: [
      { label: '年度证件有效检查 — 护照/通行证/签证', offset_days: 0, alerts: [60, 30, 14] },
      { label: '年度住址证明整理', offset_days: 0, alerts: [60, 30] },
      { label: '年度MPF权益报表查收', offset_days: 0, alerts: [60, 30] }
    ]
  },
  {
    rule_id: 'R_ANNUAL_TRAVEL_RECORD',
    trigger: { event: 'annual_travel_check', date_field: 'checkDate' },
    reminders: [
      { label: '年度在港天数统计(建议≥180天)', offset_days: 0, alerts: [30, 14] },
      { label: '离港记录整理 — 单次离港≥180天需书面解释', offset_days: 0, alerts: [180, 90, 60] }
    ]
  },

  // ═══════════════════════════════════════════════════════════
  // 七、获批激活流程 (Approval → Activation chain)
  // ═══════════════════════════════════════════════════════════

  {
    rule_id: 'R_CHAIN_APPROVAL_TO_ACTIVATION',
    trigger: { event: 'approval_received', date_field: 'approvalDate' },
    reminders: [
      { label: '① 缴付签证费用', offset_days: 3, alerts: [7, 3, 1] },
      { label: '② 下载/领取e-Visa/签证标签', offset_days: 7, alerts: [14, 7, 3] },
      { label: '③ 办理逗留D签注(如适用)', offset_days: 14, alerts: [30, 14, 7] },
      { label: '④ 预订赴港行程', offset_days: 30, alerts: [60, 30, 14] },
      { label: '⑤ 入境激活签证 — 走人工通道', offset_days: 90, alerts: [90, 60, 30, 14, 7, 3] },
      { label: '⑥ 入境后30天内申办香港身份证', offset_days: 90, alerts: [30, 21, 14, 7] },
      { label: '⑦ 领取香港身份证(约2周)', offset_days: 120, alerts: [14, 10, 7] }
    ]
  },

  // ═══════════════════════════════════════════════════════════
  // 八、签证到期紧急规则 (Urgent)
  // ═══════════════════════════════════════════════════════════

  {
    rule_id: 'R_URGENT_VISA_EXPIRY',
    trigger: { event: 'visa_expiring_urgent', date_field: 'expiryDate' },
    reminders: [
      { label: '⚠️ 签证即将到期 — 逾期逗留后果严重', offset_days: 0, alerts: [14, 7, 3, 1] },
      { label: '离港或申请延期签证', offset_days: 0, alerts: [7, 3, 1] }
    ]
  },
  {
    rule_id: 'R_URGENT_OVERSTAY',
    trigger: { event: 'overstay_risk', date_field: 'expiryDate' },
    reminders: [
      { label: '⚠️ 已逾期逗留 — 立即联系入境处', offset_days: 0, alerts: [0] }
    ]
  },

  // ═══════════════════════════════════════════════════════════
  // 九、抵港生活与定居 (Settlement & Living)
  // ═══════════════════════════════════════════════════════════

  {
    rule_id: 'R_SETTLE_MOBILE',
    trigger: { event: 'hk_arrival', date_field: 'arrivalDate' },
    reminders: [
      { label: '购买香港本地电话卡', offset_days: 0, alerts: [7, 3, 1] },
      { label: '下载必备App：八达通/MTR/OpenRice', offset_days: 0, alerts: [7, 3] }
    ]
  },
  {
    rule_id: 'R_SETTLE_OCTOPUS',
    trigger: { event: 'hk_arrival', date_field: 'arrivalDate' },
    reminders: [
      { label: '办理八达通卡(成人/学生)', offset_days: 0, alerts: [14, 7, 3] }
    ]
  },
  {
    rule_id: 'R_SETTLE_UTILITIES',
    trigger: { event: 'rental_start', date_field: 'moveInDate' },
    reminders: [
      { label: '开通水电煤账户', offset_days: 0, alerts: [14, 7, 3] },
      { label: '申请宽带/网络服务', offset_days: 0, alerts: [30, 14] }
    ]
  },
  {
    rule_id: 'R_SETTLE_INSURANCE',
    trigger: { event: 'hk_arrival', date_field: 'arrivalDate' },
    reminders: [
      { label: '购买家居保险(租客/业主)', offset_days: 30, alerts: [60, 30] },
      { label: '购买人寿/危疾保险', offset_days: 60, alerts: [90, 60, 30] }
    ]
  },
  {
    rule_id: 'R_SETTLE_LIBRARY',
    trigger: { event: 'hk_id_received', date_field: 'idDate' },
    reminders: [
      { label: '办理公共图书馆借书证(免费)', offset_days: 30, alerts: [90, 60] }
    ]
  },
  {
    rule_id: 'R_SETTLE_COMMUNITY',
    trigger: { event: 'hk_settled', date_field: 'settleDate' },
    reminders: [
      { label: '加入社区组织/同乡会(永居居住证明用)', offset_days: 90, alerts: [180, 90] }
    ]
  },

  // ═══════════════════════════════════════════════════════════
  // 十、自雇/创业提醒 (Self-Employed / Business)
  // ═══════════════════════════════════════════════════════════

  {
    rule_id: 'R_BIZ_REGISTRATION',
    trigger: { event: 'business_start', date_field: 'startDate' },
    reminders: [
      { label: '注册香港公司(BR+CI)', offset_days: 0, alerts: [90, 60, 30] },
      { label: '开设公司银行账户', offset_days: 30, alerts: [60, 30, 14] },
      { label: '申领商业登记证', offset_days: 0, alerts: [30, 14, 7] }
    ]
  },
  {
    rule_id: 'R_BIZ_ANNUAL',
    trigger: { event: 'business_anniversary', date_field: 'anniversaryDate' },
    reminders: [
      { label: '公司周年申报(NAR1)', offset_days: 0, alerts: [42, 30, 14, 7] },
      { label: '商业登记证续期', offset_days: 0, alerts: [60, 30, 14] },
      { label: '公司利得税报税', offset_days: 0, alerts: [90, 60, 30] }
    ]
  },
  {
    rule_id: 'R_BIZ_AUDIT',
    trigger: { event: 'business_audit_due', date_field: 'auditDate' },
    reminders: [
      { label: '公司审计 — 预约会计师', offset_days: 0, alerts: [90, 60, 30] },
      { label: '审计报告提交', offset_days: 0, alerts: [30, 14, 7] }
    ]
  },
  {
    rule_id: 'R_BIZ_OFFICE_RENTAL',
    trigger: { event: 'office_lease_expiring', date_field: 'leaseExpiry' },
    reminders: [
      { label: '办公室租约到期 — 续约或搬迁', offset_days: 0, alerts: [90, 60, 30, 14] }
    ]
  },
  {
    rule_id: 'R_BIZ_MPF_EMPLOYER',
    trigger: { event: 'employer_mpf_due', date_field: 'dueDate' },
    reminders: [
      { label: '雇主MPF供款(每月)', offset_days: 0, alerts: [14, 7, 3] },
      { label: '新雇员MPF登记(60天内)', offset_days: 0, alerts: [60, 30, 14] }
    ]
  },

  // ═══════════════════════════════════════════════════════════
  // 十一、文件公证与翻译 (Document Certification)
  // ═══════════════════════════════════════════════════════════

  {
    rule_id: 'R_DOC_NOTARIZE',
    trigger: { event: 'document_preparation', date_field: 'prepDate' },
    reminders: [
      { label: '内地学历证书公证/翻译', offset_days: 0, alerts: [60, 30, 14] },
      { label: '结婚证/出生证公证翻译', offset_days: 0, alerts: [60, 30, 14] },
      { label: '无犯罪记录证明申请', offset_days: 0, alerts: [60, 30, 14] }
    ]
  },
  {
    rule_id: 'R_DOC_TRANSLATION',
    trigger: { event: 'translation_needed', date_field: 'deadlineDate' },
    reminders: [
      { label: '非中/英文文件需认证翻译', offset_days: 0, alerts: [30, 14, 7] }
    ]
  },

  // ═══════════════════════════════════════════════════════════
  // 十二、家庭成员专项 (Family Members)
  // ═══════════════════════════════════════════════════════════

  {
    rule_id: 'R_FAMILY_SPOUSE_WORK_PERMIT',
    trigger: { event: 'dependent_visa_issued', date_field: 'issueDate' },
    reminders: [
      { label: '配偶可在港合法工作(非学生签受养人)', offset_days: 0, alerts: [90, 60, 30] }
    ]
  },
  {
    rule_id: 'R_FAMILY_CHILD_VACCINE',
    trigger: { event: 'child_hk_arrival', date_field: 'arrivalDate' },
    reminders: [
      { label: '子女在港疫苗接种安排', offset_days: 0, alerts: [30, 14, 7] },
      { label: '子女入学健康检查', offset_days: 0, alerts: [60, 30, 14] }
    ]
  },
  {
    rule_id: 'R_FAMILY_CHILD_DOCS',
    trigger: { event: 'child_hk_arrival', date_field: 'arrivalDate' },
    reminders: [
      { label: '子女出生证公证(香港认可)', offset_days: 0, alerts: [90, 60, 30] },
      { label: '子女香港身份证办理(11岁)', offset_days: 0, alerts: [180, 90, 60] }
    ]
  },
  {
    rule_id: 'R_FAMILY_ELDERLY_PARENTS',
    trigger: { event: 'pr_approved', date_field: 'approvalDate' },
    reminders: [
      { label: '永居后可申请父母赴港(单程证)：独生子女+60岁+内地无子女', offset_days: 0, alerts: [365, 180, 90] }
    ]
  },

  // ═══════════════════════════════════════════════════════════
  // 十三、在港维持 (Ongoing Maintenance · Year 1-6)
  // ═══════════════════════════════════════════════════════════

  {
    rule_id: 'R_MAINTAIN_CONSUMPTION_RECORD',
    trigger: { event: 'maintaining_residency', date_field: 'startDate' },
    reminders: [
      { label: '保持在港消费记录(银行月结单保留)', offset_days: 0, alerts: [180, 90] },
      { label: '保持在港信用卡消费(续签辅助证明)', offset_days: 0, alerts: [180, 90] }
    ]
  },
  {
    rule_id: 'R_MAINTAIN_HEALTH_RECORD',
    trigger: { event: 'maintaining_residency', date_field: 'startDate' },
    reminders: [
      { label: '保持在港就医记录(续签居住证明用)', offset_days: 0, alerts: [365, 180] }
    ]
  },
  {
    rule_id: 'R_MAINTAIN_SOCIAL',
    trigger: { event: 'maintaining_residency', date_field: 'startDate' },
    reminders: [
      { label: '参加在港社团/义工活动(永居用)', offset_days: 0, alerts: [365, 180] },
      { label: '保持在港社交记录(活动/会员)', offset_days: 0, alerts: [365, 180] }
    ]
  },
  {
    rule_id: 'R_MAINTAIN_QUARTERLY_REVIEW',
    trigger: { event: 'quarterly_review', date_field: 'reviewDate' },
    reminders: [
      { label: '季度在港天数统计', offset_days: 0, alerts: [14, 7] },
      { label: '季度文件归档：账单/税单/MPF记录', offset_days: 0, alerts: [14, 7] }
    ]
  },

  // ═══════════════════════════════════════════════════════════
  // 十四、申请递交前最后核对 (Pre-Submission Checklist)
  // ═══════════════════════════════════════════════════════════

  {
    rule_id: 'R_PRECHECK_APPLICATION',
    trigger: { event: 'pre_submission', date_field: 'submissionDate' },
    reminders: [
      { label: '最终核对申请表信息(姓名/护照号/地址)', offset_days: 0, alerts: [7, 3, 1] },
      { label: '确认所有附件已签名', offset_days: 0, alerts: [7, 3, 1] },
      { label: '确认照片规格(白底50mm×40mm)', offset_days: 0, alerts: [7, 3, 1] },
      { label: '确认申请费已准备', offset_days: 0, alerts: [7, 3, 1] }
    ]
  },
  {
    rule_id: 'R_PRECHECK_PASSPORT_PHOTO',
    trigger: { event: 'photo_needed', date_field: 'deadlineDate' },
    reminders: [
      { label: '证件照拍摄(白底50mm×40mm，6个月内)', offset_days: 0, alerts: [14, 7, 3] }
    ]
  },

  // ═══════════════════════════════════════════════════════════
  // 十五、疫情/特殊情况 (Special Circumstances)
  // ═══════════════════════════════════════════════════════════

  {
    rule_id: 'R_SPECIAL_TRAVEL_RESTRICTION',
    trigger: { event: 'travel_restricted', date_field: 'restrictionDate' },
    reminders: [
      { label: '确认入境限制政策 — 可能影响签证激活', offset_days: 0, alerts: [30, 14, 7] }
    ]
  },
  {
    rule_id: 'R_SPECIAL_VISA_EXTENSION',
    trigger: { event: 'force_majeure', date_field: 'eventDate' },
    reminders: [
      { label: '特殊情况 — 向入境处申请签证延期', offset_days: 0, alerts: [30, 14, 7] }
    ]
  },

  // ═══════════════════════════════════════════════════════════
  // 十六、学生专项补充 (Student Supplementary)
  // ═══════════════════════════════════════════════════════════

  {
    rule_id: 'R_STUDENT_PARTTIME_WORK',
    trigger: { event: 'student_visa_activated', date_field: 'activationDate' },
    reminders: [
      { label: '学生合法兼职(2024起无限时)', offset_days: 0, alerts: [60, 30] }
    ]
  },
  {
    rule_id: 'R_STUDENT_INTERNSHIP',
    trigger: { event: 'semester_break', date_field: 'breakDate' },
    reminders: [
      { label: '寒暑假实习申请', offset_days: 0, alerts: [60, 30, 14] }
    ]
  }
];
