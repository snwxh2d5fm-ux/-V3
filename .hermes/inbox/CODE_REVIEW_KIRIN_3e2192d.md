# 麒麟 Code Review — 3e2192d

> 2026-05-21 | commit `3e2192d` | `feat(dual-gate): 双闸门特性完整交付`
> 审查范围：20文件 / +257 -626 / ai-chat修复(4文件已commit) + 5文件工作区未commit
> 测试：15/15 suites, 380/384 pass (4 todo), 0 fail

---

## 执行摘要

本轮 commit 涵盖5项PR修复(C-01/H-01/H-03 + 2项隐性)及双闸门引擎核心交付。Jest全绿(380/384)。发现 **P0×4 / P1×5 / P2×4**，主要集中在：

1. **决策引擎白名单退化** (P0) — 闸门2有效状态校验被移除
2. **gate-sheet 登录流程数据丢失** (P0) — 代码压缩误删 phoneBound/membershipLevel 写入
3. **SDK迁移风险** (P0, 未commit) — ai-chat 云函数从 wx-server-sdk 迁移至 @cloudbase/node-sdk
4. **内容安全正则误拦截** (P0, 未commit) — AI对话预检可能拦截正常心理健康咨询

5个未commit文件涉及 ai-chat 云函数功能性变更(反馈处理/RAG多关键词/内容安全)，建议先独立审查再合并。

---

## P0 — 必须修复 (4项)

### P0-KR-01 | decision-gate.js:5,23 — 闸门2有效状态白名单失效

**文件**: `utils/decision-gate.js`  
**严重性**: 数据安全 — 任意脏数据可通过闸门

`VALID_STATUSES` 数组(L5)仍在声明但 condition(L23)不再使用：

```js
// L5: 声明存在
var VALID_STATUSES = ['unapplied', 'submitted', 'approved', 'permanent'];

// L23: 仅检查空值和skipped，VALID_STATUSES未被引用
if (!userStatus || userStatus === 'skipped') {
  return { ok: false, reason: 'identity' };
}
```

**影响**: 任意非空字符串('corrupted', 'hacker', 'deleted')均可通过闸门2，gate形同虚设。Storage脏数据直接污染业务逻辑。

**对比旧代码**:

```js
// 旧: 白名单守卫
if (!userStatus || userStatus === 'skipped' || VALID_STATUSES.indexOf(userStatus) === -1)
```

**修复建议**: 恢复白名单校验，或显式解释移除此守卫的业务理由（如"所有非空状态一律放行"的设计变更需同步更新测试+文档）。

```js
if (!userStatus || userStatus === 'skipped' || VALID_STATUSES.indexOf(userStatus) === -1) {
  return { ok: false, reason: 'identity' };
}
```

---

### P0-KR-02 | gate-sheet.js:29-33 — 登录后 globalData.phoneBound/membershipLevel 丢失

**文件**: `components/gate-sheet/gate-sheet.js` L29-33  
**严重性**: 数据完整性 — 登录后Session状态不一致

代码压缩(L28-33)误删了两行关键赋值：

```js
// 压缩后 (L28-33): phoneBound 和 membershipLevel 未写入 globalData
var app = getApp();
app.globalData.isLoggedIn = true;
app.globalData.token = result.token;
app.globalData.userInfo = result.userInfo || { nickName: '住港伴用户' };
app.globalData.userStatus = result.userStatus || '';
app.saveSession({
  token: app.globalData.token,
  userInfo: app.globalData.userInfo,
  userStatus: app.globalData.userStatus,
  membershipLevel: result.membershipLevel || 'free', // ✅ 从result取值
  phoneBound: app.globalData.phoneBound, // ❌ 读取未更新的旧值！
});
```

**对比旧代码**（被删除的两行）:

```js
app.globalData.membershipLevel = result.membershipLevel || 'free';
app.globalData.phoneBound = !!(result.phoneBound || (result.data && result.data.phoneBound));
```

**影响**: 登录后 `globalData.phoneBound` 保持 undefined/过期值，`globalData.membershipLevel` 未更新。saveSession 写入错误 phoneBound，后续所有依赖 `app.globalData.phoneBound` 的逻辑(如手机绑定检查)将读取到错误状态。

**修复建议**: 恢复两行赋值：

