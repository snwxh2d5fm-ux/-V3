/**
 * 住港伴 v4.5 — 身份状态选择页 (纯本地版)
 * 拍照即留存，文件仅存手机本地，不做任何上传
 */
var app = getApp();
var constants = require('../../data/constants');

Page({
  data: {
    selectedStatus: '',
    selectedSubStatus: '',
    canConfirm: false,
    capturing: false,
    capturedImage: '',
    capturedSummary: '',
    capturedType: '',

    stageSteps: [
      { id: 'evaluation', label: '资格评估', status: 'active' },
      { id: 'preparation', label: '材料准备', status: 'pending' },
      { id: 'submission', label: '线上申请', status: 'pending' },
      { id: 'waiting', label: '等待获批', status: 'pending' },
      { id: 'activation', label: '获批激活', status: 'pending' },
      { id: 'settlement', label: '抵港生活', status: 'pending' },
      { id: 'pr', label: '永居', status: 'pending' }
    ],
    stageProgress: 0
  },

  selectCard: function(e) {
    var status = e.currentTarget.dataset.status;
    this.setData({
      selectedStatus: status,
      selectedSubStatus: '',
      capturedImage: '',
      capturedSummary: '',
      capturedType: '',
      canConfirm: false
    });
  },

  collapseCard: function() {
    this.setData({
      selectedStatus: '',
      selectedSubStatus: '',
      capturedImage: '',
      capturedSummary: '',
      capturedType: '',
      canConfirm: false
    });
  },

  selectSub: function(e) {
    var value = e.currentTarget.dataset.value;
    var status = this.data.selectedStatus;
    this.setData({
      selectedSubStatus: value,
      capturedImage: '',
      capturedSummary: '',
      capturedType: ''
    });
    if (status === 'unapplied') {
      this.setData({ canConfirm: true });
    } else {
      this.setData({ canConfirm: false });
    }
  },

  // ========== 拍照留存（纯本地，不做上传校验） ==========
  captureDoc: function(e) {
    var that = this;
    var docType = e.currentTarget.dataset.type;

    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['camera'],
      success: function(res) {
        var filePath = res.tempFilePaths[0];

        // 保存到系统相册
        wx.saveImageToPhotosAlbum({
          filePath: filePath,
          success: function() {
            wx.showToast({ title: '已保存到相册', icon: 'success' });
          },
          fail: function() {
            // 授权被拒不影响流程
          }
        });

        // 直接确认，无 OCR 无上传无校验
        that.setData({
          capturedImage: filePath,
          capturedSummary: '已留存',
          capturedType: docType,
          ocrMatched: true,
          ocrWarning: '',
          canConfirm: true,
          capturing: false
        });
      },
      fail: function(err) {
        if (err.errMsg && err.errMsg.indexOf('cancel') > -1) return;
        wx.showToast({ title: '拍照失败，请重试', icon: 'none' });
      }
    });
  },

  /** 将 OCR 识别到的类型映射回 sub-status 值 */
  matchToSubStatus: function(extractedType, status) {
    if (!extractedType) return '';
    var map = {
      '优才': 'submitted_qmas', '高才通': 'submitted_ttps',
      '高才': 'submitted_ttps', '专才': 'submitted_asmpt',
      'IANG': 'submitted_iang', '投资类身份规划': 'submitted_cies',
      '科技人才': 'submitted_techtas',
      '在港就业': 'approved_employed', '在港创业': 'approved_business',
      '在港学习': 'approved_studying', '主要在内地': 'approved_mainland'
    };
    // 找最匹配的
    for (var key in map) {
      if (extractedType.indexOf(key) !== -1 || key.indexOf(extractedType) !== -1) {
        return map[key];
      }
    }
    return '';
  },

  /** 保存到手机本地文件系统 */
  saveToLocal: function(type, tempPath) {
    try {
      var fs = wx.getFileSystemManager();
      var dir = wx.env.USER_DATA_PATH + '/identity_docs';
      try { fs.accessSync(dir); } catch (e) { fs.mkdirSync(dir, true); }
      var fileName = type + '_' + Date.now() + '.jpg';
      var targetPath = dir + '/' + fileName;
      fs.copyFileSync(tempPath, targetPath);
      return targetPath;
    } catch (e) {
      console.warn('[capture] 本地保存失败，使用临时路径:', e);
      return tempPath;
    }
  },

  /** 根据类型返回留存描述 */
  getDocSummary: function(type) {
    var map = {
      'submission_receipt': '递交回执 · 已留存本地',
      'hk_id_visa': '身份证/签证 · 已留存本地',
      'hk_permanent_id': '永居身份证 · 已留存本地'
    };
    return map[type] || '证件 · 已留存本地';
  },

  // ========== 跳转 ==========
  skipIdentity: function() {
    this.saveStatus('skipped', null);
    wx.showToast({ title: '可稍后在「我的」补选', icon: 'none', duration: 1500 });
    wx.reLaunch({ url: '/pages/process/index/index' });
  },

  confirmStatus: function() {
    var that = this;
    var selectedStatus = that.data.selectedStatus;
    var selectedSubStatus = that.data.selectedSubStatus;

    if (!selectedStatus) { wx.showToast({ title: '请选择你的当前状态', icon: 'none' }); return; }
    if (!selectedSubStatus) { wx.showToast({ title: '请选择细分选项', icon: 'none' }); return; }
    if (!that.data.canConfirm) { wx.showToast({ title: '请拍照留存', icon: 'none' }); return; }

    wx.showLoading({ title: '保存中...' });
    try {
      that.saveStatus(selectedStatus, selectedSubStatus);
      wx.hideLoading();
      wx.showToast({ title: '设置成功', icon: 'success', duration: 1000 });

      if (selectedStatus === 'unapplied') {
        var personaMap = { unapplied_student: 1, unapplied_employed: 2, unapplied_owner: 4, unapplied_overseas: 7 };
        wx.setStorageSync('__assessment_persona__', personaMap[selectedSubStatus] || 0);
        app.globalData._persona = personaMap[selectedSubStatus] || 0;
      }

      wx.reLaunch({ url: '/pages/process/index/index' });
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    }
  },

  saveStatus: function(status, subStatus) {
    wx.setStorageSync(constants.STORAGE_KEYS.USER_STATUS, status);
    wx.setStorageSync(constants.STORAGE_KEYS.USER_SUB_STATUS, subStatus);
    app.globalData.userStatus = status;
    app.globalData.userSubStatus = subStatus;

    var pathMap = {
      submitted_qmas: 'qmas', submitted_ttps: 'ttps_a', submitted_asmpt: 'asmpt',
      submitted_iang: 'student_iang', submitted_cies: 'cies',
      approved_employed: 'qmas', approved_business: 'ttps_a'
    };
    var path = pathMap[subStatus] || null;
    if (path) {
      app.globalData.selectedPath = path;
      wx.setStorageSync('__active_process_id__', path);
      wx.setStorageSync('__selected_path__', path);
    }
  }
});
