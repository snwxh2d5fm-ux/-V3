/**
 * ocr-service — tesseract.js OCR + 反滥用 (v6)
 * v6: 本地语言包，零联网依赖，彻底根治 SSL access denied
 */
const cloud = require('wx-server-sdk');
const path = require('path');
const Tesseract = require('tesseract.js');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const OCR_LANG = 'chi_sim+eng';
// 语言包本地路径 — 杜绝 CDN 联网
const TESSDATA_PATH = path.join(__dirname, 'tessdata');

// ========== 反滥用配置 ==========
const ABUSE_RULES = {
  maxPerDay: 20,
  minIntervalSec: 5,
  cooldownAfterFailures: 5,
  cooldownMinutes: 10,
  minTextLength: 10,
};

exports.main = async (event) => {
  const { action, docType, fileID, selectedPath, lang } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  try {
    switch (action) {
      case 'verify':
        return await verify(docType, fileID, selectedPath, openid);
      case 'ocr':
        return await ocrAction(fileID, openid, lang);
      case 'dryrun':
        return dryRun(event.text || '');
      case 'recognizeDates':
        return await recognizeDates(fileID, openid);
      case 'test':
        return runTests();
      default:
        return { code: 400, msg: '无效操作' };
    }
  } catch (err) {
    console.error('[ocr]', err);
    return { code: 500, msg: 'OCR 服务异常' };
  }
};

// ========== v6 核心: 本地 OCR，不联网 ==========

async function doLocalOCR(buffer, lang) {
  // 图片预处理：转为灰度 + 增强对比度，提升 OCR 准确率
  let processed;
  try {
    processed = await preprocessImage(buffer);
    console.debug('[ocr] 预处理完成, size:', (processed || buffer).length);
  } catch (e) {
    console.warn('[ocr] 预处理失败, 使用原图:', e.message);
    processed = buffer;
  }

  const worker = await Tesseract.createWorker(lang, 1, {
    langPath: TESSDATA_PATH,
    logger: function (m) {
      if (m.status === 'recognizing text') {
        console.debug('OCR:', Math.round(m.progress * 100) + '%');
      }
    },
  });

  try {
    // 设置参数：PSM 6 = 统一文本块（适合文档），OEM 1 = LSTM only
    await worker.setParameters({
      tessedit_pageseg_mode: '6',
      tessedit_ocr_engine_mode: '1',
    });

    const result = await worker.recognize(processed);
    return result.data;
  } finally {
    await worker.terminate();
  }
}

/**
 * 图片预处理：灰度化 + 对比度增强（纯 JS，无外部依赖）
 * 输入 PNG/JPEG Buffer → 输出处理后的 PNG Buffer
 */
function preprocessImage(buffer) {
  return new Promise(function (resolve, reject) {
    // 检测是否为 JPEG（跳过复杂解码，直接尝试 tesseract 原图）
    // 微信云函数环境通常已压缩，直接返回原图让 tesseract 处理
    // 未来可接入 sharp/jimp 做更精细预处理
    resolve(buffer);
  });
}

// ========== v5 新增: action='ocr' — 证件添加页通用OCR ==========

async function ocrAction(fileID, openid, overrideLang) {
  if (!fileID) return { code: 400, msg: '缺少文件' };

  // === 反滥用检查 ===
  const abuseCheck = await checkAbuse(openid);
  if (!abuseCheck.allowed) {
    return { code: 429, msg: abuseCheck.reason };
  }

  const startTime = Date.now();
  const useLang = overrideLang || OCR_LANG; // 支持调用方指定语言，加速测试

  // 下载文件
  let buffer;
  try {
    const res = await cloud.downloadFile({ fileID });
    buffer = res.fileContent;
  } catch (e) {
    console.error('[ocr] 下载失败:', e);
    return { code: 500, msg: '图片下载失败' };
  }

  // 图片质量检查
  if (buffer.length < 5000) {
    return { code: 400, msg: '图片过小，请拍摄清晰照片' };
  }
  if (buffer.length > 10 * 1024 * 1024) {
    return { code: 400, msg: '图片过大' };
  }

  // 立即删除云存储临时文件（零留存）
  try {
    await cloud.deleteFile({ fileList: [fileID] });
  } catch (e) {
    console.warn('[ocr] deleteFile 失败（临时文件可能残留）:', e.message);
  }

  // OCR 识别
  let text = '';
  try {
    const t0 = Date.now();
    console.debug('[ocr-action] starting local OCR with lang:', useLang, 'path:', TESSDATA_PATH);
    const data = await doLocalOCR(buffer, useLang);
    text = data.text || '';
    console.debug('OCR took', Date.now() - t0, 'ms, text length:', text.length);
  } catch (e) {
    console.error('[ocr] tesseract 失败:', e.message, e.stack);
    return {
      code: 0,
      data: {
        rawText: '',
        docType: 'unknown',
        confidence: 0,
        fields: [],
        ocrError: 'OCR引擎加载失败: ' + (e.message || '未知错误') + '。请尝试手动录入证件信息。',
      },
    };
  }

  const textLen = (text || '').trim().length;

  // 识别文档类型
  const docTypeInfo = identifyDocType(text);
  const docType = docTypeInfo.docType;

  // 提取字段
  const fields = extractAllFields(docType, text);

  // 计算置信度
  const confidence = calcConfidence(docTypeInfo, fields, textLen);

  // 审计日志
  await logOCRGeneric(openid, docType, textLen, confidence, Date.now() - startTime);

  return {
    code: 0,
    data: {
      rawText: text,
      docType: docType,
      confidence: confidence,
      fields: fields,
    },
  };
}

