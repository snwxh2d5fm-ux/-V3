/**
 * 住港伴 v3 — 添加证件页
 * 流程: 选择输入方式 → 拍照/选图 → OCR识别 → 确认字段 → 选择分类 → 保存本地FS
 * 存储: utils/storage.saveDocumentMeta → __vault_meta__
 */
const { saveFile, saveDocumentMeta, getAllDocuments } = require('../../../utils/storage');
const { extractFields, identifyDocType, checkImageQuality } = require('../../../utils/ocr');
const { desensitizeFields, MODES } = require('../../../utils/desensitize');
const { getSlotGuide, getFreeDocGuide, slotToCategory, getPrivacyBars } = require('../../data/document-guides');
const constants = require('../../../data/constants');
const app = getApp();

Page({
  data: {
    step: 1, // 1=选输入方式, 2=拍照/选图预览, 3=OCR结果确认, 4=手动填写
    inputMode: '', // 'camera' | 'album' | 'manual'
    imagePath: '', // 临时图片路径
    imageBase64: '', // base64预览
    imageRotated: 0, // 旋转角度 0/90/180/270

    // OCR结果
    docType: 'unknown', // 识别到的证件类型
    docTypeLabel: '', // 证件类型中文名
    docCategory: '', // 用户选择的分类
    ocrFields: {}, // OCR提取的字段
    rawOCRText: '', // OCR原始文本
    confidence: 0, // 识别置信度 0-1
    confidencePercent: '0', // 百分比显示
    ocrFieldList: [], // OCR字段列表 [{key, value}]
    ocrProcessing: false, // OCR处理中

    // 对齐裁切
    cropX: 0,
    cropY: 0,
    cropScale: 1,

    // 质量检测
    qualityIssues: [], // 图片质量问题(旧)
    qualityResult: null, // 质量检测结果(新·6项)

    // 扫描件效果

    // 证件双面拍摄
    photoSide: 'front',
    frontSideLabel: '人像面', // 根据证件类型动态变化
    backSideLabel: '国徽面', // 港澳通行证→签注面, 护照→信息页
    frontPhotoPath: '',
    backPhotoPath: '',
    bothSidesDone: false,

    // 一键对齐
    alignProcessing: false,
    alignedPath: '',

    // 分类选项 — 对齐PRD七大类
    categories: [
      { value: 'identity', label: '身份', icon: '🆔', desc: '身份证/护照/回乡证等' },
      { value: 'education', label: '学历', icon: '🎓', desc: '学位证/毕业证/成绩单' },
      { value: 'work', label: '工作', icon: '💼', desc: '工作证明/推荐信/名片' },
      { value: 'assets', label: '资产', icon: '💰', desc: '银行流水/税单/存款证明' },
      { value: 'approved', label: '获批', icon: '✅', desc: '获批通知/签证标签纸' },
      { value: 'renewal', label: '续签', icon: '🔄', desc: '续签材料/MPF记录' },
      { value: 'permanent', label: '永居', icon: '🏁', desc: '永居申请相关材料' },
    ],

    // 手动填写表单
    manualForm: {
      name: '',
      docNumber: '',
      validFrom: '',
      validTo: '',
      issuingAuthority: '',
      notes: '',
    },

    // 证件所属人
    ownerType: 'self', // 'self' | 'spouse' | 'child'
    ownerName: '', // 子女姓名（仅ownerType='child'时使用）
    ownerOptions: [
      { value: 'self', label: '本人', icon: '👤' },
      { value: 'spouse', label: '配偶', icon: '💑' },
      { value: 'child', label: '子女', icon: '👶' },
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
      { value: 'approval', label: '获批通知', icon: '✅' },
    ],
    freeDocGuide: null, // 自由模式下选中证件类型的拍摄指引

    // 保存状态
    saving: false,
    privacyMode: 'local',

    // Bug #12修复: 隐私覆盖条根据证件类型动态渲染
    privacyBars: [],
    _currentDocType: '',
    _slotKey: '',
    _slotDocName: '',
    _slotGuideId: '',
    _rotateDeg: 0,
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
      const autoCat = slotToCategory(this._slotKey);
      this.setData({
        slotContext: true,
        slotDocName: this._slotDocName,
        slotGuide: getSlotGuide(this._slotKey, this._slotDocName),
        docCategory: autoCat || '',
        skipCategory: !!autoCat,
      });
      // 根据卡槽设置证件面标签（通行证→签注面, 护照→信息页, 身份证→国徽面）
      this.setSideLabels(options.slotKey);
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
      privacyBars: getPrivacyBars('', this._slotKey || ''),
    });
  },

  // ========== Step 1: 选择输入方式 ==========

  /** 拍照 — Bug#4: 先展示拍摄引导，再调相机 */
  onTapCamera() {
    const that = this;
    const guide = this.getActiveGuide();
    const guideText =
      guide && guide.wfTitle
        ? guide.wfTitle + ' — ' + (guide.specimen || '请确保四角完整')
        : '请确保证件四角完整、无反光';
    wx.showModal({
      title: '拍摄指引',
      content: guideText + '\n\n系统将打开相机，请对准证件正面拍摄。拍摄后可进行质量检测和手动对齐。',
      confirmText: '开始拍摄',
      cancelText: '返回',
      success: function (res) {
        if (res.confirm) {
          that.doTakeCamera();
        }
      },
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
      },
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
      },
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
      const result = await checkImageQuality(imagePath);
      this.setData({ qualityResult: result });
    } catch (e) {
      this.setData({ qualityResult: { pass: true, score: 100, issues: [], summary: '合格' } });
    }

    // AI增强: 后台异步处理，不阻塞用户交交互
    var that = this;
    const enhancedPath = imagePath;
    try {
      // 扫描件效果：后台运行，不阻塞UI
      if (this.data.scanMode && !this.data.scanProcessing) {
        var that = this;
        this.setData({ scanProcessing: true });
        // 后台异步执行，不阻塞用户继续操作
        const imgProc = require('../../utils/image-process');
        // 仅自动旋转（安全操作），跳过crop/enhance（真机Canvas兼容性问题）
        imgProc
          .autoRotate(imagePath)
          .then(function (rotated) {
            if (rotated && rotated !== imagePath) {
              that.setData({ imagePath: rotated, alignedPath: rotated });
              that.readImageBase64(rotated);
            }
          })
          .catch(function (e) {
            // 图片增强跳过，继续后续流程
          })
          .finally(function () {
            that.setData({ scanProcessing: false });
          });
      }
    } catch (e) {
      // AI增强不可用，跳过继续
    }
  },

  /** 确认图片 → Bug #8: 应用旋转+缩放变换后再推进步骤 */
  async confirmImage() {
    const qr = this.data.qualityResult;
    // Bug #6 修复: 质量检测未完成时阻断，防止跳过质检
    if (!qr) {
      wx.showToast({ title: '质量检测中，请稍候…', icon: 'none', duration: 1500 });
      return;
    }
    if (qr && !qr.pass) {
      wx.showModal({
        title: '照片质量不通过',
        content:
          '检测到以下问题：\n' +
          qr.issues
            .filter(function (i) {
              return i.severity === 'warning';
            })
            .map(function (i) {
              return '• ' + i.message;
            })
            .join('\n') +
          '\n\n请重新拍摄以获得更好的识别效果。',
        showCancel: false,
        confirmText: '重新拍摄',
        success: function (res) {
          this.retakePhoto();
        }.bind(this),
      });
      return;
    }

    // Bug #8: 应用旋转变换（canvas像素级，Canvas 2D 优先，Old API 降级）
    const imagePath = this.data.imagePath;
    const rotateDeg = this._rotateDeg || 0;
    if (rotateDeg > 0) {
      wx.showLoading({ title: '处理中...' });
      try {
        const imgProc = require('../../utils/image-process');
        const rotatedPath = await imgProc.rotateImage(imagePath, rotateDeg);
        const finalPath = await imgProc.resizeImage(rotatedPath, 2048, 2048);
        wx.hideLoading();
        this._rotateDeg = 0;
        this.setData({ imagePath: finalPath, imageRotated: 0 });
      } catch (e) {
        wx.hideLoading();
        wx.showToast({ title: '图片处理失败，请重试', icon: 'none' });
        console.warn('[Bug#8] confirmImage 旋转/缩放失败:', e);
        return;
      }
    }
    // 卡槽入口已确定分类→直接保存；否则进分类选择
    if (this.data.skipCategory && this.data.docCategory) {
      this.confirmSave();
    } else {
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
    let currentRot = (this.data._rotateDeg || 0) + 90;
    if (currentRot >= 360) currentRot = 0;
    this.setData({ _rotateDeg: currentRot });
    // 通过CSS transform旋转预览图
    this.setData({ _rotateStyle: 'transform: rotate(' + currentRot + 'deg);' });
  },
  async confirmCrop() {
    wx.showLoading({ title: '处理中...' });
    const imgProc = require('../../utils/image-process');
    const imagePath = this.data.imagePath;
    // Bug #8: 先旋转，再裁剪，最后缩放
    const rotateDeg = this._rotateDeg || 0;
    try {
      let p = rotateDeg > 0 ? await imgProc.rotateImage(imagePath, rotateDeg) : imagePath;
      p = await imgProc.cropImage(p, 0.05, 0.08, 0.9, 0.84);
      const finalPath = await imgProc.resizeImage(p, 2048, 2048);
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
  withTimeout: function (promise, ms, fallback) {
    return Promise.race([
      promise,
      new Promise(function (resolve) {
        setTimeout(function () {
          resolve(fallback);
        }, ms);
      }),
    ]);
  },

  /** 缩放图片到maxPx以内 */
  shrinkImage(src, maxPx) {
    return new Promise(function (resolve) {
      wx.getImageInfo({
        src: src,
        success: function (info) {
          const w = info.width,
            h = info.height;
          if (Math.max(w, h) <= maxPx) {
            resolve(src);
            return;
          }
          const ratio = maxPx / Math.max(w, h);
          const nw = Math.round(w * ratio),
            nh = Math.round(h * ratio);
          // 用compressImage的质量100+指定尺寸间接缩放
          wx.compressImage({
            src: src,
            quality: 80,
            compressedWidth: nw,
            compressedHeight: nh,
            success: function (r) {
              resolve(r.tempFilePath);
            },
            fail: function () {
              resolve(src);
            },
          });
        },
        fail: function () {
          resolve(src);
        },
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
      const cloudPath = '_ocr_temp/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.jpg';
      wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: imagePath,
        success: (res) => resolve(res.fileID),
        fail: reject,
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
      // base64 转换失败，使用临时路径
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
      const res = await wx.cloud.callFunction({
        name: 'ocr-service',
        data: { action: 'ocr', fileID: fileID },
      });

      const result = res.result || {};
      if (result.code !== 0) {
        throw new Error(result.msg || 'OCR 服务异常');
      }

      const data = result.data || {};
      const rawText = data.rawText || '';
      const docType = data.docType || 'unknown';
      let confidence = typeof data.confidence === 'number' ? data.confidence : 0.5;
      const ocrError = data.ocrError || '';
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
          },
        });
        return;
      }

      // 云函数返回的 fields 是 [{label, value}] 数组格式
      const fieldsArray = data.fields || [];
      let ocrFields = {};
      const fieldLabelMap = {
        姓名: 'name',
        证件号码: 'idNumber',
        身份证号: 'idNumber',
        护照号: 'passportNumber',
        香港身份证号: 'hkIdNumber',
        出生日期: 'birthDate',
        性别: 'gender',
        国籍: 'nationality',
        有效期起: 'validFrom',
        有效期至: 'validTo',
        签发机关: 'issuingAuthority',
        地址: 'address',
        学位: 'degree',
        毕业院校: 'school',
        专业: 'major',
        毕业日期: 'graduationDate',
        公司: 'company',
        职位: 'position',
        收入: 'income',
        签证类型: 'visaType',
        许可编号: 'permitNumber',
        // 银行流水/资产类
        银行名称: 'bankName',
        账户持有人: 'accountHolder',
        账号: 'accountNumber',
      };

      fieldsArray.forEach(function (f) {
        const key = fieldLabelMap[f.label] || f.label;
        ocrFields[key] = f.value || '';
      });

      // 如果字段为空，尝试用正则从 rawText 提取补充字段
      if (Object.keys(ocrFields).length === 0 && rawText.trim().length > 0) {
        ocrFields = extractFieldsFromText(rawText, docType);
        if (Object.keys(ocrFields).length > 0) {
          confidence = Math.min(confidence, 0.6); // 降级置信度
        }
      }

      const docTypeLabels = {
        id_card: '身份证',
        hk_id: '香港身份证',
        passport: '护照',
        degree: '学历证书',
        work_proof: '工作证明',
        visa: '签证',
        bank_statement: '银行流水',
        approval_notice: '获批通知',
        hk_permit: '港澳通行证',
        unknown: '未知类型',
      };

      // 构建字段列表
      const fieldDisplayLabels = {
        name: '姓名',
        idNumber: '证件号码',
        passportNumber: '护照号',
        hkIdNumber: '香港身份证号',
        birthDate: '出生日期',
        gender: '性别',
        nationality: '国籍',
        validFrom: '有效期起',
        validTo: '有效期至',
        issuingAuthority: '签发机关',
        address: '地址',
        degree: '学位',
        school: '毕业院校',
        major: '专业',
        graduationDate: '毕业日期',
        company: '公司',
        position: '职位',
        income: '收入',
        visaType: '签证类型',
        permitNumber: '许可编号',
        bankName: '银行名称',
        accountHolder: '账户持有人',
        accountNumber: '账号',
      };

      const fieldList = Object.keys(ocrFields).map(function (key) {
        return {
          key: key,
          label: fieldDisplayLabels[key] || key,
          value: ocrFields[key] || '',
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
        ocrProcessing: false,
      });
      this.setSideLabels(docType);
    } catch (e) {
      console.error('[OCR] 识别失败:', e);
      wx.showToast({ title: '识别失败，请手动填写', icon: 'none' });
      this.setData({ step: 4, ocrProcessing: false });
    }
  },

  /** 正则从OCR文本提取字段（云函数字段为空时的兜底） */
  extractFieldsFromText(text, docType) {
    const fields = {};
    // OCR文本预处理: tesseract常在中文字间加空格
    const clean = text.replace(/\s+/g, '');
    // === 身份证号 ===
    const idMatch = text.match(/\d{17}[\dXx]/);
    if (idMatch) fields.idNumber = idMatch[0].toUpperCase();
    // === 香港身份证 ===
    const hkid = text.match(/[A-Z]\d{6}\([0-9A]\)/);
    if (hkid) fields.hkIdNumber = hkid[0];
    // === 护照号 ===
    const pp = text.match(/[A-Z]{1,2}\d{7,9}/);
    if (pp && !idMatch) fields.passportNumber = pp[0];
    // === 姓名 — 多策略 ===
    const nm = text.match(/姓\s*名\s*[：:＝]\s*([\u4e00-\u9fff]{2,4})/);
    if (nm) fields.name = nm[1];
    if (!fields.name) {
      const nm2 = clean.match(/姓名([\u4e00-\u9fff]{2,4})/);
      if (nm2) fields.name = nm2[1];
    }
    if (!fields.name) {
      const nm3 = text.match(/Name\s*[：:＝]\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/i);
      if (nm3) fields.name = nm3[1];
    }
    // === 出生日期 ===
    const bm = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
    if (bm) fields.birthDate = bm[1] + '-' + bm[2].padStart(2, '0') + '-' + bm[3].padStart(2, '0');
    if (!fields.birthDate) {
      const bm2 = text.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
      if (bm2) fields.birthDate = bm2[1] + '-' + bm2[2].padStart(2, '0') + '-' + bm2[3].padStart(2, '0');
    }
    // === 性别 ===
    const gm = text.match(/[性別别]\s*[：:＝]*\s*(男|女|MALE|FEMALE)/i);
    if (gm) fields.gender = /男|MALE/i.test(gm[1]) ? '男' : '女';
    if (!fields.gender && /男/.test(clean.slice(0, 100))) fields.gender = '男';
    if (!fields.gender && /女/.test(clean.slice(0, 100))) fields.gender = '女';
    // === 有效期至 — 多格式 ===
    const vt = text.match(/(?:有效期[限至]|有效期限|Valid\s*To|Expir)[：:\s＝]*(\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2})/i);
    if (vt) fields.validTo = vt[1].replace(/\./g, '-');
    if (!fields.validTo) {
      const vt2 = text.match(/至\s*(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/);
      if (vt2) fields.validTo = vt2[1];
    }
    if (!fields.validTo) {
      const vt3 = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日.*(?:有效|到期|期限|长期)/);
      if (vt3) fields.validTo = vt3[1] + '-' + vt3[2].padStart(2, '0') + '-' + vt3[3].padStart(2, '0');
    }
    // 无标签: 取第二个ISO日期（第一个通常是出生日期）
    if (!fields.validTo) {
      const allD = text.match(/\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/g);
      if (allD && allD.length >= 2) fields.validTo = allD[1];
    }

    // === HK身份证日期: DD-MM-YYYY 格式 ===
    if (!fields.birthDate) {
      const hkDate = text.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
      if (hkDate) {
        const d = parseInt(hkDate[1]),
          m = parseInt(hkDate[2]),
          y = parseInt(hkDate[3]);
        if (d <= 31 && m <= 12 && y >= 1900 && y <= 2030) {
          fields.birthDate = y + '-' + hkDate[2].padStart(2, '0') + '-' + hkDate[1].padStart(2, '0');
        }
      }
    }
    // === 国徽面有效期: 2020.06.01-2030.06.01 或 2020-06-01至2030-06-01 ===
    if (!fields.validTo) {
      const evt = text.match(/(?:有效期限|有效期)[：:\s＝]*(?:长期|Long.?Term)/i);
      if (evt) fields.validTo = '长期';
    }
    if (!fields.validTo) {
      const evt2 = text.match(
        /(?:有效期限|有效期)[：:\s＝]*\s*(\d{4})[\.\-\/](\d{1,2})[\.\-\/](\d{1,2})\s*[-至~]\s*(\d{4})[\.\-\/](\d{1,2})[\.\-\/](\d{1,2})/,
      );
      if (evt2) {
        fields.validFrom = evt2[1] + '-' + evt2[2].padStart(2, '0') + '-' + evt2[3].padStart(2, '0');
        fields.validTo = evt2[4] + '-' + evt2[5].padStart(2, '0') + '-' + evt2[6].padStart(2, '0');
      }
    }
    // 国徽面单日期: 有效期限 2030.06.01
    if (!fields.validTo) {
      const evt3 = text.match(/(?:有效期限|有效期)[：:\s＝]*\s*(\d{4})[\.\\/](\d{1,2})[\.\\/](\d{1,2})/);
      if (evt3) fields.validTo = evt3[1] + '-' + evt3[2].padStart(2, '0') + '-' + evt3[3].padStart(2, '0');
    }
    // === 有效期起 ===
    const vf = text.match(/(?:签发日期|Issue\s*Date|簽發日期)[：:\s＝]*(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/i);
    if (vf) fields.validFrom = vf[1];
    // === 签发机关 ===
    const au = text.match(/(?:签发机关|簽發機關|Issuing\s*Authority)\s*[：:＝]*\s*(.+?)(?:\n|$)/i);
    if (au) fields.issuingAuthority = au[1].trim();
    if (!fields.issuingAuthority) {
      const au2 = clean.match(/([\u4e00-\u9fff]{2,}公安局[\u4e00-\u9fff分局]*(?:出入境[\u4e00-\u9fff]*)?)/);
      if (au2) fields.issuingAuthority = au2[1];
    }
    // === 地址 ===
    const ad = text.match(/(?:住址|地址)\s*[：:＝]*\s*(.+?)(?:\n|$|签发|有效|公民|民族)/);
    if (ad) fields.address = ad[1].trim();
    // === 学位 ===
    if (/博士|Doctor|Ph\.D/i.test(text)) fields.degree = '博士';
    else if (/硕士|Master|M\.S|M\.A/i.test(text)) fields.degree = '硕士';
    else if (/学士|本科|Bachelor|B\.S|B\.A/i.test(text)) fields.degree = '学士';
    // === 院校 ===
    const un = clean.match(
      /([\u4e00-\u9fff]{2,}(?:大学|學院|学院|University|College|Institute)[\u4e00-\u9fffA-Za-z]*)/,
    );
    if (un) fields.school = un[1].trim();
    return fields;
  } /** OCR字段值变更 */,
  onFieldChange(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    const ocrFields = { ...this.data.ocrFields, [field]: value };
    const ocrFieldList = this.data.ocrFieldList.map((item) => (item.key === field ? { ...item, value } : item));
    this.setData({ ocrFields, ocrFieldList });
  },

  /** Step3 → Step4: 确认OCR结果，进入分类选择。卡槽入口自动跳过 */
  confirmAndProceed() {
    const ocrFields = this.data.ocrFields;
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
        notes: '',
      },
    });
  },

  /** 取消添加，返回证件夹 */
  cancelAdd() {
    wx.showModal({
      title: '放弃添加',
      content: '当前已填写的信息将不会保存，确定离开吗？',
      confirmText: '确定离开',
      cancelText: '继续填写',
      success: function (res) {
        if (res.confirm) wx.navigateBack();
      },
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
        notes: '',
      },
    });
  },

  /** 重新识别（返回重拍） */
  retakePhoto() {
    this.setData({
      step: 1,
      inputMode: '',
      imagePath: '',
      imageBase64: '',
      imageRotated: 0,
      docType: 'unknown',
      ocrFields: {},
      rawOCRText: '',
      confidence: 0,
      confidencePercent: '0',
      ocrFieldList: [],
      qualityIssues: [],
      qualityResult: null,
    });
  },

  // ===== Bug #5+#8: 旋转+扫描件工具栏 =====

  /** 顺时针旋转90° — Bug #8: 存储旋转角度，confirmImage 时通过 canvas 实际旋转像素 */
  /** 根据证件类型设置双面标签 */
  setSideLabels(docType) {
    const labels = { frontSideLabel: '人像面', backSideLabel: '国徽面' };
    if (docType === 'hk_permit') {
      labels.backSideLabel = '签注面';
    } else if (docType === 'passport') {
      labels.frontSideLabel = '信息页';
      labels.backSideLabel = '签证页';
    } else if (docType === 'marriage_cert') {
      labels.frontSideLabel = '信息页';
      labels.backSideLabel = '盖章页';
    }
    this.setData(labels);
  },

  /** 切换证件面 */
  onSwitchSide(e) {
    const side = e.currentTarget.dataset.side;
    const data = { photoSide: side };
    if (side === 'front' && this.data.frontPhotoPath) data.imagePath = this.data.frontPhotoPath;
    else if (side === 'back' && this.data.backPhotoPath) data.imagePath = this.data.backPhotoPath;
    this.setData(data);
  },

  onRotateImage() {
    const currentDeg = this._rotateDeg || 0;
    const newDeg = (currentDeg + 90) % 360;
    this._rotateDeg = newDeg;
    // CSS 预览旋转（视觉反馈，最终像素旋转在 confirmImage 中）
    this.setData({ imageRotated: newDeg });
    wx.showToast({ title: '已旋转 ' + newDeg + '°', icon: 'none', duration: 800 });
  },

  /** 扫描件效果增强 — Bug #2修复: 超时兜底 */
  onToggleScanMode() {
    wx.showToast({ title: '拍摄清晰原图即可', icon: 'none' });
  },

  // ===== Bug #2: 自由模式证件类型选择 =====

  /** 选择拍摄的证件类型（非卡槽模式下显示对应线框图+指引） */
  onSelectFreeDocType(e) {
    const value = e.currentTarget.dataset.value;
    const guide = getFreeDocGuide(value);
    // Bug #12: 按证件类型设置隐私覆盖条
    const overlay = DOC_PRIVACY_OVERLAY[value] || DOC_PRIVACY_OVERLAY['id_card'];
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
          notes: '',
        },
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
        success: function (res) {
          if (res.confirm) wx.navigateTo({ url: '/subpkg-chat/pages/membership/index' });
        },
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
            if (res.confirm) wx.navigateTo({ url: '/subpkg-chat/pages/membership/index' });
          },
        });
        return;
      }
    }

    // 直接保存，跳过授权弹窗
    this.doActualSave(docCategory, ocrFields, manualForm, imagePath, docType);
  },

  doActualSave: async function (docCategory, ocrFields, manualForm, imagePath, docType) {
    this.setData({ saving: true });

    // 生成证件ID
    const docId = 'DOC_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

    // 选中的分类信息
    const categoryInfo =
      this.data.categories.find(function (c) {
        return c.value === docCategory;
      }) || {};

    // 保存图片到本地文件系统 — 先持久化再存元数据
    let filePath = imagePath;
    if (imagePath) {
      try {
        const fs = wx.getFileSystemManager();
        // 确保 vault 目录存在
        const vaultBase = wx.env.USER_DATA_PATH + '/vault/';
        try {
          fs.accessSync(vaultBase);
        } catch (_) {
          fs.mkdirSync(vaultBase, true);
        }
        const catDir = vaultBase + docCategory + '/';
        try {
          fs.accessSync(catDir);
        } catch (_) {
          fs.mkdirSync(catDir, true);
        }
        // 持久化到 vault 目录
        const ext = (imagePath.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi, '');
        const persistPath = catDir + docId + '.' + ext;
        try {
          fs.copyFileSync(imagePath, persistPath);
          filePath = persistPath;
        } catch (ce) {
          // copyFile失败：temp文件可能已被清理，尝试read+write
          try {
            const data = fs.readFileSync(imagePath);
            fs.writeFileSync(persistPath, data, 'binary');
            filePath = persistPath;
          } catch (rw) {
            console.error('[保存] 文件读写失败:', rw.message);
            filePath = imagePath; // 降级
          }
        }
      } catch (e) {
        console.error('[保存] 持久化失败:', e.message);
        filePath = imagePath; // 降级使用原始路径
      }
    }

    // 构建证件元数据
    const name = ocrFields.name || manualForm.name || categoryInfo.label + '证件';
    const docNumber =
      ocrFields.idNumber || ocrFields.passportNumber || ocrFields.hkIdNumber || manualForm.docNumber || '';
    const now = new Date().toISOString();

    // 推导 docType：OCR 模式用识别结果，人工模式从分类推导
    let effectiveDocType = docType;
    if (effectiveDocType === 'unknown' && docCategory) {
      // 人工录入场景：从分类映射到基础 docType，确保卡槽匹配
      const categoryTypeMap = {
        identity: 'id_card',
        education: 'degree',
        work: 'work_proof',
        assets: 'bank_statement',
        approved: 'approval_notice',
        renewal: 'visa',
        permanent: 'visa',
      };
      effectiveDocType = categoryTypeMap[docCategory] || 'unknown';
    }

    const doc = {
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
      updatedAt: now,
      // Bug #4 修复: 保存证件面信息，供卡槽标签使用
      photoSide: this.data.photoSide || 'front',
      frontPhotoPath: this.data.frontPhotoPath || '',
      backPhotoPath: this.data.backPhotoPath || '',
    };

    // 保存元数据到Storage
    saveDocumentMeta(doc);

    // 同步家庭空间文档状态（仅布尔，不传文件）
    const slotKey = this._slotKey;
    if (slotKey) {
      wx.cloud
        .callFunction({
          name: 'family-space-manage',
          data: { action: 'set-doc-status', slotKey: slotKey, filled: true },
        })
        .catch(function () {
          /* 静默失败：家庭空间不可用时不影响本地保存 */
        });
    }

    this.setData({ saving: false });

    // 显示备份留存信息
    const bakName = '住港伴_' + docCategory + '_' + docId + '.jpg';
    wx.showModal({
      title: '保存成功 ✅',
      content:
        '证件已加密保存到本地。\n\n📁 持久化备份：微信文件管理 > 住港伴\n文件名：' +
        bakName +
        '\n\n💡 即使清理小程序缓存，备份文件不会丢失。',
      confirmText: '知道了',
      showCancel: false,
      success: function () {
        wx.navigateBack();
      },
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
    } catch (e) {
      return 'none';
    }
  },
});

// 证件指引数据已提取到 data/document-guides.js（文件顶部引入）
// getSlotGuide / getFreeDocGuide / slotToCategory / getPrivacyBars 均从该模块导入
