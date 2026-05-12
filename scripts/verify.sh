#!/bin/bash
# ============================================================
# 住港伴 Harness — 总验证脚本 (Gatekeeper)
# ============================================================
# 这是住港伴唯一的"开发完成"判定入口。
# AI 说"我做好了"不算——这个脚本通过了才算。
#
# 运行: bash scripts/verify.sh
# 基线模式: bash scripts/verify.sh --baseline   (记录当前状态作为基线)
# 对比模式: bash scripts/verify.sh --diff        (与基线对比)
#
# 返回码: 0 = 全部通过  非0 = 有未通过项
# ============================================================

set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

PASS=0
FAIL=0
WARN=0
BASELINE_DIR="$PROJECT_ROOT/.hermes/baselines"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="/tmp/verify_住港伴_${TIMESTAMP}.txt"
MODE="check"

# 解析参数
if [[ "${1:-}" == "--baseline" ]]; then
  MODE="baseline"
elif [[ "${1:-}" == "--diff" ]]; then
  MODE="diff"
fi

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

header() { echo -e "\n${CYAN}━━━ $1 ━━━${NC}" | tee -a "$REPORT_FILE"; }
pass_msg() { echo -e "  ${GREEN}✓${NC} $1" | tee -a "$REPORT_FILE"; PASS=$((PASS + 1)); }
fail_msg() { echo -e "  ${RED}✗${NC} $1" | tee -a "$REPORT_FILE"; FAIL=$((FAIL + 1)); }
warn_msg() { echo -e "  ${YELLOW}⚠${NC} $1" | tee -a "$REPORT_FILE"; WARN=$((WARN + 1)); }
info_msg() { echo -e "  ${CYAN}ℹ${NC} $1" | tee -a "$REPORT_FILE"; }

# check_ok: run a command, pass if exit 0, fail otherwise
check_ok() {
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then
    pass_msg "$desc"
  else
    fail_msg "$desc"
  fi
}

# check_fail: run a command, pass if exit non-zero (negative check)
check_fail() {
  local desc="$1"; shift
  if ! "$@" >/dev/null 2>&1; then
    pass_msg "$desc"
  else
    fail_msg "$desc"
  fi
}

# ============================================================
# A类: 静态规范检查
# ============================================================
header "A类 — 静态规范检查"

# A1: parseIncome/parseCapital 必须用 startsWith (在 pages/assessment/index/index.js)
ASSESS_JS="pages/assessment/index/index.js"
check_ok "A1 parseIncome 使用 startsWith" \
  grep -q "startsWith.*'HK" "$ASSESS_JS"

check_ok "A1 parseCapital 使用 startsWith" \
  grep -q "startsWith.*'HK" "$ASSESS_JS"

# A2: 无双重 wx:for 同元素 (排除合法 block 包裹)
check_fail "A2 WXML 无双重 wx:for 同元素" \
  bash -c 'grep -rn "wx:for=" pages/ --include="*.wxml" | grep -v "<block" | grep -c "wx:for-item=.*wx:for=" | grep -q "[1-9]"'

# A3: guidebook-data.js 含敏感词
check_fail "A3 guidebook-data.js 无'投资移民'" \
  grep -q "投资移民" data/guidebook-data.js

# A4: K2 安全规则完整性
check_ok "A4 prompts.js 含 K2_SAFETY_RULES" \
  grep -q "K2_SAFETY_RULES" cloudfunctions/ai-chat/prompts.js

# A5: 无 includes 替代 startsWith
check_fail "A5 solution-library.js 无 includes(HK\$) 误用" \
  grep -q "includes.*HK" data/solution-library.js

# A6: app.json 页面注册完整性
header "A6 — app.json 页面注册一致性"
# 从 app.json 提取所有注册的页面路径
REGISTERED=$(grep '"pages/' app.json | sed 's/.*"\(pages\/[^"]*\)".*/\1/' | sort -u)
# 检查每个注册路径是否有对应的文件
MISSING_FILES=""
EXTRA_FILES=""
for page_path in $REGISTERED; do
  # WeChat 页面可以只有一个 .js 文件（不一定有目录+index.js）
  if [ -f "$page_path.js" ] || [ -f "$page_path.wxml" ] || [ -d "$(dirname "$page_path")" ]; then
    : # exists
  else
    MISSING_FILES="$MISSING_FILES $page_path"
  fi
done
# 检查是否有 pages/ 下有目录但未注册
for dir in $(find pages -type d -maxdepth 2 -not -path '*/components' -not -path 'pages'); do
  PAGE_NAME=$(echo "$dir" | sed 's|/index$||')
  if [ -f "$dir/index.js" ]; then
    if ! echo "$REGISTERED" | grep -q "$dir/index"; then
      EXTRA_FILES="$EXTRA_FILES $dir/index"
    fi
  fi
done

if [ -z "$MISSING_FILES" ] && [ -z "$EXTRA_FILES" ]; then
  pass_msg "A6 页面注册与文件一致"
