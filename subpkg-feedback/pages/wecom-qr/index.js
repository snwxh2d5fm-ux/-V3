/**
 * 意见反馈 - 扫码咨询客服 V1.2
 * 企业微信客服二维码扫码页
 */
Page({
  data: {
    qrUrl: '',
    isLoading: true,
    loadError: false
  },

  onLoad() {
    this.loadQRCode();
  },

  // 从云存储加载企业微信客服二维码
  loadQRCode() {
    var that = this;
    // 企微客服二维码（运营方可更换文件而不需发版）
    var fileID = 'cloud://feedback-assets/wecom-customer-service-qr.png';

    wx.cloud.getTempFileURL({
      fileList: [fileID],
      success: function(res) {
        var item = res.fileList[0];
        if (item && item.tempFileURL) {
          that.setData({ qrUrl: item.tempFileURL, isLoading: false });
        } else {
          that.setData({ isLoading: false, loadError: true });
        }
      },
      fail: function() {
        that.setData({ isLoading: false, loadError: true });
      }
    });
  },

  // 长按二维码预览大图
  onPreviewQR() {
    if (!this.data.qrUrl) return;
    wx.previewImage({
      urls: [this.data.qrUrl],
      current: this.data.qrUrl
    });
  }
});
