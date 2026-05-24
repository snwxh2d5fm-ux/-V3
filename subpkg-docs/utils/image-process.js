/**
 * 住港伴 V4.2 — 证件图片处理工具
 * 功能：扫描增强 + 旋转 + 缩放 + 裁剪 + A4合并
 * Canvas 2D API with Old Canvas API 降级兼容
 *
 * 2026-05-24 架构变更：
 *   - applyPrivacyMask / computeMaskRegions / getDefaultRegions 已废弃
 *     原因：证件照仅读取本地设备路径，从不调用wx.uploadFile上传
 *     遮罩功能从产品需求中移除，调用不再产生任何效果
 *   - 保留的图像处理API：rotateImage / resizeImage / cropImage /
 *     autoRotate / enhanceToScanned / cropToDocument / mergeToA4Preview
 */
let _canvasNode = null;
function _getCanvas() {
  return new Promise(function (resolve) {
    if (_canvasNode) {
      resolve(_canvasNode);
      return;
    }
    const query = wx.createSelectorQuery();
    query
      .select('#img-process')
      .fields({ node: true, size: true })
      .exec(function (res) {
        if (res && res[0] && res[0].node) {
          _canvasNode = res[0].node;
          resolve(_canvasNode);
        } else {
          resolve(null);
        }
      });
  });
}
function _canvasToTemp(c) {
  return new Promise(function (resolve, reject) {
    wx.canvasToTempFilePath({
      canvas: c,
      success: function (r) {
        resolve(r.tempFilePath);
      },
      fail: reject,
    });
  });
}

// Bug #8: Old Canvas API 降级辅助 — Canvas 2D 失败时使用 wx.createCanvasContext
function _fallbackCanvasOp(imagePath, drawFn) {
  return new Promise(function (resolve) {
    wx.getImageInfo({
      src: imagePath,
      success: function (info) {
        const ctx = wx.createCanvasContext('img-fallback');
        drawFn(ctx, info);
        ctx.draw(false, function () {
          wx.canvasToTempFilePath({
            canvasId: 'img-fallback',
            success: function (r) {
              resolve(r.tempFilePath);
            },
            fail: function () {
              resolve(imagePath);
            },
          });
        });
      },
      fail: function () {
        resolve(imagePath);
      },
    });
  });
}

/**
 * @deprecated 2026-05-24 遮罩功能已从产品需求中移除
 * 证件照仅读取本地设备路径，从不调用wx.uploadFile上传，无需遮罩
 * 此函数保留仅为向后兼容，调用直接返回原图
 * @param {string} imagePath - 证件图片本地路径
 * @param {object} _piiRegions - 忽略
 * @param {number} _maskMode - 忽略
 * @returns {Promise<string>} 原始图片路径（未修改）
 */
function applyPrivacyMask(imagePath, _piiRegions, _maskMode = 0) {
  console.warn('[image-process] applyPrivacyMask 已废弃 (2026-05-24)，直接返回原图');
  return Promise.resolve(imagePath);
}

