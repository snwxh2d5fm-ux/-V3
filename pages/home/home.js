// pages/home/home.js - 住港伴首页引导页（PRD v4 路由分发）
// 职责：判断登录态 → 路由到正确目标页面
const app = getApp();

Page({
  data: {
    loading: true,
    unauthenticated: false,
    locked: false,
    membershipDays: 0
  },

  onLoad() {
    this.checkAndRoute();
  },

  onShow() {
    // 从设置页退出后重新检查
    if (!this.data.loading) {
      this.checkAndRoute();
    }
  },

  async checkAndRoute() {
    this.setData({ loading: true });

    try {
      const userData = wx.getStorageSync('user_data');
      const sessionToken = wx.getStorageSync('__session__');

      // 未登录 → 展示欢迎页
      if (!userData || !sessionToken) {
        this.setData({ loading: false, unauthenticated: true });
        return;
      }

      // 检查会员锁定
      const profile = wx.getStorageSync('__user_profile__') || {};
      const isLocked = profile.isLocked || false;
      const freeTrialEnd = profile.freeTrialEndAt;

      if (isLocked) {
        this.setData({ loading: false, locked: true });
        return;
      }

      // 试用到期提示
      if (freeTrialEnd) {
        const daysLeft = Math.ceil((new Date(freeTrialEnd) - new Date()) / 86400000);
        if (daysLeft <= 30 && daysLeft > 0) {
          this.setData({ membershipDays: daysLeft });
        }
      }

      // 已登录 → 判断新用户还是回访
      const isNew = profile.isNew !== false;
      if (isNew) {
        // 新用户 → 状态选择页
        wx.redirectTo({ url: '/pages/status-select/status-select' });
      } else {
        // 回访用户 → 流程控 Tab
        wx.switchTab({ url: '/pages/process/index/index' });
      }
    } catch (e) {
      // 异常情况 → 展示欢迎页
      this.setData({ loading: false, unauthenticated: true });
    }
  },

  // ========== 未登录状态 ==========
  handleLogin(e) {
    const { code } = e.detail;
    if (!code) return;

    this.setData({ loading: true });
    wx.showLoading({ title: '登录中...' });

    // 调用云函数完成微信登录
    wx.cloud.callFunction({
      name: 'user-auth',
      data: { action: 'login', code: code }
    }).then((res) => {
      wx.hideLoading();
      var result = res.result || {};
      if (result.code === 0 && result.data && result.data.token) {
        // 保存登录态
        wx.setStorageSync('__session__', result.data.token);
        wx.setStorageSync('user_data', result.data.user || {});
        // 跳转状态选择
        wx.redirectTo({ url: '/pages/status-select/status-select' });
      } else {
        wx.showToast({ title: '登录失败，请重试', icon: 'none' });
        this.setData({ loading: false });
      }
    }).catch((err) => {
      wx.hideLoading();
      console.error('[home] 登录失败:', err);
      wx.showToast({ title: '网络异常，请检查网络后重试', icon: 'none' });
      this.setData({ loading: false });
    });
  },

  // ========== 锁定状态 ==========
  goPaywall() {
    wx.navigateTo({ url: '/subpkg-chat/pages/membership/index' });
  },

  // ========== 通用 ==========
  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  onShareAppMessage() {
    return {
      title: '住港伴 — 香港身份全流程陪伴工具',
      path: '/pages/home/home'
    };
  }
});
