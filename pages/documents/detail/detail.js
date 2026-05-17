// pages/documents/detail/detail.js
const { getDocumentMeta, deleteDocument: deleteDocFromVault, saveDocumentMeta } = require('../../../utils/storage');

Page({
  data: {
    docId: '',
    doc: null,
    ocrFields: [],
    isArchived: false,
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
      name: '姓名', idNumber: '证件号', birthDate: '出生日期',
      issueDate: '签发日期', expiryDate: '有效期至',
      issuingAuthority: '签发机关', nationality: '国籍', docType: '证件类型'
    };
    Object.keys(rawData).forEach(function(key) {
      const value = rawData[key];
      if (value && value !== '未识别') {
        fields.push({ key: key, label: fieldMap[key] || key, value: String(value) });
      }
    });
    return fields;
  },

  archiveDocument() {
    var that = this;
    wx.showModal({
      title: '归档证件',
      content: '归档后证件将从主列表隐藏，可随时恢复。确定归档？',
      success: function(res) {
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
          } catch (e) { wx.showToast({ title: '操作失败', icon: 'error' }); }
        }
      }
    });
  },

  restoreDocument() {
    try {
      const doc = getDocumentMeta(this.data.docId);
      if (!doc) { wx.showToast({ title: '证件不存在', icon: 'none' }); return; }
      doc.status = 'active';
      delete doc.archivedAt;
      saveDocumentMeta(doc);
      this.setData({ isArchived: false, doc: doc });
      wx.showToast({ title: '已恢复', icon: 'success' });
    } catch (e) { wx.showToast({ title: '操作失败', icon: 'error' }); }
  },

  deleteDocument() {
    var that = this;
    wx.showModal({
      title: '删除证件',
      content: '删除后不可恢复，确定删除？',
      confirmColor: '#d93025',
      success: function(res) {
        if (res.confirm) {
          try {
            const deleted = deleteDocFromVault(that.data.docId);
            if (deleted) {
              wx.showToast({ title: '已删除', icon: 'success' });
              setTimeout(function() { wx.navigateBack(); }, 1000);
            } else { wx.showToast({ title: '证件不存在', icon: 'none' }); }
          } catch (e) { wx.showToast({ title: '删除失败', icon: 'error' }); }
        }
      }
    });
  },

  previewImage() {
    var doc = this.data.doc;
    if (doc && doc.filePath) {
      wx.previewImage({ urls: [doc.filePath], current: doc.filePath });
    }
  }
});