// === 以下为废弃函数的原始实现，保留用于历史追溯 ===
// eslint-disable-next-line no-unused-vars
function _applyPrivacyMask_legacy(imagePath, piiRegions, maskMode = 0) {
  return new Promise((resolve, reject) => {
    wx.getImageInfo({
      src: imagePath,
      success: function (info) {
        const ctx = wx.createCanvasContext('mask-canvas');
        const w = info.width;
        const h = info.height;

        // 绘制原图
        ctx.drawImage(imagePath, 0, 0, w, h);

        // 绘制遮罩区域
        const regions = getDefaultRegions(w, h, piiRegions);

        regions.forEach(function (r) {
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

        ctx.draw(false, function () {
          wx.canvasToTempFilePath({
            canvasId: 'mask-canvas',
            success: function (res) {
              resolve(res.tempFilePath);
            },
            fail: reject,
          });
        });
      },
      fail: reject,
    });
  });
}

/**
 * @deprecated 2026-05-24 遮罩功能已移除
 * 默认PII区域估算（OCR未返回坐标时使用）
 * 基于常见证件布局的比例估算
 */
function getDefaultRegions(imgW, imgH, piiRegions) {
  console.warn('[image-process] getDefaultRegions 已废弃 (2026-05-24)');
  return [];
  if (piiRegions && piiRegions.length > 0) {
    return piiRegions.map(function (r) {
      return {
        x: r.x || imgW * 0.1,
        y: r.y || imgH * 0.15,
        width: r.width || imgW * 0.5,
        height: r.height || imgH * 0.06,
        label: r.label || '已脱敏',
      };
    });
  }
  // 无精确坐标时使用经验估算位置
  return [
    { x: imgW * 0.08, y: imgH * 0.08, width: imgW * 0.35, height: imgH * 0.05, label: '姓名' },
    { x: imgW * 0.08, y: imgH * 0.16, width: imgW * 0.55, height: imgH * 0.04, label: '证件号' },
    { x: imgW * 0.08, y: imgH * 0.23, width: imgW * 0.3, height: imgH * 0.04, label: '出生日期' },
    { x: imgW * 0.08, y: imgH * 0.3, width: imgW * 0.7, height: imgH * 0.05, label: '地址' },
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
      success: function (info) {
        const ctx = wx.createCanvasContext('scan-canvas');
        const w = info.width;
        const h = info.height;

        // 绘制原图
        ctx.drawImage(imagePath, 0, 0, w, h);

        // 扫描件增强：先绘制原图→获取像素→提高对比度+锐化
        ctx.drawImage(imagePath, 0, 0, w, h);
        ctx.draw(true, function () {
          wx.canvasGetImageData({
            canvasId: 'scan-canvas',
            x: 0,
            y: 0,
            width: w,
            height: h,
            success: function (imgData) {
              const pixels = imgData.data; // RGBA array
              // 对比度增强：factor > 1 增加对比度
              const contrast = 1.15;
              const brightness = 5;
              for (let i = 0; i < pixels.length; i += 4) {
                pixels[i] = Math.min(255, Math.max(0, (pixels[i] - 128) * contrast + 128 + brightness));
                pixels[i + 1] = Math.min(255, Math.max(0, (pixels[i + 1] - 128) * contrast + 128 + brightness));
                pixels[i + 2] = Math.min(255, Math.max(0, (pixels[i + 2] - 128) * contrast + 128 + brightness));
              }
              // 回写像素→导出
              const ctx2 = wx.createCanvasContext('scan-canvas');
              ctx2.putImageData({ data: pixels, width: w, height: h }, 0, 0);
              ctx2.draw(false, function () {
                wx.canvasToTempFilePath({
                  canvasId: 'scan-canvas',
                  success: function (res) {
                    resolve(res.tempFilePath);
                  },
                  fail: function () {
                    resolve(imagePath);
                  },
                });
              });
            },
            fail: function () {
              resolve(imagePath);
            },
          });
        });
      },
      fail: function () {
        resolve(imagePath);
      },
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
      success: function (info) {
        const w = info.width;
        const h = info.height;

        // 基础裁剪：保留中心90%（模拟去边缘）
        const margin = 0.05;
        const ctx = wx.createCanvasContext('crop-canvas');
        ctx.drawImage(imagePath, w * margin, h * margin, w * (1 - 2 * margin), h * (1 - 2 * margin), 0, 0, w, h);
        ctx.draw(false, function () {
          wx.canvasToTempFilePath({
            canvasId: 'crop-canvas',
            success: function (res) {
              resolve(res.tempFilePath);
            },
            fail: function () {
              resolve(imagePath);
            },
          });
        });
      },
      fail: function () {
        resolve(imagePath);
      },
    });
  });
}

/**
 * 自动检测并旋转竖版证件（如香港身份证竖版）
 * 通过图片宽高比判断：竖版图片(width<height)且比例<0.7时旋转90°
 */
