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
    privacyMode: 'local',

    // Bug #12修复: 隐私覆盖条根据证件类型动态渲染
    privacyBars: [],
    _currentDocType: '',
    _slotKey: '',
    _slotDocName: '',
    _slotGuideId: '',
    _rotateDeg: 0
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
    // Bug #25: 计划书等文字类卡槽 → 默认手动录入
    if (options.slotKey === 'plan_statement') {
      this.setData({ inputMode: 'manual', step: 1, docCategory: 'approved' });
    }
    // Bug #12: 根据slotKey/docType设置对应的PII遮挡条
    this.setData({
      privacyMode: app.getPrivacyMode(),
      privacyBars: getPrivacyBars('', this._slotKey || '')
    });
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

  /** 确认图片 → Bug #8: 应用旋转+缩放变换后再推进步骤 */
  async confirmImage() {
    var qr = this.data.qualityResult;
    // Bug #6 修复: 质量检测未完成时阻断，防止跳过质检
    if (!qr) {
      wx.showToast({ title: '质量检测中，请稍候…', icon: 'none', duration: 1500 });
      return;
    }
    if (qr && !qr.pass) {
      wx.showModal({
        title: '照片质量不通过',
        content: '检测到以下问题：\n' + qr.issues.filter(function(i) { return i.severity === 'warning'; }).map(function(i) { return '• ' + i.message; }).join('\n') + '\n\n请重新拍摄以获得更好的识别效果。',
        showCancel: false,
        confirmText: '重新拍摄',
        success: (function(res) {
          this.retakePhoto();
        }).bind(this)
      });
      return;
    }

    // Bug #8: 应用旋转变换（canvas像素级，Canvas 2D 优先，Old API 降级）
    var imagePath = this.data.imagePath;
    var rotateDeg = this._rotateDeg || 0;
    if (rotateDeg > 0) {
      wx.showLoading({ title: '处理中...' });
      try {
        var imgProc = require('../../../utils/image-process');
        var rotatedPath = await imgProc.rotateImage(imagePath, rotateDeg);
        var finalPath = await imgProc.resizeImage(rotatedPath, 2048, 2048);
        wx.hideLoading();
        this._rotateDeg = 0;
        this.setData({ imagePath: finalPath, imageRotated: 0, step: 4, docType: 'unknown', docTypeLabel: '手动录入' });
      } catch (e) {
        wx.hideLoading();
        wx.showToast({ title: '图片处理失败，请重试', icon: 'none' });
        console.warn('[Bug#8] confirmImage 旋转/缩放失败:', e);
      }
    } else {
      // 无需旋转，直接进分类选择（跳过step 3确认环节）
      this.setData({ step: 4, docType: 'unknown', docTypeLabel: '手动录入' });
    }
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
  async confirmCrop() {
    wx.showLoading({ title: '处理中...' });
    var imgProc = require('../../../utils/image-process');
    var imagePath = this.data.imagePath;
    // Bug #8: 先旋转，再裁剪，最后缩放
    var rotateDeg = this._rotateDeg || 0;
    try {
      var p = rotateDeg > 0 ? await imgProc.rotateImage(imagePath, rotateDeg) : imagePath;
      p = await imgProc.cropImage(p, 0.05, 0.08, 0.90, 0.84);
      var finalPath = await imgProc.resizeImage(p, 2048, 2048);
      wx.hideLoading();
      this._rotateDeg = 0;
      this.setData({ imagePath: finalPath, imageRotated: 0, step: 3, docType: 'unknown', docTypeLabel: '手动录入' });
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '裁切处理失败，请重试', icon: 'none' });
      console.warn('[Bug#8] confirmCrop 处理失败:', e);
    }
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

  /** Step3 → Step4: 确认OCR结果，进入分类选择。卡槽入口自动跳过 */
  confirmAndProceed() {
    var ocrFields = this.data.ocrFields;
    // Bug #19 修复: 卡槽入口+auto-cat已确定 → 直接保存，跳过Step4分类选择
    if (this.data.skipCategory && this.data.docCategory) {
      this.confirmSave();
      return;
    }
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

  // ===== Bug #5+#8: 旋转+扫描件工具栏 =====

  /** 顺时针旋转90° — Bug #8: 存储旋转角度，confirmImage 时通过 canvas 实际旋转像素 */
  onRotateImage() {
    var currentDeg = this._rotateDeg || 0;
    var newDeg = (currentDeg + 90) % 360;
    this._rotateDeg = newDeg;
    // CSS 预览旋转（视觉反馈，最终像素旋转在 confirmImage 中）
    this.setData({ imageRotated: newDeg });
    wx.showToast({ title: '已旋转 ' + newDeg + '°', icon: 'none', duration: 800 });
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
    // Bug #12: 按证件类型设置隐私覆盖条
    var overlay = DOC_PRIVACY_OVERLAY[value] || DOC_PRIVACY_OVERLAY['id_card'];
    this.setData({ freeDocType: value, freeDocGuide: guide, privacyBars: overlay.bars, _currentDocType: value });
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

    // 直接保存，跳过授权弹窗
    this.doActualSave(docCategory, ocrFields, manualForm, imagePath, docType);
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
    // 身份证 — 双面模板：人像面+国徽面 (85.6×54mm CR80标准)
    id_card: { icon: '🪪', title: '身份证材料标准', wfTitle: '中华人民共和国居民身份证', items: [
      '正反面均需拍摄，四角完整可见',
      '平放深色桌面，正对拍摄，不倾斜',
      '确保证件号、姓名、照片清晰可读',
      '勿使用复印件或屏幕截图',
      '圆角边框不得裁切或遮挡'
    ], piiFields: ['姓名', '身份证号', '出生日期', '地址'], specimen: '人像面+国徽面·无反光·圆角完整',
    wfFields: [
      { label: '姓名', width: 'long', pii: true },
      { label: '性别', width: 'short', pii: false },
      { label: '民族', width: 'short', pii: false },
      { label: '出生日期', width: 'long', pii: true },
      { label: '住址', width: 'full', pii: true },
      { label: '公民身份号码', width: 'long', pii: true },
      { label: '签发机关', width: 'mid', pii: false },
      { label: '有效期限', width: 'long', pii: false }
    ], showPhoto: true, showSeal: false },
    // 学位证 — A4(210×297mm)防伪水印纸, 16位编号, 2寸彩照+钢印
    degree: { icon: '🎓', title: '学位证/毕业证材料标准', wfTitle: '学士学位证书 (A4防伪纸)', items: [
      '证书原件彩色拍摄(A4幅面)，不可拍摄复印件',
      '16位证书编号(前5位学校代码+4位年份+7位序号)',
      '2寸彩色照片+学校钢印骑缝章清晰',
      '专业全称、学科门类(如工学学士)',
      '海外学历需同时拍摄留服认证'
    ], piiFields: ['姓名', '证书编号', '出生日期'], specimen: '学位证正面·钢印+校长签名',
    wfFields: [
      { label: '学位证书编号 (16位)', width: 'long', pii: true },
      { label: '姓名 (与身份证一致)', width: 'short', pii: true },
      { label: '性别 / 出生日期', width: 'mid', pii: true },
      { label: '专业名称 / 学科门类', width: 'full', pii: false },
      { label: '学位授予单位 (全称)', width: 'full', pii: false },
      { label: '校长签名 / 授予日期', width: 'mid', pii: false },
      { label: '2寸彩照 / 钢印骑缝', width: 'short', pii: false }
    ], showPhoto: true, showSeal: true },
    // 港澳通行证 — 卡式电子版 (85.6×54mm, 长城背景, 正面照片左·信息右)
    hk_permit: { icon: '🛂', title: '港澳通行证材料标准', wfTitle: '往来港澳通行证 (卡式电子版)', items: [
      '个人信息页+签注页(背面)均需拍摄',
      '证件号（C开头8位数字）清晰可见',
      '签注页显示D逗留签注类型和有效期',
      '长城背景底纹、防伪膜反光从侧面打光'
    ], piiFields: ['姓名', '证件号', '出生日期', '有效期'], specimen: '通行证正面个人信息页+背面签注页',
    wfFields: [
      { label: '姓名 (中文)', width: 'short', pii: true },
      { label: '姓名 (拼音)', width: 'long', pii: true },
      { label: '通行证号码', width: 'mid', pii: true },
      { label: '出生日期', width: 'mid', pii: true },
      { label: '有效期限', width: 'mid', pii: false },
      { label: '签发机关 / 签发地', width: 'mid', pii: false },
      { label: '签注类型 / 逗留条件 (背面)', width: 'full', pii: false }
    ], showPhoto: true, showSeal: false },
    // 护照 — 电子护照 (125×88mm, 第2页资料页, 照片左·牡丹花激光防伪·MRZ底)
    passport: { icon: '🛂', title: '护照材料标准', wfTitle: '中华人民共和国护照 (资料页第2页)', items: [
      '资料页(第2页)完整拍摄，含照片、护照号',
      '护照号为E开头+字母+7位数字',
      '防伪膜含天安门+五星图案，从侧面打光',
      'MRZ机读码两行在底部，不可裁切'
    ], piiFields: ['姓名', '护照号', '出生日期', '出生地点'], specimen: '护照第2页资料页·牡丹花防伪',
    wfFields: [
      { label: '类型P / 国家码CHN', width: 'short', pii: false },
      { label: '护照号 (E+8位)', width: 'mid', pii: true },
      { label: '姓名 (中文/拼音)', width: 'full', pii: true },
      { label: '性别 / 国籍', width: 'short', pii: false },
      { label: '出生日期 / 出生地点', width: 'full', pii: true },
      { label: '签发日期 / 有效期至', width: 'full', pii: false },
      { label: '签发机关', width: 'mid', pii: false },
      { label: 'MRZ机读码 (底部)', width: 'full', pii: false }
    ], showPhoto: true, showSeal: false },
    // 香港身份证 — 2018版(照片左置·右侧激光影像·透明窗口)
    hk_id: { icon: '🆔', title: '香港身份证材料标准', wfTitle: '香港永久性居民身份证 (2018版)', items: [
      '正面拍摄，四角完整',
      '证件号（字母+6位数字+括号校验码）清晰',
      '照片在左侧(黑白ICAO标准)、姓名/出生日期在右侧',
      '全息图/透明窗口可见、无遮挡'
    ], piiFields: ['姓名', '身份证号', '出生日期'], specimen: '香港身份证正面·照片左置·彩色',
    wfFields: [
      { label: '姓名 (中文)', width: 'mid', pii: true },
      { label: '姓名 (英文)', width: 'long', pii: true },
      { label: '身份证号码 (含校验码)', width: 'long', pii: true },
      { label: '出生日期', width: 'mid', pii: true },
      { label: '签发日期', width: 'mid', pii: false },
      { label: '符号标记 (***AZ 等)', width: 'short', pii: false }
    ], showPhoto: true, showSeal: false },
    // 户口本 — 首页+户主页+本人页 (28个登记项目)
    household: { icon: '📖', title: '户口本材料标准', wfTitle: '居民户口簿 (首页+户主页+本人页)', items: [
      '首页(扉页)+户主页(常住人口登记卡)+本人页均需拍摄',
      '首页: 户别/户号/户主姓名/住址/两个公章',
      '本人页: 姓名/与户主关系/身份证号/籍贯/出生地等28项',
      '户口登记机关(派出所)印章清晰可见'
    ], piiFields: ['姓名', '身份证号', '住址', '籍贯'], specimen: '首页+户主页+本人页·印章清晰',
    wfFields: [
      { label: '户别 (首页)', width: 'short', pii: false },
      { label: '户号 (首页)', width: 'mid', pii: false },
      { label: '户主姓名 (首页)', width: 'short', pii: true },
      { label: '住址 (首页)', width: 'full', pii: true },
      { label: '本人姓名 (本人页)', width: 'short', pii: true },
      { label: '与户主关系 (本人页)', width: 'short', pii: false },
      { label: '公民身份号码', width: 'long', pii: true },
      { label: '登记机关 / 签发日期', width: 'mid', pii: false }
    ], showPhoto: false, showSeal: true },
    // 结婚证 — 188×128mm封皮, 证芯195×135mm, 双页展开, 持证人每本不同
    marriage: { icon: '💍', title: '结婚证材料标准', wfTitle: '中华人民共和国结婚证 (双页展开)', items: [
      '双页全展开拍摄，四角完整不留白',
      '结婚证字号(J开头)清晰，含行政区划代码',
      '双方姓名、出生日期、身份证号清晰',
      '合影照片+钢印骑缝章可见',
      '登记机关红色印章+婚姻登记员亲笔签名'
    ], piiFields: ['双方姓名', '证件号', '登记日期', '出生日期'], specimen: '双页展开·钢印骑缝·红印清晰',
    wfFields: [
      { label: '持证人 (男/女)', width: 'short', pii: true },
      { label: '登记日期', width: 'mid', pii: false },
      { label: '结婚证字号', width: 'long', pii: true },
      { label: '双方姓名 / 出生日期', width: 'full', pii: true },
      { label: '双方身份证号码', width: 'full', pii: true },
      { label: '登记机关 (红印)', width: 'mid', pii: false },
      { label: '婚姻登记员签名', width: 'short', pii: false }
    ], showPhoto: true, showSeal: true },
    // 出生证 — 第七版(2023.4.1启用)正页+副页, 字母+9位条形码编号
    birth_cert: { icon: '👶', title: '出生证材料标准', wfTitle: '出生医学证明 (第七版·正页+副页)', items: [
      '正页+副页完整拍摄(不可撕切,副页由派出所裁切)',
      '婴儿姓名(规范汉字)、性别、出生时间(精确到分)',
      '出生医学证明编号(字母+9位条形码,黄色底)',
      '父母姓名+身份证号、签发机构+专用章(红色)'
    ], piiFields: ['婴儿姓名', '父母姓名', '身份证号', '出生日期'], specimen: '正页+副页·红色印章·条形码清晰',
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

    // ═══ Bug #24: 新增30种卡槽专属指南 ═══
    // 学历类
    transcript: { icon: '📄', title: '成绩单材料标准', wfTitle: '学业成绩单', items: [
      '学校官方成绩单原件拍摄',
      '含学校抬头、学生姓名、学号',
      '所有学期/学年成绩完整',
      '学校教务处印章清晰',
      '英文版需一并提供'
    ], piiFields: ['姓名', '学号'], specimen: '学校抬头·教务处盖章',
    wfFields: [
      { label: '学校名称 (抬头)', width: 'full', pii: false },
      { label: '学生姓名', width: 'short', pii: true },
      { label: '学号', width: 'mid', pii: true },
      { label: '专业 / 学院', width: 'mid', pii: false },
      { label: '成绩列表', width: 'full', pii: false },
      { label: '教务处印章 / 日期', width: 'mid', pii: false }
    ], showPhoto: false, showSeal: true },
    degree_auth: { icon: '🔖', title: '学信网认证材料标准', wfTitle: '学信网学历认证报告', items: [
      '学信网生成的认证报告PDF/截图',
      '报告编号和验证码清晰',
      '含学位信息、毕业院校、专业',
      '在线验证报告有效期需在有效期内'
    ], piiFields: ['姓名', '证书编号'], specimen: '学信网学历认证报告',
    wfFields: [
      { label: '报告编号', width: 'long', pii: false },
      { label: '姓名', width: 'short', pii: true },
      { label: '毕业院校', width: 'full', pii: false },
      { label: '专业 / 学历层次', width: 'mid', pii: false },
      { label: '入学/毕业日期', width: 'mid', pii: false },
      { label: '验证码', width: 'mid', pii: false }
    ], showPhoto: true, showSeal: true },
    language_cert: { icon: '🗣️', title: '语言成绩材料标准', wfTitle: '语言能力证明', items: [
      '官方成绩单原件拍摄（IELTS/TOEFL/HSK等）',
      '考生姓名、考试日期、分数清晰',
      '证书编号完整可见'
    ], piiFields: ['姓名', '考生编号'], specimen: '语言成绩单原件',
    wfFields: [
      { label: '考试机构', width: 'mid', pii: false },
      { label: '考生姓名', width: 'short', pii: true },
      { label: '考生编号', width: 'mid', pii: true },
      { label: '考试日期', width: 'mid', pii: false },
      { label: '总分 / 各科分数', width: 'full', pii: false },
      { label: '证书编号 / 验证码', width: 'long', pii: false }
    ], showPhoto: false, showSeal: true },
    admission_letter: { icon: '📨', title: '录取通知书材料标准', wfTitle: '录取通知书', items: [
      '学校官方录取通知书原件',
      '含学校抬头、学生姓名、录取专业',
      '入学日期和学制清晰',
      '学校印章/签发人签字'
    ], piiFields: ['姓名', '申请编号'], specimen: '学校抬头·官方印章',
    wfFields: [
      { label: '学校名称 (抬头)', width: 'full', pii: false },
      { label: '学生姓名', width: 'short', pii: true },
      { label: '录取专业 / 学位', width: 'mid', pii: false },
      { label: '入学日期 / 学制', width: 'mid', pii: false },
      { label: '申请编号', width: 'long', pii: true },
      { label: '学校印章 / 签发人', width: 'mid', pii: false }
    ], showPhoto: false, showSeal: true },
    exchange_agreement: { icon: '🌐', title: '交换协议材料标准', wfTitle: '交换/交流项目协议', items: [
      '双方学校签署的交换协议原件',
      '含交换期间、学分互认条款',
      '双方学校印章清晰'
    ], piiFields: ['姓名', '学号'], specimen: '双方学校盖章',
    wfFields: [
      { label: '派出学校 (抬头)', width: 'full', pii: false },
      { label: '接收学校', width: 'full', pii: false },
      { label: '学生姓名 / 学号', width: 'mid', pii: true },
      { label: '交换期间', width: 'mid', pii: false },
      { label: '学分互认条款', width: 'full', pii: false },
      { label: '双方印章', width: 'mid', pii: false }
    ], showPhoto: false, showSeal: true },
    parttime_enrollment: { icon: '📚', title: '兼读在读证明标准', wfTitle: '兼读课程在读证明', items: [
      '学校出具的在读证明原件',
      '含学校抬头、学生姓名、攻读学位',
      '注明兼读制（Part-time）',
      '学校印章清晰'
    ], piiFields: ['姓名', '学号'], specimen: '学校抬头·注明兼读制',
    wfFields: [
      { label: '学校名称 (抬头)', width: 'full', pii: false },
      { label: '学生姓名', width: 'short', pii: true },
      { label: '攻读学位 / 专业', width: 'mid', pii: false },
      { label: '就读状态 (兼读制)', width: 'mid', pii: false },
      { label: '入学日期 / 预计毕业', width: 'full', pii: false },
      { label: '教务处印章', width: 'mid', pii: false }
    ], showPhoto: false, showSeal: true },
    // 工作类
    emp_letter: { icon: '📝', title: '雇主聘用书材料标准', wfTitle: '雇主聘用书 / 雇佣合约', items: [
      '公司抬头纸原件拍摄',
      '含职位、入职日期、薪资、工作职责',
      '雇主签字+公司盖章',
      '注明雇佣性质（全职/合约）'
    ], piiFields: ['姓名', '身份证号', '薪资'], specimen: '公司抬头纸·公章+签字',
    wfFields: [
      { label: '公司名称 (抬头)', width: 'full', pii: false },
      { label: '员工姓名', width: 'short', pii: true },
      { label: '职位 / 部门', width: 'mid', pii: false },
      { label: '入职日期 / 合约期', width: 'mid', pii: false },
      { label: '月薪 / 年薪', width: 'mid', pii: true },
      { label: '公司印章 / 签字', width: 'mid', pii: false }
    ], showPhoto: false, showSeal: true },
    emp_proof: { icon: '📋', title: '工作证明信材料标准', wfTitle: '工作证明信', items: [
      '公司抬头纸原件',
      '注明在职期间、职位、工作内容',
      '人力资源部门或直属上级签字盖章',
      '含公司联系方式以便核实'
    ], piiFields: ['姓名', '身份证号'], specimen: '公司抬头纸·HR盖章',
    wfFields: [
      { label: '公司名称 (抬头)', width: 'full', pii: false },
      { label: '员工姓名', width: 'short', pii: true },
      { label: '身份证号码', width: 'long', pii: true },
      { label: '在职期间 / 职位', width: 'mid', pii: false },
      { label: '工作内容简述', width: 'full', pii: false },
      { label: 'HR部门印章 / 日期', width: 'mid', pii: false }
    ], showPhoto: false, showSeal: true },
    emp_3y: { icon: '📊', title: '三年工作经验证明标准', wfTitle: '三年工作经验证明', items: [
      '覆盖最近三年全部在职期间',
      '如有多个雇主需分别提供',
      '每段工作需注明起止日期和职位',
      '社保记录/税单可作为辅助证明'
    ], piiFields: ['姓名', '身份证号'], specimen: '连续三年工作记录',
    wfFields: [
      { label: '员工姓名', width: 'short', pii: true },
      { label: '身份证号码', width: 'long', pii: true },
      { label: '雇主名称 (第一段)', width: 'full', pii: false },
      { label: '起止日期 / 职位', width: 'mid', pii: false },
      { label: '社保/税务辅助证明', width: 'full', pii: false },
      { label: '累计年限', width: 'short', pii: false }
    ], showPhoto: false, showSeal: true },
    recommendation: { icon: '✉️', title: '推荐信材料标准', wfTitle: '专家推荐信', items: [
      '推荐人抬头纸或有推荐人联系方式',
      '详述申请人专业能力和成就',
      '推荐人签字+日期',
      '推荐人名片或联系方式可验证'
    ], piiFields: ['申请人姓名', '推荐人姓名'], specimen: '推荐人签字·含联系方式',
    wfFields: [
      { label: '推荐人姓名 / 职位', width: 'mid', pii: true },
      { label: '申请人姓名', width: 'short', pii: true },
      { label: '推荐人与申请人关系', width: 'mid', pii: false },
      { label: '推荐内容详述', width: 'full', pii: false },
      { label: '推荐人联系方式', width: 'full', pii: true },
      { label: '签字 / 日期', width: 'mid', pii: false }
    ], showPhoto: false, showSeal: false },
    company_docs: { icon: '🏢', title: '公司注册文件标准', wfTitle: '公司注册证明书', items: [
      '公司注册处发出的注册证明书',
      '商业登记证清晰拍摄',
      '公司名称、注册编号、成立日期清晰',
      '如有公司章程一并提供'
    ], piiFields: ['公司编号', '董事姓名'], specimen: '公司注册处·商业登记证',
    wfFields: [
      { label: '公司名称 (中/英)', width: 'full', pii: false },
      { label: '公司注册编号', width: 'mid', pii: true },
      { label: '成立日期', width: 'mid', pii: false },
      { label: '公司类别', width: 'short', pii: false },
      { label: '注册地址', width: 'full', pii: false },
      { label: '公司注册处印章', width: 'mid', pii: false }
    ], showPhoto: false, showSeal: true },
    org_chart: { icon: '📐', title: '组织架构图标准', wfTitle: '公司组织架构图', items: [
      '公司官方组织架构图',
      '标明申请人所属部门及层级',
      '如有公司印章更佳',
      '中英文版本均可'
    ], piiFields: ['申请人姓名', '部门'], specimen: '公司组织架构图',
    wfFields: [
      { label: '公司名称', width: 'full', pii: false },
      { label: '申请人姓名 / 职位', width: 'mid', pii: true },
      { label: '所属部门', width: 'mid', pii: false },
      { label: '汇报层级', width: 'full', pii: false },
      { label: '下属人数', width: 'short', pii: false },
      { label: '签发日期 / 版本', width: 'mid', pii: false }
    ], showPhoto: false, showSeal: false },
    tech_achievement: { icon: '🏆', title: '科技成果/专利证明标准', wfTitle: '科技成果 / 专利证书', items: [
      '专利证书/科技奖励证书原件',
      '专利权人/获奖人姓名清晰',
      '专利号/证书编号完整',
      '授权日期和有效期'
    ], piiFields: ['专利人姓名', '专利号'], specimen: '专利证书·授权日期',
    wfFields: [
      { label: '专利/成果名称', width: 'full', pii: false },
      { label: '专利号 / 证书编号', width: 'long', pii: true },
      { label: '专利权人 / 获奖人', width: 'mid', pii: true },
      { label: '授权日期', width: 'mid', pii: false },
      { label: '有效期', width: 'mid', pii: false },
      { label: '授权机关印章', width: 'mid', pii: false }
    ], showPhoto: false, showSeal: true },
    // 资产类
    income_proof: { icon: '📊', title: '收入证明标准', wfTitle: '个人收入证明', items: [
      '公司或税务机关出具的收入证明',
      '含姓名、身份证号、收入金额',
      '时间段明确（最近6-12个月）',
      '公司盖章或税务印章'
    ], piiFields: ['姓名', '身份证号', '收入金额'], specimen: '公司/税务机关出具',
    wfFields: [
      { label: '出具机构 (抬头)', width: 'full', pii: false },
      { label: '姓名', width: 'short', pii: true },
      { label: '身份证号码', width: 'long', pii: true },
      { label: '收入时间段', width: 'mid', pii: false },
      { label: '总收入 / 月收入', width: 'mid', pii: true },
      { label: '机构印章 / 日期', width: 'mid', pii: false }
    ], showPhoto: false, showSeal: true },
    tax_record: { icon: '📑', title: '税单材料标准', wfTitle: '个人所得税完税证明', items: [
      '税务机关出具的完税证明',
      '最近1-3个纳税年度',
      '含纳税人姓名和身份证号',
      '税务印章清晰'
    ], piiFields: ['姓名', '身份证号'], specimen: '税务局出具·完税证明',
    wfFields: [
      { label: '税务机关名称', width: 'full', pii: false },
      { label: '纳税人姓名', width: 'short', pii: true },
      { label: '身份证号码', width: 'long', pii: true },
      { label: '纳税年度', width: 'short', pii: false },
      { label: '应纳税所得额', width: 'mid', pii: true },
      { label: '税务印章 / 日期', width: 'mid', pii: false }
    ], showPhoto: false, showSeal: true },
    income_250w: { icon: '💵', title: '年收入250万证明标准', wfTitle: '年收入证明 (≥250万港币)', items: [
      '最近一个完整纳税年度的收入证明',
      '公司薪资证明+银行流水+税单三件套',
      '收入金额需对应当年度港币≥250万',
      '各文件收入数据需一致'
    ], piiFields: ['姓名', '年收入金额'], specimen: '薪资证明+银行流水+税单·三件一致',
    wfFields: [
      { label: '姓名', width: 'short', pii: true },
      { label: '身份证号码', width: 'long', pii: true },
      { label: '年度', width: 'short', pii: false },
      { label: '年收入总额 (港币)', width: 'mid', pii: true },
      { label: '薪资/奖金/股权分解', width: 'full', pii: false },
      { label: '公司/税务印章', width: 'mid', pii: false }
    ], showPhoto: false, showSeal: true },
    investment_proof: { icon: '📈', title: '投资证明标准', wfTitle: '投资资产证明', items: [
      '证券公司/银行出具的投资资产证明',
      '含账户名、资产类型、估值',
      '最近日期的资产报告',
      '金融机构印章'
    ], piiFields: ['账户名', '账号'], specimen: '金融机构出具·近期估值',
    wfFields: [
      { label: '金融机构名称', width: 'full', pii: false },
      { label: '账户持有人', width: 'short', pii: true },
      { label: '账号', width: 'long', pii: true },
      { label: '资产类型 / 估值', width: 'full', pii: false },
      { label: '报告日期', width: 'mid', pii: false },
      { label: '机构印章', width: 'mid', pii: false }
    ], showPhoto: false, showSeal: true },
    asset_proof: { icon: '🏠', title: '资产证明标准', wfTitle: '个人资产证明 (存款/房产)', items: [
      '银行存款证明或房产证',
      '含持有人姓名、资产价值',
      '银行/房管局官方文件',
      '存款证明需冻结期≥3个月'
    ], piiFields: ['持有人', '账号/房产证号'], specimen: '银行/房管局官方文件',
    wfFields: [
      { label: '出具机构', width: 'full', pii: false },
      { label: '资产持有人', width: 'short', pii: true },
      { label: '账号 / 房产证号', width: 'long', pii: true },
      { label: '资产估值 / 币种', width: 'mid', pii: false },
      { label: '证明日期', width: 'mid', pii: false },
      { label: '机构印章', width: 'mid', pii: false }
    ], showPhoto: false, showSeal: true },
    retirement_fund: { icon: '🏦', title: '退休金证明标准', wfTitle: '退休金/强积金证明', items: [
      'MPF强积金或社保退休金证明',
      '含姓名、账户信息、累积金额',
      '最近日期的账户报告'
    ], piiFields: ['姓名', '账户号'], specimen: '强积金/社保·近期报告',
    wfFields: [
      { label: '管理机构名称', width: 'full', pii: false },
      { label: '持有人姓名', width: 'short', pii: true },
      { label: '账户号码', width: 'mid', pii: true },
      { label: '累积金额 / 币种', width: 'mid', pii: false },
      { label: '报告日期', width: 'mid', pii: false },
      { label: '机构印章', width: 'mid', pii: false }
    ], showPhoto: false, showSeal: true },
    pension_proof: { icon: '📋', title: '养老金证明标准', wfTitle: '养老金/社保领取证明', items: [
      '社保局出具的养老金领取证明',
      '含姓名、领取金额、发放记录',
      '最近6-12个月发放记录'
    ], piiFields: ['姓名', '身份证号'], specimen: '社保局出具·近期记录',
    wfFields: [
      { label: '社保局名称', width: 'full', pii: false },
      { label: '领取人姓名', width: 'short', pii: true },
      { label: '身份证号码', width: 'long', pii: true },
      { label: '月领取金额', width: 'mid', pii: false },
      { label: '发放时间段', width: 'mid', pii: false },
      { label: '社保局印章', width: 'mid', pii: false }
    ], showPhoto: false, showSeal: true },
    funding_proof: { icon: '💳', title: '资金来源说明标准', wfTitle: '资金来源说明', items: [
      '说明资产来源的书面文件',
      '如有银行转账记录一并提供',
      '注明金额、来源途径、用途',
      '本人签字+日期'
    ], piiFields: ['姓名', '账户号'], specimen: '书面说明·本人签字',
    wfFields: [
      { label: '声明人姓名', width: 'short', pii: true },
      { label: '资金来源途径', width: 'full', pii: false },
      { label: '金额 / 币种', width: 'mid', pii: false },
      { label: '用途说明', width: 'full', pii: false },
      { label: '银行流水附页', width: 'full', pii: false },
      { label: '签字 / 日期', width: 'mid', pii: false }
    ], showPhoto: false, showSeal: false },
    // 申请材料类
    plan_statement: { icon: '📝', title: '赴港计划书 (文字撰写)', wfTitle: '赴港计划书', items: [
      '此为文字撰写类材料，非上传文件',
      '内容：来港目的、职业规划、对港贡献',
      '建议800-1500字，分段撰写',
      '具名+日期'
    ], piiFields: ['姓名'], specimen: '文字撰写·800-1500字',
    wfFields: [
      { label: '姓名 / 日期', width: 'short', pii: true },
      { label: '来港目的', width: 'full', pii: false },
      { label: '职业规划', width: 'full', pii: false },
      { label: '对港贡献预期', width: 'full', pii: false },
      { label: '在港安居计划', width: 'full', pii: false },
      { label: '本人签字', width: 'mid', pii: false }
    ], showPhoto: false, showSeal: false },
    no_crime: { icon: '🛡️', title: '无犯罪记录证明标准', wfTitle: '无犯罪记录证明', items: [
      '户籍所在地公安局/派出所出具',
      '含姓名、身份证号、无犯罪记录声明',
      '有效期一般为6个月',
      '公安机关印章清晰'
    ], piiFields: ['姓名', '身份证号'], specimen: '公安机关出具·6个月有效',
    wfFields: [
      { label: '出具机关名称', width: 'full', pii: false },
      { label: '申请人姓名', width: 'short', pii: true },
      { label: '身份证号码', width: 'long', pii: true },
      { label: '证明内容', width: 'full', pii: false },
      { label: '有效期至', width: 'mid', pii: false },
      { label: '公安机关印章 / 日期', width: 'mid', pii: false }
    ], showPhoto: false, showSeal: true },
    student_visa: { icon: '🎫', title: '学生签证材料标准', wfTitle: '学生签证 / 入境许可', items: [
      '入境处发出的学生签证标签/通知书',
      '含学校名称、课程名称、签证有效期',
      '签证编号清晰',
      '如有e-Visa打印版一并提供'
    ], piiFields: ['姓名', '签证编号', '学校'], specimen: '入境处学生签证标签',
    wfFields: [
      { label: '签证编号', width: 'long', pii: true },
      { label: '学生姓名', width: 'short', pii: true },
      { label: '学校 / 课程名称', width: 'full', pii: false },
      { label: '签证有效期', width: 'mid', pii: false },
      { label: '逗留条件', width: 'full', pii: false },
      { label: '入境处印章', width: 'mid', pii: false }
    ], showPhoto: false, showSeal: true },
    // 关系/保证人/监护人类
    sponsor_id: { icon: '🪪', title: '保证人身份证标准', wfTitle: '保证人身份证明文件', items: [
      '保证人身份证/护照原件拍摄',
      '姓名、证件号、有效期清晰',
      '如非香港居民需同时提供签证页'
    ], piiFields: ['保证人姓名', '证件号'], specimen: '保证人身份证·正面',
    wfFields: [
      { label: '保证人姓名', width: 'short', pii: true },
      { label: '证件号码', width: 'long', pii: true },
      { label: '证件类型', width: 'short', pii: false },
      { label: '有效期', width: 'mid', pii: false },
      { label: '与申请人关系', width: 'mid', pii: false },
      { label: '签发机关', width: 'mid', pii: false }
    ], showPhoto: true, showSeal: false },
    sponsor_income: { icon: '💰', title: '保证人收入证明标准', wfTitle: '保证人收入证明', items: [
      '保证人最近6-12个月收入证明',
      '含姓名、收入金额、时间段',
      '公司抬头+盖章或税务机关出具'
    ], piiFields: ['保证人姓名', '收入金额'], specimen: '保证人收入证明',
    wfFields: [
      { label: '出具机构 (抬头)', width: 'full', pii: false },
      { label: '保证人姓名', width: 'short', pii: true },
      { label: '收入时间段', width: 'mid', pii: false },
      { label: '月/年收入金额', width: 'mid', pii: true },
      { label: '职位 / 工作单位', width: 'full', pii: false },
      { label: '机构印章 / 日期', width: 'mid', pii: false }
    ], showPhoto: false, showSeal: true },
    sponsor_employment: { icon: '💼', title: '保证人在职证明标准', wfTitle: '保证人在职证明', items: [
      '保证人雇主出具的在职证明',
      '含职位、在职期间、工作性质',
      '公司抬头纸+盖章+签字'
    ], piiFields: ['保证人姓名', '公司名'], specimen: '公司抬头·公章+签字',
    wfFields: [
      { label: '公司名称 (抬头)', width: 'full', pii: false },
      { label: '保证人姓名', width: 'short', pii: true },
      { label: '职位 / 部门', width: 'mid', pii: false },
      { label: '在职期间', width: 'mid', pii: false },
      { label: '工作性质 (全职/合约)', width: 'short', pii: false },
      { label: '公司印章 / 签字', width: 'mid', pii: false }
    ], showPhoto: false, showSeal: true },
    guardian_id: { icon: '🪪', title: '监护人身份证标准', wfTitle: '监护人身份证明文件', items: [
      '监护人身份证/护照原件拍摄',
      '姓名、证件号、有效期清晰',
      '需可证明监护关系（如户口本/公证书）'
    ], piiFields: ['监护人姓名', '证件号'], specimen: '监护人身份证·正面',
    wfFields: [
      { label: '监护人姓名', width: 'short', pii: true },
      { label: '证件号码', width: 'long', pii: true },
      { label: '证件类型', width: 'short', pii: false },
      { label: '有效期', width: 'mid', pii: false },
      { label: '与申请人关系', width: 'mid', pii: false },
      { label: '签发机关', width: 'mid', pii: false }
    ], showPhoto: true, showSeal: false },
    guardian_consent: { icon: '📄', title: '监护人同意书标准', wfTitle: '监护人同意书 / 监护权证明', items: [
      '法定监护人签署的同意书',
      '明确同意未成年人在港学习/居留',
      '含监护人姓名、联系方式、签字',
      '如有监护权判决书/公证书一并提供'
    ], piiFields: ['监护人姓名', '未成年人姓名'], specimen: '监护人签字·含联系方式',
    wfFields: [
      { label: '监护人姓名', width: 'short', pii: true },
      { label: '未成年人姓名', width: 'short', pii: true },
      { label: '监护关系', width: 'mid', pii: false },
      { label: '同意事项说明', width: 'full', pii: false },
      { label: '监护人联系方式', width: 'full', pii: true },
      { label: '签字 / 日期', width: 'mid', pii: false }
    ], showPhoto: false, showSeal: false },
    guardian_income: { icon: '💰', title: '监护人收入证明标准', wfTitle: '监护人经济能力证明', items: [
      '监护人最近6-12个月收入/资产证明',
      '含姓名、收入金额、时间段',
      '可提供薪资证明+银行流水'
    ], piiFields: ['监护人姓名', '收入金额'], specimen: '收入证明+银行流水',
    wfFields: [
      { label: '出具机构 (抬头)', width: 'full', pii: false },
      { label: '监护人姓名', width: 'short', pii: true },
      { label: '收入/资产类型', width: 'mid', pii: false },
      { label: '月/年收入金额', width: 'mid', pii: true },
      { label: '时间段', width: 'mid', pii: false },
      { label: '机构印章 / 日期', width: 'mid', pii: false }
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

  // Bug #11: slotKey → guide key 别名映射（卡槽key和指引key不一致时）
  var keyAliases = {
    'degree_cert': 'degree', 'emp_proof': 'work', 'recommendation': 'emp_letter',
    'income_proof': 'income_250w', 'bank_statement': 'bank', 'income_250w': 'income_250w',
    'tax_record': 'income_250w', 'plan_statement': 'plan_statement', 'no_crime': 'no_crime',
    'birth_cert': 'birth_cert', 'marriage_cert': 'marriage', 'household': 'household',
    'emp_letter': 'emp_letter', 'reference_letter': 'recommendation',
    'student_visa': 'student_visa', 'admission_letter': 'admission_letter',
    'language_cert': 'language_cert', 'org_chart': 'work', 'emp_3y': 'work',
    'company_docs': 'company_docs', 'tech_achievement': 'work',
    'salary_proof': 'income_250w', 'sponsor_id': 'id_card', 'sponsor_income': 'income_250w',
    'sponsor_employment': 'work', 'guardian_id': 'id_card', 'guardian_consent': 'approval',
    'guardian_income': 'income_250w', 'exchange_agreement': 'exchange_agreement',
    'parttime_enrollment': 'parttime_enrollment', 'degree_auth': 'degree_auth',
    'hk_permit': 'hk_permit', 'passport': 'passport', 'hk_id': 'hk_id',
    'approval': 'approval', 'visa_label': 'approval',
    'funding_proof': 'bank', 'investment_proof': 'income_250w', 'asset_proof': 'income_250w',
    'retirement_fund': 'income_250w', 'pension_proof': 'income_250w', 'photo': 'id_card'
  };
  var resolvedKey = keyAliases[slotKey] || slotKey;
  if (resolvedKey && guides[resolvedKey]) return guides[resolvedKey];

  // 模糊匹配: 根据docName关键词匹配到对应引导
  for (var key in guides) {
    if (name.indexOf(key.replace(/_/g, '')) >= 0 || name.indexOf(key) >= 0) return guides[key];
  }
  // slotKey 兜底匹配
  if (slotKey && guides[slotKey]) return guides[slotKey];
  return null;
}

/** Bug #2+#24: 自由模式证件类型→拍摄指引映射 (补全全部类型 + Bug #11 wfFields) */
function getFreeDocGuide(docType) {
  var guides = {
    id_card: { icon: '🪪', wfTitle: '中华人民共和国居民身份证', items: ['背景：深色桌面，白色背景', '人像：正面居中，头部在虚线框内', '国徽：背面国徽清晰，居中拍摄', '边距：四角留出5mm空白，勿裁切'], piiFields: ['姓名', '身份证号', '出生日期'], specimen: '人像面+国徽面·无反光·圆角完整', showPhoto: true, showSeal: false,
      wfFields: [
        { label: '姓名', width: 'short', pii: true },
        { label: '性别 / 民族', width: 'mid', pii: false },
        { label: '出生日期', width: 'mid', pii: true },
        { label: '住址', width: 'full', pii: true },
        { label: '公民身份号码', width: 'long', pii: true },
        { label: '签发机关', width: 'mid', pii: false },
        { label: '有效期限', width: 'mid', pii: false }
      ] },
    hk_permit: { icon: '🛂', wfTitle: '往来港澳通行证', items: ['背景：深色桌面', '信息页：个人信息+签注页完整', '边距：四角完整，勿裁切'], piiFields: ['姓名', '证件号', '有效期'], specimen: '个人信息页·无反光', showPhoto: true, showSeal: false,
      wfFields: [
        { label: '姓名', width: 'short', pii: true },
        { label: '通行证号码', width: 'long', pii: true },
        { label: '出生日期', width: 'mid', pii: true },
        { label: '签发机关', width: 'mid', pii: false },
        { label: '签发日期 / 有效期限', width: 'full', pii: false },
        { label: '签注类型 / 逗留条件', width: 'mid', pii: false }
      ] },
    passport: { icon: '🛂', wfTitle: '中华人民共和国护照', items: ['背景：深色桌面', '信息页：含照片个人信息页', '边距：护照四边完整'], piiFields: ['姓名', '护照号', '出生日期'], specimen: '个人信息页·无反光', showPhoto: true, showSeal: false,
      wfFields: [
        { label: '姓名 (中/英)', width: 'mid', pii: true },
        { label: '护照号码', width: 'mid', pii: true },
        { label: '国籍 / 性别', width: 'short', pii: false },
        { label: '出生日期 / 地点', width: 'full', pii: true },
        { label: '签发日期 / 有效期至', width: 'full', pii: false },
        { label: '签发机关', width: 'mid', pii: false }
      ] },
    hk_id: { icon: '🆔', wfTitle: '香港永久性居民身份证', items: ['背景：深色桌面', '正面：芯片面朝上', '边距：四角完整'], piiFields: ['姓名', '身份证号'], specimen: '正面·芯片可见', showPhoto: true, showSeal: false,
      wfFields: [
        { label: '姓名 (中/英)', width: 'mid', pii: true },
        { label: '身份证号码', width: 'long', pii: true },
        { label: '出生日期', width: 'mid', pii: true },
        { label: '签发日期', width: 'mid', pii: false },
        { label: '符号标记', width: 'short', pii: false }
      ] },
    household: { icon: '📖', wfTitle: '居民户口簿', items: ['背景：深色桌面', '内容：户主页+本人页', '边距：四角完整'], piiFields: ['姓名', '身份证号', '住址'], specimen: '户主页+本人页', showPhoto: false, showSeal: true,
      wfFields: [
        { label: '户主姓名', width: 'short', pii: true },
        { label: '户号', width: 'mid', pii: false },
        { label: '住址', width: 'full', pii: true },
        { label: '本人姓名', width: 'short', pii: true },
        { label: '公民身份号码', width: 'long', pii: true },
        { label: '与户主关系', width: 'short', pii: false },
        { label: '登记机关 (印章)', width: 'mid', pii: false }
      ] },
    marriage: { icon: '💍', wfTitle: '中华人民共和国结婚证', items: ['背景：深色桌面', '内容：双页展开', '要求：印章+照片清晰'], piiFields: ['双方姓名', '证件号'], specimen: '双页展开·印章清晰', showPhoto: true, showSeal: true,
      wfFields: [
        { label: '持证人姓名', width: 'short', pii: true },
        { label: '登记日期', width: 'mid', pii: false },
        { label: '结婚证字号', width: 'long', pii: true },
        { label: '双方姓名', width: 'full', pii: true },
        { label: '双方证件号码', width: 'full', pii: true },
        { label: '登记机关 (印章)', width: 'mid', pii: false }
      ] },
    birth_cert: { icon: '👶', wfTitle: '出生医学证明', items: ['背景：深色桌面', '内容：正面完整', '要求：编号+印章清晰'], piiFields: ['婴儿姓名', '出生日期'], specimen: '正面·无折叠', showPhoto: false, showSeal: true,
      wfFields: [
        { label: '婴儿姓名', width: 'short', pii: true },
        { label: '出生医学证明编号', width: 'long', pii: false },
        { label: '出生日期 / 时间', width: 'mid', pii: true },
        { label: '母亲姓名 / 证件号', width: 'full', pii: true },
        { label: '父亲姓名 / 证件号', width: 'full', pii: true },
        { label: '签发医院 (印章)', width: 'mid', pii: false }
      ] },
    degree: { icon: '🎓', wfTitle: '学位证书', items: ['背景：深色桌面', '内容：证书正面完整', '要求：证书编号+印章清晰'], piiFields: ['姓名', '证书编号'], specimen: '正面·印章清晰', showPhoto: true, showSeal: true,
      wfFields: [
        { label: '学位证书编号', width: 'long', pii: true },
        { label: '姓名', width: 'short', pii: true },
        { label: '性别 / 出生日期', width: 'mid', pii: false },
        { label: '所学专业', width: 'mid', pii: false },
        { label: '学位授予单位', width: 'full', pii: false },
        { label: '授予日期', width: 'mid', pii: false }
      ] },
    transcript: { icon: '📄', wfTitle: '学业成绩单', items: ['背景：深色桌面', '内容：学校官方成绩单', '要求：教务处印章清晰'], piiFields: ['姓名', '学号'], specimen: '学校抬头·教务处盖章', showPhoto: false, showSeal: true,
      wfFields: [
        { label: '学校名称 (抬头)', width: 'full', pii: false },
        { label: '学生姓名', width: 'short', pii: true },
        { label: '学号', width: 'mid', pii: true },
        { label: '专业 / 学院', width: 'mid', pii: false },
        { label: '成绩列表', width: 'full', pii: false },
        { label: '教务处印章 / 日期', width: 'mid', pii: false }
      ] },
    work_proof: { icon: '💼', wfTitle: '工作证明', items: ['背景：深色桌面', '内容：抬头纸+盖章', '要求：公章+签字清晰'], piiFields: ['姓名', '公司名'], specimen: '抬头纸+公章', showPhoto: false, showSeal: true,
      wfFields: [
        { label: '公司名称 (抬头)', width: 'full', pii: false },
        { label: '员工姓名', width: 'short', pii: true },
        { label: '身份证号码', width: 'long', pii: true },
        { label: '入职日期 / 职位', width: 'mid', pii: false },
        { label: '工作内容简述', width: 'full', pii: false },
        { label: '公司印章 / 日期', width: 'mid', pii: false }
      ] },
    emp_letter: { icon: '📝', wfTitle: '雇主聘用书', items: ['背景：深色桌面', '内容：公司抬头纸', '要求：含职位+薪资+公章'], piiFields: ['姓名', '薪资'], specimen: '公司抬头纸·公章+签字', showPhoto: false, showSeal: true,
      wfFields: [
        { label: '公司名称 (抬头)', width: 'full', pii: false },
        { label: '员工姓名', width: 'short', pii: true },
        { label: '职位 / 部门', width: 'mid', pii: false },
        { label: '入职日期 / 合约期', width: 'mid', pii: false },
        { label: '月薪 / 年薪', width: 'mid', pii: true },
        { label: '公司印章 / 签字', width: 'mid', pii: false }
      ] },
    recommendation: { icon: '✉️', wfTitle: '推荐信', items: ['背景：深色桌面', '内容：推荐人签字件', '要求：含联系方式'], piiFields: ['申请人', '推荐人'], specimen: '推荐人签字·含联系方式', showPhoto: false, showSeal: false,
      wfFields: [
        { label: '推荐人姓名 / 职位', width: 'mid', pii: true },
        { label: '申请人姓名', width: 'short', pii: true },
        { label: '推荐人与申请人关系', width: 'mid', pii: false },
        { label: '推荐内容详述', width: 'full', pii: false },
        { label: '推荐人联系方式', width: 'full', pii: true },
        { label: '签字 / 日期', width: 'mid', pii: false }
      ] },
    bank_statement: { icon: '💰', wfTitle: '银行流水', items: ['背景：深色桌面', '内容：最近12个月', '要求：银行印章清晰'], piiFields: ['账户名', '账号'], specimen: '银行流水原件', showPhoto: false, showSeal: true,
      wfFields: [
        { label: '银行名称', width: 'mid', pii: false },
        { label: '账户持有人', width: 'short', pii: true },
        { label: '账号', width: 'long', pii: true },
        { label: '币种 / 余额', width: 'mid', pii: true },
        { label: '流水时间段', width: 'full', pii: false },
        { label: '银行印章', width: 'mid', pii: false }
      ] },
    tax_record: { icon: '📑', wfTitle: '完税证明', items: ['背景：深色桌面', '内容：税务机关出具', '要求：税务印章清晰'], piiFields: ['姓名', '身份证号'], specimen: '税务局出具·近期', showPhoto: false, showSeal: true,
      wfFields: [
        { label: '税务机关名称', width: 'full', pii: false },
        { label: '纳税人姓名', width: 'short', pii: true },
        { label: '身份证号码', width: 'long', pii: true },
        { label: '纳税年度', width: 'short', pii: false },
        { label: '应纳税所得额', width: 'mid', pii: true },
        { label: '税务印章 / 日期', width: 'mid', pii: false }
      ] },
    income_proof: { icon: '📊', wfTitle: '收入证明', items: ['背景：深色桌面', '内容：公司/机关出具', '要求：含时间段+金额'], piiFields: ['姓名', '收入金额'], specimen: '公司/税务机关出具', showPhoto: false, showSeal: true,
      wfFields: [
        { label: '出具机构 (抬头)', width: 'full', pii: false },
        { label: '姓名', width: 'short', pii: true },
        { label: '身份证号码', width: 'long', pii: true },
        { label: '收入时间段', width: 'mid', pii: false },
        { label: '总收入 / 月收入', width: 'mid', pii: true },
        { label: '机构印章 / 日期', width: 'mid', pii: false }
      ] },
    income_250w: { icon: '💵', wfTitle: '年收入≥250万证明', items: ['背景：深色桌面', '内容：薪资+流水+税单', '要求：三件收入数据一致'], piiFields: ['姓名', '年收入'], specimen: '三件一致·≥250万港币', showPhoto: false, showSeal: true,
      wfFields: [
        { label: '姓名', width: 'short', pii: true },
        { label: '身份证号码', width: 'long', pii: true },
        { label: '年度', width: 'short', pii: false },
        { label: '年收入总额 (港币)', width: 'mid', pii: true },
        { label: '薪资/奖金/股权分解', width: 'full', pii: false },
        { label: '公司/税务印章', width: 'mid', pii: false }
      ] },
    company_docs: { icon: '🏢', wfTitle: '公司注册文件', items: ['背景：深色桌面', '内容：注册证明+商业登记证', '要求：印章清晰'], piiFields: ['公司编号'], specimen: '公司注册处·商业登记证', showPhoto: false, showSeal: true,
      wfFields: [
        { label: '公司名称 (中/英)', width: 'full', pii: false },
        { label: '公司注册编号', width: 'mid', pii: true },
        { label: '成立日期', width: 'mid', pii: false },
        { label: '公司类别', width: 'short', pii: false },
        { label: '注册地址', width: 'full', pii: false },
        { label: '公司注册处印章', width: 'mid', pii: false }
      ] },
    plan_statement: { icon: '📝', wfTitle: '赴港计划书 (文字)', items: ['此材料为文字撰写，非文件上传', '建议800-1500字', '内容：来港目的+职业规划+对港贡献'], piiFields: ['姓名'], specimen: '文字撰写·800-1500字', showPhoto: false, showSeal: false,
      wfFields: [
        { label: '姓名 / 日期', width: 'short', pii: true },
        { label: '来港目的', width: 'full', pii: false },
        { label: '职业规划', width: 'full', pii: false },
        { label: '对港贡献预期', width: 'full', pii: false },
        { label: '在港安居计划', width: 'full', pii: false },
        { label: '本人签字', width: 'mid', pii: false }
      ] },
    no_crime: { icon: '🛡️', wfTitle: '无犯罪记录证明', items: ['背景：深色桌面', '内容：公安局/派出所出具', '要求：6个月内有效'], piiFields: ['姓名', '身份证号'], specimen: '公安机关出具·6个月有效', showPhoto: false, showSeal: true,
      wfFields: [
        { label: '出具机关名称', width: 'full', pii: false },
        { label: '申请人姓名', width: 'short', pii: true },
        { label: '身份证号码', width: 'long', pii: true },
        { label: '证明内容', width: 'full', pii: false },
        { label: '有效期至', width: 'mid', pii: false },
        { label: '公安机关印章 / 日期', width: 'mid', pii: false }
      ] },
    student_visa: { icon: '🎫', wfTitle: '学生签证/入境许可', items: ['背景：深色桌面', '内容：入境处签证标签', '要求：含学校+有效期'], piiFields: ['姓名', '签证编号'], specimen: '入境处学生签证标签', showPhoto: false, showSeal: true,
      wfFields: [
        { label: '签证编号', width: 'long', pii: true },
        { label: '学生姓名', width: 'short', pii: true },
        { label: '学校 / 课程名称', width: 'full', pii: false },
        { label: '签证有效期', width: 'mid', pii: false },
        { label: '逗留条件', width: 'full', pii: false },
        { label: '入境处印章', width: 'mid', pii: false }
      ] },
    admission_letter: { icon: '📨', wfTitle: '录取通知书', items: ['背景：深色桌面', '内容：学校正式录取通知', '要求：含专业+入学日期'], piiFields: ['姓名'], specimen: '学校抬头·官方印章', showPhoto: false, showSeal: true,
      wfFields: [
        { label: '学校名称 (抬头)', width: 'full', pii: false },
        { label: '学生姓名', width: 'short', pii: true },
        { label: '录取专业 / 学位', width: 'mid', pii: false },
        { label: '入学日期 / 学制', width: 'mid', pii: false },
        { label: '申请编号', width: 'long', pii: true },
        { label: '学校印章 / 签发人', width: 'mid', pii: false }
      ] },
    language_cert: { icon: '🗣️', wfTitle: '语言成绩单', items: ['背景：深色桌面', '内容：IELTS/TOEFL/HSK官方成绩单', '要求：分数+证书编号清晰'], piiFields: ['姓名', '考生编号'], specimen: '官方成绩单原件', showPhoto: false, showSeal: true,
      wfFields: [
        { label: '考试机构', width: 'mid', pii: false },
        { label: '考生姓名', width: 'short', pii: true },
        { label: '考生编号', width: 'mid', pii: true },
        { label: '考试日期', width: 'mid', pii: false },
        { label: '总分 / 各科分数', width: 'full', pii: false },
        { label: '证书编号 / 验证码', width: 'long', pii: false }
      ] },
    approval: { icon: '✅', wfTitle: '获批通知书', items: ['背景：深色桌面', '内容：通知完整页面', '要求：申请编号+日期清晰'], piiFields: ['姓名', '申请编号'], specimen: '获批原件', showPhoto: false, showSeal: true,
      wfFields: [
        { label: '入境许可编号', width: 'long', pii: true },
        { label: '申请人姓名', width: 'short', pii: true },
        { label: '签证类型 / 逗留条件', width: 'mid', pii: false },
        { label: '批准日期', width: 'mid', pii: false },
        { label: '逗留期限至', width: 'mid', pii: false },
        { label: '入境处印章/编号', width: 'full', pii: false }
      ] }
  };
  return guides[docType] || null;
}

/** Bug #12: 按证件类型定义隐私覆盖条位置（基于真实证件PII字段布局） */
var DOC_PRIVACY_OVERLAY = {
  id_card: { bars: [
    { top: '12%', left: '8%', width: '28%', height: '4.5%', label: '姓名' },
    { top: '20%', left: '8%', width: '45%', height: '4%', label: '证号' },
    { top: '28%', left: '8%', width: '22%', height: '4%', label: '出生' },
    { top: '36%', left: '8%', width: '55%', height: '5%', label: '地址' }
  ]},
  passport: { bars: [
    { top: '10%', left: '40%', width: '28%', height: '4%', label: '姓名' },
    { top: '26%', left: '40%', width: '35%', height: '4%', label: '护照号' },
    { top: '32%', left: '40%', width: '25%', height: '4%', label: '出生地点' }
  ]},
  hk_permit: { bars: [
    { top: '12%', left: '35%', width: '25%', height: '4%', label: '姓名' },
    { top: '22%', left: '35%', width: '45%', height: '4%', label: '证件号' },
    { top: '30%', left: '35%', width: '22%', height: '4%', label: '出生' }
  ]},
  hk_id: { bars: [
    { top: '10%', left: '5%', width: '25%', height: '4%', label: '姓名' },
    { top: '18%', left: '5%', width: '40%', height: '4%', label: '证号' },
    { top: '24%', left: '5%', width: '20%', height: '4%', label: '出生' }
  ]},
  degree: { bars: [
    { top: '12%', left: '25%', width: '20%', height: '4%', label: '姓名' },
    { top: '28%', left: '25%', width: '40%', height: '4%', label: '证书编号' }
  ]},
  marriage: { bars: [
    { top: '8%', left: '20%', width: '20%', height: '4%', label: '姓名' },
    { top: '22%', left: '20%', width: '40%', height: '4%', label: '证号' }
  ]},
  birth_cert: { bars: [
    { top: '10%', left: '15%', width: '20%', height: '4%', label: '姓名' },
    { top: '22%', left: '15%', width: '25%', height: '4%', label: '出生' }
  ]},
  bank_statement: { bars: [
    { top: '8%', left: '20%', width: '25%', height: '4%', label: '账户名' },
    { top: '20%', left: '20%', width: '30%', height: '4%', label: '账号' }
  ]},
  work_proof: { bars: [
    { top: '12%', left: '15%', width: '22%', height: '4%', label: '姓名' },
    { top: '22%', left: '15%', width: '40%', height: '4%', label: '公司' }
  ]},
  household: { bars: [
    { top: '8%', left: '10%', width: '22%', height: '4%', label: '姓名' },
    { top: '20%', left: '10%', width: '45%', height: '4%', label: '证号' },
    { top: '28%', left: '10%', width: '55%', height: '5%', label: '地址' }
  ]},
  income_250w: { bars: [
    { top: '10%', left: '15%', width: '22%', height: '4%', label: '姓名' },
    { top: '20%', left: '15%', width: '45%', height: '4%', label: '身份证号' },
    { top: '30%', left: '15%', width: '35%', height: '4%', label: '年收入' }
  ]},
  no_crime: { bars: [
    { top: '10%', left: '15%', width: '22%', height: '4%', label: '姓名' },
    { top: '20%', left: '15%', width: '45%', height: '4%', label: '身份证号' }
  ]},
  student_visa: { bars: [
    { top: '8%', left: '20%', width: '25%', height: '4%', label: '姓名' },
    { top: '18%', left: '20%', width: '35%', height: '4%', label: '签证编号' }
  ]},
  plan_statement: { bars: [] }
};

/** 卡槽key → 证件分类自动映射 (Bug #24: 补全全部映射) */
function slotToCategory(slotKey) {
  var map = {
    // 身份
    'id_card': 'identity', 'hk_permit': 'identity', 'passport': 'identity', 'hk_id': 'identity', 'photo': 'identity',
    // 学历
    'degree_cert': 'education', 'transcript': 'education', 'degree_auth': 'education', 'language_cert': 'education',
    'admission_letter': 'education', 'exchange_agreement': 'education', 'parttime_enrollment': 'education',
    // 工作
    'emp_letter': 'work', 'emp_proof': 'work', 'reference_letter': 'work', 'recommendation': 'work',
    'salary_proof': 'work', 'org_chart': 'work', 'emp_3y': 'work', 'company_docs': 'work', 'tech_achievement': 'work',
    // 资产
    'bank_statement': 'assets', 'tax_record': 'assets', 'income_250w': 'assets', 'income_proof': 'assets',
    'investment_proof': 'assets', 'asset_proof': 'assets', 'retirement_fund': 'assets', 'pension_proof': 'assets',
    'funding_proof': 'assets',
    // 获批/申请
    'visa_label': 'approved', 'approval': 'approved', 'plan_statement': 'approved', 'student_visa': 'approved',
    'hk_visa': 'approved', 'no_crime': 'approved',
    // 关系/保证人/监护人
    'marriage_cert': 'identity', 'birth_cert': 'identity', 'household': 'identity',
    'sponsor_id': 'identity', 'sponsor_income': 'assets', 'sponsor_employment': 'work',
    'guardian_id': 'identity', 'guardian_consent': 'approved', 'guardian_income': 'assets'
  };
  return map[slotKey] || '';
}

/** Bug #12: 根据证件类型返回PII遮挡条位置 (基于真实证件规格) */
function getPrivacyBars(docType, slotKey) {
  var bars = {
    // ▸ 身份证 (85.6×54mm 横向, 照片左·信息右)
    id_card: [
      { top: '10%', left: '42%', width: '52%', height: '4%', label: '姓名' },
      { top: '16%', left: '42%', width: '25%', height: '3.5%', label: '性别' },
      { top: '22%', left: '42%', width: '35%', height: '3.5%', label: '民族' },
      { top: '28%', left: '42%', width: '48%', height: '3.5%', label: '出生' },
      { top: '35%', left: '8%', width: '88%', height: '8%', label: '住址' },
      { top: '48%', left: '8%', width: '88%', height: '5%', label: '住址(续)' },
      { top: '58%', left: '42%', width: '50%', height: '5%', label: '公民身份号码' }
    ],
    // ▸ 港澳通行证 (卡式, 照片左·长城底纹)
    hk_permit: [
      { top: '12%', left: '42%', width: '16%', height: '4%', label: '姓名' },
      { top: '12%', left: '60%', width: '34%', height: '4%', label: '拼音' },
      { top: '25%', left: '50%', width: '40%', height: '4%', label: '通行证号' },
      { top: '38%', left: '42%', width: '25%', height: '4%', label: '出生日期' },
      { top: '52%', left: '50%', width: '40%', height: '4%', label: '有效期限' }
    ],
    // ▸ 护照 (125×88mm, 资料页第2页, 照片左·MRZ底)
    passport: [
      { top: '8%', left: '35%', width: '55%', height: '4%', label: '姓名' },
      { top: '16%', left: '35%', width: '30%', height: '3.5%', label: '护照号(E+8位)' },
      { top: '24%', left: '35%', width: '20%', height: '3%', label: '性别' },
      { top: '30%', left: '35%', width: '50%', height: '4%', label: '出生日期/地点' }
    ],
    // ▸ 香港身份证 (2018版, 照片左置)
    hk_id: [
      { top: '15%', left: '42%', width: '24%', height: '3.5%', label: '中文姓名' },
      { top: '15%', left: '68%', width: '28%', height: '3.5%', label: '英文姓名' },
      { top: '28%', left: '42%', width: '52%', height: '4%', label: '身份证号码' },
      { top: '42%', left: '42%', width: '30%', height: '4%', label: '出生日期' }
    ],
    // ▸ 户口本 (首页+本人页)
    household: [
      { top: '8%', left: '25%', width: '18%', height: '3.5%', label: '户主姓名' },
      { top: '8%', left: '50%', width: '44%', height: '8%', label: '住址' },
      { top: '18%', left: '25%', width: '18%', height: '3.5%', label: '本人姓名' },
      { top: '30%', left: '50%', width: '44%', height: '4%', label: '公民身份号码' }
    ],
    // ▸ 结婚证 (双页展开)
    marriage: [
      { top: '40%', left: '10%', width: '24%', height: '5%', label: '持证人' },
      { top: '25%', left: '10%', width: '30%', height: '4%', label: '登记日期' },
      { top: '50%', left: '10%', width: '40%', height: '4%', label: '结婚证字号' },
      { top: '58%', left: '10%', width: '80%', height: '5%', label: '双方姓名' },
      { top: '65%', left: '10%', width: '80%', height: '5%', label: '双方身份证号' }
    ],
    // ▸ 出生证 (第七版)
    birth_cert: [
      { top: '15%', left: '30%', width: '24%', height: '4%', label: '婴儿姓名' },
      { top: '25%', left: '30%', width: '35%', height: '3.5%', label: '出生日期/时间' },
      { top: '48%', left: '8%', width: '40%', height: '4%', label: '母亲姓名' },
      { top: '48%', left: '52%', width: '44%', height: '4%', label: '母亲身份证号' },
      { top: '56%', left: '8%', width: '40%', height: '4%', label: '父亲姓名' },
      { top: '56%', left: '52%', width: '44%', height: '4%', label: '父亲身份证号' }
    ],
    // ▸ 学位证 (A4竖版)
    degree: [
      { top: '18%', left: '12%', width: '18%', height: '3.5%', label: '姓名' },
      { top: '18%', left: '35%', width: '55%', height: '3.5%', label: '证书编号' },
      { top: '24%', left: '12%', width: '30%', height: '3.5%', label: '出生日期' }
    ],
    // ▸ 工作证明 (A4)
    work: [
      { top: '18%', left: '12%', width: '18%', height: '3.5%', label: '姓名' },
      { top: '18%', left: '40%', width: '52%', height: '3.5%', label: '身份证号' },
      { top: '32%', left: '40%', width: '52%', height: '3.5%', label: '薪资' }
    ],
    // ▸ 银行流水
    bank: [
      { top: '10%', left: '12%', width: '22%', height: '3.5%', label: '账户持有人' },
      { top: '10%', left: '50%', width: '44%', height: '3.5%', label: '账号' },
      { top: '20%', left: '12%', width: '30%', height: '3.5%', label: '余额' }
    ],
    // ▸ 获批通知
    approval: [
      { top: '12%', left: '12%', width: '22%', height: '3.5%', label: '姓名' },
      { top: '12%', left: '50%', width: '44%', height: '3.5%', label: '入境许可编号' }
    ]
  };

  // Bug #12: slotKey → bars key 别名映射（卡槽key与脱敏条key不一致时）
  var barAliases = {
    'degree_cert': 'degree', 'marriage_cert': 'marriage', 'birth_cert': 'birth_cert',
    'household': 'household', 'bank_statement': 'bank_statement', 'income_proof': 'income_250w',
    'income_250w': 'income_250w', 'tax_record': 'income_250w', 'emp_proof': 'work_proof',
    'emp_letter': 'work_proof', 'emp_3y': 'work_proof', 'salary_proof': 'income_250w',
    'sponsor_id': 'id_card', 'guardian_id': 'id_card', 'visa_label': 'approval',
    'student_visa': 'approval', 'company_docs': 'income_250w', 'tech_achievement': 'work_proof',
    'reference_letter': 'work_proof', 'recommendation': 'work_proof',
    'sponsor_income': 'income_250w', 'sponsor_employment': 'work_proof',
    'guardian_income': 'income_250w', 'guardian_consent': 'approval',
    'investment_proof': 'income_250w', 'asset_proof': 'income_250w',
    'retirement_fund': 'income_250w', 'pension_proof': 'income_250w',
    'funding_proof': 'bank_statement', 'no_crime': 'work_proof'
  };
  var resolvedBarKey = barAliases[slotKey] || docType;
  if (resolvedBarKey && bars[resolvedBarKey]) return bars[resolvedBarKey];

  // 按 docType 精确匹配
  if (docType && bars[docType]) return bars[docType];
  // 按 slotKey 匹配
  if (slotKey && bars[slotKey]) return bars[slotKey];
  // 默认: 身份证
  return bars.id_card;
}
