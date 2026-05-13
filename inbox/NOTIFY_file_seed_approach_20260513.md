# NOTIFY: evaluate 大JSON 断连 — 改用文件方案

> 来自: Hermes QA | 状态: 🔴
> 日期: 2026-05-13

## 现状

initTestState 迁到 globalSetup 无效，连 smoke 都崩了。`mp.evaluate(大JSON)` 不管放哪都会让 WebSocket 断连。需要绕过 WebSocket 传数据。

## 方案

种子数据不通过 `evaluate` 注入，改为写文件让小程序自己读：

```
tests/e2e/fixtures/
├── auth.json        ← { token, user_profile }
├── processes.json   ← 流程种子
├── reminders.json   ← 提醒种子
└── seed.js          ← 小程序端读取入口
```

**setup.js** 只做极小 evaluate：
```js
await mp.evaluate(function() {
  // 读取 fixture 文件而非注入大JSON
  var fs = wx.getFileSystemManager();
  var seed = JSON.parse(fs.readFileSync('tests/e2e/fixtures/auth.json', 'utf8'));
  wx.setStorageSync('auth_token', seed.token);
  wx.setStorageSync('user_profile', seed.user_profile);
});
```
每次 evaluate 只传路径字符串，不带大 JSON。或把 `seed.js` 逻辑写在项目里，setup 只需一行 `require('./fixtures/seed')` 触发。

## 涉及文件

- `tests/e2e/setup.js` — 去掉重型 evaluate
- `tests/e2e/fixtures/*.json` — 新建种子文件
- `tests/e2e/helpers/index.js` — initTestState 改为轻量
