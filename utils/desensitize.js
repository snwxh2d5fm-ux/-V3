/**
 * 住港伴 v4.1 — PII 脱敏引擎 (PRD v3.1 隐私架构增强版)
 * 在客户端本地运行，对个人身份信息进行分级脱敏
 * 遵循三级分类体系：L1绝对脱敏 / L2泛化脱敏 / L3保留标签
 *
 * V5新增: 身份证格式检测(内地/香港)、公司名→泛化标签、精确日期→日期区间、法律条文引用保护
 */
const ENGINE_VERSION = '4.1.0';

// PII 模式定义 (V5增强)
const PII_PATTERNS = {
  // L1: 绝对脱敏 — 完全替换为占位符
  chineseName: {
    pattern: /[一-龥]{2,4}(?=\s|$|，|。|；|：|,|\.|;|:)/g,
    level: 1,
    label: '姓名',
    replacement: '【姓名】',
  },
  idCardNumber: {
    pattern: /\d{17}[\dXx]|\d{15}/g,
    level: 1,
    label: '身份证号',
    replacement: '【身份证号】',
  },
  // V5新增: 香港身份证格式
  hkIdCardNumber: {
    pattern: /[A-Z]{1,2}\d{6,7}\([0-9A]\)/g,
    level: 1,
    label: '香港身份证号',
    replacement: '【香港身份证号】',
  },
  passportNumber: {
    pattern: /[A-Z]\d{7,9}|[A-Z]{2}\d{6,7}/g,
    level: 1,
    label: '护照号',
    replacement: '【护照号】',
  },
  phoneNumber: {
    pattern: /1[3-9]\d{9}/g,
    level: 1,
    label: '手机号',
    replacement: '【手机号】',
  },
  email: {
    pattern: /[\w.-]+@[\w.-]+\.\w+/g,
    level: 1,
    label: '邮箱',
    replacement: '【邮箱】',
  },

  // L2: 泛化脱敏 — 替换为泛化标签 (V5增强)
  address: {
    pattern: /(?:[一-龥]{2,}(?:省|市|区|县|街道|路|号|楼|室|幢|单元|层|座))\s*[\d一-龥\-]*(?:号|室|楼)?/g,
    level: 2,
    label: '地址',
    replacement: '【地址信息】',
  },
  // V5增强: 公司名泛化 - 具体公司名→泛化标签
  companyName: {
    pattern: /(?:[一-龥]{2,}(?:公司|集团|有限|股份|科技|实业|企业|银行|事务所|咨询|投资|资本))/g,
    level: 2,
    label: '公司名',
    replacement: '【公司名称】',
  },
  salary: {
    pattern: /(?:月薪|年薪|工资|收入|薪资|待遇)[一-龥：:]*\d+[一-龥万]*[元块]?/g,
    level: 2,
    label: '薪资',
    replacement: '【薪资信息】',
  },
  // V5新增: 精确日期→日期区间
  exactDate: {
    pattern: /\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日]?/g,
    level: 2,
    label: '日期',
    replacement: '【日期】',
  },

  // L3: 保留标签 — 仅提取特征，保留原文
  education: {
    pattern: /(?:博士|硕士|学士|本科|大专|MBA|EMBA)/g,
    level: 3,
    label: '学历',
    replacement: null,
  },
  visaType: {
    pattern: /(?:优才|高才通|专才|IANG|投资类身份规划|科技人才)/g,
    level: 3,
    label: '签证类型',
    replacement: null,
  },
  // V5新增: 行业标签保留
  industry: {
    pattern: /(?:金融|IT|科技|教育|医疗|法律|工程|制造业|零售|物流|房地产)/g,
    level: 3,
    label: '行业',
    replacement: null,
  },
};

const MODES = {
  LOCAL: 'local',
  DESENSITIZED: 'desensitized',
  FEATURE: 'feature',
};

function desensitize(text, mode = MODES.DESENSITIZED, overrides = {}) {
  if (!text || mode === MODES.LOCAL) return { text, metadata: { engineVersion: ENGINE_VERSION, mode, foundPII: [] } };

  let result = text;
  const foundPII = [];
  const replacements = [];

  Object.entries(PII_PATTERNS).forEach(([key, def]) => {
    if (overrides[key] === true) return;
    const matches = text.match(def.pattern);
    if (!matches) return;
    if (mode === MODES.FEATURE && def.level === 3) return;

    const uniqueMatches = [...new Set(matches)];
    uniqueMatches.forEach((match) => {
      const placeholder = `__PII_${key.toUpperCase()}_${foundPII.length}__`;
      result = result.replace(new RegExp(match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), placeholder);
      replacements.push({ placeholder, original: match, type: key, level: def.level, label: def.label });
      foundPII.push({ type: key, level: def.level, count: 1 });
    });
  });

  replacements.forEach((r) => {
    result = result.replace(r.placeholder, r.level <= 2 ? r.label : r.original);
  });

  return {
    text: result,
    metadata: {
      engineVersion: ENGINE_VERSION,
      mode,
      piiCount: foundPII.length,
      foundPII: aggregatePII(foundPII),
      timestamp: Date.now(),
    },
  };
}