function autoRotate(imagePath) {
  return new Promise(function (resolve) {
    wx.getImageInfo({
      src: imagePath,
      success: function (info) {
        if (info.width < info.height && info.width / info.height < 0.7) {
          const ctx = wx.createCanvasContext('rotate-canvas');
          // 旋转90°: 交换宽高，translate+rotate
          ctx.translate(info.height, 0);
          ctx.rotate(Math.PI / 2);
          ctx.drawImage(imagePath, 0, 0, info.width, info.height);
          ctx.draw(false, function () {
            wx.canvasToTempFilePath({
              canvasId: 'rotate-canvas',
              success: function (res) {
                resolve(res.tempFilePath);
              },
              fail: function () {
                resolve(imagePath);
              },
            });
          });
        } else {
          resolve(imagePath);
        }
      },
      fail: function () {
        resolve(imagePath);
      },
    });
  });
}

/**
 * @deprecated 2026-05-24 遮罩功能已移除，调用始终返回空数组
 * R3: 按证件类型+脱敏等级计算遮罩区域
 * @param {string} docType - 忽略
 * @param {string} level - 忽略
 * @returns {Array} 始终返回空数组
 */
function computeMaskRegions(docType, level) {
  console.warn('[image-process] computeMaskRegions 已废弃 (2026-05-24)');
  return [];
  /* === 以下原始类型映射保留用于历史追溯 ===
  const types = {
    id_card: {
      low: [{ x: 0.15, y: 0.08, width: 0.22, height: 0.28, label: '照片' }],
      medium: [
        { x: 0.15, y: 0.08, width: 0.22, height: 0.28, label: '照片' },
        { x: 0.38, y: 0.18, width: 0.35, height: 0.05, label: '证件号' },
      ],
      high: [
        { x: 0.15, y: 0.08, width: 0.22, height: 0.28, label: '照片' },
        { x: 0.38, y: 0.18, width: 0.35, height: 0.05, label: '证件号' },
        { x: 0.08, y: 0.08, width: 0.18, height: 0.05, label: '姓名' },
        { x: 0.08, y: 0.32, width: 0.6, height: 0.05, label: '地址' },
      ],
    },
    hk_permit: {
      low: [{ x: 0.12, y: 0.06, width: 0.2, height: 0.26, label: '照片' }],
      medium: [
        { x: 0.12, y: 0.06, width: 0.2, height: 0.26, label: '照片' },
        { x: 0.1, y: 0.38, width: 0.5, height: 0.04, label: '证件号' },
      ],
      high: [
        { x: 0.12, y: 0.06, width: 0.2, height: 0.26, label: '照片' },
        { x: 0.1, y: 0.38, width: 0.5, height: 0.04, label: '证件号' },
        { x: 0.1, y: 0.12, width: 0.18, height: 0.04, label: '姓名' },
        { x: 0.1, y: 0.22, width: 0.22, height: 0.04, label: '出生' },
      ],
    },
    passport: {
      low: [{ x: 0.12, y: 0.08, width: 0.22, height: 0.26, label: '照片' }],
      medium: [
        { x: 0.12, y: 0.08, width: 0.22, height: 0.26, label: '照片' },
        { x: 0.4, y: 0.4, width: 0.35, height: 0.04, label: '护照号' },
      ],
      high: [
        { x: 0.12, y: 0.08, width: 0.22, height: 0.26, label: '照片' },
        { x: 0.4, y: 0.4, width: 0.35, height: 0.04, label: '护照号' },
        { x: 0.4, y: 0.1, width: 0.25, height: 0.04, label: '姓名' },
      ],
    },
    degree: {
      low: [],
      medium: [{ x: 0.3, y: 0.5, width: 0.4, height: 0.04, label: '证书编号' }],
      high: [
        { x: 0.08, y: 0.12, width: 0.25, height: 0.04, label: '姓名' },
        { x: 0.3, y: 0.5, width: 0.4, height: 0.04, label: '证书编号' },
        { x: 0.3, y: 0.55, width: 0.3, height: 0.04, label: '毕业日期' },
      ],
    },
    hk_id: {
      low: [{ x: 0.55, y: 0.15, width: 0.22, height: 0.28, label: '照片' }],
      medium: [
        { x: 0.55, y: 0.15, width: 0.22, height: 0.28, label: '照片' },
        { x: 0.08, y: 0.15, width: 0.35, height: 0.04, label: '身份证号' },
      ],
      high: [
        { x: 0.55, y: 0.15, width: 0.22, height: 0.28, label: '照片' },
        { x: 0.08, y: 0.15, width: 0.35, height: 0.04, label: '身份证号' },
        { x: 0.08, y: 0.08, width: 0.18, height: 0.04, label: '姓名' },
      ],
    },
  };
  return (types[docType] && types[docType][level]) || [];
  === 原始类型映射结束 === */
}

