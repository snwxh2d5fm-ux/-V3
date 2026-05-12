// 住港伴 — 效率宝预审检查页（v1.0：显示逐项预审结果）
var preaudit = require('../../../utils/preaudit');
var storage = require('../../../utils/storage');

Page({
  data: {
    processId: '',
    total: 0,
    blocked: 0,
    warning: 0,
    items: [],
    loading: true
  },

  onLoad: function(options) {
    var self = this;
    this.setData({
      processId: options.processId || '',
      total: parseInt(options.total, 10) || 0,
      blocked: parseInt(options.blocked, 10) || 0,
      warning: parseInt(options.warning, 10) || 0
    });

    // 重新执行逐文档预审以获取详细结果
    var userDocs = storage.getAllDocuments();
    if (!userDocs.length) {
      self.setData({ loading: false, items: [] });
      return;
    }

    var promises = userDocs.map(function(d) {
      return preaudit.check(
        d.docId || d.id || '',
        d.ocrData || d.extractedFields || {},
        { userPath: self.data.processId }
      );
    });

    Promise.all(promises).then(function(results) {
      var items = results.map(function(r, idx) {
        if (!r.ok || !r.audit) {
          return {
            name: userDocs[idx].name || '未知文档',
            status: 'unknown',
            icon: '❓',
            detail: r.msg || '预审失败'
          };
        }
        var display = preaudit.formatForDisplay(r.audit);
        return {
          name: r.audit.doc_name || userDocs[idx].name || '未知文档',
          status: r.audit.status,
          icon: display ? display.status_icon : '❓',
          detail: display ? display.summary : '',
          failed_count: display ? (display.stats.blocked + display.stats.warned) : 0
        };
      });

      self.setData({ loading: false, items: items });
    }).catch(function(err) {
      console.error('[效率宝] 逐项预审失败:', err);
      self.setData({ loading: false });
    });
  },

  viewReport: function() {
    wx.navigateTo({
      url: '/pages/precheck/report/report?blocked=' + this.data.blocked
    });
  },

  retryDoc: function(e) {
    var idx = e.currentTarget.dataset.index;
    var doc = storage.getAllDocuments()[idx];
    if (!doc) return;

    var self = this;
    wx.showLoading({ title: '重新预审中...' });

    preaudit.check(
      doc.docId || doc.id || '',
      doc.ocrData || doc.extractedFields || {},
      { userPath: self.data.processId }
    ).then(function(r) {
      wx.hideLoading();
      if (r.ok && r.audit) {
        var display = preaudit.formatForDisplay(r.audit);
        var items = self.data.items.slice();
        items[idx] = {
          name: r.audit.doc_name || doc.name,
          status: r.audit.status,
          icon: display.status_icon,
          detail: display.summary,
          failed_count: display.stats.blocked + display.stats.warned
        };
        self.setData({ items: items });
      } else {
        wx.showToast({ title: r.msg || '预审失败', icon: 'none' });
      }
    });
  }
});
