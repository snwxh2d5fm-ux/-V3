/**
 * PDF 生成器 — 卡槽多页证件合成
 *
 * 流程: 本地图片 → CloudBase 临时上传 → generate-pdf 云函数 → 下载PDF → 存本地 → 打开
 * 缓存: 生成后存到 vault 目录，下次直接打开，新照片上传后自动失效重新生成
 */

var STORAGE_KEY = '__slot_pdfs__'; // { slotKey: { path, docCount } }

/** 获取已保存的 PDF 路径（文档数不变时才有效） */
function getSavedPDF(slotKey, currentDocCount) {
  try {
    var map = wx.getStorageSync(STORAGE_KEY) || {};
    var entry = map[slotKey];
    if (!entry || !entry.path) return null;
    // 文档数变了 → 缓存失效，需重新生成
    if (currentDocCount !== undefined && entry.docCount !== currentDocCount) return null;
    return entry.path;
  } catch(e) { return null; }
}

/** 保存 PDF 路径（含文档计数） */
function savePDF(slotKey, filePath, docCount) {
  try {
    var map = wx.getStorageSync(STORAGE_KEY) || {};
    map[slotKey] = { path: filePath, docCount: docCount };
    wx.setStorageSync(STORAGE_KEY, map);
  } catch(e) {}
}

/** 清除卡槽 PDF 缓存（新增照片后调用） */
function clearSlotPDF(slotKey) {
  try {
    var map = wx.getStorageSync(STORAGE_KEY) || {};
    delete map[slotKey];
    wx.setStorageSync(STORAGE_KEY, map);
  } catch(e) {}
}

/**
 * 生成卡槽 PDF（如已缓存则直接打开）
 * @param {string} slotKey
 * @param {string} slotName
 * @param {Array}  uploadedDocs
 */
function generateSlotPDF(slotKey, slotName, uploadedDocs) {
  var docCount = (uploadedDocs || []).length;
  // 检查缓存（文档数不变时直接打开）
  var retryCount = slotKey._pdfRetry || 0;
  var cached = getSavedPDF(slotKey, docCount);
  if (cached) {
    wx.openDocument({
      filePath: cached,
      fileType: 'pdf',
      showMenu: true,
      fail: function() {
        if (retryCount >= 3) {
          wx.showToast({ title: 'PDF 打开失败，请重试', icon: 'none' });
          clearSlotPDF(slotKey);
          return;
        }
        slotKey._pdfRetry = retryCount + 1;
        clearSlotPDF(slotKey);
        generateSlotPDF(slotKey, slotName, uploadedDocs);
      }
    });
    return;
  }
  slotKey._pdfRetry = 0;

  if (!uploadedDocs || !uploadedDocs.length) {
    wx.showToast({ title: '无图片可合成', icon: 'none' });
    return;
  }
  slotKey._pdfRetry = 0;

  var paths = [];
  uploadedDocs.forEach(function(d) {
    if (d.filePath) paths.push(d.filePath);
  });
  if (!paths.length) {
    wx.showToast({ title: '无有效图片', icon: 'none' });
    return;
  }
  slotKey._pdfRetry = 0;

  wx.showLoading({ title: '合成PDF中...' });

  var uploadPromises = paths.map(function(p, idx) {
    return new Promise(function(resolve, reject) {
      // 验证文件可读
      try {
        var fs = wx.getFileSystemManager();
        fs.accessSync(p);
      } catch(e) {
        reject(new Error('文件不可读: ' + p));
        return;
      }
      var cloudPath = '_pdf_temp/' + Date.now() + '_' + idx + '_' + Math.random().toString(36).slice(2, 5) + '.jpg';
      wx.cloud.uploadFile({
        cloudPath: cloudPath, filePath: p,
        config: { env: 'cloudbase-d1g17tgt7cc199a60' },
        success: function(r) { resolve(r.fileID); },
        fail: function(err) {
          // 兜底：压缩后重试
          wx.compressImage({
            src: p, quality: 60,
            success: function(cRes) {
              wx.cloud.uploadFile({
                cloudPath: cloudPath, filePath: cRes.tempFilePath,
                success: function(r2) { resolve(r2.fileID); },
                fail: function(e2) { reject(e2); }
              });
            },
            fail: function() { reject(err); }
          });
        }
      });
    });
  });

  Promise.all(uploadPromises).then(function(fileIDs) {
    return wx.cloud.callFunction({
      name: 'generate-pdf',
      data: { action: 'create', fileIDs: fileIDs, title: slotName || '证件卡槽' }
    });
  }).then(function(res) {
    var result = res.result || {};
    if (result.code === 0 && result.data && result.data.pdfFileID) {
      return new Promise(function(resolve, reject) {
        wx.cloud.downloadFile({
          fileID: result.data.pdfFileID,
          success: function(dfRes) { resolve(dfRes.tempFilePath); },
          fail: reject
        });
      });
    }
    wx.hideLoading();
    wx.showToast({ title: (res.result || {}).error || '生成失败', icon: 'none' });
    return null;
  }).then(function(tempPath) {
    if (!tempPath) return;
    // 持久化到 vault 目录
    var vaultBase = wx.env.USER_DATA_PATH + '/vault/';
    var fs = wx.getFileSystemManager();
    try { fs.accessSync(vaultBase); } catch(_) { fs.mkdirSync(vaultBase, true); }
    var persistPath = vaultBase + 'pdf_' + slotKey + '_' + Date.now() + '.pdf';
    try {
      fs.copyFileSync(tempPath, persistPath);
      savePDF(slotKey, persistPath, docCount);
      wx.hideLoading();
      wx.openDocument({
        filePath: persistPath,
        fileType: 'pdf',
        showMenu: true,
        success: function() { wx.showToast({ title: 'PDF已保存到卡槽', icon: 'success' }); },
        fail: function() { wx.showToast({ title: '请用其他应用打开', icon: 'none' }); }
      });
    } catch(e) {
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  }).catch(function(err) {
    wx.hideLoading();
    console.error('[PDF] 合成失败:', err);
    wx.showToast({ title: '网络异常，请重试', icon: 'none' });
  });
}

module.exports = { generateSlotPDF, getSavedPDF, clearSlotPDF };
