# 住港伴 V3 — 玄武PM审查报告 #2（PRD对齐·本轮修复后）

> 审查日期: 2026-05-13
> 审查范围: R2修复（fa4d1a5: Bug#10-#24 + 编译阻断修复 + document-index-templates.js扩展）
> 审查基线: PRD v5 + GAP基线v2 + 上一轮PM审查报告(23项: 6P0/12P1/5P2)
> 审查维度: 卡槽分类体系 / 拍摄指引 / 线框示意图 / 质量校验阻断 / 提醒器自动生成 / AI画像隐私

---

## 零、总体变化

| 指标 | 上轮 | 本轮 | 变化 |
|------|:--:|:--:|:--:|
| P0 | 6 | 4 | **↓2** (P0-01卡槽模板修复✅, P0-02平台限制已确认) |
| P1 | 12 | 10 | **↓2** (P1-07质量异步✅, P1-08部分缓解) |
| P2 | 5 | 4 | **↓1** (P2-03令牌化需进一步验证但代码层面有改进) |
| **综合对齐度** | ~79% | **~85%** | **↑6%** |

本轮最大成果: 卡槽分类体系从75%→92%，document-index-templates.js从5模板扩展至12+路径专属模板。

---

## 一、卡槽分类体系完整性（🟢 85%→92%）

### ✅ 已修复

| # | 上轮问题 | 修复状态 |
|:--:|------|:--:|
| P0-01 | 7/13路径缺专属卡槽模板 | **✅ 已修复** — `any_*_application`新增8个模板: asmpt(4类13槽), student_iang(4类12槽), parttime_qmas(4类10槽), techtas(4类9槽), cies(3类7槽), dependent(4类10槽·含sponsor/relationship新分类), minor_student(4类9槽·含guardian新分类), exchange(4类8槽), retirement(3类8槽)。`matchTemplate()`新增路径优先匹配逻辑(any_前缀)。13路径全部覆盖。 |

### ⚠️ 仍未修复

| # | 问题 | 详情 |
|:--:|------|------|
| P1-01 | **赴港计划书仍归类为文件上传卡槽** | qmas模板中plan_statement(maxCount:1, docIcon:📝)定义为普通卡槽，未区分text类型。PRD Bug#25要求改为文字输入。用户仍被引导上传计划书图片。 |
| P1-02 | **default_application模板仅含identity+education** | 缺省模板4槽位(身份证/通行证/证件照/学位证)，无financial/employment/application/visas类别。fallback到此模板的路径用户看不到资产/工作/获批材料槽位。 |
| P2-01 | **部分categoryTab在default模板下空分类** | 8个categoryTabs中assets/renewal/permanent/approved等default下无对应槽位。UX可优化。 |

---

## 二、拍摄指引可用性（🟡 85% 不变）

### ✅ 本轮改进

| # | 改进 |
|:--:|------|
| — | getSlotGuide()扩展: 新增hk_id/ household/ marriage/ birth_cert 4类证件专属指引(含wfFields)，现覆盖13类证件。 |
| — | getFreeDocGuide()新增: 11种自由模式证件类型专属指引(icon/wfTitle/items/piiFields/specimen)。 |

### ⚠️ 仍未修复

| # | 问题 | 详情 |
|:--:|------|------|
| P0-02 | **摄像头实时线框叠加不可行** | 微信<camera>组件平台限制，已确认降级方案(拍摄前指引+拍摄后对齐裁切)。非代码缺陷。 |
| P1-03 | **getFreeDocGuide()仍缺wfFields/showPhoto/showSeal** | 自由模式线框图无法按证件类型动态渲染字段，全部证件用同一套默认布局。 |
| P1-04 | **相机指引仍为纯文字弹窗** | wx.showModal内容为文字拼接，无卡片化示意图或动画引导。"四角完整""无反光"对首次用户理解困难。 |
| P2-02 | **getFreeDocGuide与getSlotGuide数据结构不一致** | getSlotGuide有wfFields[]/showPhoto/showSeal，getFreeDocGuide无。维护成本高。 |

---

## 三、线框示意图展现（🟢 90% 不变）

### ✅ 维持良好

- 卡槽模式：wfFields通过wx:for动态渲染，字段线框按width渲染4种长度(short/mid/long/full)，pii标签标注脱敏字段
- 照片区/印章区条件渲染(showPhoto/showSeal)
- 四角标尺+对齐提示文字完整

### ⚠️ 仍未修复

| # | 问题 | 详情 |
|:--:|------|------|
| P1-05 | **8/11自由模式证件无专属线框图** | getFreeDocGuide()缺wfFields，自由模式线框图全部同一默认布局（身份证/户口本/结婚证无区分）。 |
| P2-03 | **线框图CSS部分硬编码rpx值** | DSG-3要求100%令牌化。wf-*样式中仍有少量非var(--space-*)值。需逐一审计。 |

