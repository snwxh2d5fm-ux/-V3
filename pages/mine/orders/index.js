/**
 * pages/mine/orders/index — 我的订单列表
 *
 * 入口：会员中心 → 我的订单
 * 数据来源：payment.getUserOrders
 */
var app = getApp();

Page({
  data: {
    loading: true,
    orders: [],
    empty: false
  },

  onShow: function() {
    this.loadOrders();
  },

  loadOrders: function() {
    var that = this;
    that.setData({ loading: true });

    wx.cloud.callFunction({
      name: 'payment',
      data: { action: 'getUserOrders', limit: 50 }
    }).then(function(res) {
      var result = res.result || {};
      var orders = (result.data || []).map(function(o) {
        return {
          orderId: o.orderId,
          productName: o.productName,
          amountYuan: o.amountYuan,
          category: o.category,
          status: o.status,
          statusLabel: getStatusLabel(o.status),
          statusClass: getStatusClass(o.status),
          createdAt: formatTime(o.createdAt),
          completedAt: o.completedAt ? formatTime(o.completedAt) : ''
        };
      });

      that.setData({
        loading: false,
        orders: orders,
        empty: orders.length === 0
      });
    }).catch(function() {
      that.setData({ loading: false, empty: true });
    });
  },

  viewDetail: function(e) {
    var orderId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/mine/orders/detail?orderId=' + orderId });
  },

  goBack: function() {
    wx.navigateBack();
  }
});

// ========== 工具函数 ==========

function getStatusLabel(status) {
  var map = {
    pending: '待支付',
    completed: '已支付',
    failed: '已失效',
    cancelled: '已取消'
  };
  return map[status] || status;
}

function getStatusClass(status) {
  var map = {
    pending: 'status-pending',
    completed: 'status-completed',
    failed: 'status-failed',
    cancelled: 'status-cancelled'
  };
  return map[status] || '';
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  var d = new Date(dateStr);
  var y = d.getFullYear();
  var m = pad(d.getMonth() + 1);
  var day = pad(d.getDate());
  return y + '-' + m + '-' + day;
}

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}
