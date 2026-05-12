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
    stageStatus: null
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

    this.setData({ loading: true });

    // 获取用户已上传的文档
    var userDocs = storage.getAllDocuments();
    if (!userDocs || !userDocs.length) {
      wx.showToast({ title: '证件夹为空，请先上传材料', icon: 'none' });
      this.setData({ loading: false });
      return;
    }

    // 构建批量子审请求（含ocrFields兜底）
    var batchDocs = userDocs.map(function(d) {
      return {
        doc_id: d.docId || d.id || '',
        extracted_fields: d.ocrData || d.extractedFields || d.ocrFields || {}
      };
    }).filter(function(d) { return d.doc_id; });

    if (!batchDocs.length) {
      wx.showToast({ title: '添加证件后即可使用预审', icon: 'none' });
      this.setData({ loading: false });
      return;
    }

    preaudit.batchCheck(batchDocs, {
      userPath: self.data.selectedProcess
    }).then(function(res) {
      self.setData({ loading: false });
      if (res && res.ok) {
        self.setData({ checkResult: res });
        wx.navigateTo({
          url: '/pages/precheck/check/check?processId=' + self.data.selectedProcess +
               '&total=' + (res.total || 0) + '&blocked=' + (res.blocked || 0) + '&warning=' + (res.warning || 0)
        });
      } else {
        var msg = (res && res.msg) || '预审服务暂不可用';
        wx.showModal({
          title: '预审提示',
          content: msg + '\n\n请确认已上传证件并重试。',
          showCancel: false
        });
      }
    }).catch(function(err) {
      self.setData({ loading: false });
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
