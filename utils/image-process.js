/**
 * 住港伴 — 证件图片处理工具
 * 功能：脱敏遮罩 + 扫描形态增强
 */

/**
 * 生成脱敏遮罩预览
 * 在证件图片上绘制敏感信息遮罩矩形
 * @param {string} imagePath - 证件图片本地路径
 * @param {object} piiRegions - PII区域 {name/yMin等} (OCR坐标未识别时用估算位置)
 * @param {number} maskMode - 0=模糊 1=色块遮盖 2=文字提示
 * @returns {Promise<string>} 处理后的图片临时路径
 */
function applyPrivacyMask(imagePath, piiRegions, maskMode = 0) {
  return new Promise((resolve, reject) => {
    wx.getImageInfo({
      src: imagePath,
      success: function(info) {
        var ctx = wx.createCanvasContext('mask-canvas');
        var w = info.width;
        var h = info.height;

        // 绘制原图
        ctx.drawImage(imagePath, 0, 0, w, h);

        // 绘制遮罩区域
        var regions = getDefaultRegions(w, h, piiRegions);

        regions.forEach(function(r) {
          if (maskMode === 0) {
            // 模糊模拟：半透明色块覆盖
            ctx.setFillStyle('rgba(0,0,0,0.65)');
            ctx.fillRect(r.x, r.y, r.width, r.height);
            ctx.setFillStyle('#FFFFFF');
            ctx.setFontSize(Math.min(r.height * 0.35, 28));
            ctx.setTextAlign('center');
            ctx.fillText(r.label || '***', r.x + r.width / 2, r.y + r.height * 0.65);
          } else if (maskMode === 1) {
            // 纯色块遮盖
            ctx.setFillStyle('#333333');
            ctx.fillRect(r.x, r.y, r.width, r.height);
          } else {
            // 文字提示
            ctx.setFillStyle('rgba(0,0,0,0.5)');
            ctx.fillRect(r.x, r.y, r.width, r.height);
            ctx.setFillStyle('#FFD700');
            ctx.setFontSize(Math.min(r.height * 0.3, 22));
            ctx.setTextAlign('center');
            ctx.fillText(r.label || '已脱敏', r.x + r.width / 2, r.y + r.height * 0.6);
          }
        });

        ctx.draw(false, function() {
          wx.canvasToTempFilePath({
            canvasId: 'mask-canvas',
            success: function(res) { resolve(res.tempFilePath); },
            fail: reject
          });
        });
      },
      fail: reject
    });
  });
}

/**
 * 默认PII区域估算（OCR未返回坐标时使用）
 * 基于常见证件布局的比例估算
 */
function getDefaultRegions(imgW, imgH, piiRegions) {
  if (piiRegions && piiRegions.length > 0) {
    return piiRegions.map(function(r) {
      return {
        x: r.x || imgW * 0.1,
        y: r.y || imgH * 0.15,
        width: r.width || imgW * 0.5,
        height: r.height || imgH * 0.06,
        label: r.label || '已脱敏'
      };
    });
  }
  // 无精确坐标时使用经验估算位置
  return [
    { x: imgW * 0.08, y: imgH * 0.08, width: imgW * 0.35, height: imgH * 0.05, label: '姓名' },
    { x: imgW * 0.08, y: imgH * 0.16, width: imgW * 0.55, height: imgH * 0.04, label: '证件号' },
    { x: imgW * 0.08, y: imgH * 0.23, width: imgW * 0.30, height: imgH * 0.04, label: '出生日期' },
    { x: imgW * 0.08, y: imgH * 0.30, width: imgW * 0.70, height: imgH * 0.05, label: '地址' }
  ];
}

/**
 * 证件扫描形态增强
 * 提升对比度+锐化，模拟扫描件效果
 * @param {string} imagePath - 证件图片路径
 * @returns {Promise<string>} 增强后的图片路径
 */
function enhanceToScanned(imagePath) {
  return new Promise((resolve, reject) => {
    wx.getImageInfo({
      src: imagePath,
      success: function(info) {
        var ctx = wx.createCanvasContext('scan-canvas');
        var w = info.width;
        var h = info.height;

        // 绘制原图
        ctx.drawImage(imagePath, 0, 0, w, h);

        // 模拟扫描增强：半透明白色底+对比度提升
        // 因为canvas不直接支持CSS滤镜，用叠加层模拟
        ctx.setFillStyle('rgba(255,255,255,0.08)');
        ctx.fillRect(0, 0, w, h);

        ctx.draw(false, function() {
          wx.canvasToTempFilePath({
            canvasId: 'scan-canvas',
            success: function(res) {
              // 如果支持，用图片编辑API进一步增强
              tryEnhancedResult(res.tempFilePath, resolve, reject);
            },
            fail: function() {
              resolve(imagePath); // 降级返回原图
            }
          });
        });
      },
      fail: function() { resolve(imagePath); }
    });
  });
}

function tryEnhancedResult(tempPath, resolve, reject) {
  // 尝试使用 wx.compressImage 的 quality=100 参数来提升质量
  try {
    resolve(tempPath);
  } catch (e) {
    resolve(tempPath);
  }
}

/**
 * 证件裁剪/去背景
 * 检测证件边缘并裁剪到证件区域
 * @param {string} imagePath
 * @returns {Promise<string>}
 */
