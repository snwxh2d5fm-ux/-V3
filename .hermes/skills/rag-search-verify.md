# RAG 检索验证标准流程

> 技能类型: 固定操作手册
> 每次修改 rag-search 云函数、更新知识库后必须执行

## 前置条件
- rag-search 云函数已部署
- knowledge_chunks 集合有数据
- CloudBase 环境 `cloudbase-d1g17tgt7cc199a60` 可用

## 验证步骤

### 1. Smoke Test — 基础可用性
```js
mcp_cloudbase_manageFunctions({
  action: 'invokeFunction',
  functionName: 'rag-search',
  params: { query: '优才计划申请条件', topK: 3 }
})
```
验证返回结果包含 `chunks` 数组，且数组非空。

### 2. 检索相关性验证 (≥10条)
选取以下 10 个查询，逐条验证 top-3 结果与查询意图匹配：

| # | 查询 | 期望知识域 | 期望来源 |
|:--:|------|:--------:|:--------:|
| 1 | 优才计划申请条件 | 优才 | 官方 |
| 2 | 高才通 A类收入要求 | 高才 | 官方 |
| 3 | IANG 签证续签需要什么材料 | IANG | 官方 |
| 4 | 受养人签证办理流程 | 受养人 | 官方 |
| 5 | 香港永居七年计算方式 | 永居 | 官方 |
| 6 | 专才计划雇主变更 | 专才 | 官方 |
| 7 | 身份证办理预约 | 在港生活 | 官方/社区 |
| 8 | 子女在港入学 | 在港生活 | 社区 |
| 9 | 香港租房注意事项 | 在港生活 | 社区 |
| 10 | 强积金提取条件 | 在港生活 | 官方 |

### 3. K2 泄露检查
```bash
python3 scripts/k2-quick-scan.py
```
确认 rag-search 返回结果中无 K2 级内容。

### 4. 响应时间检查
单次查询响应时间应在 2 秒以内（冷启动 < 5 秒）。

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 返回空结果 | embedding 未生成或索引失效 | 重新运行 embedding-import |
| 结果不相关 | 查询与 chunk 语义距离过大 | 检查 embedding 模型版本 |
| 响应超时 | 云函数冷启动 | 设置 MinNum=1 |
| 含 K2 内容 | 入库时未过滤 | 检查 data-cleaning-run 的 K2 过滤步骤 |
