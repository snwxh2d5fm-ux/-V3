# TASK: P2修复回归 — 3个P0阻塞项

**分派**: Hermes → Claude  
**创建**: 2026-05-15 09:15  
**闸门**: Hermes 7/9 通过，双审发现3P0  
**状态**: 🔴 待修复

---

## 背景

P2修复批次提交了6个commit后被Hermes闸门拦截。7项静态闸门通过(verify 38/39, workflow 36/36, Jest 367/425, DevTools三连全绿)，但麒麟+玄武双审独立发现3个P0阻塞问题。

## P0-1: fetchByPath参数位移 → skip_if_existing完全失效

**文件**: `pages/guidebooks/index/index.js` L72 + `utils/lifeGuideCache.js` L194

**根因**: commit `cc4a0d3` 将调用处从5参数减为4参数（去掉housingIntent），但函数签名未同步修改。

```javascript
// index.js L72 — 调用方（4参）
cache.fetchByPath(params.visaType, params.familyStatus, params.arrivalScenario, params.existingAssets)

// lifeGuideCache.js L194 — 函数签名（5参）
function fetchByPath(visaType, familyStatus, arrivalScenario, housingIntent, existingAssets)
```

**后果**: `existingAssets` 数组被填入`housingIntent`形参，真正的`existingAssets`变为`undefined`。缓存key + 云函数传参全部错乱，`skip_if_existing`功能完全失效。

**修复方向**: 二选一：
- A) 函数签名同步去掉housingIntent参数（最快）
- B) 调用处恢复传housingIntent（如果云函数需要）

**修复后验证**: 检查缓存key是否包含正确资产列表，云函数日志中existingAssets是否正确。

---

## P0-2: matchDistricts预算参数类型错误 → 永远匹配最低档

**文件**: `pages/guidebooks/index/index.js` L331+L337 + `data/district-data.js` L540

**根因**: Wizard step 0选择预算时存入字符串ID（`'b1'`~`'b5'`），但`matchDistricts`期望数字做数值比较。

```javascript
// index.js L331 — wizard填入字符串
this.data.wizardBudget = value;  // 'b1', 'b2', etc.

// district-data.js L540 — 数值比较
if (budget >= brackets[i].min && budget <= brackets[i].max)
// 'b1' >= 10000 → NaN >= 10000 → false（永远false）
```

**后果**: 所有预算档位比较均为false → `bracket=null` → fallback到`brackets[0]`($10K-15K)。用户选$60K+档位仍只看到$10K-15K区域推荐。

**修复方向**:
- 在`onWizardNext` L337前将budgetId解析为数值：`var budgetValue = BUDGET_BRACKETS.find(b=>b.id===this.data.wizardBudget).min`
- 或修改`matchDistricts`接收budgetId做索引查找

**修复后验证**: 选b5($60K+)后检查`wizardResults`是否包含高端区域（中半山/跑马地/九龙塘等），而不是只显示低预算区域。

---

## P0-3: Tab4「攻略精选」WXML完全无渲染块

**文件**: `pages/guidebooks/index/index.wxml`

**根因**: JS侧已实现：
- `tabs`数组含`{id:3, label:'攻略精选'}`（index.js L17）
- `loadArticles()`加载旧攻略文章
- `switchTab`触发加载
但WXML中只有Tab 0/1/2的`wx:elif`块，**没有`activeTab===3`的渲染块**。文件273行结束。

**后果**: 用户点击「攻略精选」Tab后看到完全空白页。articles数据已加载但无处渲染。47篇内容资产浪费。

**修复方向**: 在WXML的Tab 2块之后(`</view>` at ~L261后)、找房向导弹窗之前，插入Tab 3渲染模板：

```xml
<view wx:elif="{{activeTab===3}}" class="tab-content">
  <view wx:if="{{articlesLoading}}" class="loading">加载中...</view>
  <view wx:else>
    <view wx:for="{{articles}}" wx:key="_id" class="article-card" bindtap="onArticleTap" data-id="{{item._id}}">
      <image wx:if="{{item.cover}}" src="{{item.cover}}" class="article-cover" mode="aspectFill"/>
      <view class="article-info">
        <text class="article-title">{{item.title}}</text>
        <text class="article-summary">{{item.summary || item.excerpt}}</text>
        <text class="article-date">{{item.publishDate || item.date}}</text>
      </view>
    </view>
  </view>
</view>
```

**修复后验证**: 
1. DevTools编译通过
2. 点击Tab4能看到文章列表渲染
3. 无加载状态时显示正常

---

## 回归验证表

| # | 验证项 | 方法 | 预期 |
|---|--------|------|------|
| 1 | P0-1缓存key正确 | DevTools → 查看life-guide-cache存储项 | key后缀含正确assets数组 |
| 2 | P0-2 budget=b5区域推荐 | 向导选b5→港岛→有娃→查看结果 | 含高端区域(中半山/跑马地等) |
| 3 | P0-3 Tab4渲染 | 切换Tab4 | 显示47篇文章列表，非空白 |
| 4 | DevTools编译 | quit→open→auto-preview | 无code 10 |
| 5 | verify.sh | `bash scripts/verify.sh` | 38+/39 |
| 6 | Jest smoke | `npx jest tests/smoke/` | 39 pass |

---

**:pushpin: Hermes注**: P1级5项（wizardBudget绕过setData、Object.values()兼容、urgency class硬编码、wx-server-sdk版本锁定、onStepCheck防御）排入P1迭代，本task仅修P0。
