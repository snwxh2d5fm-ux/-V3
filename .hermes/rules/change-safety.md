# 变更安全护栏规则 v1.0

> 防止新增功能/格式化/重构时意外修改或删除已有代码

## 一、核心原则

**新增不删改**：任何 commit 的变更范围必须与 commit message 描述一致。超出范围的修改视为违规。

## 二、禁止行为

### 🔴 P0 阻断（禁止合并）

1. **删除 `process.env.X || fallback` 的 fallback 值**
   - 所有 `process.env.XXX || 'hardcoded'` 中的 `||` 兜底不得移除
   - 即使看起来是"硬编码"，它是在环境变量缺失时的防线

2. **修改非commit范围内的函数签名**
   - 如果 commit 是 `fix(ai-chat)`，不得修改 `user-auth` 的函数参数
   - 格式化 commit 只能改空格/换行/引号风格

3. **删除云端配置依赖的代码**
   - `cloud.init()`、`db.collection()`、集合名常量不得删除或改名
   - 环境变量名 `process.env.X` 不得改名（值可改，名不可改）

4. **删除现有API的action分支**
   - 云函数 `switch(action)` 的现有 `case` 不得删除
   - 只能新增 `case` 或修改 `case` 内部逻辑

### 🟡 P1 严重（需显式说明）

5. **删除已有数据文件**
   - `data/` 目录下的文件删除需在 commit message 中标明 `[DATA-DELETE]`

6. **修改数据库集合结构**
   - 字段重命名、删除字段需在 commit message 中标明 `[SCHEMA]`

### 🟢 P2 注意

7. **移动文件位置**
   - require 路径变更需全局搜索确认

## 三、自动化检测

### 3.1 预提交钩子 (.git/hooks/pre-commit)

```bash
#!/bin/bash
# 检测 fallback 删除
if git diff --cached | grep -P '^\-.*process\.env\.\w+\s*\|\|' | grep -v '^\-.*process\.env\.\w+\s*\|\|.*//.*KEEP'; then
  echo "🔴 BLOCKED: process.env fallback 被删除"
  echo "   如果是有意删除，请在行末加 // KEEP-INTENTIONAL 注释"
  exit 1
fi

# 检测 console.error/warn 删除
if git diff --cached | grep -P '^\-.*console\.(error|warn)\('; then
  echo "🟡 WARNING: console.error/warn 被删除，确认非误删"
fi
```

### 3.2 CI 检查 (verify-pipeline 扩展)

在 verify-pipeline.cjs 中新增：
- `checkFallbackRemoval()` — 扫描 diff 中 `|| fallback` 的删除
- `checkCrossModuleChanges()` — 变更文件数 > 50 且涉及 > 3 个模块时告警

## 四、人工检查清单

每次提交前自查：

- [ ] 我删除的任何代码行，是否在 commit message 中有说明？
- [ ] 我修改的文件是否超出了 commit message 描述的范围？
- [ ] 我是否删除了任何 `||` 兜底值？
- [ ] 如果是格式化 commit，是否只改了空格/引号/分号？
- [ ] 如果是重构，原功能是否至少有一个测试用例能通过？

## 五、回滚规则

如果发现误删：
1. `git log -S "被删除的关键字"` 找到删除它的 commit
2. `git show <commit>` 查看完整 diff
3. `git revert <commit>` 或手动恢复

## 六、最近案例

| 日期 | 误删内容 | 原因 | 影响 |
|------|----------|------|------|
| 2026-05-22 | `TOKEN_SECRET \|\| 'zhgb-internal-key'` | Phase 1+2 合并时格式化清掉 | 手机号登录崩溃 |
| 2026-05-22 | `data/tasks/` 目录 (176KB) | 未被引用但一直存在 | 主包超标 |

---

*最后更新: 2026-05-22*
