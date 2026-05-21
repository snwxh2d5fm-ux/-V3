/**
 * 住港伴 v4 — 我的页面
 * 会员中心 + 隐私中心 + 数据管理 + DB迭代入口
 */
const app = getApp();
const { getAllDocuments, getAllReminders } = require('../../../utils/storage');
const { getAuthorizedFields } = require('../../../utils/desensitize');
const { getGlobalStages, getActiveStageIndex } = require('../../../utils/stage-helper');
const constants = require('../../../data/constants');

Page({
  data: {
    stageSteps: [],
    stageProgress: 0,
    isLoggedIn: false,
    userInfo: null,
    userStatus: null,
    membershipLevel: 'free',
    membershipName: '免费会员',
    isPayingUser: false,
    documentCount: 0,
    documentLimit: 10, // 免费用户10，付费用户∞
    documentLimitDisplay: '10', // 展示用（免费=10，付费=∞）
    usagePercent: 0,
    reminderCount: 0,
    authorizedFields: 0,
    privacyDays: 0,
    menuItems: [
      { id: 'documents', icon: '📁', title: '我的证件', desc: '', url: '/pages/documents/index/index', tab: true },
      { id: 'process', icon: '📊', title: '我的流程', desc: '', url: '/pages/process/index/index', tab: true },
      { id: 'privacy', icon: '🛡', title: '隐私中心', desc: '', url: 'privacy-center' },
      { id: 'membership', icon: '💳', title: '会员中心', desc: '', url: 'membership' },
      { id: 'family', icon: '👨‍👩‍👧', title: '家庭空间', desc: '', url: 'family-space' },
    ],
    settingsItems: [
      { id: 'notify', icon: '🔔', title: '通知设置', url: 'notify-settings' },
      { id: 'feedback', icon: '💬', title: '意见反馈', url: 'feedback' },
      { id: 'share-records', icon: '📤', title: '分享记录', url: 'share-records' },
      // admin-db 入口仅内部使用，C端不暴露
    ],
  },

  onShow() {
    try {
      this.setData({
        stageSteps: getGlobalStages(),
        stageProgress: Math.min(((getActiveStageIndex() + 1) / 7) * 100, 100),
      });
    } catch (e) {
      this.setData({ stageProgress: 14 });
    }
    this.loadProfile();
  },

  loadProfile() {
    const isLoggedIn = app.globalData.isLoggedIn;
    const userInfo = app.globalData.userInfo;
    const userStatus = app.globalData.userStatus || 'unapplied';
    const membershipLevel = app.globalData.membershipLevel || 'free';
    const isPayingUser = constants.isPayingMember(membershipLevel);
    const documents = getAllDocuments();
    const reminders = getAllReminders();
    const fields = getAuthorizedFields();

    // 付费会员无限证件位
    const maxDocs = constants.getEffectiveLimit(membershipLevel, 'maxDocuments');
    const docLimitDisplay = isPayingUser ? '∞' : String(maxDocs);

    const statusMap = {
      unapplied: '未申请',
      submitted: '申请处理中',
      approved: '在港进行中',
      permanent: '已获永居',
    };

    this.setData({
      isLoggedIn,
      userInfo: userInfo || { nickName: '住港伴用户' },
      userStatus,
      userStatusLabel: statusMap[userStatus] || '',
      membershipLevel,
      membershipName: constants.MEMBERSHIP_NAMES[membershipLevel] || '免费会员',
      isPayingUser,
      documentCount: documents.length,
      documentLimit: maxDocs,
      documentLimitDisplay: docLimitDisplay,
      usagePercent: isPayingUser ? 0 : Math.min(100, Math.round((documents.length / maxDocs) * 100)),
      reminderCount: reminders.filter((r) => r.status === 'active').length,
      authorizedFields: fields ? fields.length : 0,
      privacyDays: Math.floor((Date.now() - new Date('2025-12-30').getTime()) / 86400000),
    });

    // 异步拉取云端会员状态（不阻塞渲染）
    this.syncMembershipFromCloud();
  },

  /** 从云函数获取最新会员状态 */
  syncMembershipFromCloud: function () {
    const that = this;
    wx.cloud
      .callFunction({
        name: 'payment',
        data: { action: 'checkSubscription' },
      })
      .then(function (res) {
        const data = (res.result && res.result.data) || {};
        if (data.level) {
          const level = data.level === 'free_trial' ? 'free' : data.level;
          const isPayingUser = constants.isPayingMember(level);
          const maxDocs = constants.getEffectiveLimit(level, 'maxDocuments');
          that.setData({
            membershipLevel: level,
            membershipName: constants.MEMBERSHIP_NAMES[level] || '免费会员',
            isPayingUser: isPayingUser,
            documentLimit: maxDocs,
            documentLimitDisplay: isPayingUser ? '∞' : String(maxDocs),
            usagePercent: isPayingUser ? 0 : Math.min(100, Math.round((documents.length / maxDocs) * 100)),
            membershipDays: data.daysRemaining || 0,
            isLocked: data.isLocked || false,
          });
          // 同步到全局
          app.globalData.membershipLevel = level;
          app.globalData.isLocked = data.isLocked || false;
        }
      })
      .catch(function () {
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
    } else if (url === 'redeem') {
      wx.navigateTo({ url: '/subpkg-chat/pages/redeem/index' });
    } else if (url === 'feedback') {
      wx.navigateTo({ url: '/subpkg-feedback/pages/submit/index' });
    } else if (url === 'family-space') {
      this.goFamilySpace();
    } else if (url === 'share-records') {
      wx.navigateTo({ url: '/subpkg-share/pages/share-records/index' });
    } else if (url === 'notify-settings') {
      wx.navigateTo({ url: '/pages/mine/notify-settings/notify-settings' });
    } else if (tab) {
      wx.switchTab({ url });
    } else {
      wx.navigateTo({ url });
    }
  },

  // 隐私中心
  showPrivacyCenter() {
    wx.navigateTo({ url: '/subpkg-chat/pages/privacy/index' });
  },

  // 会员中心
  showMembership() {
    wx.navigateTo({ url: '/subpkg-chat/pages/membership/index' });
  },

  // 家庭空间（基础会员及以上可用）
  goFamilySpace() {
    if (!this.data.isPayingUser) {
      wx.showModal({
        title: '会员功能',
        content: '家庭空间为基础会员及以上专属功能，升级后即可添加家属共享证件与提醒。',
        confirmText: '去升级',
        success: function (res) {
          if (res.confirm) {
            wx.navigateTo({ url: '/subpkg-chat/pages/membership/index' });
          }
        },
      });
      return;
    }
    wx.navigateTo({ url: '/subpkg-share/pages/family-invite/index' });
  },

  // 分享
  onShareAppMessage() {
    return {
      title: '我正在使用住港伴，你也来看看',
      path: '/pages/index/index',
      imageUrl: '/images/share-cover.png',
    };
  },

  // 退出登录 — V4.2-fix: 清除全量本地数据，防止跨账号泄露
  logout() {
    wx.showModal({
      title: '确认退出',
      content: '退出后本地数据将被清除。数据已在云端保留，重新登录后将自动恢复。',
      success: (res) => {
        if (res.confirm) {
          // 清除所有用户本地数据
          const userKeys = [
            constants.STORAGE_KEYS.SESSION,
            '__processes__', '__reminders__', '__vault_meta__',
            '__user_status__', '__user_sub_status__', '__active_process_id__',
            '__selected_path__', '__onboarding__', '__process_stage__',
            '__cloud_user__', '__user_profile__', '__config__',
            '__assessment_persona__', '__solution_recommendation__',
            '__user_data__',
          ];
          userKeys.forEach(k => { try { wx.removeStorageSync(k); } catch (e) {} });
          app.globalData.isLoggedIn = false;
          app.globalData.userInfo = null;
          wx.reLaunch({ url: '/pages/login/login' });
        }
      },
    });
  },
});
