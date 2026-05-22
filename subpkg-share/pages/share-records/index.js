const app = getApp();

const contentTypeLabels = {
  guide: '攻略指南',
  doc_template: '文档模板',
  policy: '政策解读',
};

Page({
  data: {
    records: [],
    loading: true,
    empty: false,
  },

  onLoad: function (options) {},

  onShow: function () {
    this.loadRecords();
  },

  loadRecords: function () {
    const that = this;
    that.setData({ loading: true, empty: false });

    const db = wx.cloud.database();

    // 先获取当前用户的 openid
    wx.cloud.callFunction({
      name: 'user-auth',
      data: { action: 'getProfile' },
      success: function (authRes) {
        if (authRes.result && authRes.result.code === 0) {
          const userId = authRes.result.data._openid;

          db.collection('share_records')
            .where({ userId: userId })
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get()
            .then(function (res) {
              const list = res.data || [];
              const formatted = that.formatRecords(list);
              that.setData({
                records: formatted,
                loading: false,
                empty: formatted.length === 0,
              });
            })
            .catch(function () {
              wx.showToast({ title: '加载失败', icon: 'none' });
              that.setData({ loading: false, empty: true });
            });
        } else {
          // user-auth 不可用时降级查询 _openid 方式
          that.queryByOpenid(db);
        }
      },
      fail: function () {
        that.queryByOpenid(db);
      },
    });
  },

  queryByOpenid: function (db) {
    // 降级方案: user-auth 不可用时提示用户重新登录
    wx.showToast({ title: '请重新登录后查看', icon: 'none' });
    this.setData({ loading: false, empty: true });
  },

  formatRecords: function (list) {
    const result = [];
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      result.push({
        _id: item._id,
        shareId: item.shareId || item._id,
        contentTitle: item.contentTitle || '未命名分享',
        contentType: item.contentType || '',
        contentTypeLabel: contentTypeLabels[item.contentType] || item.contentType || '未知类型',
        status: item.status || 'active',
        createdAt: item.createdAt ? that.formatTime(item.createdAt) : '',
      });
    }
    return result;
  },

  formatTime: function (date) {
    if (typeof date === 'string') {
      date = new Date(date);
    }
    if (!date || typeof date.getMonth !== 'function') {
      return '';
    }
    const year = date.getFullYear();
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    const hour = ('0' + date.getHours()).slice(-2);
    const minute = ('0' + date.getMinutes()).slice(-2);
    return year + '-' + month + '-' + day + ' ' + hour + ':' + minute;
  },

  onRevoke: function (e) {
    const that = this;
    const shareId = e.currentTarget.dataset.shareId;

    wx.showModal({
      title: '确认撤回',
      content: '撤回后该分享链接将失效，确定要撤回吗？',
      success: function (modalRes) {
        if (modalRes.confirm) {
          that.revokeShare(shareId);
        }
      },
    });
  },

  revokeShare: function (shareId) {
    const that = this;

    wx.cloud.callFunction({
      name: 'share-resolve',
      data: {
        action: 'revoke',
        shareId: shareId,
      },
      success: function (res) {
        const result = res.result;
        if (result && result.code === 0) {
          wx.showToast({ title: '已撤回', icon: 'success' });
          that.loadRecords();
        } else {
          wx.showToast({ title: result.message || '撤回失败', icon: 'none' });
        }
      },
      fail: function () {
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
    });
  },
});
