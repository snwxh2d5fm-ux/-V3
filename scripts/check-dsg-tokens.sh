#!/bin/bash
# check-dsg-tokens.sh — DSG令牌合规检查
# 检测WXSS中硬编码色值/字号/间距，输出违规文件清单
# 维护: MT天衣 · 2026-05-15

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WXSS_FILES=$(find "$PROJECT_ROOT/pages" "$PROJECT_ROOT/components" -name "*.wxss" 2>/dev/null)

PASS=0
FAIL=0
VIOLATIONS=()

echo "=== DSG令牌合规检查 ==="
echo "扫描路径: pages/ components/"
echo ""

# 检查硬编码色值（十六进制）
check_hardcoded_colors() {
  local file="$1"
  local matches
  matches=$(grep -nE ':\s*#[0-9a-fA-F]{3,8}\b' "$file" 2>/dev/null || true)
  if [ -n "$matches" ]; then
    echo "  [COLOR] $file"
    echo "$matches" | head -5 | sed 's/^/    /'
    VIOLATIONS+=("COLOR:$file")
    return 1
  fi
  return 0
}

# 检查硬编码字号（px单位的font-size）
check_hardcoded_fontsize() {
  local file="$1"
  local matches
  matches=$(grep -nE 'font-size\s*:\s*[0-9]+px' "$file" 2>/dev/null || true)
  if [ -n "$matches" ]; then
    echo "  [FONT]  $file"
    echo "$matches" | head -3 | sed 's/^/    /'
    VIOLATIONS+=("FONT:$file")
    return 1
  fi
  return 0
}

# 检查硬编码间距（padding/margin直接用px）
check_hardcoded_spacing() {
  local file="$1"
  local matches
  matches=$(grep -nE '(padding|margin)\s*:\s*[0-9]+px' "$file" 2>/dev/null || true)
  if [ -n "$matches" ]; then
    echo "  [SPACE] $file"
    echo "$matches" | head -3 | sed 's/^/    /'
    VIOLATIONS+=("SPACE:$file")
    return 1
  fi
  return 0
}

COLOR_FAIL=0
FONT_FAIL=0
SPACE_FAIL=0

for f in $WXSS_FILES; do
  rel="${f#$PROJECT_ROOT/}"
  check_hardcoded_colors "$f" || COLOR_FAIL=$((COLOR_FAIL + 1))
  check_hardcoded_fontsize "$f" || FONT_FAIL=$((FONT_FAIL + 1))
  check_hardcoded_spacing "$f" || SPACE_FAIL=$((SPACE_FAIL + 1))
done

TOTAL_FILES=$(echo "$WXSS_FILES" | wc -l | tr -d ' ')
TOTAL_VIOLATIONS=${#VIOLATIONS[@]}

echo ""
echo "=== 汇总 ==="
echo "扫描文件: $TOTAL_FILES 个WXSS"
echo "硬编码色值违规: $COLOR_FAIL 个文件"
echo "硬编码字号违规: $FONT_FAIL 个文件"
echo "硬编码间距违规: $SPACE_FAIL 个文件"
echo "总违规文件数: $TOTAL_VIOLATIONS"
echo ""

if [ "$TOTAL_VIOLATIONS" -eq 0 ]; then
  echo "✅ DSG令牌合规检查通过"
  exit 0
else
  echo "❌ DSG令牌合规检查失败 — $TOTAL_VIOLATIONS 个违规文件需修复"
  echo "修复指引: 将硬编码值替换为 var(--color-*) / var(--font-size-*) / var(--spacing-*)"
  exit 1
fi
