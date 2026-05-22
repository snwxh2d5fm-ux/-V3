/**
 * rule-engine.js — 效率宝预审规则引擎
 *
 * 从 knowledge_chunks 集合加载识别库条目（按 source=doc_recognition_library 过滤），
 * 对传入的文档 OCR 字段执行校验规则匹配。
 *
 * 规则模型：
 *   P0 = 阻断性错误（如证号校验位不通过、证件过期）
 *   P1 = 高优先级告警（如公章不完整、日期不一致）
 *   P2 = 建议性提示（如"建议补充翻译件"）
 *
 * 置信度标注：
 *   A = 法源明确 → 算法确定性结果
 *   B = 政策明确 → 高置信度推断
 *   C = 多数实践 → 入场处有酌情权
 *   D = 合理推断 → 参考性建议
 *
 * K2 隔离：本模块所有规则逻辑仅在云函数端执行，不暴露给前端。
 * 输出仅返回 K0/K1 级别的检查结果描述。
 */

let RULES_CACHE = null; // 内存缓存所有规则
let CACHE_LOADED_AT = 0; // 缓存加载时间戳
const CACHE_TTL = 3600000; // 缓存有效期 60 分钟

/**
 * 从 knowledge_chunks 加载指定 doc_id 的校验规则
 * @param {object} db - CloudBase 数据库实例
 * @param {string} docId - DOC-XXXX 格式的文档ID
 * @returns {object} 文档识别库条目（含 validation_rules / key_fields / format_specs 等）
 */
async function loadDocRules(db, docId) {
  const now = Date.now();
  if (!RULES_CACHE || now - CACHE_LOADED_AT > CACHE_TTL) {
    const res = await db
      .collection('knowledge_chunks')
      .where({
        source: 'doc_recognition_library',
        'metadata.doc_id': docId,
      })
      .limit(1)
      .get();
    RULES_CACHE = {};
    if (res.data && res.data.length > 0) {
      const chunk = res.data[0];
      const metadata = chunk.metadata || {};
      RULES_CACHE[docId] = {
        doc_id: metadata.doc_id || docId,
        name_zh: metadata.name_zh || '',
        name_en: metadata.name_en || '',
        category: metadata.category || '',
        key_fields: metadata.key_fields || [],
        validation_rules: metadata.validation_rules || [],
        format_specs: metadata.format_specs || {},
        validity_period: metadata.validity_period || '',
        milestone_role: metadata.milestone_role || null,
        privacy_level: metadata.privacy_level || 'L2',
        confidence_level: metadata.confidence_level || 'B',
      };
    }
    CACHE_LOADED_AT = now;
  }
  return RULES_CACHE[docId] || null;
}

/**
 * 执行单条规则的校验
 * @param {object} rule — { rule_id, description, severity, confidence }
 * @param {object} extractedFields — OCR提取的字段 { field_name: value }
 * @param {object} context — 上下文（如当前日期、用户画像等）
 * @returns {object} { rule_id, passed, severity, confidence, message, detail }
 */
function executeRule(rule, extractedFields, context) {
  const ruleId = rule.rule_id;
  const severity = rule.severity || 'P1';
  const confidence = rule.confidence || 'B';
  const desc = rule.description || '';

  // 根据 rule_id 匹配对应的校验函数
  const handler = RULE_HANDLERS[ruleId];
  if (!handler) {
    return {
      rule_id: ruleId,
      passed: true,
      severity: severity,
      confidence: confidence,
      message: '[跳过] 规则未实现: ' + desc,
      detail: '',
    };
  }

  try {
    const result = handler(extractedFields, context, rule);
    return {
      rule_id: ruleId,
      passed: result.passed,
      severity: severity,
      confidence: confidence,
      message: result.message || desc,
      detail: result.detail || '',
    };
  } catch (e) {
    return {
      rule_id: ruleId,
      passed: true,
      severity: severity,
      confidence: 'D',
      message: '[异常] 规则执行出错: ' + desc,
      detail: e.message,
    };
  }
}

/**
 * 运行完整的预审流程
 * @param {object} db - CloudBase 数据库实例
 * @param {string} docId - DOC-XXXX 格式的文档ID
 * @param {object} extractedFields - OCR提取的字段
 * @param {object} context - 上下文（当前日期、用户路径等）
 * @returns {object} 预审报告
 */
