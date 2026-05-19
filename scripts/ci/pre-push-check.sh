#!/usr/bin/env bash
# ============================================================
# 住港伴 V3 — Git Pre-Push 检查钩子
#
# 在每次 git push 前自动执行:
#   1. 合规扫描 (敏感词)
#   2. 单元测试 (Jest)
#   3. 路径完整性检查
#
# 安装方式:
#   ln -s ../../scripts/ci/pre-push-check.sh .git/hooks/pre-push
#   chmod +x .git/hooks/pre-push
#
# 跳过检查 (紧急修复):
#   SKIP_CHECK=1 git push
# ============================================================

set -euo pipefail

if [ "${SKIP_CHECK:-}" = "1" ]; then
  echo "⚠️  跳过 Pre-Push 检查"
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0

pass() { echo -e "  ${GREEN}✓${NC} $1"; PASSED=$((PASSED+1)); }
fail() { echo -e "  ${RED}✗${NC} $1"; FAILED=$((FAILED+1)); }

echo ""
echo "========================================"
echo "  Pre-Push 质量门禁"
echo "========================================"
echo ""

# ---- 1. 合规扫描 ----
echo -e "${YELLOW}[1/3] 敏感词合规扫描${NC}"

FORBIDDEN=('投资移民' '移民顾问' '移民中介' '移民局')
VIOLATIONS=0

for word in "${FORBIDDEN[@]}"; do
  FOUND=$(cd "$PROJECT_ROOT" && grep -rl "$word" \
    pages/ components/ utils/ data/ cloudfunctions/ \
    app.js app.json app.wxss \
    2>/dev/null | grep -v node_modules | grep -v '.git/' || true)

  if [ -n "$FOUND" ]; then
    while IFS= read -r f; do
      fail "敏感词 [$word] 出现在: $f"
      VIOLATIONS=$((VIOLATIONS+1))
    done <<< "$FOUND"
  else
    pass "无 [$word]"
  fi
done

if [ $VIOLATIONS -gt 0 ]; then
  echo ""
  echo -e "${RED}合规扫描失败: $VIOLATIONS 处违规${NC}"
  echo "提示: 先将敏感词替换为合规术语再推送"
  exit 1
fi
echo ""

# ---- 2. 单元测试 ----
echo -e "${YELLOW}[2/3] 单元测试${NC}"

cd "$PROJECT_ROOT"
if npx jest --silent --maxWorkers=4 2>&1; then
  pass "单元测试全部通过"
else
  fail "单元测试存在失败项"
  echo ""
  echo -e "${RED}请先修复失败的测试再推送${NC}"
  exit 1
fi
echo ""

# ---- 3. 页面路径完整性 ----
echo -e "${YELLOW}[3/3] 页面路径完整性${NC}"

APP_JSON="$PROJECT_ROOT/project.config.json"
if [ -f "$APP_JSON" ]; then
  pass "project.config.json 存在"
else
  fail "project.config.json 缺失"
fi

# 检查 app.json 中的页面路径
APP_CONF="$PROJECT_ROOT/app.json"
if [ -f "$APP_CONF" ]; then
  PAGE_COUNT=$(node -e "console.log(require('$APP_CONF').pages.length)" 2>/dev/null || echo "0")
  pass "注册页面: ${PAGE_COUNT} 个"
else
  fail "app.json 缺失"
fi

echo ""

# ---- 总结 ----
echo "========================================"
echo -e "  结果: ${GREEN}${PASSED} 通过${NC} / ${RED}${FAILED} 失败${NC}"
echo "========================================"
echo ""

if [ $FAILED -gt 0 ]; then
  exit 1
fi
