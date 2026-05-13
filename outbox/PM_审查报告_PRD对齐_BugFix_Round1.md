# 住港伴 V3 — PM视角 PRD对齐审查报告

> 审查日期: 2026-05-13
> 审查范围: Claude Bug Fix Round 1（#1-#9 + 编译阻断修复）涉及的全部31个修改文件
> 审查基线: PRD v5.0（原生小程序版）+ GAP基线报告v2
> 审查维度: 卡槽分类体系 / 拍摄指引 / 线框示意图 / 质量校验阻断 / 提醒器自动生成 / AI画像隐私

---

## 一、总体评估

| 维度 | PRD对齐度 | 本轮修复评价 |
|------|:--:|------|
| 卡槽分类体系完整性 | 🟡 75% | 5路径有专属模板，7路径fallback到通用模板 |
| 拍摄指引实际可用性 | 🟢 85% | 11种证件有专属指引，相机叠加受小程序限制降级 |
| 线框示意图展现 | 🟢 90% | 卡槽模式完全动态渲染，自由模式部分静态 |
| 质量校验阻断链路 | 🟡 75% | 6项检测可运行，阻断存在但OffscreenCanvas退化+强制继续漏洞 |
| 提醒器自动生成触发 | 🟡 70% | 检测/弹窗链路完整，但生成不自动+刷新断层 |
| AI画像隐私保护 | 🟢 80% | 系统提示词层面保护完善，缺少输出端硬过滤 |

**综合PRD对齐度: ~79%**（对比GAP基线v2的98%，本轮Bug修复大部分对齐良好）

---

## 二、分项审查

### 2.1 卡槽分类体系完整性

**PRD要求**: PRD v5 §3.2 — 证件夹按路径专属模板展示卡槽，支持7大类+所属人切换

**代码现状**:
- `data/document-index-templates.js`: 定义了5个路径专属模板 + 1个默认兜底模板
  - 已覆盖: qmas（5大类18槽位）, ttps_a（3大类5槽位）, ttps_b（3大类3槽位）, ttps_c（继承ttps_b结构）, default
  - 未覆盖专属模板的路径(7条): asmpt, student_iang, dependent, techtas, cies, retirement, permanent → 全部fallback到default（仅2大类4槽位）
- `computeSlotStates()` 实现了四层匹配（slotKey精确 → docType → 分类+名称模糊 → 分类宽松兜底），匹配逻辑健壮
- 所属人过滤(ownerType: self/spouse/child) 在 `refreshIdentitySlots()` 中每次切换重新计算
- `slotToCategory()` 映射表覆盖17种槽位→7大类

#### P0

| # | 问题 | 详情 | 影响 |
|:--:|------|------|------|
| P0-01 | **7/13路径缺专属卡槽模板** | asmpt/student_iang/dependent/techtas/cies/retirement/permanent全部fallback到`default_application`（仅身份证+通行证+证件照+学位证4槽位），无法体现路径特异性（如专才需工作证明、IANG需学生签注、受养人需关系证明） | 选择以上路径的用户证卡槽系统严重不完整，PRD要求的"路径感知智能材料清单"（Bug #23）无法生效 |

#### P1

| # | 问题 | 详情 | 影响 |
|:--:|------|------|------|
| P1-01 | **赴港计划书仍归类为文件上传** | `slotToCategory('plan_statement' → 'approved')`，但PRD Bug #25明确要求改为文字输入。同时`document-index-templates.js`中`plan_statement`被定义为卡槽（maxCount:1），未区分text类型 | 用户被引导上传计划书图片，而非PRD期望的文字撰写 |
| P1-02 | **default_application模板无financial/application/employment/visas类别** | 缺省模板仅含identity(4槽位)+education(1槽位)，对于任何fallback到此模板的路径，资产证明/工作证明/获批材料全部无法展示于槽位系统 | 用户只能通过"溢出区"查看这些材料，无法享受槽位引导 |

#### P2

| # | 问题 | 详情 |
|:--:|------|------|
| P2-01 | 8个categoryTabs中有部分（如assets/renewal/permanent）在default模板下无对应槽位，出现空分类 | UX可优化 |

