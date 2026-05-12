# 住港伴 V2 代码更新文档 v4.1

> **版本**: v4.0 → v4.1  
> **基准**: PRD v3.1 迭代升级 (2026-05-08)  
> **输入数据**: V5校验报告 + 全生命周期时间轴重构 v1.0 + 方案库 v1.0 + V4→V5修正补丁  
> **更新日期**: 2026-05-08  

---

## 一、更新总览

| 类别 | 改动文件数 | 新增文件 | 影响模块 |
|------|:------:|:------:|---------|
| 数据层 (data/) | 3改 + 2新 | confidence.js, solution-library.js | 全模块 |
| 工具层 (utils/) | 3改 | — | 规则引擎, 脱敏, API |
| 应用层 (app.*) | 1改 | — | app.js |
| 云函数 (cloudfunctions/) | 4改 + 1新 | solution-engine/ | 全部服务端 |
| 页面 (pages/) | 1改 | — | status-select |
| 文档 | 1新 | V2_CODE_UPDATE_v4.1 | 本文档 |

---

## 二、P0 法律错误修正

### 2.1 学生签证受养人政策反转

**错误**: "学生签证不可携带受养人"  
**修正**: 学位课程学生签证持有人**可以**携带配偶和子女。受养人不得在港工作。VPAS例外。

影响的文件和代码位置:

- `data/confidence.js` — `P0_POLICY_FIXES.student_dependent`
- `cloudfunctions/guide-service/index.js` — `validateGuideContent()` 检测触发
- `data/templates.js` — 路径10(受养人) phase1: "⚠️学生签证受养人不得工作 [A]"

### 2.2 学生工作限制已过时

**错误**: "学生签证每周限工作20小时"  
**修正**: 自2023/2024年起，全日制非本地学生工作限制已暂时取消（须申请NOL）。

影响的文件:

- `data/confidence.js` — `P0_POLICY_FIXES.student_work`
- `data/templates.js` — 路径1 phase3: "合法兼职(2023/2024起无限时) ⚠️已更新 [A]"
- `utils/rule-engine.js` — `checkPolicyVersion()` 检测旧政策引用
- `cloudfunctions/guide-service/index.js` — 内容验证规则

### 2.3 Cap.115条文编号修正

**错误A**: s.2A → s.11(8) (居留权定义 vs 入境处处长酌情权)  
**错误B**: s.42 → s.38A (虚假陈述条文)

影响的文件:

- `data/confidence.js` — `P0_LEGAL_FIXES` 完整映射表
- `utils/rule-engine.js` — `checkLegalCitation()` 自动检测
- `cloudfunctions/guide-service/index.js` — 内容验证

---

## 三、核心模块升级详情

### 3.1 数据层

#### `data/constants.js` — 全面重构

| 变更项 | v4.0 | v4.1 |
|--------|------|------|
| 路径定义 | 4条 (qmas/ttps/asmpt/iang) | 12条 (student_iang~minor_student) |
| 用户状态 | 4种 (unapplied/submitted/approved/permanent) | 4组×15种子选项 |
| 新增常量 | — | CONFIDENCE_LEVELS, LEGAL_SOURCE_TYPES, PROCESS_PHASES, DECISION_POINTS, PATH_RISK_LEVELS |
| 评估问题 | 11题 | 15题（+合资格大学判断/名企/国际经验/IP/资本） |

#### `data/confidence.js` — 新建

五级置信度框架:

- A级(~55%): Cap.115/基本法明确
- B级(~30%): 入境处政策明确
- C级(~10%): 多数实践一致（入境处有酌情权）
- D级(~4%): 合理推断（标注非权威）
- E级(~1%): 无法确认（替换为"建议咨询"）

内含: P0修正映射表、法源强度标注、法律引用格式规范、置信度驱动的展示规则函数。

#### `data/solution-library.js` — 新建

方案库匹配系统:

- 12用户画像定义（含匹配权重）
- 12路径详情（含四阶段框架+决策节点+风险提示）
- 决策节点方案对比数据
- `matchPersonaToPaths()` — 确定性路径推荐算法

#### `data/templates.js` — 从6模板升级到14模板

| v4.0 | v4.1 |
|------|------|
| 6条流程模板(优才/高才A/高才BC/激活/高才续签/永居) | 12条路径模板 + 签证激活 + 永居申请 |
| 简单stages结构 | 四阶段框架(phase1~4) + 每步含置信度标注 |
| 无决策节点 | 每模板含decisionPoints数组 |

### 3.2 工具层

#### `utils/rule-engine.js`

| 变更 | 说明 |
|------|------|
| 置信度过滤 | A/B自动生效, C需确认, D不自动生成 |
| 新增函数 | `checkLegalCitation()`, `checkAbsoluteLanguage()`, `checkPolicyVersion()` |
| 提醒规则 | 12×4×N四维规则矩阵（含置信度+决策节点+法律依据字段） |
| 材料检查 | 新增学生/高才A路径的材料规则 |

#### `utils/desensitize.js`

| 变更 | 说明 |
|------|------|
| 香港身份证 | 新增hkIdCardNumber检测 |
| 日期脱敏 | 新增exactDate检测 |
| 法律保护 | 新增protectLegalCitation()确保条文编号不误改 |
| ENGINE_VERSION | 3.0.0 → 4.1.0 |

