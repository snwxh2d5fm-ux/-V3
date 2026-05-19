/**
 * 意见反馈 - 添加客服微信
 * 优先加载云存储二维码，失败则显示微信号文字兜底
 */
var WECHAT_ID = 'ZhuGangBanKF';  // 企微客服微信号（运营方可修改）

Page({
  data: {
    qrUrl: '',
    isLoading: true,
    showFallback: false,
    wechatId: WECHAT_ID
  },

  onLoad() {
    this.loadQRCode();
  },

  // 从云存储加载企微客服二维码
  loadQRCode() {
    var that = this;
    var fileID = 'cloud://feedback-assets/wecom-customer-service-qr.png';

    wx.cloud.getTempFileURL({
      fileList: [fileID],
      success: function(res) {
        var item = res.fileList && res.fileList[0];
        if (item && item.tempFileURL && item.status === 0) {
          that.setData({ qrUrl: item.tempFileURL, isLoading: false, showFallback: false });
        } else {
          // 文件存在但无临时链接
          that.setData({ isLoading: false, showFallback: true });
        }
      },
      fail: function() {
        // 云存储文件不存在，直接显示文字兜底
        that.setData({ isLoading: false, showFallback: true });
      }
    });
  },

  // 二维码图片加载失败（云存储文件存在但图片损坏等）
  onQRError() {
    this.setData({ qrUrl: '', showFallback: true });
  },

  // 长按预览大图
  onPreviewQR() {
    if (!this.data.qrUrl) return;
    wx.previewImage({
      urls: [this.data.qrUrl],
      current: this.data.qrUrl
    });
  },

  // 复制微信号
  copyWechatId() {
    wx.setClipboardData({
      data: this.data.wechatId,
      success: function() {
        wx.showToast({ title: '已复制微信号', icon: 'success' });
      }
    });
  }
});
