# Claude 手术刀修复指令 — 精确到行

**铁律：只修改指定行，不改任何其他代码。**

## Bug #1 扫描增强Canvas超时
文件: utils/image-process.js
位置: 行152 ctx.draw(false, callback)
修复: 将行152-163的 ctx.draw(false, function(){...}) 包裹在超时保护中：
```js
var timedOut = false;
var timer = setTimeout(function() { if(!timedOut){ timedOut=true; resolve(imagePath); } }, 8000);
ctx.draw(false, function() {
  if(timedOut) return;
  clearTimeout(timer);
  wx.canvasToTempFilePath({...});
});
```

## Bug #2 关卡0任务去重
文件: cloudfunctions/queryLifeGuideTasks/index.js
位置: 行112-118
修复: 在行118 return之前加去重：
```js
var seen = {};
filtered.tasks = filtered.tasks.filter(function(t){ if(seen[t._id]) return false; seen[t._id]=true; return true; });
```

## Bug #5 攻略精选数据加载
文件: pages/guidebooks/index/index.js
位置: 行160
修复: 行160改为：
```js
var articles = (res.result && res.result.data && res.result.data.articles) || (res.result && res.result.articles) || [];
```

## Bug #7 优才时间线(已在FIX_BATCH中详述)
文件: data/timeline-templates.js
位置: 行15 qmas nodes[0].offsetDays
修复: 将 offsetDays: -90 改为 offsetDays: 0, desc追加"（当天起）"

## Bug #9 配偶子女过滤
文件: cloudfunctions/queryLifeGuideTasks/index.js
位置: 行34-36 family_status过滤
修复: 工作经历/资产/申请材料类任务不检查family_status。在行35之后加：
```js
var skipFamilyCheck = (at.scene_tags||[]).some(function(t){ return ['工作','资产','申请'].indexOf(t)>=0; });
```
然后在行35条件中加 `&& !skipFamilyCheck`

## Bug #11 双面选择(已详述)
文件: pages/documents/add/add.js + add.wxml
需要恢复国徽面/人像面切换UI和逻辑

## Bug #12 PDF合并(已详述)
文件: pages/documents/ 或 cloudfunctions/
需要恢复PDF合并功能