#### `utils/api.js`

| 变更 | 说明 |
|------|------|
| 新增接口 | `matchSolutionPath()`, `compareSolutionPaths()` |
| 置信度支持 | fetchGuides/fetchPlaybook增加confidenceLevel参数 |
| 头像对齐 | fetchPolicyUpdates增加pathType/personaId参数 |
| 引擎版本 | X-Engine-Version: 4.1.0 |

### 3.3 应用层

#### `app.js`

| 变更 | 说明 |
|------|------|
| 版本号 | v4 → v4.1, PRD v3.1 |
| 新增字段 | userSubStatus, selectedPath, solutionRecommendation |
| 新增函数 | getSolutionRecommendation() — 客户端+云端混合匹配 |
| 会话持久 | saveSession增加子状态/路径/推荐结果 |

### 3.4 云函数层

#### `guide-service/index.js` — 重建

新增功能:
- 每条指引附加置信度(level/label/color/banner)
- 内容校验(validateContent): P0法律条文 + 政策 + 绝对化语言检测
- 政策版本检查(checkPolicyVersion)
- enrichWithConfidence()统一处理
- D/E级内容标记横幅/隐藏

#### `reminder-engine/index.js` — 重建

新增功能:
- 置信度分级: A/B自动生效, C待确认, D不生成
- 新增字段: confidence, autoApply, path, phase, decisionPoint, legalBasis
- getDecisionReminders() — 按决策节点查询提醒

#### `process-manager/index.js` — 扩展

新增action:
- `getActive` — 获取活跃流程（供app.js刷新用）
- `getDecisionNodes` — 获取模板决策节点列表

#### `match-engine/index.js` — 保留（作为fallback）

#### `solution-engine/index.js` + `package.json` — 新建

方案库推荐引擎:
- `match` — 基于12画像特征匹配最优路径
- `compare` — 多路径对比（周期/成本/自由度/风险）
- `listAll` — 列出全部路径

---

## 四、P0/P1/P2 需求覆盖

| PRD ID | 需求 | 实施状态 | 位置 |
|--------|------|:------:|------|
| GD-CF-01 | 指引牌置信度标注 | ✅ | guide-service enrichWithConfidence() |
| GD-CF-02 | D级内容横幅 | ✅ | confidence.js showBanner |
| GD-CF-03 | E级不出现 | ✅ | confidence.js hideContent |
| PC-CF-01 | 时间窗置信度 | ✅ | templates.js 每步含confidence |
| RM-CF-01 | 提醒置信度分级 | ✅ | rule-engine.js getRuleAutoApply() |
| IR-CF-01 | 法源强度标注 | ✅ | confidence.js LEGAL_SOURCE |
| PC-V5-01 | 四阶段框架 | ✅ | templates.js phases结构 |
| PC-V5-02 | 6决策节点 | ✅ | templates.js decisionPoints |
| PC-V5-03 | 决策节点对比 | ✅ | solution-library.js DECISION_COMPARISONS |
| GD-V5-01 | 指引内容审核 | ✅ | guide-service validateContent() |
| GD-V5-02 | 法律引用格式 | ✅ | confidence.js formatLegalCitation() |
| GD-V5-03 | 政策版本追踪 | ✅ | guide-service checkPolicyVersion() |
| RM-V5-01 | 决策节点提醒 | ✅ | reminder-engine getDecisionReminders() |
| SR-01 | 方案库路径匹配 | ✅ | solution-engine match() |
| SR-02 | 推荐结果展示 | ✅ | solution-engine 返回topPick+alternatives |
| SR-03 | 路径对比 | ✅ | solution-engine compare() |
| EF-V5-01 | 法律条文引用校验 | ✅ | rule-engine checkLegalCitation() |
| PV-V5-01 | 法律条文保护 | ✅ | desensitize.js protectLegalCitation() |
| RG-V5-01 | 状态细分子选项 | ✅ | status-select.js 15种子选项 |

---

## 五、术语合规检查

| 检查项 | 状态 |
|--------|:----:|
| 全文无"移民"字眼 | ✅ |
| 使用"身份规划"替代 | ✅ |
| Cap.115条文编号正确 | ✅ (P0修正已应用) |
| 学生签证受养人政策正确 | ✅ (已反转修正) |
| 学生工作限制已更新 | ✅ (2023-2024新政) |

---

## 六、部署注意事项

1. **云函数部署**: 新增 `solution-engine` 需在CloudBase控制台创建并部署
2. **数据库集合**: 需新增 `solution_results` 集合存储推荐历史
3. **提醒规则**: `reminder_rules` 集合需新增字段: confidence, path, phase, decisionPoint, legalBasis
4. **指引条目**: `guide_items` 集合需新增字段: confidence, lastVerifiedAt, policyVersion
5. **兼容性**: 所有旧版API参数保持向后兼容，新增字段使用默认值

---

> **PRD v3.1 迭代补丁代码对齐 | 2026-05-08**  
> **不改变**: 原生小程序+CloudBase架构、隐私三层体系、去Agent化哲学  
> **增强**: 12路径模板、五级置信度、方案库推荐、P0法律修正
