/**
 * subpkg-chat/pages/redeem/index — 兑换内测码
 *
 * 状态机:
 *   idle → querying → previewed → redeeming → redeemed (成功)
 *                                      └→ redeemFailed (失败)
 */
const app = getApp();

Page({
  data: {
    code: '',
    codeValid: false,
    querying: false,
    previewed: false,
    preview: { valid: false, hint: '', msg: '' },
    redeeming: false,
    redeemed: false,
    redeemFailed: false,
    membershipLabel: '',
    membershipExpiresAt: '',
    feedback: '',
  },

  /** 码输入处理：去空格→大写→自动插入短横线→截断 */
  onCodeInput(e) {
    let raw = String(e.detail.value || '')
      .replace(/\s/g, '')
      .toUpperCase()
      // 移除已存在的短横线（支持重新格式化）
      .replace(/-/g, '');

    // 自动插入短横线：ZGB + - + XXXX + - + XXXX
    if (raw.length > 3) raw = raw.slice(0, 3) + '-' + raw.slice(3);
    if (raw.length > 8) raw = raw.slice(0, 8) + '-' + raw.slice(8);

    // 限制长度（含短横线共13位）
    if (raw.length > 13) raw = raw.slice(0, 13);

    const valid = /^ZGB-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(raw);

    this.setData({
      code: raw,
      codeValid: valid,
      previewed: false,
      preview: { valid: false, hint: '', msg: '' },
      redeemFailed: false,
    });
  },

  /** 查询码状态（只读预览） */
  async queryCode() {
    const { code, codeValid } = this.data;
    if (!codeValid) return;

    this.setData({ querying: true });

    try {
      const res = await wx.cloud.callFunction({
        name: 'invite-code',
        data: { action: 'query-code-status', code },
      });

      const result = res.result || {};
      this.setData({
        querying: false,
        previewed: true,
        preview: {
          valid: result.code === 0,
          hint: result.hint || '',
          msg: result.msg || '',
          status: result.status || '',
        },
      });
    } catch (e) {
      console.error('[redeem] queryCode error:', e);
      this.setData({
        querying: false,
        previewed: true,
        preview: { valid: false, msg: '网络异常，请重试' },
      });
    }
  },

  /** 兑换码 */
  async redeemCode() {
    const { code, previewed, preview } = this.data;
    if (!previewed || !preview.valid) return;

    this.setData({ redeeming: true });

    try {
      // 获取设备标识
      const sysInfo = wx.getSystemInfoSync();
      const deviceId = sysInfo.model + '_' + sysInfo.system;

      const res = await wx.cloud.callFunction({
        name: 'invite-code',
        data: {
          action: 'redeem-code',
          code,
          deviceId,
        },
      });

      const result = res.result || {};

      if (result.alreadyRedeemed) {
        // 幂等返回：同用户已兑换过该码，展示结果并跳转
        // 同步并持久化会员状态 (同 result.code === 0 的修复)
        app.globalData.membershipLevel = result.membershipLevel || 'basic';
        app.saveSession({
          token: app.globalData.token,
          userInfo: app.globalData.userInfo || { nickName: '住港伴用户' },
          userStatus: app.globalData.userStatus || 'unapplied',
          membershipLevel: result.membershipLevel || 'basic',
          phoneBound: app.globalData.phoneBound || false,
          isNew: false,
        });
        this.setData({
          redeeming: false,
          redeemed: true,
          membershipLabel: '基础年卡会员',
          membershipExpiresAt: result.membershipExpireAt
            ? formatDate(result.membershipExpireAt)
            : this.data.membershipExpiresAt,
        });
        wx.showToast({ title: '你已兑换过该码', icon: 'none' });
        return;
      }

      if (result.code === 0) {
        // 同步会员状态到 globalData
        app.globalData.membershipLevel = result.membershipLevel || 'basic';
        if (result.membershipExpireAt) {
          app.globalData.membershipExpireAt = result.membershipExpireAt;
        }
        // Fix: 持久化到 localStorage session，防止 app 重启后回退为 free
        app.saveSession({
          token: app.globalData.token,
          userInfo: app.globalData.userInfo || { nickName: '住港伴用户' },
          userStatus: app.globalData.userStatus || 'unapplied',
          membershipLevel: app.globalData.membershipLevel,
          phoneBound: app.globalData.phoneBound || false,
          isNew: false,
        });

        this.setData({
          redeeming: false,
          redeemed: true,
          redeemFailed: false,
          membershipLabel: result.membershipLabel || '基础年卡会员',
          membershipExpiresAt: formatDate(result.membershipExpireAt),
        });

        wx.showToast({ title: '年卡已激活', icon: 'success' });
      } else {
        this.setData({
          redeeming: false,
          redeemFailed: true,
          previewed: true,
          preview: { valid: false, msg: result.msg || '兑换失败' },
        });

        wx.showToast({ title: result.msg || '兑换失败', icon: 'none', duration: 3000 });
      }
    } catch (e) {
      console.error('[redeem] redeemCode error:', e);
      this.setData({
        redeeming: false,
        redeemFailed: true,
      });
      wx.showToast({ title: '网络异常，请重试', icon: 'none' });
    }
  },

  /** T+0 反馈文本输入 */
  onFeedbackInput(e) {
    this.setData({ feedback: e.detail.value || '' });
  },

  /** 提交T+0反馈 */
  async submitFeedback() {
    const feedback = this.data.feedback.trim();
    if (!feedback) return;

    try {
      await wx.cloud.callFunction({
        name: 'invite-code',
        data: {
          action: 'submit-feedback',
          feedback,
          stage: 't0',
        },
      });
      wx.showToast({ title: '感谢反馈！', icon: 'success' });
      this.setData({ feedback: '' });
    } catch (e) {
      console.error('[redeem] submitFeedback error:', e);
    }
  },

  /** 重置兑换状态（失败后重新输入） */
  resetRedeem() {
    this.setData({
      code: '',
      codeValid: false,
      querying: false,
      previewed: false,
      preview: { valid: false, hint: '', msg: '' },
      redeeming: false,
      redeemFailed: false,
    });
  },

  /** 返回个人中心 */
  goMine() {
    wx.switchTab({ url: '/pages/mine/index/index' });
  },

  /** 返回首页 */
  goHome() {
    wx.switchTab({ url: '/pages/guidebooks/index/index' });
  },
});

/** 日期格式化 */
function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
