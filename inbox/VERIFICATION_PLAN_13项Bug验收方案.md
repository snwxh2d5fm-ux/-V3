# 13项Bug修复 — 逐项验收方案

> Hermes QA | 2026-05-13 | 三机验证: 天元+麒麟+玄武

## 验收标准总则

| 层级 | 方法 | 通过标准 |
|:--:|------|------|
| L0 代码 | git diff 确认变更存在 | 每项指定代码位置有对应修改 |
| L1 静态 | verify.sh (39项) + workflow-verify.sh (36项) | 0 失败 |
| L2 单元 | Jest smoke (35用例) | 全 pass |
| L3 编译 | DevTools auto-preview | 无编译错误 |
| L4 交互 | E2E automator (--runInBand) | 5/5 pass |
| L5 双审 | 麒麟+玄武 独立代码审查 | 双机 MD5 一致 |

L0-L3: 必须全部通过。L4: 5项回归场景。L5: 架构级校验。

---

## 逐项验收

### #1 长周期提醒已移除 (P1)
| 属性 | 值 |
|------|-----|
| L0 代码位置 | `pages/process/index/index.js` 删除场景1弹窗 18行 |
| L4 测试 | `regression-bugfix-stable: #1` |
| L4 方法 | 注入QMAS流程(7-8年) → reLaunch process → 检查 `disclaimerType !== 'long_cycle'` |
| L4 标准 | 无弹窗或弹窗类型不为 `long_cycle` |

### #2 证件夹头部颜色统一 (P1)
| 属性 | 值 |
|------|-----|
| L0 代码位置 | `pages/documents/index/index.wxss` `.page-header` 蓝色渐变 + 白字 |
| L3 方法 | DevTools编译通过 + 截图对比（视觉验证需人工） |
| L3 标准 | 编译无错误 |

### #3 证件夹&材料颜色统一 (P1)
| 属性 | 值 |
|------|-----|
| L0 代码位置 | `tokens.wxss` 权威灰阶 + `app.wxss` 删除灰阶重定义 |
| L1 方法 | verify.sh A1-A5 静态检查 |
| L1 标准 | 无硬编码色值残留 |

### #4 提醒器时间线自动生成 (P0)
| 属性 | 值 |
|------|-----|
| L0 代码位置 | `pages/reminders/detail/detail.js` setTimeout→saveTimelineReminders() |
| L4 测试 | `regression-bugfix-stable: #4` |
| L4 方法 | globalData.selectedPath='qmas' → reLaunch `action=timeline&_autogen=1` → 检查 `timelineStages.length≥1` |
| L4 标准 | timelineStages ≥ 1, timelinePath 含 'qmas' |

### #5 攻略UGC内容非空白 (P0)
| 属性 | 值 |
|------|-----|
| L0 代码位置 | `pages/guidebooks/detail/detail.js` 缓存空壳检测 `sections.length>0` |
| L4 测试 | `regression-bugfix-stable: #5` |
| L4 方法 | reLaunch `detail?id=qmas_001` → 检查 `notFound=false && loadError=false && hasContent=true` |
| L4 标准 | 无加载错误，有内容（guide 对象 或 parsedSections） |

### #6 按钮文字破框 (P2)
| 属性 | 值 |
|------|-----|
| L0 代码位置 | `pages/documents/index/index.wxml` "+ 继续添加"→"+" |
| L3 方法 | DevTools编译通过 |
| L3 标准 | 编译无错误（视觉验证需人工） |

### #7 配偶证件泄漏 (P0)
| 属性 | 值 |
|------|-----|
| L0 代码位置 | `pages/documents/index/index.js` 三处 ownerType 过滤 |
| L4 测试 | `regression-bugfix-stable: #7` |
| L4 案例 | case-vault-meta.json: 本人×5 + 配偶×2 + 子女×1 |
| L4 方法 | identityOwner='spouse' → reLaunch documents → 检查溢出区 docs 无 ownerType='self' |
| L4 标准 | 溢出区全部 ownerType ≠ 'self' |

### #8 图片旋转/缩放/裁剪 (P1)
| 属性 | 值 |
|------|-----|
| L0 代码位置 | `utils/image-process.js` 440行 (rotateImage/cropImage/resizeImage) |
| L2 方法 | Jest smoke 验证模块可加载 |
| L2 标准 | 无语法错误 |

### #9 证件添加确认环节移除 (P1)
| 属性 | 值 |
|------|-----|
| L0 代码位置 | `pages/documents/add/add.js` 删除 wx.showModal + 直接调 doActualSave |
| L3 方法 | DevTools编译通过 |
| L3 标准 | 编译无错误 |

### #10 材料清单路径同步 (P0)
| 属性 | 值 |
|------|-----|
| L0 代码位置 | `pages/documents/index/index.js` loadSlotTemplate() 云端同步 + 24h缓存 |
| L2 方法 | Jest smoke 验证模板模块 |
| L2 标准 | document-templates.test.js pass |

### #11 证件线框动态渲染 (P0)
| 属性 | 值 |
|------|-----|
| L0 代码位置 | `pages/documents/add/add.js` 23种证件 wfFields + WXML `wx:for` |
| L1 方法 | verify.sh 全量（语法 + 一致性） |
| L3 方法 | DevTools编译通过 |
| L5 方法 | 麒麟/玄武 grep `wfFields` 计数=65 |
| L5 标准 | 三端一致 |

### #12 脱敏按证件类型 (P0)
| 属性 | 值 |
|------|-----|
| L0 代码位置 | `pages/documents/add/add.js` DOC_PRIVACY_OVERLAY(10类型) + `utils/desensitize.js` PII_FIELDS_BY_DOC_TYPE |
| L5 方法 | 麒麟/玄武 grep `DOC_PRIVACY_OVERLAY`=2, `PII_FIELDS_BY_DOC_TYPE`=3 |
| L5 标准 | 三端一致 |

### #13 预检报告%显示 (P1)
| 属性 | 值 |
|------|-----|
| L0 代码位置 | `pages/precheck/report/report.js` score = Math.round((passedChecks/totalChecks)*100) |
| L4 测试 | `regression-bugfix-stable: #13` |
| L4 案例 | case-vault-meta.json: 8份证件 → totalDocs≥1 |
| L4 方法 | reLaunch report → 检查 crashed=false && loading=false && (score undefined 或 0≤score≤100) |
| L4 标准 | 页面不崩溃，loading 结束 |

---

## 三机验证矩阵

| 层级 | 天元 | 麒麟 | 玄武 |
|:--|:--:|:--:|:--:|
| L1 verify.sh | ✅ 39/39 | 运行中 | 运行中 |
| L1 workflow | ✅ 36/36 | — | 运行中 |
| L2 Jest smoke | ✅ 35 pass | 运行中 | — |
| L3 DevTools | ✅ 编译通过 | — | — |
| L4 E2E 回归 | 运行中 | — | — |
| L5 双审 MD5 | ✅ | ✅ 一致 | ✅ 一致 |

## 未覆盖项（需人工）

| Bug | 原因 | 替代方案 |
|-----|------|---------|
| #2 头部颜色 | 纯视觉 | 截图→人工对比蓝色渐变 #3e6ae1→#5b8af7 |
| #6 按钮破框 | 纯视觉 | 截图→人工检查"+"居中 |
| #8 图片处理 | 需真实相机 | 真机手动测试旋转/裁剪流程 |
| #11 线框23种 | automator 无法逐证件切换 | 代码审查确认 wfFields 覆盖 |
| #12 脱敏10种 | automator 无法验证隐私条位置 | 代码审查确认 DOC_PRIVACY_OVERLAY 覆盖 |