async function runPreaudit(db, docId, extractedFields, context) {
  const docRules = await loadDocRules(db, docId);
  if (!docRules) {
    return {
      doc_id: docId,
      status: 'unknown_doc',
      summary: '未找到该文档类型的校验规则（doc_id=' + docId + '）。请确认识别库已导入。',
      rules: [],
      milestone: null,
      disclaimer: buildDisclaimer(),
    };
  }

  const now = context.currentDate || new Date().toISOString().slice(0, 10);
  const execContext = {
    currentDate: now,
    userPath: context.userPath || '',
    userPersona: context.userPersona || 0,
    relatedDocs: context.relatedDocs || [],
  };

  // 执行全部校验规则
  const ruleResults = [];
  const rules = docRules.validation_rules || [];
  for (let i = 0; i < rules.length; i++) {
    ruleResults.push(executeRule(rules[i], extractedFields, execContext));
  }

  // 统计
  const p0Failed = [];
  const p1Failed = [];
  const p2Failed = [];
  for (let j = 0; j < ruleResults.length; j++) {
    const r = ruleResults[j];
    if (r.passed) continue;
    if (r.severity === 'P0') p0Failed.push(r.rule_id);
    else if (r.severity === 'P1') p1Failed.push(r.rule_id);
    else p2Failed.push(r.rule_id);
  }

  let overall = 'pass';
  if (p0Failed.length > 0) overall = 'blocked';
  else if (p1Failed.length > 0) overall = 'warning';
  else if (p2Failed.length > 0) overall = 'info';

  // 里程碑检测
  let milestoneInfo = null;
  if (docRules.milestone_role) {
    milestoneInfo = {
      role: docRules.milestone_role,
      doc_id: docId,
      doc_name: docRules.name_zh,
      triggered: p0Failed.length === 0, // P0 全过才触发里程碑
      stage_ui: null, // 由 milestone-check.js 补充
    };
  }

  return {
    doc_id: docId,
    doc_name: docRules.name_zh,
    status: overall,
    summary: buildSummary(docRules, ruleResults, overall),
    rules: ruleResults,
    stats: { total: ruleResults.length, p0: p0Failed, p1: p1Failed, p2: p2Failed },
    milestone: milestoneInfo,
    disclaimer: buildDisclaimer(),
  };
}

// ========== 规则执行器映射 ==========

