# 🔒 RESTRICTED — initTestState 兜底 mockLogin

> P1 | Hermes | 2026-05-13

## 现状

麒麟 E2E 连接成功（17s），但 12/12 测试秒败——`tests/e2e/helpers/index.js:287` 的 `initTestState()` 检测 `auth_token` 为空后直接 `throw Error`。新机器无本地缓存，`globalSetup` 未写入 token 时全崩。

天元有历史缓存所以没触发这个问题。

## 涉及文件

`tests/e2e/helpers/index.js` — `initTestState()` 函数 (~line 282-288)

## 修改

```javascript
// 现状（抛错）
async function initTestState(mp) {
  var hasToken = await mp.evaluate(function() {
    return wx.getStorageSync('auth_token');
  });
  if (!hasToken) {
    throw new Error('Test state not initialized');
  }
}

// 改为（兜底 mockLogin）
async function initTestState(mp) {
  var hasToken = await mp.evaluate(function() {
    return wx.getStorageSync('auth_token');
  });
  if (!hasToken) {
    // 新机器无缓存 → 先 mock 登录再继续
    await mockLogin(mp);
    hasToken = await mp.evaluate(function() {
      return wx.getStorageSync('auth_token');
    });
    if (!hasToken) {
      throw new Error('Test state not initialized — mockLogin failed');
    }
  }
}
```

## 影响

麒麟 + 玄武（任何新机器 / 清缓存后）均受益。
