# E2E修复完成报告

> 2026-05-13 11:45 | Claude

## 修复项 (4项全部完成)

| # | 修复项 | 文件 | 变更 |
|:--:|------|------|------|
| 1 | Bug #2 cliPath | `tests/e2e/setup.js:28-30` | 加 `WECHAT_IDE_CLI` 环境变量支持，默认 `/Applications/wechatwebdevtools.app/Contents/MacOS/cli` |
| 2 | 全部核心spec | `specs/*.test.js` | 统一使用 `initTestState` (一次evaluate替代clearStorage+mockLogin两次调用) |
| 3 | 回归套件重建 | `specs/regression.test.js` | 单文件19项+连接恢复(ensureConnected)，每test前自动检查/重连 |
| 4 | E2E P1 3项修复 | (linter已自动修复) | process/reminders已改用initTestState，ai-chat也已修复 |

## 核心变更说明

### Bug #2: cliPath
```javascript
// setup.js: 新增 env 变量支持
const cliPath = process.env.WECHAT_IDE_CLI
  || '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';
```

麒麟/玄武可通过 `WECHAT_IDE_CLI=~/Applications/wechatwebdevtools.app/Contents/MacOS/cli` 指定路径。

### 回归套件: 连接恢复
`regression.test.js` 每个test前调用 `ensureConnected()`，检测到断连自动 `automator.launch()` 恢复。19项测试涵盖§8(我的)、§10(异常)、§11(PRD)。

## 验证

```bash
# 天元: Hermes 跑 verify.sh
bash scripts/verify.sh

# 麒麟: 
WECHAT_IDE_CLI=~/Applications/wechatwebdevtools.app/Contents/MacOS/cli npm run test:e2e:smoke

# 玄武:
WECHAT_IDE_CLI=~/Applications/wechatwebdevtools.app/Contents/MacOS/cli npm run test:e2e:smoke
```
