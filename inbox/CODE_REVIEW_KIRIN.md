# 麒麟 Code Review — 住港伴V4 发版前审查 (Gate 4)

> 审查日期: 2026-05-28 | 审查范围: 6已修改云函数 + 2新增云函数 + admin-dashboard前端 + app.js + pages/reminders + subpkg-chat/pages/redeem
> 审查模型: deepseek-v4-pro | 审查结论: **待修复P0后发版**

---

## 审查摘要

| 级别 | 数量 | 描述 |
|------|------|------|
| P0 (阻断) | 7 | 必须修复才能发版 |
| P1 (高危) | 8 | 强烈建议修复 |
| P2 (建议) | 6 | 改进建议 |

---

## P0 — 阻断级（必须修复）

### P0-01: diagnose-user 硬编码 envId 和认证令牌
**文件**: `cloudfunctions/diagnose-user/index.js`
**行号**: L3, L15
**问题**:
```javascript
// L3: 硬编码环境ID
const app = cloudbase.init({ env: 'cloudbase-d1g17tgt7cc199a60' });

// L15: 硬编码明文令牌
if (token !== 'diagnose-zgb-20260528') {
  return { code: 401, msg: '无效令牌' };
}
```
**风险**: 环境ID和诊断令牌直接写入源码。任何有源码访问权限的人都能获取诊断令牌，直接调用此云函数获取任意用户的全量数据（user_profiles + users + 模糊搜索）。
**修复**: 
1. envId 改为 `process.env.ENV_ID` 或 `cloudbase.SYMBOL_CURRENT_ENV`
2. 令牌改为从环境变量 `DIAGNOSE_TOKEN` 读取，且正式环境必须使用 `crypto.timingSafeEqual()` 做常量时间比较防止时序攻击
3. 此函数为临时诊断工具，**发版前务必从生产环境删除**

### P0-02: user-auth 硬编码 phoneHash 盐值
**文件**: `cloudfunctions/user-auth/index.js`
**行号**: L164
**问题**:
```javascript
const phoneHash = crypto
  .createHmac('sha256', 'zgbinternal-phone-salt')
  .update(phoneNumber)
  .digest('hex');
```
**风险**: 手机号哈希盐值 `zgbinternal-phone-salt` 硬编码在源码中。攻击者获得源码后可对所有手机号做彩虹表攻击，反推用户手机号。该盐值同时被用于账号合并逻辑（L172-286），泄露后可直接伪造跨账号合并。
**修复**: 改为 `process.env.PHONE_SALT` 环境变量，在 CloudBase 控制台配置。同时提供合理的降级策略（如使用 TCB_ENV 作为部分盐值）。

### P0-03: user-auth 硬编码遗留密钥 `zhgb-internal-key`
**文件**: `cloudfunctions/user-auth/index.js`
**行号**: L477
**问题**:
```javascript
const legacyKey = 'zhgb-internal-key';
```
**风险**: 即使此密钥仅用于"验证旧token不签发新token"，但其硬编码意味着任何获得源码者都能伪造旧格式token通过验证。根据编码规范 §1.3 安全红线和 §5.1 禁止硬编码规则，此为红线违规。
**修复**: 同样改为环境变量 `LEGACY_TOKEN_KEY`，或在旧token全部过期（约30天）后删除此向下兼容逻辑。

### P0-04: CFErrorsPage 硬编码 CloudBase 域名
**文件**: `admin-dashboard/src/pages/CFErrorsPage.tsx`
**行号**: L52
**问题**:
```typescript
const resp = await fetch(
  'https://cloudbase-d1g17tgt7cc199a60.service.tcloudbase.com/cf-alert/status'
);
```
**风险**: 环境域名 `cloudbase-d1g17tgt7cc199a60` 硬编码在前端源码中。这暴露了 CloudBase 环境ID，可被用于构造未授权请求（如直接访问云函数/数据库HTTP API）。前端 bundle 是公开可访问的，任何人打开浏览器 DevTools 即可获取。
**修复**: 改为环境变量 `VITE_CLOUDBASE_ENV_ID`（Vite 构建时注入）或从后端 API 动态获取域名。参考 admin-dashboard 其他页面如何获取 CloudBase 配置。

