// 住港伴 — 里程碑验证页
const { validateMilestone } = require('../../../utils/rule-engine');
const { extractFields } = require('../../../utils/ocr');
const { getProcessLine, saveProcessLine, saveDocumentMeta, saveFile } = require('../../../utils/storage');

Page({
  data: {
    status: '',
    processId: '',
    stageId: '',
    milestoneType: '',
    label: '',
    imagePath: '',
    ocrResult: null,
    verifyResult: null,
    verifying: false,
    retryCount: 0
  },

  onLoad(options) {
    this.setData({
      status: options.status || '',
      processId: options.processId || '',
      stageId: options.stageId || '',
      milestoneType: options.milestoneType || '',
      label: options.label || '上传材料',
      retryCount: wx.getStorageSync('__milestone_retry__') || 0
    });
  },

  takePhoto() {
    wx.chooseMedia({
      count: 1, mediaType: ['image'], sourceType: ['camera'],
      success: (res) => {
        this.setData({ imagePath: res.tempFiles[0].tempFilePath });
        this.runVerify(res.tempFiles[0].tempFilePath);
      }
    });
  },

  chooseFromAlbum() {
    wx.chooseMedia({
      count: 1, mediaType: ['image'], sourceType: ['album'],
      success: (res) => {
        this.setData({ imagePath: res.tempFiles[0].tempFilePath });
        this.runVerify(res.tempFiles[0].tempFilePath);
      }
    });
  },

  async runVerify(imagePath) {
    this.setData({ verifying: true });
    try {
      // OCR识别
      let docType = 'hk_id';
      if (this.data.milestoneType === 'submission_receipt') docType = 'approval_letter';
      else if (this.data.milestoneType === 'hk_pr_id') docType = 'hk_id';

      const result = await extractFields(imagePath, docType);

      // 里程碑验证
      const validation = validateMilestone(this.data.status, result.fields);
      this.setData({ ocrResult: result, verifyResult: validation, verifying: false });

      if (validation.valid) {
        // 存档为里程碑材料
        const docId = `MILESTONE_${Date.now()}`;
        await saveFile(imagePath, docId, 'visas');
        saveDocumentMeta({
          id: docId, name: this.data.label, category: 'visas',
          categoryLabel: '里程碑', ocrData: result.fields,
          ocrVerified: true, isMilestone: true, createdAt: new Date().toISOString()
        });

        // 调用 process-manager 云函数验证里程碑
        if (this.data.processId && this.data.stageId) {
          try {
            var vmRes = await wx.cloud.callFunction({
              name: 'process-manager',
              data: {
                action: 'verifyMilestone',
                processId: this.data.processId,
                stageId: this.data.stageId,
                docId: docId,
                ocrResult: {
                  docTypeDetected: docType,
                  applicationNumber: result.fields.applicationNumber || '',
                  dateField: result.fields.dateField || '',
                  numberField: result.fields.numberField || ''
                }
              }
            });
            if (vmRes.result.code === 0) {
              // 写入 __process_stage__ 供攻略书联动
              var BRIDGE = require('../../../data/constants').STAGE_BRIDGE_MAP;
              var stageIdx = parseInt(this.options.stageIndex) || 0;
              var uiStage = BRIDGE.stageToUiStage(this.data.stageId, stageIdx + 1);
              wx.setStorageSync('__process_stage__', uiStage);
            }
          } catch(e) {
            console.warn('[里程碑验证] process-manager调用异常:', e);
          }
        }

        wx.showToast({ title: '验证通过！', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 1000);
      } else {
        // 失败: 仅提示，不锁定
        wx.showToast({ title: '验证失败: ' + (validation.reason || '材料不符'), icon: 'none', duration: 2500 });
      }
    } catch (e) {
      console.error('[验证] 失败:', e);
      this.setData({ verifying: false, verifyResult: { valid: false, reason: 'OCR识别失败，请重新拍摄' } });
    }
  },

  retry() {
    this.setData({ imagePath: '', ocrResult: null, verifyResult: null });
  }
});
