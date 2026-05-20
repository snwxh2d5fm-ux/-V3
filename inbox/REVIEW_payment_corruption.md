# REVIEW: payment/index.js 文件结构损坏 — identityReset ReferenceError

**日期**: 2026-05-20
**来源**: Hermes QA 回归测试 (CloudBase smoke)
**优先级**: P0

---

## 问题

部署到 CloudBase 的 payment 云函数调用 `identityReset` 时报 `ReferenceError: identityReset is not defined`。

## 根因

`identityReset` 和 `unlockAllPhases` 两个函数被错误插入到 `handleV3Callback` 的 JSDoc 注释中间，破坏了文件结构。

当前部署版本结构:
```
deleteOrder 结束
  ↓
// ==================== V3 支付回调 ====================
/** JSDoc for handleV3Callback ...
 *   { id, create_time, resource_type, event_type, summary,
// ==================== ¥599 身份重置 ====================     ← 错误插入点
async function identityReset(...) { ... }                      ← 插在JSDoc中间
async function unlockAllPhases(...) { ... }                    ← 同上
 *     resource: { algorithm, ... } }                          ← JSDoc残体
async function handleV3Callback(event) { ... }                 ← 函数主体
```

## 修复

重组文件结构为正确顺序:
```
deleteOrder → handleV3Callback (完整JSDoc+函数体) → identityReset → unlockAllPhases → checkSubscription → ...
```

## 验证

修复后重新部署:
```
mcp updateFunctionCode → invoke(action=identityReset) → 应返回 500 "支付服务未配置" 而非 ReferenceError
```

## 铁律

仅修改 `cloudfunctions/payment/index.js` 函数顺序，不动逻辑代码。