### P0-05: content-moderation 降级模式为 fail-open（审核绕过风险）
**文件**: `cloudfunctions/content-moderation/index.js`
**行号**: L112-124, L139-151
**问题**:
```javascript
// 熔断器: 连续5次失败后，后续60秒内全部返回 Pass
if (degradeCount >= degradeThreshold) {
  return {
    code: 0,
    data: {
      suggestion: 'Pass',  // ← 降级时放行所有内容
      label: 'Normal',
      ...
      degraded: true,
    },
  };
}
```
**风险**: 当 TMS API 连续5次调用失败后，熔断器在60秒窗口内对**所有内容**返回 `suggestion: 'Pass'`。虽然 feedback-submit 正确检查了 `degraded` 字段并拦截（feedback-submit L23-26），但如果其他调用方（现有或未来）只检查 `code===0` 或 `suggestion==='Pass'` 而不检查 `degraded`，将完全绕过内容审核。这是 fail-open 设计，违反安全侧兜底原则。
**修复**: 
1. 降级模式应返回 `suggestion: 'Block'` 或至少 `suggestion: 'Review'`（fail-closed），而非 `'Pass'`
2. 在代码注释中显式标注"本函数降级返回 Pass 但调用方必须检查 degraded 字段"
3. 考虑在函数入口增加全局开关，允许运维手动切换到 fail-closed 模式

### P0-06: ai-chat 使用 Math.random() 生成 traceId 和 A/B 分流
**文件**: `cloudfunctions/ai-chat/index.js`
**行号**: L1018, L663, L1280
**问题**:
```javascript
// L1018: Math.random() 生成 traceId
const traceId = 'trace_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

// L663: Math.random() 用于 A/B 模型分流
if (abRatio > 0 && Math.random() * 100 < abRatio) { ... }

// L1280: Math.random() 生成 messageId
messageId: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
```
**风险**: 编码规范 §5.1 明确禁止 `Math.random()` 用于安全逻辑。虽然 traceId 和 messageId 非安全关键，但编码规范作为项目级铁律要求零容忍。A/B 模型分流用 `Math.random()` 可能导致分流不均或可被预测。
**修复**: 替换为 `crypto.randomBytes()` 或 `require('crypto').randomUUID()`。A/B 分流用 `crypto.randomInt(100)`。

### P0-07: AI生成内容缺少 _escapeHTML() 转义 (XSS风险)
**文件**: `cloudfunctions/ai-chat/index.js`
**行号**: L1281（返回 content 到前端）, 流式响应 L1489
**问题**:
AI生成的 `content` 直接返回给前端（L1281 `data.content`），未经过 `_escapeHTML()` 转义。编码规范 §5.1 明确规定"AI 生成内容必须经过 _escapeHTML() 做 XSS 防护"。虽然小程序环境对 XSS 有天然防护，但：
1. AI 返回内容可能包含 HTML/JS 片段，渲染到富文本或 WebView 时有 XSS 风险
2. 流式响应（SSE）的 content 同样未转义（L1489-1492）
3. 对话日志中的 `response_preview`（L888）存储原始未转义内容
**修复**: 在 `respond()` 函数中对 content 做 `_escapeHTML()` 处理，或在 `stripQuickRepliesBlock()` 后对 `cleanedContent` 统一转义。

---

## P1 — 高危（强烈建议修复）

### P1-01: payment 硬编码 WXPAY_APPID 兜底值
**文件**: `cloudfunctions/payment/index.js`
**行号**: L32
**问题**:
```javascript
appid: process.env.WXPAY_APPID || 'wx08c2222c1bf042fd', // KEEP-INTENTIONAL
```
**风险**: 代码注释标注 "KEEP-INTENTIONAL: 5.22 rescue"，但始终存在 APPID 硬编码。如果环境变量未配置，将使用此硬编码值发起微信支付——如果该 APPID 不属于本小程序，支付将失败但不会报明显错误。
**修复**: 移除兜底值，改为启动时校验：如果 `WXPAY_APPID` 未配置则直接拒绝支付请求并返回明确错误。

### P1-02: diagnose-user 可被远程调用获取任意用户数据
**文件**: `cloudfunctions/diagnose-user/index.js`
**行号**: L15-57
**问题**:
即使是临时诊断工具，只要知道令牌 `diagnose-zgb-20260528`，任何人都可以：
1. 通过 `userId` 参数查询任意用户的全量 user_profiles 和 users 数据
2. 通过模糊搜索 `ZGB` 获取包含 ZGB 前缀的所有用户记录（L51-54）
```javascript
const targetId = userId || 'ZGB-6B93C3C3'; // 默认查询特定用户
```
**风险**: 数据库中的 phoneHash、nickName、selectedPath、membershipLevel 等敏感字段全部暴露。且模糊搜索可以批量获取用户数据。
**修复**: 发版前从生产环境删除此云函数。如需要保留，至少限制为只能从 CloudBase 控制台调用（检查 `context.requestSource`）。