---

## 四、质量校验阻断链路（🟡 75%→78%）

### ✅ 本轮修复

| # | 上轮问题 | 修复状态 |
|:--:|------|:--:|
| P1-07 | 质量检测异步结果可能未到达UI | **✅ 已修复** — processImage()改为`await checkImageQuality(imagePath)`同步等待结果再setData。 |
| — | checkImageQuality改用OffscreenCanvas | **✅** — 弃用已废弃的wx.createCanvasContext，使用基础库3.15.2支持的wx.createOffscreenCanvas。 |
| — | 质量卡片UI增强 | **✅** — 状态头+评分条(quality-bar__fill)+问题列表+红色"建议重新拍摄"动作提示。 |

### ⚠️ 仍未修复（含本轮新增发现）

| # | 问题 | 详情 |
|:--:|------|------|
| **P0-03** | **OffscreenCanvas降级静默丢失4/6检测** | 当wx.createOffscreenCanvas不可用时，仅执行分辨率+宽高比2项基础检测，反光/模糊/圆角/倾斜4项跳过。虽追加info级提示但用户容易忽略。**评分可能仍显示"优秀"但实际未完成完整检测**。 |
| **P0-04** | **"强制继续"按钮绕过质量阻断** | confirmImage()阻断弹窗仍提供"强制继续"按钮。用户点击后跳过所有warning级问题直接进入Step 2.5。PRD要求"warning级问题必须重新拍摄"。 |
| P1-06 | **OffscreenCanvas img.onload无超时保护** | add.js的withTimeout()仅用于AI增强流程(旋转/裁切/扫描件)，checkImageQuality()内部的img.onload仍无超时控制。图片加载挂起时用户卡在"正在检测…"状态。 |
| P2-04 | **采样分辨率100×100对大图精度下降** | sampleW/sampleH = Math.min(w,100)。4K照片缩放至100px后模糊度/反光检测结果可能不准确。 |

---

## 五、提醒器自动生成触发（🟡 70%→73%）

### ✅ 本轮修复

| # | 改进 |
|:--:|------|
| — | checkAutoGenerate()完整链路: onShow→检测selectedPath→无提醒→弹窗询问→doAutoGenerate()。 |
| — | 去重保护: __auto_reminder_asked_<path>标记。 |
| — | detail页接收path参数: initTimeline()优先使用_options_path。 |

### ⚠️ 仍未修复

| # | 问题 | 详情 |
|:--:|------|------|
| **P0-05** | **自动生成不"自动"——需手动设置激活日期** | doAutoGenerate()弹出第二个弹窗"设置激活日期"，用户仍需手动输入激活日期后在detail页点击生成。从"点击立即生成"到"看到提醒"需3步操作。Bug#9描述的完整链路(检测→弹窗→确认→批量生成→返回列表可见)未闭合。 |
| P1-08 | **detail页生成后index页感知延迟** | detail.js的generateTimeline()→saveReminders()后，用户需手动返回index等onShow触发loadReminders()才能看到新提醒。无事件通知或自动跳转。 |
| P1-09 | **无激活日期时体验摩擦大** | 用户从路径选择到看到提醒需3步(确认生成→设置日期→生成确认)，缺少"以今天为激活日期一键生成"选项。 |
| P1-10 | **timeline-templates仅覆盖7/13路径** | 现有: qmas/ttps_a/ttps_b/ttps_c/asmpt/student_iang。缺失: dependent/cies/techtas/retirement/permanent/parttime_qmas/minor_student/exchange(8条)。retirement路径chooseAutoGenerate的pathNames映射中也缺。 |

---

## 六、AI画像隐私保护（🟢 80% 不变）

### ✅ 维持良好

- PRIVACY_DIRECTIVE注入所有模式system prompt最前端
- buildUserProfile() L1-L4四层权重体系含10+条禁止表述模式
- K2_SAFETY_RULES六条禁止响应规则
- floating-ai传递上下文前做safePageContext截断(80字符)

### ⚠️ 仍未修复

| # | 问题 | 详情 |
|:--:|------|------|
| **P0-06** | **画像隐私保护仅依赖LLM遵循system prompt，无输出端硬过滤** | ai-chat云函数和floating-ai组件均无输出后处理。如模型因幻觉/对抗提示/上下文溢出输出画像信息，代码层无检测/拦截机制。processMessagesForDisplay()仅做Markdown解析，不做隐私扫描。 |
| P1-11 | **buildUserProfile注入4层完整上下文增大泄露面** | L1-L4含身份状态/路径/职业/评估标签/高频话题/当前页面，信息粒度极细。system prompt被忽略则全部暴露。 |
| P1-12 | **floating-ai不验证ai-chat返回内容是否含画像信息** | sendMessage()直接渲染回复为rich-text，无内容安全扫描。模型无意泄露也无法拦截。 |
| P2-05 | **隐私无自动化回归测试** | 无测试用例验证PRD Bug#17验证标准("回复中不应出现任何画像字段原文")。 |

