# 小程序开发规范

> 规则类型: 硬约束 (所有小程序代码改动必须满足)
> 版本: 1.0 · 2026-05-15
> 维护: MT天衣

---

## WXSS 令牌规范

### 强制引用设计令牌

所有颜色、字号、间距、圆角必须使用 CSS 变量，禁止硬编码：

```css
/* ✅ 正确 */
color: var(--color-primary);
font-size: var(--font-size-md);
padding: var(--spacing-md);
border-radius: var(--radius-md);

/* ❌ 禁止 */
color: #1890FF;
font-size: 14px;
padding: 12px;
border-radius: 8px;
```

### 令牌来源

所有令牌定义在 `app.wxss` 和 `styles/tokens.wxss`，不得在组件内重新定义。

### 野色黑名单

以下色值已被 DSG-3 标记为非令牌色，禁止新增使用：
- `#9CA3AF` → 使用 `var(--color-text-tertiary)`
- `#6B7280` → 使用 `var(--color-text-secondary)`
- `#F3F4F6` → 使用 `var(--color-bg-secondary)`
- `#E5E7EB` → 使用 `var(--color-border)`

---

## WXML 结构规范

### 禁止双重 wx:for 同元素

```xml
<!-- ❌ 禁止：同一元素同时有两个 wx:for -->
<view wx:for="{{list}}" wx:for-item="item" wx:for-index="idx">

<!-- ✅ 正确：嵌套结构 -->
<view wx:for="{{outerList}}" wx:for-item="outer">
  <view wx:for="{{outer.items}}" wx:for-item="inner">
```

### 图片必须有 alt 文本

```xml
<!-- ❌ 禁止 -->
<image src="{{url}}" />

<!-- ✅ 正确 -->
<image src="{{url}}" aria-label="证件照片" />
```

### 新增页面必须注册 app.json

每次新增页面路径，必须同步更新 `app.json` 的 `pages` 数组。

---

## 云函数规范

### 命名规则

- 格式：`{功能}-{动词}` 或 `{模块名}`
- 示例：`ocr-service`、`preaudit-engine`、`reminder-engine`
- 禁止：拼音缩写、无意义数字后缀

### 超时配置

- 普通查询：10秒
- OCR/AI调用：30秒
- 批量处理：60秒（标准版上限）

### 错误处理

所有云函数必须返回统一格式：

```js
// 成功
{ code: 0, data: {...}, message: 'ok' }

// 失败
{ code: -1, data: null, message: '具体错误描述' }
```

---

## K2 隐私红线

以下数据禁止明文存储或日志输出：

- 身份证号、护照号、HKID
- 手机号、邮箱（脱敏后可存）
- 银行卡号、支付信息
- 人脸/指纹生物特征

违规会被 `verify.sh` A8 检查项拦截。

---

## 安全区处理

所有页面底部操作区必须添加安全区适配：

```css
.safe-bottom {
  padding-bottom: calc(var(--spacing-md) + env(safe-area-inset-bottom));
}
```

当前仅 6/31 页面有此处理，新增页面必须包含。

---

## 检查命令

```bash
# 全量门禁（含本规范检查项）
bash scripts/verify.sh

# DSG令牌合规专项检查
bash scripts/check-dsg-tokens.sh
```
