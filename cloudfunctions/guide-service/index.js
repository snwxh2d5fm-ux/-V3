/**
 * guide-service v4.1 — 指引牌服务云函数 (PRD v3.1)
 * V5升级: 五级置信度标注 + P0法律修正 + 政策版本追踪
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  const { action } = event;
  try {
    switch (action) {
      case 'getGuide':              return await getGuide(event.guideId);
      case 'getByNode':             return await getByNode(event.nodeId, event.pathType);
      case 'getByProcess':          return await getByProcess(event.templateId);
      case 'listNodes':             return await listNodes();
      case 'getMaterialStandard':   return await getMaterialStandard(event.materialType);
      case 'getMaterialStandards':  return await getMaterialStandards(event);
      case 'getLayers':             return await getLayers(event.guideId, event.layer);
      case 'checkPolicyImpact':     return await checkPolicyImpact(event.policySnapshotId);
      case 'search':                return await searchGuides(event.query);
      case 'validateContent':       return await validateGuideContent(event.content);
      case 'checkPolicyVersion':    return await checkPolicyVersion(event.policyStamp);
      default:                      return { code: 400, msg: '无效操作' };
    }
  } catch (err) {
    console.error('[guide-service]', err);
    return { code: 500, msg: '指引服务异常', error: err.message };
  }
};

// V5置信度
const CONFIDENCE = {
  A: { level: 'A', label: '法源明确', color: '#059669', isAuthoritative: true },
  B: { level: 'B', label: '政策明确', color: '#2563EB', isAuthoritative: true },
  C: { level: 'C', label: '多数实践', color: '#EA580C', isAuthoritative: false },
  D: { level: 'D', label: '合理推断', color: '#DC2626', isAuthoritative: false, bannerText: '⚠️ 以下内容基于合理推断，入境处有酌情权，建议个案咨询' },
  E: { level: 'E', label: '无法确认', color: '#9CA3AF', isAuthoritative: false, bannerText: '此问题建议直接咨询入境处或持证律师', hideContent: true }
};

function enrichWithConfidence(guide) {
  const conf = CONFIDENCE[guide.confidence] || CONFIDENCE.B;
  return {
    ...guide,
    confidenceLevel: conf.level,
    confidenceLabel: conf.label,
    confidenceColor: conf.color,
    isAuthoritative: conf.isAuthoritative,
    showBanner: !!conf.bannerText,
    bannerText: conf.bannerText || '',
    hideContent: conf.hideContent || false,
    lastVerifiedAt: guide.lastVerifiedAt || null,
    policyVersion: guide.policyVersion || null
  };
}

async function getGuide(guideId) {
  const result = await db.collection('guide_items').where({ guideId }).get();
  if (result.data.length === 0) return { code: 404, msg: '指引不存在' };
  return { code: 0, data: enrichWithConfidence(result.data[0]) };
}

async function getByNode(nodeId, pathType) {
  let query = { nodeId, status: 'active' };
  const result = await db.collection('guide_items').where(query).orderBy('title', 'asc').get();
  return { code: 0, data: { nodeId, count: result.data.length, items: result.data.map(enrichWithConfidence) } };
}

async function getByProcess(templateId) {
  const template = await db.collection('process_templates').where({ templateId }).get();
  if (template.data.length === 0) return { code: 404, msg: '模板不存在' };
  const nodeIds = new Set();
  for (const stage of template.data[0].stages || []) {
    for (const step of stage.steps || []) { if (step.guideRef) nodeIds.add(step.guideRef); }
  }
  const result = await db.collection('guide_items').where({ guideId: _.in([...nodeIds]), status: 'active' }).get();
  return { code: 0, data: { templateId, count: result.data.length, items: result.data.map(enrichWithConfidence) } };
}

async function listNodes() {
  const result = await db.collection('guide_items').where({ status: "active" }).limit(200).get();
  const nodes = {};
  for (const g of result.data) {
    if (!nodes[g.nodeId]) nodes[g.nodeId] = { nodeId: g.nodeId, nodeName: g.nodeName, count: 0 };
    nodes[g.nodeId].count++;
  }
  return { code: 0, data: Object.values(nodes) };
}

async function getLayers(guideId, layer) {
  const result = await db.collection('guide_items').where({ guideId }).get();
  if (result.data.length === 0) return { code: 404, msg: '指引不存在' };
  const guide = result.data[0];
  if (layer && guide.layers && guide.layers[layer]) {
    return { code: 0, data: { guideId, layer, content: guide.layers[layer], sourceRefs: guide.sourceRefs, confidence: guide.confidence } };
  }
  return { code: 0, data: { guideId, title: guide.title, layers: guide.layers, layerVisibility: guide.layerVisibility, sourceRefs: guide.sourceRefs, confidence: guide.confidence } };
}

async function getMaterialStandard(materialType) {
  const result = await db.collection('material_standards').where({ materialType }).get();
  if (result.data.length === 0) return { code: 404, msg: '材料标准不存在' };
  return { code: 0, data: result.data[0] };
}

async function getMaterialStandards(event) {
  const { materialTypes, applicablePath } = event || {};
  const query = {};
  if (materialTypes?.length) query.materialType = _.in(materialTypes);
  if (applicablePath) query.applicablePaths = _.in([applicablePath]);
  const result = await db.collection('material_standards').where(query).get();
  return { code: 0, data: { count: result.data.length, items: result.data } };
}

async function checkPolicyImpact(policySnapshotId) {
  const snapshot = await db.collection('policy_snapshots').where({ _id: policySnapshotId }).get();
  if (snapshot.data.length === 0) return { code: 404, msg: '快照不存在' };
  const affected = snapshot.data[0].affectedGuideIds || [];
  if (affected.length > 0) {
    await db.collection('guide_items').where({ guideId: _.in(affected) }).update({ data: { status: 'needs_review', updatedAt: db.serverDate() } });
  }
  return { code: 0, data: { affectedCount: affected.length, affectedGuideIds: affected } };
}

async function searchGuides(query) {
  if (!query) return { code: 400, msg: '搜索关键词不能为空' };
  const regex = db.RegExp({ regexp: query, options: 'i' });
  const result = await db.collection('guide_items').where({ status: 'active', _or: [{ title: regex }, { 'layers.prerequisites': regex }, { 'layers.materials': regex }] }).limit(20).get();
  return { code: 0, data: result.data.map(enrichWithConfidence) };
}

// V5新增: 验证指引内容
async function validateGuideContent(content) {
  if (!content) return { code: 400, msg: '内容为空' };
  const issues = [];
  if (/s\.?2A/gi.test(content)) issues.push({ severity: 'P0', type: 'wrong_citation', fix: 'Cap.115 s.11(8) (入境处处长酌情权)', reason: 's.2A定义居留权，非"视为逗留"机制' });
  if (/s\.?42/gi.test(content) && !/s\.42被/.test(content)) issues.push({ severity: 'P0', type: 'wrong_citation', fix: 'Cap.115 s.38A (虚假陈述)', reason: '虚假陈述条文为s.38A' });
  if (/不可携带受养人/.test(content) && /学生/.test(content)) issues.push({ severity: 'P0', type: 'wrong_policy', fix: '学生签证可以带受养人(受养人不得工作)' });
  if (/每周.*20.*小时/.test(content) && /学生/.test(content)) issues.push({ severity: 'P0', type: 'outdated_policy', fix: '学生工作限制已于2023-2024年取消' });
  if (/100%[计保获成]/.test(content) || /绝对[可没保批]/.test(content)) issues.push({ severity: 'P1', type: 'absolute_language', fix: '避免过度确信表述，添加酌情权说明' });
  return { code: 0, data: { issues, issueCount: issues.length, isClean: issues.length === 0 } };
}

// V5新增: 政策版本检查
async function checkPolicyVersion(policyStamp) {
  if (!policyStamp) return { code: 200, data: { isUpToDate: false, message: '无政策版本戳' } };
  const monthsDiff = (new Date() - new Date(policyStamp)) / (30 * 86400000);
  return { code: 200, data: { isUpToDate: monthsDiff < 3, monthsSinceUpdate: Math.round(monthsDiff), message: monthsDiff >= 3 ? `⚠️ 政策版本已${Math.round(monthsDiff)}个月未更新` : '政策版本最新' } };
}
