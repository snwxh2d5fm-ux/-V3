# REVIEW: d2f9ee9 Token 修复 — 安全性倒退 + this.缺失运行时崩溃

**日期**: 2026-05-18  
**来源**: Hermes 闸门双审 (麒麟+玄武) + 真机 automator 验证  
**优先级**: P0 (阻塞)

---

## 背景

commit `d2f9ee9` 声称修复"login Token全零"问题。旧代码使用 `wx.getRandomValues`（微信 CSPRNG）但存在异步陷阱（回调异步，同步返回未填充的 Uint8Array → 全零）。修复方案是**删除 `wx.getRandomValues`，改用 `Math.random()`**。

## 发现的问题

### P0-A: 加密强度倒退 — CSPRNG → Math.random [麒麟+玄武共识]

| | 旧代码 | 新代码 |
|---|--------|--------|
| 随机源 | `wx.getRandomValues` (CSPRNG, 128-bit) | `Math.random()` (xorshift128+, 确定性) |
| 安全级别 | 加密安全 | 非加密伪随机 |
| 可预测性 | 不可预测 | 可预测 (已知时间窗口+种子恢复即可爆破) |

**正确修复方向**: 旧代码根因是 `wx.getRandomValues` 异步回调未正确处理，应改为 Promise 包装后 await，而非降级到伪随机 API。

### P0-B: `this.` 缺失 → fallback 路径 ReferenceError [真机 automator 确认]

**文件**: `pages/login/login.js`  
**行号**: L158, L186

```javascript
// L158 — cloudLogin() 内
app.globalData.token = result.token || generateRandomToken();  // ❌ 缺 this.

// L186 — localLogin() 内
app.globalData.token = 'local_' + generateRandomToken();       // ❌ 缺 this.
```

**真机验证结果** (automator evaluate):
```
WITH this.:     ✅ token: "mpb9ss...4f25" (41 chars)
WITHOUT this.:  ❌ ReferenceError: generateRandomToken is not defined
```

`generateRandomToken` 定义在 `Page({})` 对象字面量内，不是全局函数。在 `cloudLogin`/`localLogin` 方法作用域内直接调用会抛 ReferenceError。

**为什么生产没炸**: `||` 短路——正常流程 `result.token` 始终存在，fallback 从未被触发。一旦云函数返回空 token，fallback 路径直接崩溃。

### P0-C: Token 暴露生成时间戳 [玄武]

新格式 `Date.now().toString(36) + '_' + 32hex`，时间戳直接嵌入 Token。攻击者根据 Token 推断生成窗口，配合 Math.random 可预测性，大幅降低爆破成本。

### P0-D: `_generateFallbackToken` 死代码 + 异步陷阱 [麒麟]

`pages/login/login.js` L239-254 定义了 `_generateFallbackToken()`（用 `wx.getRandomValues`），但：
- 全局搜索确认**无任何调用点**
- 函数本身存在同样异步陷阱（`wx.getRandomValues` 回调不触发 → 永远走 L253 fallback）
- 注释"确保调用wx.getRandomValues获取真随机字节"误导维护者

---

## 修复要求

### 必须修复 (P0)

1. **L211-216**: `generateRandomToken` 恢复使用 `wx.getRandomValues`，正确用 Promise 包装异步回调
2. **L158, L186**: 改为 `this.generateRandomToken()`
3. **Token 格式**: 移除时间戳前缀，使用纯随机 hex (32+ chars)

### 建议修复 (P1)

4. **L239-254**: 删除 `_generateFallbackToken` 死代码，或将正确实现合并到 `generateRandomToken` 的 catch 分支
5. **L216**: 确保降级 fallback（真随机API不可用时）有 `console.warn` 日志

### 技术指引

```javascript
// 正确实现示例:
generateRandomToken: function() {
  var self = this;
  return new Promise(function(resolve) {
    try {
      var arr = new Uint8Array(16);
      wx.getRandomValues({
        length: 16,
        success: function(res) {
          for (var i = 0; i < 16; i++) arr[i] = res.randomValues[i];
          var hex = Array.from(arr).map(function(b) {
            return ('0' + b.toString(16)).slice(-2);
          }).join('');
          resolve(hex);
        },
        fail: function() {
          console.warn('[login] wx.getRandomValues failed, using fallback');
          resolve(_generateFallbackToken());
        }
      });
    } catch(e) {
      console.warn('[login] getRandomValues error:', e.message);
      resolve(_generateFallbackToken());
    }
  });
}
```

**注意**: 调用方 `cloudLogin` 和 `localLogin` 需要改为 `await this.generateRandomToken()`，或使用 `.then()` 链。

---

## 验证清单 (Hermes 闸门)

- [ ] `this.generateRandomToken()` 调用正确
- [ ] `wx.getRandomValues` 异步 Promise 包装正确
- [ ] Token 格式不含时间戳
- [ ] DevTools 编译通过
- [ ] automator 验证: L158/L186 不再抛 ReferenceError
- [ ] automator 验证: Token 长度 32+ chars, 非全零, 两次调用不同

## 涉及文件

- `pages/login/login.js` — L158, L186, L211-217, L239-254
