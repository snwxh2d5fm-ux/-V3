/**
 * 住港伴 v5 — 入口路由页 (DSG-1 P0-01: 降级为纯路由)
 * 原中枢功能已迁移至 pages/process/index (Tab 4)
 * 登录后做状态检查 → 分发到对应tab
 */
const app = getApp();

Page({
  onLoad() {
    if (!app.globalData.isLoggedIn) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
  },

  onShow() {
    // v5: 直接跳转流程控 (原中枢功能已迁移)
    wx.switchTab({ url: '/pages/process/index/index' });
  },
});
