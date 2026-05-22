/**
 * 住港伴 V1 — 通知设置页 (极简版)
 *
 * V1 阶段仅管理 2 条锁定通知：
 *   CRT-01: 签证到期提醒 (不可关闭)
 *   ACC-01: 免费试用到期提醒 (不可关闭)
 *
 * 页面本质是"通知告知卡"，非"通知配置面板"。
 * 遵循合规、安全、便捷三原则。
 */

const app = getApp();

// 微信订阅消息模板 ID (V1 仅一个通用模板)
const TMPL_REMIND = 'h3_x4HVt6xq_fVQXGv5DQCgi8J58pBvJtIcH9OIAd-k';
const STORAGE_KEY = '__notify_v1__';

Page({
  data: {
    // 两条通知的状态
    crt01: {
      id: 'CRT-01',
      title: '签证到期提醒',
      icon: '🔴',
      desc: '签证到期前 90/60/30/14/7/3/1 天逐级提醒',
      reason: '签证到期直接导致身份失效，关掉可能导致严重后果',
      tmplAuth: 'unknown', // 'authorized' | 'needs_auth' | 'rejected'
    },
    acc01: {
      id: 'ACC-01',
      title: '免费试用到期提醒',
      icon: '💳',
      desc: '免费试用到期前 30/14/7/3/1 天提醒',
      reason: '确保你不会在不知情的情况下失去服务使用权',
      tmplAuth: 'unknown',
    },

    // 系统权限
    systemNotifyEnabled: true, // 微信系统级通知权限
    showSystemWarning: false,

    // 用户状态: permanent 时 CRT-01 自动停用
    userStatus: '',
    isPermanent: false,
  },

  onLoad: function () {
    this.loadAuthStatus();
    this.checkSystemPermission();
    this.loadUserStatus();
  },

  onShow: function () {
    // 每次进入页面刷新授权状态 (用户可能从系统设置回来)
    this.checkSystemPermission();
    this.loadAuthStatus();
  },

  /**
   * 读取本地存储的模板授权状态
   */
  loadAuthStatus: function () {
    let settings = {};
    try {
      settings = wx.getStorageSync(STORAGE_KEY) || {};
    } catch (e) {}

    const tmplAuth = settings.tmplAuth && settings.tmplAuth.TMPL_REMIND;
    let authState = 'needs_auth';
    if (tmplAuth === true) {
      authState = 'authorized';
    } else if (tmplAuth === false) {
      authState = 'rejected';
    }

    this.setData({
      'crt01.tmplAuth': authState,
      'acc01.tmplAuth': authState,
    });
  },

  /**
   * 检测微信系统级通知权限
   */
  checkSystemPermission: function () {
    const that = this;
    wx.getSetting({
      success: function (res) {
        const itemSettings = res.subscriptionsSetting || {};
        // itemSettings.mainSwitch: 系统级通知总开关
        // itemSettings.itemSettings: { [tmplId]: 'accept'|'reject'|'ban' }
        const mainSwitch = itemSettings.mainSwitch !== false;
        that.setData({
          systemNotifyEnabled: mainSwitch,
          showSystemWarning: !mainSwitch,
        });

        // 如果 mainSwitch 为 false，标记所有为 rejected
        if (!mainSwitch) {
          that.setData({
            'crt01.tmplAuth': 'rejected',
            'acc01.tmplAuth': 'rejected',
          });
        }
      },
      fail: function () {
        // 降级: 假设权限正常 (避免误告警)
        that.setData({ systemNotifyEnabled: true, showSystemWarning: false });
      },
    });
  },

  /**
   * 读取用户状态 (permanent 时 CRT-01 自动停用)
   */
  loadUserStatus: function () {
    let userStatus = app.globalData.userStatus || '';
    try {
      userStatus = userStatus || wx.getStorageSync('__user_status__') || '';
    } catch (e) {}

    const isPermanent = userStatus === 'permanent';
    this.setData({
      userStatus: userStatus,
      isPermanent: isPermanent,
    });
  },

  /**
   * 触发订阅消息授权
   */
  requestAuth: function () {
    const that = this;
    wx.requestSubscribeMessage({
      tmplIds: [TMPL_REMIND],
      success: function (res) {
        // res[TMPL_REMIND] 可能为 'accept' | 'reject' | 'ban'
        const accepted = res[TMPL_REMIND] === 'accept';

        // 保存授权状态到本地
        let settings = {};
        try {
          settings = wx.getStorageSync(STORAGE_KEY) || {};
        } catch (e) {}
        if (!settings.tmplAuth) settings.tmplAuth = {};
        settings.tmplAuth.TMPL_REMIND = accepted;
        if (!settings.meta) settings.meta = {};
        settings.meta.lastUpdated = new Date().toISOString();
        wx.setStorageSync(STORAGE_KEY, settings);

        // 同步到云端
        that.syncToCloud(accepted);

        const authState = accepted ? 'authorized' : 'rejected';
        that.setData({
          'crt01.tmplAuth': authState,
          'acc01.tmplAuth': authState,
        });

        if (accepted) {
          wx.showToast({ title: '授权成功', icon: 'success' });
        } else {
          wx.showToast({ title: '已拒绝授权', icon: 'none' });
        }
      },
      fail: function (err) {
        // 用户勾选"总是保持以上选择"后不再弹窗，直接进 fail
        console.warn('[notify-settings] subscribeMessage fail:', err);
        wx.showToast({ title: '授权失败，请前往微信设置', icon: 'none', duration: 2000 });
      },
    });
  },

  /**
   * 同步模板授权状态到云端
   */
  syncToCloud: function (accepted) {
    wx.cloud
      .callFunction({
        name: 'user-auth',
        data: {
          action: 'syncNotifyPrefs',
          prefs: {
            tmplAuth: { TMPL_REMIND: accepted },
          },
        },
      })
      .catch(function (err) {
        console.warn('[notify-settings] cloud sync failed:', err);
        // 本地已保存，云同步失败不阻塞
      });
  },

  /**
   * 打开微信系统设置
   */
  openSystemSetting: function () {
    wx.openSetting({
      success: function () {
        // 用户从设置页返回后，onShow 会重新检测权限
      },
    });
  },
});