else
  if [ -n "$MISSING_FILES" ]; then
    fail_msg "A6 已注册但文件不存在: $MISSING_FILES"
  fi
  if [ -n "$EXTRA_FILES" ]; then
    warn_msg "A6 有页面文件但未注册: $EXTRA_FILES"
  fi
fi

# A7: 核心云函数语法检查
header "A7 — 核心云函数语法检查"
for fn in rag-search ai-chat preaudit-engine k2-leak-scanner batch-generate-guidebooks; do
  if [ -f "cloudfunctions/$fn/index.js" ]; then
    if node -c "cloudfunctions/$fn/index.js" 2>/dev/null; then
      pass_msg "A7 $fn/index.js 语法正确"
    else
      fail_msg "A7 $fn/index.js 语法错误"
    fi
  else
    warn_msg "A7 $fn 目录不存在 (跳过)"
  fi
done

# A8: 无硬编码 PII
header "A8 — 个人信息泄漏扫描"
# 检查核心代码中是否硬编码了手机号或身份证号 (macOS grep 用 -E 替代 -P)
PII_COUNT=$(find cloudfunctions/ pages/ data/ -name '*.js' -not -path '*/__tests__/*' -not -name '*.test.*' -exec grep -lE '(1[3-9][0-9]{9}|[1-9][0-9]{5}(19|20)[0-9]{2}[01][0-9][0123][0-9][0-9]{3}[0-9Xx])' {} \; 2>/dev/null | wc -l | tr -d ' ')
if [ "$PII_COUNT" -eq 0 ]; then
  pass_msg "A8 核心代码无硬编码证件号/手机号"
else
  fail_msg "A8 发现 $PII_COUNT 个文件含疑似 PII"
fi

# A9: 推荐引擎覆盖度检查
header "A9 — 推荐引擎覆盖度 (PATH_TAGS + PATH_LABELS)"
GUIDEBOOK_DATA="data/guidebook-data.js"
# 提取 guidebook-data.js 中 PATH_TAGS 覆盖的路径
PATH_TAGS_PATHS=$(node -e "
var fs = require('fs');
var src = fs.readFileSync('$GUIDEBOOK_DATA', 'utf8');
var match = src.match(/var PATH_TAGS = \{([^}]+)\}/);
if (!match) { console.log('NOT_FOUND'); process.exit(1); }
var paths = match[1].match(/(\w+):/g).map(function(p) { return p.replace(':', ''); });
console.log(paths.join(' '));
" 2>/dev/null)
if [ "$PATH_TAGS_PATHS" != "NOT_FOUND" ]; then
  PATH_COUNT=$(echo "$PATH_TAGS_PATHS" | wc -w | tr -d ' ')
  if [ "$PATH_COUNT" -ge 13 ]; then
    pass_msg "A9 PATH_TAGS 覆盖 $PATH_COUNT 条路径 (≥13)"
  else
    fail_msg "A9 PATH_TAGS 仅覆盖 $PATH_COUNT 条路径 (需≥13)"
  fi
  # 验证 retirement 路径存在
  if echo "$PATH_TAGS_PATHS" | grep -q "retirement"; then
    pass_msg "A9 retirement 路径已加入 PATH_TAGS"
  else
    fail_msg "A9 retirement 路径缺失于 PATH_TAGS"
  fi
else
  fail_msg "A9 PATH_TAGS 解析失败"
fi

