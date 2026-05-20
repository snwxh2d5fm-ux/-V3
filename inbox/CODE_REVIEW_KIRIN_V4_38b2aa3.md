# 麒麟代码审查报告 — 住港伴 V4 (运营后台+BI看板)

**审查对象**: 住港伴V4 @ commit `38b2aa3`  
**审查日期**: 2026-05-21  
**审查范围**: 方案设计文档 v1.1 + V3基线代码 + 最新修复 (process/index.js H-01)  
**审查结论**: 🔴 **阻塞 — V4运营后台/BI看板代码尚未开工，方案存在12项P0需修复后方可进入Phase 1**

---

## 一、项目现状

| 组件 | 状态 |
|:--|:--|
| `admin-dashboard/` (React前端) | ❌ 未创建 |
| `cloudfunctions/admin-stats` | ❌ 未创建 |
| `cloudfunctions/admin-users` | ❌ 未创建 |
| `cloudfunctions/admin-revenue` | ❌ 未创建 |
| `cloudfunctions/admin-ai-quality` | ❌ 未创建 |
| `cloudfunctions/admin-content` | ❌ 未创建 |
| `cloudfunctions/admin-compliance` | ❌ 未创建 |
| `cloudbaserc.json` 注册 admin-* | ❌ 未注册 |
| 方案设计文档 v1.1 | ✅ 已完成 (879行) |
| 需求评审报告 v1.0 | ✅ 已完成 (182行) |
| V3基线代码 | ✅ 已冻结 |
| dual-gate特性 | ✅ Phase 1-5已完成 |
| H-01超时修复 (38b2aa3) | ✅ 已合并 |

**结论**: V4核心交付物（运营后台Web App + 6个admin-*云函数）均未开始搭建。当前代码库为V3基线，最新提交仅修复了流程控的超时保护。

---

## 二、P0问题清单（Phase 1前必须修复 — 共12项）

### P0-01 运营后台代码完全缺失 【工程】
- **位置**: `admin-dashboard/`、`cloudfunctions/admin-*`
- **问题**: 方案设计文档已定稿v1.1，需求评审已通过（有条件），但Phase 1项目初始化和脚手架搭建尚未开始。无 `package.json`、无 `vite.config.ts`、无任何前端组件。
- **影响**: 无法进入Phase 1开发。
- **修复**: 按方案设计3.1-3.8节立即启动 `npm create vite@latest admin-dashboard -- --template react-ts`，安装 shadcn/ui + Recharts + @cloudbase/js-sdk。

### P0-02 admin鉴权体系与CloudBase Web Auth不兼容 【技术·方案】
- **位置**: 方案设计 2.3节 / 需求评审 P0-02
- **问题**: 方案中admin-*云函数鉴权使用 `ADMIN_TOKENS` 环境变量 + 临时token，但CloudBase Web Auth返回的是**uid**（匿名ID），与小程序openid不互通。运营后台用Web Auth登录获得的uid无法对应admin_users中的openid。
- **影响**: 运营后台上线后管理员无法登录。
- **修复**: 
  - 方案A: 改用CloudBase Web Auth的自定义声明（custom claims）做角色鉴权，admin_users以uid为主键
  - 方案B: 改用HTTP云函数 + 独立API Key鉴权 + IP白名单

### P0-03 page_view_logs写入量超免费额度 【技术·方案】
- **位置**: 需求评审 P0-03
- **问题**: 若1,000 DAU，page_view + 业务事件日写入~65,000次，CloudBase免费额度30,000写/日，超限2.2倍。
- **影响**: 数据库写满或产生账单冲击。
- **修复**: 
  - page_view实施1:10采样（sampleRate: 0.1）
  - 业务事件批量上传（每30秒或每10条合并写入）
  - page_view_logs设置30天TTL + 定时清理

