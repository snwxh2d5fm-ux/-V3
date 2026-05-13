# E2E审查报告 — Claude接手校验

> 审查时间: 2026-05-13 | 审查人: Claude (琅琊指令)
> 原通知: inbox/REVIEW_e2e_fixes_待审批.md

## 审查结论：Hermes修改保留，不回退

### 技术审查结果

| 检查项 | 结果 | 详情 |
|--------|:--:|------|
| v0.12 API兼容性 | ✅ | `mp.currentPage()`, `mp.evaluate()`等全部正确。`scrollTo`中`mp.pageScrollTo()`为死代码未被调用 |
| beforeEach→beforeAll转换 | ✅ | 全部7个spec已转换，时序正确 |
| setup.js (移除cliPath+reLaunch) | ✅ | v0.12通过9420端口自动探测 |
| jest.config.js (删setupFilesAfterSetup) | ✅ | Jest无此配置项 |
| 冒烟测试7/7可信度 | ✅ | 连通性验证可信，时序合理 |
| helpers/index.js 重写 | ✅ | API适配完整，switchTab含3次重试+兜底 |

### 发现的问题（非阻塞）

1. **6个spec中大量`expect(true).toBe(true)`占位断言** — process/guidebooks/ai-chat/regression有多个测试无实际验证，仅验证不崩溃
2. **guidebooks 测试2.1断言过宽** — 仅检查`page.path`为真，未验证确实导航到guidebooks
3. **spec间状态泄漏风险** — `beforeAll`共享会话，各spec在自身`beforeAll`中执行`clearStorage`已降低风险

### 后续行动

- Claude接手E2E框架维护
- 6个spec精简+逐模块验证（P0待办）
- Hermes -30分记录保留（越界事实，但修改正确）

## 决策：保留Hermes修改 + Claude继续精简
