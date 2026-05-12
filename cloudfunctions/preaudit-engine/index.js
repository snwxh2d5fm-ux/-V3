/**
 * preaudit-engine — 效率宝预审引擎主入口
 *
 * 支持 action:
 *   preaudit  — 对单个文档执行预审
 *   checklist  — 获取指定文档类型的 K0/K1 材料清单（前端展示）
 *   batch      — 批量预审多个文档
 *   stage_status — 查询当前用户各阶段解锁状态
 *
 * K2 隔离：本函数所有校验逻辑在服务端执行，
 * 仅返回 K0/K1 级别的格式化结果。
 */
var cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
var db = cloud.database();

var ruleEngine = require('./rule-engine.js');
var fmt = require('./formatters.js');
var milestone = require('./milestone-check.js');

exports.main = async function(event) {
  var action = event.action || 'preaudit';
  var data = event.data || {};
  var OPENID = cloud.getWXContext().OPENID;

  try {
    switch (action) {
      case 'preaudit':
        return await handlePreaudit(data, OPENID);
      case 'checklist':
        return await handleChecklist(data);
      case 'batch':
        return await handleBatch(data, OPENID);
      case 'stage_status':
        return await handleStageStatus(OPENID);
      default:
        return { ok: false, error: 'unknown_action', msg: '未知操作: ' + action };
    }
  } catch (err) {
    console.error('[preaudit-engine]', err);
    return {
      ok: false,
      error: 'engine_error',
      msg: '预审引擎异常: ' + (err.message || '未知错误')
    };
  }
};

/**
 * 单文档预审
 * @param {object} data
 *   - doc_id: string (DOC-XXXX)
 *   - extracted_fields: object (OCR 提取的字段)
 *   - user_path: string (用户当前路径)
 *   - user_persona: number (用户画像编号)
 */
async function handlePreaudit(data, openid) {
  var docId = data.doc_id || '';
  var fields = data.extracted_fields || {};
  var userPath = data.user_path || '';
  var userPersona = data.user_persona || 0;

  if (!docId) {
    return { ok: false, error: 'missing_doc_id', msg: '缺少文档ID' };
  }

  var report = await ruleEngine.runPreaudit(db, docId, fields, {
    currentDate: new Date().toISOString().slice(0, 10),
    userPath: userPath,
    userPersona: userPersona,
    relatedDocs: []
  });

  // 格式化输出（K2 过滤 + 隐私脱敏）
  var formatted = fmt.formatAuditReport(report, 'full');

  // 里程碑检查
  var msCheck = milestone.checkMilestone(docId, report);
  if (msCheck) {
    formatted.milestone = msCheck;
  }

  // 保存预审记录
  await saveAuditLog(openid, docId, report);

  return {
    ok: true,
    audit: formatted
  };
}

/**
 * 获取文档类型的 K0/K1 材料清单
 * 供前端证件夹和指引牌展示
 */
async function handleChecklist(data) {
  var docId = data.doc_id || '';
  if (!docId) {
    return { ok: false, error: 'missing_doc_id', msg: '缺少文档ID' };
  }

  var docRules = await ruleEngine.loadDocRules(db, docId);
  if (!docRules) {
    return { ok: false, error: 'unknown_doc', msg: '未找到该文档类型的规范' };
  }

  var checklist = fmt.buildUserFriendlyChecklist(docRules);

  return {
    ok: true,
    doc_id: docId,
    doc_name: docRules.name_zh,
    category: docRules.category,
    validity_period: docRules.validity_period || '未知',
    fields: checklist,
    // 仅返回 K0/K1 级别的格式规格
    format_note: docRules.format_specs
      ? '尺寸: ' + (docRules.format_specs.type || '标准文档')
      : ''
  };
}

/**
 * 批量预审
 * @param {object} data
 *   - documents: [{ doc_id, extracted_fields }]
 */
async function handleBatch(data, openid) {
  var docs = data.documents || [];
  if (!docs.length) {
    return { ok: false, error: 'empty_batch', msg: '批量列表为空' };
  }

  var results = [];
  for (var i = 0; i < docs.length; i++) {
    var d = docs[i];
    var report = await ruleEngine.runPreaudit(db, d.doc_id, d.extracted_fields || {}, {
      currentDate: new Date().toISOString().slice(0, 10),
      userPath: data.user_path || '',
      userPersona: data.user_persona || 0,
      relatedDocs: []
    });
    var formatted = fmt.formatAuditReport(report, 'summary');
    results.push(formatted);
  }

  // 汇总
  var blockedCount = results.filter(function(r) { return r.status === 'blocked'; }).length;
  var warnCount = results.filter(function(r) { return r.status === 'warning'; }).length;

  return {
    ok: true,
    total: results.length,
    blocked: blockedCount,
    warning: warnCount,
    docs: results
  };
}

/**
 * 查询当前用户各阶段解锁状态
 */
async function handleStageStatus(openid) {
  // 查询用户已上传且预审通过的文档
  var res = await db.collection('document_audit_logs')
    .where({
      _openid: openid,
      status: 'pass'
    })
    .field({ doc_id: true, status: true })
    .get();

  var completedDocs = (res.data || []).map(function(d) {
    return { doc_id: d.doc_id, status: d.status };
  });

  var stageStatus = milestone.getStageUnlockStatus(completedDocs);

  return {
    ok: true,
    stage_status: stageStatus
  };
}

/**
 * 保存预审日志（用于里程碑追踪和审计）
 */
async function saveAuditLog(openid, docId, report) {
  try {
    await db.collection('document_audit_logs').add({
      data: {
        _openid: openid,
        doc_id: docId,
        status: report.status,
        p0_failed: (report.stats && report.stats.p0) ? report.stats.p0 : [],
        p1_failed: (report.stats && report.stats.p1) ? report.stats.p1 : [],
        milestone_role: report.milestone ? report.milestone.role : null,
        created_at: new Date()
      }
    });
  } catch (e) {
    console.error('[preaudit] 保存审计日志失败:', e.message);
    // 非关键路径，失败不影响主流程
  }
}
