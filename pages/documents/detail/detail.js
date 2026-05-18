// pages/documents/detail/detail.js
const CONSTANTS = require('../../../data/constants.js');
const { getDocumentMeta, deleteDocument: deleteDocFromVault, saveDocumentMeta } = require('../../../utils/storage');

Page({
  data: {
    docId: '',
    doc: null,
    ocrFields: [],
    currentPIILevel: 'L1', // L1绝对脱敏/L2泛化/L3可保留
    isArchived: false,
    showPrivacyPanel: false,
    // Bug #6: Canvas渲染的脱敏图像
    maskedImagePath: '',
    _maskTimer: null
  },

  onLoad(options) {
    const { id } = options;
    if (id) {
      this.setData({ docId: id });
      this.loadDocument(id);
    }
  },

  loadDocument(docId) {
    try {
      const doc = getDocumentMeta(docId);
      if (doc) {
        var piiLevel = wx.getStorageSync(CONSTANTS.STORAGE_KEYS.PRIVACY_MODE) || 'L1';
        this.setData({ currentPIILevel: piiLevel });
        this.setData({
          doc,
          ocrFields: this.parseOCRFields(doc),
          isArchived: doc.status === 'archived'
        });
        // Bug #6: 加载后自动渲染脱敏图像
        this.renderMaskedImage();
      }
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'error' });
    }
  },

  parseOCRFields(doc) {
    if (!doc || !doc.ocrData) return [];
    const fields = [];
    const rawData = doc.ocrData;
    
    const fieldMap = {
      name: '姓名',
      idNumber: '证件号',
      birthDate: '出生日期',
      issueDate: '签发日期',
      expiryDate: '有效期至',
      issuingAuthority: '签发机关',
      nationality: '国籍',
      docType: '证件类型'
    };

    Object.keys(rawData).forEach(key => {
      const value = rawData[key];
      if (value && value !== '未识别') {
        fields.push({
          key,
          label: fieldMap[key] || key,
          value: this.applyPIIMask(key, String(value)),
          rawValue: String(value),
          isPII: ['name', 'idNumber', 'birthDate'].includes(key)
        });
      }
    });
    return fields;
  },

  applyPIIMask(key, value) {
    const level = this.data.currentPIILevel;
    const PII_LEVELS = CONSTANTS.PII_LEVELS;
    
    if (level === PII_LEVELS.L3) return value;
    
    const piiKeys = {
      name: 'name',
      idNumber: 'idNumber', 
      phone: 'phone',
      email: 'email'
    };

    if (!piiKeys[key]) return value;

    if (level === PII_LEVELS.L1) {
      if (key === 'idNumber') return '**** **** **** ****';
      if (key === 'name') return '***';
      return '****';
    } else {
      if (key === 'idNumber') {
        return value.length > 6 ? value.slice(0, 3) + '****' + value.slice(-2) : '****';
      }
      if (key === 'name') {
        return value.length > 1 ? value[0] + '*' + (value.length > 2 ? '*' : '') : '**';
      }
      return '****';
    }
  },

  togglePIILevel() {
    const levels = ['L1', 'L2', 'L3'];
    const currentIdx = levels.indexOf(this.data.currentPIILevel);
    const nextIdx = (currentIdx + 1) % levels.length;
    const newLevel = levels[nextIdx];
    
    this.setData({ currentPIILevel: newLevel });
    wx.setStorageSync(CONSTANTS.STORAGE_KEYS.PRIVACY_MODE, newLevel);
    
    if (this.data.doc) {
      this.setData({ ocrFields: this.parseOCRFields(this.data.doc) });
      // Bug #6: 脱敏级别变更重新渲染图像遮罩
      this.renderMaskedImage();
    }
    wx.showToast({ title: '切换至' + (CONSTANTS.PII_LEVELS[newLevel].label || newLevel), icon: 'none' });
  },

  // ═══════════ Bug #6: 图像级脱敏 ═══════════

  /**
   * 入口: 防抖调用Canvas渲染
   */
  renderMaskedImage() {
    var that = this;
    var doc = this.data.doc;
    var level = this.data.currentPIILevel;

    if (level === 'L3') {
      this.setData({ maskedImagePath: '' });
      return;
    }
    if (!doc || !doc.filePath) return;

    if (this.data._maskTimer) clearTimeout(this.data._maskTimer);
    this.data._maskTimer = setTimeout(function() {
      that._doRenderMask(doc.filePath, level);
    }, 300);
  },

  _doRenderMask(imagePath, level) {
    var that = this;
    var query = wx.createSelectorQuery();
    query.select('#mask-canvas').fields({ node: true, size: true }).exec(function(res) {
      if (!res || !res[0] || !res[0].node) {
        console.warn('[脱敏] Canvas节点未找到，降级原图');
        that.setData({ maskedImagePath: '' });
        return;
      }

      var canvas = res[0].node;
      var ctx = canvas.getContext('2d');

      wx.getImageInfo({
        src: imagePath,
        success: function(info) {
          canvas.width = info.width;
          canvas.height = info.height;
          var img = canvas.createImage();
          img.onload = function() {
            ctx.drawImage(img, 0, 0, info.width, info.height);
            that._drawPIIMasks(ctx, info.width, info.height, level);
            wx.canvasToTempFilePath({
              canvas: canvas,
              success: function(out) { that.setData({ maskedImagePath: out.tempFilePath }); },
              fail: function() { that.setData({ maskedImagePath: '' }); }
            });
          };
          img.onerror = function() { that.setData({ maskedImagePath: '' }); };
          img.src = imagePath;
        },
        fail: function() { that.setData({ maskedImagePath: '' }); }
      });
    });
  },

  _drawPIIMasks(ctx, w, h, level) {
    var regions = [
      { x: 0.05, y: 0.08, w: 0.18, h: 0.28, label: '照片',   l1: true,  l2: false },
      { x: 0.30, y: 0.08, w: 0.45, h: 0.18, label: '个人信息', l1: true,  l2: true  },
      { x: 0.10, y: 0.30, w: 0.70, h: 0.22, label: '住址',    l1: true,  l2: true  },
      { x: 0.15, y: 0.72, w: 0.60, h: 0.10, label: '证件号',  l1: true,  l2: true  }
    ];

    regions.forEach(function(r) {
      var should = (level === 'L1' && r.l1) || (level === 'L2' && r.l2);
      if (!should) return;

      var rx = r.x * w, ry = r.y * h, rw = r.w * w, rh = r.h * h;

      if (level === 'L1') {
        ctx.fillStyle = 'rgba(17, 24, 39, 0.92)';
        ctx.fillRect(rx, ry, rw, rh);
        var fs = Math.max(12, Math.min(rh * 0.4, 24));
        ctx.fillStyle = '#FFFFFF';
        ctx.font = fs + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔒 ' + r.label, rx + rw / 2, ry + rh / 2);
      } else {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.35)';
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.25)';
        ctx.lineWidth = 2;
        for (var i = 0; i < rw; i += 10) {
          ctx.beginPath();
          ctx.moveTo(rx + i, ry);
          ctx.lineTo(rx + i, ry + rh);
          ctx.stroke();
        }
        var fs2 = Math.max(10, Math.min(rh * 0.35, 20));
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = 'bold ' + fs2 + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('泛化脱敏', rx + rw / 2, ry + rh / 2);
      }
    });
  },

  // ═══════════ 证件操作 ═══════════

  archiveDocument() {
    const that = this;
    wx.showModal({
      title: '归档证件',
      content: '归档后证件将从主列表隐藏，可随时恢复。确定归档？',
      success(res) {
        if (res.confirm) {
          try {
            const doc = getDocumentMeta(that.data.docId);
            if (doc) {
              doc.status = 'archived';
              doc.archivedAt = new Date().toISOString();
              saveDocumentMeta(doc);
              that.setData({ isArchived: true, doc: doc });
              wx.showToast({ title: '已归档', icon: 'success' });
            }
          } catch (e) {
            wx.showToast({ title: '操作失败', icon: 'error' });
          }
        }
      }
    });
  },

  restoreDocument() {
    try {
      const doc = getDocumentMeta(this.data.docId);
      if (!doc) {
        wx.showToast({ title: '证件不存在', icon: 'none' });
        return;
      }
      if (doc) {
        doc.status = 'active';
        delete doc.archivedAt;
        saveDocumentMeta(doc);
        this.setData({ isArchived: false, doc: doc });
        wx.showToast({ title: '已恢复', icon: 'success' });
      }
    } catch (e) {
      wx.showToast({ title: '操作失败', icon: 'error' });
    }
  },

  deleteDocument() {
    const that = this;
    wx.showModal({
      title: '删除证件',
      content: '删除后不可恢复，确定删除？',
      confirmColor: '#d93025',
      success(res) {
        if (res.confirm) {
          try {
            const deleted = deleteDocFromVault(that.data.docId);
            if (deleted) {
              wx.showToast({ title: '已删除', icon: 'success' });
              setTimeout(() => wx.navigateBack(), 1000);
            } else {
              wx.showToast({ title: '证件不存在', icon: 'none' });
            }
          } catch (e) {
            wx.showToast({ title: '删除失败', icon: 'error' });
          }
        }
      }
    });
  },

  togglePrivacyPanel() {
    this.setData({ showPrivacyPanel: !this.data.showPrivacyPanel });
  },

  getPIIStats() {
    const fields = this.data.ocrFields;
    const piiCount = fields.filter(f => f.isPII).length;
    const totalCount = fields.length;
    const level = this.data.currentPIILevel;
    const levelLabel = CONSTANTS.PII_LEVELS[level]?.label || level;
    const securityScore = level === 'L1' ? 100 : level === 'L2' ? 70 : 30;
    return {
      piiCount,
      totalCount,
      level: levelLabel,
      securityScore,
      encryptionStatus: 'AES-256-GCM'
    };
  },

  previewImage() {
    var doc = this.data.doc;
    if (doc && doc.filePath) {
      wx.previewImage({
        urls: [doc.filePath],
        current: doc.filePath
      });
    }
  },

  exportToPDF() {
    var that = this;
    var doc = this.data.doc;
    if (!doc || !doc.filePath) {
      wx.showToast({ title: '无可用图片', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '生成PDF中...' });

    var allDocs = [];
    try {
      var storage = require('../../../utils/storage');
      allDocs = storage.getAllDocuments();
    } catch (e) { allDocs = []; }

    var docPhotos = [doc.filePath];
    allDocs.forEach(function(d) {
      if (d.id !== doc.id && d.slotKey === doc.slotKey && d.filePath && docPhotos.indexOf(d.filePath) < 0) {
        docPhotos.push(d.filePath);
      }
    });

    var imagePaths = docPhotos.slice(0, 10);

    var app = getApp();
    if (!app.globalData.cloudReady) {
      wx.hideLoading();
      wx.showModal({
        title: 'PDF导出',
        content: '云端服务暂不可用。是否以图片方式分享？',
        confirmText: '分享图片',
        cancelText: '取消',
        success: function(res) {
          if (res.confirm) {
            wx.previewImage({ urls: imagePaths, current: imagePaths[0] });
          }
        }
      });
      return;
    }

    var uploadPromises = imagePaths.map(function(path, idx) {
      return new Promise(function(resolve, reject) {
        var cloudPath = '_pdf_temp/' + Date.now() + '_' + idx + '.jpg';
        wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: path,
          success: function(r) { resolve(r.fileID); },
          fail: function(err) { reject(err); }
        });
      });
    });

    Promise.all(uploadPromises).then(function(fileIDs) {
      return wx.cloud.callFunction({
        name: 'generate-pdf',
        data: {
          action: 'create',
          fileIDs: fileIDs,
          title: doc.name || doc.docType || '证件',
          owner: doc.ownerName || (doc.ownerType === 'self' ? '本人' : doc.ownerType === 'spouse' ? '配偶' : '子女'),
          docNumber: doc.docNumber || '',
          validFrom: doc.validFrom || '',
          validTo: doc.validTo || ''
        }
      });
    }).then(function(res) {
      wx.hideLoading();
      var result = res.result || {};
      if (result.code === 0 && result.data && result.data.pdfFileID) {
        wx.cloud.downloadFile({
          fileID: result.data.pdfFileID,
          success: function(dfRes) {
            wx.openDocument({
              filePath: dfRes.tempFilePath,
              fileType: 'pdf',
              showMenu: true,
              success: function() {
                wx.showToast({ title: 'PDF已打开', icon: 'success' });
              },
              fail: function() {
                wx.showToast({ title: '请用其他应用打开', icon: 'none' });
              }
            });
          },
          fail: function() {
            wx.showToast({ title: '下载失败', icon: 'none' });
          }
        });
      } else {
        wx.showToast({ title: (result.msg || '生成失败'), icon: 'none' });
      }
    }).catch(function(err) {
      wx.hideLoading();
      console.error('[PDF] 导出失败:', err);
      wx.showModal({
        title: 'PDF导出',
        content: '生成PDF失败。是否以图片方式查看？',
        confirmText: '查看图片',
        cancelText: '取消',
        success: function(res) {
          if (res.confirm) {
            wx.previewImage({ urls: imagePaths, current: imagePaths[0] });
          }
        }
      });
    });
  }

});
