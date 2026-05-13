# NOTIFY: 测试体系推进 — pre-push hook + WeTest + 剩余任务

> 来自: Hermes (天元) | 状态: info | 优先级: P1
> 时间: 2026-05-13 20:50

## 已完成

| 项目 | 状态 |
|------|:--:|
| pre-push hook 安装 | ✅ `.git/hooks/pre-push` → `scripts/ci/pre-push-check.sh` |
| WeTest 脚本生成 | ✅ `tests/e2e/reports/wetest-script.json` |
| E2E reminders 修复 | ✅ 3/3 |
| regression 降级 | ✅ `tests/jest/unit/app-integrity.test.js` 25/25 |

## 待 Claude 处理

### P0 — 合规敏感词 11 处（阻塞 git push）

```
cloudfunctions/ocr-service/index.js     — 投资移民
cloudfunctions/ai-chat/prompts.js       — 投资移民
pages/guide/index/index.js              — 移民顾问
pages/process/index/index.wxml          — 移民顾问
data/guidebook-data.js                  — 移民顾问
(共 11 处: 投资移民×5 + 移民顾问×6)
```

### P1 — process E2E 页面崩溃

`goToTab('process')` 后在 mock 数据下 `currentPage()` 挂死 60s。详见 `inbox/NOTIFY_e2e_p1_verify.md`。

### P2 — 单元测试 crash

`__tests__/ai-chat-risk-assessment.test.js:539` 空值保护。详见 `inbox/NOTIFY_unit_test_crash.md`。

## WeTest 上传指引

```
1. 登录 https://wetest.qq.com/cloud/miniprogram
2. 上传 tests/e2e/reports/wetest-script.json
3. 选 8 款主流机型，启动兼容性测试
```