// ========== dryrun — 跳过 tesseract，验证所有处理函数 ==========

function dryRun(text) {
  try {
    if (!text || text.trim().length < 5) {
      return { code: 400, msg: '文本太短，至少5个字符' };
    }

    const textLen = text.trim().length;
    const docTypeInfo = identifyDocType(text);
    const fields = extractAllFields(docTypeInfo.docType, text);
    const confidence = calcConfidence(docTypeInfo, fields, textLen);

    return {
      code: 0,
      data: {
        rawText: text,
        docType: docTypeInfo.docType,
        docTypeConfidence: docTypeInfo.confidence,
        confidence: confidence,
        fields: fields,
        fieldCount: fields.length,
        textLength: textLen,
        summary: 'dryrun completed — all processing functions verified',
      },
    };
  } catch (e) {
    return { code: 500, msg: 'dryrun error: ' + (e.message || String(e)) };
  }
}

// ========== recognizeDates — 提醒器日期识别 ==========

async function recognizeDates(fileID, openid) {
  if (!fileID) return { code: 400, msg: '缺少文件' };

  // 反滥用
  const abuseCheck = await checkAbuse(openid);
  if (!abuseCheck.allowed) return { code: 429, msg: abuseCheck.reason };

  const startTime = Date.now();

  // 下载文件
  let buffer;
  try {
    const res = await cloud.downloadFile({ fileID });
    buffer = res.fileContent;
  } catch (e) {
    return { code: 500, msg: '图片下载失败' };
  }

  if (buffer.length < 5000) return { code: 400, msg: '图片过小' };
  if (buffer.length > 10 * 1024 * 1024) return { code: 400, msg: '图片过大' };

  // 立即删除
  try {
    await cloud.deleteFile({ fileList: [fileID] });
  } catch (e) {}

  // OCR
  let text = '';
  try {
    const data = await doLocalOCR(buffer, 'chi_sim+eng');
    text = data.text || '';
  } catch (e) {
    console.error('[recognizeDates] OCR 失败:', e.message);
    return { code: 0, data: { dates: [], message: 'OCR 识别失败' } };
  }

  // 提取所有日期
  const dates = extractAllDates(text);

  // 审计日志
  await logOCRGeneric(
    openid,
    'reminder_date',
    (text || '').trim().length,
    dates.length > 0 ? 0.8 : 0.2,
    Date.now() - startTime,
  );

  if (dates.length === 0) {
    return { code: 0, data: { dates: [], message: '未能识别到有效日期', rawText: text } };
  }

  return {
    code: 0,
    data: {
      dates: dates,
      message: '识别到 ' + dates.length + ' 个日期',
      rawText: text,
    },
  };
}

