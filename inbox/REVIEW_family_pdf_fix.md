# REVIEW: 家庭空间邀请页 + PDF 按钮无反应

**日期**: 2026-05-20
**优先级**: P1

---

## 问题 1: 家庭空间邀请页 — 补接收方输入 + 一键微信分享

**现状**: 家庭空间邀请页不存在，用户无法邀请家属
**期望**:

1. 接收方信息输入入口（姓名/关系）
2. 一键微信分享按钮（`wx.shareAppMessage` 或 `button open-type="share"`），分享邀请卡片给家属微信
3. 家属点击卡片 → 跳转加入页面
4. 页面路径注册到 app.json

**涉及文件**: 新页面（如 subpkg-family/pages/invite/）+ app.json 注册

## 问题 2: 证件夹 PDF 按钮无反应

**现状**: `pages/documents/index/index.wxml:123-125` 有 📄 PDF 按钮，`generateSlotPDF` 调用 `utils/pdf-generator.js:generateSlotPDF`，但点击无反应
**期望**: 点击后生成该卡槽的 PDF 文档并预览/下载
**排查**: `utils/pdf-generator.js` 的 `generateSlotPDF` 函数逻辑

**涉及文件**: `utils/pdf-generator.js` + `pages/documents/index/index.js:746-750`

---

## 铁律

仅修改上述文件，不动其他代码。