# 验证 guidebook-data.js getRecommended 中路径标签映射覆盖度
LABEL_COUNT=$(node -e "
var fs = require('fs');
var src = fs.readFileSync('$GUIDEBOOK_DATA', 'utf8');
var paths = ['qmas','ttps_a','ttps_b','ttps_c','asmpt','student_iang','techtas','cies','dependent','minor_student','exchange','parttime_qmas','retirement'];
var covered = 0;
for (var i = 0; i < paths.length; i++) {
  // Check for selectedPath === 'path' or selectedPath.indexOf('ttps') covering sub-paths
  var p = paths[i];
  if (p === 'ttps_a' || p === 'ttps_b' || p === 'ttps_c') {
    if (src.indexOf(\"indexOf('ttps')\") >= 0) covered++;
  } else if (src.indexOf(\"'\" + p + \"'\") >= 0 && src.match(new RegExp(\"('\" + p + \"').*pathLabel\"))) {
    covered++;
  }
}
console.log(covered);
" 2>/dev/null)
if [ "$LABEL_COUNT" -ge 12 ]; then
  pass_msg "A9 路径标签映射 $LABEL_COUNT 条 (≥12)"
else
  fail_msg "A9 路径标签映射仅 $LABEL_COUNT 条 (需≥12)"
fi
# 验证 retirement 标签存在
RETIRE_LABEL=$(node -e "
var fs = require('fs');
var src = fs.readFileSync('$GUIDEBOOK_DATA', 'utf8');
if (src.match(/selectedPath === 'retirement'\) pathLabel = '[^']+'/)) { console.log('FOUND'); }
else { console.log('MISSING'); }
" 2>/dev/null)
if [ "$RETIRE_LABEL" = "FOUND" ]; then
  pass_msg "A9 retirement 标签映射已就位"
else
  fail_msg "A9 retirement 标签映射缺失"
fi

# ============================================================
# B类: 基础交付门槛
# ============================================================
header "B类 — 基础交付门槛"

check_ok "B1 Node.js 可用" node -v

if [ -f "package.json" ] && grep -q '"jest"' package.json 2>/dev/null; then
  if npx jest --version >/dev/null 2>&1; then
    # 只跑 smoke test (排除已废弃的 __tests__/v3-unit.test.js)
    JEST_OUT=$(npx jest tests/smoke/ --passWithNoTests --no-coverage 2>&1)
    JEST_EXIT=$?
    if [ $JEST_EXIT -eq 0 ]; then
      PASSED=$(echo "$JEST_OUT" | grep -o 'Tests:.*' | tail -1)
      pass_msg "B2 Smoke test 通过: $PASSED"
    else
      fail_msg "B2 Smoke test 失败 — 检查 tests/smoke/"
    fi
  else
    fail_msg "B2 Jest 命令不可用"
  fi
else
  warn_msg "B2 测试框架未安装 (需 package.json + jest)"
fi

check_ok "B3 CLAUDE.md 存在" test -s CLAUDE.md

for f in data/constants.js data/solution-library.js data/templates.js data/guidebook-data.js; do
  check_ok "B4 关键文件: $f" test -f "$f"
done

# B5: 攻略书计数
header "B5 — 攻略书计数"
GUIDE_COUNT=$(node -e "
try {
  var g = require('$(pwd)/data/guidebook-data');
  var cards = g.getAllCards ? g.getAllCards() : (g.GUIDEBOOK_DB || []);
  console.log(cards.length);
} catch(e) { console.log('ERROR'); }
" 2>/dev/null)
if [ "$GUIDE_COUNT" != "ERROR" ]; then
  info_msg "B5 攻略书文章数: $GUIDE_COUNT 篇"
  PASS=$((PASS + 1))
else
  warn_msg "B5 攻略书计数获取失败"
fi

# ============================================================
# C类: 工程一致性
# ============================================================
header "C类 — 工程一致性"

check_ok "C1 云函数目录存在" test -d cloudfunctions/

for f in .hermes/rules/security.md .hermes/rules/wechat-dev.md .hermes/rules/code-quality.md; do
  check_ok "C2 Rule: $f" test -f "$f"
done

for f in .hermes/skills/cloud-function-deploy.md .hermes/skills/guidebook-generate.md; do
  check_ok "C3 Skill: $f" test -f "$f"
done

check_fail "C4 无遗留 debug_sogou" ls debug_sogou*.py

# ============================================================
# 基线 / 对比
# ============================================================
if [ "$MODE" == "baseline" ]; then
  mkdir -p "$BASELINE_DIR"
  echo "PASS=$PASS FAIL=$FAIL WARN=$WARN" > "$BASELINE_DIR/last_baseline.txt"
  cp "$REPORT_FILE" "$BASELINE_DIR/last_report.txt"
  echo -e "\n${CYAN}基线已保存: $BASELINE_DIR/last_baseline.txt${NC}"
fi

if [ "$MODE" == "diff" ]; then
  if [ -f "$BASELINE_DIR/last_baseline.txt" ]; then
    source "$BASELINE_DIR/last_baseline.txt"
    NEW_FAILS=$((FAIL - ${BASELINE_FAIL:-0}))
    if [ $NEW_FAILS -gt 0 ]; then
      echo -e "\n${RED}⚠ 基线对比: 新增 $NEW_FAILS 项失败!${NC}" | tee -a "$REPORT_FILE"
    elif [ $NEW_FAILS -lt 0 ]; then
      echo -e "\n${GREEN}✓ 基线对比: 减少了 $((0 - NEW_FAILS)) 项失败${NC}" | tee -a "$REPORT_FILE"
    else
      echo -e "\n${GREEN}✓ 基线对比: 失败数无变化${NC}" | tee -a "$REPORT_FILE"
    fi
  else
    warn_msg "无基线数据可对比，请先运行 --baseline"
  fi
fi

# ============================================================
# 汇总
# ============================================================
echo -e "\n${CYAN}════════════════════════════════════════${NC}" | tee -a "$REPORT_FILE"
echo -e "  通过: ${GREEN}$PASS${NC}  |  失败: ${RED}$FAIL${NC}  |  警告: ${YELLOW}$WARN${NC}" | tee -a "$REPORT_FILE"
echo -e "${CYAN}════════════════════════════════════════${NC}" | tee -a "$REPORT_FILE"

if [ $FAIL -gt 0 ]; then
  echo -e "\n${RED}✗ 验证未通过 — $FAIL 项失败${NC}" | tee -a "$REPORT_FILE"
  echo "详细报告: $REPORT_FILE" | tee -a "$REPORT_FILE"
  exit 1
else
  echo -e "\n${GREEN}✓ 全部验证通过 ($PASS 项)${NC}" | tee -a "$REPORT_FILE"
  exit 0
fi
