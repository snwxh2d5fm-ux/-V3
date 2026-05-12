/**
 * preaudit.js — 效率宝预审前端适配层
 *
 * 封装 cloud.callFunction('preaudit-engine') 的调用，
 * 提供面向前端页面的简洁 API。
 *
 * 用法:
 *   const preaudit = require('../../utils/preaudit');
 *
 *   // 单文档预审
 *   const result = await preaudit.check(docId, extractedFields);
 *
 *   // 获取材料清单
 *   const checklist = await preaudit.getChecklist(docId);
 *
 *   // 获取阶段解锁状态
 *   const stages = await preaudit.getStageStatus();
 */

/**
 * 执行单文档预审
 * @param {string} docId - DOC-XXXX 格式
 * @param {object} extractedFields - OCR 提取的字段 { field: value }
 * @param {object} options - 可选 { userPath, userPersona }
 * @returns {object} { ok, audit }
 */
async function check(docId, extractedFields, options) {
  options = options || {};
  try {
    var res = await wx.cloud.callFunction({
      name: 'preaudit-engine',
      data: {
        action: 'preaudit',
        data: {
          doc_id: docId,
          extracted_fields: extractedFields || {},
          user_path: options.userPath || '',
          user_persona: options.userPersona || 0
        }
      }
    });
    return res.result || { ok: false, error: 'empty_result' };
  } catch (err) {
    console.error('[preaudit] 调用异常:', err);
    return {
      ok: false,
      error: 'cloud_error',
      msg: err.errMsg || '云函数调用失败',
      audit: null
    };
  }
}

/**
 * 获取文档的材料清单（K0/K1级别）
 * @param {string} docId - DOC-XXXX
 * @returns {object} { ok, doc_name, category, fields, format_note }
 */
async function getChecklist(docId) {
  try {
    var res = await wx.cloud.callFunction({
      name: 'preaudit-engine',
      data: {
        action: 'checklist',
        data: { doc_id: docId }
      }
    });
    return res.result || { ok: false, error: 'empty_result' };
  } catch (err) {
    console.error('[preaudit] getChecklist error:', err);
    return { ok: false, error: 'cloud_error', msg: err.errMsg };
  }
}

/**
 * 批量预审
 * @param {Array} docs - [{ doc_id, extracted_fields }]
 * @param {object} options - { userPath, userPersona }
 * @returns {object} { ok, total, blocked, warning, docs }
 */
async function batchCheck(docs, options) {
  options = options || {};
  try {
    var res = await wx.cloud.callFunction({
      name: 'preaudit-engine',
      data: {
        action: 'batch',
        data: {
          documents: docs,
          user_path: options.userPath || '',
          user_persona: options.userPersona || 0
        }
      }
    });
    return res.result || { ok: false, error: 'empty_result' };
  } catch (err) {
    console.error('[preaudit] batchCheck error:', err);
    return { ok: false, error: 'cloud_error', msg: err.errMsg };
  }
}

/**
 * 获取当前用户各阶段解锁状态
 * @returns {object} { ok, stage_status }
 */
async function getStageStatus() {
  try {
    var res = await wx.cloud.callFunction({
      name: 'preaudit-engine',
      data: { action: 'stage_status' }
    });
    return res.result || { ok: false, error: 'empty_result' };
  } catch (err) {
    console.error('[preaudit] getStageStatus error:', err);
    return { ok: false, error: 'cloud_error', msg: err.errMsg };
  }
}

/**
 * 格式化预审结果用于前端展示
 * @param {object} audit - 云函数返回的 audit 对象
 * @returns {object} 前端可直接使用的展示数据
 */
function formatForDisplay(audit) {
  if (!audit) return null;

  var statusMap = {
    'pass':    { icon: '✅', color: '#059669', label: '预审通过' },
    'blocked': { icon: '❌', color: '#DC2626', label: '需修正' },
    'warning': { icon: '⚠️', color: '#EA580C', label: '需关注' },
    'info':    { icon: 'ℹ️', color: '#2563EB', label: '有建议' }
  };

  var statusInfo = statusMap[audit.status] || statusMap.info;

  // 按严重度排序规则
  var rules = (audit.rules || []).slice();
  rules.sort(function(a, b) {
    var order = { 'P0': 0, 'P1': 1, 'P2': 2 };
    return (order[a.severity] || 99) - (order[b.severity] || 99);
  });

  var failedRules = rules.filter(function(r) { return !r.passed; });
  var passedRules = rules.filter(function(r) { return r.passed; });

  return {
    doc_name: audit.doc_name,
    status_icon: statusInfo.icon,
    status_color: statusInfo.color,
    status_label: statusInfo.label,
    summary: audit.summary,
    disclaimer: audit.disclaimer,
    stats: audit.stats,
    failed_rules: failedRules,
    passed_count: passedRules.length,
    milestone: audit.milestone
  };
}

module.exports = {
  check: check,
  getChecklist: getChecklist,
  batchCheck: batchCheck,
  getStageStatus: getStageStatus,
  formatForDisplay: formatForDisplay
};
