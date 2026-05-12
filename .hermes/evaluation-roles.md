# 住港伴V2 多Agent综合评估

## 评估项目
- 项目：住港伴 — 微信小程序AI香港身份规划伴侣
- 路径：~/Downloads/港动人生/住港伴V2-开发中/
- 技术栈：Taro 3.6 + React 18 + TypeScript + CloudBase + Ollama RAG
- 模块：证件夹/提醒器/流程控/指引牌/效率宝/信息栏/攻略书 (7大模块)
- 云函数：17个 (user-auth, ocr-service, payment, ai-chat, ai-doc-gen等)

## 评估角色清单 (53个)
基于 ECC 48 agent + 住港伴特化角色：

### 安全类 (6)
1. security-reviewer — 安全漏洞扫描
2. silent-failure-hunter — 静默失败检测
3. opensource-sanitizer — 开源依赖审查
4. input-validator — 输入验证审查
5. privacy-auditor — 隐私合规(HK个人资料条例)
6. secret-scanner — 密钥/凭证泄露扫描

### 代码质量类 (8)
7. code-reviewer — 代码质量
8. code-simplifier — 简化重构建议
9. refactor-cleaner — 死代码清理
10. type-design-analyzer — TypeScript类型设计
11. comment-analyzer — 注释质量
12. code-explorer — 代码结构探索
13. naming-consistency — 命名一致性
14. error-handling-audit — 错误处理审查

### 架构设计类 (7)
15. architect — 系统架构
16. code-architect — 代码架构
17. planner — 实现规划回顾
18. database-reviewer — CloudBase NoSQL设计
19. api-design — API设计规范
20. microservice-boundary — 服务边界分析
21. module-coupling — 模块耦合度

### 性能类 (5)
22. performance-optimizer — 性能优化
23. cloudbase-optimizer — CloudBase查询优化
24. bundle-size-analyzer — 小程序包体积
25. cold-start-profiler — 云函数冷启动
26. network-efficiency — 网络请求效率

### 测试类 (5)
27. tdd-guide — TDD流程审查
28. test-coverage — 测试覆盖率
29. e2e-runner — E2E测试设计
30. edge-case-hunter — 边界情况
31. regression-risk — 回归风险评估

### 文档类 (4)
32. doc-updater — 文档完整性
33. codebase-onboarding — 新人上手难度
34. i18n-audit — 国际化完整性
35. readme-quality — README质量

### 前端/UX类 (5)
36. a11y-architect — 无障碍访问
37. ux-flow-review — 用户流程审查
38. component-reusability — 组件复用性
39. state-management — 状态管理审查
40. responsive-design — 响应式适配

### 业务/产品类 (6)
41. business-logic-audit — 业务逻辑正确性
42. pricing-model-review — 定价模型(4级订阅)
43. compliance-check — HK法律合规(P0-LEG-01)
44. competitive-analysis — 竞品对比
45. monetization-review — 变现路径
46. user-persona-alignment — 用户画像匹配

### 运维/DevOps类 (5)
47. ci-cd-review — CI/CD流程
48. monitoring-gap — 监控盲区
49. backup-strategy — 备份策略
50. deployment-safety — 部署安全性
51. logging-standards — 日志规范

### 住港伴特化 (2)
52. rag-pipeline-audit — RAG检索增强管线(P0-CNT-02)
53. wechat-miniprogram-compliance — 微信小程序审核合规

## 输出格式
每个角色输出：
```json
{
  "role": "角色名",
  "category": "分类",
  "findings": [
    {"severity": "CRITICAL|HIGH|MEDIUM|LOW", "file": "路径", "issue": "问题", "suggestion": "建议"}
  ],
  "score": "1-10 (10=完美)",
  "summary": "一句话总结"
}
```
