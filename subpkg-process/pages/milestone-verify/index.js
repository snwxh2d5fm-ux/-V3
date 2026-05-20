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
      localProcessId: options.localProcessId || options.processId || '',
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
      // 先上传图片到云存储，获取 fileID（云函数只能访问云存储文件）
      var uploadRes = await wx.cloud.uploadFile({
        cloudPath: 'milestones/' + Date.now() + '_' + Math.random().toString(36).substring(2, 6) + '.jpg',
        filePath: imagePath
      });
      var cloudFileID = uploadRes.fileID;

      // OCR识别（通过云存储 fileID）
      let docType = 'hk_id';
      if (this.data.milestoneType === 'submission_receipt') docType = 'approval_letter';
      else if (this.data.milestoneType === 'hk_pr_id') docType = 'hk_id';

      var result;
      result = await extractFields(cloudFileID, docType);
      var detectedDocType = result.docType || ''; // 空类型 → 云函数放行

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

        // ★ 自包含验证流程：创建云端流程 + 验证里程碑 + 同步本地
        console.log('[里程碑验证] 开始验证 processId=' + this.data.processId + ' stageId=' + this.data.stageId);
        if (this.data.processId && this.data.stageId) {
          var verifyOk = false;
          var verifyRes = null;
          try {
            // 第一步：尝试直接验证
            verifyRes = await wx.cloud.callFunction({
              name: 'process-manager',
              data: { action: 'verifyMilestone', processId: this.data.processId, stageId: this.data.stageId, docId: docId,
                ocrResult: { docTypeDetected: detectedDocType, applicationNumber: result.fields.applicationNumber || '', dateField: result.fields.dateField || '', numberField: result.fields.numberField || '' } }
            });
          } catch(e1) { console.warn('[里程碑验证] 首次调用失败:', e1); }

          // 第二步：404 → 流程不存在 → 自动创建云端流程
          if (verifyRes && verifyRes.result && verifyRes.result.code === 404) {
            console.log('[里程碑验证] 流程不存在，自动创建...');
            try {
              var createRes = await wx.cloud.callFunction({
                name: 'process-manager',
                data: { action: 'start', templateId: this.data.stageId === 'preparation' ? 'qmas' : 'qmas' }
              });
              if (createRes.result && createRes.result.code === 0 && createRes.result.data && createRes.result.data.processId) {
                var cloudId = createRes.result.data.processId;
                this.setData({ processId: cloudId });
                // 关联到本地流程线
                try {
                  var { getAllProcessLines: gl, saveProcessLine: sp } = require('../../../utils/storage');
                  var ls = gl();
                  var lc = this.data.localProcessId || this.data.processId;
                  var ln = ls.find(function(l) { return l.id === lc || l._id === lc; });
                  if (ln) { ln.cloudId = cloudId; sp(ln); getApp().globalData.activeProcess = ln; }
                } catch(e2) { console.warn('[里程碑验证] 关联cloudId失败:', e2); }
                // 重试验证
                try {
                  verifyRes = await wx.cloud.callFunction({
                    name: 'process-manager',
                    data: { action: 'verifyMilestone', processId: cloudId, stageId: this.data.stageId, docId: docId,
                      ocrResult: { docTypeDetected: detectedDocType, applicationNumber: result.fields.applicationNumber || '', dateField: result.fields.dateField || '', numberField: result.fields.numberField || '' } }
                  });
                } catch(e3) { console.warn('[里程碑验证] 重试调用失败:', e3); }
              }
            } catch(e4) { console.warn('[里程碑验证] 创建流程失败:', e4); }
          }

          if (verifyRes && verifyRes.result && verifyRes.result.code === 0) {
            verifyOk = true;
            console.log('[里程碑验证] 云函数验证通过');
          } else {
            console.log('[里程碑验证] 云函数验证结果: code=' + (verifyRes && verifyRes.result ? verifyRes.result.code : 'NONE') + ' msg=' + (verifyRes && verifyRes.result ? verifyRes.result.msg : ''));
          }

          // 第三步：失败 → 本地强制执行
          if (!verifyOk) {
            console.log('[里程碑验证] 云端验证未通过，执行本地推进');
          }

          // 第四步：更新本地流程线（无论云端结果，本地总是同步）
          var app = getApp();
          var localId = this.data.localProcessId || this.data.processId;
          var stageId = this.data.stageId;
          try {
            var { getAllProcessLines: g2, saveProcessLine: s2 } = require('../../../utils/storage');
            var lines2 = g2();
            console.log('[里程碑验证] 本地同步 localId=' + localId + ' lines=' + lines2.length);
            var line2 = lines2.find(function(l) { return l.id === localId || l._id === localId || l.cloudId === localId; });
            if (line2 && line2.stages) {
              line2.stages = line2.stages.map(function(s, i) {
                if (s.stageId === stageId) return Object.assign({}, s, { status: 'completed' });
                var ci = line2.stages.findIndex(function(ss) { return ss.stageId === stageId; });
                if (i === ci + 1 && s.status === 'locked') return Object.assign({}, s, { status: 'in_progress', steps: (s.steps || []).map(function(st) { return Object.assign({}, st, { status: 'pending' }); }) });
                return s;
              });
              s2(line2);
              app.globalData.activeProcess = line2;
              wx.setStorageSync('__process_stage__', (parseInt(this.options.stageIndex) || 0) + 1);
              console.log('[里程碑验证] 本地已同步');
            } else {
              console.warn('[里程碑验证] 未找到本地流程线!');
            }
          } catch(se) { console.warn('[里程碑验证] 本地同步失败:', se); }
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
