/**
 * pages/mine/invoice/list — 发票记录列表
 *
 * 入口: 会员中心 → 发票管理
 * 数据: payment.getInvoices
 */
const app = getApp();

Page({
  data: {
    loading: true,
    invoices: [],
    empty: false,
  },

  onShow: function () {
    this.loadInvoices();
  },

  loadInvoices: function () {
    const that = this;
    that.setData({ loading: true });

    wx.cloud
      .callFunction({
        name: 'payment',
        data: { action: 'getInvoices', limit: 50 },
      })
      .then(function (res) {
        const result = res.result || {};
        const payload = result.data || {};
        const invoices = (payload.list || []).map(function (inv) {
          return {
            invoiceId: inv.invoiceId,
            orderId: inv.orderId,
            productName: inv.productName,
            orderAmountYuan: inv.orderAmountYuan,
            invoiceType: inv.invoiceType,
            title: inv.title,
            status: inv.status,
            statusLabel: getStatusLabel(inv.status),
            statusClass: getStatusClass(inv.status),
            createdAt: formatTime(inv.createdAt),
            issuedAt: inv.issuedAt ? formatTime(inv.issuedAt) : '',
          };
        });

        that.setData({
          loading: false,
          invoices: invoices,
          empty: invoices.length === 0,
          total: payload.total || 0,
          hasMore: payload.hasMore || false,
        });
      })
      .catch(function () {
        that.setData({ loading: false, empty: true });
      });
  },

  viewDetail: function (e) {
    const invoiceId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/subpkg-chat/pages/invoice-detail/index?invoiceId=' + invoiceId });
  },

  loadMore: function () {
    const that = this;
    const offset = that.data.invoices.length;
    wx.cloud
      .callFunction({
        name: 'payment',
        data: { action: 'getInvoices', limit: 20, offset: offset },
      })
      .then(function (res) {
        const payload = (res.result && res.result.data) || {};
        const newItems = (payload.list || []).map(function (inv) {
          return {
            invoiceId: inv.invoiceId,
            orderId: inv.orderId,
            productName: inv.productName,
            orderAmountYuan: inv.orderAmountYuan,
            invoiceType: inv.invoiceType,
            title: inv.title,
            status: inv.status,
            statusLabel: getStatusLabel(inv.status),
            statusClass: getStatusClass(inv.status),
            createdAt: formatTime(inv.createdAt),
            issuedAt: inv.issuedAt ? formatTime(inv.issuedAt) : '',
          };
        });
        that.setData({
          invoices: that.data.invoices.concat(newItems),
          hasMore: payload.hasMore || false,
        });
      });
  },

  goBack: function () {
    wx.navigateBack();
  },
});

function getStatusLabel(status) {
  const map = { pending: '处理中', issued: '已开具', rejected: '已退回' };
  return map[status] || status;
}

function getStatusClass(status) {
  const map = { pending: 'status-pending', issued: 'status-issued', rejected: 'status-rejected' };
  return map[status] || '';
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  return y + '-' + m + '-' + day;
}

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}
