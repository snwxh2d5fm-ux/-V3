# 麒麟代码审查 — 0052305

**审查范围:** detail.js, detail.wxml, detail.wxss, combine.wxss  
**变更:** Canvas 2D图像脱敏(#6) + OCR信息CSS(#9)

## P0 (必须修复)

| # | 问题 | 位置 |
|---|------|------|
| 1 | Canvas 2D `getContext('2d')` 无空值检查，旧版微信崩溃 | detail.js:156 |
| 2 | `previewImage()` 始终展示原图，点击大图绕过脱敏 | detail.js:314 |
| 3 | 页面卸载无清理，Image对象内存泄漏+定时器泄漏 | detail.js:15,139,163 |

## P1 (高优先级)

| # | 问题 |
|---|------|
| 1 | Canvas像素缓冲区无尺寸限制，大图OOM(4000×3000=48MB) |
| 2 | PII遮罩区域硬编码仅适配中国身份证，护照/通行证漏遮 |
| 3 | canvasToTempFilePath未指定压缩参数(jpg/quality) |
| 4 | Canvas CSS固定尺寸与动态像素尺寸冲突 |

## P2 (改进建议)

防抖定时器存储位置不当、L2条纹对超大图性能抖动、加载时原图闪现、aria-label泄露、canvas.createImage()无跨域处理

## 结论

3个P0阻断。优先修复P0-2(previewImage绕过脱敏)后可通过审查。
