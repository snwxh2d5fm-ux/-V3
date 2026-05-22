# REVIEW: Phase 2 双审发现 — 5项P0修复

**日期**: 2026-05-20
**来源**: Hermes 9-Gate (麒麟+玄武)
**优先级**: P0 (阻塞)

---

## P0-A [麒麟] unlockAllPhasesPay — payData.payment 空值崩溃

**文件**: `pages/guidebooks/index/index.js:381-387`
**问题**: `payData.payment.timeStamp` 解引用前未检查 `payData.payment` 是否存在
**修复**: `wx.requestPayment` 前加:

```javascript
if (!payData || !payData.payment) {
  wx.showToast({ title: '支付参数异常', icon: 'none' });
  return;
}
```

## P0-B [麒麟] guidebook-sync — sanitizeProgress 突变入参

**文件**: `cloudfunctions/guidebook-sync/index.js:105`
**问题**: `resolveConflict` push场景直接修改 `event.progress` 对象，随后 `delete` 掉 `imagePath`
**修复**: resolveConflict 入口处 deepClone 入参后再处理

## P0-C [玄武] unlockAllPhasesPay — 支付成功但未调 confirmPayment [最高优先]

**文件**: `pages/guidebooks/index/index.js:370-407` + `cloudfunctions/payment/index.js`
**问题**:

1. `wx.requestPayment` success 回调只 toast+init，**未调 payment.confirmPayment**
2. `confirmPayment` 不处理 `guidebook_unlock` 订单类别
3. 只有 V3 回调写 `guidebookAllUnlocked`，Event 函数回调可能不触达
   **影响**: 用户付 ¥9.90 后关卡永久不解锁
   **修复**:
4. success/fail 回调中调用 `wx.cloud.callFunction({name:'payment',data:{action:'confirmPayment',orderId}})`
5. `payment.confirmPayment` 增加 `guidebook_unlock` 处理: `if (order.category === 'guidebook_unlock') { update users set guidebookAllUnlocked=true }`
6. 同样修 `identityReset` 支付流程

## P0-D [玄武] guidebook-sync — timeout=5s 致命

**文件**: `cloudbaserc.json:23`
**问题**: 冷启动 3-5s，5s 超时极易触发
**修复**: timeout 改为 ≥15s

## P0-E [玄武] getProgress 从未被前端调用

**文件**: `utils/onboarding-storage.js` + `pages/guidebooks/index/index.js`
**问题**: 云函数有 `getProgress` action 但无前端调用。onShow 只读本地 Storage
**影响**: 设备A完成的任务在设备B永远不可见
**修复**: `onShow` 中增加 `guidebook-sync.getProgress` 调用，与本地 merge

---

## 铁律

仅修改上述文件（guidebooks/index.js, guidebook-sync/index.js, payment/index.js, cloudbaserc.json, onboarding-storage.js），不动其他代码。
