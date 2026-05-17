/**
 * PDF 生成器 — 卡槽多页证件合成
 * 
 * 流程: 本地图片 → CloudBase 临时上传 → generate-pdf 云函数 → 下载PDF → 打开
 */
function generateSlotPDF(slotKey, slotName, uploadedDocs) {
  if (!uploadedDocs || !uploadedDocs.length) {
    wx.showToast({ title: '无图片可合成', icon: 'none' });
    return;
  }

  wx.showLoading({ title: '合成PDF中...' });

  // 收集所有图片路径
  var paths = [];
  uploadedDocs.forEach(function(d) {
    if (d.filePath) paths.push(d.filePath);
  });
  if (!paths.length) {
    wx.hideLoading();
    wx.showToast({ title: '无有效图片', icon: 'none' });
    return;
  }

  // 批量上传到 CloudBase 临时目录
  var uploadPromises = paths.map(function(p, idx) {
    return new Promise(function(resolve, reject) {
      var cloudPath = '_pdf_temp/' + Date.now() + '_' + idx + '_' + Math.random().toString(36).slice(2, 5) + '.jpg';
      wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: p,
        success: function(r) { resolve(r.fileID); },
        fail: function(e) { reject(e); }
      });
    });
  });

  Promise.all(uploadPromises).then(function(fileIDs) {
    // 调用云函数合成PDF
    return wx.cloud.callFunction({
      name: 'generate-pdf',
      data: {
        action: 'create',
        fileIDs: fileIDs,
        title: slotName || '证件卡槽'
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
              wx.showToast({ title: (result.data.pageCount || '') + '页PDF已生成', icon: 'success' });
            },
            fail: function() {
              wx.showToast({ title: '请用其他应用打开', icon: 'none' });
            }
          });
        },
        fail: function() {
          wx.showToast({ title: 'PDF下载失败', icon: 'none' });
        }
      });
    } else {
      wx.showToast({ title: result.error || '生成失败', icon: 'none' });
    }
  }).catch(function(err) {
    wx.hideLoading();
    console.error('[PDF] 合成失败:', err);
    wx.showToast({ title: '网络异常，请重试', icon: 'none' });
  });
}

module.exports = { generateSlotPDF };
