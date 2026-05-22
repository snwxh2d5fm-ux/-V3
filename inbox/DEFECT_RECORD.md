# 缺陷记录 — AI对话记录与反馈后台 V4.2

> 测试管线 | 2026-05-22

## P0 (阻断)

无

## P1 (严重)

无

## P2 (一般)

无

## P3 (轻微)

无

## 备注

- 存量conversation_logs的source_chunks字段为null（预期行为，ai-chat部署后新对话将填充）
- pageSize=999被内部cap至50，返回code=0（非错误）
