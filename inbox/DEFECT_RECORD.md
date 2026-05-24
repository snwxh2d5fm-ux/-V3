# 缺陷记录 — 5.22 数据损失事件抢救方案

> 测试管线 | 2026-05-23

## P0 (阻断)
无

## P1 (严重)
无

## P2 (一般)
无

## P3 (轻微)
无

## 历史缺陷（技术委员会 + PD评审 + 账号审计 — 已全部修复）

| # | 级别 | 描述 | 修复提交 |
|---|:--:|------|----------|
| CRIT-1 | P0 | loadSession回滚恢复数据 | c438d6d |
| CRIT-2 | P0 | executeReset先清本地后调服务器 | 63ecb26 |
| CRIT-3 | P0 | legacyKey硬编码 | 3857e4f |
| HI-5 | P1 | save*无独立try-catch | eefb36c |
| HI-7 | P1 | WXPAY_APPID无warn | 3857e4f |
| MED-8 | P2 | 审计日志缺source字段 | 3857e4f |
| MED-10 | P2 | cloudReady阻断离线恢复 | c438d6d |
| MED-12 | P2 | status-badge逻辑重复 | 8b8736b |
| Defect-A | P0 | 手机号微信号无法合并 | 2e3b63f |
| Defect-B | P0 | 本地存储跨账号泄露 | 3e67fe5 |
| Defect-C | P0 | detectDataLoss盲区 | eec0d2f |
