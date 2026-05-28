# 云函数错误监控告警体系 — 部署配置指南

## 概述

为住港伴V4所有关键云函数建立了统一错误监控告警体系：

- **错误日志**: 异常自动写入 CloudBase `cf_error_logs` 集合（30天自动过期）
- **企微告警**: 实时推送至企业微信群机器人（60秒冷却，防风暴）
- **运营后台**: `/admin/cf-errors` 页面展示24h健康状态（30秒自动刷新）

## 文件变更清单

### 新增文件
| 文件 | 说明 |
|------|------|
| `cloudfunctions/_shared/error-reporter.js` | 共享错误上报模块（参考） |
| `cloudfunctions/cf-alert/index.js` | HTTP云函数：错误查询+告警触发 |
| `cloudfunctions/cf-alert/package.json` | cf-alert 依赖配置 |
| `cloudfunctions/invite-code/_cf-error.js` | 自包含错误上报模块 |
| `cloudfunctions/user-auth/_cf-error.js` | 同上 |
| `cloudfunctions/payment/_cf-error.js` | 同上 |
| `cloudfunctions/feedback-submit/_cf-error.js` | 同上 |
| `admin-dashboard/src/pages/CFErrorsPage.tsx` | 运营后台错误监控页面 |

### 修改文件
| 文件 | 变更 |
|------|------|
| `cloudbaserc.json` | 注册 cf-alert、feedback-submit |
| `cloudfunctions/invite-code/index.js` | 接入错误上报 |
| `cloudfunctions/user-auth/index.js` | 接入错误上报 |
| `cloudfunctions/payment/index.js` | 接入错误上报 |
| `cloudfunctions/feedback-submit/index.js` | 接入错误上报 |
| `cloudfunctions/ai-chat/index.js` | 接入错误上报 |
| `admin-dashboard/src/App.tsx` | 注册 /admin/cf-errors 路由 |
| `admin-dashboard/src/components/layout/Sidebar.tsx` | 添加「错误监控」导航 |

## 部署步骤

### 步骤1: 配置企微 Webhook 环境变量

在 CloudBase 控制台 → 云函数 → 环境变量 中添加：

```
WECOM_WEBHOOK_URL = https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY
```

> 获取方式: 企业微信群 → 群设置 → 群机器人 → 添加机器人 → 复制 Webhook 地址

### 步骤2: 部署 cf-alert HTTP 云函数

```bash
cd cloudfunctions/cf-alert
npm install
# 使用 CloudBase CLI 或控制台上传
tcb fn deploy cf-alert --http-trigger /cf-alert
```

### 步骤3: 重新部署已修改的云函数

需要重新部署的云函数（因为 index.js 有变更）：
- invite-code（同时安装 wx-server-sdk 依赖）
- user-auth
- payment
- feedback-submit

```bash
# 逐个部署
cd cloudfunctions/invite-code && npm install && cd ../..
tcb fn deploy invite-code

cd cloudfunctions/user-auth && npm install && cd ../..
tcb fn deploy user-auth

cd cloudfunctions/payment && npm install && cd ../..
tcb fn deploy payment

cd cloudfunctions/feedback-submit && npm install && cd ../..
tcb fn deploy feedback-submit
```

### 步骤4: 初始化 cf_error_logs 集合

无需手动创建，首次写入时 CloudBase 自动创建。

### 步骤5: 部署运营后台

```bash
cd admin-dashboard
npm run build
# 部署 dist/ 到 CloudBase 静态网站托管
```

## 验证方式

1. **手动触发测试**: 调用 cf-alert 的手动告警接口
   ```
   POST https://{envId}.service.tcloudbase.com/cf-alert/send
   { "fnName": "test", "errorMsg": "测试告警", "note": "部署验证" }
   ```

2. **查看运营后台**: 访问 `/admin/cf-errors` → 应显示「最近24小时无云函数异常」

3. **人为制造错误**: 调用 invite-code 云函数，传入无效 action → 应收到企微告警 + 运营后台可查看

## 告警机制说明

| 特性 | 配置 |
|------|------|
| 严重度分类 | Critical (依赖缺失/环境变量缺/连接失败) / High (默认) |
| 冷却时间 | 60秒（同函数+同错误类型不重复推送） |
| 消息格式 | 企微 Markdown 格式 |
| DB 保留 | 30天自动过期（TTL索引） |
| 运营后台刷新 | 30秒自动轮询 |

## 当前已接入云函数

- ✅ invite-code（邀请码）
- ✅ user-auth（用户认证）
- ✅ ai-chat（AI对话）
- ✅ payment（支付）
- ✅ feedback-submit（意见反馈）

## 待接入云函数

其余约35个云函数尚未接入，可按需逐步接入。接入方式：
1. 复制 `_cf-error.js` 到云函数目录
2. 在 `index.js` 中 `const { reportError } = require('./_cf-error');`
3. 在 catch 块中调用 `reportError({ db, fnName, action, error }).catch(() => {});`
4. 重新部署
