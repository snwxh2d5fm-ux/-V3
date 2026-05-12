# 住港伴 — 今日需求与修复总表

> 生成时间: 2026-05-12 18:25
> 覆盖来源: Hermes CLI 本会话 + Claude Cowork ledger + 用户真机测试反馈

---

## 一、用户提出的需求/Bug（真机测试反馈）

| # | 需求/Bug | 页面 | 严重度 | 代码状态 | 备注 |
|:--:|------|------|:--:|:--:|------|
| 1 | 流程控-指引牌-四大计划横向对比-指引详情为空 | process/index → guide | P0 | ❓ 待定位 | 指引详情页跳转链路需排查 |
| 2 | 添加证件，AI识别失败，未能识别字段 | documents/add | P0 | ❓ | OCR utils/ocr.js 或 preaudit-engine 云函数 |
| 3 | 脱敏等级切换后，本地照片未做遮盖 | documents/detail | P1 | ❌ | desensitize 仅对文字脱敏，未处理图片 |
| 4 | 证件没有生成扫描形态 | documents/add | P1 | ❌ | 功能未实现 |
| 5 | 证件夹前端报错 &#x2713, 203A 等字符 | documents/index | P0 | ✅ 已修复 | WXML中HTML实体已替换(当前代码无此问题) |
| 6 | 效率宝-开始预审报错 | precheck/index | P0 | ❓ | preaudit-engine 云函数调用失败 |
| 7 | 提醒器-拍照识别日期按钮前置+字体异常 | reminders/detail | P1 | ❌ | UI问题 |
| 8 | 提醒器-示意图需做GIF+同步文案 | reminders/detail | P2 | ❌ | 需求未实现 |
| 9 | _(跳过编号9)_ | - | - | - | |
| 10 | 攻略书-点击高才通/优才等分类报错"暂无攻略" | guidebooks/index | P0 | ❓ | 数据正确(8篇qmas/4篇ttps)，过滤逻辑待排查 |
| 10b | 攻略书-热门快筛关键词(证件照等)无召回 | guidebooks/index | P0 | ❌ | 快筛仅匹配title/desc/tags，需扩展 |

## 二、Hermes 本会话已完成修复

| # | 修复项 | 文件 | 状态 |
|:--:|------|------|:--:|
| H1 | 流程控首页异常处理 | pages/process/index/index.js | ✅ onShow+loadActiveProcess try/catch |
| H2 | 流程详情深拷贝修复 | pages/process/detail/detail.js | ✅ JSON.parse(JSON.stringify) + save失败保护 |
| H3 | HIGH-3 爬虫资源泄漏 | wechat_crawler/*.py | ✅ 双端MD5一致 |
| H4 | Phase 0 任务看板闭环 | .hermes/task-board.yaml | ✅ 100% |
| H5 | DSG-2 线框图 | DSG-2/*.excalidraw | ✅ 3个线框图 |

## 三、Claude Desktop 声称已完成（但未同步到项目目录）

| # | Claude 声称 | 实际代码 | 差距 |
|:--:|------|------|------|
| C1 | "V3代码审查全部HIGH/MEDIUM已闭环" | ❓ | Claude改动未落地到项目目录 |
| C2 | "DSG-1审计发现已闭环" | ❓ | 同上 |
| C3 | "HIGH-3 → 分配玄武" | ✅ 已由Hermes闭环 | |
| C4 | "DSG-3视觉系统规范v1.0" | 📤 outbox/ | 规范已产出但代码合规未执行 |

## 四、根因分析

**核心问题**: Claude Desktop 和 Hermes 操作的是**不同文件副本**。
- Claude Desktop 的改动在 Claude-3p/ 沙盒内
- Hermes 直接操作 `~/Downloads/港动人生/住港伴V3-开发中/`
- 两者通过 `~/Claude/cowork/` 的 outbox/inbox 交换产物
- 但 Claude 的 **代码修改** (非文档产出) 没有机制同步回项目目录

**结果**: 用户在真机上看到的代码 = Hermes 的代码 = 缺少 Claude 声称已修复的改动。