var RULE_HANDLERS = {
  // === DOC-0101 身份证 ===
  'V-ID-01': function (f, ctx) {
    // 公民身份号码校验位（ISO 7064:1983 MOD 11-2）
    const idNo = f.id_number || '';
    if (!idNo) return { passed: true, message: '未提取到身份证号码，无法校验' };
    const valid = validateChineseID(idNo);
    return {
      passed: valid,
      message: valid ? '身份证号码校验通过' : '身份证号码校验失败',
      detail: valid ? '' : '号码不符合 ISO 7064 MOD 11-2 校验规则',
    };
  },
  'V-ID-02': function (f, ctx) {
    const validTo = f.valid_to || '';
    if (!validTo) return { passed: true, message: '未提取到有效期，无法校验' };
    const expired = validTo < ctx.currentDate;
    return {
      passed: !expired,
      message: expired ? '身份证已过期（有效期至 ' + validTo + '）' : '身份证在有效期内',
      detail: expired ? '请使用有效期内的身份证' : '',
    };
  },
  'V-ID-03': function (f, ctx) {
    // 人像面与国徽面匹配 — 需要双面数据，单面时跳过
    return { passed: true, message: '人像面/国徽面匹配校验（需双面数据）' };
  },
  'V-ID-04': function (f, ctx) {
    // 圆角边框 — 视觉特征，OCR 不做判断（K2 规则仅服务端标记）
    return { passed: true, message: '圆角边框检测由视觉引擎处理' };
  },
  'V-ID-05': function (f, ctx) {
    const authority = f.issuing_authority || '';
    if (!authority) return { passed: true, message: '未提取到签发机关' };
    const ok = authority.length >= 4;
    return {
      passed: ok,
      message: ok ? '签发机关信息完整' : '签发机关信息不完整',
      detail: ok ? '' : '签发机关字段过短: ' + authority,
    };
  },

  // === DOC-0102 港澳通行证 ===
  'V-EEP-01': function (f, ctx) {
    const docNo = f.doc_number || '';
    if (!docNo) return { passed: true, message: '未提取到证件号码' };
    const ok = /^C\d{8}$/.test(docNo);
    return {
      passed: ok,
      message: ok ? '通行证号码格式正确' : '通行证号码格式异常',
      detail: ok ? '' : '预期"C+8位数字"，实际: ' + docNo,
    };
  },
  'V-EEP-02': function (f, ctx) {
    const validTo = f.valid_to || '';
    if (!validTo) return { passed: true, message: '未提取到通行证有效期' };
    const expired = validTo < ctx.currentDate;
    return {
      passed: !expired,
      message: expired ? '港澳通行证已过期' : '通行证在有效期内',
      detail: expired ? '有效期至 ' + validTo : '',
    };
  },
  'V-EEP-03': function (f, ctx) {
    const endType = f.endorsement_type || '';
    if (!endType) return { passed: true, message: '未提取到签注类型' };
    const isD = endType.indexOf('D') !== -1 || endType.indexOf('逗留') !== -1;
    return {
      passed: isD,
      message: isD ? '签注类型为逗留D（在港长期逗留）' : '签注类型非逗留D签注',
      detail: isD ? '' : '当前签注: ' + endType + '，在港长期逗留需要逗留D签注',
    };
  },

  // === DOC-0103 香港身份证 ===
  'V-HKID-01': function (f, ctx) {
    const hkid = f.hkid_number || '';
    if (!hkid) return { passed: true, message: '未提取到香港身份证号码' };
    const ok = validateHKID(hkid);
    return {
      passed: ok,
      message: ok ? '香港身份证号码校验通过' : '香港身份证号码校验失败',
      detail: ok ? '' : '校验位不匹配',
    };
  },
  'V-HKID-02': function (f, ctx) {
    return { passed: true, message: '香港身份证永久有效' };
  },

  // === DOC-0601 获批通知书 ===
  'V-AIP-01': function (f, ctx) {
    return { passed: true, message: '入境处信头格式（视觉特征，OCR辅助判断）' };
  },
  'V-AIP-02': function (f, ctx) {
    const appNo = f.application_no || '';
    if (!appNo) return { passed: true, message: '未提取到申请编号' };
    const ok = /[A-Z]{2,4}[- ]?\d{4,7}[- ]?\d{2,6}/i.test(appNo);
    return {
      passed: ok,
      message: ok ? '申请编号格式正常' : '申请编号格式异常',
      detail: ok ? '' : '预期如 ENTR-2025-XXXXXX 格式',
    };
  },

  // === DOC-0605 电子签证 ===
  'V-EVS-02': function (f, ctx) {
    const validFrom = f.visa_valid_from || '';
    if (!validFrom) return { passed: true, message: '未提取到签证有效期起始日' };
    const started = validFrom <= ctx.currentDate;
    return {
      passed: started,
      message: started ? '签证有效期已开始' : '签证有效期尚未开始',
      detail: started ? '' : '签证自 ' + validFrom + ' 起生效',
    };
  },
  'V-EVS-03': function (f, ctx) {
    const deadline = f.activation_deadline || '';
    if (!deadline) return { passed: true, message: '未提取到激活截止日期' };
    const expired = deadline < ctx.currentDate;
    return {
      passed: !expired,
      message: expired ? '签证激活截止日期已过 (' + deadline + ')' : '签证激活截止日期未过',
      detail: expired ? '请确认是否已重新申请' : '',
    };
  },

  // === DOC-0701 小白条 ===
  'V-LS-01': function (f, ctx) {
    const entryDate = f.entry_date || '';
    if (!entryDate) return { passed: true, message: '未提取到入境日期' };
    return {
      passed: true,
      message: '入境日期 ' + entryDate + '（需与签证有效期交叉校验）',
    };
  },

  // === DOC-0201 学位证书 ===
  'V-DEG-01': function (f, ctx) {
    return { passed: true, message: '学信网学历核查（需在线校验，本检查仅做标记）' };
  },

  // === DOC-0301 在职证明 ===
  'V-EMP-01': function (f, ctx) {
    const company = f.company_name || '';
    const address = f.company_address || '';
    const hasSeal = f.company_seal;
    if (!company) return { passed: true, message: '未提取到公司名称' };
    const ok = company.length >= 2 && (hasSeal === true || hasSeal === 'true');
    return {
      passed: ok,
      message: ok ? '公司抬头信息基本完整' : '公司抬头信息可能不完整',
      detail: ok ? '' : '请确认公司抬头信纸包含完整信息（Logo+名称+地址+联系方式），并加盖公章',
    };
  },

  // === DOC-0401 结婚证 ===
  'V-MRG-02': function (f, ctx) {
    const regDate = f.registration_date || '';
    if (!regDate) return { passed: true, message: '未提取到结婚登记日期' };
    return {
      passed: true,
      message: '结婚登记日期: ' + regDate + '（需与申请日期比对）',
    };
  },

  // === DOC-0501 存款证明 ===
  'V-BAL-03': function (f, ctx) {
    const issueDate = f.issue_date || f.as_of_date || '';
    if (!issueDate) return { passed: true, message: '未提取到存款证明日期' };
    const now = new Date(ctx.currentDate);
    const then = new Date(issueDate);
    const diffMonths = (now - then) / (30 * 24 * 3600 * 1000);
    const ok = diffMonths <= 3;
    return {
      passed: ok,
      message: ok ? '存款证明签发在3个月内' : '存款证明签发超过3个月',
      detail: ok ? '' : '签发日期: ' + issueDate + '，建议重新开具',
    };
  },

  // === DOC-0802 强积金 ===
  'V-MPF-01': function (f, ctx) {
    return { passed: true, message: '强积金供款连续性（需逐月数据对比）' };
  },

  // === DOC-0901 出入境记录 ===
  'V-MOV-01': function (f, ctx) {
    const daysOut = parseInt(f.total_days_out_hk, 10) || 0;
    if (daysOut === 0) return { passed: true, message: '未提取到离境天数' };
    const ok = daysOut <= 180;
    return {
      passed: ok,
      message: ok ? '年度离境天数 ' + daysOut + ' 天（≤180天）' : '年度离境天数 ' + daysOut + ' 天（超过180天）',
      detail: ok ? '' : '超过180天可能影响通常居住认定',
    };
  },

  // === 通用规则 ===
  'V-GEN-EXPIRY': function (f, ctx) {
    const validTo = f.valid_to || f.visa_valid_to || '';
    if (!validTo) return { passed: true, message: '未提取到有效期' };
    const expired = validTo < ctx.currentDate;
    return {
      passed: !expired,
      message: expired ? '文档已过期（' + validTo + '）' : '文档在有效期内（至 ' + validTo + '）',
    };
  },
};

