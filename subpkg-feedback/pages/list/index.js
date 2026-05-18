/**
 * 意见反馈 - 列表/详情合并页 V1
 * 功能：状态筛选、反馈列表、点击展开详情、追加补充说明
 */
Page({
  data: {
    activeTab: '',      // ''=全部, 'submitted'=处理中, 'replied'=已回复, 'closed'=已关闭
    tabs: [
      { key: '', label: '全部' },
      { key: 'submitted', label: '处理中' },
      { key: 'replied', label: '已回复' },
      { key: 'closed', label: '已关闭' }
    ],
    items: [],
    hasMore: false,
    isLoading: false,
    isEmpty: false,

    // 展开详情
    expandedId: '',
    detailData: null,
    detailReplies: [],
    isLoadingDetail: false,

    // 追加补充
    appendText: '',
    isAppending: false
  },

  _initialLoad: true,

  onShow() {
    // 首次加载 / 从提交页返回时刷新列表
    if (this._initialLoad) {
      this._initialLoad = false;
      this.loadList();
    }
  },

  onPullDownRefresh() {
    this.loadList();
  },

  // ===== 状态切换 =====
  onTabChange(e) {
    var tab = e.currentTarget.dataset.tab;
    if (tab === this.data.activeTab) return;
    this.setData({ activeTab: tab, items: [], expandedId: '', detailData: null, detailReplies: [] });
    this.loadList();
  },

  // ===== 加载列表 =====
  loadList() {
    var that = this;
    this.setData({ isLoading: true });

    wx.cloud.callFunction({
      name: 'feedback-submit',
      data: {
        action: 'list',
        status: this.data.activeTab,
        limit: 50
      }
    }).then(function(res) {
      var result = res.result;
      if (result.code === 0) {
        var data = result.data;
        that.setData({
          items: that.formatItems(data.items || []),
          hasMore: data.hasMore,
          isEmpty: data.items.length === 0,
          isLoading: false
        });
      } else if (result.code === 403) {
        // 未登录
        that.setData({ items: [], isEmpty: true, isLoading: false });
      } else {
        that.setData({ isLoading: false });
        wx.showToast({ title: result.msg || '加载失败', icon: 'none' });
      }
    }).catch(function() {
      that.setData({ isLoading: false });
      wx.showToast({ title: '网络异常', icon: 'none' });
    });
  },

  formatItems(items) {
    var typeMap = { bug: '🐛 功能异常', content: '📝 内容错误', other: '💬 其他' };
    var statusMap = {
      submitted: { label: '处理中', cls: 'status-pending' },
      in_progress: { label: '处理中', cls: 'status-pending' },
      replied: { label: '已回复', cls: 'status-replied' },
      closed: { label: '已关闭', cls: 'status-closed' }
    };
    return items.map(function(item) {
      var statusInfo = statusMap[item.status] || { label: item.status, cls: '' };
      return {
        ticketId: item.ticketId,
        typeLabel: typeMap[item.type] || '💬 其他',
        content: safeTruncate(item.content, 50),
        fullContent: item.content,
        status: item.status,
        statusLabel: statusInfo.label,
        statusCls: statusInfo.cls,
        time: formatRelativeTime(item.createdAt),
        hasScreenshot: item.hasScreenshot,
        hasReply: !!item.latestReply,
        latestReply: item.latestReply ? safeTruncate(item.latestReply.content, 40) : ''
      };
    });
  },

  // ===== 展开/收起详情 =====
  onToggleDetail(e) {
    var ticketId = e.currentTarget.dataset.id;
    // 如果已展开同一项，收起
    if (this.data.expandedId === ticketId) {
      this.setData({ expandedId: '', detailData: null, detailReplies: [] });
      return;
    }
    // 加载详情
    this.loadDetail(ticketId);
  },

  loadDetail(ticketId) {
    var that = this;
    this.setData({ expandedId: ticketId, isLoadingDetail: true });

    wx.cloud.callFunction({
      name: 'feedback-submit',
      data: { action: 'detail', ticketId: ticketId }
    }).then(function(res) {
      var result = res.result;
      if (result.code === 0) {
        var d = result.data;
        that.setData({
          detailData: {
            ticketId: d.ticketId,
            typeLabel: ({ bug: '🐛 功能异常', content: '📝 内容错误', other: '💬 其他' })[d.type] || '💬 其他',
            content: d.content,
            screenshot: d.screenshot,
            status: d.status,
            createdAt: formatFullTime(d.createdAt)
          },
          detailReplies: (d.replies || []).map(function(r) {
            return {
              replyId: r.replyId || r._id || '',
              role: r.role,
              roleLabel: r.role === 'service' ? '客服回复' : (r.role === 'user' ? '我的补充' : '系统消息'),
              roleCls: r.role === 'service' ? 'reply-service' : (r.role === 'user' ? 'reply-user' : 'reply-system'),
              content: r.content,
              time: formatFullTime(r.createdAt)
            };
          }),
          isLoadingDetail: false
        });
      } else {
        wx.showToast({ title: result.msg || '加载失败', icon: 'none' });
        that.setData({ expandedId: '', isLoadingDetail: false });
      }
    }).catch(function() {
      wx.showToast({ title: '网络异常', icon: 'none' });
      that.setData({ expandedId: '', isLoadingDetail: false });
    });
  },

  // ===== 追加补充 =====
  onAppendInput(e) {
    this.setData({ appendText: e.detail.value || '' });
  },

  onAppend() {
    var text = this.data.appendText.trim();
    if (!text) {
      wx.showToast({ title: '请输入补充内容', icon: 'none' });
      return;
    }
    if (text.length > 500) {
      wx.showToast({ title: '补充内容不能超过500字', icon: 'none' });
      return;
    }

    var that = this;
    this.setData({ isAppending: true });

    wx.cloud.callFunction({
      name: 'feedback-submit',
      data: {
        action: 'append',
        ticketId: this.data.expandedId,
        content: text
      }
    }).then(function(res) {
      var result = res.result;
      if (result.code === 0) {
        wx.showToast({ title: '已补充', icon: 'success' });
        // 重新加载详情
        that.setData({ appendText: '', isAppending: false });
        that.loadDetail(that.data.expandedId);
      } else {
        wx.showToast({ title: result.msg || '补充失败', icon: 'none' });
        that.setData({ isAppending: false });
      }
    }).catch(function() {
      wx.showToast({ title: '网络异常', icon: 'none' });
      that.setData({ isAppending: false });
    });
  },

  // ===== 预览截图 =====
  onPreviewScreenshot(e) {
    var url = e.currentTarget.dataset.url;
    if (!url) return;
    wx.previewImage({
      urls: [url],
      current: url
    });
  },

  // ===== 跳转 =====
  goToSubmit() {
    wx.navigateTo({ url: '/subpkg-feedback/pages/submit/index' });
  },

  goToWeCom() {
    wx.navigateTo({ url: '/subpkg-feedback/pages/wecom-qr/index' });
  },

  goToHome() {
    wx.switchTab({ url: '/pages/mine/index/index' });
  }
});

// ===== 工具函数 =====
// emoji/多字节安全截断
function safeTruncate(str, maxLen) {
  if (!str) return '';
  var chars = Array.from(str);
  if (chars.length <= maxLen) return str;
  return chars.slice(0, maxLen).join('') + '...';
}

function formatRelativeTime(ts) {
  if (!ts) return '';
  var now = Date.now();
  var diff = now - ts;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  if (diff < 2592000000) return Math.floor(diff / 86400000) + '天前';
  if (diff < 31536000000) return Math.floor(diff / 2592000000) + '个月前';
  return Math.floor(diff / 31536000000) + '年前';
}

function formatFullTime(ts) {
  if (!ts) return '';
  var d = new Date(ts);
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  var h = String(d.getHours()).padStart(2, '0');
  var min = String(d.getMinutes()).padStart(2, '0');
  return y + '-' + m + '-' + day + ' ' + h + ':' + min;
}
