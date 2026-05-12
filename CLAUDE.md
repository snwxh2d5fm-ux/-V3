# 住港伴 (ZhuGangBan) — 微信小程序项目上下文

> 香港身份规划 AI 伴侣 · WeChat Mini Program + CloudBase
> 最后更新: 2026-05-12

## 项目定位
帮助内地/海外人士规划香港身份的微信小程序。覆盖 12 条申请路径的资格评估、材料准备、流程追踪、到期提醒。

## 环境
- **CloudBase 环境**: `cloudbase-d1g17tgt7cc199a60`
- **微信 AppID**: `wx08c2222c1bf042fd`
- **项目路径**: `~/Downloads/港动人生/住港伴V3-开发中/`
- **基础库**: 3.15.2 (灰度中)
- **技术栈**: 原生小程序 + CloudBase 云函数 + wx.storage 本地存储

## Harness Engineering 基础设施

本项目采用 **Harness Engineering** 四块拼图架构（对齐白家杰「Harness Engineering 如何工程化落地」12章框架）：

| 拼图 | 本地路径 | 状态 | 评分 |
|------|---------|:--:|:--:|
| 约束与流程 | `.hermes/rules/` (6) + `.hermes/skills/` (5) + `.hermes/agents/` (7) + `.hermes/workflow/` | ✅ | 72/100 |
| 反馈 | `scripts/verify.sh` (32项) + `scripts/workflow-verify.sh` (36项) | ✅ | 75/100 |
| 知识库 | `CLAUDE.md` (本文件) + `.hermes/task-board.yaml` | ✅ | 70/100 |
| 进化 | `.hermes/` 全部资产入仓库 + 角色契约体系 | ✅ | 68/100 |
| **综合** | | | **🟢 71/100** |

### 七 Agent 流水线

```
PM Agent (路由/调度)
  │
  ├─ S1 → 需求分析 Agent (requirement)  ──→ 需求文档
  ├─ S2 → 方案设计 Agent (design)       ──→ 方案文档
  ├─ S3 → 闸门总控 Agent (gate)         ──→ 准入/打回
  ├─ S4 → 开发实现 Agent (dev)          ──→ 代码变更
  ├─ S5 → 代码审查 Agent (review)       ──→ 审查报告
  ├─ S6 → 测试验证 Agent (test)         ──→ 测试报告
  └─ S7 → PM Agent                      ──→ 交付
```

详见: `.hermes/workflow/flow-definition.md` + `.hermes/workflow/agent-contracts/`

### 总验证脚本 (Gatekeeper)
```bash
bash scripts/verify.sh            # 全量检查 (32项: A1-A10/B1-B5/C1-C4)
bash scripts/verify.sh --baseline  # 建立/更新基线
bash scripts/verify.sh --diff      # 与基线对比 (检测新增失败 + 测试数变化)
bash scripts/workflow-verify.sh    # 流程资产校验 (Agent/契约/Rule/Skill 完整性)
```
**规则**: 每次代码改动后必须运行 `scripts/verify.sh` 并通过，才算开发完成。

### 开发纪律 (Rule 摘要)
1. 原生 Page() 用 `function(){}` 和 `var`，禁箭头函数/async
2. WXML 禁双重 wx:for 同元素
3. parseIncome/parseCapital 用 `startsWith` 防子串误判
4. K2 安全域不得在用户面引用
5. guidebook 内容必须通过 redactContent() 脱敏
6. CLAUDE.md 必须同步更新

详见: `.hermes/rules/` (6文件: security/wechat-dev/code-quality/terminology/data-pipeline/ai-chat-guardrail)

## 核心架构

```
用户端 (微信小程序)
│
├─ 5 个 Tab:
│   ├─ 攻略书  (guidebooks) — AI 知识库 FAQ
│   ├─ 证件夹  (documents)  — 按路径/所属人的卡槽系统
│   ├─ 提醒器  (reminders)  — 100 条规则链式提醒
│   ├─ 流程控  (process)    — 7 步流程进度看板
│   └─ 我的    (mine)       — 会员/设置
│
├─ 数据层 (data/):
│   ├─ constants.js — 路径常量、题目定义、版本号
│   ├─ solution-library.js — 12 画像 + 匹配引擎 + 路径详情
│   ├─ templates.js — 9 条流程模板
│   ├─ persona-path-compat.js — 画像×路径兼容矩阵
│   └─ guidebook-data.js — 攻略书内容 (47篇，含9分类: qmas/ttps/asmpt/iang/landing/renewal/pr_sprint/life/other)
│
└─ CloudBase 云端:
    ├─ 云函数 (23个) — AI对话/资格匹配/提醒/攻略生成
    ├─ knowledge_chunks (8,058条) — RAG 知识库
    └─ guidebook_articles (47篇) — 攻略书云备份
```

### 数据流向图

```
知识采集                  RAG管线                    用户交互
────────                ────────                   ────────
policy-monitor ─┐                                    提问
小红书爬虫 ──────→ knowledge-import → knowledge_chunks → rag-search → ai-chat → 回答
知乎采集    ──────┘                 ↓                                   ↑
用户提交    ──────┘           embedding-import                     prompts.js
                                   ↓                              (K2安全规则)
                             向量检索 ←─────────────────────────────┘

内容生成                              用户路径
────────                              ────────
knowledge_chunks ─→ batch-generate-guidebooks → guidebook_articles
                                                     ↕
                                              guidebook-data.js → 攻略书 Tab

资格评估
────────
用户自评 → constants.js (题目) → solution-library.js (匹配) → persona-path-compat (校验) → 报告

证件OCR
───────
拍照/上传 → ocr-service/preaudit-engine → 规则校验 → K2脱敏 → 证件夹存储
```

