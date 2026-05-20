/**
 * status-badge 组件 — 左上角身份状态 + 规划路径标签
 * 身份状态：只读，切换需 ¥599（防多人共用）
 * 规划路径：可随时切换
 */
const app = getApp();
const constants = require('../../data/constants');

Component({
  properties: {
    // 可外部传入覆盖
    status: { type: String, value: '' },
    subStatus: { type: String, value: '' },
    pathName: { type: String, value: '' }
  },

  data: {
    identityLabel: '',
    identityIcon: '',
    pathLabel: '',
    showPaywall: false,
    showConfirmStep: false
  },

  lifetimes: {
    attached() {
      this.refresh();
    }
  },

  pageLifetimes: {
    show() {
      this.refresh();
    }
  },

  methods: {
    refresh() {
      const g = app.globalData;
      const status = this.properties.status || g.userStatus ||
        wx.getStorageSync(constants.STORAGE_KEYS.USER_STATUS) || '';
      const subStatus = this.properties.subStatus || g.userSubStatus ||
        wx.getStorageSync(constants.STORAGE_KEYS.USER_SUB_STATUS) || '';

      // 身份标签
      const idMap = {
        unapplied:      { icon: '📝', label: '未申请' },
        submitted:      { icon: '📤', label: '已交件' },
        approved:       { icon: '✅', label: '已获批' },
        permanent:      { icon: '🏆', label: '已永居' },
        skipped:        { icon: '⏭️', label: '未选择' }
      };

      const subMap = {
        unapplied_student:  '在校学生',
        unapplied_employed: '在职人士',
        unapplied_owner:    '企业主',
        unapplied_overseas: '海外华人',
        submitted_qmas:     '优才',
        submitted_ttps:     '高才通',
        submitted_asmpt:    '专才',
        submitted_iang:     'IANG',
        approved_employed:  '在港就业',
        approved_business:  '在港创业',
        approved_studying:  '在港学习',
        approved_mainland:  '常在内地'
      };

      const idInfo = idMap[status] || { icon: '👤', label: status || '未知' };
      const subLabel = subMap[subStatus] || '';
      const identityLabel = subLabel
        ? `${idInfo.label}·${subLabel}`
        : idInfo.label;

      // 路径标签 — 优先取 activeProcess.name（与流程控hero卡片同源），确保显示一致
      let pathLabel = this.properties.pathName || '';
      if (!pathLabel) {
        // 优先级1: activeProcess.name（模板名称，如"高才通B类·名校学士通道"）
        if (g.activeProcess && g.activeProcess.name) {
          pathLabel = g.activeProcess.name;
        }
        // 优先级2: PATH_NAMES映射（静态兜底）
        if (!pathLabel) {
          const activeId = g.activeProcessId || wx.getStorageSync('__active_process_id__') || '';
          const selected = g.selectedPath || '';
          let resolvedKey = selected && constants.PATH_NAMES[selected] ? selected : '';
          if (!resolvedKey && g.activeProcess) {
            const alt = g.activeProcess.pathType || g.activeProcess.templateId || '';
            resolvedKey = constants.PATH_NAMES[alt] ? alt : '';
          }
          if (!resolvedKey) resolvedKey = activeId;
          if (resolvedKey) {
            pathLabel = constants.PATH_NAMES[resolvedKey] || resolvedKey;
          }
        }
      }

      this.setData({
        identityIcon: idInfo.icon,
        identityLabel,
        pathLabel: pathLabel ? `路径：${pathLabel}` : ''
      });
    },

    /**
     * 点击身份标签 → 支付拦截
     */
    onTapIdentity() {
      console.log('[status-badge] onTapIdentity 触发');
      this.setData({ showPaywall: true });
    },

    closePaywall() {
      this.setData({ showPaywall: false, showConfirmStep: false });
    },

    confirmPaywall: function() {
      var self = this;
      console.log('[status-badge] confirmPaywall 触发');
      // 切换到二次确认步骤（组件内完成，不依赖原生modal）
      self.setData({ showPaywall: true, showConfirmStep: true });
    },

    confirmPaywallFinal: function() {
      var self = this;
      console.log('[status-badge] confirmPaywallFinal 触发 — 开始支付');
      self.setData({ showPaywall: false, showConfirmStep: false });
      // 调用 payment 云函数
      console.log('[status-badge] calling payment/identityReset...');
      wx.cloud.callFunction({
        name: 'payment',
        data: { action: 'identityReset' }
      }).then(function(res) {
        console.log('[status-badge] payment/identityReset result code=' + (res.result ? res.result.code : 'NO_RESULT'));
        if (res.result.code !== 0) {
          wx.showToast({ title: res.result.msg || '支付创建失败', icon: 'none' });
          return;
        }
        var paymentData = res.result.data;
        if (!paymentData || !paymentData.payment || !paymentData.payment.timeStamp) {
          wx.showToast({ title: '支付参数异常，请重试', icon: 'none' });
          return;
        }
        var payParams = paymentData.payment;
        wx.requestPayment({
          timeStamp: payParams.timeStamp,
          nonceStr: payParams.nonceStr,
          package: payParams.package,
          signType: payParams.signType || 'RSA',
          paySign: payParams.paySign,
          success: function() {
            // 确认支付
            wx.cloud.callFunction({
              name: 'payment',
              data: { action: 'confirmPayment', orderId: paymentData.orderId }
            }).catch(function() {});
            // 清除本地storage
            try { wx.removeStorageSync('__onboarding__'); } catch(e) {}
            try { wx.removeStorageSync('__process_stage__'); } catch(e) {}
            try { wx.removeStorageSync('__active_process_id__'); } catch(e) {}
            try { wx.removeStorageSync('__user_status__'); } catch(e) {}
            try { wx.removeStorageSync('__user_sub_status__'); } catch(e) {}
            wx.showToast({ title: '身份已重置，请重新选择', icon: 'success', duration: 1500 });
            setTimeout(function() {
              wx.redirectTo({ url: '/pages/status-select/status-select?mode=reset' });
            }, 1500);
          },
          fail: function(err) {
            if (err && err.errMsg && err.errMsg.indexOf('cancel') === -1) {
              wx.showToast({ title: '支付失败，请重试', icon: 'none' });
            }
          }
        });
      }).catch(function() {
        wx.showToast({ title: '网络异常，请重试', icon: 'none' });
      });
    },

    /**
     * 点击路径标签 → 切换路径
     */
    onTapPath() {
      var app = getApp();
      var userStatus = app.globalData.userStatus || wx.getStorageSync('__user_status__') || '';
      if (userStatus === 'skipped') {
        wx.showToast({ title: '请先确认身份状态', icon: 'none' });
        wx.navigateTo({ url: '/pages/status-select/status-select' });
        return;
      }
      if (!this.data.pathLabel) return;
      wx.navigateTo({ url: '/pages/path-select/index' });
    }
  }
});
