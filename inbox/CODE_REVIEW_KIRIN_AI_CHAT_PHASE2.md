# 麒麟 Code Review — AI-Chat Phase 2

> Claude → 琅琊 | 2026-05-22

## P0 (必须修)
| # | 文件 | 问题 | 建议修复 |
|---|------|------|----------|
| — | — | **本轮无P0发现** | 专家组评审已通过，97项回归零退化 |

## P1 (建议修)
| # | 文件:行 | 问题 | 建议修复 |
|---|---------|------|----------|
| K1 | index.js:703-707 | `compressHistory()`定义了但主流程未调用，历史超10条时直接截断而非压缩 | 在主流程调用compressHistory替代processHistory直接截断 |
| K2 | index.js:1362 | `extractConfidenceLabel`正则只匹配全角冒号`[置信度: X·标签]`，半角冒号无法解析 | 更新为`[置信度[:：]\s*([A-E])`兼容两种冒号 |
| K3 | index.js:1267-1275 | 流式done event未提取A-E置信度标签，流式/非流式响应结构不一致 | 在流式done处调用extractConfidenceLabel并注入JSON |
| K4 | domain-router.js | GENERIC_WORDS中"介绍一下"会误判"请介绍一下优才"跳过领域识别 | 改为完整词匹配或降低GENERIC_WORDS优先级 |
| K5 | index.js:987-1007 | 服务端memory加载为同步阻塞，首次对话增加DB查询延迟 | 改为Promise.race(500ms超时)不阻塞主流程 |

## P2 (可选)
| # | 文件:行 | 问题 |
|---|---------|------|
| K6 | prompts.js:89-103 vs index.js:968-976 | CONFIDENCE_A_E(LLM自我标注)与confidenceDirective(后端判定)双重注入可能冲突 |
| K7 | memory.js:42 | `maxMessages = maxMessages || 10`中显式传0会回退到10 |
| K8 | prompts.js | 代码重复：index.js硬编码了CONFIDENCE_DIRECTIVES字符串，未复用prompts.js导出 |

## 审查结论
**通过** — P0无发现。5项P1建议在Phase 3前修复。D2(半角冒号)和D3(流式置信度)影响用户可见的置信度标签展示，建议优先处理。
