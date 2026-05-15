# REVIEW: WXSS修复 P0-1 + P0-2 + P1-1
日期: 2026-05-15
优先级: P0 阻断复闸
来源: QA包拯 Gate 3/4/5 阻断报告

---

## P0-1: 18个WXSS文件行号污染（Gate 3 阻断）

**现状**: UI马良令牌迁移时 read_file→write_file 未剥离行号前缀，导致6个（天元确认）WXSS文件每行开头含 `     1|` `     2|` 等行号前缀。DevTools编译器报CSS语法错误，项目无法编译。

**期望**: 所有WXSS文件内容为纯净CSS，无行号前缀。DevTools编译通过。

**涉及文件**（天元已确认路径）:
1. components/floating-ai/floating-ai.wxss
2. components/stage-indicator/stage-indicator.wxss
3. components/ux-error-boundary/ux-error-boundary.wxss
4. components/ux-skeleton/ux-skeleton.wxss
5. pages/documents/add/add.wxss
6. pages/mine/index/index.wxss

**实现要点**: 对每个文件，去掉行首的 `^\s*\d+\|` 前缀（正则：每行开头的空格+数字+竖线）。修复后所有6个文件必须commit到git。

---

## P0-2: 6处var(--white)3e0 CSS语法错误（Gate 4 麒麟不放行）

**现状**: 代码中存在6处 `var(--white)3e0` 这样的非法CSS值，是令牌迁移时拼接错误产生的。麒麟代码审查标记为P0 CSS语法错误。

**期望**: 将所有 `var(--white)3e0` 替换为正确的令牌引用 `var(--color-white)` 或直接用 `#FFFFFF`。

**实现要点**: 全局搜索 `var(--white)3e0`，替换为 `var(--color-white)`。确认tokens.wxss中 `--color-white` 已定义（如未定义则用 `#FFFFFF`）。

---

## P1-1: Tab4数据路径错误（Gate 5 玄武不放行）

**现状**: Tab4攻略精选的数据读取路径为 `res.result.articles`，但云函数实际返回结构是 `res.result.data.articles`，导致Tab4功能断裂，文章列表无法渲染。

**期望**: 数据路径修正为 `res.result.data.articles`，Tab4攻略精选正常渲染文章列表。

**涉及文件**: pages/process/index.js 或 pages/guidebooks/index/index.js（请确认实际调用位置）

**实现要点**: 搜索 `res.result.articles`，替换为 `res.result.data.articles`。同时检查是否有其他地方引用了同样的错误路径。

---

## 验收标准

修复完成后，QA包拯将立即执行复闸：
- Gate 3: DevTools编译通过，无CSS语法错误
- Gate 4: 麒麟代码审查放行，无P0 CSS错误
- Gate 5: 玄武PRD审查放行，Tab4功能正常

请修复完成后在outbox写入完成通知。
