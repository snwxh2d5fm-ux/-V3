Component({
  properties: {
    contentType: {
      type: String,
      value: 'guide_collection',
    },
    contentTitle: {
      type: String,
      value: '',
    },
    contentDigest: {
      type: String,
      value: '',
    },
  },

  data: {
    imagePath: '',
    generating: false,
  },

  methods: {
    onGenerateTap: function () {
      const self = this;
      if (self.data.generating) {
        return;
      }
      self.setData({ generating: true }, function () {
        self.generateCard();
      });
    },

    generateCard: function () {
      const self = this;
      const title = self.properties.contentTitle || '';
      const digest = self.properties.contentDigest || '';

      if (!title && !digest) {
        self.setData({ generating: false });
        self.triggerEvent('error', { error: new Error('内容为空，无法生成卡片') });
        return;
      }

      const sysInfo = wx.getSystemInfoSync();
      const scale = sysInfo.windowWidth / 750;
      const canvasWidth = 750 * scale;
      const canvasHeight = 1000 * scale;

      const ctx = wx.createCanvasContext('shareCardCanvas', self);

      /* 背景填充 */
      ctx.setFillStyle('#FFFFFF');
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      /* 顶部渐变 — #1E3A5F at 5% opacity */
      const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight * 0.35);
      gradient.addColorStop(0, 'rgba(30, 58, 95, 0.05)');
      gradient.addColorStop(1, 'rgba(30, 58, 95, 0)');
      ctx.setFillStyle(gradient);
      ctx.fillRect(0, 0, canvasWidth, canvasHeight * 0.35);

      const marginLeft = 40 * scale;
      const marginRight = 40 * scale;
      const contentWidth = canvasWidth - marginLeft - marginRight;
      let currentY = 60 * scale;

      /* 🛡️ 住港伴 — 左上角 */
      ctx.setFontSize(28 * scale);
      ctx.setFillStyle('#5F6368');
      ctx.setTextAlign('left');
      ctx.fillText('\u{1F6E1}️ 住港伴', marginLeft, currentY);

      /* 分隔线 */
      currentY += 40 * scale;
      ctx.setStrokeStyle('#E5E7EB');
      ctx.setLineWidth(1);
      ctx.beginPath();
      ctx.moveTo(marginLeft, currentY);
      ctx.lineTo(canvasWidth - marginLeft, currentY);
      ctx.stroke();

      currentY += 60 * scale;

      /* contentTitle — 居中，粗体，最多2行 */
      if (title) {
        ctx.setFontSize(36 * scale);
        ctx.setFillStyle('#111827');
        ctx.setTextAlign('left');
        const titleResult = self._wrapText(ctx, title, marginLeft, currentY, contentWidth, 36 * scale, 2);
        currentY = titleResult.y + 40 * scale;
      }

      /* contentDigest — 最多6行 */
      if (digest) {
        ctx.setFontSize(28 * scale);
        ctx.setFillStyle('#374151');
        ctx.setTextAlign('left');
        const digestResult = self._wrapText(ctx, digest, marginLeft, currentY, contentWidth, 28 * scale, 6);
        currentY = digestResult.y + 20 * scale;
      }

      /* 底部装饰线 */
      const lineY = canvasHeight - 120 * scale;
      ctx.setStrokeStyle('#E5E7EB');
      ctx.setLineWidth(1);
      ctx.beginPath();
      ctx.moveTo(marginLeft, lineY);
      ctx.lineTo(canvasWidth - marginLeft, lineY);
      ctx.stroke();

      /* 扫码查看完整内容 — 底部居中 */
      ctx.setFontSize(24 * scale);
      ctx.setFillStyle('#757F8C');
      ctx.setTextAlign('center');
      ctx.fillText('扫码查看完整内容', canvasWidth / 2, canvasHeight - 60 * scale);

      ctx.draw(false, function () {
        wx.canvasToTempFilePath(
          {
            canvasId: 'shareCardCanvas',
            fileType: 'png',
            quality: 1,
            success: function (res) {
              self.setData({
                imagePath: res.tempFilePath,
                generating: false,
              });
              self.triggerEvent('ready', { imagePath: res.tempFilePath });
            },
            fail: function (err) {
              self.setData({ generating: false });
              self.triggerEvent('error', { error: err });
            },
          },
          self,
        );
      });
    },

    _wrapText: function (ctx, text, x, y, maxWidth, fontSize, maxLines) {
      if (!text) {
        return { y: y, truncated: false };
      }

      const chars = text.split('');
      let line = '';
      let lineCount = 0;
      let currentY = y;

      for (let i = 0; i < chars.length; i++) {
        const testLine = line + chars[i];
        let testWidth = 0;
        try {
          if (ctx.measureText) {
            testWidth = ctx.measureText(testLine).width;
          } else {
            testWidth = testLine.length * fontSize;
          }
        } catch (e) {
          testWidth = testLine.length * fontSize;
        }

        if (testWidth > maxWidth && line.length > 0) {
          ctx.fillText(line, x, currentY);
          lineCount++;
          if (lineCount >= maxLines) {
            /* 超出最大行数，截断并加省略号 */
            let truncated = '';
            let ellipsisWidth = 0;
            try {
              if (ctx.measureText) {
                ellipsisWidth = ctx.measureText('...').width;
              } else {
                ellipsisWidth = 3 * fontSize;
              }
            } catch (e) {
              ellipsisWidth = 3 * fontSize;
            }
            for (let j = 0; j < chars.length; j++) {
              const t = truncated + chars[j];
              let tw = 0;
              try {
                if (ctx.measureText) {
                  tw = ctx.measureText(t + '...').width;
                } else {
                  tw = (t.length + 3) * fontSize;
                }
              } catch (e) {
                tw = (t.length + 3) * fontSize;
              }
              if (tw > maxWidth) {
                break;
              }
              truncated = t;
            }
            ctx.fillText(truncated + '...', x, currentY);
            currentY += fontSize * 1.6;
            return { y: currentY, truncated: true };
          }
          line = chars[i];
          currentY += fontSize * 1.6;
        } else {
          line = testLine;
        }
      }

      /* 最后一行 */
      if (line.length > 0 && lineCount < maxLines) {
        ctx.fillText(line, x, currentY);
        lineCount++;
        currentY += fontSize * 1.6;
      }

      return { y: currentY, truncated: lineCount >= maxLines };
    },

    saveToAlbum: function () {
      const self = this;
      const imagePath = self.data.imagePath;

      if (!imagePath) {
        wx.showToast({
          title: '请先生成卡片',
          icon: 'none',
        });
        return;
      }

      wx.getSetting({
        success: function (res) {
          if (res.authSetting['scope.writePhotosAlbum'] === false) {
            /* 已拒绝授权，引导用户去设置 */
            wx.showModal({
              title: '需要相册权限',
              content: '请在设置中开启相册权限，以便保存分享卡片',
              success: function (modalRes) {
                if (modalRes.confirm) {
                  wx.openSetting({
                    success: function () {
                      self._doSaveToAlbum(imagePath);
                    },
                  });
                }
              },
            });
          } else {
            wx.authorize({
              scope: 'scope.writePhotosAlbum',
              success: function () {
                self._doSaveToAlbum(imagePath);
              },
              fail: function () {
                wx.showModal({
                  title: '需要相册权限',
                  content: '请在设置中开启相册权限，以便保存分享卡片',
                  success: function (modalRes) {
                    if (modalRes.confirm) {
                      wx.openSetting();
                    }
                  },
                });
              },
            });
          }
        },
        fail: function () {
          self._doSaveToAlbum(imagePath);
        },
      });
    },

    _doSaveToAlbum: function (imagePath) {
      const self = this;
      wx.saveImageToPhotosAlbum({
        filePath: imagePath,
        success: function () {
          wx.showToast({
            title: '已保存到相册',
            icon: 'success',
          });
          self.triggerEvent('saved');
        },
        fail: function (err) {
          wx.showToast({
            title: '保存失败',
            icon: 'none',
          });
          self.triggerEvent('error', { error: err });
        },
      });
    },
  },
});
