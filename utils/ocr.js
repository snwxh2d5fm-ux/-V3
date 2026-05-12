/**
 * 住港伴 — OCR 识别引擎
 * 调用微信OCR插件，提取证件关键字段
 * 支持：身份证、港澳通行证、护照、学位证、获批通知书、银行流水
 */
const { desensitizeFields, MODES } = require('./desensitize');

// 证件类型配置
const DOC_TYPES = {
  ID_CARD: {
    type: 'id_card',
    name: '身份证',
    fields: ['name', 'gender', 'ethnicity', 'birthDate', 'address', 'idNumber', 'issuingAuthority', 'validFrom', 'validTo'],
    validate: (data) => !!data.idNumber && data.idNumber.length >= 15
  },
  HK_PERMIT: {
    type: 'hk_permit',
    name: '港澳通行证',
    fields: ['name', 'idNumber', 'birthDate', 'validFrom', 'validTo', 'issuingAuthority', 'issuePlace'],
    validate: (data) => !!data.idNumber && data.idNumber.length >= 8
  },
  PASSPORT: {
    type: 'passport',
    name: '护照',
    fields: ['name', 'passportNumber', 'nationality', 'birthDate', 'birthPlace', 'validFrom', 'validTo', 'issuingAuthority'],
    validate: (data) => !!data.passportNumber
  },
  DEGREE: {
    type: 'degree',
    name: '学位证',
    fields: ['name', 'university', 'degree', 'major', 'graduationDate', 'certNumber'],
    validate: (data) => !!data.university && !!data.degree
  },
  APPROVAL_LETTER: {
    type: 'approval_letter',
    name: '获批通知书',
    fields: ['name', 'applicationNumber', 'approvalDate', 'visaType', 'validTo'],
    validate: (data) => !!data.applicationNumber || !!data.approvalDate
  },
  BANK_STATEMENT: {
    type: 'bank_statement',
    name: '银行流水',
    fields: ['accountHolder', 'bankName', 'accountNumber', 'statementFrom', 'statementTo', 'currency'],
    validate: (data) => !!data.bankName
  },
  HK_ID: {
    type: 'hk_id',
    name: '香港身份证',
    fields: ['name', 'hkIdNumber', 'birthDate', 'issueDate', 'symbol'],
    validate: (data) => !!data.hkIdNumber
  }
};

/**
 * 识别图片中的证件类型
 * @param {string} imagePath 图片本地路径
 * @returns {object} { docType, confidence }
 */
function identifyDocType(imagePath) {
  // 基于OCR初步识别结果的关键词匹配来判断证件类型
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'ocr-service',
      data: { action: 'identify', imagePath }
    }).then(res => {
      if (res.result && res.result.text) {
        const text = res.result.text;
        let docType = 'unknown';
        let confidence = 0;

        if (/身份证|居民身份/.test(text)) { docType = 'id_card'; confidence = 0.95; }
        else if (/港澳通行证|往来港澳/.test(text)) { docType = 'hk_permit'; confidence = 0.95; }
        else if (/PASSPORT|护照|Passport/.test(text)) { docType = 'passport'; confidence = 0.95; }
        else if (/学位|学士|硕士|博士|Bachelor|Master|Doctor/.test(text)) { docType = 'degree'; confidence = 0.85; }
        else if (/獲批|批准|原則上批准|Approval/.test(text)) { docType = 'approval_letter'; confidence = 0.80; }
        else if (/銀行|Bank|流水|Statement/.test(text)) { docType = 'bank_statement'; confidence = 0.80; }
        else if (/HONG KONG.*IDENTITY|香港.*身份證/.test(text)) { docType = 'hk_id'; confidence = 0.95; }

        resolve({ docType, confidence, rawText: text });
      } else {
        resolve({ docType: 'unknown', confidence: 0 });
      }
    }).catch(err => {
      // 离线模式：返回未知类型，用户手动选择
      resolve({ docType: 'unknown', confidence: 0, offline: true });
    });
  });
}

/**
 * 从图片OCR提取结构化字段
 * @param {string} imagePath 图片路径
 * @param {string} docType 已知的文档类型
 * @returns {object} { fields, rawText, confidence }
 */
async function extractFields(imagePath, docType) {
  try {
    // 调用微信OCR插件或云函数
    const ocrResult = await callOCR(imagePath);
    if (!ocrResult || !ocrResult.text) {
      return { fields: {}, rawText: '', confidence: 0 };
    }

    const rawText = ocrResult.text;
    const config = DOC_TYPES[docType] || DOC_TYPES.ID_CARD;
    const fields = {};

    // 基于正则表达式提取各字段
    config.fields.forEach(fieldName => {
      const extractor = FIELD_EXTRACTORS[fieldName];
      if (extractor) {
        const value = extractor(rawText);
        if (value) fields[fieldName] = value;
      }
    });

    return {
      fields,
      rawText,
      confidence: ocrResult.confidence || 0.8,
      docType
    };
  } catch (e) {
    console.error('[OCR] 字段提取失败:', e);
    // 返回空字段供用户手动填写
    return { fields: {}, rawText: '', confidence: 0, error: e.message };
  }
}

