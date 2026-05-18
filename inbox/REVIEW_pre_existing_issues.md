# REVIEW: 预存问题修复 — image-process.js语法 + preaudit-engine缺失

**日期**: 2026-05-18  
**来源**: Hermes 闸门 (Gate 3 DevTools + Gate 2 Jest)  
**优先级**: P1

---

## P1-1: utils/image-process.js:177 语法错误

**现状**: DevTools Summer 编译器报 `code 10` — `Unexpected token, expected "," (177:9)`
**根因**: L177 多余 `});`，Promise 链嵌套多一层闭合
**影响**: 整个小程序编译失败，所有页面不可用

**涉及文件**: `utils/image-process.js` L166-177

当前代码结构:
```javascript
            fail: function() { resolve(imagePath); }   // L174
          });                                            // L175
        });                                              // L176
        });                                              // L177 ← 多余!
```

应删除 L177 的 `});`。

**注意**: `node -c` 不报错，只有 Summer 编译器（DevTools）能捕获。修复后用 `cli auto-preview` 验证。

---

## P1-2: cloudfunctions/preaudit-engine/ 目录缺失

**现状**: Jest smoke 3 项失败:
- `preaudit-engine › 源码文件存在` — 目录不存在
- `preaudit-engine › rule-engine.js 模块存在` — 文件不存在
- `preaudit-engine › formatters.js 模块存在` — 文件不存在

**影响**: 预审引擎功能不可用

**建议**: 检查是否需从旧版本恢复该云函数目录，或更新测试跳过该模块。

---

## P2 (可延后): 24 页面路径 + .hermes 规则

- A6: app.json 注册的 24 个页面（admin-db/assessment-index/chat/documents-*/guide-*/info/invoice-*/membership/orders/playbook/privacy/process-detail/schools/settings）源码在子包，编译产物路径与注册不一致
- C2/C3: 6 个 .hermes/rules + 5 个 .hermes/skills 文件缺失（项目脚手架未包含）

---

## 修复铁律

- 仅修改上述文件，不动其他代码
- image-process.js 改完用 DevTools 编译验证（非 node -c）
- preaudit-engine 优先恢复目录，其次更新测试