### P1-03: feedback-submit 使用 Math.random() 生成工单号
**文件**: `cloudfunctions/feedback-submit/index.js`
**行号**: L80-81
**问题**:
```javascript
const seq = String(Math.floor(Math.random() * 9000) + 1000);
return 'FB-' + y + m + d + '-' + seq;
```
**风险**: 工单号在每日范围内仅 9000 种可能，可预测。虽然工单号本身非安全令牌，但可预测的序列号存在枚举风险（攻击者可通过 ticketId 尝试遍历工单）。
**修复**: 使用 `crypto.randomInt(1000, 10000)` 或加时间戳毫秒位增加随机性：`FB-${y}${m}${d}-${Date.now() % 100000}`。

### P1-04: app.js 中 checkAndRestoreFromCloud 存在竞态条件
**文件**: `app.js`
**行号**: L281-323
**问题**:
`checkAndRestoreFromCloud()` 在 `onLaunch` 中异步调用（L174），但 `syncDataToCloud()` 也在同一生命周期中调用（L175），两者无明确的执行顺序保证。如果 `syncDataToCloud` 在 `checkAndRestoreFromCloud` 之前完成，可能触发不必要的数据覆盖。
**修复**: 使用 `await checkAndRestoreFromCloud()` 确保先恢复再同步。

### P1-05: pages/reminders 缺少空值保护和 try/catch
**文件**: `pages/reminders/index/index.js`
**行号**: L86 (checkMilestoneReminders)
**问题**:
```javascript
const events = wx.getStorageSync('__milestone_events__') || [];
```
如果 `wx.getStorageSync` 返回损坏数据（非数组），后续 `events.filter()` 会抛出异常并阻断整个 reminders 页面加载。类似问题存在于多处 Storage 读取。
**修复**: 所有 Storage 读取包裹类型校验：
```javascript
let events = [];
try { const raw = wx.getStorageSync('__milestone_events__'); events = Array.isArray(raw) ? raw : []; } catch(e) {}
```

### P1-06: ai-chat 空 catch 块违反编码规范
**文件**: `cloudfunctions/ai-chat/index.js`
**行号**: L833 (parseAssessmentJSON catch), L1440 (stream SSE catch), 多处 `.catch(() => {})`
**问题**: 编码规范 §5.1 第1条明确"禁止空 catch 块"。ai-chat 中有多处空 catch，虽然有注释说明意图，但规范要求至少应记录日志。
**修复**: 空 catch 改为至少 `console.warn('...', e.message)` 或 `console.debug`。

### P1-07: redeem 页面缺少输入长度限制和服务端校验
**文件**: `subpkg-chat/pages/redeem/index.js`
**行号**: L26-38
**问题**:
兑换码输入仅在前端做格式校验 `ZGB-[A-Z0-9]{4}-[A-Z0-9]{4}`，虽然有云函数端进一步校验，但设备标识 `deviceId`（L95）:
```javascript
const deviceId = sysInfo.model + '_' + sysInfo.system;
```
此设备标识仅是设备型号+系统版本，同一型号设备会碰撞，不能作为防刷凭证。
**修复**: 云函数 invite-code 端应增加频率限制（同用户/同IP/同设备型号的兑换频率），并记录兑换设备指纹用于风控。

### P1-08: pages/reminders 路径映射包含敏感词
**文件**: `pages/reminders/index/index.js`
**行号**: L257
**问题**:
```javascript
cies: 'CIES投资类身份规划',
```
编码规范 §5.1 规定禁用"投资移民"等敏感词。路径映射中 `cies: 'CIES投资类身份规划'` 包含"投资"一词，用户可见的路径名称中出现。根据术语合规规范，应使用替换表述。
**修复**: 改为 `cies: 'CIES资本投资者入境计划'` 或 `cies: 'CIES入境计划'`（使用官方表述）。

---

## P2 — 建议改进

### P2-01: diagnose-user 错误处理后仍继续执行后续查询
**文件**: `cloudfunctions/diagnose-user/index.js`
**行号**: L22-56
**问题**: 每个数据库查询独立 try/catch，失败后仅记录 err 字段，不阻塞后续查询。这导致部分查询失败时仍返回不完整的结果，调用方无法区分"数据不存在"和"查询失败"。
**建议**: 在返回结果中增加 `queryErrors` 数组汇总所有失败的查询。

