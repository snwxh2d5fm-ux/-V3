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
- 修复: 遮挡逻辑限定为脱敏输出时触发。添加证件预览不遮挡

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

## P0 (追加)
### 7. 优才路径时间线回归旧版本
- 文件: data/timeline-templates.js
- 问题: 准备材料 offsetDays=-90，以当天为锚点应显示为正向阶段
- 根因: v3.2版本的时间线切割引擎更新后模板退回到旧版本
- 修复: 优才路径节点以当天为起点重新计算偏移，准备材料→递交→获批→激活等按实际阶段排列
- 参考: reminder-engine 云函数的 advanedStage/verifyMilestone 逻辑

### 8. 提醒器完成无打勾
- 文件: pages/reminders/detail/detail.js
- 问题: markComplete() 调 loadReminderDetail 但 UI 不更新打勾
- 根因: updateReminder 未 await，loadReminderDetail 读回旧状态
- 修复: 确保本地写入完成后再刷新 UI

### 9. 优才路径—工作经历/资产/申请材料不应过滤配偶子女
- 文件: data/onboarding-tasks.js / cloudfunctions/queryLifeGuideTasks
- 问题: 工作经历、资产证明、申请材料阶段不应依赖配偶子女条件
- 修复: applicable_to 过滤条件调整，单人也应可见这些阶段

### 10. 卡槽进入添加证件不应再选分类
- 文件: pages/documents/add/add.js
- 问题: 从证件夹卡槽点进去，仍弹出分类选择
- 修复: 卡槽携带 docType 参数进入时，跳过分类选择步骤

## P0 (追加)
### 11. 证件拍摄—国徽面/人像面选择代码丢失
- 文件: pages/documents/add/add.js
- 问题: 身份证等双面证件拍摄时，国徽面和人脸面选择逻辑消失
- 根因: 之前Claude重写该文件时吞掉了侧面切换代码
- 修复: 恢复双面证件的前后面选择UI和逻辑
