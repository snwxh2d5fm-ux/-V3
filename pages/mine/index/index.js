/**
 * 住港伴 v4 — 我的页面
 * 会员中心 + 隐私中心 + 数据管理 + DB迭代入口
 */
const app = getApp();
const { getAllDocuments, getAllReminders } = require('../../../utils/storage');
const { getAuthorizedFields } = require('../../../utils/desensitize');
const constants = require('../../../data/constants');

Page({
  data: {
    stageSteps: [
      { id: 'evaluation', label: '资格评估', status: 'active' },
      { id: 'preparation', label: '材料准备', status: 'pending' },
      { id: 'submission', label: '线上申请', status: 'pending' },
      { id: 'waiting', label: '等待获批', status: 'pending' },
      { id: 'activation', label: '获批激活', status: 'pending' },
      { id: 'settlement', label: '抵港生活', status: 'pending' },
      { id: 'pr', label: '永居', status: 'pending' }
    ],
    stageProgress: 14,
    isLoggedIn: false,
    userInfo: null,
    userStatus: null,
    membershipLevel: 'free',
    membershipName: '免费会员',
    documentCount: 0,
    reminderCount: 0,
    authorizedFields: 0,
    privacyDays: 0,
    menuItems: [
      { id: 'documents', icon: '📁', title: '我的证件', desc: '', url: '/pages/documents/index/index', tab: true },
      { id: 'process', icon: '📊', title: '我的流程', desc: '', url: '/pages/process/index/index', tab: true },
      { id: 'privacy', icon: '🛡', title: '隐私中心', desc: '', url: 'privacy-center' },
      { id: 'membership', icon: '💳', title: '会员中心', desc: '', url: 'membership' }
    ],
    settingsItems: [
      { id: 'notify', icon: '🔔', title: '通知设置' },
      { id: 'about', icon: 'ℹ️', title: '关于住港伴' },
      { id: 'feedback', icon: '💬', title: '意见反馈' },
      // admin-db 入口仅内部使用，C端不暴露
    ]
  },

  onShow() {
    this.loadProfile();
  },

  loadProfile() {
    const isLoggedIn = app.globalData.isLoggedIn;
    const userInfo = app.globalData.userInfo;
    const userStatus = app.globalData.userStatus || 'unapplied';
    const membershipLevel = app.globalData.membershipLevel || 'free';
    const documents = getAllDocuments();
    const reminders = getAllReminders();
    const fields = getAuthorizedFields();

    const statusMap = {
      unapplied: '未申请', submitted: '申请处理中', approved: '在港进行中', permanent: '已获永居'
    };

    this.setData({
      isLoggedIn,
      userInfo: userInfo || { nickName: '住港伴用户' },
      userStatus,
      userStatusLabel: statusMap[userStatus] || '',
      membershipLevel,
      membershipName: constants.MEMBERSHIP_NAMES[membershipLevel] || '免费会员',
      documentCount: documents.length,
      reminderCount: reminders.filter(r => r.status === 'active').length,
      authorizedFields: fields ? fields.length : 0,
      privacyDays: Math.floor((Date.now() - new Date('2025-12-30').getTime()) / 86400000)
    });

    // 异步拉取云端会员状态（不阻塞渲染）
    this.syncMembershipFromCloud();
  },

  /** 从云函数获取最新会员状态 */
  syncMembershipFromCloud: function() {
    var that = this;
    wx.cloud.callFunction({
      name: 'payment',
      data: { action: 'checkSubscription' }
    }).then(function(res) {
      var data = (res.result && res.result.data) || {};
      if (data.level) {
        var level = data.level === 'free_trial' ? 'free' : data.level;
        that.setData({
          membershipLevel: level,
          membershipName: constants.MEMBERSHIP_NAMES[level] || '免费会员',
          membershipDays: data.daysRemaining || 0,
          isLocked: data.isLocked || false
        });
        // 同步到全局
        app.globalData.membershipLevel = level;
      }
    }).catch(function() {
      // 降级使用本地数据
    });
  },

  // 导航
  navigateTo(e) {
    const { url, tab } = e.currentTarget.dataset;
    if (!url) return;

    if (url === 'privacy-center') {
      this.showPrivacyCenter();
    } else if (url === 'membership') {
      this.showMembership();
    } else if (tab) {
      wx.switchTab({ url });
    } else {
      wx.navigateTo({ url });
    }
  },

  // 隐私中心
  showPrivacyCenter() {
    wx.navigateTo({ url: '/pages/privacy/index/index' });
  },

  // 会员中心
  showMembership() {
    wx.navigateTo({ url: '/pages/membership/index/index' });
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '确认退出',
      content: '退出后本地数据不会丢失，但需要重新登录才能使用云同步功能',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync(constants.STORAGE_KEYS.SESSION);
          app.globalData.isLoggedIn = false;
          app.globalData.userInfo = null;
          wx.reLaunch({ url: '/pages/login/login' });
        }
      }
    });
  }
});
