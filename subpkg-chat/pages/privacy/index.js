// pages/privacy/index/index.js - 隐私中心
const CONSTANTS = require('../../../data/constants');

Page({
  data: {
    privacyScore: 85,
    privacyDays: 0,
    currentLevel: 'L1',
    piiLabels: [],
    encryptionStatus: 'AES-256-GCM 已启用',
    localStorageOnly: true,
    authHistory: [],
  },

  onLoad() {
    this.calcPrivacyScore();
    this.loadPIILabels();
    this.loadAuthHistory();
  },

  calcPrivacyScore() {
    try {
      const level = wx.getStorageSync(CONSTANTS.STORAGE_KEYS.PRIVACY_MODE) || 'L1';
      let score = 85;
      if (level === 'L1') score = 95;
      else if (level === 'L2') score = 75;
      else score = 55;

      // 计算隐私保护天数
      const app = getApp();
      const startDate = wx.getStorageSync('__privacy_start_date__') || '2025-12-30';
      const days = Math.floor((Date.now() - new Date(startDate).getTime()) / 86400000);

      this.setData({ privacyScore: score, currentLevel: level, privacyDays: days });
    } catch (e) {
      this.setData({ privacyScore: 85, privacyDays: 0 });
    }
  },

  loadPIILabels() {
    const labels = [
      { key: 'name', label: '姓名', level: 'L1', enabled: true, desc: '绝对脱敏，不离开设备' },
      { key: 'id_card', label: '身份证号', level: 'L1', enabled: true, desc: '绝对脱敏，不离开设备' },
      { key: 'passport', label: '护照号', level: 'L1', enabled: true, desc: '绝对脱敏，不离开设备' },
      { key: 'phone', label: '手机号', level: 'L2', enabled: false, desc: '泛化脱敏，仅保留前3后4位' },
      { key: 'email', label: '邮箱', level: 'L2', enabled: false, desc: '泛化脱敏' },
      { key: 'company', label: '工作单位', level: 'L3', enabled: false, desc: '可保留，用户自选' },
      { key: 'school', label: '毕业院校', level: 'L3', enabled: false, desc: '可保留，用户自选' },
      { key: 'income', label: '收入信息', level: 'L3', enabled: false, desc: '可保留，用户自选' },
    ];
    this.setData({ piiLabels: labels });
  },

  loadAuthHistory() {
    const history = [
      { action: '隐私模式切换', time: '2026-05-09', detail: 'L2 → L1' },
      { action: '账号登录', time: '2026-05-09', detail: '微信手机号登录' },
    ];
    this.setData({ authHistory: history });
  },

  toggleLabel(e) {
    const { key } = e.currentTarget.dataset;
    const labels = this.data.piiLabels.map((l) => {
      if (l.key === key) l.enabled = !l.enabled;
      return l;
    });
    this.setData({ piiLabels: labels });
    wx.showToast({ title: '已更新', icon: 'success' });
  },

  exportPrivacyReport() {
    const lines = [
      '住港伴 - 隐私报告',
      `生成时间: ${new Date().toISOString()}`,
      `安全评分: ${this.data.privacyScore}/100`,
      `脱敏级别: ${this.data.currentLevel}`,
      `加密: ${this.data.encryptionStatus}`,
      '',
      'PII标签授权:',
      ...this.data.piiLabels.map((l) => `  ${l.enabled ? '✅' : '⬜'} ${l.label} (${l.level}) - ${l.desc}`),
    ];
    wx.setClipboardData({
      data: lines.join('\n'),
      success: () => wx.showToast({ title: '已复制', icon: 'success' }),
    });
  },

  clearAuthHistory() {
    wx.showModal({
      title: '清除授权历史',
      content: '确定清除？',
      success: (res) => {
        if (res.confirm) {
          this.setData({ authHistory: [] });
          wx.showToast({ title: '已清除', icon: 'success' });
        }
      },
    });
  },
});
