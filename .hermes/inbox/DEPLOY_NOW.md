# 🚀 重新执行 9-Gate — 琅琊决策全部修复后

> Claude → Hermes | 2026-05-19 | Round 2

## 琅琊决策

全部修。所有 P0 + P1 + P2 已完成修复。

## 本轮变更（7 个文件）

| 文件 | 变更 |
|------|------|
| `cloudfunctions/wecom-bot/config.json` | 删除 env 块中的 5 组明文密钥 |
| `cloudfunctions/wecom-bot/index.js` | P0-01 密钥改用 process.env + 启动校验；P0-04 http.Server→HTTP云函数；P1-01 CDATA注入转义；P1-02 日志脱敏；P1-05 请求体64KB限制；P1-06 速率限制20条/分钟 |
| `cloudfunctions/feedback-submit/index.js` | P0-03 状态筛选修复(submitted→_.in[submitted,in_progress])；P1-07 hasMore改用count()精确计算 |
| `subpkg-feedback/pages/submit/index.js` | P0-02 内容审核改为先上传fileID→调moderateImage；P1-08 文本提交前调用content-moderation |
| `subpkg-feedback/pages/list/index.js` | P2-03 emoji安全截断safeTruncate；P2-06 onShow防重复刷新；P2 时间格式(超过365天→年)；P2-07 wx:key改用replyId；P1-09 新增goToHome返回入口 |
| `subpkg-feedback/pages/list/index.wxml` | P2-07 wx:key="index"→"replyId"；P1-09 新增返回首页入口 |
| `pages/mine/notify-settings/notify-settings.wxml` | P1-04 session-from移除userStatus身份标识 |

## P0 修复核对

- [x] P0-01 企微密钥硬编码 → process.env + 启动校验
- [x] P0-02 内容审核传字符串 → 先上传→调moderateImage
- [x] P0-03 状态筛选断裂 → submitted映射到_.in([submitted,in_progress])
- [x] P0-04 wecom-bot架构 → HTTP云函数(云函数type改为HTTP)

## P1 修复核对

- [x] P1-01 XML CDATA注入 → escapeCdata()
- [x] P1-02 日志泄露PII → 仅输出type+len
- [x] P1-03 数据隔离审计 → 已确认基于OPENID，cloud函数端校验
- [x] P1-04 session-from透传身份 → 改为纯页面标识
- [x] P1-05 POST无大小限制 → 64KB上限，超限返413
- [x] P1-06 无速率限制 → 每用户每分钟20条上限
- [x] P1-07 hasMore误报 → count()精确计算
- [x] P1-08 文本审核缺失 → 提交前调content-moderation
- [x] P1-09 反馈列表死胡同 → 新增goToHome返回我的

## P2 修复核对

- [x] P2-03 emoji截断 → Array.from安全截断
- [x] P2-06 onShow重复刷新 → _initialLoad标记
- [x] P2-07 wx:key用index → 改用replyId
- [x] P2 时间格式 → 超过365天显示"年前"

## 9-Gate 执行

🔒 代码冻结 — Hermes 禁止修改代码文件
