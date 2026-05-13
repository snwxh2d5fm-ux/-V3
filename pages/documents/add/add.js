/**
 * 住港伴 v3 — 添加证件页
 * 流程: 选择输入方式 → 拍照/选图 → OCR识别 → 确认字段 → 选择分类 → 保存本地FS
 * 存储: utils/storage.saveDocumentMeta → __vault_meta__
 */
const { saveFile, saveDocumentMeta, getAllDocuments } = require('../../../utils/storage');
const { extractFields, identifyDocType, checkImageQuality } = require('../../../utils/ocr');
const { desensitizeFields, MODES } = require('../../../utils/desensitize');
const constants = require('../../../data/constants');
const app = getApp();

Page({
  data: {
    step: 1,                     // 1=选输入方式, 2=拍照/选图预览, 3=OCR结果确认, 4=手动填写
    inputMode: '',               // 'camera' | 'album' | 'manual'
    imagePath: '',               // 临时图片路径
    imageBase64: '',             // base64预览
    imageRotated: 0,             // 旋转角度 0/90/180/270

    // OCR结果
    docType: 'unknown',          // 识别到的证件类型
    docTypeLabel: '',            // 证件类型中文名
    docCategory: '',             // 用户选择的分类
    ocrFields: {},               // OCR提取的字段
    rawOCRText: '',              // OCR原始文本
    confidence: 0,               // 识别置信度 0-1
    confidencePercent: '0',      // 百分比显示
    ocrFieldList: [],            // OCR字段列表 [{key, value}]
    ocrProcessing: false,        // OCR处理中

    // 对齐裁切
    cropX: 0, cropY: 0, cropScale: 1,

    // 质量检测
    qualityIssues: [],           // 图片质量问题(旧)
    qualityResult: null,         // 质量检测结果(新·6项)

    // 扫描件效果
    scanMode: false,             // 是否启用扫描件增强
    scanProcessing: false,       // 扫描件处理中

    // 分类选项 — 对齐PRD七大类
    categories: [
      { value: 'identity',  label: '身份',   icon: '🆔', desc: '身份证/护照/回乡证等' },
      { value: 'education', label: '学历',   icon: '🎓', desc: '学位证/毕业证/成绩单' },
      { value: 'work',      label: '工作',   icon: '💼', desc: '工作证明/推荐信/名片' },
      { value: 'assets',    label: '资产',   icon: '💰', desc: '银行流水/税单/存款证明' },
      { value: 'approved',  label: '获批',   icon: '✅', desc: '获批通知/签证标签纸' },
      { value: 'renewal',   label: '续签',   icon: '🔄', desc: '续签材料/MPF记录' },
      { value: 'permanent', label: '永居',   icon: '🏁', desc: '永居申请相关材料' }
    ],

    // 手动填写表单
    manualForm: {
      name: '',
      docNumber: '',
      validFrom: '',
      validTo: '',
      issuingAuthority: '',
      notes: ''
    },

    // 证件所属人
    ownerType: 'self',           // 'self' | 'spouse' | 'child'
    ownerName: '',               // 子女姓名（仅ownerType='child'时使用）
    ownerOptions: [
      { value: 'self',   label: '本人', icon: '👤' },
      { value: 'spouse', label: '配偶', icon: '💑' },
      { value: 'child',  label: '子女', icon: '👶' }
    ],

    // 卡槽上下文
    slotContext: false,
    slotDocName: '',
    slotGuide: null,
    skipCategory: false,

    // 自由模式证件类型选择 (Bug #2: 非卡槽入口显示线框图)
    freeDocType: '',
    freeDocTypeOptions: [
      { value: 'id_card', label: '身份证', icon: '🪪' },
      { value: 'hk_permit', label: '港澳通行证', icon: '🛂' },
      { value: 'passport', label: '护照', icon: '🛂' },
      { value: 'hk_id', label: '香港身份证', icon: '🆔' },
      { value: 'household', label: '户口本', icon: '📖' },
      { value: 'marriage', label: '结婚证', icon: '💍' },
      { value: 'birth_cert', label: '出生证', icon: '👶' },
      { value: 'degree', label: '学位证', icon: '🎓' },
      { value: 'work_proof', label: '工作证明', icon: '💼' },
      { value: 'bank_statement', label: '银行流水', icon: '💰' },
      { value: 'approval', label: '获批通知', icon: '✅' }
    ],
    freeDocGuide: null,           // 自由模式下选中证件类型的拍摄指引

    // 保存状态
    saving: false,
    privacyMode: 'local'
  },

  onLoad(options) {
    // 预填所属人（从卡槽传入）
    if (options.ownerType) {
      this.setData({ ownerType: options.ownerType });
    }
    // 捕获卡槽上下文，用于保存时写回 slotKey 以匹配卡槽
    if (options.slotKey) {
      this._slotKey = options.slotKey;
      this._slotDocName = options.docName ? decodeURIComponent(options.docName) : '';
      this._slotGuideId = options.guideId || '';
      // 卡槽→分类自动映射，跳过分类选择步骤
      var autoCat = slotToCategory(this._slotKey);
      this.setData({
        slotContext: true,
        slotDocName: this._slotDocName,
        slotGuide: getSlotGuide(this._slotKey, this._slotDocName),
        docCategory: autoCat || '',
        skipCategory: !!autoCat
      });
    } else {
      this.setData({ slotContext: false, slotGuide: null, slotDocName: '', skipCategory: false });
    }
    this.setData({ privacyMode: app.getPrivacyMode() });
  },

  // ========== Step 1: 选择输入方式 ==========

  /** 拍照 — Bug#4: 先展示拍摄引导，再调相机 */
  onTapCamera() {
    var that = this;
    var guide = this.getActiveGuide();
    var guideText = guide && guide.wfTitle ? guide.wfTitle + ' — ' + (guide.specimen || '请确保四角完整') : '请确保证件四角完整、无反光';
    wx.showModal({
      title: '拍摄指引',
      content: guideText + '\n\n系统将打开相机，请对准证件正面拍摄。拍摄后可进行质量检测和手动对齐。',
      confirmText: '开始拍摄',
      cancelText: '返回',
      success: function(res) {
        if (res.confirm) {
          that.doTakeCamera();
        }
      }
    });
  },
  doTakeCamera() {
    this.setData({ inputMode: 'camera' });
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      camera: 'back',
      success: (res) => this.processImage(res.tempFiles[0].tempFilePath),
      fail: (err) => {
        if (err.errMsg.includes('cancel')) return;
        wx.showToast({ title: '拍照失败，请重试', icon: 'none' });
      }
    });
  },

  /** 从相册选择 */
  onTapAlbum() {
    this.setData({ inputMode: 'album' });
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album'],
      success: (res) => this.processImage(res.tempFiles[0].tempFilePath),
      fail: (err) => {
        if (err.errMsg.includes('cancel')) return;
        wx.showToast({ title: '选择图片失败', icon: 'none' });
      }
    });
  },

  /** 手动录入 */
  onTapManual() {
    this.setData({ inputMode: 'manual', step: 4 });
  },

  // ========== Step 2: 图片处理（仅质量检测，不OCR） ==========

  async processImage(imagePath) {
    this.setData({ imagePath, step: 2, qualityIssues: [] });

    // 转为base64用于预览（立即显示，不等待增强）
    this.readImageBase64(imagePath);

    // 本地质量检测（6项，<500ms）— 优先完成
    try {
      var result = await checkImageQuality(imagePath);
      this.setData({ qualityResult: result });
    } catch (e) {
      this.setData({ qualityResult: { pass: true, score: 100, issues: [], summary: '合格' } });
    }

    // AI增强: 后台异步处理，不阻塞用户交交互
    var that = this;
    var enhancedPath = imagePath;
    try {
      var imgProc = require('../../../utils/image-process');
      enhancedPath = await this.withTimeout(imgProc.autoRotate(imagePath), 3000, imagePath);
      enhancedPath = await this.withTimeout(imgProc.cropToDocument(enhancedPath), 3000, enhancedPath);
      enhancedPath = await this.withTimeout(imgProc.enhanceToScanned(enhancedPath), 3000, enhancedPath);
      if (enhancedPath !== imagePath) {
        that.setData({ imagePath: enhancedPath });
        that.readImageBase64(enhancedPath);
      }
    } catch (e) { console.log('[AI增强] 跳过:', e.message); }
  },

  /** 确认图片 → 质量不过时阻断 */
  confirmImage() {
    var qr = this.data.qualityResult;
    // 质量≥60分直接进手动填写，跳过对齐步骤
    if (qr && qr.score >= 60) {
      this.setData({ step: 3, docType: 'unknown', docTypeLabel: '手动录入' });
      return;
    }
    if (qr && !qr.pass) {
      wx.showModal({
        title: '照片质量不通过',
        content: '检测到以下问题：\n' + qr.issues.filter(function(i) { return i.severity === 'warning'; }).map(function(i) { return '• ' + i.message; }).join('\n') + '\n\n建议重新拍摄以获得更好的识别效果。',
        confirmText: '重新拍摄',
        cancelText: '强制继续',
        success: (function(res) {
          if (res.confirm) {
            this.retakePhoto();
          } else {
            this.setData({ step: 2.5, cropX: 0, cropY: 0, cropScale: 1 });
          }
        }).bind(this)
      });
      return;
    }
    this.setData({ step: 2.5, cropX: 0, cropY: 0, cropScale: 1 });
  },

  onCropChange(e) {
    this.setData({ cropX: e.detail.x, cropY: e.detail.y });
  },
  onCropScale(e) {
    this.setData({ cropScale: e.detail.scale });
  },
  // #7: 旋转90°
  rotateImage() {
    var currentRot = (this.data._rotateDeg || 0) + 90;
    if (currentRot >= 360) currentRot = 0;
    this.setData({ _rotateDeg: currentRot });
    // 通过CSS transform旋转预览图
    this.setData({ _rotateStyle: 'transform: rotate(' + currentRot + 'deg);' });
  },
  confirmCrop() {
    this.setData({ step: 3, docType: 'unknown', docTypeLabel: '手动录入' });
  },

  /** Promise超时兜底 — 防止Canvas操作挂起导致转圈 */
  withTimeout: function(promise, ms, fallback) {
    return Promise.race([
      promise,
      new Promise(function(resolve) { setTimeout(function() { resolve(fallback); }, ms); })
    ]);
  },

  /** 缩放图片到maxPx以内 */
  shrinkImage(src, maxPx) {
    return new Promise(function(resolve) {
      wx.getImageInfo({
        src: src,
        success: function(info) {
          var w = info.width, h = info.height;
          if (Math.max(w, h) <= maxPx) { resolve(src); return; }
          var ratio = maxPx / Math.max(w, h);
          var nw = Math.round(w * ratio), nh = Math.round(h * ratio);
          // 用compressImage的质量100+指定尺寸间接缩放
          wx.compressImage({ src: src, quality: 80, compressedWidth: nw, compressedHeight: nh,
            success: function(r) { resolve(r.tempFilePath); },
            fail: function() { resolve(src); }
          });
        },
        fail: function() { resolve(src); }
      });
    });
  },

  /** Promise包装 wx.compressImage */
  wxCompressImage(src) {
    return new Promise((resolve, reject) => {
      wx.compressImage({ src, quality: 40, success: (r) => resolve(r.tempFilePath), fail: reject });
    });
  },

  /** 上传到云存储 _ocr_temp/ 目录，返回 fileID */
  uploadToCloud(imagePath) {
    return new Promise((resolve, reject) => {
      var cloudPath = '_ocr_temp/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.jpg';
      wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: imagePath,
        success: (res) => resolve(res.fileID),
        fail: reject
      });
    });
  },

  /** 读取图片base64用于预览 */
  readImageBase64(imagePath) {
    const fs = wx.getFileSystemManager();
    try {
      const data = fs.readFileSync(imagePath, 'base64');
      this.setData({ imageBase64: 'data:image/jpeg;base64,' + data });
    } catch (e) {
      console.log('[图片] base64转换失败');
    }
  },

  // ========== Step 3: OCR识别 ==========

  /**
   * 执行OCR识别 — 通过云函数 (tesseract.js)
   * 流程: fileID → ocr-service(action:'ocr') → 解析字段 → 展示确认
   * @param {string} fileID - 云存储文件ID
   */
  async runOCR(fileID) {
    if (!fileID) {
      wx.showToast({ title: '图片未上传成功', icon: 'none' });
      this.setData({ step: 4, ocrProcessing: false });
      return;
    }

    try {
      // 调用云函数 — 一步完成类型识别+字段提取
      var res = await wx.cloud.callFunction({
        name: 'ocr-service',
        data: { action: 'ocr', fileID: fileID }
      });

      var result = res.result || {};
      if (result.code !== 0) {
        throw new Error(result.msg || 'OCR 服务异常');
      }

      var data = result.data || {};
      var rawText = data.rawText || '';
      var docType = data.docType || 'unknown';
      var confidence = typeof data.confidence === 'number' ? data.confidence : 0.5;
      var ocrError = data.ocrError || '';
      // OCR引擎失败时，提示用户并直接跳手动填写
      if (ocrError) {
        wx.showModal({
          title: '识别失败',
          content: ocrError,
          confirmText: '手动填写',
          cancelText: '重拍',
          success: (modalRes) => {
            if (modalRes.confirm) {
              this.setData({ step: 4, ocrProcessing: false });
            } else {
              this.setData({ step: 1, ocrProcessing: false, imagePath: '', imageBase64: '' });
            }
          }
        });
        return;
      }

      // 云函数返回的 fields 是 [{label, value}] 数组格式
      var fieldsArray = data.fields || [];
      var ocrFields = {};
      var fieldLabelMap = {
        '姓名': 'name', '证件号码': 'idNumber', '身份证号': 'idNumber',
        '护照号': 'passportNumber', '香港身份证号': 'hkIdNumber',
        '出生日期': 'birthDate', '性别': 'gender', '国籍': 'nationality',
        '有效期起': 'validFrom', '有效期至': 'validTo',
        '签发机关': 'issuingAuthority', '地址': 'address',
        '学位': 'degree', '毕业院校': 'school', '专业': 'major',
        '毕业日期': 'graduationDate', '公司': 'company', '职位': 'position',
        '收入': 'income', '签证类型': 'visaType', '许可编号': 'permitNumber',
        // 银行流水/资产类
        '银行名称': 'bankName', '账户持有人': 'accountHolder', '账号': 'accountNumber'
      };

      fieldsArray.forEach(function(f) {
        var key = fieldLabelMap[f.label] || f.label;
        ocrFields[key] = f.value || '';
      });

      // 如果字段为空，尝试用正则从 rawText 提取补充字段
      if (Object.keys(ocrFields).length === 0 && rawText.trim().length > 0) {
        ocrFields = extractFieldsFromText(rawText, docType);
        if (Object.keys(ocrFields).length > 0) {
          confidence = Math.min(confidence, 0.6); // 降级置信度
        }
      }

      var docTypeLabels = {
        id_card: '身份证', hk_id: '香港身份证', passport: '护照',
        degree: '学历证书', work_proof: '工作证明', visa: '签证',
        bank_statement: '银行流水', approval_notice: '获批通知',
        hk_permit: '港澳通行证', unknown: '未知类型'
      };

      // 构建字段列表
      var fieldDisplayLabels = {
        name: '姓名', idNumber: '证件号码', passportNumber: '护照号',
        hkIdNumber: '香港身份证号', birthDate: '出生日期', gender: '性别',
        nationality: '国籍', validFrom: '有效期起', validTo: '有效期至',
        issuingAuthority: '签发机关', address: '地址', degree: '学位',
        school: '毕业院校', major: '专业', graduationDate: '毕业日期',
        company: '公司', position: '职位', income: '收入',
        visaType: '签证类型', permitNumber: '许可编号',
        bankName: '银行名称', accountHolder: '账户持有人', accountNumber: '账号'
      };

      var fieldList = Object.keys(ocrFields).map(function(key) {
        return {
          key: key,
          label: fieldDisplayLabels[key] || key,
          value: ocrFields[key] || ''
        };
      });

      this.setData({
        docType: docType,
        docTypeLabel: docTypeLabels[docType] || '证件',
        confidence: confidence,
        confidencePercent: Math.round(confidence * 100).toString(),
        ocrFields: ocrFields,
        rawOCRText: rawText,
        ocrFieldList: fieldList,
        step: 3,
        ocrProcessing: false
      });

    } catch (e) {
      console.error('[OCR] 识别失败:', e);
      wx.showToast({ title: '识别失败，请手动填写', icon: 'none' });
      this.setData({ step: 4, ocrProcessing: false });
    }
  },

      /** 正则从OCR文本提取字段（云函数字段为空时的兜底） */
  extractFieldsFromText(text, docType) {
    var fields = {};
    // OCR文本预处理: tesseract常在中文字间加空格
    var clean = text.replace(/\s+/g, '');
    // === 身份证号 ===
    var idMatch = text.match(/\d{17}[\dXx]/);
    if (idMatch) fields.idNumber = idMatch[0].toUpperCase();
    // === 香港身份证 ===
    var hkid = text.match(/[A-Z]\d{6}\([0-9A]\)/);
    if (hkid) fields.hkIdNumber = hkid[0];
    // === 护照号 ===
    var pp = text.match(/[A-Z]{1,2}\d{7,9}/);
    if (pp && !idMatch) fields.passportNumber = pp[0];
    // === 姓名 — 多策略 ===
    var nm = text.match(/姓\s*名\s*[：:＝]\s*([\u4e00-\u9fff]{2,4})/);
    if (nm) fields.name = nm[1];
    if (!fields.name) {
      var nm2 = clean.match(/姓名([\u4e00-\u9fff]{2,4})/);
      if (nm2) fields.name = nm2[1];
    }
    if (!fields.name) {
      var nm3 = text.match(/Name\s*[：:＝]\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/i);
      if (nm3) fields.name = nm3[1];
    }
    // === 出生日期 ===
    var bm = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
    if (bm) fields.birthDate = bm[1] + '-' + bm[2].padStart(2,'0') + '-' + bm[3].padStart(2,'0');
    if (!fields.birthDate) {
      var bm2 = text.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
      if (bm2) fields.birthDate = bm2[1] + '-' + bm2[2].padStart(2,'0') + '-' + bm2[3].padStart(2,'0');
    }
    // === 性别 ===
    var gm = text.match(/[性別别]\s*[：:＝]*\s*(男|女|MALE|FEMALE)/i);
    if (gm) fields.gender = /男|MALE/i.test(gm[1]) ? '男' : '女';
    if (!fields.gender && /男/.test(clean.slice(0,100))) fields.gender = '男';
    if (!fields.gender && /女/.test(clean.slice(0,100))) fields.gender = '女';
    // === 有效期至 — 多格式 ===
    var vt = text.match(/(?:有效期[限至]|有效期限|Valid\s*To|Expir)[：:\s＝]*(\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2})/i);
    if (vt) fields.validTo = vt[1].replace(/\./g,'-');
    if (!fields.validTo) {
      var vt2 = text.match(/至\s*(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/);
      if (vt2) fields.validTo = vt2[1];
    }
    if (!fields.validTo) {
      var vt3 = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日.*(?:有效|到期|期限|长期)/);
      if (vt3) fields.validTo = vt3[1] + '-' + vt3[2].padStart(2,'0') + '-' + vt3[3].padStart(2,'0');
    }
    // 无标签: 取第二个ISO日期（第一个通常是出生日期）
    if (!fields.validTo) {
      var allD = text.match(/\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/g);
      if (allD && allD.length >= 2) fields.validTo = allD[1];
    }
    
    // === HK身份证日期: DD-MM-YYYY 格式 ===
    if (!fields.birthDate) {
      var hkDate = text.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
      if (hkDate) {
        var d = parseInt(hkDate[1]), m = parseInt(hkDate[2]), y = parseInt(hkDate[3]);
        if (d <= 31 && m <= 12 && y >= 1900 && y <= 2030) {
          fields.birthDate = y + '-' + hkDate[2].padStart(2,'0') + '-' + hkDate[1].padStart(2,'0');
        }
      }
    }
    // === 国徽面有效期: 2020.06.01-2030.06.01 或 2020-06-01至2030-06-01 ===
    if (!fields.validTo) {
      var evt = text.match(/(?:有效期限|有效期)[：:\s＝]*(?:长期|Long.?Term)/i);
      if (evt) fields.validTo = '长期';
    }
    if (!fields.validTo) {
      var evt2 = text.match(/(?:有效期限|有效期)[：:\s＝]*\s*(\d{4})[\.\-\/](\d{1,2})[\.\-\/](\d{1,2})\s*[-至~]\s*(\d{4})[\.\-\/](\d{1,2})[\.\-\/](\d{1,2})/);
      if (evt2) {
        fields.validFrom = evt2[1] + '-' + evt2[2].padStart(2,'0') + '-' + evt2[3].padStart(2,'0');
        fields.validTo = evt2[4] + '-' + evt2[5].padStart(2,'0') + '-' + evt2[6].padStart(2,'0');
      }
    }
    // 国徽面单日期: 有效期限 2030.06.01
    if (!fields.validTo) {
      var evt3 = text.match(/(?:有效期限|有效期)[：:\s＝]*\s*(\d{4})[\.\\/](\d{1,2})[\.\\/](\d{1,2})/);
      if (evt3) fields.validTo = evt3[1] + '-' + evt3[2].padStart(2,'0') + '-' + evt3[3].padStart(2,'0');
    }
