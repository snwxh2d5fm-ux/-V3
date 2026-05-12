/**
 * pages/mine/invoice/apply — 发票开具申请
 *
 * URL 参数: orderId
 * 功能: 个人/企业发票申请，提交至 payment.createInvoice
 */
var app = getApp();

Page({
  data: {
    loading: true,
    order: null,
    invoiceType: 'personal',   // personal | company
    form: {
      title: '',
      taxNumber: '',
      email: '',
      address: '',
      phone: '',
      bankInfo: ''
    },
    submitting: false,
    submitted: false,
    resultMsg: ''
  },

  onLoad: function(options) {
    var orderId = options.orderId;
    if (!orderId) {
      wx.showToast({ title: '缺少订单ID', icon: 'none' });
      setTimeout(function() { wx.navigateBack(); }, 1500);
      return;
    }
    this.orderId = orderId;
    this.loadOrderInfo();
  },

  loadOrderInfo: function() {
    var that = this;
    wx.cloud.callFunction({
      name: 'payment',
      data: { action: 'getOrderStatus', orderId: that.orderId }
    }).then(function(res) {
      var result = res.result || {};
      if (result.code !== 0) {
        wx.showToast({ title: '订单不存在', icon: 'none' });
        setTimeout(function() { wx.navigateBack(); }, 1500);
        return;
      }
      var o = result.data;

      // 前置校验：仅已支付订单可申请发票
      if (o.status !== 'completed') {
        wx.showModal({
          title: '无法申请发票',
          content: '仅已支付完成的订单可申请发票',
          showCancel: false,
          success: function() { wx.navigateBack(); }
        });
        return;
      }

      that.setData({
        loading: false,
        order: {
          orderId: o.orderId,
          productName: o.productName,
          amountYuan: (o.amount / 100).toFixed(2)
        }
      });

      // 检查是否已有发票申请
      that.checkExistingInvoice();
    }).catch(function() {
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

  /**
   * 检查该订单是否已有发票申请
   */
  checkExistingInvoice: function() {
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
        var inv = found[0];
        wx.showModal({
          title: '已有发票申请',
          content: '该订单已申请过发票（状态：' + (inv.status === 'issued' ? '已开具' : '处理中') + '），无需重复申请',
          showCancel: false,
          success: function() { wx.navigateBack(); }
        });
      }
    }).catch(function() {});
  },

  // 切换发票类型
  switchType: function(e) {
    var type = e.currentTarget.dataset.type;
    this.setData({ invoiceType: type });
  },

  // 表单输入
  onInput: function(e) {
    var field = e.currentTarget.dataset.field;
    var value = e.detail.value;
    var form = this.data.form;
    form[field] = value;
    this.setData({ form: form });
  },

  // 提交发票申请
  submitInvoice: function() {
    var that = this;
    var form = that.data.form;
    var invoiceType = that.data.invoiceType;

    // 校验
    if (invoiceType === 'company') {
      if (!form.title.trim()) {
        wx.showToast({ title: '请填写公司名称', icon: 'none' });
        return;
      }
      if (!form.taxNumber.trim()) {
        wx.showToast({ title: '请填写税号', icon: 'none' });
        return;
      }
    }

    if (!form.email.trim()) {
      wx.showToast({ title: '请填写接收邮箱', icon: 'none' });
      return;
    }

    // email 简单格式校验
    var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(form.email.trim())) {
      wx.showToast({ title: '邮箱格式不正确', icon: 'none' });
      return;
    }

    that.setData({ submitting: true });
    wx.showLoading({ title: '提交中...' });

    wx.cloud.callFunction({
      name: 'payment',
      data: {
        action: 'createInvoice',
        orderId: that.orderId,
        invoiceType: invoiceType,
        title: form.title.trim(),
        taxNumber: form.taxNumber.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        bankInfo: form.bankInfo.trim()
      }
    }).then(function(res) {
      wx.hideLoading();
      var result = res.result || {};
      if (result.code === 0) {
        that.setData({
          submitting: false,
          submitted: true,
          resultMsg: result.data && result.data.msg || '发票申请已提交'
        });
      } else {
        that.setData({ submitting: false });
        // 已申请过：引导查看
        if (result.code === 400 && result.msg && result.msg.indexOf('已申请过发票') >= 0) {
          wx.showModal({
            title: '已有发票申请',
            content: '该订单已申请过发票，是否查看发票记录？',
            confirmText: '去查看',
            success: function(modalRes) {
              if (modalRes.confirm) {
                wx.redirectTo({ url: '/pages/mine/invoice/list' });
              }
            }
          });
        } else {
          wx.showToast({ title: result.msg || '提交失败', icon: 'none' });
        }
      }
    }).catch(function() {
      wx.hideLoading();
      that.setData({ submitting: false });
      wx.showToast({ title: '网络异常，请重试', icon: 'none' });
    });
  },

  goBack: function() {
    wx.navigateBack();
  },

  viewInvoices: function() {
    wx.redirectTo({ url: '/pages/mine/invoice/list' });
  }
});
