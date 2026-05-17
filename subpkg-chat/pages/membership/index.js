/**
 * pages/membership/index — 会员方案选择与支付
 *
 * 流程:
 *   1. 加载会员方案（cloud function: payment.getPlans）
 *   2. 用户选择方案 → 点击"立即订阅"
 *   3. createOrder → cloud.cloudPay.unifiedOrder → 返回 payment params
 *   4. wx.requestPayment → 用户确认支付
 *   5. 支付成功 → 刷新会员状态
 */
var app = getApp();
var constants = require('../../../data/constants.js');

Page({
  data: {
    loading: true,
    plans: [],
    currentLevel: 'free',
    isLocked: false,
    selectedPlanId: '',
    selectedPeriod: 'yearly',  // yearly | monthly
    paying: false,
    showResult: false,
    resultSuccess: false,
    resultMsg: ''
  },

  onLoad: function() {
    this.loadMembershipStatus();
    this.loadPlans();
  },

  onShow: function() {
    // 每次进入刷新会员状态
    this.loadMembershipStatus();
  },

  // ========== 加载会员状态 ==========
  loadMembershipStatus: function() {
    var that = this;
    wx.cloud.callFunction({
      name: 'payment',
      data: { action: 'checkSubscription' }
    }).then(function(res) {
      var data = (res.result && res.result.data) || {};
      that.setData({
        currentLevel: data.level || 'free',
        isLocked: data.isLocked || false,
        statusLoaded: true
      });
    }).catch(function() {
      // 降级：读本地缓存
      var profile = wx.getStorageSync('__user_profile__') || {};
      that.setData({
        currentLevel: profile.membership || 'free',
        isLocked: profile.isLocked || false,
        statusLoaded: true
      });
    });
  },

  // ========== 加载方案列表 ==========
  loadPlans: function() {
    var that = this;
    wx.cloud.callFunction({
      name: 'payment',
      data: { action: 'getPlans' }
    }).then(function(res) {
      var plans = (res.result && res.result.data) || [];
      // 价格单位分→元（用于展示）
      var displayPlans = plans.map(function(p) {
        // 年付比月付省多少（百分比）
        var savingsPercent = Math.round(Math.abs((1 - p.priceMonthly * 12 / p.priceYearly) * 100));
        return {
          planId: p.planId,
          planName: p.planName,
          level: p.level,
          priceMonthly: p.priceMonthly,
          priceYearly: p.priceYearly,
          priceMonthlyYuan: (p.priceMonthly / 100).toFixed(2),
          priceYearlyYuan: (p.priceYearly / 100).toFixed(2),
          savingsPercent: savingsPercent,
          features: p.features || [],
          highlighted: p.highlighted || false,
          badge: p.badge || ''
        };
      });
      that.setData({ plans: displayPlans, loading: false });
    }).catch(function(e) {
      console.error('[membership] 加载方案失败:', e);
      // 降级：使用本地常量
      var fallbackPlans = [
        {
          planId: 'basic', planName: '基础会员', level: 'basic',
          priceMonthly: 3990, priceYearly: 39900,
          priceMonthlyYuan: '39.90', priceYearlyYuan: '399', savingsPercent: 20,
          features: ['无限AI问答', '个性化材料清单', '申请时间线', '政策追踪提醒', '7年路径规划'],
          highlighted: false, badge: '热门'
        },
        {
          planId: 'pro', planName: '专业会员', level: 'pro',
          priceMonthly: 29990, priceYearly: 299900,
          priceMonthlyYuan: '299.90', priceYearlyYuan: '2,999', savingsPercent: 20,
          features: ['基础会员全部权益', 'AI材料生成（6类文档）', '续签仪表盘', '文档审查', '面试模拟', '优先响应'],
          highlighted: true, badge: '推荐'
        },
        {
          planId: 'premium', planName: '尊享会员', level: 'premium',
          priceMonthly: 69990, priceYearly: 699900,
          priceMonthlyYuan: '699.90', priceYearlyYuan: '6,999', savingsPercent: 20,
          features: ['专业会员全部权益', '香港AI创业孵化', '跨境电商资源整合', '政府创业补贴政策资讯'],
          highlighted: false, badge: '尊享'
        }
      ];
      that.setData({ plans: fallbackPlans, loading: false });
    });
  },

  // ========== 切换年付/月付 ==========
  switchPeriod: function(e) {
    var period = e.currentTarget.dataset.period;
    this.setData({ selectedPeriod: period });
  },

  // ========== 选择方案 → 发起支付 ==========
  selectPlan: function(e) {
    var planId = e.currentTarget.dataset.planId;
    var level = e.currentTarget.dataset.level;

    // 已是当前等级 → 提示
    if (level === this.data.currentLevel) {
      wx.showToast({ title: '已是当前会员等级', icon: 'none' });
      return;
    }

    this.setData({ selectedPlanId: planId });
    this.startPayment(planId);
  },

  // ========== 支付流程 ==========
  startPayment: function(planId) {
    var that = this;
    if (that.data.paying) return;

    that.setData({ paying: true });
    wx.showLoading({ title: '创建订单...' });

    wx.cloud.callFunction({
      name: 'payment',
      data: {
        action: 'createOrder',
        planId: planId,
        period: that.data.selectedPeriod
      }
    }).then(function(res) {
      wx.hideLoading();
      var result = res.result;

      if (result.code !== 0 || !result.data || !result.data.payment) {
        wx.showToast({
          title: (result && result.msg) || '支付下单失败',
          icon: 'none',
          duration: 2000
        });
        that.setData({ paying: false });
        return;
      }

      var paymentData = result.data;
      // 调用微信支付
      wx.requestPayment({
        timeStamp: paymentData.payment.timeStamp,
        nonceStr: paymentData.payment.nonceStr,
        package: paymentData.payment.package,
        signType: paymentData.payment.signType || 'MD5',
        paySign: paymentData.payment.paySign,
        success: function() {
          that.setData({ paying: false });
          // 主动确认支付（补充服务端回调）
          wx.cloud.callFunction({
            name: 'payment',
            data: { action: 'confirmPayment', orderId: paymentData.orderId }
          });
          that.showPaymentResult(true, paymentData.orderId);
        },
        fail: function(err) {
          that.setData({ paying: false });
          if (err.errMsg && err.errMsg.indexOf('cancel') > -1) {
            wx.showToast({ title: '已取消支付', icon: 'none' });
          } else {
            that.showPaymentResult(false, paymentData.orderId);
          }
        }
      });
    }).catch(function(err) {
      wx.hideLoading();
      console.error('[membership] 支付异常:', err);
      wx.showToast({ title: '支付服务异常，请稍后重试', icon: 'none' });
      that.setData({ paying: false });
    });
  },

  // ========== 支付结果 ==========
  showPaymentResult: function(success, orderId) {
    var that = this;
    that.setData({
      showResult: true,
      resultSuccess: success,
      resultMsg: success ? '支付成功！会员已激活' : '支付失败，请重试'
    });

    if (success) {
      // 刷新会员状态
      setTimeout(function() {
        that.loadMembershipStatus();
      }, 500);
    }
  },

  hideResult: function() {
    this.setData({ showResult: false });
  },

  // ========== 快捷入口 ==========

  goOrders: function() {
    wx.navigateTo({ url: '/subpkg-chat/pages/orders/index' });
  },

  goInvoices: function() {
    wx.navigateTo({ url: '/subpkg-chat/pages/invoice-list/index' });
  },

  // ========== 返回 ==========
  goBack: function() {
    wx.navigateBack();
  }
});
