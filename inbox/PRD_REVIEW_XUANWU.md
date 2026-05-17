# 玄武PRD审查报告

**审查日期:** 2026-05-18 21:20 HKT
**审查范围:** commit 4cfd6b8 — 12文件安全修复+架构修复
**验证状态:** Hermes独立验证全部P0项

---

## P0 — 阻断级 (运行时必现错误)

### P0-1: ai-assess 云函数 db 未初始化 → ReferenceError ✅已确认
- **文件:** cloudfunctions/ai-assess/index.js L139
- **描述:** 第139行 `await db.collection('assessment_cases')...` — 文件头部无 `wx-server-sdk` require、无 `cloud.init()`、无 `db` 变量声明
- **影响:** 调用时抛出 ReferenceError，similarCases永远为0，假数据清理目标落空
- **验证:** 前三行无 cloud/db 声明确认

### P0-2: progress-bar 组件 barColor 数据流断裂 ✅已确认
- **文件:** components/progress-bar/progress-bar.js L10,17 + .wxml L3
- **描述:** JS通过 observers 设置 `barColor` 但 WXML引用的是 `{{color}}`(property默认值)
- **影响:** 红/橙/绿三色逻辑完全无效，进度条颜色恒为primary
- **验证:** WXML中 `{{barColor}}` 出现0次，`{{color}}` 出现1次

---

## P1 — 高优先级

### P1-1: parseAssessmentJSON catch块降级逻辑为空
- **文件:** cloudfunctions/ai-chat/index.js L725-727
- **描述:** catch块仅有注释无代码，LLM输出含markdown包裹时JSON解析直接失败

### P1-2: payment V3回调签名条件绕过
- **文件:** cloudfunctions/payment/index.js L406
- **描述:** 麒麟P0-2同源，从PRD角度：开发→生产部署漏配环境变量=安全门失效

### P1-3: db-admin 白名单为空时全员放行
- **文件:** cloudfunctions/db-admin/index.js L11-14
- **描述:** 麒麟P1-1同源，从PRD角度：管理接口安全设计不完整

### P1-4: identifyDocType reject 语义变更兼容性
- **文件:** utils/ocr.js L84-85
- **描述:** resolve→reject改变API契约，需确认所有调用方已适配

### P1-5: policy-monitor _fetchUrl 不校验HTTP状态码
- **文件:** cloudfunctions/policy-monitor/index.js L104-105
- **描述:** 503/403/302等非200响应照样计算hash，误判政策变更

---

## P2 — 建议

- P2-1: 评估快捷回复降级 fallback 与 dim 体系不对齐
- P2-2: ASSESS_DIM_OPTIONS 与旧版选项文本不一致
- P2-3: batch-generate rating/helpful 归零缺迁移说明
- P2-4: tracker.js 错误warn缺去重
- P2-5: progress-bar observers/lifetimes 颜色逻辑重复

---

## 总结

| 级别 | 数量 | 关键问题 |
|:--:|:--:|------|
| P0 | 2 | ai-assess ReferenceError + progress-bar颜色逻辑无效 |
| P1 | 5 | JSON降级空实现+签名绕过+白名单+reject兼容+HTTP状态码 |
| P2 | 5 | dim体系/选项/迁移/去重/代码重复 |

**审查结论:** P0-1(db未初始化)属于合并阻断缺陷。P0-2(barColor数据流)使progress-bar修复意图落空。
