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

});
