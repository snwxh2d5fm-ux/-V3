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
    showPaywall: false
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
      this.setData({ showPaywall: true });
    },

    closePaywall() {
      this.setData({ showPaywall: false });
    },

    async confirmPaywall() {
      var self = this;
      self.setData({ showPaywall: false });

      // 第一步: 二次确认
      var modalRes = await new Promise(function(resolve) {
        wx.showModal({
          title: '确认重置身份状态',
          content: '支付 ¥599 后，你的当前流程进度、材料关联、提醒规则和本地进度将被清除。\n\n重置后可重新选择身份状态。确定继续？',
          confirmText: '支付 ¥599',
          cancelText: '取消',
          success: resolve
        });
      });

      if (!modalRes.confirm) return;

      // 第二步: 调用 payment 云函数拉起支付
      try {
        var payResult = await wx.cloud.callFunction({
          name: 'payment',
          data: { action: 'identityReset' }
        });

        if (payResult.result.code !== 0) {
          wx.showToast({ title: payResult.result.msg || '支付创建失败', icon: 'none' });
          return;
        }

        var paymentData = payResult.result.data;
        var payParams = paymentData.payment;

        // 第三步: 微信支付V3拉起
        var payRes = await new Promise(function(resolve, reject) {
          wx.requestPayment({
            timeStamp: payParams.timeStamp,
            nonceStr: payParams.nonceStr,
            package: payParams.package,
            signType: payParams.signType || 'RSA',
            paySign: payParams.paySign,
            success: function(res) { resolve(res); },
            fail: function(err) { reject(err); }
          });
        });

        // 第四步: 支付成功 → 清除本地storage → 跳转status-select重选
        try { wx.removeStorageSync('__onboarding__'); } catch(e) {}
        try { wx.removeStorageSync('__process_stage__'); } catch(e) {}
        try { wx.removeStorageSync('__active_process_id__'); } catch(e) {}
        try { wx.removeStorageSync('__user_status__'); } catch(e) {}
        try { wx.removeStorageSync('__user_sub_status__'); } catch(e) {}

        wx.showToast({ title: '身份已重置，请重新选择', icon: 'success', duration: 1500 });
        setTimeout(function() {
          wx.redirectTo({ url: '/pages/status-select/status-select?mode=reset' });
        }, 1500);

      } catch (err) {
        // 支付取消或失败: 不做任何清理
        if (err && err.errMsg && err.errMsg.indexOf('cancel') === -1) {
          wx.showToast({ title: '支付失败，请重试', icon: 'none' });
        }
      }
    },

    /**
     * 点击路径标签 → 切换路径
     */
    onTapPath() {
      if (!this.data.pathLabel) return;
      wx.switchTab({ url: '/pages/process/index/index' });
    }
  }
});
