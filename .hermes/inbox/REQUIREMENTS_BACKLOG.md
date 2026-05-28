# 住港伴 V4 — 近期需求总览
> PD: 生活板块 | 2026-05-28 | 本会话产出

## 一、已交付（9-Gate 通过，已部署）

| # | 需求 | 文件 | commit |
|---|------|------|--------|
| R1 | 身份状态选择后同步 CloudBase + 进度条更新 + 攻略书解锁 | status-select.js, user-auth/index.js | f205b38 |

**R1 修复链路**：选择"已获批/在港" → saveStatus → CloudBase 写入 currentPhase/guidebookAllUnlocked → 进度条 stageProgress 更新 → 攻略书全解锁

---

## 二、已编码未部署（代码已写，9-Gate 待执行）

| # | 需求 | 文件 | 说明 |
|---|------|------|------|
| R2 | skip 用户同步 CloudBase | status-select.js (+1行) | stageMap 加 `skipped: 0`，暂不选身份的用户首次落库 |
| R3 | 年卡兑码同步攻略书解锁 | invite-code/index.js (+1行) | activateMembership 加 `guidebookAllUnlocked: true`，与 payment 云函数对齐 |

**部署依赖**：invite-code 云函数需执行 `tcb fn deploy --force`

---

## 三、PRD 已出待评审

| # | 需求 | 文档 | 变更范围 |
|---|------|------|------|
| R4 | 存储架构 v4：本地优先 + 云端备份恢复 | PRD_STORAGE_ARCHITECTURE_V4.md | 删 reminders/index.js 的 onShow 合并、db-admin 新增 restore action、app.js 新增新设备恢复 |

**核心规则**：本地有数据 → 信本地。本地空 → 从云端一次性恢复。永不合并。

---

## 四、测试待执行

| # | 需求 | 文档 | 场景数 |
|---|------|------|:--:|
| R5 | 真机冒烟测试 | DEVICE_TEST_CHECKLIST.md | 8 场景 22 检查点 |

---

## 五、运维待处理

| # | 需求 | 说明 |
|---|------|------|
| R6 | 符生账号清理 | 清除该测试账号本地 `__reminders__`，从零重建 |
| R7 | diagnose-user 云函数清理 | 已不再需要，从 CloudBase 删除 |

---

## 六、P3 记录（不排期）

| # | 需求 | 说明 |
|---|------|------|
| R8 | 5 处 `'user-auth'` 硬编码统一改用 constants | 全项目统一，范围大但优先级低 |

---

## 执行顺序建议

```
R2+R3 部署（invite-code 云函数）
  → R5 真机测试
  → R4 评审通过后开发
  → R6 符生清理
  → R7 清理诊断函数
```
