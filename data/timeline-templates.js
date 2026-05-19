/**
 * 住港伴 — 路径感知时间线模板
 * 每个路径定义从起点到永居的关键节点 + 材料清单
 * offsetDays: 相对激活日期的偏移天数
 * range: [最早, 最晚] 天（审批周期浮动范围）
 */

var TIMELINE_TEMPLATES = {

  // ═══════ 优才计划 QMAS ═══════
  qmas: {
    name: '优才计划 (QMAS)',
    visaYears: 2,
    nodes: [
      { id: 'prepare', label: '准备材料', offsetDays: -90, type: 'material',
        desc: '学位证+成绩单+推荐信+赴港计划书+无犯罪记录', materials: ['degree_cert','transcript','reference_letter','plan_statement'] },
      { id: 'self_assess', label: '12项准则自评', offsetDays: -60, type: 'milestone',
        desc: '确认满足≥6项准则', materials: [] },
      { id: 'submit', label: '递交优才申请', offsetDays: 0, type: 'milestone',
        desc: '在线递交ID(C)981表格+全部材料', materials: ['id_card','hk_permit','photo'] },
      { id: 'ack', label: '收到申请编号确认', offsetDays: 30, type: 'milestone',
        desc: '入境处发出申请编号，可在线查询进度', materials: [], range: [14, 60] },
      { id: 'approval', label: '原则上批准', offsetDays: 210, type: 'milestone',
        desc: '获批后需补充赴港同意书等材料', materials: [], range: [180, 365] },
      { id: 'activate', label: '赴港激活签证', offsetDays: 275, type: 'deadline',
        desc: '获批后3个月内须入境激活', materials: ['hk_permit','visa_label'], range: [210, 365] },
      { id: 'hkid', label: '办理香港身份证', offsetDays: 289, type: 'milestone',
        desc: '入境后14天内预约办理', materials: ['photo'] },
      { id: 'first_expiry', label: '首次签证到期', offsetDays: 730, type: 'deadline',
        desc: '2年签证到期，需提前90天续签', materials: ['emp_letter','tax_record','bank_statement'] },
      { id: 'renew_1', label: '第一次续签(2年)', offsetDays: 640, type: 'renewal',
        desc: '提前90天递交续签申请', materials: ['emp_letter','mpf_record','tax_record','address_proof'] },
      { id: 'renew_2', label: '第二次续签(3年)', offsetDays: 1370, type: 'renewal',
        desc: '需满足通常居住条件', materials: ['emp_letter','mpf_record','tax_record'] },
      { id: 'renew_3', label: '第三次续签(3年)', offsetDays: 2465, type: 'renewal',
        desc: '如仍未满7年可续签至满7年', materials: ['emp_letter','mpf_record'] },
      { id: 'pr_window', label: '永居申请窗口', offsetDays: 2525, type: 'pr',
        desc: '满7年前30天可递交永居申请', materials: ['hk_id','tax_7y','residence_proof'] },
      { id: 'pr_deadline', label: '永居申请截止', offsetDays: 2585, type: 'pr',
        desc: '满7年后30天宽限', materials: [] }
    ]
  },

  // ═══════ 高才通 A类 TTPS-A ═══════
  ttps_a: {
    name: '高才通A类',
    visaYears: 3,
    nodes: [
      { id: 'income_proof', label: '准备年收入证明(≥250万港币)', offsetDays: -30, type: 'material',
        desc: '税单+银行流水+雇主证明', materials: ['income_250w','tax_250w','bank_statement'] },
      { id: 'submit', label: '递交高才通A类申请', offsetDays: 0, type: 'milestone',
        desc: '在线递交+上传收入证明', materials: ['id_card','hk_permit','photo'] },
      { id: 'approval', label: '预计获批(4-8周)', offsetDays: 42, type: 'milestone',
        desc: 'A类审批较快，通常1-2个月', materials: [], range: [28, 56] },
      { id: 'activate', label: '赴港激活签证', offsetDays: 60, type: 'deadline',
        desc: '下载e-Visa，携证件入境激活', materials: ['hk_permit'] },
      { id: 'hkid', label: '办理香港身份证', offsetDays: 74, type: 'milestone',
        desc: '入境后14天内', materials: ['photo'] },
      { id: 'first_expiry', label: '首次签证到期(3年)', offsetDays: 1095, type: 'deadline',
        desc: 'A类首次36个月，到期前90天续签', materials: ['income_250w','tax_record'] },
      { id: 'renew_1', label: '第一次续签(3年)', offsetDays: 1005, type: 'renewal',
        desc: '提前90天递交，需维持收入水平', materials: ['income_250w','emp_letter','tax_record'] },
      { id: 'renew_2', label: '第二次续签(3年)', offsetDays: 2100, type: 'renewal',
        desc: '3+3+3模式，累计至7年', materials: ['income_250w','emp_letter','tax_record'] },
      { id: 'pr_window', label: '永居申请窗口', offsetDays: 2525, type: 'pr',
        desc: '满7年前30天', materials: ['hk_id','tax_7y','residence_proof'] }
    ]
  },

  // ═══════ 高才通 B/C类 TTPS-B/C ═══════
  ttps_b: {
    name: '高才通B类',
    visaYears: 2,
    nodes: [
      { id: 'degree_check', label: '确认百强大学资格', offsetDays: -14, type: 'milestone',
        desc: '确认本科毕业于合资格大学名单', materials: ['degree_cert','transcript'] },
      { id: 'submit', label: '递交高才通B类申请', offsetDays: 0, type: 'milestone',
        desc: '在线递交+学位证+3年工作经验证明', materials: ['id_card','hk_permit','degree_cert','emp_letter'] },
      { id: 'approval', label: '预计获批(4-8周)', offsetDays: 42, type: 'milestone',
        desc: 'B/C类审批约1-2个月', materials: [], range: [28, 56] },
      { id: 'activate', label: '赴港激活签证', offsetDays: 60, type: 'deadline',
        desc: '下载e-Visa入境激活', materials: ['hk_permit'] },
      { id: 'hkid', label: '办理香港身份证', offsetDays: 74, type: 'milestone',
        desc: '入境后14天内', materials: ['photo'] },
      { id: 'first_expiry', label: '首次签证到期(2年)', offsetDays: 730, type: 'deadline',
        desc: 'B/C类首次24个月', materials: ['emp_letter','tax_record'] },
      { id: 'renew_1', label: '第一次续签(3年)', offsetDays: 640, type: 'renewal',
        desc: '提前90天，需在港≥180天/年+两址两单', materials: ['emp_letter','mpf_record','tax_record','address_proof','bank_statement'] },
      { id: 'renew_2', label: '第二次续签(3年)', offsetDays: 1735, type: 'renewal',
        desc: '2+3+3模式', materials: ['emp_letter','mpf_record','tax_record'] },
      { id: 'pr_window', label: '永居申请窗口', offsetDays: 2525, type: 'pr',
        desc: '满7年前30天', materials: ['hk_id','tax_7y','residence_proof'] }
    ]
  },
  ttps_c: {
    name: '高才通C类',
    visaYears: 2,
    nodes: [
      { id: 'degree_check', label: '确认百强大学资格+名额', offsetDays: -14, type: 'milestone',
        desc: 'C类年度限额10000名，先到先得', materials: ['degree_cert','transcript'] },
      { id: 'submit', label: '递交高才通C类申请', offsetDays: 0, type: 'milestone',
        desc: '经验<3年亦可申请', materials: ['id_card','hk_permit','degree_cert'] },
      { id: 'approval', label: '预计获批', offsetDays: 42, type: 'milestone',
        desc: '', materials: [], range: [28, 56] },
      { id: 'activate', label: '赴港激活', offsetDays: 60, type: 'deadline', desc: '', materials: ['hk_permit'] },
      { id: 'hkid', label: '办理香港身份证', offsetDays: 74, type: 'milestone', desc: '', materials: ['photo'] },
      { id: 'first_expiry', label: '首次签证到期(2年)', offsetDays: 730, type: 'deadline', desc: '', materials: ['emp_letter'] },
      { id: 'renew_1', label: '第一次续签(3年)', offsetDays: 640, type: 'renewal',
        desc: '需在港≥180天/年+两址两单', materials: ['emp_letter','mpf_record','tax_record','address_proof'] },
      { id: 'renew_2', label: '第二次续签(3年)', offsetDays: 1735, type: 'renewal', desc: '', materials: ['emp_letter','mpf_record'] },
      { id: 'pr_window', label: '永居申请窗口', offsetDays: 2525, type: 'pr', desc: '', materials: ['hk_id','tax_7y','residence_proof'] }
    ]
  },

  // ═══════ 专才计划 ASMTP ═══════
  asmpt: {
    name: '专才计划 (ASMTP)',
    visaYears: 2,
    nodes: [
      { id: 'employer', label: '雇主准备担保材料', offsetDays: -30, type: 'material',
        desc: 'ID990B表格+公司注册证+财务报表+招聘证明', materials: ['emp_letter','reference_letter'] },
      { id: 'submit', label: '递交专才申请', offsetDays: 0, type: 'milestone',
        desc: 'ID990A+ID990B同时递交', materials: ['id_card','hk_permit','degree_cert','emp_letter'] },
      { id: 'approval', label: '预计获批(4-8周)', offsetDays: 42, type: 'milestone',
        desc: '', materials: [], range: [28, 56] },
      { id: 'activate', label: '赴港激活+领取签证标签', offsetDays: 60, type: 'deadline', desc: '', materials: ['hk_permit'] },
      { id: 'hkid', label: '办理香港身份证', offsetDays: 74, type: 'milestone', desc: '', materials: ['photo'] },
      { id: 'first_expiry', label: '首次签证到期(与合同挂钩)', offsetDays: 730, type: 'deadline',
        desc: '首次通常2年，与雇佣合同期限一致', materials: ['emp_letter'] },
      { id: 'renew_1', label: '续签(需雇主继续担保)', offsetDays: 640, type: 'renewal',
        desc: '换工作需重新申请', materials: ['emp_letter','tax_record'] },
      { id: 'pr_window', label: '永居申请窗口', offsetDays: 2525, type: 'pr',
        desc: '满7年前30天', materials: ['hk_id','tax_7y','residence_proof'] }
    ]
  },

  // ═══════ IANG (学生→留港) ═══════
  student_iang: {
    name: '学生→IANG',
    visaYears: 1,
    nodes: [
      { id: 'graduate', label: '毕业/取得学位证', offsetDays: 0, type: 'milestone',
        desc: '全日制本科及以上毕业', materials: ['degree_cert','transcript'] },
      { id: 'apply_iang', label: '申请IANG签证', offsetDays: 7, type: 'milestone',
        desc: '毕业后6个月内申请无需雇主', materials: ['id_card','student_visa','degree_cert','photo'] },
      { id: 'receive', label: '领取IANG签证(2-4周)', offsetDays: 21, type: 'milestone',
        desc: '', materials: [], range: [14, 28] },
      { id: 'activate', label: '激活IANG', offsetDays: 30, type: 'deadline', desc: '', materials: ['hk_permit'] },
      { id: 'first_expiry', label: '首次IANG到期(1年)', offsetDays: 365, type: 'deadline',
        desc: '需在港工作或经营业务', materials: ['emp_letter','bank_statement'] },
      { id: 'renew_1', label: '第一次IANG续签(2年)', offsetDays: 275, type: 'renewal',
        desc: '提前90天，需在港就业', materials: ['emp_letter','mpf_record','tax_record'] },
      { id: 'renew_2', label: '第二次IANG续签(2年)', offsetDays: 1005, type: 'renewal',
        desc: '1+2+2模式', materials: ['emp_letter','mpf_record'] },
      { id: 'renew_3', label: '后续续签(3年)', offsetDays: 1735, type: 'renewal',
        desc: '1+2+2+3模式', materials: ['emp_letter','mpf_record','tax_record'] },
      { id: 'pr_window', label: '永居申请窗口', offsetDays: 2525, type: 'pr',
        desc: '在港居住满7年', materials: ['hk_id','tax_7y','residence_proof'] }
    ]
  },

  dependent: {
    name: '受养人签证', visaYears: 2,
    nodes: [
      { id: 'sponsor_approved', label: '保证人获批身份', offsetDays: 0, type: 'milestone', desc: '配偶/父母获批香港身份后申请', materials: ['sponsor_id','marriage_cert','birth_cert'] },
      { id: 'submit', label: '递交受养人申请', offsetDays: 7, type: 'milestone', desc: 'ID 997表格+关系证明', materials: ['id_form_997','sponsor_emp','bank_statement'] },
      { id: 'approval', label: '获批受养人签证', offsetDays: 45, type: 'milestone', desc: '通常4-6周审批', materials: [], range: [30, 60] },
      { id: 'activate', label: '赴港激活签证', offsetDays: 60, type: 'deadline', desc: '获批后3个月内入境', materials: ['hk_permit','visa_label'] },
      { id: 'hkid', label: '办理香港身份证', offsetDays: 74, type: 'milestone', desc: '11岁以上须办理', materials: ['photo'] },
      { id: 'first_expiry', label: '首次签证到期', offsetDays: 730, type: 'deadline', desc: '与保证人同步续签', materials: ['sponsor_emp','marriage_cert','bank_statement'] },
      { id: 'pr_window', label: '永居申请窗口', offsetDays: 2525, type: 'pr', desc: '在港通常居住满7年', materials: ['hk_id','tax_7y','residence_proof'] }
    ]
  },

  cies: {
    name: 'CIES投资类身份规划', visaYears: 2,
    nodes: [
      { id: 'invest_verify', label: '完成合资格投资(>=3000万)', offsetDays: 0, type: 'milestone', desc: '投资于获许金融资产', materials: ['investment_proof','bank_statement'] },
      { id: 'submit', label: '递交CIES申请', offsetDays: 7, type: 'milestone', desc: '原则上批准后6个月内完成投资', materials: ['id_card','investment_proof','net_worth_cert'] },
      { id: 'approval', label: '正式批准', offsetDays: 30, type: 'milestone', desc: '', materials: [], range: [14, 60] },
      { id: 'activate', label: '赴港激活签证', offsetDays: 45, type: 'deadline', desc: '', materials: ['hk_permit'] },
      { id: 'hkid', label: '办理香港身份证', offsetDays: 60, type: 'milestone', desc: '', materials: ['photo'] },
      { id: 'first_expiry', label: '首次签证到期', offsetDays: 730, type: 'deadline', desc: '需维持投资', materials: ['investment_proof'] },
      { id: 'pr_window', label: '永居申请窗口', offsetDays: 2525, type: 'pr', desc: '在港通常居住满7年', materials: ['hk_id','investment_proof_7y'] }
    ]
  },

  techtas: {
    name: '科技人才入境计划', visaYears: 2,
    nodes: [
      { id: 'job_offer', label: '获科技公司聘用', offsetDays: 0, type: 'milestone', desc: '雇主须为创新科技署认可机构', materials: ['emp_letter','company_cert'] },
      { id: 'submit', label: '递交TechTAS申请', offsetDays: 14, type: 'milestone', desc: '雇主代为申请配额', materials: ['id_card','degree_cert','emp_letter'] },
      { id: 'quota_approval', label: '配额获批', offsetDays: 28, type: 'milestone', desc: '通常2-4周', materials: [], range: [14, 30] },
      { id: 'visa_apply', label: '申请工作签证', offsetDays: 35, type: 'milestone', desc: '', materials: ['photo','hk_permit'] },
      { id: 'activate', label: '赴港入职', offsetDays: 50, type: 'deadline', desc: '', materials: ['hk_permit','visa_label'] },
      { id: 'hkid', label: '办理香港身份证', offsetDays: 65, type: 'milestone', desc: '', materials: ['photo'] },
      { id: 'first_expiry', label: '首次签证到期', offsetDays: 730, type: 'deadline', desc: '需维持受雇状态', materials: ['emp_letter','tax_record'] },
      { id: 'pr_window', label: '永居申请窗口', offsetDays: 2525, type: 'pr', desc: '在港通常居住满7年', materials: ['hk_id','tax_7y','residence_proof'] }
    ]
  },

  parttime_qmas: {
    name: '兼读进修->优才', visaYears: 1,
    nodes: [
      { id: 'enroll', label: '入读兼读制课程', offsetDays: 0, type: 'milestone', desc: '香港高校兼读制硕士/博士', materials: ['admission_letter','student_visa'] },
      { id: 'grad', label: '毕业取得学位', offsetDays: 365, type: 'milestone', desc: '毕业后可申请IANG或优才', materials: ['degree_cert','transcript'] },
      { id: 'apply_iang', label: '申请IANG签证', offsetDays: 372, type: 'milestone', desc: '毕业后6个月内无需雇主', materials: ['degree_cert','photo'] },
      { id: 'activate', label: '开始留港工作', offsetDays: 400, type: 'deadline', desc: '', materials: ['hk_permit'] },
      { id: 'first_expiry', label: '首次IANG到期', offsetDays: 730, type: 'deadline', desc: '1年后续签', materials: ['emp_letter','tax_record'] },
      { id: 'pr_window', label: '永居申请窗口', offsetDays: 2525, type: 'pr', desc: '在港通常居住满7年', materials: ['hk_id','tax_7y','residence_proof'] }
    ]
  },

  minor_student: {
    name: '未成年学生签证', visaYears: 1,
    nodes: [
      { id: 'school_admit', label: '获香港学校录取', offsetDays: 0, type: 'milestone', desc: '中小学或幼稚园录取', materials: ['admission_letter'] },
      { id: 'submit', label: '递交学生签证申请', offsetDays: 7, type: 'milestone', desc: 'ID 995A表格', materials: ['birth_cert','guardian_id','school_letter'] },
      { id: 'approval', label: '获批学生签证', offsetDays: 45, type: 'milestone', desc: '通常4-6周', materials: [], range: [30, 60] },
      { id: 'activate', label: '赴港入学', offsetDays: 60, type: 'deadline', desc: '', materials: ['hk_permit','visa_label'] },
      { id: 'hkid', label: '办理香港身份证', offsetDays: 75, type: 'milestone', desc: '11岁以上须办理', materials: ['photo'] },
      { id: 'renew_yearly', label: '年度签证续期', offsetDays: 365, type: 'renewal', desc: '每年续签，需在读证明', materials: ['school_letter','guardian_id'] },
      { id: 'pr_window', label: '永居申请窗口', offsetDays: 2525, type: 'pr', desc: '在港通常居住满7年', materials: ['hk_id','residence_proof'] }
    ]
  },

  exchange: {
    name: '交换生签证', visaYears: 1,
    nodes: [
      { id: 'exchange_accept', label: '获交换项目录取', offsetDays: 0, type: 'milestone', desc: '内地与香港高校交换', materials: ['admission_letter','exchange_agreement'] },
      { id: 'submit', label: '递交学生签证申请', offsetDays: 7, type: 'milestone', desc: 'ID 995A表格', materials: ['id_card','student_id','school_letter'] },
      { id: 'approval', label: '获批学生签证', offsetDays: 35, type: 'milestone', desc: '通常3-5周', materials: [], range: [21, 42] },
      { id: 'activate', label: '赴港报到', offsetDays: 45, type: 'deadline', desc: '', materials: ['hk_permit'] },
      { id: 'program_end', label: '交换结束/离港', offsetDays: 180, type: 'milestone', desc: '交换期通常1学期', materials: [] },
      { id: 'visa_expire', label: '学生签证到期', offsetDays: 365, type: 'deadline', desc: '不可续签（短期交换）', materials: [] }
    ]
  },

  retirement: {
    name: '退休人士签证', visaYears: 2,
    nodes: [
      { id: 'qualify', label: '确认退休身份', offsetDays: 0, type: 'milestone', desc: '需证明已退休+有经济能力', materials: ['retirement_cert','pension_proof','bank_statement'] },
      { id: 'submit', label: '递交签证申请', offsetDays: 14, type: 'milestone', desc: '需证明可在港自给自足', materials: ['id_card','pension_proof','medical_insurance'] },
      { id: 'approval', label: '获批签证', offsetDays: 45, type: 'milestone', desc: '通常4-6周', materials: [], range: [30, 60] },
      { id: 'activate', label: '赴港定居', offsetDays: 60, type: 'deadline', desc: '获批后3个月内入境', materials: ['hk_permit','visa_label'] },
      { id: 'hkid', label: '办理香港身份证', offsetDays: 75, type: 'milestone', desc: '', materials: ['photo'] },
      { id: 'first_expiry', label: '首次签证到期', offsetDays: 730, type: 'deadline', desc: '需证明经济能力维持', materials: ['bank_statement','medical_insurance'] },
      { id: 'pr_window', label: '永居申请窗口', offsetDays: 2525, type: 'pr', desc: '在港通常居住满7年', materials: ['hk_id','tax_7y','residence_proof'] }
    ]
  }

};

module.exports = { TIMELINE_TEMPLATES };