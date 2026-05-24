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
    retryCount: 0,
  },

  onLoad(options) {
    this.setData({
      status: options.status || '',
      processId: options.processId || '',
      localProcessId: options.localProcessId || options.processId || '',
      stageId: options.stageId || '',
      milestoneType: options.milestoneType || '',
      label: options.label || '上传材料',
      retryCount: wx.getStorageSync('__milestone_retry__') || 0,
    });
  },

  takePhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      success: (res) => {
        this.setData({ imagePath: res.tempFiles[0].tempFilePath });
        this.runVerify(res.tempFiles[0].tempFilePath);
      },
    });
  },

  chooseFromAlbum() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album'],
      success: (res) => {
        this.setData({ imagePath: res.tempFiles[0].tempFilePath });
        this.runVerify(res.tempFiles[0].tempFilePath);
      },
    });
  },

  async runVerify(imagePath) {
    this.setData({ verifying: true });
    try {
      // 先上传图片到云存储，获取 fileID（云函数只能访问云存储文件）
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: 'milestones/' + Date.now() + '_' + Math.random().toString(36).substring(2, 6) + '.jpg',
        filePath: imagePath,
      });
      const cloudFileID = uploadRes.fileID;

      // OCR识别（通过云存储 fileID）
      let docType = 'hk_id';
      if (this.data.milestoneType === 'submission_receipt') docType = 'approval_letter';
      else if (this.data.milestoneType === 'hk_pr_id') docType = 'hk_id';

      let result;
      result = await extractFields(cloudFileID, docType);
      const detectedDocType = result.docType || ''; // 空类型 → 云函数放行

      // 里程碑验证
      const validation = validateMilestone(this.data.status, result.fields);
      this.setData({ ocrResult: result, verifyResult: validation, verifying: false });

      if (validation.valid) {
        // 存档为里程碑材料
        const docId = `MILESTONE_${Date.now()}`;
        await saveFile(imagePath, docId, 'visas');
        saveDocumentMeta({
          id: docId,
          name: this.data.label,
          category: 'visas',
          categoryLabel: '里程碑',
          ocrData: result.fields,
          ocrVerified: true,
          isMilestone: true,
          createdAt: new Date().toISOString(),
        });

        // ★ 本地推进：找第一个 in_progress → completed，下一个 locked → in_progress
        const stageIndex = parseInt(this.options.stageIndex) || 0;
        const app = getApp();
        const localId = this.data.localProcessId || this.data.processId;
        try {
          const { getAllProcessLines: gl, saveProcessLine: sp } = require('../../../utils/storage');
          const ls = gl();
          const line = ls.find(function (l) {
            return l.id === localId || l._id === localId || l.cloudId === localId;
          });
          if (line && line.stages) {
            // 找第一个 in_progress → completed
            let doneIdx = -1;
            for (let si = 0; si < line.stages.length; si++) {
              if (line.stages[si].status === 'in_progress') {
                doneIdx = si;
                break;
              }
            }
            if (doneIdx >= 0) {
              line.stages[doneIdx].status = 'completed';
              line.stages[doneIdx].steps = (line.stages[doneIdx].steps || []).map(function (st) {
                return Object.assign({}, st, { status: 'completed', completedAt: new Date().toISOString() });
              });
              // 下一个 locked → in_progress
              if (doneIdx + 1 < line.stages.length && line.stages[doneIdx + 1].status === 'locked') {
                line.stages[doneIdx + 1].status = 'in_progress';
                line.stages[doneIdx + 1].steps = (line.stages[doneIdx + 1].steps || []).map(function (st) {
                  return Object.assign({}, st, { status: 'pending' });
                });
              }
              sp(line);
              app.globalData.activeProcess = line;
              const newStage = Math.min(doneIdx + 1, 6);
              wx.setStorageSync('__process_stage__', newStage);
            } else {
              console.warn('[里程碑验证] 无 in_progress 阶段');
            }

            // ★ 里程碑事件
            const MILESTONE_EVENTS = {
              1: 'preparation_done',
              2: 'application_submitted',
              3: 'awaiting_approval',
              4: 'approval_activated',
            };
            const evt = MILESTONE_EVENTS[stageIndex] || '';
            if (evt) {
              const events = wx.getStorageSync('__milestone_events__') || [];
              events.push({ event: evt, stageIdx: stageIndex, ts: Date.now() });
              wx.setStorageSync('__milestone_events__', events);
              app.globalData._lastMilestoneEvent = evt;
            }
          } else {
            console.warn('[里程碑验证] 未找到流程线');
          }
        } catch (se) {
          console.warn('[里程碑验证] 同步失败:', se);
        }

        // ★ 标记数据已更新，流程控 onShow 据此刷新
        wx.setStorageSync('__process_data_version__', Date.now());
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
  },
});
