const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * 卡槽PDF合成云函数
 *
 * 输入: { action: 'create'|'append', fileIDs: string[], title?: string, pdfFileID?: string }
 *   create: 用 fileIDs 合成新PDF
 *   append: 在已有 pdfFileID 基础上追加 fileIDs（暂以重合成实现）
 * 输出: { code: 0, data: { pdfFileID, pageCount } }
 */

exports.main = async (event) => {
  const { action, fileIDs, title, pdfFileID } = event;

  if (!fileIDs || !fileIDs.length) {
    return { code: 400, error: '缺少 fileIDs' };
  }

  try {
    // 收集所有需要合成的图片 fileID
    let allFileIDs = [];

    if (action === 'append' && pdfFileID) {
      // 追加模式：旧PDF的图片 + 新图片（简化：全部重合成）
      // 实际场景中，storage 存了所有 fileIDs，前端传入全部即可
      allFileIDs = fileIDs;
    } else {
      allFileIDs = fileIDs;
    }

    if (allFileIDs.length === 0) {
      return { code: 400, error: '无有效图片' };
    }

    // 限制最多20页，避免超时
    const maxPages = Math.min(allFileIDs.length, 20);
    const pageFileIDs = allFileIDs.slice(0, maxPages);

    // 下载所有图片并转为 base64
    const images = [];
    for (const fid of pageFileIDs) {
      try {
        const res = await cloud.downloadFile({ fileID: fid });
        const buffer = res.fileContent;
        const base64 = buffer.toString('base64');
        images.push('data:image/jpeg;base64,' + base64);
      } catch (e) {
        console.warn('下载失败:', fid, e.message);
      }
    }

    if (images.length === 0) {
      return { code: 400, error: '所有图片下载失败' };
    }

    // 动态加载 jspdf（避免首次加载超时）
    const { jsPDF } = require('jspdf');

    // 创建PDF，A4纵向
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const imgW = pageW - margin * 2;
    const imgH = pageH - margin * 2 - 15; // 底部留标题空间

    for (let i = 0; i < images.length; i++) {
      if (i > 0) pdf.addPage();

      try {
        pdf.addImage(images[i], 'JPEG', margin, margin, imgW, imgH, undefined, 'FAST');
        // 页码
        pdf.setFontSize(9);
        pdf.setTextColor(128, 128, 128);
        const label = (title || '证件') + ' — ' + (i + 1) + '/' + images.length;
        pdf.text(label, pageW / 2, pageH - 8, { align: 'center' });
      } catch (e) {
        pdf.setFontSize(12);
        pdf.setTextColor(200, 0, 0);
        pdf.text('图片加载失败', pageW / 2, pageH / 2, { align: 'center' });
      }
    }

    // 生成PDF buffer
    const pdfBuffer = Buffer.from(pdf.output('arraybuffer'));

    // 上传到云存储
    const pdfName = 'pdf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6) + '.pdf';
    const uploadRes = await cloud.uploadFile({
      cloudPath: '_pdf_output/' + pdfName,
      fileContent: pdfBuffer,
    });

    return {
      code: 0,
      data: {
        pdfFileID: uploadRes.fileID,
        pageCount: images.length,
        cloudPath: '_pdf_output/' + pdfName,
      },
    };
  } catch (e) {
    console.error('generate-pdf error:', e);
    return { code: 500, error: e.message };
  }
};
