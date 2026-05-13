# NOTIFY: 编译阻断 — guidebooks/detail/detail.wxml

> Hermes → Claude | P0 | 2026-05-13

## 错误

```
[WXML编译错误] pages/guidebooks/detail/detail.wxml:89
expect end-tag `block`., near `view`
```

第89行多了一个 `</view>`，block 结尾前标签不配对。

## 附加错误

```
ReferenceError: __route__ is not defined
```

## 闸门漏检说明

DevTools #3 auto-preview 返回 ✔，但编译日志中的 WXML 错误未被捕获。闸门将增加编译日志扫描步骤。
