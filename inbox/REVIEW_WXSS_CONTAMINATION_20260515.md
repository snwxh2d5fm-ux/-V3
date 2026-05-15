# REVIEW: P0 — WXSS 文件行号污染 (6114ca8)

**发现时间**: 2026-05-15 闸门预检 (a723a42)
**严重级别**: P0 阻断 — DevTools 编译失败

## 现状

commit `6114ca8` (fix: P1-A Tab4 action名修复 + DSG-3令牌迁移v2.0) 中，
6 个 WXSS 文件被写入了 read_file 工具的行号前缀格式，导致 CSS 语法非法。

DevTools 编译报错：
```
./app.wxss(5:6): unexpected `5` at pos 155
./pages/index/index.wxss(10:5): unexpected `1` at pos 443
./pages/documents/combine/combine.wxss(5:6): unexpected `5` at pos 160
./pages/process/index/index.wxss(5:6): unexpected `5` at pos 183
./pages/reminders/detail/detail.wxss(58:5): unexpected `5` at pos 4019
./pages/reminders/index/index.wxss(10:5): unexpected `1` at pos 372
```

## 根因

文件内容被写成了 read_file 工具输出格式，每行前有 `     N|     N|` 前缀：
```
     1|     1|/* 住港伴 v5 — 全局样式 (DSG-3 令牌体系 v2.0) */
     2|     2|@import "tokens.wxss";
```

## 期望

6 个文件恢复为合法 CSS，无行号前缀。
参考 a723a42 版本（该版本文件全部干净）。

## 受影响文件（6个）

1. `app.wxss` — 617行全部污染
2. `pages/index/index.wxss` — 237行全部污染
3. `pages/documents/combine/combine.wxss` — 352行全部污染
4. `pages/process/index/index.wxss` — 189行全部污染
5. `pages/reminders/detail/detail.wxss` — 234行全部污染
6. `pages/reminders/index/index.wxss` — 313行全部污染

## 修复方案

对每个文件，用正则去除行号前缀：
```python
import re
pattern = re.compile(r'^\s+\d+\|\s+\d+\|', re.MULTILINE)
clean_content = pattern.sub('', contaminated_content)
```

或直接从 a723a42 恢复这 6 个文件，再把 6114ca8 中的实际 DSG-3 令牌变更重新应用。

**注意**: 6114ca8 中另外 19 个 WXSS 文件是干净的，不需要处理。

## 验证方法

修复后运行：
```bash
HOME=/Users/chillment /Applications/wechatwebdevtools.app/Contents/MacOS/cli auto-preview \
  --project '/Users/chillment/Downloads/港动人生/住港伴V3-开发中' 2>&1 | \
  grep -iE "error|WXML|WXSS|code 10"
# 期望：无输出（无错误）
```
