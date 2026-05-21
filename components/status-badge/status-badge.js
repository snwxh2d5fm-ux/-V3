/**
 * status-badge 组件 — 身份状态 + 规划路径标签
 * V4.2-fix (2026-05-23): 移除 ¥599 付费墙，免费身份重置 + 数据恢复引导
 * 身份重置：轻量确认即可，7天冷却期防滥用（服务端 enforce）
 * 数据恢复：检测到状态异常时引导从云端恢复，不作为"重置"处理
 */
const app = getApp();
const constants = require('../../data/constants');

Component({
  properties: {
    status: { type: String, value: '' },
    subStatus: { type: String, value: '' },
    pathName: { type: String, value: '' },
  },

  data: {
    identityLabel: '',
    identityIcon: '',
    pathLabel: '',
    showResetModal: false,
    showConfirmStep: false,
    isRecovery: false,   // true=数据恢复模式(从云端拉取), false=身份重置模式(清除重选)
  },

  lifetimes: {
    attached() {
      this.refresh();
    },
  },

  pageLifetimes: {
    show() {
      this.refresh();
    },
  },

  methods: {
    refresh() {
      const g = app.globalData;
      const status =
        this.properties.status || g.userStatus || wx.getStorageSync(constants.STORAGE_KEYS.USER_STATUS) || '';
      const subStatus =
        this.properties.subStatus || g.userSubStatus || wx.getStorageSync(constants.STORAGE_KEYS.USER_SUB_STATUS) || '';

      const idMap = {
        unapplied: { icon: '📝', label: '未申请' },
        submitted: { icon: '📤', label: '已交件' },
        approved: { icon: '✅', label: '已获批' },
        permanent: { icon: '🏆', label: '已永居' },
        skipped: { icon: '⏭️', label: '未选择' },
      };

      const subMap = {
        unapplied_student: '在校学生',
        unapplied_employed: '在职人士',
        unapplied_owner: '企业主',
        unapplied_overseas: '海外华人',
        submitted_qmas: '优才',
        submitted_ttps: '高才通',
        submitted_asmpt: '专才',
        submitted_iang: 'IANG',
        approved_employed: '在港就业',
        approved_business: '在港创业',
        approved_studying: '在港学习',
        approved_mainland: '常在内地',
      };

      const idInfo = idMap[status] || { icon: '👤', label: status || '未知' };
      const subLabel = subMap[subStatus] || '';
      const identityLabel = subLabel ? `${idInfo.label}·${subLabel}` : idInfo.label;

      let pathLabel = this.properties.pathName || '';
      if (!pathLabel) {
        if (g.activeProcess && g.activeProcess.name) {
          pathLabel = g.activeProcess.name;
        }
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
        pathLabel: pathLabel ? `路径：${pathLabel}` : '',
      });
    },

    /**
     * 点击身份标签 → 弹出操作选择
     * - 如果状态为空/未知：提供"从云端恢复数据" + "重新选择身份"
     * - 如果状态正常：提供"重新选择身份"（免费重置）
     */
    onTapIdentity() {
      const status = this.properties.status || app.globalData.userStatus || '';
      const isUnknown = !status || status === '未知';

      if (isUnknown) {
        // 状态丢失 → 优先引导数据恢复
        this.setData({ showResetModal: true, showConfirmStep: false, isRecovery: true });
      } else {
        // 状态正常 → 身份重置
        this.setData({ showResetModal: true, showConfirmStep: false, isRecovery: false });
      }
    },

    closeModal() {
      this.setData({ showResetModal: false, showConfirmStep: false });
    },

    /**
     * 从云端恢复数据（不清除本地，从CloudBase拉取）
     */
    async recoverFromCloud() {
      const self = this;
      self.setData({ showResetModal: false });
      wx.showLoading({ title: '正在恢复数据...' });

      try {
        // 调用 db-admin pullAll 拉取全量数据
        const res = await wx.cloud.callFunction({
          name: 'db-admin',
          data: { action: 'pullAll' },
        });

        if (res.result && res.result.code === 200) {
          const { documents, reminders, processes } = res.result.data;
          const { saveDocuments, saveReminders, saveProcessLines } = require('../../utils/storage');

          let recoveredCount = 0;
          if (processes && processes.length > 0) {
            saveProcessLines(processes);
            recoveredCount += processes.length;
          }
          if (reminders && reminders.length > 0) {
            saveReminders(reminders);
            recoveredCount += reminders.length;
          }
          if (documents && documents.length > 0) {
            saveDocuments(documents);
            recoveredCount += documents.length;
          }

          // 同时恢复身份状态
          try {
            const profileRes = await wx.cloud.callFunction({
              name: 'user-auth',
              data: { action: 'getProfile' },
            });
            if (profileRes.result && profileRes.result.code === 0) {
              const p = profileRes.result.data || profileRes.result.user || {};
              if (p.currentPhase) wx.setStorageSync('__user_status__', p.currentPhase);
              if (p.subStatus) wx.setStorageSync('__user_sub_status__', p.subStatus);
              if (p.selectedPath) wx.setStorageSync('__selected_path__', p.selectedPath);
              if (p.activeProcessId) wx.setStorageSync('__active_process_id__', p.activeProcessId);
            }
          } catch (e) {
            // profile恢复失败不阻塞
          }

          wx.hideLoading();
          wx.showToast({
            title: `已恢复 ${recoveredCount} 条数据`,
            icon: 'success',
            duration: 2000,
          });
          self.refresh();
        } else {
          wx.hideLoading();
          wx.showToast({ title: '云端暂无备份数据', icon: 'none' });
        }
      } catch (e) {
        wx.hideLoading();
        wx.showToast({ title: '数据恢复失败，请检查网络', icon: 'none' });
      }
    },

    /**
     * 确认身份重置（免费，清除本地状态后重新选择）
     */
    confirmReset() {
      this.setData({ showResetModal: true, showConfirmStep: true });
    },

    /**
     * 执行身份重置 — 清除本地状态→重定向status-select
     */
    executeReset() {
      const self = this;
      self.setData({ showResetModal: false, showConfirmStep: false });

      wx.showModal({
        title: '确认重置身份状态',
        content: '重置后将清除以下本地数据：\n• 当前流程进度和阶段\n• 证件材料关联\n• 提醒规则\n• 已选路径\n\n重置后可重新选择身份状态。确定继续？',
        confirmText: '确认重置',
        cancelText: '取消',
        async success(res) {
          if (!res.confirm) return;

          wx.showLoading({ title: '重置中...' });

          // 第一步：调用服务器确认重置
          let serverOk = true;
          if (app.globalData.cloudReady) {
            try {
              const cloudRes = await wx.cloud.callFunction({
                name: 'process-manager',
                data: { action: 'resetIdentityPhase', source: 'free_reset' },
              });
              if (cloudRes.result && cloudRes.result.code !== 0) {
                serverOk = false;
                wx.hideLoading();
                wx.showToast({ title: cloudRes.result.msg || '重置失败', icon: 'none' });
                return;
              }
            } catch (e) {
              serverOk = false;
              wx.hideLoading();
              wx.showToast({ title: '网络异常，请稍后重试', icon: 'none' });
              return;
            }
          }

          // 第二步：服务器确认成功后，清除本地storage
          const keysToRemove = [
            '__onboarding__',
            '__process_stage__',
            '__active_process_id__',
            '__user_status__',
            '__user_sub_status__',
          ];
          keysToRemove.forEach(function (key) {
            try { wx.removeStorageSync(key); } catch (e) {}
          });

          wx.hideLoading();
          wx.showToast({ title: '身份已重置，请重新选择', icon: 'success', duration: 1500 });
          setTimeout(function () {
            wx.redirectTo({ url: '/pages/status-select/status-select?mode=reset' });
          }, 1500);
        },
      });
    },

    /**
     * 点击路径标签 → 切换路径
     */
    onTapPath() {
      if (!this.data.pathLabel) return;
      wx.navigateTo({ url: '/pages/path-select/index' });
    },
  },
});
