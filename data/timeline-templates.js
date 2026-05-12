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
  }
};

module.exports = { TIMELINE_TEMPLATES };
