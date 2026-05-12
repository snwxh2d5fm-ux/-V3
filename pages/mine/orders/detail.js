/**
 * pages/mine/orders/detail — 订单详情
 *
 * URL 参数: orderId
 * 功能: 查看订单详情 + 已完成订单可申请发票
 */
var app = getApp();

Page({
  data: {
    loading: true,
    order: null,
    notFound: false,
    canInvoice: false,
    hasInvoice: false
  },

  onLoad: function(options) {
    var orderId = options.orderId;
    if (!orderId) {
      this.setData({ notFound: true, loading: false });
      return;
    }
    this.orderId = orderId;
    this.loadDetail();
  },

  onShow: function() {
    // 从发票申请页返回时刷新发票状态
    if (this.orderId && this.data.canInvoice && !this.data.hasInvoice) {
      this.checkInvoice();
    }
  },

  loadDetail: function() {
    var that = this;

    wx.cloud.callFunction({
      name: 'payment',
      data: { action: 'getOrderStatus', orderId: that.orderId }
    }).then(function(res) {
      var result = res.result || {};
      if (result.code !== 0) {
        that.setData({ notFound: true, loading: false });
        return;
      }

      var o = result.data;
      that.setData({
        loading: false,
        order: {
          orderId: o.orderId,
          productName: o.productName,
          amount: o.amount,
          amountYuan: (o.amount / 100).toFixed(2),
          status: o.status,
          statusLabel: getStatusText(o.status),
          subscriptionActivated: o.subscriptionActivated
        },
        canInvoice: o.status === 'completed'
      });

      // 检查是否已有发票
      if (o.status === 'completed') {
        that.checkInvoice();
      }
    }).catch(function() {
      that.setData({ notFound: true, loading: false });
    });
  },

  checkInvoice: function() {
    var that = this;
    wx.cloud.callFunction({
      name: 'payment',
      data: { action: 'getInvoices', limit: 50 }
    }).then(function(res) {
      var payload = (res.result && res.result.data) || {};
      var data = payload.list || [];
      var found = data.filter(function(inv) {
        return inv.orderId === that.orderId;
      });
      if (found.length > 0) {
        that.setData({ hasInvoice: true, invoiceStatus: found[0].status });
      }
    }).catch(function() {});
  },

  applyInvoice: function() {
    wx.navigateTo({
      url: '/pages/mine/invoice/apply?orderId=' + this.orderId
    });
  },

  viewInvoice: function() {
    wx.navigateTo({
      url: '/pages/mine/invoice/list'
    });
  },

  goBack: function() {
    wx.navigateBack();
  }
});

function getStatusText(status) {
  var map = {
    pending: '待支付',
    completed: '已支付',
    failed: '已失效',
    cancelled: '已取消'
  };
  return map[status] || status;
}
