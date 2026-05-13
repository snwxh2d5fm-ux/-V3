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
    showPrivacyPanel: false
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
        this.setData({
          doc,
          ocrFields: this.parseOCRFields(doc),
          currentPIILevel: wx.getStorageSync(CONSTANTS.STORAGE_KEYS.PRIVACY_MODE) || 'L1',
          isArchived: doc.status === 'archived'
        });
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
    
    if (level === PII_LEVELS.L3) return value; // 可保留
    
    const piiKeys = {
      name: 'name',
      idNumber: 'idNumber', 
      phone: 'phone',
      email: 'email'
    };

    if (!piiKeys[key]) return value;

    if (level === PII_LEVELS.L1) {
      // 绝对脱敏：完全占位符
      if (key === 'idNumber') return '**** **** **** ****';
      if (key === 'name') return '***';
      return '****';
    } else {
      // L2 泛化脱敏
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
    
    // 刷新OCR字段显示
    if (this.data.doc) {
      this.setData({ ocrFields: this.parseOCRFields(this.data.doc) });
    }
    wx.showToast({ title: `切换至${CONSTANTS.PII_LEVELS[newLevel].label || newLevel}`, icon: 'none' });
  },

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
            // ✅ 从保险库(__vault_meta__)删除元数据 + 物理文件
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

  /** 点击图片全屏预览 */
  previewImage() {
    var doc = this.data.doc;
    if (doc && doc.filePath) {
      wx.previewImage({
        urls: [doc.filePath],
        current: doc.filePath
      });
    }
  },

  /** Bug #8: 导出证件照片为PDF */
  exportToPDF() {
    var that = this;
    var doc = this.data.doc;
    if (!doc || !doc.filePath) {
      wx.showToast({ title: '无可用图片', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '生成PDF中...' });

    // 收集该证件所有照片（通过元数据查找同一docId的关联文件）
    var allDocs = [];
    try {
      var storage = require('../../../utils/storage');
      allDocs = storage.getAllDocuments();
    } catch (e) { allDocs = []; }

    var docPhotos = [doc.filePath];
    // 搜索同一卡槽/同一证件的关联照片
    allDocs.forEach(function(d) {
      if (d.id !== doc.id && d.slotKey === doc.slotKey && d.filePath && docPhotos.indexOf(d.filePath) < 0) {
        docPhotos.push(d.filePath);
      }
    });

    var imagePaths = docPhotos.slice(0, 10); // 最多10页

    // 方案：上传图片到云存储 → 调云函数合成PDF → 下载打开
    var app = getApp();
    if (!app.globalData.cloudReady) {
      wx.hideLoading();
      // 降级方案：直接用微信分享图片
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

    // 上传图片到云存储
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
        // 下载PDF并打开
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
