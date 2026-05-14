# TASK — 真机测试 13 项功能性问题修复

> 来源: inbox/APPROVED_真机测试13项功能Bug.md | 琅琊批准 | 2026-05-13
> 执行: Claude (dev-agent) | 闸门: Hermes (verify.sh)

## 琅琊批示摘要

- 全部 13 项均需修复（6P0+6P1+1P2），不分批
- **#1 流程控长周期提醒 → 直接去掉**
- **#9 证件添加确认环节 → 去掉**
- **#11 线框 → 从脱敏数据库/真实案例找参照**

---

## 当前进度

| Bug | 优先级 | 状态 | 提交 |
|-----|:--:|:--:|------|
| #1 长周期提醒 | P1 | ✅ 已修复 | 71f16dc |
| #2 证件夹头部颜色 | P1 | 🔴 待修复 | — |
| #3 证件夹&材料颜色 | P1 | 🔴 待修复 | — |
| #4 提醒器时间线 | P0 | ✅ 已修复 | 71f16dc |
| #5 攻略UGC空白 | P0 | ✅ 已修复 | 71f16dc |
| #6 按钮文字破框 | P2 | ✅ 已修复 | 71f16dc |
| #7 配偶证件泄漏 | P0 | ✅ 已修复 | 71f16dc |
| #8 图片旋转缩放裁剪 | P1 | 🔴 待修复 | — |
| #9 证件添加确认环节 | P1 | ✅ 已修复 | 71f16dc |
| #10 材料清单同步 | P0 | 🔴 待修复 | — |
| #11 证件线框错误 | P0 | 🔴 待修复 | — |
| #12 脱敏未按证件类型 | P0 | 🔴 待修复 | — |
| #13 预检%空白 | P1 | ✅ 已修复 | be03b08 |

**合计: 7/13 已修复, 6/13 待修复**

---

## 修复方案 — 剩余6项

### 🔴 P0 — 3项

#### #10 智能材料清单路径数据未同步
- **文件**: `pages/documents/index/index.js:171-237`, `data/document-index-templates.js:525-547`
- **根因**: `loadSlotTemplate()` 仅从本地 `INDEX_TEMPLATES` 加载，不读取云端 `solution-engine` 的路径配置文件。用户切换路径后模板可能过期或不匹配
- **修复**:
  1. `loadSlotTemplate()` 增加云端同步步骤：调用 `solution-engine` 云函数获取当前路径的文档需求列表
  2. 将云端返回的 `requirements` 与本地 `INDEX_TEMPLATES` 合并，云端数据优先
  3. 本地模板缓存到 `wx.storage`（键: `__slot_template__`），24h 过期
  4. `onShow` 中检测路径变更（对比 `app.globalData.selectedPath`），触发模板重载

#### #11 各证件线框全部错误
- **文件**: `pages/documents/add/add.js:866-1496` (getSlotGuide/getFreeDocGuide), `add.wxml:33-84,119-165`
- **根因两处**:
  - **自由模式**: `add.wxml:132-146` 线框图硬编码3字段（姓名/证件号码/有效期限），完全忽略 `getFreeDocGuide()` 返回的 `piiFields`。无论选身份证还是护照/学位证，线框始终显示相同内容
  - **槽位模式**: `wfFields` 数组为手工编写，字段排列未对标真实证件布局
- **修复**:
  1. **自由模式重构** (核心): 在 `getFreeDocGuide()` 每个证件类型下补充 `wfFields` 数组（对标 `getSlotGuide()` 结构），`add.wxml` 自由模式线框图改为 `wx:for="{{freeDocGuide.wfFields}}"` 动态渲染，去掉硬编码3字段
  2. **wfFields 修正**: 逐项核对以下证件类型的 wfFields，参照脱敏数据库 `knowledge_chunks` 中 `doctype:specimen` 标记条目的字段布局：
     - `id_card`: 7字段(人像面) — 当前基本正确，微调字段顺序
     - `hk_permit`: 6字段 — 补充签注页二面字段
     - `passport`: 6字段 — 增加机读区标记
     - `hk_id`: 5字段 — 增加符号标记行
     - `degree`: 6字段 — 确认横版布局字段
     - `marriage`: 6字段 — 双页展开字段拆分
     - `birth_cert`: 6字段 — 竖版字段对齐
     - `bank_statement`: 6字段 — 银行流水特有字段
     - `work_proof`: 6字段 — 工作证明特有字段
  3. **CSS 标尺**: `.wf-ruler-*` 四角标尺改为百分比定位（相对于 `.doc-wireframe` 容器），避免不同屏幕尺寸下偏移
  4. 自由模式补充 `approval_notice`（获批通知）线框模板

