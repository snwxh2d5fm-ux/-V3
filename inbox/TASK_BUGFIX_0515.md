# TASK: 真机测试Bug修复 — 账号符生 2026-05-15

**来自**: Hermes PMO
**发给**: Claude (唯一代码源)
**优先级**: 🔴 P0 + P1
**状态**: 立即执行

## 背景

琅琊真机测试账号「符生」，发现6个bug。1个CRASH级别直接导致连锁故障。

## 修复清单（按文件分组，共4个文件）

### 1. pages/documents/index/index.js line 422 — 🔴 P0-CRASH

```diff
-    var computeSlotStates = require('../../data/document-index-templates').computeSlotStates;
+    var computeSlotStates = require('../../../data/document-index-templates').computeSlotStates;
```

路径少了一层 `../`。同文件 line 176 已有正确写法，line 422 遗漏。

### 2. utils/onboarding-storage.js line 55-57 — 🔴 P1

```diff
     phases: {
+      '0': { unlocked: true, completed: false },
       '1': { unlocked: true, completed: false }
     },
```

`initOnboarding` 只解锁了关卡1，关卡0从未初始化。`mergeProgress` 检查 `progress.phases[0].unlocked` 时返回 undefined → 判定锁定。

### 3. pages/guidebooks/index/index.js line 203 — 🟡 P1

```diff
-    promise.then(function(r) { if (r) self.setData({ browseTasks: r.data || (r.data ? r.data.data : []) }); });
+    promise.then(function(r) { 
+      if (r && r.data) {
+        var tasks = r.data.tasks || r.data.data || (Array.isArray(r.data) ? r.data : []);
+        self.setData({ browseTasks: tasks }); 
+      }
+    });
```

`cache.fetchAllTasks()` 和 `fetchTasks()` 返回 `{ data: cloudFnResponse, ... }`。原始代码 `r.data || (r.data ? r.data.data : [])` 取了object而非数组。

### 4. pages/guidebooks/index/index.js line 169-173 — 🟡 P1

攻略精选的 `onArticleTap` 跳转到 `/pages/documents/detail/detail`（证件详情），应改为文章阅读页。检查是否存在文章详情页路由，如不存在先用以下过渡方案：

```diff
   onArticleTap: function(e) {
     var id = e.currentTarget.dataset.id;
+    var article = this.data.articles.find(function(a) { return a._id === id; });
     if (id) {
-      wx.navigateTo({ url: '/pages/documents/detail/detail?id=' + id });
+      // 如果 config 中注册了 guidebooks/detail 路由则跳转，否则用 webview
+      wx.navigateTo({ url: '/pages/guidebooks/detail/detail?id=' + id });
     }
   },
```

如果 `pages/guidebooks/detail/detail` 路由不存在，需要在 `app.json` 注册并创建页面组件。

### 5. pages/reminders/index/index.wxml line 125-129 — 🟡 P1

提醒完成按钮改为 toggle 机制：

```diff
-          <view class="card-actions" wx:if="{{reminder.status === 'active'}}" catchtap="stop">
-            <button class="btn btn-success btn-sm" bindtap="markComplete" data-id="{{reminder.id}}">✓ 完成</button>
-            <button class="btn btn-outline btn-sm" bindtap="viewReminder" data-id="{{reminder.id}}">详情</button>
-          </view>
+          <view class="card-actions" catchtap="stop">
+            <button wx:if="{{reminder.status !== 'completed'}}" 
+                    class="btn btn-muted btn-sm" bindtap="markComplete" data-id="{{reminder.id}}">未完成</button>
+            <button wx:else 
+                    class="btn btn-success btn-sm" disabled>☑️ 完成</button>
+            <button class="btn btn-outline btn-sm" bindtap="viewReminder" data-id="{{reminder.id}}">详情</button>
+          </view>
```

同时需要在 WXSS 中增加 `.btn-muted` 灰色按钮样式（如 `background:#9CA3AF; color:#fff`）。

---

## 验证

修复后请：
1. 运行 `verify.sh` 确认无引入新错误
2. 提交 commit，message: `fix: P0-4 require路径 + P1-6~P1-9 真机测试bug修复`
3. 推送到 main
