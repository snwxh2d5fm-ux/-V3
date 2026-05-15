# P0 Bug: 扫描增强永久转圈（符生账号）

## 问题
符生账号添加证件 → 扫描增强 → 一直转圈，不结束也不报错。

## 根因
pages/documents/add/add.js: onToggleScanMode() 调用 imageProcess.enhanceToScanned()。
image-process.js: ctx.draw(false, callback) 在 scan-canvas 未渲染时不回调 → Promise永不resolve/reject → loading永久旋转。

## 修复方案
1. ctx.draw 前检查 canvas 是否存在
2. 加 8秒超时兜底（setTimeout reject）
3. 超时/失败降级返回原图

## 涉及文件
- utils/image-process.js (enhanceToScanned 加超时)
- pages/documents/add/add.js (可能的 canvas 渲染条件)

## 分配
Claude — JS 代码修复
