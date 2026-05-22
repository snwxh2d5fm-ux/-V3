/**
 * subpkg-low/pages/admin-invite/index — 内测码管理后台
 */
const app = getApp();

Page({
  data: {
    stats: null,
    activeTab: 'generate',

    // 生成
    genCount: 50,
    selectedChannel: 0,
    channels: ['社群', '朋友圈', 'KOL', '线下活动', '公众号', '其他'],
    expireDays: 60,
    generating: false,
    generatedCodes: [],
    lastBatch: '',

    // 查询
    searchKey: '',
    searching: false,
    searchResult: null,
    batchStats: null,

    // 熔断
    killed: false,
  },

  onShow() {
    this.loadStats();
  },

  /** 加载统计数据 */
  async loadStats() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'invite-code',
        data: { action: 'get-code-stats' },
      });
      if (res.result && res.result.code === 0) {
        this.setData({ stats: res.result.data });
      }
    } catch (e) {
      console.error('[admin-invite] loadStats:', e);
    }
  },

  switchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab });
  },

  // ===== 生成 =====
  onGenCount(e) {
    this.setData({ genCount: parseInt(e.detail.value) || 50 });
  },
  onExpireDays(e) {
    this.setData({ expireDays: parseInt(e.detail.value) || 60 });
  },
  onChannelChange(e) {
    this.setData({ selectedChannel: parseInt(e.detail.value) });
  },

  async generateCodes() {
    const { genCount, channels, selectedChannel, expireDays } = this.data;
    if (genCount < 1 || genCount > 200) {
      wx.showToast({ title: '数量须在 1-200 之间', icon: 'none' });
      return;
    }

    this.setData({ generating: true });

    try {
      const res = await wx.cloud.callFunction({
        name: 'invite-code',
        data: {
          action: 'generate-seed-codes',
          count: genCount,
          channel: channels[selectedChannel],
          expiresInDays: expireDays,
        },
      });

      if (res.result && res.result.code === 0) {
        const data = res.result.data;
        this.setData({
          generating: false,
          generatedCodes: data.codes || [],
          lastBatch: data.batch || '',
        });
        wx.showToast({ title: `已生成 ${data.count} 个码` });
        this.loadStats();
      } else {
        this.setData({ generating: false });
        wx.showToast({ title: res.result.msg || '生成失败', icon: 'none' });
      }
    } catch (e) {
      this.setData({ generating: false });
      wx.showToast({ title: '网络异常', icon: 'none' });
    }
  },

  /** 一键复制全部码 */
  copyAllCodes() {
    const text = this.data.generatedCodes.join('\n');
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: '已复制' }),
    });
  },

  // ===== 查询 =====
  onSearchKey(e) {
    this.setData({ searchKey: e.detail.value || '' });
  },

  async searchCode() {
    const key = this.data.searchKey.trim();
    if (!key) return;

    this.setData({ searching: true, searchResult: null, batchStats: null });

    try {
      if (key.startsWith('ZGB-')) {
        // 单个码查询
        const res = await wx.cloud.callFunction({
          name: 'invite-code',
          data: { action: 'query-code-status', code: key },
        });
        this.setData({
          searching: false,
          searchResult: res.result || { status: '未知', msg: '查询失败' },
        });
      } else {
        // 批次查询
        const res = await wx.cloud.callFunction({
          name: 'invite-code',
          data: { action: 'get-code-stats', batchId: key },
        });
        if (res.result && res.result.code === 0) {
          this.setData({
            searching: false,
            batchStats: {
              batch: key,
              ...res.result.data,
            },
          });
        } else {
          this.setData({ searching: false });
          wx.showToast({ title: '批次不存在', icon: 'none' });
        }
      }
    } catch (e) {
      this.setData({ searching: false });
      wx.showToast({ title: '查询失败', icon: 'none' });
    }
  },

  /** 撤销单个码 */
  async revokeCode() {
    const code = this.data.searchKey.trim();
    const confirmed = await showConfirm('撤销内测码', `确定撤销 ${code}？撤销后该码将失效。`);
    if (!confirmed) return;

    try {
      const res = await wx.cloud.callFunction({
        name: 'invite-code',
        data: { action: 'revoke-code', code },
      });
      if (res.result && res.result.code === 0) {
        wx.showToast({ title: '已撤销' });
        this.searchCode();
        this.loadStats();
      } else {
        wx.showToast({ title: res.result.msg || '撤销失败', icon: 'none' });
      }
    } catch (e) {
      wx.showToast({ title: '撤销失败', icon: 'none' });
    }
  },

  /** 撤销批次未使用码 */
  async revokeBatch() {
    const batch = this.data.searchKey.trim();
    const confirmed = await showConfirm('批量撤销', `确定撤销批次 ${batch} 的全部未使用码？此操作不可恢复。`);
    if (!confirmed) return;

    try {
      // 需要云函数支持 batch-revoke（或循环调用revoke）
      wx.showLoading({ title: '撤销中...' });
      const res = await wx.cloud.callFunction({
        name: 'invite-code',
        data: { action: 'revoke-batch', batchId: batch },
      });
      wx.hideLoading();

      if (res.result && res.result.code === 0) {
        wx.showToast({ title: `已撤销 ${res.result.data?.count || 0} 个码` });
        this.searchCode();
        this.loadStats();
      } else if (res.result && res.result.code === 404) {
        // 云函数尚未实现，逐个撤销
        wx.showToast({ title: '批量撤销功能待部署', icon: 'none' });
      } else {
        wx.showToast({ title: res.result?.msg || '操作失败', icon: 'none' });
      }
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  // ===== 熔断 =====
  toggleKillSwitch(e) {
    this.setData({ killed: !e.detail.value });
    wx.showToast({
      title: e.detail.value ? '兑换功能已恢复' : '兑换功能已暂停',
      icon: 'none',
    });
  },
});

/** Promise化的确认弹窗 */
function showConfirm(title, content) {
  return new Promise((resolve) => {
    wx.showModal({
      title,
      content,
      confirmText: '确定',
      cancelText: '取消',
      confirmColor: '#ff4d4f',
      success: (res) => resolve(res.confirm),
    });
  });
}
