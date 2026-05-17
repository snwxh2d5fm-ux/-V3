// pages/documents/detail/detail.js
const { getDocumentMeta, deleteDocument: deleteDocFromVault, saveDocumentMeta } = require('../../../utils/storage');

var DOC_SPECS = {
  'id_card': { tip: '身份证正反面彩色扫描，JPG/PDF，文件<5MB', validity: '长期', size: 'A4' },
  'hk_permit': { tip: '港澳通行证个人信息页+签注页，有效期需>6个月', validity: '6个月', size: 'A4' },
  'passport': { tip: '护照个人信息页彩色扫描，有效期需>6个月', validity: '6个月', size: 'A4' },
  'marriage_cert': { tip: '结婚证封面+盖章页+持证人信息页，多页录入', validity: '长期', size: 'A4' },
  'birth_cert': { tip: '出生证明原件彩色扫描', validity: '长期', size: 'A4' },
  'degree_cert': { tip: '学位证书原件彩色扫描+英文翻译件(如有)', validity: '长期', size: 'A4' },
  'transcript': { tip: '官方成绩单密封件或电子认证版', validity: '长期', size: 'A4' },
  'degree_auth': { tip: '学信网/学位网认证报告', validity: '长期', size: 'A4' },
  'emp_letter': { tip: '公司信纸打印，注明职位/入职日期/薪资，加盖公章', validity: '3个月', size: 'A4' },
  'bank_statement': { tip: '银行开具的中英文存款证明，近6个月流水', validity: '3个月', size: 'A4' },
  'tax_record': { tip: '个人所得税完税证明，税务局官网下载', validity: '12个月', size: 'A4' },
  'photo': { tip: '白底彩色证件照，33mm×48mm，JPG格式，<5MB', validity: '6个月', size: '33×48mm' },
  'income_250w': { tip: '税单+银行流水+雇主证明，证明年收入≥250万港币', validity: '3个月', size: 'A4' },
  'hk_id': { tip: '香港身份证正反面', validity: '长期', size: 'A4' },
  'spouse_id': { tip: '配偶内地身份证正反面', validity: '长期', size: 'A4' },
  'spouse_passport': { tip: '配偶港澳通行证信息页+签注页', validity: '6个月', size: 'A4' },
  'biz_license': { tip: '营业执照原件彩色扫描，加盖公司公章', validity: '长期', size: 'A4' },
  'biz_tax': { tip: '企业完税证明，税务局官网下载', validity: '12个月', size: 'A4' },
};

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
        var spec = DOC_SPECS[doc.type] || DOC_SPECS[doc.slotKey] || null;
        this.setData({
          doc,
          ocrFields: this.parseOCRFields(doc),
          isArchived: doc.status === 'archived',
          spec: spec
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
  },

  replaceDocument() {
    var that = this;
    var doc = this.data.doc;
    if (!doc) return;

    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['camera', 'album'],
      success: function(res) {
        var filePath = res.tempFilePaths[0];
        // 保存到系统相册
        wx.saveImageToPhotosAlbum({
          filePath: filePath,
          success: function() {},
          fail: function() {}
        });
        // 更新文件路径
        doc.filePath = filePath;
        doc.updatedAt = new Date().toISOString();
        saveDocumentMeta(doc);
        that.setData({ doc: doc });
        wx.showToast({ title: '已替换', icon: 'success' });
      }
    });
  }
});