### P0-04 用户反馈content字段缺少PII自动脱敏 【安全】
- **位置**: `cloudfunctions/feedback-submit/index.js` / 需求评审 P0-04
- **问题**: feedback的content字段是自由文本，用户可能输入手机号、证件号、邮箱等PII。当前仅nickname做脱敏，content完全未处理。
- **影响**: PII泄露风险，违反香港《个人资料（隐私）条例》。
- **修复**: 反馈提交入库前调用 `content-safety-check` 扫描并替换PII为 `[已脱敏]`；运营后台展示时二次过滤。

### P0-05 AI对话response_preview可能进入运营后台 【安全】
- **位置**: 方案设计 3.8节 客服咨询分析看板 / 需求评审 P0-05
- **问题**: 客服咨询分析看板的AI对话query聚类和词云展示可能暴露conversation_logs中的response_preview——其中可能包含K2级政策细节。
- **影响**: K2信息泄露新途径，合规红线。
- **修复**: 
  - response_preview字段绝对禁止出现在任何运营后台页面
  - 词云输入前过K2-leak-scanner + PII正则双重过滤
  - 聚类标签使用预定义分类体系

### P0-06 page_view_logs缺少数据生命周期管理 【数据】
- **位置**: 方案设计 / 需求评审 P0-06
- **问题**: 三张增长表（page_view_logs、user_events、conversation_logs）无TTL、无归档方案。
- **影响**: 存储膨胀、查询性能下降。
- **修复**:
  - page_view_logs: 30天TTL，每周归档CSV到云存储
  - user_events: 180天TTL
  - conversation_logs: 365天TTL
  - 实现 `admin-data-lifecycle` 定时云函数

### P0-07 user_events + invite_codes索引缺失 【数据】
- **位置**: 需求评审 P0-07
- **问题**: 29种事件类型的查询需要 `{createdAt: -1}` 和 `{openid: 1, createdAt: -1}` 索引；invite_codes需4个新复合索引。
- **影响**: 全表扫描，查询超时。
- **修复**: Phase 1部署前通过writeNoSqlDatabaseStructure创建6个新索引。

### P0-08 审计日志缺失关键事件 【安全】
- **位置**: 方案设计 / 需求评审 P0-08
- **问题**: admin_operation_logs仅覆盖CRUD，缺少：登录/登出、数据导出、敏感字段查看、权限变更、失败尝试。审计日志未做append-only保护。
- **修复**: 
  - 补齐5类审计事件
  - 审计日志写入独立集合 `admin_audit_trail`
  - 云函数层强制只insert不update

### P0-09 cloudbaserc.json缺少admin-*函数注册 【工程·代码】
- **位置**: `/cloudbaserc.json` 行1-34
- **问题**: 方案设计6.1节定义了6个admin-*云函数，但cloudbaserc.json的functions数组中未注册任何一个。
- **影响**: 部署时这些云函数不会被CloudBase CLI识别。
- **修复**: 创建admin-*云函数目录后，同步更新cloudbaserc.json的functions数组。

### P0-10 verify.sh验证通过率仅50% 【工程·代码】
- **位置**: `scripts/verify.sh` 执行结果
- **问题**: 运行 `bash scripts/verify.sh` 结果：通过19项，失败19项，警告1项。失败项包括：
  - A1: parseIncome/parseCapital startsWith检查失败
  - A6: 页面注册一致性失败（子包页面路径不匹配）
  - A8: 39个文件含疑似PII
  - A9: PATH_TAGS覆盖度0/13
  - C2/C3: 工程规则和技能文件缺失
- **影响**: 质量门禁未通过，不能判定为可交付状态。
- **修复**: 
  - A1/A6/A9是V3基线遗留问题，建议在Phase 1初期修复
  - A8需逐个文件审查PII疑似项
  - C2/C3需补全工程规范文件

