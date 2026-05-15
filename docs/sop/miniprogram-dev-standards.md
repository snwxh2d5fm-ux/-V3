# SOP: 微信小程序开发规范

**维护者**: MT天衣  
**版本**: v1.0  
**最后更新**: 2026-05-15

---

## 一、ES5强制规范

微信小程序原生框架要求ES5兼容，违反会在低版本基础库crash。

**禁止**:
```javascript
// ❌ 禁止
const x = 1
let y = 2
const fn = () => {}
const obj = { ...other }
new Set([1, 2, 3])
```

**正确**:
```javascript
// ✅ 正确
var x = 1
var y = 2
var fn = function() {}
var obj = { a: other.a, b: other.b }  // 显式字段赋值
// Set → 对象模拟: var seen = {}; seen[key] = true
```

**Page()内铁律**: 只用 `var` + `function(){}`，禁 `const`/`let`/`=>`/spread。

---

## 二、WXSS令牌规范

颜色/字号/间距必须用设计令牌变量，禁止硬编码。

```css
/* ❌ 禁止 */
color: #333333;
font-size: 14px;
padding: 16px;

/* ✅ 正确 */
color: var(--color-text-primary);
font-size: var(--font-size-body);
padding: var(--spacing-md);
```

令牌定义在 `app.wxss`，前缀规则：
- `--color-*` 颜色
- `--font-*` 字体
- `--spacing-*` 间距
- `--radius-*` 圆角

---

## 三、空值保护规范

所有链式访问必须加守卫，防止undefined报错白屏。

```javascript
// ❌ 危险
var name = user.profile.name

// ✅ 安全
var name = user && user.profile && user.profile.name
```

---

## 四、云函数规范

**结构模板**:
```javascript
// cloudfunctions/{name}/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  var action = event.action
  try {
    if (action === 'xxx') {
      return await handleXxx(event)
    }
    return { code: 400, message: '未知action: ' + action }
  } catch (e) {
    return { code: 500, message: e.message || '服务异常' }
  }
}
```

**规则**:
- action分支 + 统一返回 `{code, message, data}`
- 超时设置20s（cloudbaserc.json）
- wx-server-sdk版本锁定（package.json中固定版本号）
- 禁止在云函数中console.log敏感数据

---

## 五、提交格式规范

```
模块: 变更说明（中文，单次聚焦单一变更）

示例:
fix: fetchByPath传参5→4，housingIntent不移交云函数
feat: 攻略精选Tab4 WXML渲染块
docs: CLAUDE.md增强
```

**禁止**: 一次commit混入多个模块变更。

---

## 六、包体积规范

- 单包不超过2MB
- 图片走云存储（cloud://），不打包进小程序
- `data/` 下大型JSON文件注意体积
- 定期 `du -sh pages/ data/ utils/ components/` 检查

---

## 七、K2隐私安全规范

**铁律，违反任一条立即修复**:

1. 测试数据脱敏：mock数据用占位符（主申请人/配偶/子女A）
2. 严禁真实姓名：代码/注释/测试/日志中不得出现真实姓名
3. 严禁真实证件号：测试用明显假数据（110101199001011234）
4. OCR测试数据：使用虚构人物
5. console.log审计：提交前检查无PII泄漏

**测试数据命名规范**:
```
本人:    主申请人 / self_user
配偶:    配偶 / spouse_user
子女:    子女A / child_a
证件号:  110101199001011234（明显虚构）
手机号:  13800138000（测试号段）
```

---

## 八、WXML规范

- 标签必须配对，禁止多余 `</view>`
- 条件渲染用 `wx:if` / `wx:elif` / `wx:else`，不遗漏分支
- 列表渲染必须加 `wx:key`
- 禁止双重 `wx:for`（verify.sh A1检查）

---

## 九、异常处理模式

微信原生Page()的4个通用模式：

| 模式 | 场景 | 手法 |
|------|------|------|
| try/catch降级 | onShow/onLoad异常→白屏 | 外层try/catch + setData降级到安全状态 |
| 深拷贝防泄漏 | {...obj}浅拷贝导致数组共享引用 | JSON.parse(JSON.stringify(obj)) |
| 存储操作失败保护 | saveXxx()静默失败 | try/catch + wx.showToast |
| ES5兼容 | const/=>/Set在低版本基础库crash | var + function(){} + 对象代替Set |

---

## 十、匹配链设计原则

```
Level 1: 精确匹配 — 有明确上下文时优先（如 slotKey）
Level 2: 类型匹配 — 有分类推导时使用（如 type）
Level 3: 模糊匹配 — 名称包含关系（兜底）
Level 4: 宽松兜底 — 同分类无上下文（最后手段）
```

每级独立 if-return，不要把多级条件挤在一个 `||` 里。
