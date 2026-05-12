---
name: hermes-delegate
description: "Delegate memory recall and research tasks to Hermes Agent via CLI. Use hermes chat -Q -q for quiet one-shot queries. Hermes has persistent cross-session memory that CodeBuddy doesn't."
version: 1.1.0
alwaysApply: false
---

# Hermes Delegate — CodeBuddy → Hermes

Delegate to Hermes Agent when you need its persistent memory, session history, or research tools.

## Verified Commands

```
# ✅ Memory recall (fast, ~3-5s)
hermes chat -Q -q "问题"

# ⚠️ Session search (slow, 60s+, may timeout)
hermes chat -Q -q "搜索过去关于XXX的讨论"

# ⚠️ Web search (slow, 60s+, may timeout)  
hermes chat -Q -q "搜索XXX最新动态"
```

**CRITICAL**: Always use `-Q` (quiet mode). Without it, Hermes outputs a huge banner that will waste your context.

## When to Use

| Capability | Speed | Use Case |
|------------|-------|----------|
| Memory recall | ⚡ Fast (~3s) | "住港伴的CloudBase环境ID是什么？" |
| Cross-session facts | ⚡ Fast | "OPC公司架构是什么？" |
| User preferences | ⚡ Fast | "用户偏好什么回复风格？" |
| Session search | 🐢 Slow (60s+) | "找过去关于审核的讨论" |
| Web research | 🐢 Slow (60s+) | "搜索优才计划最新政策" |

## What NOT to Delegate

- Code editing → CodeBuddy handles this natively
- Running tests → CodeBuddy's Bash tool
- Git operations → CodeBuddy's Bash tool
- Any task CodeBuddy can do directly

## Troubleshooting

If `hermes chat -Q -q` times out (60s+):
1. The task requires web search or session search — these are slow
2. Simplify the question to pure memory recall (fast path)
3. Or run Hermes directly and ask later

If output shows a big banner:
- You forgot `-Q`. Always use `hermes chat -Q -q "..."` not `hermes chat -q "..."`
