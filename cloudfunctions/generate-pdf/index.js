/**
 * generate-pdf — 证件PDF合成云函数
 * 接收上传到云存储的证件图片，合成为带封面的PDF文档
 *
 * 输入: { action: 'create', fileIDs: [...], title, owner, docNumber, validFrom, validTo }
 * 输出: { code: 0, data: { pdfFileID: '...' } }
 *
 * P0-1 fix (麒麟审查): 原detail.js调用了不存在的generate-pdf云函数
 */
const cloud = require('wx-server-sdk');
const { PDFDocument, PageSizes } = require('pdf-lib');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const { action, fileIDs, title, owner, docNumber, validFrom, validTo } = event;

  if (action !== 'create') {
    return { code: 400, msg: '仅支持 create 操作' };
  }
  if (!fileIDs || !fileIDs.length) {
    return { code: 400, msg: '缺少图片文件' };
  }

  try {
    return await createPDF({ fileIDs, title, owner, docNumber, validFrom, validTo });
  } catch (err) {
    console.error('[generate-pdf]', err);
    return { code: 500, msg: 'PDF合成失败', error: err.message };
  }
};

async function createPDF(opts) {
  var { fileIDs, title, owner, docNumber, validFrom, validTo } = opts;

  var imageBuffers = [];
  for (var i = 0; i < fileIDs.length; i++) {
    var res = await cloud.downloadFile({ fileID: fileIDs[i] });
    imageBuffers.push(res.fileContent);
  }

  // 创建PDF文档
  var pdfDoc = await PDFDocument.create();
  var pageWidth = PageSizes.A4[0];
  var pageHeight = PageSizes.A4[1];
  var margin = 50;
  var contentWidth = pageWidth - 2 * margin;

  // ===== 封面页 =====
  var coverPage = pdfDoc.addPage([pageWidth, pageHeight]);
  var fontSize = 20;
  var y = pageHeight - 80;

  coverPage.drawText('住港伴 — 证件档案', { x: margin, y: y, size: 24 });
  y -= 40;
  coverPage.drawText('文件名称：' + (title || '证件'), { x: margin, y: y, size: fontSize });
  y -= 28;
  coverPage.drawText('所属人：' + (owner || '未指定'), { x: margin, y: y, size: fontSize });
  y -= 28;
  coverPage.drawText('证件号码：' + (docNumber || '—'), { x: margin, y: y, size: fontSize });
  y -= 28;
  coverPage.drawText('有效期始：' + (validFrom || '—'), { x: margin, y: y, size: fontSize });
  y -= 28;
  coverPage.drawText('有效期止：' + (validTo || '—'), { x: margin, y: y, size: fontSize });
  y -= 50;
  coverPage.drawText('生成时间：' + new Date().toISOString().slice(0, 10), { x: margin, y: y, size: 12 });
  y -= 20;
  coverPage.drawText('本文件由住港伴小程序自动生成，仅供参考。', { x: margin, y: y, size: 10 });
  coverPage.drawText('请以官方机构出具的文件为准。', { x: margin, y: y - 14, size: 10 });

  // ===== 图片页：每张图片一页 =====
  for (var i = 0; i < imageBuffers.length; i++) {
    var imgPage = pdfDoc.addPage([pageWidth, pageHeight]);

    var ext = '.jpg';
    try {
      var jpgImage = await pdfDoc.embedJpg(imageBuffers[i]);
      var dims = jpgImage.scaleToFit(contentWidth, pageHeight - 2 * margin);
      imgPage.drawImage(jpgImage, {
        x: margin + (contentWidth - dims.width) / 2,
        y: margin + (pageHeight - 2 * margin - dims.height) / 2,
        width: dims.width,
        height: dims.height
      });
    } catch (e) {
      // 尝试PNG
      try {
        var pngImage = await pdfDoc.embedPng(imageBuffers[i]);
        var dims = pngImage.scaleToFit(contentWidth, pageHeight - 2 * margin);
        imgPage.drawImage(pngImage, {
          x: margin + (contentWidth - dims.width) / 2,
          y: margin + (pageHeight - 2 * margin - dims.height) / 2,
          width: dims.width,
          height: dims.height
        });
      } catch (e2) {
        imgPage.drawText('(图片 ' + (i + 1) + ' 无法嵌入)', { x: margin, y: pageHeight / 2, size: 14 });
      }
    }

    imgPage.drawText((i + 1) + ' / ' + imageBuffers.length, {
      x: pageWidth - margin - 50, y: 20, size: 10
    });
  }

  var pdfBytes = await pdfDoc.save();
  var pdfBuffer = Buffer.from(pdfBytes);

  // 上传PDF到云存储
  var cloudPath = '_pdf_export/' + Date.now() + '_document.pdf';
  var uploadRes = await cloud.uploadFile({
    cloudPath: cloudPath,
    fileContent: pdfBuffer
  });

  return { code: 0, data: { pdfFileID: uploadRes.fileID } };
}