#### #12 脱敏未按用户证件进行遮挡
- **文件**: `pages/documents/add/add.wxml:219-228` (隐私覆盖层), `pages/documents/add/add.wxss:427-438` (隐私条CSS), `utils/desensitize.js:145-186` (desensitizeFields)
- **根因**: 
  - **图像覆盖层**: 隐私条位置硬编码为标准中国身份证布局（top:12%/20%/28%/36%），护照/学位证/银行流水等其他证件类型字段位置完全不同
  - **字段脱敏**: `desensitizeFields()` 的 `fieldMap` 按字段名匹配（name→chineseName, idNumber→idCardNumber），不区分证件类型。护照的 name 和身份证的 name 被同等处理
- **修复**:
  1. **图像隐私覆盖层**: 
     - 定义 `DOC_PRIVACY_OVERLAY` 映射表，按证件类型配置隐私条位置(top/left/width/height百分比)和数量
     - 示例: passport={bars:[{top:'10%',left:'5%',width:'30%',height:'4%'},{top:'20%',...}]} 
     - 参照真实证件布局确定每种证件的 PII 字段位置
     - `privacy-overlay` 组件改为动态渲染 `wx:for`
  2. **字段脱敏**: 
     - `desensitizeFields()` 增加 `docType` 参数
     - 定义 `PII_FIELDS_BY_DOC_TYPE` 按证件类型映射:
       - `id_card`: name/idNumber/birthDate/address
       - `passport`: name/passportNumber/birthDate/nationality
       - `hk_permit`: name/permitNumber/birthDate
       - `hk_id`: name/hkIdNumber/birthDate
       - `degree`: name/certNumber
       - `marriage`: spouseName/certNumber
       - `bank_statement`: accountHolder/accountNumber
     - `parseOCRFields()` 传递当前 `docType` 给脱敏函数

---

### 🟡 P1 — 3项

#### #2 证件夹头部颜色不统一
- **文件**: `pages/documents/index/index.wxss:3-6`, `app.wxss:79-86`
- **根因**: documents/index 的 `.page-header` 无背景色，仅用 `var(--color-text-primary)` 纯色文字标题，与全局 `app.wxss` 定义的蓝色渐变头部标准不一致
- **修复**:
  1. `pages/documents/index/index.wxss` 的 `.page-header` 增加 `background: linear-gradient(135deg, var(--blue-dark), var(--blue))`
  2. `.page-header__title` 改为 `color: #FFF`（白字配蓝底）
  3. `.page-header__subtitle` 硬编码 `#6B7280` 改为 `rgba(255,255,255,0.75)`（白字半透明）
  4. 同步检查 `pages/documents/add/add.wxss` 头部是否一致

#### #3 证件夹 & 优才计划材料准备颜色不统一
- **文件**: `tokens.wxss`, `app.wxss`, `pages/documents/index/index.wxss`, `pages/documents/add/add.wxss`
- **根因**: `tokens.wxss` 和 `app.wxss` 对同名字段有不同值定义:
  - `tokens.wxss`: `--color-text-secondary: #5f6368`, `--gray-500: #6b7280`
  - `app.wxss`: `--color-text-secondary: var(--gray-500)` = `#5E6773`, `--gray-500: #5E6773`
  - 不同页面加载顺序导致同一语义变量解析为不同值
