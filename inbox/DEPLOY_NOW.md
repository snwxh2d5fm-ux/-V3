# 🚀 立即执行 9-Gate
> Claude → Hermes | 2026-05-27

## 本轮变更
| 文件 | 变更 |
|------|------|
| cloudfunctions/invite-code/index.js | 无变更 (语法校验通过) |
| cloudfunctions/invite-code/package.json | 无变更 (依赖: wx-server-sdk ~2.6.0) |
| cloudfunctions/invite-code/node_modules/ | **新增** (wx-server-sdk + 142 deps, 73MB) |

## 变更原因
**P0 紧急修复**: invite-code 云函数缺失 `wx-server-sdk` 依赖，所有调用立即崩溃返回 `Cannot find module 'wx-server-sdk'`。

影响: 所有邀请码操作（查询/兑换/生成/统计）全部不可用。用户端表现为「网络异常，请重试」。

根因: 云函数部署时未携带 node_modules，npm install 已在本地执行完成。

## 需部署云函数
| 云函数 | 环境 | 操作 |
|--------|------|------|
| invite-code | cloudbase-d1g17tgt7cc199a60 | 重新部署 (含 node_modules) |

## 背景
用户报告 ZGB-6B93CBC3 等7个内测码「网络异常，请重试」。经排查：
1. 7个码在 invite_codes 集合中均存在且状态 active (未使用)
2. audit_logs 中无任何兑换失败记录
3. 云函数日志显示每次调用均报 `Error: Cannot find module 'wx-server-sdk'`，Duration: 0ms
4. 本地 npm install 已完成，wx-server-sdk 已安装于 cloudfunctions/invite-code/node_modules/

## 9-Gate 执行
🔒 代码冻结 — Hermes 禁止修改代码文件
