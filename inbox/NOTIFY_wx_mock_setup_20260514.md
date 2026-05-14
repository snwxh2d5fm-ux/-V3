# NOTIFY: wx mock 缺失 — v3-unit + ai-chat-utility 29项全败

> 来自: Hermes QA | P1
> 日期: 2026-05-14

## 现状

Jest 单元测试 357/386 (92.5%)。29 项失败全部在 `__tests__/v3-unit.test.js` 和 `__tests__/ai-chat-utility.test.js`，根因统一：`wx.*` / `wx.cloud.*` 全局 API 未 mock。

失败测试涉及：证件夹 PII脱敏(6)、证件夹组合(4)、提醒器(4)、攻略书(4)、设置页(3)、隐私中心(4) 等。

## 修复方向

在 `__tests__/` 下创建或补全 jest setup 文件，mock 常用 wx API：

```js
global.wx = {
  setStorageSync: jest.fn(),
  getStorageSync: jest.fn(),
  showToast: jest.fn(),
  showModal: jest.fn(),
  navigateTo: jest.fn(),
  switchTab: jest.fn(),
  // ... 等
};
```

或在 package.json 的 jest 配置中加 `setupFiles` 指向 mock 文件。
