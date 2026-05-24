# DEPLOY_QR_BAREFIX — quick_replies 裸格式三层防御部署

## 概述

修复 LLM 忽略 ` ```quick_replies ` 围栏指令，直接输出裸 `quick_replies[...]` JSON 导致代码泄漏到聊天 UI 的问题。

三层防御使用 **同一正则** `quick_replies\s*(\[[\s\S]*?\])`，分别在不同阶段拦截：

```
LLM 输出
  │
  ▼
┌─ 层1: 流式 bracket depth 状态机 ─────┐
│ 检测 quick_replies[ 且 JSON 未闭合   │
│ → 停止转发到 SSE stream              │
└──────────────────────────────────────┘
  │
  ▼
┌─ 层2: stripQuickRepliesBlock() ──────┐
│ 代码块 /quick_replies\s*(\[[\s\S]*?\])/g │
│ → 提取 JSON → data.quickReplies      │
│ → 从 content 移除                     │
└──────────────────────────────────────┘
  │
  ▼
┌─ 层3: _stripQuickRepliesFromContent() ┐
│ .replace(/quick_replies\s*\[[\s\S]*?\]/g, '') │
│ → 前端兜底清理                        │
└──────────────────────────────────────┘
  │
  ▼
  用户 UI（干净内容 + 快捷回复按钮）
```

## 变更文件

| 文件 | 层 | 变更 |
|------|-----|------|
| `cloudfunctions/ai-chat/index.js` | 层1+2 | 流式 bracket depth 拦截 (L1398-1426) + stripQuickRepliesBlock() (L1526-1588) |
| `subpkg-chat/pages/chat/index.js` | 层3 | _stripQuickRepliesFromContent() (L542-551) |

## 正则一致性验证

```
层1 状态机:     quick_replies[  → bracket depth 计数 → depth==0 闭合判断
层2 提取:       /quick_replies\s*(\[[\s\S]*?\])/g  → JSON.parse → data.quickReplies
层2 移除:       .replace(/quick_replies\s*(\[[\s\S]*?\])\s*$/gm, '')
                .replace(/quick_replies\s*(\[[\s\S]*?\])(\n|$)/g, '')
层3 兜底:       .replace(/quick_replies\s*\[[\s\S]*?\]/g, '')
```

**结论：三层正则完全一致，仅使用场景不同（提取 vs 移除）。**

## 测试覆盖

```
__tests__/ai-chat.test.js             → L405-406: content 不含 ```quick_replies
__tests__/ai-chat-risk-assessment.test.js  → R10.4: quickReplies 结构校验
__tests__/ai-chat-utility.test.js         → L369: data.quickReplies 字段存在性
```

## Hermes 部署指令

### 触发条件
Hermes 收到本文件路径 → 自动执行 9-Gate 部署 ai-chat 云函数。

### 部署范围
仅 `cloudfunctions/ai-chat/`（云函数），前端代码已在小程序端。

### 9-Gate 执行路径

```
┌──────────────────────────────────────────────────────────────┐
│ Gate 0    git status --short                                  │
│ Gate 1    bash scripts/verify.sh                              │
│ Gate 1b   bash scripts/workflow-verify.sh                     │
│ Gate 2    npx jest --forceExit                                │
│ Gate 3    DevTools auto-preview (编译)                         │
│ Gate 4    麒麟 Code Review (delegate_task)                     │
│ Gate 5    玄武 PM Review (delegate_task)                       │
│ Gate 6    mcp_cloudbase manageFunctions updateFunctionCode     │
│           → functionRootPath: cloudfunctions/                 │
│           → functionName: ai-chat                             │
│ Gate 6b   mcp_cloudbase queryFunctions invokeFunction          │
│           → functionName: ai-chat                             │
│           → params: {"chatMode":"chat","query":"香港优才"}     │
│           → 验证: res.data.content 不含 quick_replies          │
│ Gate 7    git log origin/main 确认 HEAD = origin/main         │
│ Gate 8    ledger.jsonl 追加 GATE_PASSED                       │
│ Gate 9    ACL 3报告 + pre-push 7/7 + sync                     │
└──────────────────────────────────────────────────────────────┘
```

### Gate 6 具体参数

```javascript
// Step 1: 更新 ai-chat 云函数代码
mcp_cloudbase_manageFunctions({
  action: "updateFunctionCode",
  functionRootPath: "/Users/chillment/Downloads/港动人生/住港伴V4-2026-5-21发版/cloudfunctions",
  functionName: "ai-chat"
})

// Step 2: 冒烟验证 (Gate 6b)
mcp_cloudbase_queryFunctions({
  action: "invokeFunction",
  functionName: "ai-chat",
  params: {
    query: "香港优才计划申请条件",
    chatMode: "chat",
    sessionId: "qr-barefix-smoke-" + Date.now()
  }
})

// 验证标准:
// ✅ res.data.content 不含 "quick_replies[" 字符串
// ✅ res.data.quickReplies 为数组（可为空）
// ✅ ErrMsg 为空
```

### Gate 6b 快速验证脚本

```bash
# 冒烟: 验证 quick_replies 不泄漏到 content
curl -s -X POST "https://${ENV}.service.tcloudbase.com/ai-chat" \
  -H "Content-Type: application/json" \
  -d '{"query":"香港优才申请条件","chatMode":"chat"}' \
  | jq '.data.content | test("quick_replies\\\\[")' \
  | grep -q "false" && echo "PASS: 裸格式未泄漏" || echo "FAIL: 裸格式泄漏"
```

## 关键设计决策

1. **三层而非一层** — LLM 行为不可控（代码块/无代码块/流式中途输出），单层防御有盲区
2. **流式层 bracket depth 状态机** — 不在流式阶段做正则（性能），只做深度计数
3. **非流式层双路径** — 先代码块正则 → 后裸格式正则（回退），防止遗漏
4. **前端兜底** — 即使云函数两层都漏，前端最后一次 replace 兜底
5. **正则一致性** — 三层使用同一正则表达式，确保行为可预测

## 回滚方案

若部署后异常：
```bash
cd /Users/chillment/Downloads/港动人生/住港伴V4-2026-5-21发版
git revert HEAD --no-edit
# 重新走 9-Gate 部署回退版本
```

## 版本

| 字段 | 值 |
|------|-----|
| 文档版本 | v1.0 |
| 修复版本 | V4.1-PHASE2 |
| 创建日期 | 2026-05-22 |
| 关联 branch | main |
| 触发标识 | DEPLOY_QR_BAREFIX |
