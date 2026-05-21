var decisionGate = require('../../utils/decision-gate');
Component({
  properties: {
    show: { type: Boolean, value: false, observer: function(n) { if (n) this.setData({ _visible: true, _loading: false, _error: '' }); } },
    mode: { type: String, value: 'login' },
    pathLabel: { type: String, value: '' }
  },
  data: { _visible: false, _loading: false, _error: '' },
  pageLifetimes: {
    show: function() {
      if (!this.data._visible || this.data.mode !== 'identity') return;
      var gate = decisionGate.canMakeDecision();
      if (gate.ok) { this.setData({ _visible: false }); this.triggerEvent('gate-passed', {}); }
    }
  },
  methods: {
    handleLogin: function() {
      var that = this; that.setData({ _loading: true, _error: '' });
      wx.login({
        success: function(loginRes) {
          if (!loginRes.code) { that.setData({ _loading: false, _error: '获取登录凭证失败' }); return; }
          var timeout = setTimeout(function() { that.setData({ _loading: false, _error: '登录超时，请检查网络后重试' }); }, 8000);
          wx.cloud.callFunction({ name: 'user-auth', data: { action: 'login', code: loginRes.code } })
          .then(function(res) {
            clearTimeout(timeout);
            var result = res.result || {};
            if (result.code === 0 && result.token) {
              var app = getApp();
              app.globalData.isLoggedIn = true;
              app.globalData.token = result.token;
              app.globalData.userInfo = result.userInfo || { nickName: '住港伴用户' };
              app.globalData.userStatus = result.userStatus || '';
              app.saveSession({ token: app.globalData.token, userInfo: app.globalData.userInfo, userStatus: app.globalData.userStatus, membershipLevel: result.membershipLevel || 'free', phoneBound: app.globalData.phoneBound });
              var gate2 = decisionGate.canMakeDecision();
              if (gate2.ok) { that.setData({ _visible: false, _loading: false }); that.triggerEvent('gate-passed', {}); }
              else { that.setData({ _loading: false, mode: 'identity' }); }
            } else { that.setData({ _loading: false, _error: result.msg || '登录失败，请重试' }); }
          }).catch(function(err) { clearTimeout(timeout); that.setData({ _loading: false, _error: '网络异常，请稍后重试' }); });
        },
        fail: function() { that.setData({ _loading: false, _error: '微信登录失败' }); }
      });
    },
    handleGoIdentity: function() { wx.navigateTo({ url: '/pages/status-select/status-select' }); },
    handleDismiss: function() { this.setData({ _visible: false, _loading: false, _error: '' }); this.triggerEvent('dismiss', {}); },
    catchStop: function() {}
  }
});
