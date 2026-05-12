# 住港伴 V3 — 开发日志

> 最后一更: 2026-05-11 23:59 — 收尾，明日真机测试

## ⏸️ 今日收尾 (2026-05-11 EOD)

**待真机测试**:
- [ ] OCR 拍照识别 + 路径匹配（测试账号 🌊）
- [ ] 智能修正：选错路径 → OCR 识别 → 自动修正
- [ ] 反滥用限流：连续识别 / 空图 / 非证件图
- [ ] tesseract 冷启动耗时（首次 ~10s，热启动 ~3s）

**已完成（今日全部）**:
- ✅ 微信支付 V3 接入 + 会员方案页 + 支付流程
- ✅ 登录页优化（自动勾选协议）
- ✅ 身份选择页 v4.6（OCR + 智能修正 + 本地留存）
- ✅ OCR 引擎 v4（tesseract.js + 反滥用 + 审计日志）
- ✅ CloudRun PaddleOCR 尝试（容器 OOM，改用云函数 tesseract）
- ✅ 11 个云函数正常，2 个集合新建，PRD 文档同步
> 环境: CloudBase `cloudbase-d1g17tgt7cc199a60` | 小程序 `wx08c2222c1bf042fd`

---

## 🏆 里程碑: OCR 身份验证 v1 (2026-05-11)

### 概述
完成 OCR 文档识别 + 路径匹配校验 + 反滥用规则完整部署。

### OCR 引擎
- **v1-v2**: `cloud.openapi.ocr.printedText` — 不可用（CloudBase 个人版不支持）
- **v3**: tesseract.js 云函数 — 支持 `chi_tra+chi_sim+eng` 三种语言
- **v4**: 反滥用加固版 — 限流 + 质量门 + 审计日志

### 验证流程
```
选身份路径 → 拍照 → 压缩上传(_ocr_temp/) → tesseract OCR
→ 提取结构化字段(申请编号/类别/日期/证件号)
→ 路径匹配校验
→ 立即删除云存储文件
→ 返回结果(✅匹配 / ⚠️不匹配+可自动修正 / ❌无法识别)
```

### 反滥用规则
| 规则 | 参数 |
|------|------|
| 每日上限 | 20次/用户 |
| 最小间隔 | 5秒 |
| 连续失败冷却 | 5次失败 → 10分钟冷却 |
| 图片质量门 | 最小5KB，最大10MB，最少10字符 |
| 审计日志 | `ocr_audit` 集合，保留90天 |

### 智能修正
- OCR 识别到申请类别与选择不一致时 → 弹窗询问是否按识别结果自动修正选择
- 例: 选高才通但识别到优才 → "是否按优才确认？" → 确认后自动改选优才

### 涉及文件
- `cloudfunctions/ocr-service/` — v4 反滥用版
- `pages/status-select/` — v4.6 OCR 验证 + 智能修正
- `data/rules/ocr-verification.json` — 验证规则配置文件
- `ocr_audit` — 审计日志集合（含索引）

---

## 微信支付 V3 接入 (2026-05-11)

详见上节。商户号 `1112016327`，V3 直连 `api.mch.weixin.qq.com`。

---

## 登录页 + 身份页优化 (2026-05-11)

- 登录: `agreedToTerms` 默认 true
- 身份选择: 纯本地拍照留存 → OCR 验证 + 智能修正

---

## 2026-05-11 会话: Bug修复 + 功能新增 + 规则库

### Bug 修复
- **流程控步骤越级解锁**: `loadActiveProcess()` 循环缺 `unlocked===false` 检查
- **QMAS 匹配三连 bug**: C1 死代码 / hasKids 误判 / childAge 硬编码
- **编译错误**: status-select.wxss `.ocr-box__hint` 缺 `}` / index.js 尾部缺 `});`

### 功能
- **证件夹所属人管理**: 本人/配偶/子女切换，身份卡槽按 owner 过滤刷新
- **路径名外化**: templates/constants/solution-library 去除 QMAS/ASMTP 等内部代号

### 规则库
- `data/rules/reminders.js` 从 8 条扩展至 **100 条规则 / 218 条提醒项**

### 改动文件
`pages/process/index/index.js`, `data/solution-library.js`, `pages/assessment/index/index.js`,
`pages/documents/index/*`, `pages/documents/add/*`, `data/templates.js`, `data/constants.js`,
`pages/status-select/status-select.wxss`, `data/rules/reminders.js`, `CLAUDE.md` (新建)

---

## 架构

```
前端 (原生小程序)
  ├─ wx.cloud.callFunction
  │   ├─ user-auth        (登录/手机号/状态)
  │   ├─ payment          (微信支付V3/会员)
  │   ├─ ocr-service      (OCR验证+反滥用 v4)
  │   ├─ ai-chat/ai-assess/solution-engine
  │   └─ ... 其他云函数
  └─ 本地存储
       └─ identity_docs/  (拍照留念)
```

### 数据库集合
`users`, `orders`, `subscription_records`, `membership_plans`, `audit_logs`, `ocr_audit`, ...

---

## 待办
- [ ] 支付回调 HTTP 触发器
- [ ] 订单历史页面
- [ ] 清理重复 users 记录
- [ ] 废弃 V0/V1/V2 旧目录
