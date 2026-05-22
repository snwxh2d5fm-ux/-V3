/**
 * formatters.js — 隐私安全输出格式化
 *
 * 将预审结果按知识域层级过滤后输出，确保：
 *   K0（用户可见知识）→ 完整输出
 *   K1（条件可见知识）→ 条件输出（带免责标记）
 *   K2（系统内部知识）→ 绝对不输出
 *
 * 隐私字段脱敏规则：
 *   L1（高敏）→ 部分遮蔽（如身份证号显示前4后2）
 *   L2（中敏）→ 部分遮蔽
 *   L3（低敏）→ 完整显示
 */

/**
 * 格式化预审结果（供前端展示）
 * @param {object} report - runPreaudit 返回的完整报告
 * @param {string} mode - 'full'（完整）| 'summary'（摘要，默认）
 * @returns {object} 隐私安全过滤后的报告
 */
function formatAuditReport(report, mode) {
  mode = mode || 'summary';

  const formatted = {
    doc_id: report.doc_id,
    doc_name: report.doc_name,
    status: report.status,
    summary: report.summary,
    disclaimer: report.disclaimer,
    rules: formatRules(report.rules, mode),
    stats: formatStats(report.stats),
    milestone: report.milestone ? formatMilestone(report.milestone) : null,
    generated_at: new Date().toISOString(),
  };

  return formatted;
}

/**
 * 格式化校验规则结果
 * K2 规则（含视觉特征描述、算法细节）不出现在输出中
 */
function formatRules(rules, mode) {
  const K2_KEYWORDS = [
    '视觉特征',
    '圆角边框',
    '光变油墨',
    '微缩文字',
    '全息防伪',
    '安全特征',
    'Canny',
    '边缘检测',
    'OCR模型',
    '视觉引擎',
    '水印防伪',
    '激光雕刻',
    '校验位算法',
    'MOD 11',
    'checksum',
  ];

  return rules.map(function (r) {
    // K2 过滤：如果消息中含 K2 关键词，替换为通用消息
    const msg = r.message || '';
    const detail = r.detail || '';
    let isK2 = false;
    for (let i = 0; i < K2_KEYWORDS.length; i++) {
      if (msg.indexOf(K2_KEYWORDS[i]) !== -1 || detail.indexOf(K2_KEYWORDS[i]) !== -1) {
        isK2 = true;
        break;
      }
    }

    const item = {
      rule_id: r.rule_id,
      passed: r.passed,
      severity: r.severity,
      confidence: r.confidence,
    };

    if (isK2) {
      if (r.passed) {
        item.message = '格式安全检查通过';
        item.detail = '';
      } else {
        item.message = '格式安全检查未通过';
        item.detail = '请联系持牌身份规划顾问确认';
      }
    } else {
      item.message = msg;
      if (mode === 'full') {
        item.detail = detail;
      }
    }

    return item;
  });
}

/**
 * 格式化统计数据（隐藏内部规则数量细节）
 */
function formatStats(stats) {
  const total = stats.total || 0;
  const blocked = (stats.p0 || []).length;
  const warned = (stats.p1 || []).length;
  const info = (stats.p2 || []).length;
  const passed = total - blocked - warned - info;

  return {
    total: total,
    passed: passed,
    blocked: blocked,
    warned: warned,
    info: info,
    // 前端用这个打分判断是否允许继续
    can_proceed: blocked === 0,
  };
}

/**
 * 格式化里程碑信息
 */
function formatMilestone(milestone) {
  return {
    role: milestone.role,
    doc_id: milestone.doc_id,
    doc_name: milestone.doc_name,
    triggered: milestone.triggered,
    stage_ui: milestone.stage_ui,
  };
}

/**
 * 脱敏字段值
 * @param {string} field - 字段名
 * @param {string} value - 原始值
 * @param {string} privacyLevel - L1/L2/L3
 * @returns {string} 脱敏后的值
 */
function maskField(field, value, privacyLevel) {
  if (!value) return '';
  if (privacyLevel === 'L3') return value;

  // L1 高敏：身份证号、银行账号、护照号
  if (privacyLevel === 'L1') {
    if (field === 'id_number' || field === 'hkid_number' || field === 'passport_no' || field === 'account_no') {
      if (value.length >= 6) {
        return value.slice(0, 4) + '****' + value.slice(-2);
      }
      return '****';
    }
    if (field === 'name' || field === 'applicant_name' || field === 'account_holder') {
      if (value.length >= 2) {
        return value[0] + '*' + (value.length > 2 ? value.slice(-1) : '');
      }
      return '*';
    }
  }

  // L2 中敏：公司名称、学校、地址部分遮蔽
  if (privacyLevel === 'L2') {
    if (field === 'company_name' || field === 'university' || field === 'address' || field === 'property_address') {
      if (value.length >= 6) {
        return value.slice(0, 3) + '***' + value.slice(-2);
      }
    }
  }

  return value;
}

/**
 * 生成前端展示用的材料清单提示
 * 仅包含 K0/K1 级别的标准信息
 */
function buildUserFriendlyChecklist(docRules) {
  if (!docRules) return [];

  const items = [];
  const fields = docRules.key_fields || [];
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (f.ocr_priority === 1) {
      items.push({
        field: f.field,
        label: f.label || f.field,
        tip: '请确保 ' + (f.label || f.field) + ' 清晰可见',
      });
    }
  }

  const validityStr = docRules.validity_period || '';
  if (validityStr) {
    items.push({
      field: 'validity',
      label: '有效期',
      tip: '该文档有效期: ' + validityStr,
    });
  }

  return items;
}

module.exports = {
  formatAuditReport: formatAuditReport,
  maskField: maskField,
  buildUserFriendlyChecklist: buildUserFriendlyChecklist,
};