### 页面结构
| 页面 | 路径 | 说明 |
|------|------|------|
| 首页 | pages/home/home | 状态感知入口 |
| 身份选择 | pages/status-select/status-select | OCR 验证 + 智能修正 |
| 资格评估 | pages/assessment/index/index | 15 题答题 + 12-criteria 匹配 |
| 评估结果 | pages/assessment/result/result | 路径推荐 + 兼容性校验 |
| 流程控 | pages/process/index/index | 7 步内联进度看板 |
| 流程详情 | pages/process/detail/detail | 阶段步骤 + 里程碑解锁 |
| 证件夹 | pages/documents/index/index | 卡槽系统 + 所属人切换 |
| 证件添加 | pages/documents/add/add | OCR 拍照/手动录入 |
| 证件详情 | pages/documents/detail/detail | PII 脱敏显示 |
| 证件合并 | pages/documents/combine/combine | 多证件合图 |
| 提醒器 | pages/reminders/index/index | 时间线/列表双视图 |
| 攻略书 | pages/guidebooks/index/index | 分类浏览 + AI 推荐 |
| AI 对话 | pages/chat/index/index | 智能问答 + floating-ai |
| 效率宝 | pages/precheck/index/index | 证件预审 |
| 我的 | pages/mine/index/index | 会员/设置 |

### 核心云函数
| 函数 | 作用 | 优先级 |
|------|------|:--:|
| rag-search | 向量检索 + K0/K1/K2 三层过滤 | 🔴 |
| ai-chat | AI 对话 + 四模式安全规则 | 🔴 |
| preaudit-engine | 证件 OCR 校验 + 规则引擎 | 🔴 |
| k2-leak-scanner | 每日03:00 K2 泄漏扫描 | 🟡 |
| batch-generate-guidebooks | 批量攻略书生成 | 🟡 |
| match-engine | 路径匹配 | 🟡 |
| reminder-engine | 提醒规则计算 | 🟡 |
| payment | 微信支付 V3 | 🟡 |
| user-auth | 用户认证 | 🟡 |
| knowledge-import | 知识入库 + K2 拦截 | 🟢 |
| policy-monitor | 政策变更监控 | 🟢 |
| 其他 12 个 | 辅助功能 | 🟢 |

完整列表见 `cloudfunctions/` (23个)

## 已知问题 & 注意事项

### WeChat DevTools
- **编译 error code 10** = 通用编译失败，非代码问题。排查: cli cache --clean → cli quit → 重开
- **原生 Page() 限制**: 必须用 `function(){}` 和 `var`，禁箭头函数/async/IIFE
- **button 原生样式覆盖**: 必须显式 `::after { border: none }` + `line-height: 1.4`
- **switchTab 在 redirectTo 链后静默失败**: 改用 `wx.reLaunch`

### 匹配引擎 (pages/assessment/index/index.js → solution-library.js)
- QMAS 12 准则: C1 需同时选中中文+英语流利；threshold ≥6
- parseIncome/parseCapital 必须用 `startsWith` 防子串误判 (在 pages/assessment/index/index.js:328)
- hasKids→dependent/minor 仅 persona===9 触发

### 证件夹
- 所属人切换: identityOwner ('self'/'spouse'/'child')
- 身份卡槽刷新依赖 `_baseSlotCategories` 备份
- add 页接受 `&ownerType=` URL 参数预填

### CloudBase 操作
- MCP deploy 云函数: 先本地 `node -c` 验证语法 → MCP createFunction → smoke test
- deploy 后必须 invoke 验证
- 回滚: 烟雾测试失败→立刻回滚，连续2次失败→触发代码审查

### 文件编码
- `execute_code` 的 `read_file` 返回带行号前缀的 content，直接 write 会污染文件
- 优先用 `patch` 工具做修改
- 如必须用 execute_code，读取用 `open()` 而非 `read_file()`

## 本轮进展 (2026-05-12)
1. **Harness Engineering H1+H2 全面升级**:
   - Agent: 3→7 (PM/Requirement/Design/Gate/Dev/Review/Test)
   - qa-agent 拆分为 review-agent + test-agent（审查与测试独立）
   - `.hermes/workflow/flow-definition.md` — 七阶段流水线 + 前进/回退规则
   - `.hermes/workflow/agent-contracts/` × 7 — 角色契约
   - `.hermes/workflow/workflow-overview.md` — L1 人类可读流程总览
   - `.hermes/workflow/mcp-evaluation.md` — MCP 扩展评估（结论：无需新增）
   - `scripts/workflow-verify.sh` — 36项流程资产校验
   - `scripts/verify.sh` 增强: A10测试数检查 + 历史基线保留 + diff增强
   - H2-A: Rule 职责边界清理（去重+瘦身）
   - H2-C: Memory 审计完成（手册→Skill，档案保留）
2. **文档框架重组**:
   - V3 项目根目录清理: 20+ 开发文档迁移至 `10_工程文档/住港伴V3/`
   - `.gitignore` 创建: 排除 CLAUDE.md/.hermes/工程资产
   - 港动人生/ 根目录: 90+ 散落文档按类归入 01-10 目录
3. **攻略书推荐引擎 V3 双驱动全面修复**:
   - PATH_TAGS(13条×4状态=52组合全覆盖) + 路径标签映射
   - 新增 A9 推荐覆盖度检查项 → verify.sh 从 28→32 项
4. **攻略书**: 新增 retirement_001→47篇 + "其他"分类
