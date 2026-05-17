/**
 * 住港伴 — PDF 导出云函数 (generate-pdf)
 *
 * 将证件图片合成为单份 PDF 文档。
 * 前端调用: wx.cloud.callFunction({ name: 'generate-pdf', data: { action, fileIDs, title, ... } })
 *
 * 输入: { action: 'create', fileIDs: string[], title, owner, docNumber, validFrom, validTo }
 * 输出: { code: 0, data: { pdfFileID }, msg }
 *
 * 工作流:
 *   1. 从云存储下载所有图片
 *   2. 用 pdf-lib 合成 PDF（每图一页，自动适配 JPG/PNG）
 *   3. 上传 PDF 到云存储
 *   4. 返回 fileID 给前端打开
 */

const cloud = require('wx-server-sdk');
const { PDFDocument, PageSizes } = require('pdf-lib');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const A4 = PageSizes.A4; // [595.28, 841.89] pt

exports.main = async (event, context) => {
  const { action } = event || {};

  if (action !== 'create') {
    return { code: -1, msg: '不支持的操作，仅支持 action=create' };
  }

  const { fileIDs = [], title, owner, docNumber, validFrom, validTo } = event;

  if (!fileIDs || fileIDs.length === 0) {
    return { code: -1, msg: '缺少图片 fileIDs' };
  }

  console.log(`[generate-pdf] 开始合成, ${fileIDs.length} 张图片, title=${title}`);

  try {
    // ── Step 1: 下载所有图片 ──
    const downloads = fileIDs.map(async (fileID, idx) => {
      console.log(`[generate-pdf] 下载图片 ${idx + 1}/${fileIDs.length}: ${fileID}`);
      const res = await cloud.downloadFile({ fileID });
      if (!res || !res.fileContent) {
        throw new Error(`下载图片失败: ${fileID}`);
      }
      return { buffer: Buffer.from(res.fileContent), fileID };
    });

    const images = await Promise.all(downloads);
    console.log(`[generate-pdf] 下载完成, ${images.length} 张`);

    // ── Step 2: 合成 PDF ──
    const pdfDoc = await PDFDocument.create();

    let pageCount = 0;
    for (const img of images) {
      let embedded;

      // 尝试 JPG 嵌入
      try {
        embedded = await pdfDoc.embedJpg(img.buffer);
      } catch (_) {
        /* 不是 JPG，尝试 PNG */
      }

      // 尝试 PNG 嵌入
      if (!embedded) {
        try {
          embedded = await pdfDoc.embedPng(img.buffer);
        } catch (_) {
          console.warn(`[generate-pdf] 跳过不支持的图片格式: ${img.fileID}`);
          continue;
        }
      }

      if (!embedded) continue;

      // 缩放到 A4 宽度内
      const maxWidth = A4[0] - 40;  // 留 20pt 边距
      const maxHeight = A4[1] - 40;
      const scale = Math.min(maxWidth / embedded.width, maxHeight / embedded.height, 1);
      const w = embedded.width * scale;
      const h = embedded.height * scale;
      const x = (A4[0] - w) / 2;
      const y = (A4[1] - h) / 2;

      const page = pdfDoc.addPage(A4);
      page.drawImage(embedded, { x, y, width: w, height: h });
      pageCount++;
    }

    if (pageCount === 0) {
      return { code: -1, msg: '无可用的图片格式（仅支持 JPG/PNG）' };
    }

    const pdfBytes = await pdfDoc.save();
    console.log(`[generate-pdf] PDF 合成完成, ${pageCount} 页, ${(pdfBytes.length / 1024).toFixed(1)} KB`);

    // ── Step 3: 上传 PDF 到云存储 ──
    const safeTitle = (title || '证件').replace(/[\/\\:*?"<>|]/g, '_');
    const cloudPath = `pdf_exports/${Date.now()}_${safeTitle}.pdf`;

    const uploadRes = await cloud.uploadFile({
      cloudPath,
      fileContent: Buffer.from(pdfBytes)
    });

    console.log(`[generate-pdf] PDF 上传成功: ${uploadRes.fileID}`);

    return {
      code: 0,
      data: {
        pdfFileID: uploadRes.fileID
      },
      msg: 'ok'
    };

  } catch (err) {
    console.error('[generate-pdf] 失败:', err.message || err);
    return {
      code: -1,
      msg: err.message || 'PDF 生成失败',
      data: null
    };
  }
};
