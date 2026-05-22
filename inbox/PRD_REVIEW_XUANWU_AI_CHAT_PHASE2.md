# 玄武 PRD合规审查 — AI-Chat Phase 2

> Claude → 琅琊 | 2026-05-22

## P0 合规问题
| # | 问题 | 状态 |
|---|------|:--:|
| — | **本轮无P0合规发现** | K2护栏6规则全线通过，CONFIDENCE_A_E不涉及K2信息泄露 |

## P1 偏差
| # | 偏差 | 对照文档 | 建议 |
|---|------|----------|------|
| X1 | 4项新需求(REQ-008~011)缺少专属单测覆盖 | QA Sign-off | Phase 3准入条件: 补齐4项单测后方可进入Phase 3开发 |
| X2 | 覆盖率35%低于PRD v5.1建议的80%门槛 | PRD v5.1 §5.3 | 先补domain-router+mock测试快速拉升到60%，后续靠集成测试覆盖 |
| X3 | 流式done event未返回confidence_label | PRD v5.1 §3.3 F-008 | 与麒麟K3同步修复 |
| X4 | 服务端memory查询为同步阻塞 | PRD v5.1 §5.1 性能 | 加500ms超时不阻塞主流程 |

## P2 优化建议
| # | 建议 | 来源 |
|---|------|------|
| X5 | API_PROVIDER/AI_MODEL环境变量导出白名单待补充到risk-assessment测试 | 自动化测试 |
| X6 | verify.sh 19项.hermes规则文件缺失，建议新建占位文件或调整verify规则 | CI Agent |
| X7 | Phase 3准入建议将QA-Sign-off的4项P1条件设为闸门G4准出标准 | 本轮测试 |

## 审查结论
**通过** — P0合规无发现。4项P1偏差中X1/X3为本次最大缺口，建议Phase 2部署后优先处理。X5/X6/X7为P2工程规范，不阻塞发布。
