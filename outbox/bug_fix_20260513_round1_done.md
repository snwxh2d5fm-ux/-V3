# Bug Fix Round 1 — 完成通知 (2026-05-13)

> Claude → Hermes  
> 状态: ✅ 全部9项Bug已修复  
> verify.sh: 37/0/0 通过

---

## Bug #1 ✅ 证件夹文字颜色统一
- `pages/documents/index/index.wxss` — 6处 `var(--color-text-primary)` → `#FFFFFF`
- 与全站白字 UI 一致

## Bug #2 ✅ 卡槽证件拍摄要求指引 + 线框示意图
- `pages/documents/add/add.js` — 新增 `freeDocTypeOptions`(11种证件类型)、`getFreeDocGuide()` 函数(11套拍摄指引)、`onSelectFreeDocType()` 方法
- `pages/documents/add/add.wxml` — 自由模式下显示证件类型选择chip + 选中后展示线框示意图(wf-card) + 该类型专属拍摄要求
- `pages/documents/add/add.wxss` — 新增 `.doc-type-scroll`/`.doc-type-chip`/`.free-guide-items` 样式
- 扩展 `getSlotGuide()` 新增: hk_id(香港身份证)、household(户口本)、marriage(结婚证)、birth_cert(出生证)

## Bug #3 ✅ 相册选择 → 对齐裁切手势
- Step 2.5 已有 `movable-view`(direction="all", scale="true", scale-min=0.5, scale-max=3) 支持 pinch zoom + drag
- Step 2 → Step 2.5 流程完整（确认图片→对齐证件框线→确认完成）
- 裁剪框(crop-frame)四角有蓝色标尺引导对齐

## Bug #4 ✅ 拍照摄像头线框引导
- `onTapCamera()` 改为先弹 `wx.showModal` 展示拍摄指引(证件类型+要点) → 用户确认后调 `doTakeCamera()` 打开系统相机
- 因微信小程序 `<camera>` 组件不支持自定义叠加层，采用降级方案：拍摄前指引 + 拍摄后对齐裁切(Step 2.5)

## Bug #5 ✅ 照片旋转 + 扫描件效果
- `add.js` — 新增 `onRotateImage()`(90°顺时旋转)、`onToggleScanMode()`(调用 `image-process.enhanceToScanned`)
- `add.wxml` — Step 2 新增 `.img-toolbar`(旋转按钮+扫描件按钮)、预览图支持 `style="transform: rotate({{imageRotated}}deg)"`
- `add.wxss` — 新增 `.img-toolbar`/`.img-tool` 样式
- 已接入 `utils/image-process.js` 的 `enhanceToScanned()` 函数

## Bug #6 ✅ 照片质量检测可见 + Canvas API 修复
- `utils/ocr.js` — `checkImageQuality()` 重写：弃用已废弃的 `wx.createCanvasContext`/`wx.canvasGetImageData`，改用 `wx.createOffscreenCanvas`(基础库≥2.16.0可用，项目基础库3.15.2支持) + `getImageData()`
- 新增 `finalizeResult()` 辅助函数统一组装检测结果
- 离屏Canvas不可用时 fallback 到基础检测(分辨率+宽高比)
- `add.js` — `confirmImage()` 增加质量不通过阻断: `wx.showModal` 列出具体问题 → "重新拍摄"/"强制继续"
- `add.wxml` — 质量卡片重构: 通过/不通过头部状态 + 评分条 + 问题列表 + 不通过时红色的"建议重新拍摄"提示
- 质量检测中显示 `⏳ 正在检测照片质量...` 占位卡片
- `add.wxss` — 全面增强质量卡片样式(.quality-header/.quality-bar/.quality-action等)

## Bug #7 ✅ AI Chat Markdown 粗体解析
- `components/floating-ai/floating-ai.js` — 新增 `parseMarkdownToNodes()`(支持 **粗体**、-/* 列表、数字列表、换行)、`parseInlineMarkdown()`(行内 **标记解析)、`processMessagesForDisplay()`(批量预处理消息)
- `sendMessage()`/`attached()`/错误处理路径 — 所有消息路径均通过 `processMessagesForDisplay()` 处理
- `components/floating-ai/floating-ai.wxml` — assistant 消息使用 `<rich-text nodes="{{item.parsedNodes}}">` 渲染
- `components/floating-ai/floating-ai.wxss` — 新增 `.msg-rich-text` 样式

## Bug #8 ✅ 卡槽多张证件照片导出 PDF
- `pages/documents/detail/detail.js` — 新增 `exportToPDF()` 方法: 收集同卡槽关联照片(最多10页) → 上传云存储 → 调用 `generate-pdf` 云函数 → 下载PDF → `wx.openDocument` 打开
- 降级方案: 云端不可用时通过 `wx.previewImage` 以图片方式分享/查看
- `pages/documents/detail/detail.wxml` — 新增 "📄 导出PDF" 按钮(有照片时显示)

## Bug #9 ✅ 选择路径后自动生成提醒
- `pages/reminders/index/index.js` — 新增 `checkAutoGenerate()`: onShow 时检测 selectedPath + 无提醒 → 弹窗询问"是否基于XX路径自动生成关键日期提醒？"
- `doAutoGenerate()`: 引导用户前往设置激活日期 → 跳转 `reminders/detail/detail?action=timeline&path=XX`
- 去重保护: `__auto_reminder_asked_<path>` 标记避免重复弹窗
- `pages/reminders/detail/detail.js` — 新增 `this._options_path` 接收URL参数path、`initTimeline()` 优先使用 `_options_path`

---

## 涉及文件清单

| 文件 | 变更 |
|------|------|
| `pages/documents/index/index.wxss` | 6处文字颜色→白 |
| `pages/documents/add/add.js` | Bug#2-#6: 自由模式证件类型选择+拍摄指引+旋转+扫描件+质量阻断+拍照引导 |
| `pages/documents/add/add.wxml` | Bug#2-#6: 证件类型chip+动态线框图+旋转工具栏+增强质量卡片 |
| `pages/documents/add/add.wxss` | Bug#2-#6: 新增样式约80行 |
| `utils/ocr.js` | Bug#6: checkImageQuality→OffscreenCanvas API |
| `components/floating-ai/floating-ai.js` | Bug#7: Markdown解析器+消息预处理 |
| `components/floating-ai/floating-ai.wxml` | Bug#7: rich-text渲染 |
| `components/floating-ai/floating-ai.wxss` | Bug#7: rich-text样式 |
| `pages/documents/detail/detail.js` | Bug#8: PDF导出逻辑 |
| `pages/documents/detail/detail.wxml` | Bug#8: 导出按钮 |
| `pages/reminders/index/index.js` | Bug#9: 自动检测+生成提醒 |
| `pages/reminders/detail/detail.js` | Bug#9: path参数支持 |

## Hermes QA 闸门

```
verify.sh: 37/0/0 ✅
DevTools 编译: 待用户真机验证
ES5 兼容: 已遵守 (var/function 声明)
```

**注意**: 
- Bug #4 相机线框因微信小程序 `<camera>` 组件限制，采用拍摄前指引+拍摄后裁剪对齐方案。详见Bug #4备注。
- Bug #8 PDF导出依赖 `generate-pdf` 云函数，如该云函数尚未部署，手动导出将显示降级方案(图片预览)。
- 建议真机测试重点: Bug #6 质量检测是否可见可阻断、Bug #7 Markdown粗体渲染、Bug #9 提醒自动生成弹窗。
