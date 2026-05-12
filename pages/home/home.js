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
    
    // 模拟登录流程
    wx.showLoading({ title: '登录中...' });
    setTimeout(() => {
      wx.hideLoading();
      
      // 保存用户数据
      const userData = {
        phone: '',
        createdAt: new Date().toISOString()
      };
      wx.setStorageSync('user_data', userData);
      wx.setStorageSync('__session__', 'session_' + Date.now());
      wx.setStorageSync('__user_profile__', { 
        isNew: true, 
        membership: 'free',
        freeTrialEndAt: new Date(Date.now() + 180 * 86400000).toISOString()
      });

      // 新用户 → 状态选择
      wx.redirectTo({ url: '/pages/status-select/status-select' });
    }, 800);
  },

  // ========== 锁定状态 ==========
  goPaywall() {
    wx.navigateTo({ url: '/pages/membership/index/index' });
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
