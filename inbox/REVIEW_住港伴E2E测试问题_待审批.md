# 🔒 RESTRICTED — 琅琊审批

> 状态: pending_user_approval | 来自: Hermes (天元)
> 创建: 2026-05-13 19:30

## 待审批事项

| # | 事项 | 优先级 | 建议 |
|---|------|:--:|------|
| 1 | 天元 L1 automator WebSocket 频繁断连 | P0 | 修复 helpers/index.js 中的 evaluate/reLaunch 调用 |
| 2 | 麒麟/玄武 automator 版本兼容 | P1 | setup.js 加 cliPath 参数，处理 DevTools 2.01 版本号 |

---

## Bug #1: L1 automator WebSocket 频繁断连 [P0]

**现状**: 天元跑 L1 全量 30 项测试，仅 13 项通过（43%）。17 个失败全部是 WebSocket 断连（`Connection closed`），集中在 `clearStorage` 的 `mp.evaluate()` 调用和 `reLaunch` 导航。

**期望**: 全 72 项稳定通过，无 WebSocket 断连。

**涉及文件**:
- `tests/e2e/helpers/index.js:257` — `clearStorage()` 使用 `mp.evaluate()` 
- `tests/e2e/setup.js:28` — `automator.launch()` 配置
- `tests/e2e/specs/documents.test.js` — `reLaunch` 导航断连
- `tests/e2e/specs/reminders.test.js` — `clearStorage` 断连

**实现要点**:
1. 将 `clearStorage()` 从 `beforeEach` 移到 `beforeAll`（整个 describe 仅调一次）
2. 用 `mp.evaluate(() => wx.switchTab({ url }))` 替代 `mp.switchTab()` 绕过 automator 内部方法
3. 删除 `afterEach` 中的截图（加重 WebSocket 负载）
4. 参考 QA gate skill 中的 v0.12 API 陷阱文档

**触发条件**: `evaluate()` 每次需要 WebSocket 往返。`beforeEach` 中连续调用（`clearStorage` + `mockLogin`）耗尽连接。`reLaunch()` 重新初始化运行时断开 WebSocket。

---

## Bug #2: 麒麟/玄武 automator 找不到 DevTools [P1]

**现状**: 麒麟和玄武的 DevTools 安装在 `~/Applications/`（Intel Mac，无 sudo 权限）。`tests/e2e/setup.js` 未传 `cliPath`，automator 默认去 `/Applications/` 查找。麒麟建了软链接后，automator 的 `cmpVersion` 又因 DevTools `--version` 输出格式不匹配而报错。

**期望**: 麒麟和玄武能像天元一样独立运行 L1 automator 测试。

**涉及文件**: `tests/e2e/setup.js:28`

**实现要点**:
```javascript
const mp = await automator.launch({
  projectPath: PROJECT_PATH,
  cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',  // 显式指定
});
```
或者通过环境变量 `WECHAT_IDE_CLI` 传入路径，避免硬编码。同时在麒麟上 `ln -s ~/Applications/wechatwebdevtools.app /Applications/wechatwebdevtools.app` 已建好。

---

## 琅琊需决策

1. Bug #1 是否 P0 立即修？（当前仅 43% 通过率，测试不可靠）
2. Bug #2 是否 P1 本迭代内修？（麒麟/玄武已部署但测试跑不起来）
