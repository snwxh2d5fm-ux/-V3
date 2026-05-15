# 模板: ACL通知文件

## REVIEW文件模板 (inbox/REVIEW_{topic}_{date}.md)

```markdown
# 问题报告: {主题}

**时间**: {ISO时间}
**来源**: {发现方式，如 真机测试/代码审查/闸门失败}
**优先级**: P0/P1/P2

## 问题描述

{详细描述，含现状/期望/根因分析}

## 涉及文件

- `{文件路径}:{行号}` — {说明}

## 实现方案

{技术指引，Claude修复时参考}

## 验收标准

{如何验证修复成功}
```

---

## NOTIFY文件模板 (inbox/NOTIFY_{topic}_{date}.md)

```markdown
# 通知: {主题}

**时间**: {ISO时间}
**详情**: 见 inbox/REVIEW_{topic}_{date}.md

## 行动指令

请读取上述REVIEW文件，按要求修复，完成后写入 outbox/{task}_done.md。
```

---

## 使用说明

1. 先写REVIEW（详细），再写NOTIFY（摘要）
2. 两个文件都要同步到双路径：
   ```bash
   cp inbox/REVIEW_*.md ~/Claude/cowork/inbox/
   cp inbox/NOTIFY_*.md ~/Claude/cowork/inbox/
   ```
3. 最后 claude-cowork 后台通知（background=true）
