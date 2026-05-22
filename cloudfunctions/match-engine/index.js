/**
 * match-engine — 材料匹配引擎 v3
 * 根据流程模板和用户已上传的证件，自动匹配所需材料清单
 * 基于确定性规则匹配，不使用 AI/LLM
 *
 * PRD v3 覆盖: MT-01~MT-04
 * 数据源: process_templates + material_standards 集合
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 内存缓存（避免每次调用都查库）
let _templateCache = null;
let _docTypeMapCache = null;
let _cacheExpiry = 0;
const CACHE_TTL = 300000; // 5分钟

exports.main = async (event, context) => {
  const { action, templateId, userDocs } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  try {
    switch (action) {
      case 'match':
        return await matchMaterials(templateId, userDocs);
      case 'getChecklist':
        return await getChecklist(templateId);
      case 'getDocTypeMap':
        return await getDocTypeMap();
      case 'refreshCache':
        return await refreshCache();
      default:
        return { code: 400, msg: '无效操作' };
    }
  } catch (err) {
    console.error('[match-engine]', err);
    return { code: 500, msg: '匹配引擎异常', error: err.message };
  }
};

/**
 * 加载模板材料要求（从 DB，带缓存）
 */
async function _loadTemplateMaterials() {
  const now = Date.now();
  if (_templateCache && now < _cacheExpiry) return _templateCache;

  const result = await db.collection('process_templates').where({ isActive: true }).limit(100).get();

  const map = {};
  for (const t of result.data) {
    const materials = { required: [], optional: [], conditional: [] };

    for (const stage of t.stages || []) {
      for (const step of stage.steps || []) {
        for (const mat of step.requiredMaterials || []) {
          if (mat.isOptional) {
            materials.optional.push(mat.materialType);
          } else if (mat.condition) {
            materials.conditional.push({
              type: mat.materialType,
              condition: mat.condition,
            });
          } else {
            materials.required.push(mat.materialType);
          }
        }
      }
    }

    map[t.templateId] = {
      templateId: t.templateId,
      templateName: t.templateName,
      required: [...new Set(materials.required)],
      optional: [...new Set(materials.optional)],
      conditional: materials.conditional,
    };
  }

  _templateCache = map;
  _cacheExpiry = now + CACHE_TTL;
  return map;
}

/**
 * 加载证件类型映射（从 DB，带缓存）
 */
async function _loadDocTypeMap() {
  const now = Date.now();
  if (_docTypeMapCache && now < _cacheExpiry) return _docTypeMapCache;

  const result = await db.collection('material_standards').where({ status: 'active' }).limit(200).get();

  const map = {};
  for (const m of result.data) {
    const docTypes = m.sourceDocTypes || [m.materialType];
    for (const dt of docTypes) {
      if (!map[dt]) map[dt] = [];
      map[dt].push(m.materialType);
    }
  }

  _docTypeMapCache = map;
  return map;
}

/**
 * 核心匹配逻辑
 * MT-01: 根据流程模板和用户证件，逐项匹配
 */
async function matchMaterials(templateId, userDocs) {
  const templates = await _loadTemplateMaterials();
  const template = templates[templateId];

  if (!template) {
    return { code: 400, msg: '未知模板 ID: ' + templateId };
  }

  const docTypeMap = await _loadDocTypeMap();

  // 计算用户覆盖的材料类别
  const covered = new Set();
  for (const doc of userDocs || []) {
    const categories = docTypeMap[doc.docType] || [];
    for (const cat of categories) {
      covered.add(cat);
    }
  }

  // 逐项匹配
  const matchItem = (materialType) => {
    const isCovered = covered.has(materialType);
    return {
      type: materialType,
      status: isCovered ? 'matched' : 'missing',
      matchedDocTypes: isCovered
        ? (userDocs || []).filter((d) => (docTypeMap[d.docType] || []).includes(materialType)).map((d) => d.docType)
        : [],
    };
  };

  const required = template.required.map(matchItem);
  const optional = template.optional.map(matchItem);
  const conditional = template.conditional.map((c) => ({
    type: c.type,
    condition: c.condition,
    status: covered.has(c.type) ? 'matched' : 'conditional',
    matchedDocTypes: covered.has(c.type)
      ? (userDocs || []).filter((d) => (docTypeMap[d.docType] || []).includes(c.type)).map((d) => d.docType)
      : [],
  }));

  const totalRequired = required.length;
  const matchedRequired = required.filter((r) => r.status === 'matched').length;
  const totalAll = totalRequired + optional.length + conditional.length;
  const matchedAll =
    matchedRequired +
    optional.filter((o) => o.status === 'matched').length +
    conditional.filter((c) => c.status === 'matched').length;

  return {
    code: 0,
    data: {
      templateId,
      templateName: template.templateName,
      required,
      optional,
      conditional,
      summary: {
        requiredTotal: totalRequired,
        requiredMatched: matchedRequired,
        requiredMissing: totalRequired - matchedRequired,
        overallTotal: totalAll,
        overallMatched: matchedAll,
        completionRate: totalAll > 0 ? Math.round((matchedAll / totalAll) * 100) : 0,
        isReady: matchedRequired === totalRequired,
      },
    },
  };
}

/**
 * 获取流程模板的材料清单（不含匹配结果）
 * MT-02: 展示模板所需全部材料
 */
async function getChecklist(templateId) {
  const templates = await _loadTemplateMaterials();
  const template = templates[templateId];

  if (!template) {
    return { code: 400, msg: '未知模板 ID: ' + templateId };
  }

  // 从 material_standards 获取材料标签
  const standardsResult = await db.collection('material_standards').where({ status: 'active' }).limit(200).get();
  const labelMap = {};
  for (const m of standardsResult.data) {
    labelMap[m.materialType] = m.materialName || m.materialType;
  }

  const label = (type) => labelMap[type] || type;

  return {
    code: 0,
    data: {
      templateId,
      templateName: template.templateName,
      required: template.required.map((t) => ({ type: t, label: label(t) })),
      optional: template.optional.map((t) => ({ type: t, label: label(t) })),
      conditional: template.conditional.map((c) => ({
        type: c.type,
        condition: c.condition,
        label: label(c.type),
      })),
    },
  };
}

/**
 * 获取证件类型映射表
 * MT-03: 用于前端展示「什么证件能覆盖哪些材料」
 */
async function getDocTypeMap() {
  const docTypeMap = await _loadDocTypeMap();

  // 从 material_standards 获取中文名
  const standardsResult = await db.collection('material_standards').where({ status: 'active' }).limit(200).get();

  const labelMap = {};
  for (const m of standardsResult.data) {
    labelMap[m.materialType] = m.materialName || m.materialType;
  }

  const map = {};
  for (const [docType, materialTypes] of Object.entries(docTypeMap)) {
    map[docType] = materialTypes.map((mt) => ({
      type: mt,
      label: labelMap[mt] || mt,
    }));
  }

  return { code: 0, data: map };
}

/**
 * 刷新内存缓存
 */
async function refreshCache() {
  _templateCache = null;
  _docTypeMapCache = null;
  _cacheExpiry = 0;
  await _loadTemplateMaterials();
  await _loadDocTypeMap();
  return { code: 0, msg: '缓存已刷新' };
}
