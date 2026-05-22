# REVIEW: 恢复测试集与当前代码对齐 — 全部预存失败修复

**日期**: 2026-05-19  
**来源**: pre-push hook 拦截  
**优先级**: P1 (阻塞 push)

---

## 背景

`829b504` 从 `15e13e2` 恢复了 `__tests__/` `tests/`，但主包瘦身后部分页面/文件/函数已重构或删除，旧测试引用失效。

## 失败清单

### 1. `__tests__/v3-unit.test.js` — 引用已删除页面

引用了 `pages/documents/detail/` `pages/documents/combine/` `pages/reminder/` 等已重构/删除的页面路径。

### 2. `tests/jest/unit/guidebook-data.test.js` — 数据文件已拆分

`data/guidebook-data.js` 已拆分为 `data/guidebook-cards.js` + 懒加载，测试引用路径失效。

### 3. `__tests__/smoke.test.js` — 模块已迁子包

`persona-path-compat.js` 已迁入子包，测试引用路径失效。

### 4. `__tests__/ai-chat-risk-assessment.test.js` — 引用已删除代码

7 项静态检查引用已移除的函数/模块：

- `content-moderation`
- `cleanHtmlTags`
- `v5Corrections`
- 等

## 修复策略

逐文件修复，原则：

- 页面/模块已删除 → 删对应测试
- 页面/模块已重命名 → 更新引用路径
- 函数已移除 → 删对应测试
- 匹配当前代码结构，不留死测试

## 验证

```
npx jest --forceExit 2>&1 | tail -5    # 全部通过
git push origin main                    # pre-push hook 通过
```

## 铁律

仅修改 `__tests__/` `tests/` 下的测试文件，不动业务代码。
