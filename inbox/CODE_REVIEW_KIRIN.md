# 麒麟代码审查报告 — 住港伴 V3

**审查对象**: commit `6d9204f` (企业微信bot + 反馈子包 + mine页面更新)  
**审查者**: 麒麟 (via Hermes delegate_task)  
**审查时间**: 2026-05-19  
**变更规模**: 23 files, +1126/-2

---

## 🔴 P0 — 阻断 (必须立即修复)

### P0-1: 企业微信全部密钥硬编码入库

- **文件**: `cloudfunctions/wecom-bot/config.json` L6-L10
- **文件**: `cloudfunctions/wecom-bot/index.js` L21-L25
- **问题**: 5组真实企业微信密钥明文提交到 Git 仓库:
  - `WECOM_CORP_ID`: `ww6dd588ba1ed37cd0`
  - `WECOM_TOKEN`: `vdNbgJJVfxd7H4YlwzpnPz5B`
  - `WECOM_ENCODING_AES_KEY`: `Mp1D2ErPUkR4KYbfksr8coB2HEzimUieKTGJcREgXza`
  - `WECOM_AGENT_SECRET`: `Vda6DjM2U2TPjezaUUVxjANPvNyu07Rr4wsIbhC-2Fo`
  - `WECOM_AGENT_ID`: `1000002`
- **影响**: 任何能访问仓库的人均可获取企业微信完整控制权。一旦 push，即使后续删除，密钥仍可通过 git history 找回。
- **修复**:
  1. 立即在企业微信管理后台轮换全部密钥
  2. 删除 `config.json` 中的 `env` 字段和 `index.js` 中的 fallback 默认值
  3. 通过 CloudBase 控制台或 `manageFunctions` MCP 工具设置环境变量
  4. 使用 `git filter-branch` 或 `BFG Repo-Cleaner` 清除历史
  5. 在 `.gitignore` 中加入 `cloudfunctions/*/config.json` 或将其 env 字段排除

---

## 🟡 P1 — 重要 (发版前修复)

### P1-1: XML CDATA 注入风险
- **文件**: `cloudfunctions/wecom-bot/index.js` L254-L261
- **问题**: `buildTextReplyXml()` 直接将 `fromUser`/`toUser`/`content` 拼接入 CDATA。若含 `]]>` 序列将提前闭合 CDATA。
- **修复**: 拼接前做 CDATA 转义: 将 `]]>` 替换为 `]]]]><![CDATA[>`

### P1-2: 日志泄露用户消息内容
- **文件**: `cloudfunctions/wecom-bot/index.js` L121
- **问题**: `console.log` 输出完整用户消息，可能含姓名/证件号/手机号。
- **修复**: 日志仅记录消息类型和长度，或脱敏(仅保留前10字符)

### P1-3: 反馈列表数据隔离依赖云函数侧校验
- **文件**: `subpkg-feedback/pages/list/index.js` L47-L53
- **问题**: `loadList()` 调用时不传用户标识，完全依赖云函数从 `wxContext.OPENID` 提取身份。
- **修复**: 审计 `feedback-submit` 的 `list`/`detail` action，确保基于 OPENID 过滤; 数据库安全规则设置 `_openid` 匹配

### P1-4: 客服入口 session-from 透传用户状态
- **文件**: `pages/mine/notify-settings/notify-settings.wxml` L119
- **问题**: `session-from` 包含 `userStatus`(身份状态如"已永居"/"持签")，属敏感信息。
- **修复**: 仅传页面标识和技术状态，不传用户身份标签

### P1-5: POST 请求体无大小限制
- **文件**: `cloudfunctions/wecom-bot/index.js` L85-L86
- **问题**: `req.on('data')` 无 Content-Length 检查，超大 payload 可 OOM。
- **修复**: 检查 `req.headers['content-length']`，超过 64KB 返回 413

### P1-6: 消息端点无速率限制
- **文件**: `cloudfunctions/wecom-bot/index.js` L84-L155
- **问题**: 无请求频率限制，恶意用户可高频刷消息耗尽资源。
- **修复**: 基于 `fromUser` 实现令牌桶或滑动窗口限流(每用户每分钟最多20条)

---

## 🟢 P2 — 建议 (后续迭代)

### P2-1: HTTP stream error 事件未处理
- **文件**: `cloudfunctions/wecom-bot/index.js` L86
- **问题**: 未注册 `req.on('error')`，请求流中断时异常未捕获
- **修复**: 添加 error 监听器

### P2-2: 正则表达式理论 ReDoS 风险
- **文件**: `cloudfunctions/wecom-bot/index.js` L246, L249
- **问题**: `extractXmlField` 使用 `[\s\S]*?` 惰性匹配，极端恶意 XML 下可能灾难性回溯
- **修复**: 使用更严格字符类或 SAX 风格解析器

### P2-3: 内容截断可能破坏 emoji/多字节字符
- **文件**: `subpkg-feedback/pages/list/index.js` L90, L98
- **问题**: `substring(0,50)` 按 UTF-16 code unit 截断，emoji 可能被切断
- **修复**: 使用 `Array.from(item.content).slice(0,50).join('')` 按完整码点截断

### P2-4: 硬编码云存储 fileID
- **文件**: `subpkg-feedback/pages/wecom-qr/index.js` L20
- **问题**: `cloud://feedback-assets/wecom-customer-service-qr.png` 硬编码
- **修复**: 从云函数配置动态获取

### P2-5: wecom-qr.png 二进制文件入库
- **文件**: `wecom-qr.png` (908 bytes)
- **问题**: 二维码图片提交到 Git，变更需要新 commit
- **修复**: 从仓库移除，从云存储动态加载

### P2-6: onShow 每次触发全量列表刷新
- **文件**: `subpkg-feedback/pages/list/index.js` L30-L32
- **问题**: 每次返回都调 `loadList()`，不必要的网络请求
- **修复**: 增加 `_initialLoad` 标记，返回时用页面栈局部更新

### P2-7: WXML 使用 `wx:key="index"` 而非唯一标识
- **文件**: `subpkg-feedback/pages/list/index.wxml` L69
- **问题**: 数组索引作 key，顺序变化时渲染错位
- **修复**: 云函数返回 `replyId`，改用 `wx:key="replyId"`

---

## 汇总

| 级别 | 数量 | 关键项 |
|:----:|:----:|--------|
| P0 | 1 | 密钥硬编码 (5组企微密钥泄露) |
| P1 | 6 | XML注入/日志PII/数据隔离/session透传/请求体无限制/无速率限制 |
| P2 | 7 | 错误处理/ReDoS/emoji截断/硬编码/二进制入库/重复加载/列表key |

**结论**: P0-1 必须立即阻断。P1 项建议发版前全部修复。代码架构合理，数据隔离逻辑正确(依赖云函数 OPENID)，但企微 bot 安全工程成熟度需提升。