---

### 2.2 拍摄指引是否实际可用

**PRD要求**: PRD v5 §3.2 — OCR识别前展示拍摄要求, §3.2 Bug #2 — 每种证件类型显示专属拍摄要求

**代码现状**:
- `getSlotGuide()`: 11种证件类型有完整指引（id_card/hk_permit/passport/hk_id/household/marriage/birth_cert/degree/work/bank/approval），每类含 icon/title/items(5条要求)/piiFields/specimen/wfFields
- `getFreeDocGuide()`: 11种自由模式指引，内容较简略（3-4条要求），缺少wfFields动态字段
- 卡槽模式进入：直接展示slot-guide-card（指引卡片+线框图+脱敏标注+标本参照）
- 自由模式进入：需先选择证件类型chip，选中后展示指引+线框图
- 拍照前：`onTapCamera()` 先弹wx.showModal展示文字指引，用户确认后才调相机
- 通用要求（未选类型时）：7条通用拍摄要求

#### P0

| # | 问题 | 详情 | 影响 |
|:--:|------|------|------|
| P0-02 | **摄像头实时线框叠加不可行** | 微信小程序`<camera>`组件不支持自定义叠加层，Bug #4明确标注降级为"拍照前文字指引+拍照后对齐裁切" | PRD要求的"拍照界面叠加半透明线框指引层"无法实现，已按开发注意事项降级方案处理。**非代码缺陷，属平台限制** |

#### P1

| # | 问题 | 详情 | 影响 |
|:--:|------|------|------|
| P1-03 | **自由模式线框图未使用freeDocGuide.wfFields动态渲染** | add.wxml Line 119-164: 自由模式的线框图使用硬编码的3个默认字段（姓名/证件号码/有效期限），而非从`freeDocGuide.wfFields`动态渲染。`getFreeDocGuide()`也未定义wfFields属性 | 自由模式下所有证件类型看到的是同一套通用线框图，无法区分身份证(7字段)、护照(6字段)、户口本(7字段)的字段差异 |
| P1-04 | **相机指引为纯文字弹窗非视觉引导** | `onTapCamera()`弹窗内容是文字拼接("请确保证件四角完整、无反光...")，未展示卡片化的拍照示意图或动画指引 | 首次使用用户可能无法理解"四角完整""无反光"具体含义 |

#### P2

| # | 问题 | 详情 |
|:--:|------|------|
| P2-02 | getFreeDocGuide缺少wfFields属性，与getSlotGuide的数据结构不一致 | future维护成本 |

---

### 2.3 线框示意图展现

**PRD要求**: PRD v5 §3.2 — R4 CSS线框示意图展示（Bug #2/#24）

**代码现状**:
- `doc-wireframe` 区块含：wf-card容器 + wf-header(logo线+标题) + wf-body(wf-photo照片框 + wf-fields字段线框) + wf-footer(印章区) + 四角标尺(wf-ruler-tl/tr/bl/br) + 对齐提示文字
- 卡槽模式：`wf-fields` 通过 `wx:for="{{slotGuide.wfFields}}"` 动态渲染，每个字段有 width(short/mid/long/full) + pii标签
- 字段线框根据 `item.width` 渲染为不同长度的CSS线条（`.wf-line--short/.wf-line--mid/.wf-line--long/.wf-line--full`）
- 照片区/印章区根据 `slotGuide.showPhoto/showSeal` 条件渲染
- 自由模式线框图：硬编码3个字段，always显示照片框和印章区

#### P0

无

#### P1

| # | 问题 | 详情 | 影响 |
|:--:|------|------|------|
| P1-05 | **8/11种自由模式证件无专属线框图** | `getFreeDocGuide()`缺少wfFields/showPhoto/showSeal属性，导致自由模式线框图全部显示同一套默认布局 | 用户从自由入口添加户口本、结婚证等看到的线框图与实际证件布局不匹配 |

#### P2

| # | 问题 | 详情 |
|:--:|------|------|
| P2-03 | 线框图CSS使用固定rpx值而非var(--space-*)令牌 | DSG-3规范要求100%令牌化，当前wf-*样式有少量硬编码值 |