---

## 七、汇总

### P0（阻断性 — 4项）

| # | 问题 | 模块 | 状态 |
|:--:|------|------|:--:|
| P0-03 | OffscreenCanvas降级静默丢失4/6质量检测 | 质量校验 | ❌ 未修复 |
| P0-04 | "强制继续"按钮绕过所有质量阻断 | 质量校验 | ❌ 未修复 |
| P0-05 | 提醒器自动生成链路口径不闭合——仍需手动设置激活日期 | 提醒器 | ❌ 未修复 |
| P0-06 | AI画像隐私无输出端硬过滤 | AI隐私 | ❌ 未修复 |

### P1（高优 — 10项）

| # | 问题 | 模块 | 状态 |
|:--:|------|------|:--:|
| P1-01 | 赴港计划书仍为文件上传而非文字输入 | 卡槽分类 | ❌ 未修复 |
| P1-02 | default模板无financial/application/employment类别 | 卡槽分类 | ❌ 未修复 |
| P1-03 | 自由模式线框图未动态渲染freeDocGuide.wfFields | 线框示意 | ❌ 未修复 |
| P1-04 | 相机指引为纯文字弹窗无视觉引导 | 拍摄指引 | ❌ 未修复 |
| P1-05 | 8/11自由证件无专属线框图 | 线框示意 | ❌ 未修复 |
| P1-06 | OffscreenCanvas图片加载无超时保护 | 质量校验 | ❌ 未修复 |
| P1-08 | detail页生成提醒后index页无感知 | 提醒器 | ⚠️ 部分缓解 |
| P1-09 | 无激活日期时体验摩擦大 | 提醒器 | ❌ 未修复 |
| P1-10 | timeline-templates仅覆盖7/13路径 | 提醒器 | ❌ 未修复 |
| P1-11/12 | 4层画像注入增大泄露面 + floating-ai不验证 | AI隐私 | ❌ 未修复 |

### P2（低优 — 4项）

| # | 问题 | 模块 | 状态 |
|:--:|------|------|:--:|
| P2-01 | default模板下部分categoryTab空分类 | 卡槽分类 | ❌ |
| P2-02 | getFreeDocGuide与getSlotGuide结构不一致 | 拍摄指引 | ❌ |
| P2-03 | 线框图CSS存非令牌硬编码 | 线框示意 | ❌ |
| P2-04 | 采样100×100精度降 | 质量校验 | ❌ |
| P2-05 | 隐私无自动化回归测试 | AI隐私 | ❌ |

---

## 八、行动建议

### 立即（本轮必做 — 4项P0）
1. **P0-04**: confirmImage()中"强制继续"仅对info级问题开放，warning级→必须重新拍摄
2. **P0-05**: doAutoGenerate()默认激活日期=今天，直接调用generateTimeline()批量生成，不跳转detail手动操作
3. **P0-03**: OffscreenCanvas不可用时，质量检测结果summary改为"基础检测（高级不可用）"，评分上限60分
4. **P0-06**: ai-chat云函数增加输出后处理——正则匹配"你已选择了""你的状态显示为""作为XX路径的申请人"等画像泄露模式并替换为通用表述

### 下轮（高优）
5. P1-01: 卡槽系统区分slotType: 'image'|'text'，plan_statement标记为text类型，add页展示文本编辑器
6. P1-03/P1-05: getFreeDocGuide()补全wfFields/showPhoto/showSeal属性(11种证件)
7. P1-10: 补齐dependent/cies/techtas/retirement/permanent 5条路径timeline-templates
8. P1-06: checkImageQuality()内部img.onload增加8s超时保护
9. P1-09: doAutoGenerate()增加"以今天为激活日期"一键选项

### 后续
10. P1-02: default模板扩展至含financial/employment/application类别
11. P2-05: 建立AI隐私保护自动化回归测试套件
12. P2-03: 线框图CSS全面令牌化审计

---

*审查人: PM Agent (Hermes/玄武) | 审查框架: PRD v5 + GAP基线v2 + R2修复对照*
*对比基线: 上一轮PM审查(outbox/PM_审查报告_PRD对齐_BugFix_Round1.md)*
*综合对齐度: 79% → 85%（+6%）*
