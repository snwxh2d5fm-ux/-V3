/**
 * 住港伴 OCR 服务 (CloudBase 函数型云托管)
 * 使用 tesseract.js 本地识别港式证件文字
 */
const Tesseract = require('tesseract.js');

// 语言包: chi_tra=繁体中文, chi_sim=简体中文, eng=英文
const OCR_LANG = 'chi_tra+chi_sim+eng';

/**
 * 正则提取结构化字段
 */
function extractFields(docType, text) {
  const fields = [];

  if (docType === 'submission_receipt') {
    const ref = text.match(/[A-Z]{2,4}[-\s]?\d{6,10}/);
    if (ref) fields.push({ label: '申请编号', value: ref[0] });
    const date = text.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{4}[年-]\d{1,2}[月-]\d{1,2})/);
    if (date) fields.push({ label: '递交日期', value: date[0] });
    const cat = text.match(/(優才|高才通|專才|IANG|受養人|投資移民|科技人才|优才|高才|专才)/);
    if (cat) {
      const m = { '優才': '优才', '專才': '专才', '受養人': '受养人' };
      fields.push({ label: '申请类别', value: m[cat[0]] || cat[0] });
    }
    if (!fields.length) fields.push({ label: '状态', value: '回执已识别' });
  }

  else if (docType === 'hk_id_visa') {
    const id = text.match(/[A-Z]\d{6}\([A-Z0-9]\)/);
    if (id) fields.push({ label: '身份证号', value: id[0] });
    const visa = text.match(/(優才|高才通|專才|IANG|學生|受養人|工作|投資|优才|高才|专才|学生)/);
    if (visa) {
      const m = { '優才': '优才', '專才': '专才', '受養人': '受养人', '學生': '学生' };
      fields.push({ label: '签证类型', value: m[visa[0]] || visa[0] });
    }
    const exp = text.match(/有效期[至到:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/);
    if (exp) fields.push({ label: '有效期至', value: exp[1] });
    if (!fields.length) fields.push({ label: '状态', value: '证件已识别' });
  }

  else if (docType === 'hk_permanent_id') {
    const id = text.match(/[A-Z]\d{6}\([A-Z0-9]\)/);
    if (id) fields.push({ label: '身份证号', value: id[0] });
    const perm = text.match(/(永久|PERMANENT|三顆星|\*\*\*)/i);
    if (perm) fields.push({ label: '永居标识', value: '已确认' });
    if (!fields.length) fields.push({ label: '状态', value: '永居身份证已识别' });
  }

  return fields;
}

const PATH_MAP = {
  'submitted_qmas': '优才', 'submitted_ttps': '高才通',
  'submitted_asmpt': '专才', 'submitted_iang': 'IANG',
  'submitted_cies': '投资移民', 'submitted_techtas': '科技人才',
  'approved_employed': '在港就业', 'approved_business': '在港创业',
  'approved_studying': '在港学习', 'approved_mainland': '主要在内地',
};

/**
 * 主入口 — HTTP 请求处理
 * 函数型云托管自动将 HTTP 请求转为 event 对象
 */
exports.main = async function(event, context) {
  // 健康检查
  if (event.path === '/health' || event.httpMethod === 'GET') {
    return { statusCode: 200, body: JSON.stringify({ status: 'ok' }) };
  }

  // POST /ocr/verify
  if (event.httpMethod === 'POST' && event.path === '/ocr/verify') {
    try {
      const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      const { image, docType, selectedPath } = body;

      if (!image) {
        return { statusCode: 400, body: JSON.stringify({ code: 400, msg: '缺少图片' }) };
      }

      // tesseract.js OCR 识别
      const buffer = Buffer.from(image, 'base64');
      const { data } = await Tesseract.recognize(buffer, OCR_LANG, {
        logger: (m) => { if (m.status === 'recognizing text') console.log(`OCR: ${Math.round(m.progress * 100)}%`); }
      });

      const text = data.text || '';
      console.log(`OCR done, docType=${docType}, text_len=${text.length}`);

      if (!text.trim()) {
        return {
          statusCode: 200,
          body: JSON.stringify({
            code: 0,
            data: {
              summary: '未识别到文字',
              fields: [{ label: '状态', value: '无法识别，请重新拍照' }],
              matched: false, ocrAvailable: true,
              expectedType: '', extractedType: '',
              warning: '未能从图片中识别到文字，请确保拍摄清晰'
            }
          })
        };
      }

      // 提取字段
      const fields = extractFields(docType || 'submission_receipt', text);
      const typeField = fields.find(f => f.label === '申请类别' || f.label === '签证类型');
      const extractedType = typeField ? typeField.value : '';
      const expectedType = PATH_MAP[selectedPath] || '';

      // 比对
      let matched = true;
      let warning = '';
      if (extractedType && expectedType) {
        if (!extractedType.includes(expectedType) && !expectedType.includes(extractedType)) {
          matched = false;
          warning = `识别到「${extractedType}」，你选择的是「${expectedType}」`;
        }
      }

      return {
        statusCode: 200,
        body: JSON.stringify({
          code: 0,
          data: {
            summary: fields.map(f => `${f.label}:${f.value}`).join(' · '),
            fields, matched, ocrAvailable: true,
            expectedType, extractedType, warning
          }
        })
      };

    } catch (e) {
      console.error('OCR error:', e);
      return {
        statusCode: 500,
        body: JSON.stringify({ code: 500, msg: 'OCR 识别失败' })
      };
    }
  }

  return { statusCode: 404, body: 'Not Found' };
};
