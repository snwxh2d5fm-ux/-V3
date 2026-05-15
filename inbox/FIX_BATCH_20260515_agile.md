# 敏捷冲刺 Bug 批次 — 2026-05-15

## P0
### 1. 扫描增强永久转圈
- 文件: pages/documents/add/add.js + utils/image-process.js
- 根因: enhanceToScanned() 调用 ctx.draw(false, callback),Canvas未渲染时不回调→Promise永不resolve
- 修复: 加8秒超时兜底+Canvas存在检查

## P1
### 2. 关卡0任务重复(4→8)
- 文件: CloudBase life_guide_tasks 集合
- 根因: 数据重复
- 修复: 去重或前端filter

### 3. 添加证件遮挡流程
- 文件: pages/documents/add/
- 根因: 遮挡条件未限定脱敏场景
- 修复: 遮挡逻辑限定为脱敏时触发

### 4. 场景速查卡片无点击
- 文件: pages/guidebooks/index/index.wxml
- 根因: browse卡片缺少bindtap
- 修复: 添加onBrowseTaskTap→跳转详情

### 5. 攻略精选点击无反应
- 文件: pages/guidebooks/index/index.wxml + index.js
- 根因: articles数组为空或_id不匹配
- 修复: 确认数据加载+_id匹配

### 6. 提醒详情-规则引擎暴露内部代码
- 文件: pages/reminders/detail/
- 根因: 调试信息或内部逻辑渲染到UI
- 修复: 移除暴露的调试/内部代码

## 分配
Claude — 全部 JS/WXML/WXSS 修改
