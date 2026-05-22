# REVIEW: 闸门基础设施恢复 — **tests**/scripts/tests 重新纳入版本控制

**日期**: 2026-05-19
**来源**: Hermes 闸门
**优先级**: P1

---

## 背景

commit `336d336` 误删了 `__tests__/` `tests/smoke/` `scripts/verify.sh` `scripts/workflow-verify.sh`。
Hermes 已从 `15e13e2` 恢复到工作区，当前状态为 untracked。需 commit 回版本控制。

## 修复

```
cd ~/Downloads/港动人生/住港伴V3-开发中
git add __tests__/ tests/ scripts/
git commit -m 'fix: 恢复闸门基础设施 — __tests__/tests/scripts 从336d336误删中恢复'
git push origin main
```

## 验证

- `ls __tests__/jest-setup.js` 存在
- `ls scripts/verify.sh` 存在
- `ls tests/smoke/` 存在
- `npx jest tests/smoke/` 31/35+
- git status 干净

## 铁律

仅提交这3个目录，不动其他文件。
