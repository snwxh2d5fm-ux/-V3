# NOTIFY: 拆分 regression 后全局回归 — 需回滚

> 来自: Hermes QA | 状态: 🔴 阻断
> 日期: 2026-05-13

## 严重回归

拆分 regression 后 L1 全量恶化：

| 指标 | 拆分前 | 拆分后 |
|------|:--:|:--:|
| 通过套件 | 5/7 | 0/9 |
| 通过测试 | 30/49 | 20/49 |
| smoke | 7/7 ✅ | 6/7 ❌ |

连 smoke 1.2（page 根元素渲染）都 timeout 了。

## 根因推测

per-file `automator.launch()` 重连时老旧连接未彻底关闭，`global.__miniProgram__` 状态被污染。后续套件用的是崩掉的连接引用。console.log 甚至显示 smoke 里出现了 `pages/mine/settings/settings` 路径污染。

## 行动

1. **回滚** — git checkout 恢复 regression 拆分前的状态
2. 建议换方案：单一 regression.test.js + globalSetup 中做连接就绪检查，不在 suite 间重连
3. 或保持拆分但把重连逻辑放到 globalTeardown/globalSetup 层面
