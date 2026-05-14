# L1 E2E 最终报告 — 2026-05-13

> Hermes QA 闸门 | 状态: 部分通过

## 三层体系完成度

| 层级 | 项数 | 实际通过 | 完成度 | 说明 |
|:--:|:--:|:--:|:--:|------|
| L1 | 72 | 29/49* | 59% | *automator v0.12 WebSocket 寿命限制，49项中前15项全绿，后34项受连接降级影响 |
| L2 | 6 | 脚本已生成 | 就绪 | WeTest 脚本 `scripts/tests/e2e/reports/wetest-script.json`，需 API key 上传 |
| L3 | 12 | 未执行 | 0% | 发版前 36min 人工，相机/OCR/微信登录/VoiceOver/系统级 |

*L1 实际 spec 文件仅覆盖 49 项，剩余 23 项待补充测试代码。

## L1 按套件明细

```
✅ smoke.test.js         7/7   (启动+TabBar)
✅ documents.test.js     4/4   (证件夹基础)
✅ reminders.test.js     3/3   (提醒器基础)
❌ process.test.js       1/4   (连接降级 + 导航选择器)
❌ guidebooks.test.js    4/6   (详情页 timeout + 有用按钮)
❌ ai-chat.test.js       4/6   (后段 timeout)
❌ regression.test.js    6/19  (全部受连接降级影响)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
合计: 29/49 (59%)
```

## 核心发现

1. **automator v0.12 WebSocket 寿命**: ~15-20 次操作后必然降级，后续 `currentPage()` 和 `evaluate()` 全部 timeout。后 4 个套件（process/guidebooks/ai-chat/regression）全部受累。

2. **文件种子方案验证有效**: `mp.evaluate(wx.getFileSystemManager().readFileSync())` 替代 `evaluate(大JSON)` 后，前 3 套件稳定全绿，断连仅由操作次数累积导致。

3. **已知稳定基线**: smoke + documents + reminders = 14/14 (100%)

## 后续方向

- **短期**: 接受 14 项核心稳定基线，剩余套件需拆分多轮运行（每轮重新 launch + DevTools 重启）
- **中期**: L2 WeTest 补充 6 项真机环境测试
- **长期**: 微信官方 automator 版本升级后重新评估
