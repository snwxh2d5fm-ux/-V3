var app = getApp();

Page({
  data: {
    contentTitle: '',
    contentDigest: '',
    contentType: '',
    shareId: '',
    isCreating: false,
    imagePath: '',
    loading: true
  },

  onLoad: function (options) {
    var that = this;

    if (options.shareId) {
      that.setData({ shareId: options.shareId });
      that.resolveShare(options.shareId);
    } else if (options.contentType) {
      that.setData({
        contentType: options.contentType || '',
        contentTitle: options.contentTitle || '',
        contentDigest: options.contentDigest || ''
      });
      that.createShare(options);
    } else {
      wx.showToast({ title: '参数错误', icon: 'none' });
      that.setData({ loading: false });
    }
  },

  onShow: function () {
  },

  resolveShare: function (shareId) {
    var that = this;

    wx.cloud.callFunction({
      name: 'share-resolve',
      data: {
        action: 'resolve',
        shareId: shareId
      },
      success: function (res) {
        var result = res.result;
        if (result && result.code === 0) {
          var data = result.data || {};
          that.setData({
            contentTitle: data.contentTitle || '',
            contentDigest: data.contentDigest || '',
            contentType: data.contentType || '',
            imagePath: data.imagePath || '',
            loading: false
          });
        } else {
          wx.showToast({ title: result.message || '分享内容获取失败', icon: 'none' });
          that.setData({ loading: false });
        }
      },
      fail: function () {
        wx.showToast({ title: '网络错误', icon: 'none' });
        that.setData({ loading: false });
      }
    });
  },

  createShare: function (options) {
    var that = this;
    that.setData({ isCreating: true });

    wx.cloud.callFunction({
      name: 'share-resolve',
      data: {
        action: 'create',
        contentType: options.contentType,
        contentId: options.contentId,
        contentTitle: options.contentTitle,
        contentDigest: options.contentDigest
      },
      success: function (res) {
        var result = res.result;
        if (result && result.code === 0) {
          that.setData({
            shareId: result.data.shareId || '',
            imagePath: result.data.imagePath || '',
            isCreating: false
          });
        } else {
          wx.showToast({ title: result.message || '分享创建失败', icon: 'none' });
          that.setData({ isCreating: false });
        }
      },
      fail: function () {
        wx.showToast({ title: '网络错误', icon: 'none' });
        that.setData({ isCreating: false });
      }
    });
  },

  onShareAppMessage: function () {
    var that = this;
    var shareData = {
      title: that.data.contentTitle || '来自住港伴的分享',
      path: '/subpkg-share/pages/share-preview/index?shareId=' + that.data.shareId
    };
    if (that.data.imagePath) {
      shareData.imageUrl = that.data.imagePath;
    }
    return shareData;
  },

  onSaveImage: function () {
    var that = this;
    var imagePath = that.data.imagePath;

    if (!imagePath) {
      wx.showToast({ title: '暂无分享图片', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...' });

    wx.downloadFile({
      url: imagePath,
      success: function (res) {
        if (res.statusCode === 200) {
          wx.saveImageToPhotosAlbum({
            filePath: res.tempFilePath,
            success: function () {
              wx.showToast({ title: '已保存到相册', icon: 'success' });
            },
            fail: function (err) {
              if (err.errMsg.indexOf('auth deny') !== -1 || err.errMsg.indexOf('not authorized') !== -1) {
                wx.showModal({
                  title: '需要授权',
                  content: '请允许保存到相册',
                  success: function (modalRes) {
                    if (modalRes.confirm) {
                      wx.openSetting();
                    }
                  }
                });
              } else {
                wx.showToast({ title: '保存失败', icon: 'none' });
              }
            },
            complete: function () {
              wx.hideLoading();
            }
          });
        } else {
          wx.hideLoading();
          wx.showToast({ title: '图片下载失败', icon: 'none' });
        }
      },
      fail: function () {
        wx.hideLoading();
        wx.showToast({ title: '图片下载失败', icon: 'none' });
      }
    });
  },

  onCopyLink: function () {
    var that = this;
    var sharePath = '/subpkg-share/pages/share-preview/index?shareId=' + that.data.shareId;

    wx.setClipboardData({
      data: sharePath,
      success: function () {
        wx.showToast({ title: '链接已复制', icon: 'success' });
      },
      fail: function () {
        wx.showToast({ title: '复制失败', icon: 'none' });
      }
    });
  }
});