// === 有效期起 ===
    var vf = text.match(/(?:签发日期|Issue\s*Date|簽發日期)[：:\s＝]*(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/i);
    if (vf) fields.validFrom = vf[1];
    // === 签发机关 ===
    var au = text.match(/(?:签发机关|簽發機關|Issuing\s*Authority)\s*[：:＝]*\s*(.+?)(?:\n|$)/i);
    if (au) fields.issuingAuthority = au[1].trim();
    if (!fields.issuingAuthority) {
      var au2 = clean.match(/([\u4e00-\u9fff]{2,}公安局[\u4e00-\u9fff分局]*(?:出入境[\u4e00-\u9fff]*)?)/);
      if (au2) fields.issuingAuthority = au2[1];
    }
    // === 地址 ===
    var ad = text.match(/(?:住址|地址)\s*[：:＝]*\s*(.+?)(?:\n|$|签发|有效|公民|民族)/);
    if (ad) fields.address = ad[1].trim();
    // === 学位 ===
    if (/博士|Doctor|Ph\.D/i.test(text)) fields.degree = '博士';
    else if (/硕士|Master|M\.S|M\.A/i.test(text)) fields.degree = '硕士';
    else if (/学士|本科|Bachelor|B\.S|B\.A/i.test(text)) fields.degree = '学士';
    // === 院校 ===
    var un = clean.match(/([\u4e00-\u9fff]{2,}(?:大学|學院|学院|University|College|Institute)[\u4e00-\u9fffA-Za-z]*)/);
    if (un) fields.school = un[1].trim();
    return fields;
  },/** OCR字段值变更 */
  onFieldChange(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    const ocrFields = { ...this.data.ocrFields, [field]: value };
    const ocrFieldList = this.data.ocrFieldList.map(item =>
      item.key === field ? { ...item, value } : item
    );
    this.setData({ ocrFields, ocrFieldList });
  },

  /** Step3 → Step4: 确认OCR结果，进入分类选择 */
  confirmAndProceed() {
    var ocrFields = this.data.ocrFields;
    this.setData({
      step: 4,
      manualForm: {
        name: ocrFields.name || '',
        docNumber: ocrFields.idNumber || ocrFields.passportNumber || ocrFields.hkIdNumber || '',
        validFrom: ocrFields.validFrom || '',
        validTo: ocrFields.validTo || '',
        issuingAuthority: ocrFields.issuingAuthority || '',
        notes: ''
      }
    });
  },

  /** 取消添加，返回证件夹 */
  cancelAdd() {
    wx.showModal({
      title: '放弃添加',
      content: '当前已填写的信息将不会保存，确定离开吗？',
      confirmText: '确定离开',
      cancelText: '继续填写',
      success: function(res) {
        if (res.confirm) wx.navigateBack();
      }
    });
  },

  /** 转为手动填写 */
  switchToManual() {
    // 预填OCR数据到手动表单
    const { ocrFields } = this.data;
    this.setData({
      step: 4,
      manualForm: {
        name: ocrFields.name || '',
        docNumber: ocrFields.idNumber || ocrFields.passportNumber || ocrFields.hkIdNumber || '',
        validFrom: ocrFields.validFrom || '',
        validTo: ocrFields.validTo || '',
        issuingAuthority: ocrFields.issuingAuthority || '',
        notes: ''
      }
    });
  },

  /** 重新识别（返回重拍） */
  retakePhoto() {
    this.setData({
      step: 1, inputMode: '', imagePath: '', imageBase64: '', imageRotated: 0, scanMode: false,
      docType: 'unknown', ocrFields: {}, rawOCRText: '',
      confidence: 0, confidencePercent: '0', ocrFieldList: [], qualityIssues: [], qualityResult: null
    });
  },

  // ===== Bug #5: 旋转+扫描件工具栏 =====

  /** 顺时针旋转90° */
  onRotateImage() {
    var currentRot = this.data.imageRotated || 0;
    var newRot = (currentRot + 90) % 360;
    this.setData({ imageRotated: newRot });
    wx.showToast({ title: '已旋转 ' + newRot + '°', icon: 'none', duration: 800 });
  },

  /** 扫描件效果增强 */
  onToggleScanMode() {
    var that = this;
    if (this.data.scanProcessing) return;
    this.setData({ scanProcessing: true });
    wx.showLoading({ title: '扫描增强中...' });
    try {
      var imageProcess = require('../../../utils/image-process');
      imageProcess.enhanceToScanned(this.data.imagePath).then(function(enhancedPath) {
        wx.hideLoading();
        that.setData({ scanMode: !that.data.scanMode, scanProcessing: false });
        if (enhancedPath && enhancedPath !== that.data.imagePath) {
          that.setData({ imagePath: enhancedPath });
        }
        wx.showToast({ title: '扫描增强完成', icon: 'success', duration: 1000 });
      }).catch(function() {
        wx.hideLoading();
        that.setData({ scanMode: !that.data.scanMode, scanProcessing: false });
        wx.showToast({ title: '增强失败，使用原图', icon: 'none' });
      });
    } catch (e) {
      wx.hideLoading();
      this.setData({ scanProcessing: false });
      wx.showToast({ title: '扫描增强暂不可用', icon: 'none' });
    }
  },

  // ===== Bug #2: 自由模式证件类型选择 =====

  /** 选择拍摄的证件类型（非卡槽模式下显示对应线框图+指引） */
  onSelectFreeDocType(e) {
    var value = e.currentTarget.dataset.value;
    var guide = getFreeDocGuide(value);
    this.setData({ freeDocType: value, freeDocGuide: guide });
  },

  /** 获取当前有效的拍摄指引（卡槽优先，否则自由模式） */
  getActiveGuide() {
    if (this.data.slotContext && this.data.slotGuide) return this.data.slotGuide;
    if (this.data.freeDocGuide) return this.data.freeDocGuide;
    return null;
  },

  // ========== Step 4: 确认保存 ==========

  /** 手动输入变更 */
  onManualChange(e) {
    const field = e.currentTarget.dataset.field;
    const manualForm = { ...this.data.manualForm, [field]: e.detail.value };
    this.setData({ manualForm });
  },

  /** 选择证件所属人 */
  selectOwner(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({ ownerType: value, ownerName: '' });
  },
  /** 子女姓名输入 */
  onOwnerNameInput(e) {
    this.setData({ ownerName: e.detail.value });
  },
  /** 选择证件分类 */
  selectCategory(e) {
    const dataset = e.currentTarget.dataset;
    // data-show 表示"显示分类选择器"→ 进入 Step 4
    if (dataset.show) {
      // 保留已识别的字段到 manualForm，方便用户在 Step 4 修正
      const ocrFields = this.data.ocrFields || {};
      this.setData({
        step: 4,
        manualForm: {
          name: ocrFields.name || '',
          docNumber: ocrFields.idNumber || ocrFields.passportNumber || ocrFields.hkIdNumber || '',
          validFrom: ocrFields.validFrom || '',
          validTo: ocrFields.validTo || '',
          issuingAuthority: ocrFields.issuingAuthority || '',
          notes: ''
        }
      });
      return;
    }
    // data-value 表示选择分类
    const value = dataset.value;
    if (value) this.setData({ docCategory: value });
  },

  /**
   * 确认保存 — 写入本地文件系统和Storage
   */
  async confirmSave() {
    const { docCategory, ocrFields, manualForm, imagePath, docType } = this.data;

    // 校验分类
    if (!docCategory) {
      wx.showToast({ title: '请选择证件分类', icon: 'none' });
      return;
    }

    // 检查免费用户上限（付费用户跳过）
    const membershipLevel = app.globalData.membershipLevel || 'free';

    // 检查账户锁定
    if (app.globalData.isLocked) {
      wx.showModal({
        title: '账户已锁定',
        content: '你的免费试用已到期或会员已过期。续费后即可继续添加证件。',
        confirmText: '立即解锁',
        cancelText: '稍后再说',
        success: function(res) {
          if (res.confirm) wx.navigateTo({ url: '/pages/membership/index/index' });
        }
      });
      return;
    }

    if (!constants.isPayingMember(membershipLevel)) {
      const docs = getAllDocuments();
      const maxDocs = constants.getEffectiveLimit(membershipLevel, 'maxDocuments');
      if (docs.length >= maxDocs) {
        wx.showModal({
          title: '免费额度已满',
          content: '免费用户最多' + maxDocs + '份证件，请升级会员或删除旧证件后重试。',
          confirmText: '升级会员',
          cancelText: '稍后再说',
          success: (res) => {
            if (res.confirm) wx.navigateTo({ url: '/pages/membership/index/index' });
          }
        });
        return;
      }
    }

    // 用户授权：本地存储确认
    var that = this;
    wx.showModal({
      title: '授权本地存储',
      content: '确认将此证件照片加密保存到您的设备本地？\n\n📁 存储位置：微信文件管理 > 住港伴\n🔒 不上传服务器，仅本地留存\n💡 保存后可从证件夹随时查看',
      confirmText: '授权保存',
      cancelText: '取消',
      success: function(res) {
        if (res.confirm) {
          that.doActualSave(docCategory, ocrFields, manualForm, imagePath, docType);
        }
      }
    });
  },

  doActualSave: async function(docCategory, ocrFields, manualForm, imagePath, docType) {
    this.setData({ saving: true });

    // 生成证件ID
    var docId = 'DOC_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

    // 选中的分类信息
    var categoryInfo = this.data.categories.find(function(c) { return c.value === docCategory; }) || {};

    // 保存图片到本地文件系统
    var filePath = imagePath;
    if (imagePath) {
      try {
        filePath = await saveFile(imagePath, docId, docCategory);
        // 并存一份到微信本地文件系统做独立持久化留存
        try {
          var fs = wx.getFileSystemManager();
          var bakName = '住港伴_' + docCategory + '_' + docId + '.jpg';
          var bakPath = wx.env.USER_DATA_PATH + '/' + bakName;
          fs.copyFileSync(imagePath, bakPath);
        } catch (be) { console.warn('[留存] 备份跳过:', be.message); }
      } catch (e) {
        console.error('[保存] 文件保存失败:', e);
        // 仍保存元数据，但标记无文件
        filePath = '';
      }
    }

    // 构建证件元数据
    var name = ocrFields.name || manualForm.name || categoryInfo.label + '证件';
    var docNumber = ocrFields.idNumber || ocrFields.passportNumber ||
                      ocrFields.hkIdNumber || manualForm.docNumber || '';
    var now = new Date().toISOString();

    // 推导 docType：OCR 模式用识别结果，人工模式从分类推导
    var effectiveDocType = docType;
    if (effectiveDocType === 'unknown' && docCategory) {
      // 人工录入场景：从分类映射到基础 docType，确保卡槽匹配
      var categoryTypeMap = {
        identity: 'id_card', education: 'degree', work: 'work_proof',
        assets: 'bank_statement', approved: 'approval_notice',
        renewal: 'visa', permanent: 'visa'
      };
      effectiveDocType = categoryTypeMap[docCategory] || 'unknown';
    }

    var doc = {
      id: docId,
      name: name,
      type: effectiveDocType,
      category: docCategory,
      categoryLabel: categoryInfo.label || docCategory,
      slotKey: this._slotKey || '',
      ownerType: this.data.ownerType,
      ownerName: this.data.ownerType === 'child' ? this.data.ownerName : '',
      docNumber: docNumber,
      filePath: filePath,
      icon: categoryInfo.icon || '📄',
      validFrom: ocrFields.validFrom || manualForm.validFrom || '',
      validTo: ocrFields.validTo || manualForm.validTo || '',
      issuingAuthority: ocrFields.issuingAuthority || manualForm.issuingAuthority || '',
      ocrData: ocrFields,
      ocrVerified: Object.keys(ocrFields).length > 0,
      ocrConfidence: this.data.confidence,
      rawOCRText: this.data.rawOCRText,
      notes: manualForm.notes || '',
      status: this.calcStatus(ocrFields.validTo || manualForm.validTo),
      archived: false,
      createdAt: now,
      updatedAt: now
    };

    // 保存元数据到Storage
    saveDocumentMeta(doc);

    this.setData({ saving: false });

    // 显示备份留存信息
    var bakName = '住港伴_' + docCategory + '_' + docId + '.jpg';
    wx.showModal({
      title: '保存成功 ✅',
      content: '证件已加密保存到本地。\n\n📁 持久化备份：微信文件管理 > 住港伴\n文件名：' + bakName + '\n\n💡 即使清理小程序缓存，备份文件不会丢失。',
      confirmText: '知道了',
      showCancel: false,
      success: function() { wx.navigateBack(); }
    });
  },

  /** 计算有效期状态 */
  calcStatus(validTo) {
    if (!validTo) return 'none';
    try {
      const expiry = new Date(validTo);
      if (isNaN(expiry.getTime())) return 'none';
      if (expiry < new Date()) return 'expired';
      const days = Math.ceil((expiry - new Date()) / 86400000);
      if (days <= 90) return 'warning';
      return 'valid';
    } catch (e) { return 'none'; }
  }
});

