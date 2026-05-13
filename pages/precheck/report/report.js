// 住港伴 — 效率宝预审报告页（v1.0：显示完整预审报告+免责声明）
var preaudit = require('../../../utils/preaudit');
var storage = require('../../../utils/storage');

Page({
  data: {
    blocked: 0,
    totalDocs: 0,
    report: null,
    loading: true,
    disclaimer: ''
  },

  onLoad: function(options) {
    var self = this;
    this.setData({
      blocked: parseInt(options.blocked, 10) || 0
    });

    // 对全部文档批量预审，生成完整报告
    var userDocs = storage.getAllDocuments();
    this.setData({ totalDocs: userDocs.length });

    var batchDocs = userDocs.map(function(d) {
      return {
        doc_id: d.docId || d.id || '',
        extracted_fields: d.ocrData || d.extractedFields || {}
      };
    }).filter(function(d) { return d.doc_id; });

    preaudit.batchCheck(batchDocs).then(function(res) {
      if (res.ok && res.docs) {
        var formattedDocs = res.docs.map(function(d) {
          return preaudit.formatForDisplay(d);
        });

        var blockedDocs = formattedDocs.filter(function(d) {
          return d && d.stats && d.stats.blocked > 0;
        });
        var warnDocs = formattedDocs.filter(function(d) {
          return d && d.stats && d.stats.blocked === 0 && d.stats.warned > 0;
        });

        // Bug #13: 计算材料完整度百分比
        var totalChecks = formattedDocs.length * 6;
        var passedChecks = formattedDocs.reduce(function(sum, d) {
          var s = d.stats || {};
          return sum + (s.passed || 0);
        }, 0);
        var score = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;

        self.setData({
          loading: false,
          score: score,
          report: {
            total: res.total,
            blocked: res.blocked,
            warning: res.warning,
            docs: formattedDocs,
            blocked_docs: blockedDocs,
            warn_docs: warnDocs,
            can_proceed: res.blocked === 0
          },
          disclaimer: formattedDocs.length > 0
            ? (formattedDocs[0].disclaimer || '')
            : ''
        });
      } else {
        self.setData({ loading: false });
      }
    }).catch(function(err) {
      console.error('[效率宝] 报告生成失败:', err);
      self.setData({ loading: false });
    });
  },

  retakePhoto: function() {
    wx.switchTab({ url: '/pages/documents/index/index' });
  },

  viewDocDetail: function(e) {
    var idx = e.currentTarget.dataset.index;
    var doc = storage.getAllDocuments()[idx];
    if (doc) {
      wx.navigateTo({
        url: '/pages/documents/detail/detail?id=' + (doc.id || '')
      });
    }
  }
});
