// 住港伴 — 效率宝首页（v1.0 重构：对接 preaudit-engine 云函数）
var preaudit = require('../../../utils/preaudit');
var storage = require('../../../utils/storage');
var templates = require('../../../data/templates');

Page({
  data: {
    processes: [],
    selectedProcess: '',
    loading: false,
    checkResult: null,
    stageStatus: null,
    // 预审进度
    showProgress: false,
    progressPercent: 0,
    progressText: '',
    progressStep: ''
  },

  onLoad: function() {
    var processData = templates.processTemplates || [];
    this.setData({ processes: processData });
    this.refreshStageStatus();
  },

  onShow: function() {
    this.refreshStageStatus();
  },

  refreshStageStatus: function() {
    var self = this;
    preaudit.getStageStatus().then(function(res) {
      if (res.ok) {
        self.setData({ stageStatus: res.stage_status });
      }
    });
  },

  selectProcess: function(e) {
    this.setData({
      selectedProcess: e.currentTarget.dataset.id,
      checkResult: null
    });
  },

  runCheck: function() {
    var self = this;
    if (!this.data.selectedProcess) {
      wx.showToast({ title: '请选择目标路径', icon: 'none' });
      return;
    }

    var userDocs = storage.getAllDocuments();
    if (!userDocs || !userDocs.length) {
      wx.showToast({ title: '证件夹为空，请先上传材料', icon: 'none' });
      return;
    }

    // 显示进度面板
    var totalDocs = userDocs.length;
    var estimateMin = Math.max(1, Math.ceil(totalDocs * 0.3));
    self.setData({
      showProgress: true,
      progressPercent: 0,
      progressStep: 'OCR识别',
      progressText: '正在授权读取证件…'
    });

    // Step 1: OCR识别 — 对无ocrData的文档逐个调用ocr-service
    var ocrPromises = [];
    var needOCR = userDocs.filter(function(d) { return !d.ocrData; });

    userDocs.forEach(function(d, idx) {
      if (d.ocrData) {
        ocrPromises.push(Promise.resolve(d));
      } else {
        ocrPromises.push(
          wx.cloud.callFunction({
            name: 'ocr-service',
            data: { action: 'recognize', imagePath: d.filePath || '', docType: d.type || 'id_card' }
          }).then(function(res) {
            var result = res.result || {};
            if (result.code === 0 && result.data) {
              d.ocrData = result.data.fields || result.data;
            }
            var pct = Math.round(((idx + 1) / totalDocs) * 60);
            self.setData({
              progressPercent: pct,
              progressText: 'OCR识别 ' + (idx + 1) + '/' + totalDocs
            });
            return d;
          }).catch(function() {
            var pct = Math.round(((idx + 1) / totalDocs) * 60);
            self.setData({ progressPercent: pct, progressText: 'OCR识别 ' + (idx + 1) + '/' + totalDocs + ' (部分跳过)' });
            return d;
          })
        );
      }
    });

    Promise.all(ocrPromises).then(function(docs) {
      // Step 2: 预审
      self.setData({ progressStep: '规则预审', progressPercent: 65, progressText: '正在逐项核验材料…' });

      var batchDocs = docs.map(function(d) {
        return {
          doc_id: d.docId || d.id || '',
          extracted_fields: d.ocrData || d.extractedFields || d.ocrFields || {}
        };
      }).filter(function(d) { return d.doc_id; });

      if (!batchDocs.length) {
        self.setData({ showProgress: false });
        wx.showToast({ title: '添加证件后即可使用预审', icon: 'none' });
        return;
      }

      return preaudit.batchCheck(batchDocs, { userPath: self.data.selectedProcess }).then(function(res) {
        self.setData({ showProgress: false, progressPercent: 100 });
        if (res && res.ok) {
          wx.navigateTo({
            url: '/pages/precheck/check/check?processId=' + self.data.selectedProcess +
                 '&total=' + (res.total || 0) + '&blocked=' + (res.blocked || 0) + '&warning=' + (res.warning || 0)
          });
        } else {
          wx.showModal({
            title: '预审提示',
            content: (res && res.msg) || '预审服务暂不可用',
            showCancel: false
          });
        }
      });
    }).catch(function(err) {
      self.setData({ showProgress: false });
      console.error('[效率宝] 预审失败:', err);
      wx.showModal({
        title: '预审失败',
        content: '当前无法连接预审服务。请确认网络正常。\n\n(' + ((err && err.errMsg) || '未知错误') + ')',
        showCancel: false
      });
    });
  },

  viewReport: function() {
    if (!this.data.checkResult) return;
    wx.navigateTo({
      url: '/pages/precheck/report/report?blocked=' +
           (this.data.checkResult.blocked || 0)
    });
  }
});
