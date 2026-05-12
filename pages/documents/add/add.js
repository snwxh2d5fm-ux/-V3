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

    // 质量检测
    qualityIssues: [],           // 图片质量问题

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

    // 保存状态
    saving: false,
    privacyMode: 'local'
  },

  onLoad(options) {
    // 预填所属人（从卡槽传入）
    if (options.ownerType) {
      this.setData({ ownerType: options.ownerType });
    }
    this.setData({ privacyMode: app.getPrivacyMode() });
  },

  // ========== Step 1: 选择输入方式 ==========

  /** 拍照 */
  onTapCamera() {
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

  // ========== Step 2: 图片处理 ==========

  /**
   * 处理图片 — 质量检测 → 压缩 → 上传 → OCR
   * 正确流程: compressImage → cloud.uploadFile → 传 fileID 给云函数
   */
  async processImage(imagePath) {
    this.setData({ imagePath, step: 2, ocrProcessing: true, qualityIssues: [] });

    // 图片质量检测
    try {
      const quality = await checkImageQuality(imagePath);
      if (!quality.pass) {
        this.setData({ qualityIssues: quality.issues || ['图片质量较低，可能影响识别效果'] });
      }
    } catch (e) {
      console.log('[OCR] 质量检测跳过:', e);
    }

    // 转为base64用于预览
    this.readImageBase64(imagePath);

    // 压缩图片（降低上传/处理体积）
    var compressedPath = imagePath;
    try {
      var compressRes = await wxCompressImage(imagePath);
      compressedPath = compressRes;
    } catch (e) {
      console.log('[OCR] 压缩跳过，使用原图:', e);
    }

    // 上传到云存储→获取fileID→传给云函数OCR
    try {
      var fileID = await this.uploadToCloud(compressedPath);
      await this.runOCR(fileID);
    } catch (e) {
      console.error('[OCR] 上传失败:', e);
      wx.showToast({ title: '图片上传失败，请手动填写', icon: 'none' });
      this.setData({ step: 4, ocrProcessing: false });
    }
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
        '收入': 'income', '签证类型': 'visaType', '许可编号': 'permitNumber'
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
        visaType: '签证类型', permitNumber: '许可编号'
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
    // 身份证号: 18位
    var idMatch = text.match(/\d{17}[\dXx]/);
    if (idMatch) fields.idNumber = idMatch[0].toUpperCase();
    // 姓名: "姓名"后2-4个汉字
    var nameMatch = text.match(/姓名[：:]\s*([\u4e00-\u9fff]{2,4})/);
    if (nameMatch) fields.name = nameMatch[1];
    // 日期
    var dateMatch = text.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (dateMatch) fields.validTo = dateMatch[1] + '-' + dateMatch[2].padStart(2, '0') + '-' + dateMatch[3].padStart(2, '0');
    // 签发机关
    var authMatch = text.match(/签发机关|簽發機關[：:]\s*(.+?)(?:$|\n)/);
    if (authMatch) fields.issuingAuthority = authMatch[1].trim();
    return fields;
  },

  /** OCR字段值变更 */
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
      step: 1, inputMode: '', imagePath: '', imageBase64: '',
      docType: 'unknown', ocrFields: {}, rawOCRText: '',
      confidence: 0, confidencePercent: '0', ocrFieldList: [], qualityIssues: []
    });
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

    // 检查免费用户上限
    const membershipLevel = app.globalData.membershipLevel || 'free';
    if (membershipLevel === 'free') {
      const docs = getAllDocuments();
      if (docs.length >= constants.FREE_LIMITS.MAX_DOCUMENTS) {
        wx.showModal({
          title: '免费额度已满',
          content: `免费用户最多${constants.FREE_LIMITS.MAX_DOCUMENTS}份证件，请升级会员或删除旧证件后重试。`,
          confirmText: '升级会员',
          cancelText: '稍后再说',
          success: (res) => {
            if (res.confirm) wx.navigateTo({ url: '/pages/membership/index/index' });
          }
        });
        return;
      }
    }

    this.setData({ saving: true });

    // 生成证件ID
    const docId = 'DOC_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

    // 选中的分类信息
    const categoryInfo = this.data.categories.find(c => c.value === docCategory) || {};

    // 保存图片到本地文件系统
    let filePath = imagePath;
    if (imagePath) {
      try {
        filePath = await saveFile(imagePath, docId, docCategory);
      } catch (e) {
        console.error('[保存] 文件保存失败:', e);
        // 仍保存元数据，但标记无文件
        filePath = '';
      }
    }

    // 构建证件元数据
    const name = ocrFields.name || manualForm.name || categoryInfo.label + '证件';
    const docNumber = ocrFields.idNumber || ocrFields.passportNumber ||
                      ocrFields.hkIdNumber || manualForm.docNumber || '';
    const now = new Date().toISOString();

    const doc = {
      id: docId,
      name: name,
      type: docType,
      category: docCategory,
      categoryLabel: categoryInfo.label || docCategory,
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
    wx.showToast({ title: '保存成功 ✅', icon: 'success', duration: 1500 });
    setTimeout(() => wx.navigateBack(), 1000);
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
