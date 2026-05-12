# 代码质量底线

> 规则类型: 硬约束 (每次改动后必须满足)

## 前置条件（开发前）

1. 阅读 CLAUDE.md 了解项目结构和已知问题
2. 阅读对应模块的已有代码，确认改动范围
3. 如改动涉及数据文件 (constants/solution-library/templates)，必须先理解其导出结构

## 提交通道（开发后）

4. **编译必须通过** — `npm run build` 或微信开发者工具编译无 error
5. **验证脚本必须通过** — `bash scripts/verify.sh` 全部通过
6. **不得引入新的 WXML 双重 wx:for 同元素**
7. **不得引入新的 `includes` 替代 `startsWith` 的 HK$ 金额判断**
8. **新增页面必须注册到 app.json**
9. **CLAUDE.md 必须同步更新** — 如新增模块/修改架构/发现新坑

## 常见错误模式（自动检查）

| 错误模式 | 检测方式 |
|----------|----------|
| `parseIncome` 中用 `includes` | grep `includes.*HK\$` |
| WXML 双重 wx:for | grep `wx:for.*wx:for-item.*wx:for` |
| guidebook-data.js 含 `投资移民` | grep `投资移民` |
| 新增页面未注册 app.json | 对比 pages/*/index.js 和 app.json |
