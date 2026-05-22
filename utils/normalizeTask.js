/**
 * normalizeTask — 任务对象规范化管线
 *
 * 所有进入 UI 层的任务对象必须经过此函数处理。
 * 解决的问题：
 *   1. 本地 JS (camelCase) vs CloudBase/WXML (snake_case) 字段名不一致
 *   2. 本地 id vs CloudBase _id 双 ID 体系
 *   3. _urgencyClass / _completed / _materialCollected 等渲染标记散落各函数
 *   4. 深拷贝防原始数据被污染
 *
 * 使用方式：
 *   var norm = require('../../utils/normalizeTask');
 *   var task = norm(someTask);
 *   var tasks = someArray.map(norm);
 */

/**
 * 将任意来源的任务对象规范化为 WXML 兼容的格式。
 * 不修改原对象，始终返回新对象。
 *
 * @param {Object} raw  — 原始任务对象 (本地或 CloudBase)
 * @param {Object} [opts]
 * @param {Object} [opts.progressEntry] — storage.tasks[id] 中的进度条目
 * @returns {Object} 规范化后的任务对象
 */
function normalizeTask(raw, opts) {
  if (!raw || typeof raw !== 'object') return raw;

  // 深拷贝
  const t = JSON.parse(JSON.stringify(raw));
  opts = opts || {};

  // ── ID 归一化：_id 为权威标识 ──
  if (!t._id && t.id) t._id = t.id;
  if (!t.id && t._id) t.id = t._id;

  // ── 字段名 camelCase → snake_case (WXML 兼容) ──
  const FIELD_MAP = {
    timeEstimate: 'time_estimate',
    renewalEvidence: 'renewal_evidence',
    requiredItems: 'required_items',
    officialLinks: 'official_links',
    sceneTags: 'scene_tags',
    applicableTo: 'applicable_to',
    skipIfExisting: 'skip_if_existing',
    docType: 'doc_type',
    docCategory: 'doc_category',
    isRequiredForRenewal: 'is_required_for_renewal',
    expiryCheck: 'expiry_check',
    renewalTip: 'renewal_tip',
    arrivalScenario: 'arrival_scenarios',
    visaTypes: 'visa_types',
    familyStatus: 'family_status',
    childAgeTrack: 'child_age_track',
    autoSkipped: 'auto_skipped',
    skipReason: 'skip_reason',
    timeEstimate: 'time_estimate', // duplicate, safe
  };

  Object.keys(FIELD_MAP).forEach(function (camel) {
    const snake = FIELD_MAP[camel];
    if (t[camel] !== undefined && t[snake] === undefined) {
      t[snake] = t[camel];
    }
  });

  // ── 嵌套字段：renewal_evidence 子字段 ──
  const ev = t.renewal_evidence || t.renewalEvidence;
  if (ev && typeof ev === 'object') {
    t.renewal_evidence = t.renewal_evidence || {};
    if (ev.docType && !t.renewal_evidence.doc_type) t.renewal_evidence.doc_type = ev.docType;
    if (ev.docCategory && !t.renewal_evidence.doc_category) t.renewal_evidence.doc_category = ev.docCategory;
    if (ev.isRequiredForRenewal !== undefined && t.renewal_evidence.is_required_for_renewal === undefined)
      t.renewal_evidence.is_required_for_renewal = ev.isRequiredForRenewal;
    if (ev.collectMethod && !t.renewal_evidence.collect_method) t.renewal_evidence.collect_method = ev.collectMethod;
    if (ev.produces !== undefined && t.renewal_evidence.produces === undefined)
      t.renewal_evidence.produces = ev.produces;
  }

  // ── applicable_to 子字段 ──
  const at = t.applicable_to || t.applicableTo;
  if (at && typeof at === 'object') {
    t.applicable_to = t.applicable_to || {};
    if (at.visaTypes && !t.applicable_to.visa_types) t.applicable_to.visa_types = at.visaTypes;
    if (at.familyStatus && !t.applicable_to.family_status) t.applicable_to.family_status = at.familyStatus;
    if (at.arrivalScenario && !t.applicable_to.arrival_scenarios)
      t.applicable_to.arrival_scenarios = at.arrivalScenario;
    if (at.skipIfExisting && !t.applicable_to.skip_if_existing) t.applicable_to.skip_if_existing = at.skipIfExisting;
    if (at.childAgeTrack && !t.applicable_to.child_age_track) t.applicable_to.child_age_track = at.childAgeTrack;
  }

  // ── 渲染标记 ──
  t._urgencyClass = t.urgency === '必修' ? 'required' : t.urgency === '建议' ? 'suggest' : 'optional';

  // ── 进度状态 (来自 storage) ──
  const pe = opts.progressEntry;
  if (pe) {
    t._completed = pe.status === 'completed' || pe.status === 'skipped';
    t._materialCollected = !!pe.materialCollected;
    t._skipped = pe.status === 'skipped';
    t._skipReason = pe.skipReason || t.skip_reason || '';
  } else {
    t._completed = t.auto_skipped || false;
    t._materialCollected = false;
    t._skipped = t.auto_skipped || false;
    t._skipReason = t.skip_reason || '';
  }

  // ── 数组字段兜底 ──
  t.steps = t.steps || [];
  t.tips = t.tips || [];
  t.pitfalls = t.pitfalls || [];
  t.required_items = t.required_items || [];
  t.official_links = t.official_links || [];
  t.scene_tags = t.scene_tags || [];
  // 本地任务无 scene_tags 时从映射表注入
  if (t.scene_tags.length === 0 && (t._id || t.id)) {
    const SCENE_TAGS_MAP = require('../data/scene-tags');
    const tags = SCENE_TAGS_MAP[t._id] || SCENE_TAGS_MAP[t.id] || [];
    if (tags.length) t.scene_tags = tags;
  }

  return t;
}

module.exports = normalizeTask;
