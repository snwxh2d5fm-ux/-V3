// pages/home/home.js - 住港伴首页引导页（PRD v4 路由分发）
// 职责：判断登录态 → 路由到正确目标页面
const app = getApp();

Page({
  data: {
    loading: true,
    unauthenticated: false,
    locked: false,
    membershipDays: 0,
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
      // 兼容新旧两种 session 格式：
      //   旧格式（直接写 token 字符串）：'__session__' = "eyJh..."
      //   新格式（app.saveSession 写入）：'__session__' = { token, userInfo, ... }
      const rawSession = wx.getStorageSync('__session__');
      const isOldFormat = typeof rawSession === 'string';
      const sessionToken = isOldFormat ? rawSession : rawSession && rawSession.token;
      const userData = wx.getStorageSync('user_data') || wx.getStorageSync('__cloud_user__');

      // P1-1: 旧格式迁移日志 — 记录迁移事件便于排查
      if (isOldFormat && sessionToken) {
        console.info('[home] 检测到旧格式session(字符串), 启动静默迁移');
      }

      // 未登录 → 展示欢迎页
      if (!sessionToken) {
        this.setData({ loading: false, unauthenticated: true });
        return;
      }

      // 合并全局状态（新格式 session 直接读取，无需重复调云函数）
      if (rawSession && typeof rawSession === 'object') {
        app.globalData.token = rawSession.token || '';
        app.globalData.userStatus = rawSession.userStatus || 'unapplied';
        app.globalData.membershipLevel = rawSession.membershipLevel || 'free';
        app.globalData.phoneBound = rawSession.phoneBound || false;
        app.globalData.isLoggedIn = true;
      }

      // P1-1: 旧格式静默迁移 → 写入新格式 session 避免下次重复迁移
      if (isOldFormat && sessionToken) {
        wx.setStorageSync('__session__', {
          token: sessionToken,
          userInfo: app.globalData.userInfo || { nickName: '住港伴用户' },
          userStatus: app.globalData.userStatus || 'unapplied',
          membershipLevel: app.globalData.membershipLevel || 'free',
          phoneBound: app.globalData.phoneBound || false,
        });
        // P1-1: 迁移后轻提示，用户无感知但可知道登录态已更新
        wx.showToast({ title: '登录状态已更新', icon: 'none', duration: 1500 });
      }

      // 检查会员锁定（优先从 session 读，降级到 __user_profile__）
      const profile =
        rawSession && typeof rawSession === 'object' ? rawSession : wx.getStorageSync('__user_profile__') || {};
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
      // V4.2-fix: session缺isNew时回退到__cloud_user__/__user_profile__，防止误判
      let isNew = profile.isNew !== false;
      if (profile.isNew === undefined) {
        const cloudUser = wx.getStorageSync('__cloud_user__') || {};
        const userProfile = wx.getStorageSync('__user_profile__') || {};
        isNew = cloudUser.isNew !== false && userProfile.isNew !== false;
      }
      if (isNew) {
        // 新用户 → 状态选择页
        wx.redirectTo({ url: '/pages/status-select/status-select' });
      } else {
        // 回访用户 → 流程控 Tab
        wx.switchTab({ url: '/pages/process/index/index' });
      }
    } catch (e) {
      // 异常情况 → 展示欢迎页
      console.error('[home] checkAndRoute 异常:', e);
      this.setData({ loading: false, unauthenticated: true });
    }
  },

  // ========== 未登录状态 ==========
  async handleLogin(e) {
    const { errMsg, code } = e.detail || {};

    // 用户拒绝授权
    if (errMsg && errMsg.includes('deny')) {
      wx.showToast({ title: '需要授权手机号才能登录', icon: 'none' });
      return;
    }

    // getPhoneNumber 未返回有效 code
    if (errMsg !== 'getPhoneNumber:ok' || !code) {
      wx.showToast({ title: '手机号获取失败，请重试', icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    wx.showLoading({ title: '登录中...' });

    try {
      const res = await wx.cloud.callFunction({
        name: 'user-auth',
        data: { action: 'phoneLogin', phoneCode: code, loginType: 'wechat_phone' },
      });

      wx.hideLoading();
      const result = res.result || {};

      if (result.code === 0 && result.token) {
        // ========== 对齐 login.js cloudLogin 模式 ==========
        const userData = result.data || {};

        // 1. 同步 app.globalData
        app.globalData.isLoggedIn = true;
        app.globalData.token = result.token;
        app.globalData.userInfo = result.userInfo || { nickName: '住港伴用户' };
        app.globalData.userStatus = result.userStatus || 'unapplied';
        app.globalData.membershipLevel = result.membershipLevel || 'free';
        app.globalData.phoneBound = !!(result.phoneBound || userData.phoneBound);
        app.globalData.activeProcessId = userData.activeProcessId || result.activeProcessId || null;
        app.globalData.selectedPath = userData.selectedPath || result.selectedPath || null;

        // 2. 兼容旧版读取路径（checkAndRoute 依赖）
        if (result.data) {
          wx.setStorageSync('user_data', result.data);
          wx.setStorageSync('__user_profile__', result.data);
          wx.setStorageSync('__cloud_user__', result.data); // V4.2-fix: 同步更新 cloud_user
        }
        wx.setStorageSync('__user_status__', result.userStatus || 'unapplied');

        // 3. 统一调用 app.saveSession 持久化完整会话态 + 同步云函数
        // P1-2: 防御性检查 — 确保 token 非空再写 session
        if (app.globalData.token) {
          await app.saveSession({
            token: app.globalData.token,
            userInfo: app.globalData.userInfo,
            userStatus: app.globalData.userStatus,
            membershipLevel: app.globalData.membershipLevel,
            phoneBound: app.globalData.phoneBound,
            isNew: userData.isNew !== false,
            activeProcessId: app.globalData.activeProcessId,
            selectedPath: app.globalData.selectedPath,
          });
        } else {
          console.warn('[home] saveSession 跳过: token 为空');
        }

        // 4. 回访用户：登录后触发数据恢复（onLaunch时未登录，恢复引擎白跑了）
        const isNew = userData.isNew !== false;
        console.warn('[home] isNew判断:', JSON.stringify({rawIsNew:userData.isNew, isNew, hasToken:!!result.token, userStatus:result.userStatus}));
        if (!isNew && app.globalData.cloudReady) {
          try {
            const { recoverUserData } = require('../../utils/recovery');
            await recoverUserData(app);
          } catch (e) {
            console.warn('[home] 登录后数据恢复失败:', e.message);
          }
        }

        // 5. 跳转
        if (isNew) {
          wx.redirectTo({ url: '/pages/status-select/status-select' });
        } else {
          wx.switchTab({ url: '/pages/process/index/index' });
        }
      } else if (result.code === 500 && result.msg) {
        // DevTools/模拟器下 openapi 不可用 → 引导用户使用完整登录页
        this.setData({ loading: false, unauthenticated: true });
        wx.showModal({
          title: '手机号登录提示',
          content: `当前环境不支持手机号登录（${result.msg}）。\n\n建议：使用「其他方式登录」进入，真机调试时手机号功能正常。`,
          showCancel: false,
          confirmText: '知道了',
        });
      } else {
        wx.showToast({ title: result.msg || '登录失败，请重试', icon: 'none' });
        this.setData({ loading: false });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('[home] 手机号登录失败:', err);
      wx.showToast({ title: '网络异常，请检查网络后重试', icon: 'none' });
      this.setData({ loading: false });
    }
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
      path: '/pages/home/home',
    };
  },
});