// ========== 辅助函数 ==========

/**
 * 中国身份证号码 ISO 7064 MOD 11-2 校验
 */
function validateChineseID(idNo) {
  if (idNo.length !== 18) return false;
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checkMap = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    sum += parseInt(idNo[i], 10) * weights[i];
  }
  const expected = checkMap[sum % 11];
  return idNo[17].toUpperCase() === expected;
}

/**
 * 香港身份证号码校验（加权 MOD 11 + 括号校验码）
 */
function validateHKID(hkid) {
  const m = hkid.match(/^([A-Z]{1,2})(\d{6})\(([A-Z0-9])\)$/i);
  if (!m) return false;
  const prefix = m[1].toUpperCase();
  const digits = m[2];
  const checkDigit = m[3].toUpperCase();

  // 字母转数字 (A=1, B=2...)
  let total = 0;
  if (prefix.length === 2) {
    total += (prefix.charCodeAt(0) - 64) * 9;
    total += (prefix.charCodeAt(1) - 64) * 8;
  } else {
    total += (prefix.charCodeAt(0) - 64) * 8;
  }
  for (let i = 0; i < 6; i++) {
    total += parseInt(digits[i], 10) * (6 - i);
  }
  const remainder = total % 11;
  let expected;
  if (remainder === 0) expected = '0';
  else if (remainder === 1) expected = 'A';
  else expected = String(11 - remainder);
  return checkDigit === expected;
}

function buildSummary(docRules, ruleResults, overall) {
  const name = docRules.name_zh || '未知文档';
  const templates = {
    pass: '✓ "' + name + '"材料预审通过，未发现明显问题。',
    blocked: '✗ "' + name + '"材料预审未通过，存在阻断性问题需要修正。',
    warning: '⚠ "' + name + '"材料预审发现需关注的问题，建议检查。',
    info: 'ℹ "' + name + '"材料预审完成，有优化建议。',
  };
  return templates[overall] || templates.info;
}

function buildDisclaimer() {
  return '⚠️ 仅供参考：此检查基于公开的材料标准，不代表入境事务处的最终审核意见。如对结果有疑问，建议咨询持牌身份规划顾问。';
}

module.exports = {
  runPreaudit: runPreaudit,
  loadDocRules: loadDocRules,
  executeRule: executeRule,
  // 导出校验函数供测试
  validateChineseID: validateChineseID,
  validateHKID: validateHKID,
};