// 字段提取器（基于正则）
const FIELD_EXTRACTORS = {
  name: (text) => {
    const m = text.match(/姓名[：:]\s*([一-龥]{2,4})/);
    return m ? m[1] : null;
  },
  gender: (text) => {
    const m = text.match(/性別|性别[：:]\s*(男|女)/);
    return m ? m[1] : null;
  },
  idNumber: (text) => {
    const m = text.match(/\d{17}[\dXx]/);
    return m ? m[0].toUpperCase() : null;
  },
  birthDate: (text) => {
    const m = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    const m2 = text.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (m2) return `${m2[1]}-${m2[2].padStart(2, '0')}-${m2[3].padStart(2, '0')}`;
    return null;
  },
  validFrom: (text) => extractDateRange(text, '签发|Valid From|Issue Date'),
  validTo: (text) => extractDateRange(text, '有效期限|Valid To|Expiry|至'),
  address: (text) => {
    const m = text.match(/住址|地址[：:]\s*(.+?)(?:$|\n)/);
    return m ? m[1].trim() : null;
  },
  issuingAuthority: (text) => {
    const m = text.match(/签发机关|簽發機關|Issuing Authority[：:]\s*(.+?)(?:$|\n)/);
    return m ? m[1].trim() : null;
  },
  applicationNumber: (text) => {
    const m = text.match(/申請編號|Application No\.?[：:]?\s*([A-Z0-9\-]+)/);
    return m ? m[1] : null;
  },
  approvalDate: (text) => {
    const m = text.match(/批准日期|Approval Date[：:]?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{4}|\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
    return m ? m[1] : extractDateRange(text, 'Date|日期');
  },
  visaType: (text) => {
    if (/優才|Quality Migrant/.test(text)) return 'QMAS';
    if (/高才|Top Talent/.test(text)) return 'TTPS';
    if (/專才|ASMTP/.test(text)) return 'ASMTP';
    if (/IANG|非本地畢業/.test(text)) return 'IANG';
    return null;
  },
  university: (text) => {
    const m = text.match(/([一-龥]{2,}(?:大学|學院|学院|University|College|Institute)[一-龥A-Za-z\s]*)/);
    return m ? m[1].trim() : null;
  },
  degree: (text) => {
    if (/博士|Doctor|Ph\.D/.test(text)) return '博士';
    if (/硕士|Master|M\.S|M\.A/.test(text)) return '硕士';
    if (/学士|本科|Bachelor|B\.S|B\.A/.test(text)) return '学士';
    return null;
  },
  passportNumber: (text) => {
    const m = text.match(/[A-Z]\d{7,9}/);
    return m ? m[0] : null;
  },
  hkIdNumber: (text) => {
    const m = text.match(/[A-Z]\d{6}\([0-9A]\)/);
    return m ? m[0] : null;
  },
  accountHolder: (text) => {
    const m = text.match(/账户持有人|Account Holder[：:]\s*([一-龥A-Za-z\s]+)/);
    return m ? m[1].trim() : null;
  },
  bankName: (text) => {
    const m = text.match(/(?:汇丰|HSBC|中银|BOC|渣打|Standard Chartered|恒生|Hang Seng|东亚|BEA|工银|ICBC)/);
    return m ? m[0] : null;
  }
};

// 辅助：日期范围提取
function extractDateRange(text, keyword) {
  const re = new RegExp(`${keyword}[：:]?\\s*(\\d{1,2}[-/]\\d{1,2}[-/]\\d{4}|\\d{4}[-/]\\d{1,2}[-/]\\d{1,2})`);
  const m = text.match(re);
  return m ? m[1] : null;
}

// 调用 OCR 服务（通过云函数）
function callOCR(imagePath) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'ocr-service',
      data: { action: 'ocr', imagePath: imagePath }
    }).then(r => {
      if (r.result && r.result.code === 0) {
        resolve({ text: r.result.data.rawText, fields: r.result.data.fields });
      } else {
        reject(r.result || { msg: 'OCR 识别失败' });
      }
    }).catch(reject);
  });
}

/**
 * 图片质量检测
 * 检查清晰度、边缘完整度、光照条件
 */
function checkImageQuality(imagePath) {
  return new Promise((resolve) => {
    wx.getImageInfo({
      src: imagePath,
      success: (info) => {
        const issues = [];
        // 分辨率检查
        if (info.width < 800 || info.height < 600) {
          issues.push({ type: 'resolution', severity: 'warning', message: '图片分辨率偏低，可能影响识别准确率' });
        }
        // 宽高比检查（证件通常接近 3:4 或 2:3）
        const ratio = info.width / info.height;
        if (ratio < 0.5 || ratio > 2.0) {
          issues.push({ type: 'aspect_ratio', severity: 'warning', message: '图片比例可能不是标准证件照，建议重新拍摄' });
        }
        resolve({
          pass: issues.length === 0,
          issues,
          dimensions: { width: info.width, height: info.height }
        });
      },
      fail: () => resolve({ pass: false, issues: [{ type: 'load_error', severity: 'error', message: '无法读取图片信息' }] })
    });
  });
}

module.exports = {
  DOC_TYPES, identifyDocType, extractFields, checkImageQuality,
  callOCR, FIELD_EXTRACTORS
};
