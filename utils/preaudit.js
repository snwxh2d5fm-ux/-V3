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

/**
 * OCR预处理：逐个文档上传→识别→删除临时文件
 * @param {Array} docs - 文档数组 [{ filePath, cloudFileID, ocrData, type, docId, id }]
 * @param {Function} onProgress - 进度回调 ({ current, total, percent, status })
 * @returns {Array} docs — 附带 ocrData 字段的文档数组
 */
async function ocrDocuments(docs, onProgress) {
  onProgress = onProgress || function(){};
  var total = docs.length;
  var results = [];

  for (var i = 0; i < docs.length; i++) {
    var d = docs[i];

    // 已有OCR数据 → 跳过
    if (d.ocrData) {
      results.push(d);
      onProgress({
        current: i + 1, total: total,
        percent: Math.round(((i + 1) / total) * 60),
        status: 'skipped'
      });
      continue;
    }

    try {
      // 1. 获取或上传fileID
      var fileID = d.cloudFileID;
      if (!fileID && d.filePath) {
        var uploadRes = await wx.cloud.uploadFile({
          cloudPath: '_ocr_temp/precheck_' + Date.now() + '_' + i + '.jpg',
          filePath: d.filePath
        });
        fileID = uploadRes.fileID;
      }

      if (!fileID) {
        results.push(d);
        onProgress({
          current: i + 1, total: total,
          percent: Math.round(((i + 1) / total) * 60),
          status: 'no_file'
        });
        continue;
      }

      // 2. 调ocr-service（传fileID，不传imagePath）
      var ocrRes = await wx.cloud.callFunction({
        name: 'ocr-service',
        data: { action: 'ocr', fileID: fileID }
      });

      if (ocrRes.result && ocrRes.result.code === 0 && ocrRes.result.data) {
        d.ocrData = ocrRes.result.data.fields || ocrRes.result.data;
      }

      // 3. 删除临时文件（零留存）
      wx.cloud.deleteFile({ fileList: [fileID] }).catch(function(){});

    } catch(e) {
      console.error('[preaudit] OCR失败:', e);
    }

    results.push(d);
    onProgress({
      current: i + 1, total: total,
      percent: Math.round(((i + 1) / total) * 60),
      status: 'done'
    });
  }

  return results;
}

module.exports = {
  check: check,
  getChecklist: getChecklist,
  batchCheck: batchCheck,
  getStageStatus: getStageStatus,
  formatForDisplay: formatForDisplay,
  ocrDocuments: ocrDocuments
};