```js
app.globalData.membershipLevel = result.membershipLevel || 'free';
app.globalData.phoneBound = !!(result.phoneBound || (result.data && result.data.phoneBound));
app.saveSession({
  // ... use the just-set globalData values
  membershipLevel: app.globalData.membershipLevel,
  phoneBound: app.globalData.phoneBound,
});
```

---

### P0-KR-03 | ai-chat/context-builder.js (未commit) — SDK迁移依赖环境变量 ENV_ID

**文件**: `cloudfunctions/ai-chat/context-builder.js` (工作区未commit)  
**严重性**: 功能阻断 — 云函数部署后数据库操作全部失败

```diff
-const cloud = require('wx-server-sdk');
-cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
-const db = cloud.database();
+const cloudbase = require('@cloudbase/node-sdk');
+const app = cloudbase.init({ env: process.env.ENV_ID });
+const db = app.database();
```

**风险点**:

1. `@cloudbase/node-sdk` 需确认已在 `package.json` 声明且与云函数运行时兼容
2. `init({ env: process.env.ENV_ID })` — ENV_ID 环境变量是否已在云函数配置中设置？CloudBase 云函数默认不注入此变量
3. `DYNAMIC_CURRENT_ENV` → `process.env.ENV_ID` 不是等价替换。前者由云函数运行时自动注入当前环境ID，后者需手动配置
4. `app.database()` 与 `cloud.database()` 的API可能不完全兼容（如 `db.command` 链式调用）

**修复建议**:

- 如确需迁移，必须在云函数环境变量中配置 ENV_ID
- 或保留 `wx-server-sdk` 与 `cloud.DYNAMIC_CURRENT_ENV` 方式（推荐，零风险）
- 部署前在云函数控制台确认 `@cloudbase/node-sdk` 依赖已安装

---

### P0-KR-04 | ai-chat/index.js:534-540 (未commit) — 内容安全正则可能误拦截心理健康咨询

**文件**: `cloudfunctions/ai-chat/index.js` L534-540 (工作区未commit)  
**严重性**: 用户体验 — 正常咨询被误判拦截

```js
const blockedPatterns = [
  /(自杀|自残|自我伤害).*(方法|方式|怎么|如何)/,
  /(制造|制作).*(炸弹|爆炸物|武器|毒药)/,
  /(儿童|未成年).*(色情|性虐待|剥削)/,
];
for (let i = 0; i < blockedPatterns.length; i++) {
  if (blockedPatterns[i].test(message)) {
    return respond(400, '您的消息包含不被支持的内容，请重新输入。', null, context);
  }
}
```

**问题**: 第一个正则 `/(自杀|自残|自我伤害).*(方法|方式|怎么|如何)/` 会拦截"如何帮助有自杀倾向的人"、"自残行为的心理干预方式"等正常心理健康咨询。住港伴作为移民工具，用户可能在评估中表达焦虑情绪。

**建议修复**:

```js
// 更精确匹配：仅拦截"寻求方法"而非"寻求帮助"
/(如何|怎么|求)(自杀|自残|自我伤害)(方法|方式|教程)/,
// 或对非恶意咨询返回引导而非硬拦截
```

---

## P1 — 建议修复 (5项)

### P1-KR-01 | gate-sheet.js — 代码压缩丢失全部注释和文档

**文件**: `components/gate-sheet/gate-sheet.js` (128→47行)  
原文件含完整 JSDoc、方法分段注释、业务逻辑说明。压缩后所有注释被移除，违反项目 AGENTS.md "先结构后实现" 原则。

**影响**: 后续维护者无法理解 `handleLogin` 中 `phoneBound` 计算逻辑、`pageLifetimes.show` 的重检机制。

---

### P1-KR-02 | decision-gate.test.js — 测试覆盖退化

**文件**: `__tests__/decision-gate.test.js` (189→92行)  
原测试覆盖"8种状态组合+4种存储异常"，重写后结构更清晰但缺少：

- 无效状态字符串（如 "garbage", "unknown"）通过闸门2的场景（配合P0-KR-01）
- `getApp()` 返回但 `globalData` 不存在的边界

**建议**: 在现有 Jest mock 框架上补充无效状态测试。

---

### P1-KR-03 | process/index.js:121 — cloudProcessId 死变量

**文件**: `pages/process/index/index.js` L121