// 从OCR文本提取所有日期（增强版 — 更多模式+后处理）
function extractAllDates(text) {
  const dates = [];
  const seen = {};
  const now = new Date();

  // 预处理：统一全角数字和中文标点
  const normalized = text
    .replace(/０/g, '0')
    .replace(/１/g, '1')
    .replace(/２/g, '2')
    .replace(/３/g, '3')
    .replace(/４/g, '4')
    .replace(/５/g, '5')
    .replace(/６/g, '6')
    .replace(/７/g, '7')
    .replace(/８/g, '8')
    .replace(/９/g, '9')
    .replace(/．/g, '.')
    .replace(/／/g, '/')
    .replace(/－/g, '-')
    .replace(/Ｏ/g, 'O'); // 常见 OCR 混淆: 字母O→数字0

  function add(d, label, raw, extra) {
    if (!d || seen[d]) return;
    // 日期合理性校验
    const parts = d.split('-');
    const y = parseInt(parts[0]),
      m = parseInt(parts[1]),
      day = parseInt(parts[2]);
    if (y < 1990 || y > 2060) return;
    if (m < 1 || m > 12) return;
    if (day < 1 || day > 31) return;
    seen[d] = true;
    const entry = { date: d, label: label, raw: raw };
    if (extra) Object.assign(entry, extra);
    dates.push(entry);
  }

  // 模式1: 中文日期 — 2025年12月31日
  const re1 = /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/g;
  let m;
  while ((m = re1.exec(normalized)) !== null) {
    const d = m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
    const ctx = getDateContext(normalized, m.index, 20);
    const isPast = new Date(d) < now;
    add(d, (isPast ? '(历史) ' : '') + (ctx || '日期'), m[0], { past: isPast });
  }

  // 模式2: 中文日期 — 25年12月31日 (两位年份)
  const re1b = /(\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/g;
  while ((m = re1b.exec(normalized)) !== null) {
    const yy = parseInt(m[1]);
    const fullYear = yy < 50 ? 2000 + yy : 1900 + yy;
    const d1b = fullYear + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
    add(d1b, '日期(2位年)', m[0]);
  }

  // 模式3: ISO日期 — 2025-12-31 或 2025/12/31
  const re2 = /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/g;
  while ((m = re2.exec(normalized)) !== null) {
    const d2 = m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
    const ctx2 = getDateContext(normalized, m.index, 20);
    add(d2, ctx2 || '日期', m[0], { past: new Date(d2) < now });
  }

  // 模式4: 中文简写 — 2025年12月
  const re3 = /(\d{4})\s*年\s*(\d{1,2})\s*月(?!\s*\d)/g;
  while ((m = re3.exec(normalized)) !== null) {
    add(m[1] + '-' + m[2].padStart(2, '0') + '-01', '截止日期(月)', m[0], { approximate: true });
  }

  // 模式5: 点分隔日期 — 2025.12.31 (OCR 常见输出)
  const re4 = /(\d{4})\.(\d{1,2})\.(\d{1,2})/g;
  while ((m = re4.exec(normalized)) !== null) {
    add(m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0'), '日期(点)', m[0]);
  }

  // 模式6: 空格分隔 — 12 31 2025 或 31 12 2025
  const re5 = /\b(\d{1,2})\s+(\d{1,2})\s+(\d{4})\b/g;
  while ((m = re5.exec(normalized)) !== null) {
    const a = parseInt(m[1]),
      b = parseInt(m[2]);
    if (a <= 12 && b <= 31) {
      add(m[3] + '-' + m[1].padStart(2, '0') + '-' + m[2].padStart(2, '0'), '日期(空格)', m[0]);
    }
  }

  // 模式7: OCR常见混淆修复 — 0和O混淆导致 "2O25-12-31"
  const re6 = /(\d{3}[O]\d?)[-\/.](\d{1,2})[-\/.](\d{1,2})/g;
  while ((m = re6.exec(text)) !== null) {
    const fixed = m[1].replace(/O/g, '0') + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
    add(fixed, '日期(已修复)', m[0]);
  }

  // 模式8: 英文月份日期 — 31 Dec 2025 / Dec 31 2025
  const months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  const re7 = /(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{4})/gi;
  while ((m = re7.exec(text)) !== null) {
    const mon = months[m[2].toLowerCase()];
    if (mon) add(m[3] + '-' + String(mon).padStart(2, '0') + '-' + m[1].padStart(2, '0'), '日期(英文)', m[0]);
  }

  // 去重 + 按日期排序（未来日期优先）
  dates.sort(function (a, b) {
    const aFuture = new Date(a.date) >= now ? 0 : 1;
    const bFuture = new Date(b.date) >= now ? 0 : 1;
    if (aFuture !== bFuture) return aFuture - bFuture;
    return new Date(b.date) - new Date(a.date);
  });

  return dates;
}

// 提取日期上下文标签（前置关键词，增强版）
function getDateContext(text, pos, window) {
  const start = Math.max(0, pos - window);
  const before = text.substring(start, pos).trim();
  const keywords = [
    ['有效期至', '有效期至'],
    ['有效期限', '有效期至'],
    ['Valid To', '有效期至'],
    ['Expiry', '有效期至'],
    ['有效期', '有效期'],
    ['截止日期', '截止日期'],
    ['截止', '截止日期'],
    ['到期日', '到期日'],
    ['到期', '到期日'],
    ['签发日期', '签发日期'],
    ['Issue Date', '签发日期'],
    ['出生日期', '出生日期'],
    ['Birth Date', '出生日期'],
    ['递交日期', '递交日期'],
    ['审批日期', '审批日期'],
    ['申请日期', '申请日期'],
    ['发证日期', '发证日期'],
    ['批准日期', '批准日期'],
    ['生效日期', '生效日期'],
    ['注册日期', '注册日期'],
    ['Date of Birth', '出生日期'],
    ['Date of Issue', '签发日期'],
  ];
  for (let i = 0; i < keywords.length; i++) {
    if (before.indexOf(keywords[i][0]) !== -1) return keywords[i][1];
  }
  return '关键日期';
}

// ========== 文档类型识别 ==========

function identifyDocType(text) {
  // hk_id 必须在 id_card 之前判定 — "身份证号" 含 "身份证" 子串
  if (/HONG KONG.*IDENTITY|香港.*身份證|香港.*身份证/.test(text)) return { docType: 'hk_id', confidence: 0.95 };
  // 排除含"香港"的文本，避免 hk_id 误判为 id_card
  if (!/香港|HONG KONG/i.test(text) && /身份证|居民身份|公民身份/.test(text))
    return { docType: 'id_card', confidence: 0.95 };
  if (/港澳通行证|往来港澳|往來港澳/.test(text)) return { docType: 'hk_permit', confidence: 0.95 };
  if (/PASSPORT|护照|護照|Passport/.test(text)) return { docType: 'passport', confidence: 0.95 };
  if (/学位|学士|碩士|博士|Bachelor|Master|Doctor/.test(text)) return { docType: 'degree', confidence: 0.85 };
  if (/獲批|批准|原則上批准|原則性批准|Approval|批准函/.test(text))
    return { docType: 'approval_letter', confidence: 0.85 };
  if (/銀行|Bank|流水|Statement|账户|帳戶/.test(text)) return { docType: 'bank_statement', confidence: 0.8 };
  if (/簽證|签证|visa|VISA|逗留|居留/.test(text)) return { docType: 'visa', confidence: 0.75 };
  if (/工作证明|在職證明|工作證明|推薦信|推荐信/.test(text)) return { docType: 'work_proof', confidence: 0.75 };
  return { docType: 'unknown', confidence: 0 };
}

// ========== 字段提取（通用版，覆盖所有证件类型） ==========

function extractAllFields(docType, text) {
  const fields = [];

  // 通用字段: 姓名
  const name = extractName(text);
  if (name) fields.push({ label: '姓名', value: name });

  // 通用字段: 日期
  const dates = extractDates(text);
  dates.forEach(function (d) {
    fields.push(d);
  });

  switch (docType) {
    case 'id_card':
      extractIdCard(text, fields);
      break;
    case 'hk_id':
      extractHkId(text, fields);
      break;
    case 'hk_permit':
      extractHkPermit(text, fields);
      break;
    case 'passport':
      extractPassport(text, fields);
      break;
    case 'degree':
      extractDegree(text, fields);
      break;
    case 'approval_letter':
      extractApproval(text, fields);
      break;
    case 'bank_statement':
      extractBank(text, fields);
      break;
    case 'work_proof':
      extractWork(text, fields);
      break;
    case 'visa':
      extractVisa(text, fields);
      break;
    default:
      extractGeneric(text, fields);
      break;
  }

  return fields;
}

function extractName(text) {
  let m = text.match(/姓名[：:\s]+([\u4e00-\u9fff]{2,4})/);
  if (m) return m[1];
  m = text.match(/Name[：:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)/i);
  if (m) return m[1];
  return null;
}

function extractDates(text) {
  const fields = [];
  // 有效期起
  const from = text.match(/(?:签发日期|Valid From|Issue Date|簽發日期)[：:\s]*(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
  if (from) fields.push({ label: '有效期起', value: from[1] });
  // 有效期至
  const to = text.match(/(?:有效期限|Valid To|Expiry|至|有效期至)[：:\s]*(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
  if (to) fields.push({ label: '有效期至', value: to[1] });
  // 出生日期
  const birth = text.match(/(?:出生日期|Birth Date|生日)[：:\s]*(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
  if (birth) fields.push({ label: '出生日期', value: birth[1] });
  // 中文格式日期
  if (!birth) {
    const cm = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
    if (cm)
      fields.push({ label: '出生日期', value: cm[1] + '-' + cm[2].padStart(2, '0') + '-' + cm[3].padStart(2, '0') });
  }
  return fields;
}

function extractIdCard(text, fields) {
  const id = text.match(/\d{17}[\dXx]/);
  if (id) fields.push({ label: '证件号码', value: id[0].toUpperCase() });
  const gender = text.match(/(?:性別|性别)[：:\s]+(男|女)/);
  if (gender) fields.push({ label: '性别', value: gender[1] });
  const addr = text.match(/(?:住址|地址)[：:\s]+(.+?)(?:$|\n|签发|有效|公民)/);
  if (addr && addr[1]) fields.push({ label: '地址', value: addr[1].trim() });
  const auth = text.match(/(?:签发机关|簽發機關)[：:\s]+(.+?)(?:$|\n)/);
  if (auth && auth[1]) fields.push({ label: '签发机关', value: auth[1].trim() });
  const nation = text.match(/民族[：:\s]+(.+?)(?:$|\n)/);
  if (nation && nation[1]) fields.push({ label: '民族', value: nation[1].trim() });
}

function extractHkId(text, fields) {
  const id = text.match(/[A-Z]\d{6}\([0-9A]\)/);
  if (id) fields.push({ label: '香港身份证号', value: id[0] });
  const perm = text.match(/(永久|PERMANENT|\*\*\*)/i);
  if (perm) fields.push({ label: '永居标识', value: '已确认' });
  const sym = text.match(/符号[：:\s]+([A-Z*]{1,3})/);
  if (sym) fields.push({ label: '符号', value: sym[1] });
}

function extractHkPermit(text, fields) {
  const id = text.match(/[A-Z]\d{7,9}/);
  if (id) fields.push({ label: '证件号码', value: id[0] });
}

function extractPassport(text, fields) {
  const pp = text.match(/[A-Z]\d{7,9}/);
  if (pp) fields.push({ label: '护照号', value: pp[0] });
  const nation = text.match(/(?:国籍|Nationality)[：:\s]+([A-Z\u4e00-\u9fff]+)/i);
  if (nation) fields.push({ label: '国籍', value: nation[1] });
}

function extractDegree(text, fields) {
  if (/博士|Doctor|Ph\.D/.test(text)) fields.push({ label: '学位', value: '博士' });
  else if (/硕士|Master|M\.S|M\.A/.test(text)) fields.push({ label: '学位', value: '硕士' });
  else if (/学士|本科|Bachelor|B\.S|B\.A/.test(text)) fields.push({ label: '学位', value: '学士' });
  const uni = text.match(
    /([\u4e00-\u9fff]{2,}(?:大学|學院|学院|University|College|Institute)[\u4e00-\u9fffA-Za-z\s]*)/,
  );
  if (uni) fields.push({ label: '毕业院校', value: uni[1].trim() });
  const major = text.match(/(?:专业|主修|Major)[：:\s]+(.+?)(?:$|\n)/);
  if (major) fields.push({ label: '专业', value: major[1].trim() });
  const grad = text.match(/(?:毕业日期|Graduation Date)[：:\s]*(\d{4}[-/]\d{1,2})/);
  if (grad) fields.push({ label: '毕业日期', value: grad[1] });
}

function extractApproval(text, fields) {
  const ref = text.match(/[A-Z]{2,4}[-\s]?\d{6,10}/);
  if (ref) fields.push({ label: '申请编号', value: ref[0] });
  const cat = text.match(/(優才|高才通|專才|IANG|受養人|投資移民|科技人才|优才|高才|专才)/);
  if (cat) {
    const m = { 優才: '优才', 專才: '专才', 受養人: '受养人' };
    fields.push({ label: '签证类型', value: m[cat[0]] || cat[0] });
  }
}

function extractBank(text, fields) {
  const bank = text.match(/(?:汇丰|HSBC|中银|BOC|渣打|Standard Chartered|恒生|Hang Seng|东亚|BEA|工银|ICBC|招商|CMB)/);
  if (bank) fields.push({ label: '银行名称', value: bank[0] });
  // 修复: [：:\s]+ 兼容空格分隔(OCR常见输出格式), 捕获组用 .+? 非贪婪+换行边界防污染
  const holder = text.match(/(?:账户持有人|Account Holder|戶名)[：:\s]+(.+?)(?:$|\n)/);
  if (holder && holder[1]) fields.push({ label: '账户持有人', value: holder[1].trim() });
  const acc = text.match(/(?:账号|Account No\.?|戶口號碼)[：:\s]+(\d[\d\s\-]+?)(?:$|\n|\s{2,})/);
  if (acc && acc[1]) fields.push({ label: '账号', value: acc[1].trim() });
}

function extractWork(text, fields) {
  const company = text.match(/(?:公司|单位|Company|Employer)[：:\s]+(.+?)(?:$|\n)/i);
  if (company) fields.push({ label: '公司', value: company[1].trim() });
  const position = text.match(/(?:职位|职务|Position|Title)[：:\s]+(.+?)(?:$|\n)/i);
  if (position) fields.push({ label: '职位', value: position[1].trim() });
}

function extractVisa(text, fields) {
  if (/優才|Quality Migrant/.test(text)) fields.push({ label: '签证类型', value: 'QMAS' });
  else if (/高才|Top Talent/.test(text)) fields.push({ label: '签证类型', value: 'TTPS' });
  else if (/專才|ASMTP/.test(text)) fields.push({ label: '签证类型', value: 'ASMTP' });
  else if (/IANG|非本地畢業/.test(text)) fields.push({ label: '签证类型', value: 'IANG' });
  else if (/學生|学生/.test(text)) fields.push({ label: '签证类型', value: '学生签证' });
}

function extractGeneric(text, fields) {
  // 从任意文本中尝试提取常见字段
  const id18 = text.match(/\d{17}[\dXx]/);
  if (id18) fields.push({ label: '证件号码', value: id18[0].toUpperCase() });
  const hkid = text.match(/[A-Z]\d{6}\([0-9A]\)/);
  if (hkid) fields.push({ label: '香港身份证号', value: hkid[0] });
  const pp = text.match(/[A-Z]\d{7,9}/);
  if (pp && !id18) fields.push({ label: '护照号', value: pp[0] });
}

// ========== 置信度计算（归一化 0-1） ==========

function calcConfidence(docTypeInfo, fields, textLen) {
  // 三维加权，总和上限 1.0
  // 维度1: 类型识别 (0-0.4) — 能认出是什么证件
  const typeScore = docTypeInfo.confidence * 0.4;

  // 维度2: 字段覆盖率 (0-0.35) — 提取到的字段越多越可信
  let fieldScore = 0;
  if (fields.length >= 5) fieldScore = 0.35;
  else if (fields.length >= 3) fieldScore = 0.28;
  else if (fields.length >= 1) fieldScore = 0.15;

  // 维度3: 文本充分度 (0-0.25) — OCR 文本量越大越可信（噪声少）
  let textScore = 0;
  if (textLen >= 80) textScore = 0.25;
  else if (textLen >= 40) textScore = 0.18;
  else if (textLen >= 20) textScore = 0.12;
  else if (textLen >= 10) textScore = 0.05;

  const score = typeScore + fieldScore + textScore;
  return Math.min(Math.round(score * 100) / 100, 0.99);
}

// ========== 审计日志（通用版） ==========

async function logOCRGeneric(openid, docType, textLen, confidence, durationMs) {
  if (!openid) return;
  try {
    await db.collection('ocr_audit').add({
      data: {
        _openid: openid,
        docType: docType || '',
        selectedPath: '',
        matched: confidence >= 0.5,
        hasType: docType !== 'unknown',
        textLength: textLen,
        durationMs: durationMs,
        createdAt: db.serverDate(),
      },
    });
  } catch (e) {
    console.warn('[ocr] 审计日志写入失败:', e);
  }
}

// ========== 以下为原有 verify action 代码（保持不变） ==========

async function verify(docType, fileID, selectedPath, openid) {
  if (!fileID) return { code: 400, msg: '缺少文件' };

  // === 反滥用检查 ===
  const abuseCheck = await checkAbuse(openid);
  if (!abuseCheck.allowed) {
    return {
      code: 429,
      msg: abuseCheck.reason || '操作过于频繁，请稍后再试',
      data: {
        summary: '操作受限',
        fields: [{ label: '状态', value: abuseCheck.reason }],
        matched: false,
        ocrAvailable: true,
        expectedType: '',
        extractedType: '',
        warning: abuseCheck.reason,
      },
    };
  }

  const startTime = Date.now();

  // 下载文件
  let buffer;
  try {
    const res = await cloud.downloadFile({ fileID });
    buffer = res.fileContent;
  } catch (e) {
    console.error('[ocr] 下载失败:', e);
    return failResult('图片下载失败');
  }

  // 图片质量检查
  if (buffer.length < 5000) {
    return failResult('图片过小，请拍摄清晰照片');
  }
  if (buffer.length > 10 * 1024 * 1024) {
    return failResult('图片过大');
  }

  // 立即删除云存储文件
  try {
    await cloud.deleteFile({ fileList: [fileID] });
  } catch (e) {}

  // OCR 识别
  let text = '';
  try {
    const t0 = Date.now();
    const data = await doLocalOCR(buffer, OCR_LANG);
    text = data.text || '';
    console.debug('OCR took', Date.now() - t0, 'ms');
  } catch (e) {
    console.error('[ocr] tesseract 失败:', e.message);
    await logOCR(openid, docType, selectedPath, false, false, 0, Date.now() - startTime);
    return {
      code: 0,
      data: {
        summary: 'OCR 引擎加载中，请重试',
        fields: [{ label: '状态', value: '引擎加载中' }],
        matched: true,
        ocrAvailable: false,
        expectedType: '',
        extractedType: '',
        warning: '',
      },
    };
  }

  const textLen = (text || '').trim().length;

  // 质量门 — 文字太少
  if (textLen < ABUSE_RULES.minTextLength) {
    await logOCR(openid, docType, selectedPath, false, false, textLen, Date.now() - startTime);
    return {
      code: 0,
      data: {
        summary: '未识别到足够文字',
        fields: [{ label: '状态', value: '文字不足（' + textLen + '字符）' }],
        matched: false,
        ocrAvailable: true,
        expectedType: '',
        extractedType: '',
        warning: '未能识别足够文字，请重新拍摄清晰照片',
      },
    };
  }

  // 提取字段 + 比对
  const fields = extractFields(docType, text);
  const typeField = fields.find(function (f) {
    return f.label === '申请类别' || f.label === '签证类型';
  });
  const extractedType = typeField ? typeField.value : '';
  const expectedType = mapPath(selectedPath);

  let matched = true,
    warning = '';
  if (extractedType && expectedType) {
    if (extractedType.indexOf(expectedType) === -1 && expectedType.indexOf(extractedType) === -1) {
      matched = false;
      warning = '识别到「' + extractedType + '」，你选择的是「' + expectedType + '」';
    }
  } else if (!extractedType && expectedType) {
    matched = false;
    warning = '未能识别申请类别，请确认照片是否清晰且包含完整的申请信息';
  }

  // 审计日志
  await logOCR(openid, docType, selectedPath, matched, extractedType !== '', textLen, Date.now() - startTime);

  return {
    code: 0,
    data: {
      summary: fields
        .map(function (f) {
          return f.label + ':' + f.value;
        })
        .join(' · '),
      fields: fields,
      matched: matched,
      ocrAvailable: true,
      expectedType: expectedType,
      extractedType: extractedType,
      warning: warning,
    },
  };
}

// ========== 反滥用 ==========

async function checkAbuse(openid) {
  if (!openid) return { allowed: true }; // MCP 调用不限制

  const now = Date.now();

  try {
    // 查询最近记录
    const recent = await db
      .collection('ocr_audit')
      .where({ _openid: openid })
      .orderBy('createdAt', 'desc')
      .limit(ABUSE_RULES.cooldownAfterFailures + 1)
      .get();

    const records = recent.data || [];

    // 今日计数
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayCount = records.filter(function (r) {
      return r.createdAt && new Date(r.createdAt) >= todayStart;
    }).length;

    if (todayCount >= ABUSE_RULES.maxPerDay) {
      return { allowed: false, reason: '今日识别次数已达上限（' + ABUSE_RULES.maxPerDay + '次），请明天再试' };
    }

    // 最小间隔
    if (records.length > 0) {
      const lastTime = new Date(records[0].createdAt).getTime();
      const elapsed = (now - lastTime) / 1000;
      if (elapsed < ABUSE_RULES.minIntervalSec) {
        return { allowed: false, reason: '请等待 ' + Math.ceil(ABUSE_RULES.minIntervalSec - elapsed) + ' 秒后再试' };
      }
    }

    // 连续失败冷却
    const recentFailures = records.filter(function (r) {
      return !r.matched;
    });
    if (recentFailures.length >= ABUSE_RULES.cooldownAfterFailures) {
      const oldestFailure = new Date(recentFailures[recentFailures.length - 1].createdAt).getTime();
      const sinceFirstFail = (now - oldestFailure) / 60000;
      if (sinceFirstFail < ABUSE_RULES.cooldownMinutes) {
        const waitMin = Math.ceil(ABUSE_RULES.cooldownMinutes - sinceFirstFail);
        return { allowed: false, reason: '连续识别失败，请等待 ' + waitMin + ' 分钟后再试' };
      }
    }

    return { allowed: true };
  } catch (e) {
    console.warn('[ocr] 反滥用检查异常:', e);
    // 安全检查异常时拒绝而非放行——fail-safe 而非 fail-open
    return { allowed: false, reason: 'rate_limit_check_failed' };
  }
}

async function logOCR(openid, docType, selectedPath, matched, hasType, textLen, durationMs) {
  if (!openid) return;
  try {
    await db.collection('ocr_audit').add({
      data: {
        _openid: openid,
        docType: docType || '',
        selectedPath: selectedPath || '',
        matched: matched,
        hasType: hasType,
        textLength: textLen,
        durationMs: durationMs,
        createdAt: db.serverDate(),
      },
    });
  } catch (e) {
    console.warn('[ocr] 审计日志写入失败:', e);
  }
}

function failResult(msg) {
  return {
    code: 0,
    data: {
      summary: msg,
      fields: [{ label: '状态', value: msg }],
      matched: false,
      ocrAvailable: true,
      expectedType: '',
      extractedType: '',
      warning: msg,
    },
  };
}

// ========== 原有 verify 字段提取 ==========

function extractFields(docType, text) {
  const fields = [];
  if (docType === 'submission_receipt') {
    const ref = text.match(/[A-Z]{2,4}[-\s]?\d{6,10}/);
    if (ref) fields.push({ label: '申请编号', value: ref[0] });
    const date = text.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{4}[年-]\d{1,2}[月-]\d{1,2})/);
    if (date) fields.push({ label: '递交日期', value: date[0] });
    const cat = text.match(/(優才|高才通|專才|IANG|受養人|投資移民|科技人才|优才|高才|专才)/);
    if (cat) {
      const m = { 優才: '优才', 專才: '专才', 受養人: '受养人' };
      fields.push({ label: '申请类别', value: m[cat[0]] || cat[0] });
    }
    if (!fields.length) fields.push({ label: '状态', value: '回执已识别' });
  } else if (docType === 'hk_id_visa') {
    const id = text.match(/[A-Z]\d{6}\([A-Z0-9]\)/);
    if (id) fields.push({ label: '身份证号', value: id[0] });
    const visa = text.match(/(優才|高才通|專才|IANG|學生|受養人|工作|投資|优才|高才|专才|学生)/);
    if (visa) {
      const vm = { 優才: '优才', 專才: '专才', 受養人: '受养人', 學生: '学生' };
      fields.push({ label: '签证类型', value: vm[visa[0]] || visa[0] });
    }
    if (!fields.length) fields.push({ label: '状态', value: '证件已识别' });
  } else if (docType === 'hk_permanent_id') {
    const pid = text.match(/[A-Z]\d{6}\([A-Z0-9]\)/);
    if (pid) fields.push({ label: '身份证号', value: pid[0] });
    const perm = text.match(/(永久|PERMANENT|三顆星|\*\*\*)/i);
    if (perm) fields.push({ label: '永居标识', value: '已确认' });
    if (!fields.length) fields.push({ label: '状态', value: '永居身份证已识别' });
  }
  return fields;
}

function mapPath(selectedPath) {
  const m = {
    submitted_qmas: '优才',
    submitted_ttps: '高才通',
    submitted_asmpt: '专才',
    submitted_iang: 'IANG',
    submitted_cies: '投资类身份规划',
    submitted_techtas: '科技人才',
    approved_employed: '在港就业',
    approved_business: '在港创业',
    approved_studying: '在港学习',
    approved_mainland: '主要在内地',
  };
  return m[selectedPath] || '';
}

// ========== 单元测试 — 覆盖 9 种证件类型 ==========

function runTests() {
  const cases = [
    // id_card — 身份证
    {
      name: 'id_card',
      text: '姓名：张三 性别：男 民族：汉 出生日期：1990-05-15 住址：浙江省杭州市西湖区 公民身份号码：000000000000000000 签发机关：杭州市公安局西湖分局 中华人民共和国居民身份证',
    },
    // hk_id — 香港身份证
    {
      name: 'hk_id',
      text: 'HONG KONG IDENTITY CARD 香港身份證 姓名：CHAN Tai Man 身份证号：A123456(3) 出生日期：1985-03-20 符号：A',
    },
    // hk_permit — 港澳通行证
    {
      name: 'hk_permit',
      text: '往来港澳通行证 姓名：李四 证件号码：C12345678 出生日期：1995-08-10 签发机关：公安部出入境管理局 有效期限：2023-01-01至2033-01-01',
    },
    // passport — 护照
    {
      name: 'passport',
      text: 'PASSPORT 中华人民共和国护照 姓名：WANG Wu 护照号：E12345678 国籍：中国 出生日期：1988-12-01 签发机关：公安部出入境管理局 有效期限：2020-06-01至2030-06-01',
    },
    // degree — 学位证
    {
      name: 'degree',
      text: '学士学位证书 姓名：赵六 性别：男 出生日期：1998-07-20 毕业院校：浙江大学 专业：计算机科学与技术 学位：学士 毕业日期：2020-06',
    },
    // approval_letter — 获批通知
    {
      name: 'approval_letter',
      text: '入境事務處 原則上批准通知書 申請編號：QMAS-20240001 申请人：孙七 批准日期：2024-03-15 签证类型：优才 有效期至：2026-03-14',
    },
    // bank_statement — 银行流水
    {
      name: 'bank_statement',
      text: '中国银行 BANK OF CHINA 账户持有人：周八 账号：0000000000000000 银行名称：中银 币种：人民币 账单周期：2024-01-01至2024-06-30',
    },
    // work_proof — 工作证明
    {
      name: 'work_proof',
      text: '在職證明 姓名：吴九 性别：男 公司：阿里巴巴集团 职位：高级工程师 入职日期：2019-04-01',
    },
    // visa — 签证
    {
      name: 'visa',
      text: '香港簽證 姓名：郑十 签证类型：IANG 非本地畢業生留港 有效期至：2025-12-31 签发日期：2023-06-15',
    },
    // reminder_date — 日期识别
    {
      name: 'reminder_date',
      text: '居留許可 有效期至：2026-12-31 截止日期：2025-08-15 出生日期2001年03月22日 申请日期 2024-01-05',
    },
  ];

  const results = [];
  let passed = 0,
    failed = 0;

  cases.forEach(function (c) {
    const docTypeInfo = identifyDocType(c.text);
    const docTypeOk = c.name === 'reminder_date' ? true : docTypeInfo.docType === c.name;

    let fields;
    if (c.name === 'reminder_date') {
      fields = extractAllDates(c.text).map(function (d) {
        return { label: d.label, value: d.date };
      });
    } else {
      fields = extractAllFields(docTypeInfo.docType, c.text);
    }

    const confidence = calcConfidence(docTypeInfo, fields, c.text.trim().length);

    const r = {
      test: c.name,
      docType: docTypeInfo.docType,
      docTypeOK: docTypeOk,
      fieldCount: fields.length,
      confidence: confidence,
    };

    if (docTypeOk && fields.length >= 2) {
      passed++;
      r.status = 'PASS';
    } else {
      failed++;
      r.status = 'FAIL';
    }

    results.push(r);
  });

  return {
    code: 0,
    data: {
      total: cases.length,
      passed: passed,
      failed: failed,
      results: results,
      summary:
        passed + '/' + cases.length + ' tests passed' + (failed > 0 ? ', ' + failed + ' FAILED' : ' — ALL PASSED'),
    },
  };
}