/**
 * #5: 合并多张证件照片到一张A4比例画布
 * 场景：身份证正反面、多页户口本等合并预览
 */
function mergeToA4Preview(imagePaths, labels) {
  return new Promise(function (resolve, reject) {
    if (!imagePaths || imagePaths.length === 0) {
      resolve(null);
      return;
    }
    if (imagePaths.length === 1) {
      resolve(imagePaths[0]);
      return;
    }

    const ctx = wx.createCanvasContext('merge-canvas');
    const a4w = 1200,
      a4h = 1700; // A4比例
    const perImageH = a4h / imagePaths.length;

    // 白色背景
    ctx.setFillStyle('#FFFFFF');
    ctx.fillRect(0, 0, a4w, a4h);

    let loaded = 0;
    imagePaths.forEach(function (path, i) {
      wx.getImageInfo({
        src: path,
        success: function (info) {
          const y = i * perImageH;
          const sw = info.width,
            sh = info.height;
          const scale = Math.min(a4w / sw, perImageH / sh);
          const dw = sw * scale,
            dh = sh * scale;
          const dx = (a4w - dw) / 2,
            dy = y + (perImageH - dh) / 2;
          ctx.drawImage(path, dx, dy, dw, dh);
          // 标签
          if (labels && labels[i]) {
            ctx.setFillStyle('#333');
            ctx.setFontSize(24);
            ctx.setTextAlign('center');
            ctx.fillText(labels[i], a4w / 2, y + 30);
          }
          loaded++;
          if (loaded === imagePaths.length) {
            ctx.draw(false, function () {
              wx.canvasToTempFilePath({
                canvasId: 'merge-canvas',
                success: function (res) {
                  resolve(res.tempFilePath);
                },
                fail: function () {
                  resolve(imagePaths[0]);
                },
              });
            });
          }
        },
        fail: function () {
          loaded++;
          if (loaded === imagePaths.length) resolve(imagePaths[0]);
        },
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
  return new Promise(function (resolve) {
    const rad = (degrees || 0) % 360;
    if (rad === 0) {
      resolve(imagePath);
      return;
    }
    if (rad !== 90 && rad !== 180 && rad !== 270) {
      resolve(imagePath);
      return;
    }

    wx.getImageInfo({
      src: imagePath,
      success: function (info) {
        _getCanvas().then(function (canvas) {
          if (!canvas) {
            // Bug #8: Canvas 2D 不可用 → 降级到 Old Canvas API
            console.warn('[Bug#8] rotateImage: Canvas 2D 失败，降级到 Old API');
            resolve(
              _fallbackCanvasOp(imagePath, function (ctx, inf) {
                const w = inf.width,
                  h = inf.height;
                if (rad === 90) {
                  ctx.translate(h, 0);
                  ctx.rotate(Math.PI / 2);
                  ctx.drawImage(imagePath, 0, 0, w, h);
                } else if (rad === 180) {
                  ctx.translate(w, h);
                  ctx.rotate(Math.PI);
                  ctx.drawImage(imagePath, 0, 0, w, h);
                } else if (rad === 270) {
                  ctx.translate(0, w);
                  ctx.rotate(-Math.PI / 2);
                  ctx.drawImage(imagePath, 0, 0, w, h);
                }
              }),
            );
            return;
          }
          const w = info.width,
            h = info.height;
          if (rad === 90 || rad === 270) {
            canvas.width = h;
            canvas.height = w;
          } else {
            canvas.width = w;
            canvas.height = h;
          }
          const ctx = canvas.getContext('2d');
          const img = canvas.createImage();
          img.onload = function () {
            if (rad === 90) {
              ctx.translate(h, 0);
              ctx.rotate(Math.PI / 2);
              ctx.drawImage(img, 0, 0, w, h);
            } else if (rad === 180) {
              ctx.translate(w, h);
              ctx.rotate(Math.PI);
              ctx.drawImage(img, 0, 0, w, h);
            } else if (rad === 270) {
              ctx.translate(0, w);
              ctx.rotate(-Math.PI / 2);
              ctx.drawImage(img, 0, 0, w, h);
            }
            _canvasToTemp(canvas)
              .then(function (p) {
                resolve(p);
              })
              .catch(function () {
                resolve(imagePath);
              });
          };
          img.onerror = function () {
            resolve(imagePath);
          };
          img.src = imagePath;
        });
      },
      fail: function () {
        resolve(imagePath);
      },
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
  return new Promise(function (resolve) {
    wx.getImageInfo({
      src: imagePath,
      success: function (info) {
        const w = info.width,
          h = info.height;
        const scale = Math.min((maxWidth || 2048) / w, (maxHeight || 2048) / h, 1);
        if (scale >= 1) {
          resolve(imagePath);
          return;
        }

        _getCanvas().then(function (canvas) {
          if (!canvas) {
            // Bug #8: Canvas 2D 不可用 → 降级到 Old Canvas API
            console.warn('[Bug#8] resizeImage: Canvas 2D 失败，降级到 Old API');
            const nw = Math.round(w * scale),
              nh = Math.round(h * scale);
            resolve(
              _fallbackCanvasOp(imagePath, function (ctx) {
                ctx.drawImage(imagePath, 0, 0, nw, nh);
              }),
            );
            return;
          }
          canvas.width = w * scale;
          canvas.height = h * scale;
          const ctx = canvas.getContext('2d');
          const img = canvas.createImage();
          img.onload = function () {
            ctx.drawImage(img, 0, 0, w * scale, h * scale);
            _canvasToTemp(canvas)
              .then(function (p) {
                resolve(p);
              })
              .catch(function () {
                resolve(imagePath);
              });
          };
          img.onerror = function () {
            resolve(imagePath);
          };
          img.src = imagePath;
        });
      },
      fail: function () {
        resolve(imagePath);
      },
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
  return new Promise(function (resolve) {
    if (!cropWidth || !cropHeight) {
      resolve(imagePath);
      return;
    }
    wx.getImageInfo({
      src: imagePath,
      success: function (info) {
        const w = info.width,
          h = info.height;
        const sx = (x || 0) * w,
          sy = (y || 0) * h;
        const sw = cropWidth * w,
          sh = cropHeight * h;

        _getCanvas().then(function (canvas) {
          if (!canvas) {
            // Bug #8: Canvas 2D 不可用 → 降级到 Old Canvas API
            console.warn('[Bug#8] cropImage: Canvas 2D 失败，降级到 Old API');
            resolve(
              _fallbackCanvasOp(imagePath, function (ctx) {
                ctx.drawImage(imagePath, sx, sy, sw, sh, 0, 0, sw, sh);
              }),
            );
            return;
          }
          canvas.width = sw;
          canvas.height = sh;
          const ctx = canvas.getContext('2d');
          const img = canvas.createImage();
          img.onload = function () {
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
            _canvasToTemp(canvas)
              .then(function (p) {
                resolve(p);
              })
              .catch(function () {
                resolve(imagePath);
              });
          };
          img.onerror = function () {
            resolve(imagePath);
          };
          img.src = imagePath;
        });
      },
      fail: function () {
        resolve(imagePath);
      },
    });
  });
}

module.exports = {
  // === 已废弃 (2026-05-24) - 保留导出仅为向后兼容 ===
  applyPrivacyMask,       // @deprecated 直接返回原图
  getDefaultRegions,      // @deprecated 直接返回空数组
  computeMaskRegions,     // @deprecated 直接返回空数组
  // === 活跃 API ===
  enhanceToScanned,
  cropToDocument,
  autoRotate,
  mergeToA4Preview,
  rotateImage,
  resizeImage,
  cropImage,
};