---

### 2.4 质量校验阻断链路

**PRD要求**: Bug #6 — 照片质量检测必须可见、不通过时阻断下一步

**代码现状**:
- `utils/ocr.js` → `checkImageQuality()`: 6项检测（分辨率/宽高比/反光/模糊度/圆角完整性/倾斜度），使用OffscreenCanvas API（基础库≥2.16.0）
- OffscreenCanvas不可用时fallback到基础检测（仅分辨率+宽高比）
- `add.js` → `confirmImage()`: 检测不通过时弹wx.showModal阻断，列出warning级问题，选项："重新拍摄" / "强制继续"
- `add.wxml`: 质量卡片完整渲染——通过/不通过状态头 + 评分条(quality-bar__fill宽度=score%) + 问题列表 + "建议重新拍摄"红色动作提示
- 加载中状态："⏳ 正在检测照片质量..."占位卡片

#### P0

| # | 问题 | 详情 | 影响 |
|:--:|------|------|------|
| P0-03 | **OffscreenCanvas降级导致4/6项检测静默丢失** | 当`wx.createOffscreenCanvas`不可用时，仅执行分辨率+宽高比2项基础检测，反光/模糊/圆角/倾斜4项直接跳过。用户看到的结果可能标注"通过"但实际未完成完整检测。仅在issues中追加一条info级提示，容易忽略 | 低端设备或特定微信版本上，质量检测形同虚设 |
| P0-04 | **"强制继续"绕过所有质量阻断** | `confirmImage()`阻断弹窗提供"强制继续"按钮，用户点击后直接进入对齐裁切步骤，跳过全部质量问题的硬阻断。相当于阻断链路存在但可被用户直接绕过 | 阻断设计的有效性取决于用户自觉，不符合PRD"强制重新拍摄"的预期 |

#### P1

| # | 问题 | 详情 | 影响 |
|:--:|------|------|------|
| P1-06 | **OffscreenCanvas图片加载异步无超时保护** | `img.onload`回调中执行像素采样，但无超时控制。如果图片加载挂起/极慢，用户会一直卡在"正在检测照片质量..."状态 | 用户体验卡死，无降级方案 |
| P1-07 | **质量检测在`processImage()`中自动执行但结果不保证到达UI** | `checkImageQuality()`是异步Promise，但`processImage()`没有await（仅`.then(() => setData)`）。如果图片很大或Canvas处理慢，用户可能在检测完成前就进入了Step 2界面 | 极端情况下用户看到的质量卡片可能是过时的或空白的 |

#### P2

| # | 问题 | 详情 |
|:--:|------|------|
| P2-04 | 采样分辨率固定100×100，大幅图片（如4K照片）检测精度下降 | 缩放后模糊/反光检测结果可能不准确 |

---

### 2.5 提醒器自动生成触发逻辑

**PRD要求**: Bug #9 — 选择路径后提醒器自动生成路径专属提醒日期

**代码现状**:
- `reminders/index/index.js` → `checkAutoGenerate()`: onShow时检测 selectedPath + 无提醒 + 未询问过 → 弹窗"是否基于XX路径自动生成关键日期提醒？"
- `doAutoGenerate()`: 引导用户前往设置激活日期 → 跳转 `reminders/detail/detail?action=timeline&path=XX`
- 去重保护: `__auto_reminder_asked_<path>` localStorage标记
- `reminders/detail/detail.js`: `initTimeline()`接收URL参数path，使用`TIMELINE_TEMPLATES[path]`
- `data/timeline-templates.js`: 覆盖7条路径(qmas/ttps_a/ttps_b/ttps_c/student_iang/dependent/asmpt/permanent)

#### P0

| # | 问题 | 详情 | 影响 |
|:--:|------|------|------|
| P0-05 | **自动生成不"自动"——需手动设置激活日期** | `doAutoGenerate()`仅跳转到timeline详情页，生成提醒本身需要用户在详情页手动输入激活日期后点击生成。从用户视角看：点击"立即生成"→进入新页面→还需手动操作→返回后才能看到提醒 | 用户体验断裂，弹窗文案说"自动生成"但实际流程为半自动。Bug #9描述的完整链路（检测→弹窗→确认→批量生成→返回列表可见）未完全闭环 |

