# REVIEW: L1 regression 套件 automator 连接稳定性修复

> 来源: Hermes QA 闸门 | 优先级: P1
> 日期: 2026-05-13
> 状态: 待审批/修复

---

## 测试结果

核心 5 套件全绿，回归套件因 automator 连接稳定性崩盘：

| 套件 | 结果 | 备注 |
|------|:--:|------|
| smoke | 7/7 ✅ | |
| documents | 4/4 ✅ | |
| ai-chat | 6/6 ✅ | |
| guidebooks | 6/6 ✅ | |
| process | 4/4 ✅ | 已修复 |
| reminders | 3/3 ✅ | 已修复 |
| **regression** | **5/19** | 14 项 timeout |
| **合计核心** | **30/30** | |
| **总计** | **35/49** | |

---

## 根因分析

regression 套件运行 461s 后，automator v0.12 WebSocket 连接完全崩溃。所有后续测试报 `timeout`，非测试逻辑问题：

- 8.1 我的Tab ✅ 正常（第1个）
- 8.2-8.7 全部 timeout — 连接在此处开始断
- 10.1-10.5 全部 timeout
- 11.1-11.6 timeout + Exceeded 60000ms

失败项全部是 regression 套件中的子页面导航测试。非代码 bug，是 automator 在长跑场景下连接不稳定。

## 修复方向

两种方案可选：

**方案 A: 连接恢复机制**
在每个 describe 或 test 前检查 `mp.currentPage()` 可用性，不可用时重新 `automator.launch()` 建立连接。

**方案 B: 拆分运行**
将 regression 套件拆成 3 个独立 spec（my-regression / exception / prd），各自由独立的 automator 连接运行。`npm run test:e2e` 串行执行。

## 涉及文件

- `tests/e2e/specs/regression.test.js` — 需加连接恢复或拆分
- `tests/e2e/jest.config.js` — 如需调整超时配置
- `tests/e2e/setup.js` — 如需暴露 reconnect 接口

## 验证方法

```bash
npm run test:e2e
```

期望 regression 套件不再因连接稳定性失败。
