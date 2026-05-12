# 微信小程序开发纪律

> 规则类型: 硬约束 (违反则编译不通过或运行时崩溃)

## 代码规范

1. **原生 Page() 必须用 `function(){}` 和 `var`**，禁止箭头函数、async、IIFE
2. **WXML 禁止双重 wx:for 同元素**，必须用 `<block>` 包裹
3. **button 原生样式**必须显式 `::after { border: none }` + `line-height: 1.4`
4. **switchTab 在 redirectTo 链后静默失败**，改用 `wx.reLaunch`

## 匹配引擎规范

5. **parseIncome/parseCapital 必须用 `startsWith`** 而非 `includes` — 防止子串误判
   - 例: "HK$100-250万" 包含 "HK$250" 子串，`includes` 会误判为 ≥250万
6. QMAS 12准则阈值 ≥6，低于阈值不显示优才结果（但应在结果页给出"差1-2项"的提示）
7. hasKids → dependent/minor 仅 persona===9（陪读家长）触发

## 安全规范

8. guidebook-data.js 所有内容必须通过 `redactContent()` 脱敏
9. ai-chat 四模式安全规则不得移除或弱化
10. 不得在代码中硬编码用户个人信息（姓名/手机/证件号）