#### P1

| # | 问题 | 详情 | 影响 |
|:--:|------|------|------|
| P1-08 | **detail页生成了提醒但index页不知道** | detail/detail.js的`generateTimeline()`调用`saveReminders()`后，index页的`checkAutoGenerate()`不会重新触发（因为`allReminders.length > 0`）。用户需手动从detail返回index等待onShow触发loadReminders()刷新 | 生成后需用户手动返回才能看到新提醒 |
| P1-09 | **无激活日期时的体验不完整** | 如果用户尚未设置激活日期，`doAutoGenerate()`只是提示"请先设置"并跳转，但没有提供快速设置当天为激活日期的选项 | 用户路径选择到看见提醒需3步操作（确认生成→设置日期→生成确认），摩擦较大 |
| P1-10 | **timeline-templates未覆盖全部13路径** | 当前仅7条路径有模板，techtas/cies/retirement/minor_student等6条路径缺失。其中retirement是PRD v5正式纳入的路径 | 选择缺失路径的用户看到"无可用模板" |

---

### 2.6 AI画像隐私保护

**PRD要求**: Bug #17 — AI对话不得透露用户画像；"他是谁"三维叠加判定；PRD v5 §2.3 — K2安全防线

**代码现状**:
- `cloudfunctions/ai-chat/prompts.js`:
  - `PRIVACY_DIRECTIVE`: 注入所有模式system prompt最前端
  - `buildUserProfile()`: L1-L4四层权重体系，含隐私保护规则（明确列出10+种禁止表述模式）
  - L1三维叠加判定：身份状态 × 路径选择 × 职业身份
  - 禁止表述包括："根据你的画像""我看到你正在""你已选择了""你的状态显示为""作为XX路径的申请人""你在XX页面""我注意到你的身份状态是"
- `components/floating-ai/floating-ai.js`:
  - `sendMessage()`传递userStatus/userSubStatus/selectedPath/activeProcess/page到ai-chat云函数
  - 所有消息路径通过`processMessagesForDisplay()`预处理器

#### P0

| # | 问题 | 详情 | 影响 |
|:--:|------|------|------|
| P0-06 | **画像隐私保护仅依赖LLM遵循system prompt，无输出端硬过滤** | 保护措施全部以自然语言注入system prompt。如果模型因幻觉/对抗性提示/上下文溢出而输出画像信息，代码层没有后处理检测/拦截机制（如正则匹配"你已选择了XX路径"并替换或告警） | 隐私保护的有效性完全取决于模型行为，无法在工程层面保证。高风险场景（如用户截屏传播回复）可能导致画像信息泄露 |

#### P1

| # | 问题 | 详情 | 影响 |
|:--:|------|------|------|
| P1-11 | **buildUserProfile注入4层完整上下文后反而增大了泄露面** | L1-L4包含身份状态/路径/职业/评估标签/高频话题/当前页面，信息粒度极细。如果system prompt被模型忽略，4层信息全部暴露 | 画像越详细，泄露后果越严重 |
| P1-12 | **floating-ai组件不验证ai-chat返回内容是否含画像信息** | `sendMessage()`直接渲染返回的content为rich-text，无任何内容安全扫描 | 即使模型无意泄露，前端也无法拦截 |

#### P2

| # | 问题 | 详情 |
|:--:|------|------|
| P2-05 | PRD Bug #17的验证标准（"回复中不应出现任何画像字段原文"）无自动化回归测试 | 当前无测试用例验证隐私保护有效性 |

---

## 三、其他发现

### 3.1 Bug #7 Markdown解析 ✅ 良好

`floating-ai.js`的`parseMarkdownToNodes()`支持粗体/列表/换行解析，`processMessagesForDisplay()`在所有消息路径调用。rich-text组件渲染正常。

