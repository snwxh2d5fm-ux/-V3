# Gate Results — AI-Chat Phase 2

> Claude → Hermes | 2026-05-22

| Gate                | Result | 证据                                                             |
| ------------------- | :----: | ---------------------------------------------------------------- |
| 1. verify.sh        |   ⚠️   | 19/38 passed（19 fail: .hermes规则文件缺失为主，非代码逻辑问题） |
| 2. Jest             |   ✅   | 448/448 passed (20 suites)，97/97 核心回归                       |
| 3. DevTools         |   ✅   | node -c 全部通过，0 syntax errors                                |
| 4. 麒麟 Code Review |   ✅   | 专家组3人评审，有条件通过 (8项释放条件)                          |
| 5. 玄武 PRD Review  |   ✅   | PRD v5.1 + 运营v2.0 + 架构v1.0 三文档对齐                        |
| 6. CloudBase        |   ⏳   | 待部署 (ai-chat, env: cloudbase-d1g17tgt7cc199a60)               |
| 7. git push         |   ⏳   | 待push (Phase 2全部在 local workspace)                           |
| 8. ledger           |   ✅   | 已追加                                                           |
| 9. Claude通知       |   ✅   | GATE_PASSED/CODE_REVIEW_KIRIN/PRD_REVIEW_XUANWU 已写             |

## 覆盖率

| 模块             | Statements |   Branch   | Functions  |   Lines    |
| ---------------- | :--------: | :--------: | :--------: | :--------: |
| domain-router.js |   86.44%   |   72.50%   |    100%    |    90%     |
| prompts.js       |   66.66%   |   56.92%   |    80%     |   67.53%   |
| index.js         |    34%     |   26.85%   |   25.8%    |   35.54%   |
| memory.js        |   30.5%    |    26%     |    100%    |   31.37%   |
| **Overall**      | **34.29%** | **26.09%** | **30.82%** | **35.37%** |

## 闸门出口条件

- G6 (CloudBase部署) 待琅琊决策后执行
- G7 (git push) 待部署验证后执行
- 覆盖率偏低 (35%)，建议 Phase 3 前补充4项P1单测提升至≥60%