### P0-11 payment云函数环境变量注释泄露敏感配置结构 【安全·代码】
- **位置**: `/cloudfunctions/payment/index.js` 行9-16
- **问题**: 注释中列出了完整的微信支付V3环境变量名和说明（WXPAY_MCHID、WXPAY_API_V3_KEY、WXPAY_PRIVATE_KEY等），其中mchid明文值 `1112016327` 直接暴露在源代码注释中。
- **影响**: 商户号泄露，结合其他信息可被用于社会工程攻击。
- **修复**: 移除注释中的mchid明文值，只保留变量名说明。mchid从环境变量读取。

### P0-12 cloudbaserc.json硬编码envId 【工程·代码】
- **位置**: `/cloudbaserc.json` 行2
- **问题**: `"envId": "cloudbase-d1g17tgt7cc199a60"` 和 `/cloudfunctions/payment/index.js` 行23 `const CLOUD_ENV = 'cloudbase-d1g17tgt7cc199a60'` 硬编码了环境ID。
- **影响**: 环境ID虽然不是密钥，但暴露了基础设施标识，增加攻击面。且多环境部署时需要手动修改。
- **修复**: 使用环境变量或 `cloud.DYNAMIC_CURRENT_ENV`（payment函数中已初始化时用cloud.DYNAMIC_CURRENT_ENV但第23行单独声明了常量）。

---

## 三、P1问题清单（Phase 1-2内修复 — 共8项）

### P1-01 首页仪表盘指标过多 【产品·方案】
- **位置**: 需求评审 P1-01
- **问题**: 11项一级指标在9个用户阶段过于饱和，空数据卡片削弱看板可信度。
- **修复**: Phase 1精简到6项核心指标（用户/路径/AI准确率/安全事件/邀请码激活/页面热度）。

### P1-02 Phase 1全量页面埋点过度设计 【产品·方案】
- **位置**: 需求评审 P1-02
- **问题**: 34页埋点中15个核心页面承载80%用户行为，剩余页面无独立埋点必要。
- **修复**: Phase 1只埋核心15页，事件类型从29种精简到20-22种。

### P1-03 page_view与user_events双重定义风险 【数据·方案】
- **位置**: 需求评审 P1-03
- **问题**: 方案5.2节将page_view列为user_events新事件，7.1节又在page_view_logs存储同一数据。若双写则数据膨胀2倍。
- **修复**: 明确page_view/page_leave仅写入page_view_logs，不写入user_events。

### P1-04 路线图节奏偏差 【产品·方案】
- **位置**: 需求评审 P1-04
- **问题**: 路径分析（核心差异化看板）排在Phase 2中段，种子码管理排在Phase 3。
- **修复**: 路径分析前置到Phase 2开头，种子码管理并入Phase 1。

### P1-05 数据流转缺少fallback机制 【数据·代码】
- **位置**: `cloudfunctions/usage-tracker/index.js` / 需求评审 P1-05
- **问题**: usage-tracker失败时事件直接丢失，无本地缓存+重试策略。
- **修复**: 小程序端实现Storage缓存 + 失败重试，成功后删除缓存。

### P1-06 兑换码CSV导出未做安全防护 【安全·方案】
- **位置**: 需求评审 P1-06
- **问题**: 明文码面直接暴露给运营人员，即使单IP限制也有泄露风险。
- **修复**: 导出需二次密码确认 + CSV加密压缩（AES-256）+ 写入审计日志。

### P1-07 cloudfunctions SDK使用不一致 【工程·代码】
- **位置**: 多个云函数
- **问题**: 
  - `process-manager`、`user-auth`、`payment` 等使用 `wx-server-sdk`
  - `ai-chat`、`ai-eval`、`k2-leak-scanner` 等使用 `@cloudbase/node-sdk`
  - 两种SDK的API有差异（如db.command、getWXContext等）
- **影响**: 维护成本高，新开发者容易混淆。
- **修复**: 统一为 `@cloudbase/node-sdk`（官方推荐），迁移所有wx-server-sdk云函数。注意 `getWXContext()` → `auth().getUserInfo()` 的API差异。

