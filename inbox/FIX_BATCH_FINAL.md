# 敏捷冲刺 Bug 批次 — 2026-05-15

**铁律：读PROGRESS.md → 读文件 → 理解 → 修复 → verify.sh → 一个commit一条**

## P0
### 1. 扫描增强永久转圈
pages/documents/add/add.js + utils/image-process.js
Canvas不回调时 Promise 永不 resolve，loading 永久旋转。加超时兜底。

### 2. 优才路径时间线退回到旧版本
data/timeline-templates.js
准备材料 offsetDays=-90 应为0，以当天为锚点向未来排列。

### 3. 证件双面选择代码丢失
pages/documents/add/
身份证等国徽面/人像面切换逻辑被之前重写吞掉，需恢复。

### 4. 自动生成合并PDF功能丢失
pages/documents/ 或 cloudfunctions/
证件组合自动生成合并PDF的内容和逻辑被重写吞掉。

## P1
### 5. 关卡0任务重复(4→8)
CloudBase life_guide_tasks 集合数据重复，前端显示翻倍。

### 6. 添加证件预览遮挡
pages/documents/add/
遮挡仅在脱敏输出时显示，预览时不应遮挡。

### 7. 场景速查卡片无点击
pages/guidebooks/index/
browse 卡片缺 bindtap，点击无反应。需加点击跳转详情。

### 8. 攻略精选点击无反应
pages/guidebooks/index/
articles 数据加载或 _id 不匹配。

### 9. 提醒详情规则引擎暴露内部代码
pages/reminders/detail/
UI 渲染了 item.rule_id、item.reminders.length 等内部变量。

### 10. 提醒器完成无打勾
pages/reminders/detail/
markComplete() 后 UI 不更新完成状态。

### 11. 卡槽进入不应再选分类
pages/documents/add/
从证件夹卡槽进入时携带 docType，应跳过分类选择。

### 12. 优才路径工作经历/资产/申请材料不过滤配偶子女
data/onboarding-tasks.js 或 cloudfunctions/queryLifeGuideTasks/
这些阶段单人应可见，不依赖配偶子女条件。
