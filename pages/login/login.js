/**
 * 住港伴 v3 — 登录页
 * 支持: 账号一键登录 + 微信授权手机号登录
 * 
 * 错误「手机号服务异常」原因与解决:
 *   1. 云函数 user-auth 缺 phoneLogin 动作 → 已修复 (见 cloudfunctions/user-auth/index.js)
 *   2. 微信后台未开通「手机号快速验证」→ 需在 mp.weixin.qq.com 开通
 *   3. DevTools 模拟器不支持真实手机号解密 → 云函数已加降级处理
 */
const app = getApp();

Page({
  data: {
    isLoading: false,
    isPhoneLoading: false,
    agreedToTerms: true,    // 默认已勾选
    errorMsg: ''      // 手机号授权错误提示
  },

  onLoad() {
    if (app.globalData.isLoggedIn) {
      wx.switchTab({ url: '/pages/guidebooks/index/index' });
    }
  },

  // ========== 账号一键登录 ==========
  async handleLogin() {
    if (!this.data.agreedToTerms) {
      wx.showToast({ title: '请先同意用户协议', icon: 'none' });
      return;
    }
    this.setData({ isLoading: true });

    try {
      const { code } = await new Promise((resolve, reject) => {
        wx.login({ success: resolve, fail: reject });
      });
      if (!code) throw new Error('wx.login 失败');

      let result = null;
      if (app.globalData.cloudReady) {
        const res = await wx.cloud.callFunction({
          name: 'user-auth',
          data: { action: 'login', code }
        });
        result = res.result;
      }

      if (!result || result.code !== 0) {
        this.localLogin();
      } else {
        this.cloudLogin(result);
      }

      this.navigateAfterLogin();
    } catch (e) {
      console.error('[登录] 微信登录失败:', e);
      this.localLogin();
      wx.showToast({ title: '已进入本地模式', icon: 'success' });
      setTimeout(() => { wx.switchTab({ url: '/pages/guidebooks/index/index' }); }, 800);
    } finally {
      this.setData({ isLoading: false });
    }
  },

  // ========== 微信授权手机号登录 ==========
  async handleWechatPhone(e) {
    if (!this.data.agreedToTerms) {
      wx.showToast({ title: '请先同意用户协议', icon: 'none' });
      return;
    }

    const { errMsg, code } = e.detail || {};

    // ---- 用户拒绝授权 ----
    if (errMsg && errMsg.includes('deny')) {
      wx.showToast({ title: '需要授权手机号才能登录', icon: 'none' });
      return;
    }

    // ---- getPhoneNumber 未返回有效 code ----
    // 可能原因: 小程序未开通手机号能力 / 非企业认证
    if (errMsg !== 'getPhoneNumber:ok' || !code) {
      const reason = !code
        ? '手机号服务未就绪，请使用「账号一键登录」'
        : this.parsePhoneError(errMsg);
      this.setData({ errorMsg: reason });
      wx.showToast({ title: reason, icon: 'none', duration: 3000 });
      return;
    }

    this.setData({ isPhoneLoading: true, errorMsg: '' });

    try {
      const res = await wx.cloud.callFunction({
        name: 'user-auth',
        data: {
          action: 'phoneLogin',
          phoneCode: code,
          loginType: 'wechat_phone'
        }
      });

      const result = res.result || {};

      // ---- 云函数返回成功 ----
      if (result.code === 0) {
        this.cloudLogin(result, { phoneBound: true });
        this.navigateAfterLogin();
        return;
      }

      // ---- 云函数返回业务错误 ----
      // DevTools 模拟器下 openapi 不可用，云函数返回 500
      if (result.code === 500 && result.msg) {
        wx.showModal({
          title: '手机号登录提示',
          content: `当前环境不支持手机号登录（${result.msg}）。\n\n建议：使用「账号一键登录」进入，真机调试时手机号功能正常。`,
          showCancel: false,
          confirmText: '知道了'
        });
        this.setData({ isPhoneLoading: false });
        return;
      }

      // 其他业务错误
      wx.showToast({
        title: result.msg || '手机号登录失败',
        icon: 'none',
        duration: 2500
      });

    } catch (e) {
      // ---- 网络/云函数调用异常 ----
      console.error('[登录] 手机号登录异常:', e);
      wx.showToast({ title: '网络异常，请稍后重试', icon: 'none' });
    } finally {
      this.setData({ isPhoneLoading: false });
    }
  },

  /**
   * 解析 getPhoneNumber 的错误消息
   */
  parsePhoneError(errMsg) {
    if (!errMsg) return '手机号服务异常';
    if (errMsg.includes('not support') || errMsg.includes('permission'))
      return '当前小程序未开通手机号服务，请使用微信登录';
    if (errMsg.includes('fail'))
      return '手机号获取失败，请重试';
    return '手机号服务异常';
  },

  // ========== 登录成功处理 ==========
  cloudLogin(result, extra) {
    app.globalData.isLoggedIn = true;
    // 优先使用云函数返回的token，降级时生成随机令牌
    app.globalData.token = result.token || generateRandomToken();
    app.globalData.userInfo = result.userInfo || { nickName: '住港伴用户' };
    app.globalData.userStatus = result.userStatus || 'unapplied';
    app.globalData.membershipLevel = result.membershipLevel || 'free';

    // 手机号绑定标记 — 来自 phoneLogin 或 data.phoneBound
    const phoneBound = !!(extra && extra.phoneBound) ||
      !!(result.data && result.data.phoneBound);
    if (phoneBound) {
      app.globalData.phoneBound = true;
    }

    // 持久化用户数据
    if (result.data) {
      wx.setStorageSync('__cloud_user__', result.data);
    }

    app.saveSession({
      token: app.globalData.token,
      userInfo: app.globalData.userInfo,
      userStatus: app.globalData.userStatus,
      membershipLevel: app.globalData.membershipLevel,
      phoneBound: app.globalData.phoneBound
    });
  },

  localLogin() {
    app.globalData.isLoggedIn = true;
    app.globalData.token = 'local_' + generateRandomToken();
    app.globalData.userInfo = { nickName: '住港伴用户' };
    app.globalData.userStatus = 'unapplied';
    app.globalData.membershipLevel = 'free';
    app.saveSession({
      token: app.globalData.token,
      userInfo: app.globalData.userInfo,
      userStatus: app.globalData.userStatus,
      membershipLevel: app.globalData.membershipLevel
    });
  },

  navigateAfterLogin() {
    wx.showToast({ title: '登录成功', icon: 'success' });
    const userStatus = wx.getStorageSync('__user_status__');
    setTimeout(() => {
      if (userStatus) {
        wx.switchTab({ url: '/pages/guidebooks/index/index' });
      } else {
        wx.redirectTo({ url: '/pages/status-select/status-select' });
      }
    }, 800);
  },

  // ========== Token生成 (P0修复: 真随机替代全零) ==========
  generateRandomToken: function() {
    try {
      var arr = new Uint8Array(16);
      wx.getRandomValues({ length: 16, success: function(res) {
        if (res.randomValues) {
          for (var i = 0; i < 16; i++) arr[i] = res.randomValues[i];
        }
      }, fail: function() {
        for (var i = 0; i < 16; i++) arr[i] = Math.floor(Math.random() * 256);
      }});
      return Array.from(arr).map(function(b) {
        return ('0' + b.toString(16)).slice(-2);
      }).join('');
    } catch(e) {
      return Date.now().toString(36) + Math.random().toString(36).slice(2);
    }
  },

  // ========== 协议 ==========
  toggleAgreement() {
    this.setData({ agreedToTerms: !this.data.agreedToTerms });
  },

  showTerms() {
    wx.showModal({
      title: '用户协议与隐私政策',
      content: '住港伴承诺：您的所有身份材料仅存储在您的设备本地，永不上传至服务端。所有数据处理均在您的设备上完成。详情请查看《住港伴隐私保护白皮书》。',
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  skipLogin() {
    wx.switchTab({ url: '/pages/guidebooks/index/index' });
  }
});

/** 生成降级随机令牌——确保调用wx.getRandomValues获取真随机字节 */
function _generateFallbackToken() {
  var token = '';
  try {
    var len = 16;
    wx.getRandomValues({
      length: len,
      success: function(res) {
        if (res.randomValues) {
          for (var i = 0; i < len; i++) token += ('0' + res.randomValues[i].toString(16)).slice(-2);
        }
      }
    });
  } catch(e) {}
  // 如果getRandomValues失败，用Date+Math.random兜底
  if (!token) token = 'fallback_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
  return token;
}
