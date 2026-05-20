/**
 * gate-sheet — 双闸门引导半屏组件
 * mode='login': 未登录，引导微信一键登录
 * mode='identity': 已登录但未确认身份状态，引导去 status-select
 */
var decisionGate = require('../../utils/decision-gate');

Component({
  properties: {
    show: {
      type: Boolean,
      value: false,
      observer: function(newVal) {
        if (newVal) {
          this.setData({ _visible: true, _loading: false, _error: '' });
        }
      }
    },
    mode: {
      type: String,
      value: 'login'
    },
    pathLabel: {
      type: String,
      value: ''
    }
  },

  data: {
    _visible: false,
    _loading: false,
    _error: ''
  },

  pageLifetimes: {
    show: function() {
      // 从 status-select 返回后重检闸门2
      if (!this.data._visible || this.data.mode !== 'identity') return;
      var gate = decisionGate.canMakeDecision();
      if (gate.ok) {
        this.setData({ _visible: false });
        this.triggerEvent('gate-passed', {});
      }
    }
  },

  methods: {
    // ===== login 模式 =====
    handleLogin: function() {
      var that = this;
      that.setData({ _loading: true, _error: '' });

      wx.login({
        success: function(loginRes) {
          if (!loginRes.code) {
            that.setData({ _loading: false, _error: '获取登录凭证失败' });
            return;
          }

          // 8秒超时保护
          var timeout = setTimeout(function() {
            that.setData({ _loading: false, _error: '登录超时，请检查网络后重试' });
          }, 8000);

          wx.cloud.callFunction({
            name: 'user-auth',
            data: { action: 'login', code: loginRes.code }
          }).then(function(res) {
            clearTimeout(timeout);
            var result = res.result || {};

            if (result.code === 0 && result.token) {
              var app = getApp();
              app.globalData.isLoggedIn = true;
              app.globalData.token = result.token;
              app.globalData.userInfo = result.userInfo || { nickName: '住港伴用户' };
              app.globalData.userStatus = result.userStatus || '';
              app.globalData.membershipLevel = result.membershipLevel || 'free';
              app.globalData.phoneBound = !!(result.phoneBound || (result.data && result.data.phoneBound));

              // saveSession
              app.saveSession({
                token: app.globalData.token,
                userInfo: app.globalData.userInfo,
                userStatus: app.globalData.userStatus,
                membershipLevel: app.globalData.membershipLevel,
                phoneBound: app.globalData.phoneBound
              });

              // 检查闸门2
              var gate2 = decisionGate.canMakeDecision();
              if (gate2.ok) {
                that.setData({ _visible: false, _loading: false });
                that.triggerEvent('gate-passed', {});
              } else {
                // 登录成功但身份未确认 → 切换为 identity 模式
                that.setData({ _loading: false, mode: 'identity' });
              }
            } else {
              that.setData({ _loading: false, _error: result.msg || '登录失败，请重试' });
            }
          }).catch(function(err) {
            clearTimeout(timeout);
            console.warn('[gate-sheet] 登录云函数调用失败:', err);
            that.setData({ _loading: false, _error: '网络异常，请稍后重试' });
          });
        },
        fail: function() {
          that.setData({ _loading: false, _error: '微信登录失败' });
        }
      });
    },

    // ===== identity 模式 =====
    handleGoIdentity: function() {
      wx.navigateTo({ url: '/pages/status-select/status-select' });
    },

    // ===== 通用 =====
    handleDismiss: function() {
      this.setData({ _visible: false, _loading: false, _error: '' });
      this.triggerEvent('dismiss', {});
    },

    // 阻止事件冒泡（点击半屏内容不关闭）
    catchStop: function() {}
  }
});
