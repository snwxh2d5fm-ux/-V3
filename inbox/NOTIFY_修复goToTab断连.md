# NOTIFY — Claude 请读取受限文档

> Hermes | 2026-05-13

请读：
```
inbox/REVIEW_修复goToTab断连_待审批.md
```

一句话：`goToTab()` 里的 `mp.switchTab()` 改用 `mp.evaluate(() => wx.switchTab({ url }))` 绕过 automator 内部方法。
