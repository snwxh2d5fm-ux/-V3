// pages/mine/settings/settings.js
const app = getApp();

Page({
  data: {
    // 账号信息
    phoneHash: '',
    memberSince: '',
    // 通知开关
    notifyReminder: true,
    notifyPolicy: true,
    notifyUpdate: false,
    // 隐私
    privacyMode: 'L1',
    // 缓存
    cacheSize: '0 MB',
  },

  onLoad() {
    this.loadSettings();
  },

  onShow() {
    this.loadSettings();
  },

  loadSettings() {
    try {
      const settings = wx.getStorageSync('__app_settings__') || {};
      const userData = wx.getStorageSync('user_data') || {};
      const privacyMode = wx.getStorageSync('__privacy_mode__') || 'L1';

      this.setData({
        phoneHash: userData.phone ? userData.phone.slice(0, 3) + '****' + userData.phone.slice(-4) : '',
        memberSince: userData.createdAt || '',
        notifyReminder: settings.notifyReminder !== false,
        notifyPolicy: settings.notifyPolicy !== false,
        notifyUpdate: settings.notifyUpdate === true,
        privacyMode,
      });

      // 计算缓存大小
      this.calcCacheSize();
    } catch (e) {}
  },

  calcCacheSize() {
    try {
      let total = 0;
      const info = wx.getStorageInfoSync();
      total = info.currentSize;
      const sizeMB = (total / 1024).toFixed(1);
      this.setData({ cacheSize: sizeMB + ' KB' });
    } catch (e) {
      this.setData({ cacheSize: '未知' });
    }
  },

  // 通知开关
  toggleReminder(e) {
    this.saveSetting('notifyReminder', e.detail.value);
    this.setData({ notifyReminder: e.detail.value });
  },
  togglePolicy(e) {
    this.saveSetting('notifyPolicy', e.detail.value);
    this.setData({ notifyPolicy: e.detail.value });
  },
  toggleUpdate(e) {
    this.saveSetting('notifyUpdate', e.detail.value);
    this.setData({ notifyUpdate: e.detail.value });
  },

  saveSetting(key, value) {
    try {
      const settings = wx.getStorageSync('__app_settings__') || {};
      settings[key] = value;
      wx.setStorageSync('__app_settings__', settings);
    } catch (e) {}
  },

  // 导航
  goPrivacy() {
    wx.navigateTo({ url: '/subpkg-chat/pages/privacy/index' });
  },

  goAbout() {
    wx.navigateTo({ url: '/subpkg-chat/pages/about/index' });
  },

  clearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '将清除本地缓存的攻略和设置数据，不会删除你的证件和提醒。确定清除？',
      success: (res) => {
        if (res.confirm) {
          try {
            wx.removeStorageSync('__guides_cache__');
            wx.removeStorageSync('__app_settings__');
            wx.showToast({ title: '已清除', icon: 'success' });
            this.calcCacheSize();
          } catch (e) {
            wx.showToast({ title: '清除失败', icon: 'none' });
          }
        }
      },
    });
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后本地数据将被清除。数据已在云端保留，重新登录后将自动恢复。',
      confirmColor: '#d93025',
      success: (res) => {
        if (res.confirm) {
          try {
            // V4.2-fix: 清除全量本地数据，防止跨账号泄露
            const userKeys = [
              'user_data', '__session__',
              '__processes__', '__reminders__', '__vault_meta__',
              '__user_status__', '__user_sub_status__', '__active_process_id__',
              '__selected_path__', '__onboarding__', '__process_stage__',
              '__cloud_user__', '__user_profile__', '__config__',
              '__assessment_persona__', '__solution_recommendation__',
            ];
            userKeys.forEach(k => { try { wx.removeStorageSync(k); } catch (e) {} });
            wx.reLaunch({ url: '/pages/login/login' });
          } catch (e) {
            wx.showToast({ title: '退出失败', icon: 'none' });
          }
        }
      },
    });
  },

  deleteAccount() {
    wx.showModal({
      title: '注销账户',
      content: '⚠️ 将永久删除所有数据，包括证件、提醒和流程记录。此操作不可撤销。',
      confirmColor: '#d93025',
      confirmText: '确认注销',
      success: (res) => {
        if (res.confirm) {
          wx.showModal({
            title: '再次确认',
            content: '所有数据将被永久删除，确定继续？',
            confirmColor: '#d93025',
            success: (res2) => {
              if (res2.confirm) {
                wx.showLoading({ title: '注销中...' });
                // 调用云函数删除服务端数据
                wx.cloud
                  .callFunction({
                    name: 'user-auth',
                    data: { action: 'deleteAccount' },
                  })
                  .then(function () {
                    wx.hideLoading();
                  })
                  .catch(function () {
                    wx.hideLoading();
                  })
                  .finally(function () {
                    try {
                      wx.clearStorageSync();
                      wx.reLaunch({ url: '/pages/login/login' });
                    } catch (e) {
                      wx.showToast({ title: '操作失败', icon: 'none' });
                    }
                  });
              }
            },
          });
        }
      },
    });
  },
});
