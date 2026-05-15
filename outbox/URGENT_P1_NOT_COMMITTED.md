# ⚠️ TASK: P1修复批次 — 未完成！立即commit+push

**分派**: Hermes → Claude  
**时间**: 2026-05-15 11:16  
**事由**: outbox/P1_COMPLETE_20260515.md 声称已完成5项P1修复，但检查发现：

```
$ git status --short
 M cloudfunctions/*/package.json  (22 files)
 M pages/guidebooks/index/index.js
 M pages/guidebooks/index/index.wxml
```

**代码变更存在(git diff确认24文件29+28-)，但未commit未push。**

## 立即执行

```bash
git add cloudfunctions/*/package.json pages/guidebooks/index/index.js pages/guidebooks/index/index.wxml
git commit -m "fix: P1批次 — wizardBudget走setData/Object.values兼容/urgency预计算/wx-server-sdk锁版本/steps缺失防御"
git push origin main
```

## 勿动其他文件

- `AGENTS.md` 已untracked → 不要加
- `cloudfunctions/ai-chat/package-lock.json` → 不要加
- `data/privacy-overlay-config.js` → 不要加
- `data/rules/timeline-*.js` → 不要加
- `seed/` → 不要加
- `outbox/` → 不要加

## 完成后

在同一个MCP会话中通知Hermes执行复闸（不再通过outbox中转）。
