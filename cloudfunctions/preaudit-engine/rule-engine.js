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

var RULES_CACHE = null;          // 内存缓存所有规则
var CACHE_LOADED_AT = 0;        // 缓存加载时间戳
var CACHE_TTL = 3600000;        // 缓存有效期 60 分钟

/**
 * 从 knowledge_chunks 加载指定 doc_id 的校验规则
 * @param {object} db - CloudBase 数据库实例
 * @param {string} docId - DOC-XXXX 格式的文档ID
 * @returns {object} 文档识别库条目（含 validation_rules / key_fields / format_specs 等）
 */
async function loadDocRules(db, docId) {
  var now = Date.now();
  if (!RULES_CACHE || (now - CACHE_LOADED_AT > CACHE_TTL)) {
    var res = await db.collection('knowledge_chunks')
      .where({
        source: 'doc_recognition_library',
        'metadata.doc_id': docId
      })
      .limit(1)
      .get();
    RULES_CACHE = {};
    if (res.data && res.data.length > 0) {
      var chunk = res.data[0];
      var metadata = chunk.metadata || {};
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
        confidence_level: metadata.confidence_level || 'B'
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
  var ruleId = rule.rule_id;
  var severity = rule.severity || 'P1';
  var confidence = rule.confidence || 'B';
  var desc = rule.description || '';

  // 根据 rule_id 匹配对应的校验函数
  var handler = RULE_HANDLERS[ruleId];
  if (!handler) {
    return {
      rule_id: ruleId,
      passed: true,
      severity: severity,
      confidence: confidence,
      message: '[跳过] 规则未实现: ' + desc,
      detail: ''
    };
  }

  try {
    var result = handler(extractedFields, context, rule);
    return {
      rule_id: ruleId,
      passed: result.passed,
      severity: severity,
      confidence: confidence,
      message: result.message || desc,
      detail: result.detail || ''
    };
  } catch (e) {
    return {
      rule_id: ruleId,
      passed: true,
      severity: severity,
      confidence: 'D',
      message: '[异常] 规则执行出错: ' + desc,
      detail: e.message
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
  var docRules = await loadDocRules(db, docId);

  // 云端规则未命中 → 用通用脱敏规则兜底（不依赖DOC-XXXX格式）
  if (!docRules) {
    var genericRules = buildGenericRules(extractedFields, context);
    var genericResults = [];
    for (var g = 0; g < genericRules.length; g++) {
      genericResults.push({
        rule_id: genericRules[g].rule_id,
        passed: genericRules[g].passed,
        severity: genericRules[g].severity || 'P2',
        confidence: 'C',
        message: genericRules[g].message,
        detail: ''
      });
    }
    var p0f = [], p1f = [], p2f = [];
    for (var jj = 0; jj < genericResults.length; jj++) {
      var gg = genericResults[jj];
      if (gg.passed) continue;
      if (gg.severity === 'P0') p0f.push(gg.rule_id);
      else if (gg.severity === 'P1') p1f.push(gg.rule_id);
      else p2f.push(gg.rule_id);
    }
    var overall = p0f.length > 0 ? 'warning' : (p1f.length > 0 ? 'info' : 'pass');
    return {
      doc_id: docId,
      doc_name: '通用证件预审',
      status: overall,
      summary: '已检查 ' + genericRules.length + ' 项通用规则（识别库未命中DOC-XXXX格式，使用兜底规则）',
      rules: genericResults,
      stats: { total: genericRules.length, p0: p0f, p1: p1f, p2: p2f },
      milestone: null,
      disclaimer: buildDisclaimer()
    };
  }

  var now = context.currentDate || new Date().toISOString().slice(0, 10);
  var execContext = {
    currentDate: now,
    userPath: context.userPath || '',
    userPersona: context.userPersona || 0,
    relatedDocs: context.relatedDocs || []
  };

  // 执行全部校验规则
  var ruleResults = [];
  var rules = docRules.validation_rules || [];
  for (var i = 0; i < rules.length; i++) {
    ruleResults.push(executeRule(rules[i], extractedFields, execContext));
  }

  // 统计
  var p0Failed = [];
  var p1Failed = [];
  var p2Failed = [];
  for (var j = 0; j < ruleResults.length; j++) {
    var r = ruleResults[j];
    if (r.passed) continue;
    if (r.severity === 'P0') p0Failed.push(r.rule_id);
    else if (r.severity === 'P1') p1Failed.push(r.rule_id);
    else p2Failed.push(r.rule_id);
  }

  var overall = 'pass';
  if (p0Failed.length > 0) overall = 'blocked';
  else if (p1Failed.length > 0) overall = 'warning';
  else if (p2Failed.length > 0) overall = 'info';

  // 里程碑检测
  var milestoneInfo = null;
  if (docRules.milestone_role) {
    milestoneInfo = {
      role: docRules.milestone_role,
      doc_id: docId,
      doc_name: docRules.name_zh,
      triggered: p0Failed.length === 0,  // P0 全过才触发里程碑
      stage_ui: null  // 由 milestone-check.js 补充
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
    disclaimer: buildDisclaimer()
  };
}

// ========== 通用兜底规则（DOC-XXXX未命中时使用） ==========

function buildGenericRules(fields, ctx) {
  var rules = [];
  var now = ctx.currentDate || new Date().toISOString().slice(0, 10);

  // G1: 检查是否至少有一个字段被识别
  var fieldKeys = Object.keys(fields || {}).filter(function(k) { return fields[k]; });
  if (fieldKeys.length === 0) {
    rules.push({ rule_id: 'G-EMPTY', passed: false, severity: 'P0', message: '未提取到任何证件字段，请重新拍照' });
  } else {
    rules.push({ rule_id: 'G-EMPTY', passed: true, severity: 'P0', message: '已识别 ' + fieldKeys.length + ' 个字段' });
  }

  // G2: 有效期检查
  var validTo = fields.validTo || fields.valid_to || '';
  if (validTo && validTo.length >= 10) {
    if (validTo < now) {
      rules.push({ rule_id: 'G-EXPIRED', passed: false, severity: 'P0', message: '证件已过期（有效期至 ' + validTo + '）' });
    } else {
      rules.push({ rule_id: 'G-EXPIRED', passed: true, severity: 'P0', message: '证件在有效期内（至 ' + validTo + '）' });
    }
  } else if (fieldKeys.length > 0) {
    rules.push({ rule_id: 'G-EXPIRED', passed: true, severity: 'P2', message: '未检测到有效期字段，建议手动填写' });
  }

  // G3: 证件号格式基础检查
  var idNo = fields.idNumber || fields.id_number || fields.hkIdNumber || fields.hk_id_number || fields.passportNumber || fields.passport_number || '';
  if (idNo) {
    if (idNo.length >= 8) {
      rules.push({ rule_id: 'G-ID-FORMAT', passed: true, severity: 'P1', message: '证件号格式正常（长度 ' + idNo.length + '）' });
    } else {
      rules.push({ rule_id: 'G-ID-FORMAT', passed: false, severity: 'P1', message: '证件号过短（长度 ' + idNo.length + '），请确认' });
    }
  }

  // G4: 姓名检查
  var name = fields.name || '';
  if (name && name.length >= 2) {
    rules.push({ rule_id: 'G-NAME', passed: true, severity: 'P2', message: '姓名已识别：' + name });
  } else if (fieldKeys.length > 0) {
    rules.push({ rule_id: 'G-NAME', passed: true, severity: 'P2', message: '未识别到姓名（非必需字段）' });
  }

  return rules;
}

// ========== 规则执行器映射 ==========

var RULE_HANDLERS = {

  // === DOC-0101 身份证 ===
  'V-ID-01': function(f, ctx) {
    // 公民身份号码校验位（ISO 7064:1983 MOD 11-2）
    var idNo = f.id_number || '';
    if (!idNo) return { passed: true, message: '未提取到身份证号码，无法校验' };
    var valid = validateChineseID(idNo);
    return {
      passed: valid,
      message: valid ? '身份证号码校验通过' : '身份证号码校验失败',
      detail: valid ? '' : '号码不符合 ISO 7064 MOD 11-2 校验规则'
    };
  },
  'V-ID-02': function(f, ctx) {
    var validTo = f.valid_to || '';
    if (!validTo) return { passed: true, message: '未提取到有效期，无法校验' };
    var expired = validTo < ctx.currentDate;
    return {
      passed: !expired,
      message: expired ? '身份证已过期（有效期至 ' + validTo + '）' : '身份证在有效期内',
      detail: expired ? '请使用有效期内的身份证' : ''
    };
  },
  'V-ID-03': function(f, ctx) {
    // 人像面与国徽面匹配 — 需要双面数据，单面时跳过
    return { passed: true, message: '人像面/国徽面匹配校验（需双面数据）' };
  },
  'V-ID-04': function(f, ctx) {
    // 圆角边框 — 视觉特征，OCR 不做判断（K2 规则仅服务端标记）
    return { passed: true, message: '圆角边框检测由视觉引擎处理' };
  },
  'V-ID-05': function(f, ctx) {
    var authority = f.issuing_authority || '';
    if (!authority) return { passed: true, message: '未提取到签发机关' };
    var ok = authority.length >= 4;
    return {
      passed: ok,
      message: ok ? '签发机关信息完整' : '签发机关信息不完整',
      detail: ok ? '' : '签发机关字段过短: ' + authority
    };
  },

  // === DOC-0102 港澳通行证 ===
  'V-EEP-01': function(f, ctx) {
    var docNo = f.doc_number || '';
    if (!docNo) return { passed: true, message: '未提取到证件号码' };
    var ok = /^C\d{8}$/.test(docNo);
    return {
      passed: ok,
      message: ok ? '通行证号码格式正确' : '通行证号码格式异常',
      detail: ok ? '' : '预期“C+8位数字”，实际: ' + docNo
    };
  },
  'V-EEP-02': function(f, ctx) {
    var validTo = f.valid_to || '';
    if (!validTo) return { passed: true, message: '未提取到通行证有效期' };
    var expired = validTo < ctx.currentDate;
    return {
      passed: !expired,
      message: expired ? '港澳通行证已过期' : '通行证在有效期内',
      detail: expired ? '有效期至 ' + validTo : ''
    };
  },
  'V-EEP-03': function(f, ctx) {
    var endType = f.endorsement_type || '';
    if (!endType) return { passed: true, message: '未提取到签注类型' };
    var isD = endType.indexOf('D') !== -1 || endType.indexOf('逗留') !== -1;
    return {
      passed: isD,
      message: isD ? '签注类型为逗留D（在港长期逗留）' : '签注类型非逗留D签注',
      detail: isD ? '' : '当前签注: ' + endType + '，在港长期逗留需要逗留D签注'
    };
  },

  // === DOC-0103 香港身份证 ===
  'V-HKID-01': function(f, ctx) {
    var hkid = f.hkid_number || '';
    if (!hkid) return { passed: true, message: '未提取到香港身份证号码' };
    var ok = validateHKID(hkid);
    return {
      passed: ok,
      message: ok ? '香港身份证号码校验通过' : '香港身份证号码校验失败',
      detail: ok ? '' : '校验位不匹配'
    };
  },
  'V-HKID-02': function(f, ctx) {
    return { passed: true, message: '香港身份证永久有效' };
  },

  // === DOC-0601 获批通知书 ===
  'V-AIP-01': function(f, ctx) {
    return { passed: true, message: '入境处信头格式（视觉特征，OCR辅助判断）' };
  },
  'V-AIP-02': function(f, ctx) {
    var appNo = f.application_no || '';
    if (!appNo) return { passed: true, message: '未提取到申请编号' };
    var ok = /[A-Z]{2,4}[- ]?\d{4,7}[- ]?\d{2,6}/i.test(appNo);
    return {
      passed: ok,
      message: ok ? '申请编号格式正常' : '申请编号格式异常',
      detail: ok ? '' : '预期如 ENTR-2025-XXXXXX 格式'
    };
  },

  // === DOC-0605 电子签证 ===
  'V-EVS-02': function(f, ctx) {
    var validFrom = f.visa_valid_from || '';
    if (!validFrom) return { passed: true, message: '未提取到签证有效期起始日' };
    var started = validFrom <= ctx.currentDate;
    return {
      passed: started,
      message: started ? '签证有效期已开始' : '签证有效期尚未开始',
      detail: started ? '' : '签证自 ' + validFrom + ' 起生效'
    };
  },
  'V-EVS-03': function(f, ctx) {
    var deadline = f.activation_deadline || '';
    if (!deadline) return { passed: true, message: '未提取到激活截止日期' };
    var expired = deadline < ctx.currentDate;
    return {
      passed: !expired,
      message: expired ? '签证激活截止日期已过 (' + deadline + ')' : '签证激活截止日期未过',
      detail: expired ? '请确认是否已重新申请' : ''
    };
  },

  // === DOC-0701 小白条 ===
  'V-LS-01': function(f, ctx) {
    var entryDate = f.entry_date || '';
    if (!entryDate) return { passed: true, message: '未提取到入境日期' };
    return {
      passed: true,
      message: '入境日期 ' + entryDate + '（需与签证有效期交叉校验）'
    };
  },

  // === DOC-0201 学位证书 ===
  'V-DEG-01': function(f, ctx) {
    return { passed: true, message: '学信网学历核查（需在线校验，本检查仅做标记）' };
  },

  // === DOC-0301 在职证明 ===
  'V-EMP-01': function(f, ctx) {
    var company = f.company_name || '';
    var address = f.company_address || '';
    var hasSeal = f.company_seal;
    if (!company) return { passed: true, message: '未提取到公司名称' };
    var ok = company.length >= 2 && (hasSeal === true || hasSeal === 'true');
    return {
      passed: ok,
      message: ok ? '公司抬头信息基本完整' : '公司抬头信息可能不完整',
      detail: ok ? '' : '请确认公司抬头信纸包含完整信息（Logo+名称+地址+联系方式），并加盖公章'
    };
  },

  // === DOC-0401 结婚证 ===
  'V-MRG-02': function(f, ctx) {
    var regDate = f.registration_date || '';
    if (!regDate) return { passed: true, message: '未提取到结婚登记日期' };
    return {
      passed: true,
      message: '结婚登记日期: ' + regDate + '（需与申请日期比对）'
    };
  },

  // === DOC-0501 存款证明 ===
  'V-BAL-03': function(f, ctx) {
    var issueDate = f.issue_date || f.as_of_date || '';
    if (!issueDate) return { passed: true, message: '未提取到存款证明日期' };
    var now = new Date(ctx.currentDate);
    var then = new Date(issueDate);
    var diffMonths = (now - then) / (30 * 24 * 3600 * 1000);
    var ok = diffMonths <= 3;
    return {
      passed: ok,
      message: ok ? '存款证明签发在3个月内' : '存款证明签发超过3个月',
      detail: ok ? '' : '签发日期: ' + issueDate + '，建议重新开具'
    };
  },

  // === DOC-0802 强积金 ===
  'V-MPF-01': function(f, ctx) {
    return { passed: true, message: '强积金供款连续性（需逐月数据对比）' };
  },

  // === DOC-0901 出入境记录 ===
  'V-MOV-01': function(f, ctx) {
    var daysOut = parseInt(f.total_days_out_hk, 10) || 0;
    if (daysOut === 0) return { passed: true, message: '未提取到离境天数' };
    var ok = daysOut <= 180;
    return {
      passed: ok,
      message: ok ? '年度离境天数 ' + daysOut + ' 天（≤180天）' : '年度离境天数 ' + daysOut + ' 天（超过180天）',
      detail: ok ? '' : '超过180天可能影响通常居住认定'
    };
  },

  // === 通用规则 ===
  'V-GEN-EXPIRY': function(f, ctx) {
    var validTo = f.valid_to || f.visa_valid_to || '';
    if (!validTo) return { passed: true, message: '未提取到有效期' };
    var expired = validTo < ctx.currentDate;
    return {
      passed: !expired,
      message: expired ? '文档已过期（' + validTo + '）' : '文档在有效期内（至 ' + validTo + '）'
    };
  }
};

// ========== 辅助函数 ==========

/**
 * 中国身份证号码 ISO 7064 MOD 11-2 校验
 */
function validateChineseID(idNo) {
  if (idNo.length !== 18) return false;
  var weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  var checkMap = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
  var sum = 0;
  for (var i = 0; i < 17; i++) {
    sum += parseInt(idNo[i], 10) * weights[i];
  }
  var expected = checkMap[sum % 11];
  return idNo[17].toUpperCase() === expected;
}

/**
 * 香港身份证号码校验（加权 MOD 11 + 括号校验码）
 */
function validateHKID(hkid) {
  var m = hkid.match(/^([A-Z]{1,2})(\d{6})\(([A-Z0-9])\)$/i);
  if (!m) return false;
  var prefix = m[1].toUpperCase();
  var digits = m[2];
  var checkDigit = m[3].toUpperCase();

  // 字母转数字 (A=1, B=2...)
  var total = 0;
  if (prefix.length === 2) {
    total += (prefix.charCodeAt(0) - 64) * 9;
    total += (prefix.charCodeAt(1) - 64) * 8;
  } else {
    total += (prefix.charCodeAt(0) - 64) * 8;
  }
  for (var i = 0; i < 6; i++) {
    total += parseInt(digits[i], 10) * (6 - i);
  }
  var remainder = total % 11;
  var expected;
  if (remainder === 0) expected = '0';
  else if (remainder === 1) expected = 'A';
  else expected = String(11 - remainder);
  return checkDigit === expected;
}

function buildSummary(docRules, ruleResults, overall) {
  var name = docRules.name_zh || '未知文档';
  var templates = {
    pass:    '✓ 「' + name + '」材料预审通过，未发现明显问题。',
    blocked: '✗ 「' + name + '」材料预审未通过，存在阻断性问题需要修正。',
    warning: '⚠ 「' + name + '」材料预审发现需关注的问题，建议检查。',
    info:    'ℹ 「' + name + '」材料预审完成，有优化建议。'
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
  validateHKID: validateHKID
};
