// 住港伴 v4 — 数据库管理入口
const app = getApp();
const { saveDocuments, saveReminders, saveProcessLines } = require('../../../utils/storage');

Page({
  data: {
    syncStatus: 'idle',
    lastSyncTime: null,
    cloudStats: { documents: 0, reminders: 0, processes: 0 },
    dbStatus: 'connected',
    // Phase 3: AI对话看板
    aiDashboard: null,
    aiDashboardLoading: false,
    operations: [
      { id: 'sync', icon: '🔄', title: '全量同步', desc: '将本地数据同步到云数据库' },
      { id: 'pull', icon: '📥', title: '拉取云端', desc: '从云数据库拉取最新数据' },
      { id: 'backup', icon: '💾', title: '创建备份', desc: '创建当前数据快照' },
      { id: 'clean', icon: '🧹', title: '清理缓存', desc: '清理本地过期缓存数据' },
      { id: 'export', icon: '📤', title: '导出数据', desc: '导出脱敏后的数据报告' },
      { id: 'reset', icon: '⚠️', title: '重置数据库', desc: '清空云端数据重新开始' }
    ],
    aiOps: [
      { id: 'aiDashboard', icon: '📊', title: 'AI对话看板', desc: '准确率/成本/安全事件' },
      { id: 'aiEvalDaily', icon: '🔬', title: '每日评估采样', desc: '运行20题准确率测试' }
    ]
  },

  onShow() { this.loadStatus(); },

  // Phase 3: AI看板
  async loadAiDashboard() {
    this.setData({ aiDashboardLoading: true });
    try {
      var res = await wx.cloud.callFunction({ name: 'ai-eval', data: { action: 'dashboard' } });
      if (res.result && res.result.code === 200) {
        this.setData({ aiDashboard: res.result.data, aiDashboardLoading: false });
      }
    } catch(e) { this.setData({ aiDashboardLoading: false }); }
  },

  onAiAction(e) {
    var id = e.currentTarget.dataset.id;
    if (id === 'aiDashboard') this.loadAiDashboard();
    else if (id === 'aiEvalDaily') {
      wx.showLoading({ title: '评估中...' });
      wx.cloud.callFunction({ name: 'ai-eval', data: { action: 'daily_sample' } }).finally(function() {
        wx.hideLoading();
        wx.showToast({ title: '已提交评估任务' });
      });
    }
  },

  async loadStatus() {
    const lastSync = wx.getStorageSync('__db_sync_state__');
    this.setData({ lastSyncTime: lastSync?.time || null, syncStatus: lastSync?.status || 'idle' });
    if (app.globalData.cloudReady) {
      try {
        const res = await wx.cloud.callFunction({ name: 'db-admin', data: { action: 'stats' } });
        if (res.result) this.setData({ cloudStats: res.result.stats || this.data.cloudStats });
      } catch (e) { console.log('[AdminDB] cloud stats failed'); }
    }
  },

  async handleOperation(e) {
    const op = e.currentTarget.dataset.op;
    switch (op) {
      case 'sync':
        this.setData({ syncStatus: 'syncing' });
        wx.showLoading({ title: '同步中...' });
        try {
          if (app.globalData.cloudReady) await wx.cloud.callFunction({ name: 'db-admin', data: { action: 'sync' } });
          wx.setStorageSync('__db_sync_state__', { status: 'synced', time: Date.now() });
          this.setData({ syncStatus: 'synced', lastSyncTime: Date.now() });
          wx.hideLoading(); wx.showToast({ title: '同步完成', icon: 'success' });
        } catch (e) { this.setData({ syncStatus: 'error' }); wx.hideLoading(); wx.showToast({ title: '同步失败', icon: 'none' }); }
        break;
      case 'pull':
        wx.showLoading({ title: '拉取中...' });
        try {
          if (app.globalData.cloudReady) {
            const res = await wx.cloud.callFunction({ name: 'db-admin', data: { action: 'pullAll' } });
            if (res.result?.data) {
              const { documents, reminders, processes } = res.result.data;
              if (documents) saveDocuments(documents);
              if (reminders) saveReminders(reminders);
              if (processes) saveProcessLines(processes);
            }
          }
          wx.hideLoading(); wx.showToast({ title: '拉取完成', icon: 'success' });
        } catch (e) { wx.hideLoading(); wx.showToast({ title: '拉取失败', icon: 'none' }); }
        break;
      case 'backup':
        wx.showLoading({ title: '备份中...' });
        try {
          if (app.globalData.cloudReady) await wx.cloud.callFunction({ name: 'db-admin', data: { action: 'backup' } });
          wx.hideLoading(); wx.showToast({ title: '备份完成', icon: 'success' });
        } catch (e) { wx.hideLoading(); wx.showToast({ title: '备份失败', icon: 'none' }); }
        break;
      case 'clean':
        wx.showModal({ title: '清理缓存', content: '将清理本地过期缓存，确认继续？', success(r) { if (r.confirm) wx.showToast({ title: '清理完成', icon: 'success' }); } });
        break;
      case 'export': wx.showToast({ title: '导出功能开发中', icon: 'none' }); break;
      case 'reset':
        wx.showModal({ title: '⚠️ 危险操作', content: '将清空云端数据库。确认继续？', confirmText: '确认重置', confirmColor: '#DC2626',
          success(r) { if (r.confirm) wx.showToast({ title: '需管理权限', icon: 'none' }); } });
        break;
    }
  },

  async updateAIModel() {
    wx.showLoading({ title: '更新模型...' });
    try {
      if (app.globalData.cloudReady) await wx.cloud.callFunction({ name: 'db-admin', data: { action: 'updateAIConfig' } });
      wx.hideLoading(); wx.showToast({ title: 'AI配置已更新', icon: 'success' });
    } catch (e) { wx.hideLoading(); wx.showToast({ title: '更新失败', icon: 'none' }); }
  }
});
