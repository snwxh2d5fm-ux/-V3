/**
 * pages/mine/invoice/detail — 发票详情
 *
 * URL 参数: invoiceId
 * 功能: 展示完整发票信息
 */
var app = getApp();

Page({
  data: {
    loading: true,
    invoice: null,
    notFound: false
  },

  onLoad: function(options) {
    var invoiceId = options.invoiceId;
    if (!invoiceId) {
      this.setData({ notFound: true, loading: false });
      return;
    }
    this.invoiceId = invoiceId;
    this.loadDetail();
  },

  loadDetail: function() {
    var that = this;
    wx.cloud.callFunction({
      name: 'payment',
      data: { action: 'getInvoiceDetail', invoiceId: that.invoiceId }
    }).then(function(res) {
      var result = res.result || {};
      if (result.code !== 0) {
        that.setData({ notFound: true, loading: false });
        return;
      }
      var inv = result.data;
      that.setData({
        loading: false,
        invoice: {
          invoiceId: inv.invoiceId,
          orderId: inv.orderId,
          productName: inv.productName,
          orderAmountYuan: inv.orderAmountYuan,
          invoiceType: inv.invoiceType,
          invoiceTypeLabel: inv.invoiceType === 'company' ? '企业发票' : '个人发票',
          title: inv.title,
          taxNumber: inv.taxNumber,
          email: inv.email,
          address: inv.address,
          phone: inv.phone,
          bankInfo: inv.bankInfo,
          status: inv.status,
          statusLabel: getStatusText(inv.status),
          statusClass: getStatusClass(inv.status),
          createdAt: formatTime(inv.createdAt),
          issuedAt: inv.issuedAt ? formatTime(inv.issuedAt) : ''
        }
      });
    }).catch(function() {
      that.setData({ notFound: true, loading: false });
    });
  },

  goBack: function() {
    wx.navigateBack();
  }
});

function getStatusText(status) {
  var map = { pending: '处理中', issued: '已开具', rejected: '已退回' };
  return map[status] || status;
}

function getStatusClass(status) {
  var map = { pending: 'status-pending', issued: 'status-issued', rejected: 'status-rejected' };
  return map[status] || '';
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  var d = new Date(dateStr);
  var y = d.getFullYear();
  var m = pad(d.getMonth() + 1);
  var day = pad(d.getDate());
  var h = pad(d.getHours());
  var min = pad(d.getMinutes());
  return y + '-' + m + '-' + day + ' ' + h + ':' + min;
}

function pad(n) { return n < 10 ? '0' + n : '' + n; }
