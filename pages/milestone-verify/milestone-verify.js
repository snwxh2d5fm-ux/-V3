// 住港伴 — 里程碑验证页
const { validateMilestone } = require('../../utils/rule-engine');
const { extractFields } = require('../../utils/ocr');
const { getProcessLine, saveProcessLine, saveDocumentMeta, saveFile } = require('../../utils/storage');

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

        // 解锁流程阶段
        if (this.data.processId) {
          const process = getProcessLine(this.data.processId);
          if (process && this.data.stageId) {
            const stage = process.stages.find(s => s.id === this.data.stageId);
            if (stage) {
              stage.unlocked = true;
              stage.status = 'current';
              stage.startedAt = new Date().toISOString();
              process.currentStage = stage.name;
              saveProcessLine(process);
            }
          }
        }

        // 调用状态选择页回调
        const pages = getCurrentPages();
        const prevPage = pages[pages.length - 2];
        if (prevPage && prevPage.saveStatus) {
          prevPage.saveStatus(this.data.status, result.fields);
        }
        wx.setStorageSync('__milestone_retry__', 0);
        wx.showToast({ title: '验证通过！', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 1000);
      } else {
        const retryCount = (this.data.retryCount || 0) + 1;
        wx.setStorageSync('__milestone_retry__', retryCount);
        if (retryCount >= 3) {
          wx.showModal({
            title: '验证失败次数过多', content: '请24小时后再试，或联系客服',
            showCancel: false, confirmText: '知道了'
          });
        }
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