### 3.2 Bug #8 PDF导出 ✅ 良好

`detail.js`的`exportToPDF()`含云端生成失败→图片预览的降级策略。依赖`generate-pdf`云函数（尚未部署时为降级）。

### 3.3 Bug #3/#5 对齐裁切+旋转 ✅ 良好

Step 2→Step 2.5流程完整，movable-view支持pinch zoom+drag。旋转90°+扫描件增强均可用。

---

## 四、P0/P1/P2 汇总

### P0（阻断性 — 6项）

| # | 问题 | 模块 |
|:--:|------|------|
| P0-01 | 7/13路径缺专属卡槽模板，fallback到仅4槽位的default | 卡槽分类 |
| P0-02 | 摄像头实时线框叠加不可行（平台限制，已降级） | 拍摄指引 |
| P0-03 | OffscreenCanvas降级导致4/6项质量检测静默丢失 | 质量校验 |
| P0-04 | "强制继续"按钮绕过所有质量阻断 | 质量校验 |
| P0-05 | 提醒器自动生成链路口径不闭合——生成非自动 | 提醒器 |
| P0-06 | AI画像隐私仅依赖LLM遵循prompt，无输出端硬过滤 | AI隐私 |

### P1（高优 — 12项）

| # | 问题 | 模块 |
|:--:|------|------|
| P1-01 | 赴港计划书仍为文件上传而非文字输入 | 卡槽分类 |
| P1-02 | default模板无financial/application/employment类别 | 卡槽分类 |
| P1-03 | 自由模式线框图未动态渲染freeDocGuide.wfFields | 线框示意 |
| P1-04 | 相机指引为纯文字弹窗无视觉引导 | 拍摄指引 |
| P1-05 | 8/11种自由模式证件无专属线框图 | 线框示意 |
| P1-06 | OffscreenCanvas图片加载无超时保护 | 质量校验 |
| P1-07 | 质量检测异步结果可能未到达UI | 质量校验 |
| P1-08 | detail页生成提醒后index页无感知 | 提醒器 |
| P1-09 | 无激活日期时体验摩擦大 | 提醒器 |
| P1-10 | timeline-templates未覆盖全部13路径 | 提醒器 |
| P1-11 | 4层画像完整注入增大泄露面 | AI隐私 |
| P1-12 | floating-ai不验证返回内容是否含画像信息 | AI隐私 |

### P2（低优 — 5项）

| # | 问题 | 模块 |
|:--:|------|------|
| P2-01 | default模板下部分categoryTab出现空分类 | 卡槽分类 |
| P2-02 | getFreeDocGuide与getSlotGuide数据结构不一致 | 拍摄指引 |
| P2-03 | 线框图CSS存在非令牌硬编码值 | 线框示意 |
| P2-04 | 采样分辨率100×100对大图检测精度下降 | 质量校验 |
| P2-05 | 隐私保护无自动化回归测试 | AI隐私 |

---

## 五、行动建议

### 立即（本轮）
1. **P0-01**: 为asmpt/student_iang/dependent/permanent（至少这4条高频路径）补充专属卡槽模板
2. **P0-04**: "强制继续"仅对info级问题开放，warning级问题必须重新拍摄
3. **P0-05**: `doAutoGenerate()`设置当天为默认激活日期并直接调用`generateTimeline()`，不跳转到detail页手动操作（或至少提供"以今天为激活日期直接生成"的一键选项）

### 下轮（优先）
4. **P0-06**: ai-chat云函数增加输出后处理——检测并过滤画像信息关键词
5. **P0-03**: 为OffscreenCanvas不可用场景增加UA检测并主动告知用户"高级检测不可用"
6. **P1-03/P1-05**: getFreeDocGuide补全wfFields/showPhoto/showSeal属性

### 后续
7. 补齐剩余路径的timeline-templates（techtas/cies/retirement）
8. 建立隐私保护自动化回归测试

---

*审查人: PM Agent (Hermes) | 审查框架: PRD v5 + GAP基线v2 + Bug Fix Round 1 (31项)*
*下一审查节点: P0修复后的第二轮PRD对齐验证*
