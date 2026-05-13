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

      // Bug #14 修复: 过滤本地已删除订单，防止云端删除失败后重新出现
      var deleted = wx.getStorageSync('__deleted_orders__') || [];
      if (deleted.length > 0) {
        orders = orders.filter(function(o) { return deleted.indexOf(o.orderId) < 0; });
      }

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
  },

  deleteOrder: function(e) {
    var orderId = e.currentTarget.dataset.id;
    var that = this;
    wx.showModal({
      title: '删除订单',
      content: '确定删除该订单记录？删除后不可恢复。',
      confirmColor: '#DC2626',
      success: function(res) {
        if (res.confirm) {
          // 先从本地UI移除
          var orders = that.data.orders.filter(function(o) { return o.orderId !== orderId; });
          that.setData({ orders: orders, empty: orders.length === 0 });
          // 同步删除本地缓存
          var local = wx.getStorageSync('__user_orders__') || [];
          local = local.filter(function(o) { return o.orderId !== orderId; });
          wx.setStorageSync('__user_orders__', local);
          // Bug #14 修复: 云端删除持久化 + 本地删除标记防重现
          wx.cloud.callFunction({
            name: 'payment',
            data: { action: 'deleteOrder', orderId: orderId }
          }).catch(function() {
            // 云端删除失败 → 写入本地黑名单，loadOrders时过滤
            var deleted = wx.getStorageSync('__deleted_orders__') || [];
            if (deleted.indexOf(orderId) < 0) deleted.push(orderId);
            wx.setStorageSync('__deleted_orders__', deleted);
          });
          wx.showToast({ title: '已删除', icon: 'none' });
        }
      }
    });
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
