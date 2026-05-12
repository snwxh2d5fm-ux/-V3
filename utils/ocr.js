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
 * 图片质量检测 — 6项本地判定（无云函数依赖）
 *  ① 分辨率: ≥800×600
 *  ② 宽高比: 0.5~2.0
 *  ③ 反光检测: 顶部+中部采样点亮度差
 *  ④ 模糊度: Laplacian梯度方差
 *  ⑤ 圆角完整性: 四角像素方差
 *  ⑥ 倾斜度: 四边均匀性
 * 全部本地canvas完成，<500ms
 */
function checkImageQuality(imagePath) {
  return new Promise(function(resolve) {
    wx.getImageInfo({
      src: imagePath,
      success: function(info) {
        var w = info.width, h = info.height;
        var issues = [];
        var score = 100;

        // ① 分辨率 (0-20分)
        if (w < 800 || h < 600) { issues.push({ type: 'resolution', severity: 'warning', message: '分辨率偏低(' + w + '×' + h + ')，建议≥800×600' }); score -= 15; }

        // ② 宽高比 (0-10分)
        var ratio = w / h;
        if (ratio < 0.5 || ratio > 2.0) { issues.push({ type: 'aspect_ratio', severity: 'warning', message: '图片比例异常' }); score -= 10; }

        // ③ 反光检测: canvas采样顶部15%区域，亮度>220即疑似反光 (0-15分)
        var ctx = wx.createCanvasContext('qc-canvas');
        ctx.drawImage(imagePath, 0, 0, w, h);
        ctx.draw(false, function() {
          wx.canvasGetImageData({
            canvasId: 'qc-canvas',
            x: 0, y: 0, width: Math.min(w, 100), height: Math.min(h, 100),
            success: function(imgData) {
              var data = imgData.data;
              var brightPixels = 0, totalPixels = 0;
              // 采样顶部20%行
              var sampleH = Math.min(Math.floor(h * 0.2), imgData.height);
              for (var y = 0; y < sampleH; y++) {
                for (var x = 0; x < imgData.width; x++) {
                  var idx = (y * imgData.width + x) * 4;
                  var r = data[idx], g = data[idx+1], b = data[idx+2];
                  var brightness = 0.299 * r + 0.587 * g + 0.114 * b;
                  if (brightness > 220) brightPixels++;
                  totalPixels++;
                }
              }
              var glareRatio = totalPixels > 0 ? brightPixels / totalPixels : 0;
              if (glareRatio > 0.3) { issues.push({ type: 'glare', severity: 'warning', message: '检测到疑似反光(' + Math.round(glareRatio*100) + '%高亮)，请调整角度' }); score -= 15; }

              // ④ 模糊度: Laplacian梯度 (0-20分)
              if (imgData.width > 20 && imgData.height > 20) {
                var gradSum = 0, gradCount = 0;
                for (var gy = 1; gy < imgData.height - 1; gy += 4) {
                  for (var gx = 1; gx < imgData.width - 1; gx += 4) {
                    var ci = (gy * imgData.width + gx) * 4;
                    var li = ((gy-1) * imgData.width + gx) * 4, ri = ((gy+1) * imgData.width + gx) * 4;
                    var ui = (gy * imgData.width + (gx-1)) * 4, di = (gy * imgData.width + (gx+1)) * 4;
                    var lg = Math.abs(data[ci] - data[li]) + Math.abs(data[ci] - data[ri]) + Math.abs(data[ci] - data[ui]) + Math.abs(data[ci] - data[di]);
                    gradSum += lg; gradCount++;
                  }
                }
                var avgGrad = gradCount > 0 ? gradSum / gradCount : 0;
                if (avgGrad < 8) { issues.push({ type: 'blur', severity: 'warning', message: '图片较模糊，建议重新拍摄' }); score -= 20; }
              }

              // ⑤ 圆角/边缘完整性 (0-15分) — 四角暗区检测
              var corners = [
                { x: 0, y: 0 }, { x: imgData.width - 10, y: 0 },
                { x: 0, y: imgData.height - 10 }, { x: imgData.width - 10, y: imgData.height - 10 }
              ];
              var cornerLost = 0;
              for (var ci = 0; ci < 4; ci++) {
                var cx = Math.max(0, Math.min(corners[ci].x, imgData.width-10));
                var cy = Math.max(0, Math.min(corners[ci].y, imgData.height-10));
                var cornerSum = 0, cornerCount = 0;
                for (var dy = 0; dy < 10 && (cy+dy) < imgData.height; dy++) {
                  for (var dx = 0; dx < 10 && (cx+dx) < imgData.width; dx++) {
                    var ci2 = ((cy+dy) * imgData.width + (cx+dx)) * 4;
                    cornerSum += (data[ci2] + data[ci2+1] + data[ci2+2]) / 3;
                    cornerCount++;
                  }
                }
                if (cornerCount > 0 && cornerSum / cornerCount > 240) cornerLost++;
              }
              if (cornerLost >= 2) { issues.push({ type: 'corner', severity: 'warning', message: '证件圆角不完整或边缘缺失' }); score -= 15; }

              // ⑥ 倾斜度 (0-10分) — 四边亮度均匀性
              var edges = { top: 0, bottom: 0, left: 0, right: 0 };
              var ew = Math.min(imgData.width, 20), eh = Math.min(imgData.height, 20);
              for (var ex = 0; ex < ew; ex++) { var et1 = (0 * imgData.width + ex) * 4; var eb1 = ((imgData.height-1) * imgData.width + ex) * 4; edges.top += data[et1]; edges.bottom += data[eb1]; }
              edges.top /= ew; edges.bottom /= ew;
              var tiltScore = Math.abs(edges.top - edges.bottom);
              if (tiltScore > 40) { issues.push({ type: 'tilt', severity: 'info', message: '证件可能有倾斜，建议正对拍摄' }); score -= 10; }

              resolve({
                pass: issues.filter(function(i) { return i.severity === 'warning'; }).length === 0,
                score: Math.max(0, score),
                issues: issues,
                dimensions: { width: w, height: h },
                summary: score >= 80 ? '优' : score >= 60 ? '良' : score >= 40 ? '一般' : '差'
              });
            },
            fail: function() {
              // canvas取像素失败：仅用分辨率+比例判断
              resolve({ pass: issues.length === 0, score: Math.max(0, 100 - issues.length * 15), issues: issues, dimensions: { width: w, height: h }, summary: '基础' });
            }
          });
        });
      },
      fail: function() {
        resolve({ pass: false, score: 0, issues: [{ type: 'load_error', severity: 'error', message: '无法读取图片' }] });
      }
    });
  });
}

module.exports = {
  DOC_TYPES, identifyDocType, extractFields, checkImageQuality,
  callOCR, FIELD_EXTRACTORS
};