/** 卡槽→证件指引映射：从不同卡槽进入展示不同要求 (Bug #24: 增强专属模板) */
function getSlotGuide(slotKey, docName) {
  var name = (docName || '').toLowerCase();
  var guides = {
    // 身份证 — 双面模板：人像面+国徽面
    id_card: { icon: '🪪', title: '身份证材料标准', wfTitle: '中华人民共和国居民身份证', items: [
      '正反面均需拍摄，四角完整可见',
      '平放深色桌面，正对拍摄，不倾斜',
      '确保证件号、姓名、照片清晰可读',
      '勿使用复印件或屏幕截图',
      '圆角边框不得裁切或遮挡'
    ], piiFields: ['姓名', '身份证号', '出生日期', '地址'], specimen: '正面(人像面)+背面(国徽面)·四角完整·无反光·彩色',
    wfFields: [
      { label: '姓名', width: 'short', pii: true },
      { label: '性别 / 民族', width: 'mid', pii: false },
      { label: '出生日期', width: 'mid', pii: true },
      { label: '住址', width: 'full', pii: true },
      { label: '公民身份号码', width: 'long', pii: true },
      { label: '签发机关', width: 'mid', pii: false },
      { label: '有效期限', width: 'mid', pii: false }
    ], showPhoto: true, showSeal: false },
    // 学位证
    degree: { icon: '🎓', title: '学位证/毕业证材料标准', wfTitle: '学士学位证书', items: [
      '证书原件彩色拍摄，不可拍摄复印件',
      '确保证书编号、姓名、学位、日期清晰',
      '如有英文版本一并拍摄',
      '海外学历需同时拍摄认证文件',
      '证书四角完整，印章清晰可辨'
    ], piiFields: ['姓名', '证书编号', '毕业日期'], specimen: '学位证正面+背面',
    wfFields: [
      { label: '学位证书编号', width: 'long', pii: true },
      { label: '姓名', width: 'short', pii: true },
      { label: '性别 / 出生日期', width: 'mid', pii: false },
      { label: '所学专业', width: 'mid', pii: false },
      { label: '学位授予单位', width: 'full', pii: false },
      { label: '授予日期', width: 'mid', pii: false }
    ], showPhoto: true, showSeal: true },
    // 港澳通行证
    hk_permit: { icon: '🛂', title: '港澳通行证材料标准', wfTitle: '往来港澳通行证', items: [
      '个人信息页+签注页均需拍摄',
      '证件号（C开头）、姓名、有效期需清晰',
      '签注页需显示D签注类型和有效期',
      '反光环境下从侧面打光避免正面强光'
    ], piiFields: ['姓名', '证件号', '出生日期', '有效期'], specimen: '通行证个人信息页+签注页',
    wfFields: [
      { label: '姓名', width: 'short', pii: true },
      { label: '通行证号码', width: 'long', pii: true },
      { label: '出生日期', width: 'mid', pii: true },
      { label: '签发机关', width: 'mid', pii: false },
      { label: '签发日期 / 有效期限', width: 'full', pii: false },
      { label: '签注类型 / 逗留条件', width: 'mid', pii: false }
    ], showPhoto: true, showSeal: false },
    // 护照
    passport: { icon: '🛂', title: '护照材料标准', wfTitle: '中华人民共和国护照', items: [
      '个人信息页完整拍摄（含照片、护照号、签名）',
      '确保护照号（E/G开头）和有效期清晰',
      '如有签证页一并拍摄'
    ], piiFields: ['姓名', '护照号', '出生日期', '国籍'], specimen: '护照个人信息页',
    wfFields: [
      { label: '姓名 (中/英)', width: 'mid', pii: true },
      { label: '护照号码', width: 'mid', pii: true },
      { label: '国籍 / 性别', width: 'short', pii: false },
      { label: '出生日期 / 地点', width: 'full', pii: true },
      { label: '签发日期 / 有效期至', width: 'full', pii: false },
      { label: '签发机关', width: 'mid', pii: false }
    ], showPhoto: true, showSeal: false },
    // 香港身份证
    hk_id: { icon: '🆔', title: '香港身份证材料标准', wfTitle: '香港永久性居民身份证', items: [
      '正面拍摄，四角完整',
      '证件号（字母+6位数字+括号校验码）清晰',
      '照片、姓名、出生日期清晰可辨',
      '芯片面朝上，无遮挡'
    ], piiFields: ['姓名', '身份证号', '出生日期'], specimen: '香港身份证正面·彩色',
    wfFields: [
      { label: '姓名 (中/英)', width: 'mid', pii: true },
      { label: '身份证号码', width: 'long', pii: true },
      { label: '出生日期', width: 'mid', pii: true },
      { label: '签发日期', width: 'mid', pii: false },
      { label: '符号标记', width: 'short', pii: false }
    ], showPhoto: true, showSeal: false },
    // 户口本
    household: { icon: '📖', title: '户口本材料标准', wfTitle: '居民户口簿', items: [
      '户主页+本人页均需拍摄',
      '四角完整，印章清晰',
      '姓名、身份证号、与户主关系清晰',
      '户口登记机关印章可见'
    ], piiFields: ['姓名', '身份证号', '住址'], specimen: '户主页+本人页·四角完整',
    wfFields: [
      { label: '户主姓名', width: 'short', pii: true },
      { label: '户号', width: 'mid', pii: false },
      { label: '住址', width: 'full', pii: true },
      { label: '本人姓名', width: 'short', pii: true },
      { label: '公民身份号码', width: 'long', pii: true },
      { label: '与户主关系', width: 'short', pii: false },
      { label: '登记机关 (印章)', width: 'mid', pii: false }
    ], showPhoto: false, showSeal: true },
    // 结婚证
    marriage: { icon: '💍', title: '结婚证材料标准', wfTitle: '中华人民共和国结婚证', items: [
      '双页展开或正反页拍摄',
      '结婚证字号、双方姓名清晰',
      '登记机关印章完整',
      '照片清晰可见'
    ], piiFields: ['双方姓名', '证件号', '登记日期'], specimen: '结婚证双页展开·印章清晰',
    wfFields: [
      { label: '持证人姓名', width: 'short', pii: true },
      { label: '登记日期', width: 'mid', pii: false },
      { label: '结婚证字号', width: 'long', pii: true },
      { label: '双方姓名', width: 'full', pii: true },
      { label: '双方证件号码', width: 'full', pii: true },
      { label: '登记机关 (印章)', width: 'mid', pii: false }
    ], showPhoto: true, showSeal: true },
    // 出生证
    birth_cert: { icon: '👶', title: '出生证材料标准', wfTitle: '出生医学证明', items: [
      '正面完整拍摄，四角可见',
      '婴儿姓名、出生日期、父母信息清晰',
      '医院印章和编号清晰',
      '无折叠、无反光'
    ], piiFields: ['婴儿姓名', '父母姓名', '出生日期'], specimen: '出生证正面·四角完整',
    wfFields: [
      { label: '婴儿姓名', width: 'short', pii: true },
      { label: '出生医学证明编号', width: 'long', pii: false },
      { label: '出生日期 / 时间', width: 'mid', pii: true },
      { label: '母亲姓名 / 证件号', width: 'full', pii: true },
      { label: '父亲姓名 / 证件号', width: 'full', pii: true },
      { label: '签发医院 (印章)', width: 'mid', pii: false }
    ], showPhoto: false, showSeal: true },
    // 工作证明
    work: { icon: '💼', title: '工作证明/推荐信材料标准', wfTitle: '在職證明 / 工作证明', items: [
      '公司抬头纸原件拍摄',
      '公章+签字必须清晰可见',
      '包含入职日期、职位、薪资信息',
      '推荐信需推荐人联系方式',
      '英文版需一并提供'
    ], piiFields: ['姓名', '身份证号', '薪资', '公司名'], specimen: '公司抬头纸+公章+签字',
    wfFields: [
      { label: '公司名称 (抬头)', width: 'full', pii: false },
      { label: '员工姓名', width: 'short', pii: true },
      { label: '身份证号码', width: 'long', pii: true },
      { label: '入职日期 / 职位', width: 'mid', pii: false },
      { label: '薪资 (月薪/年薪)', width: 'mid', pii: true },
      { label: '公章 / 签字', width: 'mid', pii: false }
    ], showPhoto: false, showSeal: true },
    // 银行流水
    bank: { icon: '💰', title: '银行流水/资产证明材料标准', wfTitle: '银行流水 / 资产证明', items: [
      '银行官方流水单原件拍摄',
      '最近6-12个月完整记录',
      '账户名、账号、银行名称清晰',
      '余额和流水记录完整可见',
      '加盖银行印章的版本'
    ], piiFields: ['账户持有人', '账号', '金额'], specimen: '最近12个月银行流水',
    wfFields: [
      { label: '银行名称', width: 'mid', pii: false },
      { label: '账户持有人', width: 'short', pii: true },
      { label: '账号', width: 'long', pii: true },
      { label: '币种 / 余额', width: 'mid', pii: true },
      { label: '流水时间段', width: 'full', pii: false },
      { label: '银行印章', width: 'mid', pii: false }
    ], showPhoto: false, showSeal: true },
    // 获批通知
    approval: { icon: '✅', title: '获批通知/e-Visa材料标准', wfTitle: '入境许可通知书 / e-Visa', items: [
      '入境处发出的正式通知原件',
      '申请编号、批准日期、签证类型清晰',
      'e-Visa可拍摄打印版或手机截图',
      '含逗留条件和期限的页面'
    ], piiFields: ['姓名', '申请编号', '签证类型'], specimen: '获批通知书/e-Visa PDF',
    wfFields: [
      { label: '入境许可编号', width: 'long', pii: true },
      { label: '申请人姓名', width: 'short', pii: true },
      { label: '签证类型 / 逗留条件', width: 'mid', pii: false },
      { label: '批准日期', width: 'mid', pii: false },
      { label: '逗留期限至', width: 'mid', pii: false },
      { label: '入境处印章/编号', width: 'full', pii: false }
    ], showPhoto: false, showSeal: true }
  };

  // 模糊匹配: 根据docName关键词匹配到对应引导
  for (var key in guides) {
    if (name.indexOf(key.replace(/_/g, '')) >= 0 || name.indexOf(key) >= 0) return guides[key];
  }
  // slotKey 兜底匹配
  if (slotKey && guides[slotKey]) return guides[slotKey];
  return null;
}