- **修复**:
  1. **统一变量源**: `tokens.wxss` 为唯一权威变量定义，删除 `app.wxss` 中对 `--gray-*` 的重定义
  2. `app.wxss` 仅保留语义别名（`--color-primary: var(--blue)` 等），不再覆盖灰度值
  3. 全部 pages/documents/ 子页面的 wxss 硬编码色值改为 `var()` 引用
  4. 确认 process/hero-card 渐变色和 documents/progress-card 配色无冲突

#### #8 证件图片缺少旋转/缩放/裁剪功能
- **文件**: `pages/documents/add/add.js:242-258, 619-625`, 需新建 `utils/image-process.js`
- **根因**: 
  - 旋转: `onRotateImage()` 仅操作 CSS `transform: rotate()`（视觉效果），保存时未应用旋转到图片文件
  - 缩放: 仅有 `onCropScale` 数据绑定，movable-view 缩放未实际改变图片文件尺寸
  - 裁剪: `confirmImage()` 直接进入下一步，未执行实际像素裁剪
- **修复**:
  1. **新建** `utils/image-process.js` 图片处理工具模块:
     - `rotateImage(filePath, degrees)` — canvas 绘制旋转后导出新图
     - `cropImage(filePath, x, y, width, height)` — canvas 裁剪并导出
     - `resizeImage(filePath, maxWidth, maxHeight)` — canvas 缩放并导出
  2. **旋转**: `onRotateImage()` 旋转角度(+90°)存入 `_rotateDeg`，`confirmImage()` 中调用 `imageProcess.rotateImage()` 写入文件后再推进步骤
  3. **缩放**: step 2 预览阶段 `movable-view` 手势计算 scale 存入 `_cropScale`，`confirmImage()` 中调用 `imageProcess.resizeImage()`
  4. **裁剪**: 移除 step 2.5 独立裁剪页，改为 step 2 预览区四角拖拽框 + 双指缩放，确认后调用 `imageProcess.cropImage()` 裁切
  5. 工具栏保留旋转、重置按钮，增加缩放百分比显示

---

## 已完成项回归验证

对 commit 71f16dc 和 be03b08 已修复的 7 项进行回归确认：

| Bug | 验证方法 | 预期结果 |
|-----|---------|---------|
| #1 | process 页面选择 QMAS 路径 → 检查是否无长周期提醒弹窗 | 无弹窗，仅展示周期文本 |
| #4 | reminders 页面选择 QMAS 路径 → 检查时间线节点 | 自动生成6节点时间线 |
| #5 | guidebooks 打开 UGC 攻略 → 检查内容渲染 | 标题+正文完整显示 |
| #6 | documents 页面卡槽按钮 → 检查文字+布局 | "+"居中对齐，无溢出 |
| #7 | documents 切换 spouse → 检查证件列表 | 仅见配偶证件，无本人数据泄漏 |
| #9 | documents add 拍照 → 检查流程步骤数 | 无独立确认步骤 |
| #13 | precheck → 查看报告百分比 | 显示具体%数值 |

---

## 影响范围

| 层级 | 文件数 | 文件 |
|:--:|:--:|------|
| pages/documents/add/ | 3 | add.js + add.wxml + add.wxss |
| pages/documents/index/ | 1 | index.wxss |
| utils/ | 2 | desensitize.js + image-process.js (新建) |
| data/ | 1 | document-index-templates.js |
| 全局样式 | 2 | tokens.wxss + app.wxss |
| **合计** | **9** | 跨 5 模块 |

## 执行顺序

```
Phase A (P0 功能阻断):  #10 → #11 → #12
Phase B (P1 体验):      #2 → #3 → #8
```

## 验证方式

1. `bash scripts/verify.sh` — 32 项全量检查
2. `bash scripts/workflow-verify.sh` — 36 项流程资产校验
3. L1 E2E: `npm run test:e2e` — 核心 5 模块 30/30
4. 真机回归重点: 
   - 自由模式选不同证件类型 → 线框图随类型变化
   - 配偶/子女切换 → 证件完全隔离 + 隐私遮罩按证件类型变化
   - 材料清单路径切换 → 模板同步更新
   - 图片旋转 → 保存后角度保持

---

> Hermes 闸门: verify.sh 通过 → workflow-verify.sh 通过 → 琅琊最终确认上线
