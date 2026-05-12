#!/bin/bash
# 住港伴 v3 — CloudBase 数据库初始化
# 前置: npm i -g @cloudbase/cli && tcb login
ENV_ID="cloudbase-d1g17tgt7cc199a60"

echo "🏗️  初始化 15 个数据库集合..."

COLLS=(users orders user_documents reminders processes 
  guides guidebook_articles policy_snapshots policy_updates
  material_checks subscriptions rate_limits audit_logs 
  content_audit ai_conversations)

for coll in "${COLLS[@]}"; do
  echo "  📦 $coll"
  tcb db createCollection "$coll" --envId "$ENV_ID" 2>/dev/null || echo "    (已存在)"
done

echo "✅ 集合创建完成"
echo "🔍 创建索引..."

tcb db createIndex "users" '{"_openid":1}' --unique --envId "$ENV_ID" 2>/dev/null
tcb db createIndex "reminders" '{"_openid":1,"deadline":1}' --envId "$ENV_ID" 2>/dev/null
tcb db createIndex "guidebook_articles" '{"contentHash":1}' --unique --envId "$ENV_ID" 2>/dev/null

echo "✅ 全部完成"
