/**
 * 关于住港伴 — 产品介绍 + 法律声明 + 版本信息
 * V4 法律合规版
 */
const app = getApp();

Page({
  data: {
    appVersion: '4.0.0',
    buildNumber: '',
    updateDate: '',
    currentYear: new Date().getFullYear(),
    companyName: '',
    contactEmail: 'gangban@funway.hk',
    icpNumber: ''
  },

  onLoad() {
    this.loadMeta();
  },

  /** 从 app 全局配置或云函数拉取元信息 */
  loadMeta() {
    try {
      const meta = app.globalData.appMeta || {};
      this.setData({
        appVersion: meta.version || '4.0.0',
        buildNumber: meta.buildNumber || '',
        updateDate: meta.updateDate || '2026-05-19',
        companyName: meta.companyName || '',
        contactEmail: meta.contactEmail || '',
        icpNumber: meta.icpNumber || ''
      });
    } catch (e) {
      // 降级使用默认值
    }

    // 异步拉取云端最新版本信息
    this.fetchCloudMeta();
  },

  fetchCloudMeta() {
    const that = this;
    wx.cloud.callFunction({
      name: 'meta',
      data: { action: 'getAppMeta' }
    }).then(function (res) {
      const data = (res.result && res.result.data) || {};
      if (data.version) {
        that.setData({
          appVersion: data.version,
          buildNumber: data.buildNumber || that.data.buildNumber,
          updateDate: data.updateDate || that.data.updateDate,
          companyName: data.companyName || that.data.companyName,
          contactEmail: data.contactEmail || that.data.contactEmail,
          icpNumber: data.icpNumber || that.data.icpNumber
        });
      }
    }).catch(function () {
      // 降级使用本地默认值
    });
  },

  /** 打开隐私政策 */
  openPrivacy() {
    wx.navigateTo({ url: '/subpkg-chat/pages/privacy/index' });
  },

  /** 打开用户服务协议 */
  openTerms() {
    // 用户协议页面，如尚未创建则先展示概要
    wx.showModal({
      title: '用户服务协议',
      content: '用户服务协议详细页面建设中。核心条款已在"服务范围与免责声明"中概要展示。如有疑问请联系客服。',
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  /** 跳转意见反馈 */
  goFeedback() {
    wx.navigateTo({ url: '/subpkg-feedback/pages/submit/index' });
  },

  /** 分享 */
  onShareAppMessage() {
    return {
      title: '住港伴 — 香港身份全流程陪伴工具',
      path: '/pages/home/home',
      imageUrl: ''
    };
  }
});
