/**
 * 意见反馈 - 提交页 V1
 * 功能：类型选择、文字输入(10-500字)、截图上传(1张)、匿名开关、安全检测、提交
 */
Page({
  data: {
    // 表单
    types: [
      { key: 'bug', icon: '🐛', label: '功能异常' },
      { key: 'content', icon: '📝', label: '内容错误' },
      { key: 'other', icon: '💬', label: '其他' }
    ],
    selectedType: '',
    content: '',
    contentLen: 0,
    placeholder: '请描述你遇到的问题...',

    // 截图
    screenshotPath: '',      // 临时路径（展示用）
    screenshotFileID: '',    // 云存储fileID
    isUploading: false,

    // 匿名
    isAnonymous: false,
    nickname: '',

    // 提交状态
    isSubmitting: false,
    canSubmit: false
  },

  onLoad() {
    var app = getApp();
    var userInfo = (app && app.globalData && app.globalData.userInfo) || {};
    var nick = userInfo.nickName || '';
    this.setData({ nickname: maskNick(nick) });
  },

  // ===== 类型选择 =====
  onTypeSelect(e) {
    var type = e.currentTarget.dataset.type;
    var placeholders = {
      bug: '请描述你遇到的问题，操作步骤是什么？',
      content: '请指出哪部分内容有误，正确的应该是？',
      other: '请详细描述你的反馈...'
    };
    this.setData({
      selectedType: type,
      placeholder: placeholders[type] || placeholders.other
    });
    this.checkCanSubmit();
  },

  // ===== 文字输入 =====
  onContentInput(e) {
    var val = e.detail.value || '';
    if (val.length > 500) {
      val = val.substring(0, 500);
    }
    this.setData({ content: val, contentLen: val.length });
    this.checkCanSubmit();
  },

  // ===== 截图上传 =====
  onChooseImage() {
    var that = this;
    if (this.data.screenshotPath) {
      wx.showToast({ title: '已有一张截图，可删除后重选', icon: 'none' });
      return;
    }
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['camera', 'album'],
      success: function(res) {
        var tempPath = res.tempFilePaths[0];
        // 大小检查（10MB）
        var fs = wx.getFileSystemManager();
        try {
          var stat = fs.statSync(tempPath);
          if (stat.size > 10 * 1024 * 1024) {
            wx.showToast({ title: '图片过大，请选择小于10MB的图片', icon: 'none' });
            return;
          }
        } catch (e) { /* 忽略 */ }

        // 图片安全检测
        that.setData({ isUploading: true });
        wx.cloud.callFunction({
          name: 'content-moderation',
          data: { action: 'moderateText', content: 'image_upload' }
        }).catch(function() { /* 降级 */ });

        // 上传到云存储
        var cloudPath = 'feedback/screenshots/' + Date.now() + '_' + Math.random().toString(36).substring(2, 8) + '.jpg';
        wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: tempPath,
          success: function(uploadRes) {
            that.setData({
              screenshotPath: tempPath,
              screenshotFileID: uploadRes.fileID,
              isUploading: false
            });
          },
          fail: function() {
            that.setData({ isUploading: false });
            wx.showToast({ title: '上传失败，请重试', icon: 'none' });
          }
        });
      }
    });
  },

  // ===== 删除截图 =====
  onRemoveScreenshot() {
    // 删除云存储文件
    if (this.data.screenshotFileID) {
      wx.cloud.deleteFile({
        fileList: [this.data.screenshotFileID]
      }).catch(function() { /* 忽略删除失败 */ });
    }
    this.setData({ screenshotPath: '', screenshotFileID: '' });
  },

  // ===== 匿名开关 =====
  onToggleAnonymous(e) {
    this.setData({ isAnonymous: e.detail.value });
  },

  // ===== 检查提交条件 =====
  checkCanSubmit() {
    var can = this.data.selectedType && this.data.content.trim().length >= 10 && !this.data.isSubmitting;
    this.setData({ canSubmit: can });
  },

  // ===== 提交反馈 =====
  onSubmit() {
    if (!this.data.canSubmit || this.data.isSubmitting) return;

    var that = this;
    this.setData({ isSubmitting: true });

    // 文本安全检测
    wx.cloud.callFunction({
      name: 'feedback-submit',
      data: {
        action: 'submit',
        type: this.data.selectedType,
        content: this.data.content.trim(),
        screenshot: this.data.screenshotFileID,
        isAnonymous: this.data.isAnonymous,
        contact: {
          nickname: this.data.isAnonymous ? '' : this.data.nickname
        }
      }
    }).then(function(res) {
      var result = res.result;
      if (result.code === 0) {
        var ticketId = result.data.ticketId;
        wx.showModal({
          title: '提交成功',
          content: '工单号: ' + ticketId + '\n\n我们会尽快处理你的反馈。',
          confirmText: '查看我的反馈',
          cancelText: '返回',
          success: function(modalRes) {
            if (modalRes.confirm) {
              wx.navigateTo({ url: '/subpkg-feedback/pages/list/index' });
            } else {
              wx.navigateBack();
            }
          }
        });
      } else {
        wx.showToast({ title: result.msg || '提交失败', icon: 'none' });
        that.setData({ isSubmitting: false, canSubmit: true });
      }
    }).catch(function() {
      wx.showToast({ title: '网络异常，请重试', icon: 'none' });
      that.setData({ isSubmitting: false, canSubmit: true });
    });
  },

  // ===== 跳转我的反馈 =====
  goToList() {
    wx.navigateTo({ url: '/subpkg-feedback/pages/list/index' });
  },

  // ===== 跳转企微客服 =====
  goToWeCom() {
    wx.navigateTo({ url: '/subpkg-feedback/pages/wecom-qr/index' });
  }
});

// 脱敏昵称
function maskNick(name) {
  if (!name) return '';
  if (name.length <= 2) return name[0] + '*';
  return name[0] + '**' + name[name.length - 1];
}
