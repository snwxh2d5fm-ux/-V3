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
    if (!userDocs.length) {
      wx.showToast({ title: '证件夹为空，请先上传材料', icon: 'none' });
      this.setData({ loading: false });
      return;
    }

    // 构建批量子审请求
    var batchDocs = userDocs.map(function(d) {
      return {
        doc_id: d.docId || d.id || '',
        extracted_fields: d.ocrData || d.extractedFields || {}
      };
    }).filter(function(d) { return d.doc_id; });

    preaudit.batchCheck(batchDocs, {
      userPath: self.data.selectedProcess
    }).then(function(res) {
      self.setData({ loading: false });
      if (res.ok) {
        self.setData({ checkResult: res });
        wx.navigateTo({
          url: '/pages/precheck/check/check?processId=' + self.data.selectedProcess +
               '&total=' + res.total + '&blocked=' + res.blocked + '&warning=' + res.warning
        });
      } else {
        wx.showToast({ title: res.msg || '预审服务暂不可用', icon: 'none' });
      }
    }).catch(function(err) {
      self.setData({ loading: false });
      console.error('[效率宝] 预审失败:', err);
      wx.showToast({ title: '网络异常，请重试', icon: 'none' });
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
