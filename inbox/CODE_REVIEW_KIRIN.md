# 麒麟代码审查报告 — moderateText() 审核绕过修复

**文件**: cloudfunctions/feedback-submit/index.js
**版本**: 23ee618 → 8a24b4f
**日期**: 2026-05-25

## P0（阻塞上线）

### P0-01: 降级策略与 content-moderation 架构级不一致
content-moderation 降级策略为 fail-open（suggestion:'Pass'+degraded:true），但本修复覆盖为 fail-closed（拒绝）。同一被调用方被 feedback-submit 和 batch-generate-guidebooks 以相反策略解读。
- **建议**: 将降级策略收敛到 content-moderation 内部，或在 degraded 时返回 Block 而非 Pass

### P0-02: content-moderation 熔断器触发后反馈功能完全不可用 60s
熔断器 60s 窗口连续 5 次 TMS 失败后返回 degraded:true, suggestion:'Pass' → 新代码解读为拒绝 → 熔断期间所有反馈被拒
- **建议**: 区分「TMS 单次失败」和「熔断器批量拒绝」

## P1（建议修复）

### P1-01: 空 resData 场景下错误提示不准确
resData.suggestion=undefined 时返回「内容包含违规信息」而非「服务异常」

### P1-02: catch 与 degraded 分支返回相同用户消息
两处都返回相同文案，运维无法区分根因

## P2（建议优化）

- P2-01: degradeReason 透传到日志
- P2-02: Review 拦截缺少注释说明
- P2-03: 空内容放行可被恶意利用

## 审查结论

修复逻辑正确，P0 为预存架构问题非本次引入。建议下次发版前统一降级策略。
