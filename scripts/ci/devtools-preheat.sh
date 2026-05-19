#!/bin/bash
# ============================================================
# 瓶颈1修复: DevTools 预热脚本 — 闸门前置
# ============================================================
# 每次闸门前运行此脚本，确保 IDE 打开正确项目
#
# 用法: bash scripts/ci/devtools-preheat.sh
# 环境变量: WECHAT_IDE_CLI  (默认 /Applications/wechatwebdevtools.app/Contents/MacOS/cli)
#          PROJECT_PATH     (默认项目根目录)
# ============================================================

set -uo pipefail

CLI="${WECHAT_IDE_CLI:-/Applications/wechatwebdevtools.app/Contents/MacOS/cli}"
PROJECT="${PROJECT_PATH:-$(cd "$(dirname "$0")/../.." && pwd)}"
PORT="${WECHAT_IDE_PORT:-9420}"
MAX_RETRIES=3

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

log()  { echo -e "${GREEN}[preheat]${NC} $1"; }
warn() { echo -e "${YELLOW}[preheat]${NC} $1"; }
err()  { echo -e "${RED}[preheat]${NC} $1"; }

# ============================================================
# Step 1: 检查 CLI 是否可用
# ============================================================
log "Step 1: 检查 CLI 路径: $CLI"

if [ ! -f "$CLI" ]; then
  # 尝试 ~/Applications (麒麟/玄武)
  ALT_CLI="$HOME/Applications/wechatwebdevtools.app/Contents/MacOS/cli"
  if [ -f "$ALT_CLI" ]; then
    CLI="$ALT_CLI"
    log "  使用备用路径: $CLI"
  else
    err "  CLI 不存在: $CLI (尝试过: $ALT_CLI)"
    exit 1
  fi
fi

CLI_VERSION=$("$CLI" --version 2>/dev/null || echo "unknown")
log "  CLI 版本: $CLI_VERSION"

# ============================================================
# Step 2: 检查服务端口
# ============================================================
log "Step 2: 检查服务端口 $PORT"

for i in $(seq 1 $MAX_RETRIES); do
  if lsof -i :$PORT -sTCP:LISTEN >/dev/null 2>&1; then
    log "  端口 $PORT 已监听 ✓"
    break
  fi
  if [ $i -eq $MAX_RETRIES ]; then
    warn "  端口 $PORT 未监听 — 尝试自动打开"
    open -a "wechatwebdevtools" 2>/dev/null || true
    sleep 5

    if ! lsof -i :$PORT -sTCP:LISTEN >/dev/null 2>&1; then
      err "  无法连接到 DevTools 端口 $PORT"
      err "  请手动: 开发者工具 → 设置 → 安全 → 开启服务端口"
      exit 1
    fi
  fi
  sleep 2
done

# ============================================================
# Step 3: 强制打开正确项目
# ============================================================
log "Step 3: 打开项目: $PROJECT"

# 先退出可能打开的旧项目
"$CLI" --close "$PROJECT" 2>/dev/null || true
sleep 1

# 重新打开
"$CLI" --open "$PROJECT" 2>/dev/null
sleep 3

# ============================================================
# Step 4: 验证 app.json 可读
# ============================================================
log "Step 4: 验证 app.json"

APP_JSON="$PROJECT/app.json"
for i in $(seq 1 $MAX_RETRIES); do
  if [ -f "$APP_JSON" ] && [ -s "$APP_JSON" ]; then
    PAGE_COUNT=$(grep -c '"pages/' "$APP_JSON" 2>/dev/null || echo "0")
    log "  app.json 存在，$PAGE_COUNT 个页面 ✓"
    break
  fi
  if [ $i -eq $MAX_RETRIES ]; then
    err "  app.json 不可读 — 尝试完整重启"
    # 最终手段: quit → open → preview
    "$CLI" --quit 2>/dev/null || true
    sleep 3
    open -a "wechatwebdevtools" 2>/dev/null || true
    sleep 5
    "$CLI" --open "$PROJECT" 2>/dev/null
    sleep 3
  fi
  sleep 2
done

# ============================================================
# Step 5: 触发一次编译确认连通
# ============================================================
log "Step 5: 触发编译确认"

COMPILE_RESULT=$("$CLI" --build "$PROJECT" 2>&1 || true)
if echo "$COMPILE_RESULT" | grep -qi "error\|fail"; then
  warn "  编译有错误 (可能是预期内的类型警告)"
else
  log "  编译响应正常 ✓"
fi

echo ""
echo -e "${GREEN}✓ DevTools 预热完成${NC}"
echo "  CLI:      $CLI"
echo "  端口:     $PORT"
echo "  项目:     $PROJECT"
echo "  app.json: $(grep -c '"pages/' "$APP_JSON" 2>/dev/null || echo "?") 页面"
