# 编码规范强制执行规则

## 规范文档

项目根目录 `住港伴_编码规范_v1.0.md`（713 行，基于 37 项 Bug 修复 + 130 文件审查归纳）

## 触发条件

任何代码变更（新建/修改/删除文件）时自动应用以下约束。

## 硬约束（违规 = P0 阻断）

1. **异步超时** — 所有云函数调用/网络请求必须有超时保护（最长 60s）
2. **状态双写** — 影响多页面的全局状态变更必须同时写 globalData + Storage
3. **Session 格式** — `__session__` 统一为 `{ token, profile }` 对象格式
4. **术语合规** — 源码禁止出现"投资移民""移民顾问""移民香港"
5. **XSS 防护** — AI 生成内容必须经 `_escapeHTML()` 转义
6. **wx.cloud.init()** — 必须在 app.js onLaunch 首行调用
7. **禁止硬编码** — openid/envId/token/API key 禁止写死在源码中
8. **禁止 Math.random()** — 安全随机数必须用 `wx.getRandomValues()`
9. **空 catch 禁止** — 所有 try-catch 必须有 console.warn/error
10. **WXML 配对** — 标签必须严格结对，禁止多余闭合标签

## verify.sh 检查项速查

| ID | 检查项 | 违规后果 |
|----|--------|----------|
| A1 | startsWith 替代 includes 做前缀匹配 | P1 |
| A2 | 无双重 wx:for 同元素 | P1 |
| A3 | guidebook-data.js 无敏感词 | P0 |
| A4 | prompts.js 含 K2_SAFETY_RULES | P0 |
| A6 | app.json 页面注册与文件一致 | P1 |
| A8 | 核心代码无硬编码 PII | P0 |
| A9 | PATH_TAGS 覆盖 ≥12 条路径 | P0 |

## Gate 4 麒麟 Code Review 重点

代码审查时对照 `住港伴_编码规范_v1.0.md` 的 10 章逐条检查。
