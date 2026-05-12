# 攻略书内容生成标准步骤

> 技能类型: 固定操作手册
> 每次生成/更新攻略书内容时严格按此流程

## 前置条件
- CloudBase knowledge_chunks 集合有可用数据
- batch-generate-guidebooks 云函数已部署

## 生成步骤

### 1. 确定生成范围
```js
// 查看当前已用源
mcp_cloudbase_readNoSqlDatabaseContent({
  collectionName: 'guidebook_articles',
  query: {},
  projection: { source_title: 1 }
})
```

### 2. 调用批量生成
```js
mcp_cloudbase_manageFunctions({
  action: 'invokeFunction',
  functionName: 'batch-generate-guidebooks',
  params: {
    action: 'generate',
    limit: 20,
    skip: <已处理数量>  // 分页跳过已处理源
  }
})
```

### 3. 内容安全验证
生成后必须检查:
- [ ] 无 `投资移民` (应为 `资本投资`)
- [ ] 无平台名称 (知乎/小红书等)
- [ ] 无个人联系方式
- [ ] 无营销用语
- [ ] 无第一人称经验 (`我帮...`/`亲身体验`)
- [ ] 金额为港币 (HK$) 标注

如有违规则重新生成或手动修复。

### 4. 同步本地数据
```bash
node -e "
var g = require('./data/guidebook-data');
var cards = g.getAllCards();
console.log('Total articles:', cards.length);
"
```

### 5. 更新索引页计数
修改 `pages/guidebooks/index/index.js` 中 categories 数组的 count 字段。

### 6. 同步云数据库
将新生成的 article 写入 `guidebook_articles` 集合 (每批 ≤10 条)。

## 常见问题
- **Green chunks 产出质量低** → 优先使用 yellow chunks
- **batch >10 插入失败** → 拆分批次，每次 ≤10
- **skip 返回 0** → 所有源已耗尽，需新数据
- **生成内容含敏感词** → 检查 redactContent() 正则是否覆盖