// Bug #12: 按证件类型定义PII字段映射
const PII_FIELDS_BY_DOC_TYPE = {
  id_card: ['name', 'idNumber', 'birthDate', 'address'],
  passport: ['name', 'passportNumber', 'birthDate'],
  hk_permit: ['name', 'idNumber', 'birthDate'],
  hk_id: ['name', 'hkIdNumber', 'birthDate'],
  degree: ['name', 'certNumber'],
  marriage: ['name', 'spouseName', 'certNumber'],
  birth_cert: ['name', 'birthDate'],
  bank_statement: ['name', 'accountNumber'],
  work_proof: ['name', 'company'],
  household: ['name', 'idNumber', 'address'],
};

function desensitizeFields(fields, mode = MODES.DESENSITIZED, authorizedFields = [], docType = '') {
  const result = {};
  const fieldMap = {
    name: { key: 'chineseName', fallback: '【姓名】' },
    idNumber: { key: 'idCardNumber', fallback: '【身份证号】' },
    hkIdNumber: { key: 'hkIdCardNumber', fallback: '【香港身份证号】' },
    passportNumber: { key: 'passportNumber', fallback: '【护照号】' },
    phone: { key: 'phoneNumber', fallback: '【手机号】' },
    email: { key: 'email', fallback: '【邮箱】' },
    address: { key: 'address', fallback: '【地址信息】' },
    company: { key: 'companyName', fallback: '【公司名称】' },
    employer: { key: 'companyName', fallback: '【公司名称】' },
    birthDate: { key: 'exactDate', fallback: '【日期】' },
    certNumber: { key: 'certNumber', fallback: '【证书编号】' },
    spouseName: { key: 'spouseName', fallback: '【配偶姓名】' },
    accountNumber: { key: 'accountNumber', fallback: '【账号】' },
  };

  // Bug #12: 按证件类型确定需要脱敏的字段列表
  const piiFieldKeys = docType ? PII_FIELDS_BY_DOC_TYPE[docType] || null : null;

  Object.entries(fields).forEach(([key, value]) => {
    if (authorizedFields.includes(key)) {
      result[key] = value;
      return;
    }
    if (mode === MODES.LOCAL) {
      result[key] = value;
      return;
    }
    if (mode === MODES.FEATURE) {
      if (typeof value === 'string' && /^\d+$/.test(value.replace(/[Xx]/g, ''))) {
        result[key] = value.slice(0, 4) + '****' + value.slice(-2);
      } else {
        result[key] = value;
      }
      return;
    }
    // Bug #12: docType指定时，非PII字段原值保留
    if (piiFieldKeys && !piiFieldKeys.includes(key)) {
      result[key] = value;
      return;
    }
    const mapping = fieldMap[key];
    if (mapping) {
      result[key] = mapping.fallback;
    } else {
      result[key] = '【***】';
    }
  });

  return result;
}

function generateDesensitizedPreview(imagePath, ocrResult) {
  return {
    imagePath,
    originalFields: ocrResult,
    desensitizedFields: desensitizeFields(ocrResult, MODES.DESENSITIZED),
    featureFields: desensitizeFields(ocrResult, MODES.FEATURE),
    metadata: { engineVersion: ENGINE_VERSION, timestamp: Date.now() },
  };
}

function aggregatePII(foundPII) {
  const aggregated = {};
  foundPII.forEach((p) => {
    if (!aggregated[p.type]) {
      aggregated[p.type] = { type: p.type, level: p.level, count: 0 };
    }
    aggregated[p.type].count += p.count;
  });
  return Object.values(aggregated);
}

// 用户授权字段管理
function getAuthorizedFields() {
  return wx.getStorageSync('__pii_authorized__') || [];
}

function authorizeField(fieldKey) {
  const fields = getAuthorizedFields();
  if (!fields.includes(fieldKey)) {
    fields.push(fieldKey);
    wx.setStorageSync('__pii_authorized__', fields);
  }
}

function revokeField(fieldKey) {
  let fields = getAuthorizedFields();
  fields = fields.filter((f) => f !== fieldKey);
  wx.setStorageSync('__pii_authorized__', fields);
}

function revokeAllFields() {
  wx.setStorageSync('__pii_authorized__', []);
}

// V5新增: 法律条文编号保护 (PRD v3.1 PV-V5-01)
function protectLegalCitation(text) {
  // 确保脱敏过程中不误改法律条文编号
  const legalPatterns = [
    /Cap\.\d+\s+s\.\d+[A-Za-z]*(?:\(\d+[A-Za-z]*\))?/g,
    /Cap\.\d+/g,
    /《[^》]+》第\d+条/g,
    /基本法第\d+条/g,
  ];
  const foundCitations = [];
  legalPatterns.forEach((pattern) => {
    const matches = text.match(pattern);
    if (matches) foundCitations.push(...matches);
  });
  return { text, protectedCitations: [...new Set(foundCitations)] };
}

module.exports = {
  MODES,
  ENGINE_VERSION,
  desensitize,
  desensitizeFields,
  generateDesensitizedPreview,
  getAuthorizedFields,
  authorizeField,
  revokeField,
  revokeAllFields,
  PII_PATTERNS,
  PII_FIELDS_BY_DOC_TYPE,
  protectLegalCitation,
};
