# DONE: regression 套件 automator 连接稳定性修复

> 来源: inbox/REVIEW_regression_timeout_20260513.md
> 方案: B (拆分套件) + per-file reconnection
> 日期: 2026-05-13
> 状态: ✅ 已交付

## 变更概要

### 问题
regression.test.js (19 tests) 在长跑 461s 后 automator WebSocket 崩溃，14/19 timeout。另有2处语法错误。

### 修复

1. **拆分为 3 个独立 spec**：
   - `regression-my.test.js` — §8 我的+会员 (7 tests, ~2min)
   - `regression-exception.test.js` — §10 异常场景 (5 tests, ~2min)
   - `regression-prd.test.js` — §11 PRD变更 (7 tests, ~2.5min)

2. **Per-file reconnection**：每个 spec 的 `beforeAll` 在获取 `global.__miniProgram__` 后先 `currentPage()` 健康检查，失败则重新 `automator.launch()` 建立连接。各 spec 运行时间足够短，不会在文件内部触发连接崩溃。

3. **修复语法错误**：
   - 10.5 测试缺逗号 → 已修复
   - 11.6/11.7 代码粘连 → 拆分为独立测试

4. **新增 npm scripts**：
   - `test:e2e:regression` — 运行全部3个 (现有脚本不变)
   - `test:e2e:regression:my` — 仅 §8
   - `test:e2e:regression:exception` — 仅 §10
   - `test:e2e:regression:prd` — 仅 §11

### 涉及文件
- `tests/e2e/specs/regression.test.js` → 删除
- `tests/e2e/specs/regression-my.test.js` → 新建
- `tests/e2e/specs/regression-exception.test.js` → 新建
- `tests/e2e/specs/regression-prd.test.js` → 新建
- `package.json` → 新增3个 regression 子脚本

### 验证
```bash
npm run test:e2e:regression
```
期望全部 19 项通过，不再因连接稳定性 timeout。
