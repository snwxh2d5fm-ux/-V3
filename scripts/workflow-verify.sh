#!/bin/bash
# ============================================================
# 住港伴 Harness — 流程校验脚本 (Workflow Verifier)
# ============================================================
# 检查 Harness 工程资产的完整性和一致性。
# PM Agent 在每个阶段开始前运行此脚本。
#
# 运行: bash scripts/workflow-verify.sh
# ============================================================

set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

PASS=0
FAIL=0

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'

pass_msg() { echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1)); }
fail_msg() { echo -e "  ${RED}✗${NC} $1"; FAIL=$((FAIL + 1)); }

echo -e "${CYAN}━━━ Harness 流程资产校验 ━━━${NC}"

# ============================================================
# 1. 流程定义文件
# ============================================================
echo -e "\n${CYAN}[1] 流程定义文件${NC}"
check_file() {
  if [ -f "$1" ]; then
    pass_msg "$1"
  else
    fail_msg "$1 — 缺失！"
  fi
}

check_file ".hermes/workflow/flow-definition.md"

# ============================================================
# 2. 总验证脚本
# ============================================================
echo -e "\n${CYAN}[2] 总验证脚本${NC}"
check_file "scripts/verify.sh"

# ============================================================
# 3. Agent 角色契约 (7份)
# ============================================================
echo -e "\n${CYAN}[3] Agent 角色契约${NC}"
AGENTS=(
  "pm-agent"
  "requirement-agent"
  "design-agent"
  "gate-agent"
  "dev-agent"
  "review-agent"
  "test-agent"
)

MISSING_AGENTS=""
for agent in "${AGENTS[@]}"; do
  if [ -f ".hermes/workflow/agent-contracts/${agent}.md" ]; then
    pass_msg "契约: ${agent}.md"
  else
    fail_msg "契约: ${agent}.md — 缺失！"
    MISSING_AGENTS="$MISSING_AGENTS $agent"
  fi
done

# ============================================================
# 4. Agent 定义文件 (7份)
# ============================================================
echo -e "\n${CYAN}[4] Agent 定义文件${NC}"
for agent in "${AGENTS[@]}"; do
  if [ -f ".hermes/agents/${agent}.md" ]; then
    pass_msg "定义: ${agent}.md"
  else
    fail_msg "定义: ${agent}.md — 缺失！"
  fi
done

# ============================================================
# 5. Rule 文件 (6份)
# ============================================================
echo -e "\n${CYAN}[5] Rule 文件${NC}"
RULES=(
  "security"
  "wechat-dev"
  "code-quality"
  "terminology"
  "data-pipeline"
  "ai-chat-guardrail"
)
for rule in "${RULES[@]}"; do
  check_file ".hermes/rules/${rule}.md"
done

# ============================================================
# 6. Skill 文件 (5份)
# ============================================================
echo -e "\n${CYAN}[6] Skill 文件${NC}"
SKILLS=(
  "cloud-function-deploy"
  "guidebook-generate"
  "build-verify"
  "rag-search-verify"
  "data-cleaning-run"
)
for skill in "${SKILLS[@]}"; do
  check_file ".hermes/skills/${skill}.md"
done

# ============================================================
# 7. 知识库文件
# ============================================================
echo -e "\n${CYAN}[7] 知识库文件${NC}"
check_file "CLAUDE.md"
check_file ".hermes/task-board.yaml"

# ============================================================
# 8. 流程定义与 Agent 契约一致性检查
# ============================================================
echo -e "\n${CYAN}[8] 一致性检查${NC}"

# 8.1: flow-definition.md 引用的 Agent 与 agent-contracts/ 一致
if [ -f ".hermes/workflow/flow-definition.md" ]; then
  FLOW_AGENTS=$(grep -oE '(pm|requirement|design|gate|dev|review|test)-agent' .hermes/workflow/flow-definition.md | sort -u)
  CONTRACT_AGENTS=""
  for f in .hermes/workflow/agent-contracts/*.md; do
    [ -f "$f" ] && CONTRACT_AGENTS="$CONTRACT_AGENTS $(basename "$f" .md)"
  done
  CONTRACT_AGENTS=$(echo "$CONTRACT_AGENTS" | tr ' ' '\n' | sort -u)
  
  # 检查 flow-definition 中引用的 agent 是否都有契约
  for fa in $FLOW_AGENTS; do
    if echo "$CONTRACT_AGENTS" | grep -q "$fa"; then
      pass_msg "流程→契约: $fa 一致"
    else
      fail_msg "流程引用 $fa 但无对应契约文件"
    fi
  done
  
  # 检查契约文件是否都被流程引用
  for ca in $CONTRACT_AGENTS; do
    if [ -n "$ca" ] && ! echo "$FLOW_AGENTS" | grep -q "$ca"; then
      warn_msg "契约 $ca 存在但流程未引用"
    fi
  done
fi

# ============================================================
# 汇总
# ============================================================
echo -e "\n${CYAN}════════════════════════════════════════${NC}"
echo -e "  通过: ${GREEN}$PASS${NC}  |  失败: ${RED}$FAIL${NC}"
echo -e "${CYAN}════════════════════════════════════════${NC}"

if [ "$FAIL" -gt 0 ]; then
  echo -e "\n${RED}✗ 流程资产校验未通过 — $FAIL 项缺失/不一致${NC}"
  exit 1
else
  echo -e "\n${GREEN}✓ 流程资产完整 — $PASS 项全部通过${NC}"
  exit 0
fi