/** Bug #2: 自由模式证件类型→拍摄指引映射 */
function getFreeDocGuide(docType) {
  var guides = {
    id_card: { icon: '🪪', wfTitle: '中华人民共和国居民身份证', items: ['背景：深色桌面，白色背景', '人像：正面居中，头部在虚线框内', '国徽：背面国徽清晰，居中拍摄', '边距：四角留出5mm空白，勿裁切'], piiFields: ['姓名', '身份证号', '出生日期'], specimen: '人像面+国徽面·无反光·圆角完整' },
    hk_permit: { icon: '🛂', wfTitle: '往来港澳通行证', items: ['背景：深色桌面', '信息页：个人信息+签注页完整', '边距：四角完整，勿裁切'], piiFields: ['姓名', '证件号', '有效期'], specimen: '个人信息页·无反光' },
    passport: { icon: '🛂', wfTitle: '中华人民共和国护照', items: ['背景：深色桌面', '信息页：含照片个人信息页', '边距：护照四边完整'], piiFields: ['姓名', '护照号', '出生日期'], specimen: '个人信息页·无反光' },
    hk_id: { icon: '🆔', wfTitle: '香港永久性居民身份证', items: ['背景：深色桌面', '正面：芯片面朝上', '边距：四角完整'], piiFields: ['姓名', '身份证号'], specimen: '正面·芯片可见' },
    household: { icon: '📖', wfTitle: '居民户口簿', items: ['背景：深色桌面', '内容：户主页+本人页', '边距：四角完整'], piiFields: ['姓名', '身份证号', '住址'], specimen: '户主页+本人页' },
    marriage: { icon: '💍', wfTitle: '中华人民共和国结婚证', items: ['背景：深色桌面', '内容：双页展开', '要求：印章+照片清晰'], piiFields: ['双方姓名', '证件号'], specimen: '双页展开·印章清晰' },
    birth_cert: { icon: '👶', wfTitle: '出生医学证明', items: ['背景：深色桌面', '内容：正面完整', '要求：编号+印章清晰'], piiFields: ['婴儿姓名', '出生日期'], specimen: '正面·无折叠' },
    degree: { icon: '🎓', wfTitle: '学位证书', items: ['背景：深色桌面', '内容：证书正面完整', '要求：证书编号+印章清晰'], piiFields: ['姓名', '证书编号'], specimen: '正面·印章清晰' },
    work_proof: { icon: '💼', wfTitle: '工作证明', items: ['背景：深色桌面', '内容：抬头纸+盖章', '要求：公章+签字清晰'], piiFields: ['姓名', '公司名'], specimen: '抬头纸+公章' },
    bank_statement: { icon: '💰', wfTitle: '银行流水', items: ['背景：深色桌面', '内容：最近12个月', '要求：银行印章清晰'], piiFields: ['账户名', '账号'], specimen: '银行流水原件' },
    approval: { icon: '✅', wfTitle: '获批通知书', items: ['背景：深色桌面', '内容：通知完整页面', '要求：申请编号+日期清晰'], piiFields: ['姓名', '申请编号'], specimen: '获批原件' }
  };
  return guides[docType] || null;
}

/** 卡槽key → 证件分类自动映射 */
function slotToCategory(slotKey) {
  var map = {
    'id_card': 'identity', 'hk_permit': 'identity', 'passport': 'identity', 'hk_id': 'identity', 'photo': 'identity',
    'degree_cert': 'education', 'transcript': 'education', 'degree_auth': 'education', 'language_cert': 'education',
    'emp_letter': 'work', 'emp_proof': 'work', 'reference_letter': 'work', 'recommendation': 'work',
    'salary_proof': 'work', 'org_chart': 'work', 'emp_3y': 'work',
    'bank_statement': 'assets', 'tax_record': 'assets', 'income_250w': 'assets', 'income_proof': 'assets', 'company_docs': 'assets',
    'visa_label': 'approved', 'approval': 'approved', 'plan_statement': 'approved', 'student_visa': 'approved', 'hk_visa': 'approved',
    'no_crime': 'approved'
  };
  return map[slotKey] || '';
}
