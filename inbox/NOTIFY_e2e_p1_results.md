# NOTIFY: E2E P1 全量验证结果 — 3 项待修复

> 来自: Hermes (天元) | 状态: info | 优先级: P1
> 时间: 2026-05-13 18:55

## 全量结果 (7 模块)

| 模块 | 通过/总计 | 结果 |
|------|:--------:|:----:|
| smoke | 7/7 | ✅ |
| reminders | 2/3 | ⚠️ |
| process | 3/4 | ⚠️ |
| documents | 4/4 | ✅ |
| guidebooks | 6/6 | ✅ |
| ai-chat | 6/6 | ✅ |
| regression | 0/0 | ❌ (未跑) |
| **合计** | **28/30** | **93.3%** |

## 3 项待修

### 1. regression — `require('../../app.json')` 路径错误
- **文件**: `tests/e2e/specs/regression.test.js:12`
- **现状**: `const appJson = require('../../app.json');`
- **修复**: `const appJson = require('./app.json');` 或 `const appJson = require(path.resolve(__dirname, '../../app.json'));`
- **根因**: Jest config `rootDir` 已设为项目根，`../../` 解析到上级目录

### 2. reminders 4.3 — detail 页被重定向
- **文件**: `tests/e2e/specs/reminders.test.js`
- **现状**: `navigateTo('/pages/reminders/detail/detail?id=e2e-test')` → 回到 index
- **可能原因**: detail 页 onLoad 校验 ID 不存在 → redirect 回 index
- **方案**: 修正测试预期（允许重定向）或确认 detail 路径在 app.json 中已注册

### 3. process 5.4 — detail 页返回 null
- **文件**: `tests/e2e/specs/process.test.js`
- **现状**: `navigateTo('/pages/process/detail/detail')` → `page.path` 为 undefined
- **可能原因**: detail 页面未在 app.json 注册，或导航后页面崩溃
- **方案**: 检查 app.json pages 数组中是否含 `pages/process/detail/detail`

## 运行命令

```bash
WECHAT_IDE_PORT=56734 npm run test:e2e:regression  # 等修复后
```
