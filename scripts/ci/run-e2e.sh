#!/usr/bin/env bash
# ============================================================
# 住港伴 V3 — E2E 自动化测试执行脚本
#
# 用法:
#   bash scripts/ci/run-e2e.sh              # 全量E2E
#   bash scripts/ci/run-e2e.sh smoke        # 冒烟测试
#   bash scripts/ci/run-e2e.sh documents    # 证件夹模块
#   bash scripts/ci/run-e2e.sh process      # 流程控模块
#   bash scripts/ci/run-e2e.sh regression   # 全量回归
#
# 前置条件:
#   1. macOS: 微信开发者工具已安装
#   2. 开发者工具 → 设置 → 安全 → 服务端口 (9420)
#   3. 项目已在开发者工具中打开
#   4. npm ci 已完成
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPORT_DIR="$PROJECT_ROOT/tests/e2e/reports"
SCREENSHOT_DIR="$REPORT_DIR/screenshots"

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo "========================================"
echo "  住港伴 V3 — E2E 自动化测试"
echo "========================================"
echo ""

# 0. 前置检查
check_prerequisites() {
  echo -e "${YELLOW}[CHECK] 前置条件检查...${NC}"

  # 检查微信开发者工具 CLI 端口
  if ! curl -s http://127.0.0.1:9420 > /dev/null 2>&1; then
    echo -e "${RED}[ERROR] 微信开发者工具服务端口 (9420) 未响应${NC}"
    echo ""
    echo "请检查:"
    echo "  1. 微信开发者工具是否已打开"
    echo "  2. 设置 → 安全 → 服务端口 (默认9420) 是否已开启"
    echo ""
    exit 1
  fi
  echo -e "${GREEN}  ✓ 微信开发者工具端口 (9420) 正常${NC}"

  # 检查 node_modules
  if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
    echo -e "${YELLOW}  ⚠ node_modules 不存在，正在安装依赖...${NC}"
    cd "$PROJECT_ROOT" && npm ci
  fi
  echo -e "${GREEN}  ✓ node_modules 就绪${NC}"

  echo ""
}

# 1. 运行单元测试 (快速反馈)
run_unit_tests() {
  echo -e "${YELLOW}[STAGE 1/3] 单元测试 (Jest)...${NC}"
  cd "$PROJECT_ROOT"

  if npx jest --verbose --maxWorkers=4 2>&1 | tail -20; then
    echo -e "${GREEN}  ✓ 单元测试通过${NC}"
  else
    echo -e "${RED}  ✗ 单元测试失败，跳过 E2E${NC}"
    exit 1
  fi
  echo ""
}

# 2. 运行 E2E 测试
run_e2e_tests() {
  local SUITE="${1:-}"

  echo -e "${YELLOW}[STAGE 2/3] E2E 自动化测试...${NC}"
  cd "$PROJECT_ROOT"

  # 清理旧报告
  rm -rf "$REPORT_DIR"
  mkdir -p "$REPORT_DIR" "$SCREENSHOT_DIR"

  local JEST_ARGS="-c tests/e2e/jest.config.js --verbose --forceExit"

  if [ -n "$SUITE" ]; then
    echo -e "  测试范围: ${GREEN}${SUITE}${NC}"
    JEST_ARGS="$JEST_ARGS --testPathPattern=$SUITE"
  else
    echo -e "  测试范围: ${GREEN}全量${NC}"
  fi

  local EXIT_CODE=0
  npx jest $JEST_ARGS 2>&1 || EXIT_CODE=$?

  echo ""
  if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}  ✓ E2E 测试全部通过${NC}"
  else
    echo -e "${RED}  ✗ E2E 测试存在失败项 (退出码: $EXIT_CODE)${NC}"
  fi

  return $EXIT_CODE
}

# 3. 生成报告
generate_report() {
  echo ""
  echo -e "${YELLOW}[STAGE 3/3] 测试报告...${NC}"

  if [ -f "$REPORT_DIR/e2e-report.html" ]; then
    echo -e "${GREEN}  ✓ HTML 报告:${NC} $REPORT_DIR/e2e-report.html"
  fi

  # 截图数量
  local screenshot_count=$(find "$SCREENSHOT_DIR" -name "*.png" 2>/dev/null | wc -l)
  echo -e "${GREEN}  ✓ 截图:${NC} ${screenshot_count} 张"

  echo ""
  echo "========================================"
  echo "  测试完成"
  echo "========================================"
}

# ============================================================
# 主流程
# ============================================================

SUITE="${1:-}"

check_prerequisites

# 快速模式: 跳过单元测试, 直接跑 E2E
if [ "${SKIP_UNIT:-}" != "1" ]; then
  run_unit_tests
fi

run_e2e_tests "$SUITE" || true  # E2E 失败不阻塞后续报告

generate_report
