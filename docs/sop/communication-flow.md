# SOP: 通讯流程 / 协同机制 / 审核流程 / 交付标准

**维护者**: MT天衣  
**版本**: v3.1  
**最后更新**: 2026-05-15

---

## 一、角色边界（铁律）

| Agent | 职责 | 代码权限 |
|-------|------|:-------:|
| Claude | 唯一代码来源 | ✅ 全部 |
| QA包拯 | 9道闸门、测试执行、双审调度 | ❌ |
| MT天衣 | 文档规范、知识库、技能维护 | ❌ |
| ITPM夸父 | CloudBase、Claude通讯、进度跟催 | ❌ |
| PMO | 项目进度、任务分派、向琅琊汇报 | ❌ |

**红线**: 任何非Claude角色修改项目源码 = 信用分 -30/次，<60 熔断。

---

## 二、ACL通知协议（Hermes→Claude，强制4步）

每次发现Bug或需要Claude修复时，必须完整走4步：

```
① 写 inbox/REVIEW_{topic}_{date}.md
   — 详细问题报告（现状/期望/涉及文件/实现要点）

② 写 inbox/NOTIFY_{topic}_{date}.md
   — 通知摘要（指向REVIEW文件，含行动指令）

③ 同步双路径
   cp inbox/REVIEW_*.md ~/Claude/cowork/inbox/
   cp inbox/NOTIFY_*.md ~/Claude/cowork/inbox/

④ claude-cowork 后台通知（必须background=true，不可前台阻塞）
   terminal("claude-cowork '请读取 inbox/NOTIFY_xxx.md'", background=true)
```

**禁止**:
- 直接调 claude-cowork 跳过 REVIEW/NOTIFY 文件
- 只写 ~/Claude/cowork/inbox/ 不同步项目 inbox/（Claude CWD=项目目录）
- claude-cowork 前台调用（会阻塞Hermes超时）

---

## 三、Bug报告格式（四要素，缺一不可）

```markdown
## Bug #N: 一句话描述 [P0/P1/P2]

**现状**: 当前实际表现（用户看到了什么异常）
**期望**: 正确行为应该是什么（含交互细节）
**涉及文件**: 精确到文件路径（如 pages/add/add.js:42）
**实现要点**: Claude修复时需要的技术指引（API选择/数据流/边界条件）
```

**禁止**: `Bug #1: 证件夹文字异常` — 没有现状/期望/文件，Claude无法下手。

---

## 四、双审机制（麒麟+玄武，强制并行）

**触发时机**: Claude每次交付代码后，Hermes必须并行委派。

```
麒麟 (Code Review):
  — 安全漏洞、逻辑错误、字段一致性、空值守卫、资源泄漏
  — 审查范围: git diff HEAD~N..HEAD
  — 输出: P0/P1/P2分级报告，每条含文件+行号

玄武 (PM Review):
  — PRD对齐、功能完整性、UX设计、分类体系、数据流闭合
  — 审查范围: 同上
  — 输出: P0/P1/P2分级报告
```

**执行**: `delegate_task` 双任务并行，不等不跳。

**完成标准**: 两份报告写入 inbox/CODE_REVIEW_KIRIN.md + inbox/PRD_REVIEW_XUANWU.md。

**反模式**: 直接采信subagent的P0清单 → 必须用 read_file 独立验证每个P0问题真实存在。

---

## 五、交付标准（Claude→Hermes）

Claude交付代码的完整流程：

```
Claude 修改代码
    ↓
Claude 写 outbox/{task}_done.md（含变更文件列表）
    ↓
Hermes 读 outbox → 执行9道闸门
    ↓
闸门全通 → git push → 回写3份inbox报告
    ↓
Hermes 通知琅琊
```

**Claude不跑测试**。测试/验证/BenchRun全部由Hermes执行。

---

## 六、9道闸门（缺一不可）

| # | 项 | 执行方 |
|---|-----|--------|
| 1 | verify.sh 全量 | Hermes |
| 1b | workflow-verify.sh | Hermes |
| 2 | Jest 全量 | Hermes |
| 3 | DevTools编译+日志扫描 | Hermes |
| 4 | 麒麟Code Review | delegate_task |
| 5 | 玄武PM Review | delegate_task |
| 6 | CloudBase部署+smoke invoke | Hermes（仅云函数变更时） |
| 7 | git push | Hermes |
| 8 | ledger追加 | Hermes |
| 9 | ACL通知+3份inbox报告 | Hermes |

**跳任一项 = 信用分 -10**。

---

## 七、PROGRESS.md 维护规范

- 单源真相，所有任务状态/闸门结果/阻塞项只在此处
- 每次闸门后必须更新状态
- 格式: 阶段表 + 最新提交 + 闸门状态 + 阻塞项 + 下一步
- 禁止在其他文件中维护进度副本
