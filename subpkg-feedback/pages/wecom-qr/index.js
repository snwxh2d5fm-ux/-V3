/**
 * 联系客服 — 微信原生客服会话
 * 使用 open-type="contact" 按钮直接唤起微信客服对话
 * 前提：小程序后台已绑定微信客服（「功能 > 客服」中配置）
 */
Page({
  data: {},

  onLoad() {
    // 无需额外加载，button 原生唤起
  },

  /** 客服按钮回调：成功则记录触点，失败则降级到 API 方式 */
  onContactCallback(e) {
    var errMsg = (e.detail || {}).errMsg || '';
    if (errMsg.indexOf('fail') !== -1) {
      console.warn('[客服] contact按钮失败, 降级到 API:', errMsg);
      this.openCS();
    }
  },

  /** 备用：如果按钮不生效，尝试 API 方式 */
  openCS() {
    wx.openCustomerServiceConversation({
      success: function () {
        // 对话窗口已打开
      },
      fail: function (err) {
        console.error('[客服] 打开失败:', err);
        wx.showToast({ title: '客服功能暂不可用，请稍后重试', icon: 'none' });
      },
    });
  },
});
