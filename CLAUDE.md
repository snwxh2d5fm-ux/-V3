# 住港伴 V3 — Claude Code 配置

## 🔴 启动必读

**第一步：读 PROGRESS.md** — 单源真相，包含当前阶段/闸门状态/阻塞项/下一步。

## 项目概述

住港伴（HK Companion）微信小程序，AI 香港身份规划伴侣。七大模块：证件夹/提醒器/指引牌/流程控/效率宝/信息栏/攻略书。

## 技术栈

- 微信小程序原生框架（ES5，禁 const/let/箭头函数）
- CloudBase 云开发（云函数 Nodejs18.15、云数据库、云存储）
- Jest 单元测试 + miniprogram-automator E2E 测试

## 目录结构

- `pages/` — 小程序页面
- `cloudfunctions/` — 云函数
- `data/` — 模板数据与常量
- `utils/` — 工具函数
- `tests/e2e/` — E2E 测试
- `__tests__/` — 单元测试
- `inbox/` — 任务接收（Hermes写入，Claude读取）
- `outbox/` — 交付确认（Claude写入，Hermes读取）

## 🔴 修复铁律 — 手术刀原则

**只修有问题的行，不动其他任何代码。**
- 禁止重写整个函数/文件
- 禁止"顺带优化"无关代码
- 禁止混入你理解的新需求
- 修改前后用 diff 自检：改动行数应 ≤ 问题相关的 3 倍以内
- 每次修复只改一个文件一个点，commit message 精确到行号
- 绝不改动 data/templates data/constants 除非任务明确要求

违反此铁律 → 回滚重做。

## 编码规范

- **ES5强制**：Page()内只用 var + function(){}，禁 const/let/=>/spread
- **WXSS令牌**：颜色/字号/间距必须用 var(--color-*)/var(--font-*)/var(--spacing-*)
- **空值保护**：所有链式访问加守卫 d && d.field
- **云函数结构**：action分支 + 统一返回 {code, message, data} + 超时20s
- **提交格式**：`模块: 变更说明`（中文，单次聚焦单一变更）
- **包体积**：单包不超过2MB，图片走云存储

## 测试命令

```bash
npx jest                          # 全量单元测试
npx jest --testPathIgnorePatterns='tests/e2e' # 仅单元测试
npm run test:e2e:smoke            # E2E冒烟（~30s）
npm run test:e2e                  # E2E全量
bash scripts/verify.sh            # 静态检查（39项）
bash scripts/workflow-verify.sh   # 流程资产校验（36项）
```

## 已知陷阱

- **DevTools粘滞**：编译前必须 cli quit → sleep 2 → cli open → sleep 4 → auto-preview
- **verify.sh set-e**：B2失败会截断输出，用 `sed 's/set -euo pipefail/set -uo pipefail/' scripts/verify.sh | bash` 获取完整结果
- **auto-preview假阳性**：exit code 0 ≠ 无编译错误，必须 grep 扫描日志
- **automator WebSocket寿命**：v0.12约15-20次操作后断连，E2E分批跑
- **workdir中文路径**：terminal workdir参数不能含中文，用 cd 命令内切换

## 闸门顺序（9项，缺一不可）

1. verify.sh 全量
2. workflow-verify.sh
3. Jest 全量
4. DevTools编译 + 日志扫描
5. 麒麟 Code Review（delegate_task）
6. 玄武 PM Review（delegate_task）
7. CloudBase 部署（仅云函数变更时）
8. git push
9. ACL通知 + inbox 3报告回写

## 隐私红线（K2）

- 测试数据用占位符：主申请人/配偶/子女A
- 禁止真实姓名/证件号出现在代码/注释/测试中
- 证件号用明显虚构值：110101199001011234