function cropToDocument(imagePath) {
  return new Promise((resolve) => {
    wx.getImageInfo({
      src: imagePath,
      success: function(info) {
        var w = info.width;
        var h = info.height;

        // 基础裁剪：保留中心90%（模拟去边缘）
        var margin = 0.05;
        var ctx = wx.createCanvasContext('crop-canvas');
        ctx.drawImage(
          imagePath,
          w * margin, h * margin,
          w * (1 - 2 * margin), h * (1 - 2 * margin),
          0, 0, w, h
        );
        ctx.draw(false, function() {
          wx.canvasToTempFilePath({
            canvasId: 'crop-canvas',
            success: function(res) { resolve(res.tempFilePath); },
            fail: function() { resolve(imagePath); }
          });
        });
      },
      fail: function() { resolve(imagePath); }
    });
  });
}


/**
 * 自动检测并旋转竖版证件（如香港身份证竖版）
 * 通过图片宽高比判断：竖版图片(width<height)且比例<0.7时旋转90°
 */
function autoRotate(imagePath) {
  return new Promise(function(resolve) {
    wx.getImageInfo({
      src: imagePath,
      success: function(info) {
        if (info.width < info.height && (info.width / info.height) < 0.7) {
          var ctx = wx.createCanvasContext('rotate-canvas');
          // 旋转90°: 交换宽高，translate+rotate
          ctx.translate(info.height, 0);
          ctx.rotate(Math.PI / 2);
          ctx.drawImage(imagePath, 0, 0, info.width, info.height);
          ctx.draw(false, function() {
            wx.canvasToTempFilePath({
              canvasId: 'rotate-canvas',
              success: function(res) { resolve(res.tempFilePath); },
              fail: function() { resolve(imagePath); }
            });
          });
        } else {
          resolve(imagePath);
        }
      },
      fail: function() { resolve(imagePath); }
    });
  });
}

/**
 * R3: 按证件类型+脱敏等级计算遮罩区域
 * @param {string} docType - id_card|hk_permit|passport|degree|hk_id
 * @param {string} level - low|medium|high
 * @returns {Array} 遮罩区域 [{x, y, width, height, label}]
 */
function computeMaskRegions(docType, level) {
  var types = {
    id_card: {
      low:    [{ x: 0.15, y: 0.08, width: 0.22, height: 0.28, label: '照片' }],
      medium: [{ x: 0.15, y: 0.08, width: 0.22, height: 0.28, label: '照片' },
               { x: 0.38, y: 0.18, width: 0.35, height: 0.05, label: '证件号' }],
      high:   [{ x: 0.15, y: 0.08, width: 0.22, height: 0.28, label: '照片' },
               { x: 0.38, y: 0.18, width: 0.35, height: 0.05, label: '证件号' },
               { x: 0.08, y: 0.08, width: 0.18, height: 0.05, label: '姓名' },
               { x: 0.08, y: 0.32, width: 0.60, height: 0.05, label: '地址' }]
    },
    hk_permit: {
      low:    [{ x: 0.12, y: 0.06, width: 0.20, height: 0.26, label: '照片' }],
      medium: [{ x: 0.12, y: 0.06, width: 0.20, height: 0.26, label: '照片' },
               { x: 0.10, y: 0.38, width: 0.50, height: 0.04, label: '证件号' }],
      high:   [{ x: 0.12, y: 0.06, width: 0.20, height: 0.26, label: '照片' },
               { x: 0.10, y: 0.38, width: 0.50, height: 0.04, label: '证件号' },
               { x: 0.10, y: 0.12, width: 0.18, height: 0.04, label: '姓名' },
               { x: 0.10, y: 0.22, width: 0.22, height: 0.04, label: '出生' }]
    },
    passport: {
      low:    [{ x: 0.12, y: 0.08, width: 0.22, height: 0.26, label: '照片' }],
      medium: [{ x: 0.12, y: 0.08, width: 0.22, height: 0.26, label: '照片' },
               { x: 0.40, y: 0.40, width: 0.35, height: 0.04, label: '护照号' }],
      high:   [{ x: 0.12, y: 0.08, width: 0.22, height: 0.26, label: '照片' },
               { x: 0.40, y: 0.40, width: 0.35, height: 0.04, label: '护照号' },
               { x: 0.40, y: 0.10, width: 0.25, height: 0.04, label: '姓名' }]
    },
    degree: {
      low:    [],
      medium: [{ x: 0.30, y: 0.50, width: 0.40, height: 0.04, label: '证书编号' }],
      high:   [{ x: 0.08, y: 0.12, width: 0.25, height: 0.04, label: '姓名' },
               { x: 0.30, y: 0.50, width: 0.40, height: 0.04, label: '证书编号' },
               { x: 0.30, y: 0.55, width: 0.30, height: 0.04, label: '毕业日期' }]
    },
    hk_id: {
      low:    [{ x: 0.55, y: 0.15, width: 0.22, height: 0.28, label: '照片' }],
      medium: [{ x: 0.55, y: 0.15, width: 0.22, height: 0.28, label: '照片' },
               { x: 0.08, y: 0.15, width: 0.35, height: 0.04, label: '身份证号' }],
      high:   [{ x: 0.55, y: 0.15, width: 0.22, height: 0.28, label: '照片' },
               { x: 0.08, y: 0.15, width: 0.35, height: 0.04, label: '身份证号' },
               { x: 0.08, y: 0.08, width: 0.18, height: 0.04, label: '姓名' }]
    }
  };
  return (types[docType] && types[docType][level]) || [];
}

module.exports = {
  applyPrivacyMask,
  enhanceToScanned,
  cropToDocument,
  autoRotate,
  getDefaultRegions,
  computeMaskRegions
};