### P2-02: cf-alert 缺少认证机制
**文件**: `cloudfunctions/cf-alert/index.js`
**行号**: L22-55
**问题**: `/status` 和 `/config` 端点无任何认证。任何人知道 URL 即可查看所有云函数错误统计和企微 Webhook 配置状态（包括 key 脱敏后的 URL 格式）。`/send` 端点虽然需要 body 参数，但同样无认证。
**建议**: 增加简单的 API Key 认证或至少限制为内网/白名单 IP。

### P2-03: ai-chat RAG 缓存使用内存存储，实例重启后丢失
**文件**: `cloudfunctions/ai-chat/index.js`
**行号**: L131 (ragCache), L331 (EMBEDDING_CACHE)
**问题**: RAG 缓存和 Embedding 缓存都使用模块级 JavaScript 对象（内存），云函数实例回收后缓存丢失，无持久化。高并发时不同实例也无法共享缓存。
**建议**: 考虑使用 CloudBase 数据库做缓存持久化（当前已有 `checkCache` 在 content-moderation 中的实现可参考）。

### P2-04: admin-dashboard 前端缺少请求超时和重试
**文件**: `admin-dashboard/src/pages/CFErrorsPage.tsx`
**行号**: L51-53
**问题**: `fetch()` 无超时设置。如果 cf-alert 服务不可达，浏览器默认超时可能长达数分钟。
**建议**: 使用 `AbortController` 设置 10 秒超时：
```typescript
const controller = new AbortController();
setTimeout(() => controller.abort(), 10000);
const resp = await fetch(url, { signal: controller.signal });
```

### P2-05: feedback-submit 中 `generateTicketId()` 日期使用客户端时间
**文件**: `cloudfunctions/feedback-submit/index.js`
**行号**: L75-82
**问题**: 使用 `new Date()` 获取云函数实例本地时间，在时区配置错误时可能生成错误日期的工单号。
**建议**: 无明显安全影响，但建议使用 `db.serverDate()` 或在工单号生成后验证日期是否合理。

### P2-06: app.js onLaunch 中多个异步操作无统一错误边界
**文件**: `app.js`
**行号**: L109-177
**问题**: `onLaunch` 中串联多个异步操作（initStorage, initCrypto, loadRules, loadSession, checkAndRestoreFromCloud, syncDataToCloud），但各步骤的失败处理不统一。如果 `initCrypto` 失败，后续依赖加密的操作仍会继续。
**建议**: 关键初始化步骤失败时应设置全局降级标志，后续功能据此判断是否降级运行。

---

## 审计检查清单

| 检查项 | 结果 | 说明 |
|--------|------|------|
| 密钥硬编码 | ❌ FAIL | P0-01/02/03/04 共4处硬编码 |
| SQL/NoSQL 注入 | ✅ PASS | 使用 SDK 参数化查询，无字符串拼接 |
| 越权访问 | ⚠️ WARN | P1-02 diagnose-user 可查任意用户 |
| 空值处理 | ⚠️ WARN | P1-05 reminders 缺少 Storage 类型校验 |
| 字段一致性 | ✅ PASS | pullAll 白名单与 normalize 函数对齐 |
| moderateText 审核绕过 | ⚠️ WARN | P0-05 降级模式 fail-open |
| 敏感词合规 | ⚠️ WARN | P1-08 CIES 路径名含"投资" |
| _escapeHTML() | ❌ FAIL | P0-07 AI生成内容未转义 |
| Math.random() | ❌ FAIL | P0-06 ai-chat多处使用 |
| 空catch块 | ⚠️ WARN | P1-06 ai-chat多处空catch |

---

## 已知假阳性确认

| 规则 | 文件 | 说明 |
|------|------|------|
| R8.8 TENCENT_SECRET_ID | ai-chat/index.js L320 | SECRET_ID 从环境变量读取，白名单缺失是预期行为 |
| "投资移民"误报 | domain-router.js | CIES词典中"投资移民"为上下文判断词，非直接输出 |

---

## 发版决策

**当前不建议发版。** P0-01/02/03/04/05/06/07 共 7 项阻断问题必须修复。其中：
- P0-01 (diagnose-user): **必须从生产环境删除**
- P0-02/03 (硬编码密钥): 需在 CloudBase 控制台新增环境变量
- P0-04 (域名暴露): 需修改前端构建配置
- P0-05 (审核降级): 需修改降级策略
- P0-07 (XSS): 需增加转义处理

预计修复时间: 2-3 小时（含环境变量配置 + 部署验证）。

---

*审查模型: deepseek-v4-pro | 审查者: 麒麟 (Gate 4)*
*关联文档: 住港伴V4_编码规范_v1.0.md, AGENTS.md, CLAUDE.md*
