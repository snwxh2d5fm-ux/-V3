# 数据清洗执行手册

> 技能类型: 固定操作手册
> 每次处理新批次数据时严格按此流程

## 前置条件
- 原始数据文件已就位 (raw JSON/JSONL)
- content-clean 云函数已部署
- CloudBase knowledge_chunks 集合可用

## 执行步骤

### 第一步：原始数据检查
```bash
# 确认原数据文件存在且非空
wc -l <批次原始文件.json>
# 确认编码为 UTF-8
file -I <批次原始文件.json>
```

### 第二步：执行三道路程

#### 2.1 清洗 (PII脱敏 + 过滤 + 标准化 + 去重)
```js
mcp_cloudbase_manageFunctions({
  action: 'invokeFunction',
  functionName: 'content-clean',
  params: {
    action: 'clean',
    batchId: '<EX-YYYY-MMDD-NNN>',
    source: '<来源>',
    limit: 500
  }
})
```
**清洗检查清单:**
- [ ] 姓名/电话/证件号 → `[已脱敏]`
- [ ] 邀请码/推广链接 → 已删除
- [ ] 日期格式统一 (YYYY-MM-DD)
- [ ] 币种标注 HK$
- [ ] contentHash 去重完成

#### 2.2 校验 (事实核查 + 跨源一致性 + 时效性 + 追溯链)
```js
mcp_cloudbase_manageFunctions({
  action: 'invokeFunction',
  functionName: 'content-clean',
  params: {
    action: 'validate',
    batchId: '<EX-YYYY-MMDD-NNN>'
  }
})
```
**校验检查清单:**
- [ ] 政策条文可追溯到官方来源
- [ ] 多源矛盾已标记为🟡
- [ ] 政策信息标注了最后确认日期
- [ ] 超 12 个月的内容标记为待复审
- [ ] 每条数据有来源+采集时间+清洗时间

#### 2.3 评估打标 (绿/黄/红 + 置信度 + 来源可靠性 + 知识域)
```js
mcp_cloudbase_manageFunctions({
  action: 'invokeFunction',
  functionName: 'content-clean',
  params: {
    action: 'evaluate',
    batchId: '<EX-YYYY-MMDD-NNN>'
  }
})
```
**打标规则:**
- 🟢 绿色: 官方来源 + 置信度≥高 + 时效<12月 + 无PII
- 🟡 黄色: 社区来源 或 置信度中 或 时效12-24月 或 跨域方法论
- 🔴 红色: K2敏感 或 置信度低 或 时效>24月 或 含营销内容

### 第三步：入库
```js
mcp_cloudbase_manageFunctions({
  action: 'invokeFunction',
  functionName: 'knowledge-import',
  params: {
    action: 'import',
    batchId: '<EX-YYYY-MMDD-NNN>',
    grade: 'green,yellow'  // 仅入库绿+黄色
  }
})
```

### 第四步：入库后验证
```bash
# 验证入库条数
mcp_cloudbase_readNoSqlDatabaseContent({
  collectionName: 'knowledge_chunks',
  query: { batchId: '<EX-YYYY-MMDD-NNN>' }
})

# 运行 K2 扫描确认无泄露
bash scripts/verify.sh
```

## 批次文件命名
- 原始: `<EX-ID>_raw.json`
- 处理后: `<EX-ID>_processed.json`
- 审计: `<EX-ID>_audit.json`

## 紧急回滚
如发现已入库数据存在 PII 泄露或 K2 违规：
```js
mcp_cloudbase_writeNoSqlDatabaseContent({
  action: 'delete',
  collectionName: 'knowledge_chunks',
  query: { batchId: '<EX-ID>' },
  isMulti: true
})
```
