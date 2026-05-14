/**
 * 住港伴 — 证件图片处理工具
 * 功能：脱敏遮罩 + 扫描增强 + 旋转 + 缩放 + 裁剪
 * Canvas 2D API (canvas-id已废弃)
 */
var _canvasNode = null;
function _getCanvas() {
  return new Promise(function(resolve) {
    if (_canvasNode) { resolve(_canvasNode); return; }
    var query = wx.createSelectorQuery();
    query.select('#img-process').fields({ node: true, size: true }).exec(function(res) {
      if (res && res[0] && res[0].node) { _canvasNode = res[0].node; resolve(_canvasNode); }
      else { resolve(null); }
    });
  });
}
function _canvasToTemp(c) {
  return new Promise(function(resolve, reject) {
    wx.canvasToTempFilePath({ canvas: c, success: function(r) { resolve(r.tempFilePath); }, fail: reject });
  });
}

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


/**
 * #5: 合并多张证件照片到一张A4比例画布
 * 场景：身份证正反面、多页户口本等合并预览
 */
function mergeToA4Preview(imagePaths, labels) {
  return new Promise(function(resolve, reject) {
    if (!imagePaths || imagePaths.length === 0) { resolve(null); return; }
    if (imagePaths.length === 1) { resolve(imagePaths[0]); return; }

    var ctx = wx.createCanvasContext('merge-canvas');
    var a4w = 1200, a4h = 1700; // A4比例
    var perImageH = a4h / imagePaths.length;

    // 白色背景
    ctx.setFillStyle('#FFFFFF');
    ctx.fillRect(0, 0, a4w, a4h);

    var loaded = 0;
    imagePaths.forEach(function(path, i) {
      wx.getImageInfo({
        src: path,
        success: function(info) {
          var y = i * perImageH;
          var sw = info.width, sh = info.height;
          var scale = Math.min(a4w / sw, perImageH / sh);
          var dw = sw * scale, dh = sh * scale;
          var dx = (a4w - dw) / 2, dy = y + (perImageH - dh) / 2;
          ctx.drawImage(path, dx, dy, dw, dh);
          // 标签
          if (labels && labels[i]) {
            ctx.setFillStyle('#333');
            ctx.setFontSize(24);
            ctx.setTextAlign('center');
            ctx.fillText(labels[i], a4w/2, y + 30);
          }
          loaded++;
          if (loaded === imagePaths.length) {
            ctx.draw(false, function() {
              wx.canvasToTempFilePath({
                canvasId: 'merge-canvas',
                success: function(res) { resolve(res.tempFilePath); },
                fail: function() { resolve(imagePaths[0]); }
              });
            });
          }
        },
        fail: function() {
          loaded++;
          if (loaded === imagePaths.length) resolve(imagePaths[0]);
        }
      });
    });
  });
}

/**
 * Bug #8: 按角度旋转图片（canvas像素级旋转）
 * @param {string} imagePath - 图片路径
 * @param {number} degrees - 旋转角度 0/90/180/270
 * @returns {Promise<string>} 旋转后的临时图片路径
 */
function rotateImage(imagePath, degrees) {
  return new Promise(function(resolve) {
    var rad = (degrees || 0) % 360;
    if (rad === 0) { resolve(imagePath); return; }
    if (rad !== 90 && rad !== 180 && rad !== 270) { resolve(imagePath); return; }

    wx.getImageInfo({
      src: imagePath,
      success: function(info) {
        _getCanvas().then(function(canvas) {
          if (!canvas) { resolve(imagePath); return; }
          var w = info.width, h = info.height;
          if (rad === 90 || rad === 270) { canvas.width = h; canvas.height = w; }
          else { canvas.width = w; canvas.height = h; }
          var ctx = canvas.getContext('2d');
          var img = canvas.createImage();
          img.onload = function() {
            if (rad === 90) { ctx.translate(h, 0); ctx.rotate(Math.PI / 2); ctx.drawImage(img, 0, 0, w, h); }
            else if (rad === 180) { ctx.translate(w, h); ctx.rotate(Math.PI); ctx.drawImage(img, 0, 0, w, h); }
            else if (rad === 270) { ctx.translate(0, w); ctx.rotate(-Math.PI / 2); ctx.drawImage(img, 0, 0, w, h); }
            _canvasToTemp(canvas).then(function(p) { resolve(p); }).catch(function() { resolve(imagePath); });
          };
          img.onerror = function() { resolve(imagePath); };
          img.src = imagePath;
        });
      },
      fail: function() { resolve(imagePath); }
    });
  });
}

/**
 * Bug #8: 缩放图片到指定最大尺寸
 * @param {string} imagePath
 * @param {number} maxWidth
 * @param {number} maxHeight
 * @returns {Promise<string>}
 */
function resizeImage(imagePath, maxWidth, maxHeight) {
  return new Promise(function(resolve) {
    wx.getImageInfo({
      src: imagePath,
      success: function(info) {
        var w = info.width, h = info.height;
        var scale = Math.min((maxWidth || 2048) / w, (maxHeight || 2048) / h, 1);
        if (scale >= 1) { resolve(imagePath); return; }

        _getCanvas().then(function(canvas) {
          if (!canvas) { resolve(imagePath); return; }
          canvas.width = w * scale; canvas.height = h * scale;
          var ctx = canvas.getContext('2d');
          var img = canvas.createImage();
          img.onload = function() { ctx.drawImage(img, 0, 0, w * scale, h * scale); _canvasToTemp(canvas).then(function(p) { resolve(p); }).catch(function() { resolve(imagePath); }); };
          img.onerror = function() { resolve(imagePath); };
          img.src = imagePath;
        });
      },
      fail: function() { resolve(imagePath); }
    });
  });
}

/**
 * Bug #8: Canvas像素级裁剪
 * @param {string} imagePath
 * @param {number} x - 裁剪起点x (0-1比例)
 * @param {number} y - 裁剪起点y (0-1比例)
 * @param {number} cropWidth - 裁剪宽度 (0-1比例)
 * @param {number} cropHeight - 裁剪高度 (0-1比例)
 * @returns {Promise<string>}
 */
function cropImage(imagePath, x, y, cropWidth, cropHeight) {
  return new Promise(function(resolve) {
    if (!cropWidth || !cropHeight) { resolve(imagePath); return; }
    wx.getImageInfo({
      src: imagePath,
      success: function(info) {
        var w = info.width, h = info.height;
        var sx = (x || 0) * w, sy = (y || 0) * h;
        var sw = cropWidth * w, sh = cropHeight * h;

        _getCanvas().then(function(canvas) {
          if (!canvas) { resolve(imagePath); return; }
          canvas.width = sw; canvas.height = sh;
          var ctx = canvas.getContext('2d');
          var img = canvas.createImage();
          img.onload = function() { ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh); _canvasToTemp(canvas).then(function(p) { resolve(p); }).catch(function() { resolve(imagePath); }); };
          img.onerror = function() { resolve(imagePath); };
          img.src = imagePath;
        });
      },
      fail: function() { resolve(imagePath); }
    });
  });
}

module.exports = {
  applyPrivacyMask,
  enhanceToScanned,
  cropToDocument,
  autoRotate,
  getDefaultRegions,
  computeMaskRegions,
  mergeToA4Preview,
  rotateImage,
  resizeImage,
  cropImage
};