### P1-08 verify.sh A8的39个PII疑似文件未排查 【安全·代码】
- **位置**: `scripts/verify.sh` A8检查项
- **问题**: verify.sh报告39个文件含疑似PII，但未分类/未修复。
- **影响**: 潜在合规风险。
- **修复**: 逐个审查39个文件，区分真实PII vs 测试数据/脱敏示例，真实PII立即处理。

---

## 四、P2建议（Phase 3或之后处理 — 共6项）

### P2-01 daily_stats_snapshots改为增量聚合 【数据·性能】
- **描述**: 当前数据量下可全量扫表，用户量>5,000后再改增量。
- **建议**: Phase 3实现增量聚合。

### P2-02 conversation_logs增加 satisfaction/topicCategory 字段 【数据·扩展】
- **描述**: 目前conversation_logs缺少满意度标记和主题分类。
- **建议**: Phase 2随AI质量监控上线。

### P2-03 NLP自动主题分类先人工替代 【产品·务实】
- **描述**: 当前96条对话不足以训练分类器。
- **建议**: Phase 2先人工打标50-100条。

### P2-04 续签准备就绪度MVP前置 【产品·价值】
- **描述**: 住港伴最核心的独家指标，建议从Phase 3提前到Phase 2。
- **建议**: Phase 2中段引入续签准备度评分MVP。

### P2-05 试用转化漏斗等精细化指标后置 【产品·务实】
- **描述**: 用户量<1,000时不产生有意义的信号。
- **建议**: Phase 3再引入试用转化漏斗分析。

### P2-06 流程控文件过大（787行）需拆分 【工程·代码】
- **位置**: `/pages/process/index/index.js`
- **问题**: 单文件787行，超过编码规范800行硬上限，且目标200-400行。包含模板选择、路径选择、阶段推进、里程碑验证、UI交互等多职责。
- **影响**: 维护困难，新功能叠加风险高。
- **建议**: 拆分为：
  - `process-core.js` — 流程生命周期管理
  - `process-ui.js` — UI交互逻辑
  - `process-templates.js` — 模板选择逻辑
  - 主文件缩减到200行内的协调层

---

## 五、已修复确认项

| 编号 | 描述 | Commit | 状态 |
|:--|:--|:--|:--:|
| H-01 | 流程控云端流程创建超时保护 | 38b2aa3 | ✅ 已修复 |
| H-02 | 流程构建逻辑DRY提取(phase-builder.js) | 38b2aa3 | ✅ 已确认 |

---

## 六、V4实施路线图（建议）

基于本次审查，建议修正路线图：

### Phase 0: P0修复（5月21日-5月23日，3天）
- P0-01: 创建admin-dashboard脚手架（Vite + React + TS + shadcn/ui）
- P0-09: 创建6个admin-*云函数目录 + 更新cloudbaserc.json
- P0-02: 确定鉴权方案（A方案custom claims或B方案API Key）
- P0-10: 修复verify.sh的A1/A6/A9失败项
- P0-11: 清除payment/index.js注释中的mchid明文

### Phase 1: 种子期运营工具（5月24日-6月6日，按照原方案+评审修正）
### Phase 2: 核心运营模块（6月7日-6月20日）
### Phase 3: 精细运营（6月21日-7月4日）

---

## 七、审查指标汇总

| 类别 | P0 | P1 | P2 | 合计 |
|:--|:--:|:--:|:--:|:--:|
| 工程/代码 | 4 | 2 | 1 | 7 |
| 方案/产品 | 0 | 3 | 2 | 5 |
| 安全/合规 | 4 | 2 | 0 | 6 |
| 数据/架构 | 2 | 1 | 2 | 5 |
| 性能 | 2 | 0 | 1 | 3 |
| **合计** | **12** | **8** | **6** | **26** |

---

*审查完成。建议Phase 1开工前召开P0修复评审会，确定鉴权方案（P0-02）和数据生命周期方案（P0-06）后进入正式开发。*
