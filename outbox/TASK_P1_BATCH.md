# TASK: P1修复批次 — 5项

**分派**: Hermes → Claude  
**创建**: 2026-05-15 09:50  
**状态**: 🔴 待修复  
**前序**: P0修复已闭环(29e82cb)

---

## P1-1: wizardBudget直接操作this.data绕过setData

**文件**: `pages/guidebooks/index/index.js` L331-333

```javascript
// 当前 — 直接赋值，不触发视图更新
if (step === 0) this.data.wizardBudget = value;
else if (step === 1) this.data.wizardWork = value;
else if (step === 2) this.data.wizardHasKids = value === 'yes';
```

**修复**: 统一用 `this.setData({ wizardBudget: value })` 等。注意step 2需同时setData wizardHasKids。

---

## P1-2: Object.values()不兼容低版本微信基础库

**文件**: `pages/guidebooks/index/index.js` L122

```javascript
// 当前
summary: { totalRequired: Object.values(phaseMap).reduce(...) }
```

**修复**: 改为 `Object.keys(phaseMap).map(function(k){return phaseMap[k]}).reduce(...)` 保持与其他文件风格一致。

---

## P1-3: WXML urgency class硬编码中文枚举

**文件**: `pages/guidebooks/index/index.wxml` L60 + `index.js`

```xml
<!-- 当前 — 三元表达式硬编码中文→CSS class映射 -->
class="task-urgency urgency-{{task.urgency==='必修'?'required':(task.urgency==='建议'?'suggest':'optional')}}"
```

**修复**: 在 `mergeProgress` 中预计算 `task._urgencyClass`（'required'/'suggest'/'optional'），WXML改为 `urgency-{{task._urgencyClass}}`。

---

## P1-4: wx-server-sdk使用"latest"版本号

**文件**: `cloudfunctions/queryLifeGuideTasks/package.json` L7

```json
"wx-server-sdk": "latest"
```

**修复**: 锁定为 `"~2.6.0"`，确保确定性构建。其他云函数同样检查。

---

## P1-5: onStepCheck未防御task.steps缺失

**文件**: `pages/guidebooks/index/index.js` L239

```javascript
// 当前 — task.steps可能为undefined
var allDone = task.steps.every(function(s) { return task['_step' + s.seq]; });
```

**修复**: 前置防御 `if (!task.steps || !task.steps.length) return;`

---

## 回归验证

| # | 验证项 | 方法 |
|---|--------|------|
| 1 | wizardBudget通过setData | DevTools → 向导选择预算 → 检查AppData |
| 2 | Object.values替换后功能不变 | 确认phases统计与修复前一致 |
| 3 | urgency class预计算 | 检查task._urgencyClass字段存在且正确 |
| 4 | wx-server-sdk版本 | package.json检查 |
| 5 | steps缺失不崩溃 | 模拟云函数返回无steps的task |
| 6 | verify.sh | 38+/39 |
| 7 | Jest smoke | 39 pass |
| 8 | DevTools编译 | quit→open→auto-preview |

---

**:pushpin: Hermes注**: 仅修P1-1~P1-5。不要改其他文件（上次ai-chat/Documents擅改已回退）。修完通知Hermes复闸。