```js
var cloudProcessId = processLine.id; // 声明但从未使用
// ...后续直接使用 startRes.result.data.processId
```

变量声明但值从未被读取。L126 `line.cloudId = startRes.result.data.processId` 直接取值，不再通过 `cloudProcessId` 中转。

**建议**: 删除 `var cloudProcessId = processLine.id;` 或改用该变量。

---

### P1-KR-04 | subpkg-chat: formatReplyContent 占位符冲突风险

**文件**: `subpkg-chat/pages/chat/index.js` L289-334 (已commit)  
新增 Markdown→HTML 管道使用 `%%CODEBLOCK_N%%` / `%%INLINECODE_N%%` 占位符。若用户消息包含字面量 `%%CODEBLOCK_0%%`，将触发占位符冲突。

**影响**: 极低概率(需用户刻意输入)，但防御性编程原则下应处理。

**建议**: 改用随机salt或不可打印字符作为占位符前缀。

---

### P1-KR-05 | ai-chat/index.js (未commit) — RAG关键词回退拉全量

**文件**: `cloudfunctions/ai-chat/index.js` L213-218  
多关键词正则预筛失败时回退到 `fetchBatch(ddb, where, fetchLimit)` — 可能拉取全量chunk（无关键词过滤）。在知识库大的情况下性能差。

**建议**: 回退时至少保留单关键词降级而非完全裸拉。

---

## P2 — 可选优化 (4项)

### P2-KR-01 | gate-sheet.wxss — CSS压缩为单行

**文件**: `components/gate-sheet/gate-sheet.wxss` (109→13行)  
格式压缩为单行CSS降低可维护性。虽功能等价但调试困难。

### P2-KR-02 | verify.sh 19项失败

**文件**: `scripts/verify.sh`  
A6页面注册不一致（31个页面文件路径变更）、A8 PII扫描（39文件命中）、A9路径覆盖为0。大部分为历史遗留，但新commit未恶化。

### P2-KR-03 | **active_process_id** 写入格式不一致

三个入口写入不同格式：

- `process/index`: `processLine.id` (UUID格式)
- `floating-ai`: `'ai_select_' + Date.now()` (时间戳前缀)
- `assessment-result`: `processLine.id` (UUID格式, 通过 `constants.STORAGE_KEYS.ACTIVE_PROCESS_ID`)

建议统一格式或文档化差异。

### P2-KR-04 | floating-ai: var→const 声明风格不一致

`decisionGate` 从 `var` 改为 `const`，但同文件其他 require 仍用 `var`。

---

## 未commit工作区审查 (5文件)

| 文件                                        | 状态         | 风险                | 建议                              |
| ------------------------------------------- | ------------ | ------------------- | --------------------------------- |
| `cloudfunctions/ai-chat/context-builder.js` | SDK迁移      | **P0** (见P0-KR-03) | 验证ENV_ID配置或回退wx-server-sdk |
| `cloudfunctions/ai-chat/index.js`           | 功能新增     | **P0** (见P0-KR-04) | 修复安全正则+独立审查             |
| `subpkg-chat/pages/chat/index.js`           | ai-chat修复  | 已commit内          | 与commit一致                      |
| `subpkg-chat/pages/chat/index.wxss`         | 代码样式新增 | 低风险              | 代码块CSS对齐rich-text            |
| `ledger.jsonl`                              | 9gate记录    | 无风险              | 手动审计条目                      |

---

## 测试结果

```
Test Suites: 15 passed, 15 total
Tests:       4 todo, 380 passed, 384 total
Time:        2.261s
```

- 零回归、零失败
- 4个todo为预先标记的待实现用例
- 97/97 ai-chat相关测试通过

---

## 总结

| 等级 | 数量 | 关键项                                          |
| ---- | ---- | ----------------------------------------------- |
| P0   | 4    | 闸门白名单、登录数据丢失、SDK迁移、安全误拦截   |
| P1   | 5    | 文档丢失、测试退化、死变量、占位符冲突、RAG回退 |
| P2   | 4    | CSS压缩、verify失败、ID格式不一、声明风格       |

**Gate判定**: ⚠️ CONDITIONAL PASS — P0-KR-01/P0-KR-02 必须在合并前修复。未commit的 ai-chat 变更建议独立PR审查。
