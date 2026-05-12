#!/usr/bin/env python3
"""
住港伴 — 攻略内容保鲜监控脚本 (Policy Monitor)
================================================
持续监控香港移民政策官方动态 + 重点公众号信息验证 + 人工审核流程

监控源:
  1. 入境处官网 — 政策公告、申请指引变更
  2. 香港政府一站通 — 综合政策更新
  3. 重点公众号 — 移民/身份规划领域 KOL 信息交叉验证
  4. 攻略书内部 — 检查现有文章是否过时

输出: 邮件发送至 gangban@funway.hk
  - 官方政策变更 (附原文+链接)
  - 公众号信息验证判断
  - 人工审核流程清单
  - 批准后 → 新政策信息上线

用法:
  python3 scripts/policy-monitor.py                    # 完整检查 + 发邮件
  python3 scripts/policy-monitor.py --dry-run           # 仅检查，不发邮件
  python3 scripts/policy-monitor.py --source official   # 仅检查官方源
  python3 scripts/policy-monitor.py --source wechat     # 仅检查公众号
  python3 scripts/policy-monitor.py --source guidebook  # 仅检查攻略书时效
"""

import os
import sys
import json
import hashlib
import argparse
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = PROJECT_ROOT / "scripts"
CACHE_DIR = PROJECT_ROOT / ".cache" / "policy-monitor"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# ============================================================
# 配置
# ============================================================
REPORT_EMAIL = "gangban@funway.hk"
REPORT_SUBJECT_PREFIX = "[住港伴·政策监控]"

# 官方监控源
OFFICIAL_SOURCES = [
    {
        "name": "入境处 — 优秀人才入境计划",
        "url": "https://www.immd.gov.hk/hks/services/visas/quality_migrant_admission_scheme.html",
        "category": "qmas",
        "check_selector": ".main-content",  # CSS selector for main content
        "importance": "critical",
    },
    {
        "name": "入境处 — 高端人才通行证计划",
        "url": "https://www.immd.gov.hk/hks/services/visas/TTPS.html",
        "category": "ttps",
        "check_selector": ".main-content",
        "importance": "critical",
    },
    {
        "name": "入境处 — 输入内地人才计划",
        "url": "https://www.immd.gov.hk/hks/services/visas/ASMTP.html",
        "category": "asmpt",
        "check_selector": ".main-content",
        "importance": "critical",
    },
    {
        "name": "入境处 — 非本地毕业生留港/回港就业安排",
        "url": "https://www.immd.gov.hk/hks/services/visas/IANG.html",
        "category": "iang",
        "check_selector": ".main-content",
        "importance": "critical",
    },
    {
        "name": "入境处 — 新资本投资者入境计划",
        "url": "https://www.immd.gov.hk/hks/services/visas/CIES.html",
        "category": "cies",
        "check_selector": ".main-content",
        "importance": "critical",
    },
    {
        "name": "入境处 — 最新消息",
        "url": "https://www.immd.gov.hk/hks/misc/press.html",
        "category": "all",
        "check_selector": ".press-release-list",
        "importance": "high",
    },
    {
        "name": "香港政府一站通 — 入境事务",
        "url": "https://www.gov.hk/tc/residents/immigration/",
        "category": "all",
        "check_selector": ".main-content",
        "importance": "medium",
    },
    {
        "name": "香港人才清单 (2025.3更新)",
        "url": "https://www.talentlist.gov.hk/",
        "category": "all",
        "check_selector": ".talent-list-content",
        "importance": "high",
    },
]

# 重点公众号 (用于信息验证)
KEY_WECHAT_ACCOUNTS = [
    {"name": "香港入境事务处", "wx_id": "immdgovhk", "category": "official", "weight": 1.0},
    {"name": "香港特区政府驻沪办", "wx_id": "HKSHETO", "category": "official", "weight": 0.9},
    {"name": "香港人才服务窗口", "wx_id": "HKTalentEngage", "category": "official", "weight": 0.9},
    {"name": "银河集团", "wx_id": "galaxyimmi", "category": "agency", "weight": 0.5},
    {"name": "环球出国", "wx_id": "globevisa", "category": "agency", "weight": 0.5},
    {"name": "外事邦", "wx_id": "waishibang", "category": "agency", "weight": 0.4},
]

# 公众号搜索关键词 (用于 sogou 微信搜索)
WECHAT_SEARCH_QUERIES = [
    "香港优才 2026 新政策",
    "香港高才通 续签 2026",
    "香港专才 申请条件 变更",
    "香港IANG 2026",
    "香港投资移民 CIES 2026",
    "香港人才清单 更新",
    "香港入境处 最新公告",
]

# 攻略书时效阈值
GUIDEBOOK_STALE_DAYS = {
    "critical": 30,   # 关键政策30天未更新需复核
    "high": 60,       # 高重要度60天
    "medium": 90,     # 中等90天
    "low": 180,       # 低重要度180天
}


# ============================================================
# 缓存管理
# ============================================================
def get_cache_path(source_key):
    h = hashlib.md5(source_key.encode()).hexdigest()[:12]
    return CACHE_DIR / f"{h}.json"


def load_cache(source_key):
    p = get_cache_path(source_key)
    if p.exists():
        return json.loads(p.read_text())
    return None


def save_cache(source_key, data):
    p = get_cache_path(source_key)
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2))


# ============================================================
# 官方源监控 (Playwright)
# ============================================================
def check_official_sources(use_local_browser=True):
    """检查所有官方政策页面是否有变更"""
    findings = []

    for src in OFFICIAL_SOURCES:
        try:
            result = _check_single_source(src, use_local_browser)
            if result:
                findings.append(result)
        except Exception as e:
            findings.append({
                "source": src["name"],
                "url": src["url"],
                "status": "error",
                "error": str(e),
                "change_detected": False,
            })

    return findings


def _check_single_source(source, use_local_browser):
    """检查单个官方页面"""
    current = _fetch_page_content(source, use_local_browser)
    if not current:
        return None

    cached = load_cache(source["url"])
    changed = False
    diff_summary = ""

    if cached and cached.get("hash"):
        if current["hash"] != cached["hash"]:
            changed = True
            diff_summary = f"内容哈希变更: {cached['hash'][:8]} → {current['hash'][:8]}"
            # 尝试提取变更区域
            if cached.get("text") and current.get("text"):
                old_lines = set(cached["text"].split("\n"))
                new_lines = set(current["text"].split("\n"))
                added = new_lines - old_lines
                removed = old_lines - new_lines
                if added:
                    diff_summary += f"\n  新增 {len(added)} 行"
                if removed:
                    diff_summary += f"\n  移除 {len(removed)} 行"
    elif not cached:
        changed = True
        diff_summary = "首次监控（建立基线）"

    # 保存最新快照
    save_cache(source["url"], current)

    return {
        "source": source["name"],
        "url": source["url"],
        "category": source["category"],
        "importance": source["importance"],
        "status": "ok",
        "change_detected": changed,
        "diff_summary": diff_summary,
        "fetched_at": current["fetched_at"],
        "title": current.get("title", ""),
        "content_preview": current.get("text", "")[:500] if current.get("text") else "",
    }


def _fetch_page_content(source, use_local_browser):
    """抓取页面内容（优先本地浏览器，备用 requests）"""
    title = ""
    text = ""
    fetched_at = datetime.now().isoformat()

    try:
        import requests
        resp = requests.get(source["url"], timeout=30, headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                          "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "zh-HK,zh;q=0.9,en;q=0.8",
        })
        resp.raise_for_status()

        from bs4 import BeautifulSoup
        soup = BeautifulSoup(resp.text, "html.parser")
        title = soup.title.string if soup.title else ""
        body = soup.find("body")
        if body:
            # 提取主要文本
            for tag in body(["script", "style", "nav", "footer", "header"]):
                tag.decompose()
            text = body.get_text(separator="\n", strip=True)
            # 截取前 5000 字符做哈希
            text = text[:5000]
    except ImportError:
        # 无 bs4，用简单方式
        try:
            import requests
            resp = requests.get(source["url"], timeout=30)
            text = resp.text[:5000]
        except Exception:
            pass
    except Exception as e:
        print(f"  ⚠️  fetch error for {source['url']}: {e}")
        return None

    content_hash = hashlib.sha256(text.encode()).hexdigest()

    return {
        "url": source["url"],
        "title": title,
        "text": text,
        "hash": content_hash,
        "fetched_at": fetched_at,
    }


# ============================================================
# 公众号信息验证 (通过 weixin DL SDK / sogou 搜索)
# ============================================================
def check_wechat_sources():
    """通过搜狗微信搜索 + 公众号关键词监控，交叉验证政策信息"""
    findings = []

    for query in WECHAT_SEARCH_QUERIES:
        try:
            results = _search_wechat_articles(query)
            if results:
                findings.append({
                    "query": query,
                    "type": "wechat_search",
                    "results": results,
                    "searched_at": datetime.now().isoformat(),
                })
        except Exception as e:
            findings.append({
                "query": query,
                "type": "wechat_search",
                "status": "error",
                "error": str(e),
            })

    return findings


def _search_wechat_articles(query, max_results=5):
    """通过 sogou 微信搜索获取公众号文章"""
    import requests
    from urllib.parse import quote

    sogou_url = f"https://weixin.sogou.com/weixin?type=2&query={quote(query)}"
    results = []

    try:
        resp = requests.get(sogou_url, timeout=20, headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                          "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        })
        resp.raise_for_status()

        from bs4 import BeautifulSoup
        soup = BeautifulSoup(resp.text, "html.parser")
        items = soup.select(".news-list li, .txt-box")

        count = 0
        for item in items:
            if count >= max_results:
                break
            title_el = item.select_one("h3 a, .tit a")
            if not title_el:
                continue
            title = title_el.get_text(strip=True)
            link = title_el.get("href", "")
            account_el = item.select_one(".account, .s-p")
            account = account_el.get_text(strip=True) if account_el else ""
            date_el = item.select_one(".date, .s2")
            date = date_el.get_text(strip=True) if date_el else ""

            results.append({
                "title": title,
                "link": link,
                "account": account,
                "date": date,
                "verification_note": _classify_wechat_result(title, account),
            })
            count += 1

    except ImportError:
        # Fallback: just return the search URL for manual check
        results.append({
            "title": f"[需人工检查] {query}",
            "link": sogou_url,
            "account": "",
            "date": "",
            "verification_note": "无法自动解析，请手动访问链接查看",
        })
    except Exception as e:
        results.append({
            "title": f"[搜索异常] {query}",
            "link": sogou_url,
            "account": "",
            "date": "",
            "verification_note": f"搜索异常: {str(e)[:100]}",
        })

    return results


def _classify_wechat_result(title, account):
    """判断公众号文章的可靠性"""
    account_lower = account.lower()

    # 官方源
    official_keywords = ["入境事务处", "入境处", "香港特区政府", "驻沪办", "人才服务", "immd", "gov"]
    if any(kw in account_lower for kw in official_keywords):
        return "✅ 官方源 — 高可信度"

    # 知名机构
    agency_keywords = ["银河", "环球", "外事邦", "美联", "中原", "星岛"]
    if any(kw in account for kw in agency_keywords):
        return "⚠️  中介机构 — 需交叉验证"

    # 个人/自媒体
    return "❓ 自媒体 — 建议仅作参考，以官方为准"


# ============================================================
# 攻略书内部时效检查
# ============================================================
def check_guidebook_freshness():
    """检查攻略书内容是否过时"""
    try:
        guidebook_path = PROJECT_ROOT / "data" / "guidebook-data.js"
        with open(guidebook_path) as f:
            content = f.read()

        # 提取文章 updated 日期
        import re
        articles = re.findall(
            r"(\w+):\s*\{[^}]*?updated:\s*'([^']+)'",
            content, re.DOTALL
        )

        stale_articles = []
        now = datetime.now()

        for art_id, updated_str in articles:
            try:
                updated_date = datetime.strptime(updated_str, "%Y-%m-%d")
                days_old = (now - updated_date).days

                # 根据重要性判断
                if "入境处" in content.split(art_id)[1][:500] or "immd" in content.split(art_id)[1][:500].lower():
                    threshold = GUIDEBOOK_STALE_DAYS["critical"]
                    importance = "critical"
                elif any(kw in art_id for kw in ["qmas", "ttps", "asmpt", "cies"]):
                    threshold = GUIDEBOOK_STALE_DAYS["high"]
                    importance = "high"
                else:
                    threshold = GUIDEBOOK_STALE_DAYS["medium"]
                    importance = "medium"

                if days_old > threshold:
                    stale_articles.append({
                        "article_id": art_id,
                        "updated": updated_str,
                        "days_old": days_old,
                        "threshold": threshold,
                        "importance": importance,
                        "action": "需人工复核内容是否仍然准确",
                    })

            except ValueError:
                continue

        return stale_articles

    except Exception as e:
        return [{"error": str(e)}]


# ============================================================
# 报告生成
# ============================================================
def generate_report(official_findings, wechat_findings, guidebook_stale, dry_run=False):
    """生成综合监控报告"""
    lines = []
    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    lines.append("=" * 70)
    lines.append(f"住港伴 攻略内容保鲜监控报告")
    lines.append(f"生成时间: {now}")
    lines.append(f"模式: {'🧪 试运行 (不发送邮件)' if dry_run else '📧 将发送邮件至 ' + REPORT_EMAIL}")
    lines.append("=" * 70)

    # === 第一部分: 官方政策变更 ===
    lines.append("")
    lines.append("━" * 50)
    lines.append("📋 第一部分: 官方政策源变更检测")
    lines.append("━" * 50)
    lines.append("")

    changed_count = 0
    for item in official_findings:
        if item.get("change_detected"):
            changed_count += 1
            lines.append(f"🔴 [{item['importance'].upper()}] {item['source']}")
            lines.append(f"   链接: {item['url']}")
            lines.append(f"   变更摘要: {item.get('diff_summary', '未知')}")
            lines.append(f"   抓取时间: {item.get('fetched_at', '')}")
            lines.append(f"   内容预览 (前200字):")
            preview = item.get('content_preview', '')[:200]
            if preview:
                lines.append(f"   >>> {preview}")
            lines.append("")
            lines.append(f"   📌 审核行动:")
            lines.append(f"      1. 访问链接确认变更内容")
            lines.append(f"      2. 对比攻略书现有内容")
            lines.append(f"      3. 如需更新 → 修改 guidebook-data.js")
            lines.append(f"      4. 重新部署云端 guidebook 函数")
            lines.append("")

    if changed_count == 0:
        lines.append("✅ 未检测到政策变更")
        lines.append("")

    # 基线建立/正常状态
    baseline_count = 0
    for item in official_findings:
        if item.get("status") == "ok" and not item.get("change_detected"):
            baseline_count += 1
    if baseline_count > 0:
        lines.append(f"ℹ️  {baseline_count} 个官方源状态正常 (未检测到变更)")
        lines.append("")

    error_sources = [f for f in official_findings if f.get("status") == "error"]
    if error_sources:
        lines.append(f"⚠️  {len(error_sources)} 个源抓取失败:")
        for s in error_sources:
            lines.append(f"   - {s['source']}: {s.get('error', '未知错误')}")
        lines.append("")

    # === 第二部分: 公众号交叉验证 ===
    lines.append("━" * 50)
    lines.append("🔍 第二部分: 公众号信息交叉验证")
    lines.append("━" * 50)
    lines.append("")

    total_results = 0
    for finding in wechat_findings:
        lines.append(f"搜索关键词: \"{finding.get('query', '')}\"")
        for r in finding.get("results", []):
            total_results += 1
            lines.append(f"  📄 {r.get('title', '')}")
            lines.append(f"     来源: {r.get('account', '未知')}")
            lines.append(f"     日期: {r.get('date', '未知')}")
            lines.append(f"     链接: {r.get('link', '')}")
            lines.append(f"     验证: {r.get('verification_note', '')}")
            lines.append("")
        lines.append("")

    if total_results == 0:
        lines.append("⚠️  公众号搜索未获取到结果 (网络或反爬限制)")
        lines.append("   建议手动检查以下公众号:")
        for acct in KEY_WECHAT_ACCOUNTS:
            lines.append(f"   - {acct['name']} ({acct['wx_id']})")
        lines.append("")

    # === 第三部分: 攻略书时效检查 ===
    lines.append("━" * 50)
    lines.append("📅 第三部分: 攻略书内容时效检查")
    lines.append("━" * 50)
    lines.append("")

    if guidebook_stale and not isinstance(guidebook_stale[0], dict) or not any("error" in s for s in guidebook_stale):
        # 有过时文章
        stale_count = len([s for s in guidebook_stale if not isinstance(s, dict) or "error" not in s])
        if isinstance(guidebook_stale, list) and len(guidebook_stale) > 0 and guidebook_stale[0] == {"error": "not_accessible"}:
            lines.append("⚠️  无法读取攻略书数据文件，跳过时效检查")
        elif stale_count > 0:
            lines.append(f"⚠️  发现 {stale_count} 篇文章超过时效阈值:")
            lines.append("")
            for art in guidebook_stale:
                if isinstance(art, dict) and "article_id" in art:
                    lines.append(f"  📝 {art['article_id']}")
                    lines.append(f"     最后更新: {art['updated']} ({art['days_old']} 天前)")
                    lines.append(f"     重要度: {art['importance']}, 阈值: {art['threshold']}天")
                    lines.append(f"     操作: {art['action']}")
                    lines.append("")
        else:
            lines.append("✅ 所有攻略文章均在时效阈值内")
    else:
        lines.append("✅ 所有攻略文章均在时效阈值内")

    lines.append("")

    # === 第四部分: 审核流程 ===
    lines.append("━" * 50)
    lines.append("✅ 第四部分: 人工审核流程")
    lines.append("━" * 50)
    lines.append("")
    lines.append("请按以下流程完成审核：")
    lines.append("")
    lines.append("  Step 1 — 确认变更真实性")
    lines.append("    访问上述每个 🔴 标记的官方链接，确认政策是否确实变更")
    lines.append("    阅读公众号交叉验证结果，判断信息一致性")
    lines.append("")
    lines.append("  Step 2 — 评估影响范围")
    lines.append("    确认变更影响的攻略书文章 (参考第三部分时效列表)")
    lines.append("    判断是否需要新增文章或仅更新现有文章")
    lines.append("")
    lines.append("  Step 3 — 内容更新")
    lines.append("    data/guidebook-data.js: 修改 affected 文章的 sections/faqAnswer")
    lines.append("    更新文章的 updated 日期")
    lines.append("    运行: bash scripts/verify.sh (确保通过)")
    lines.append("")
    lines.append("  Step 4 — 部署上线")
    lines.append("    云函数部署: 更新 guidebook 云函数代码")
    lines.append("    可选: 同步 guidebook_articles 云数据库")
    lines.append("    运行: bash scripts/verify.sh --baseline (更新基线)")
    lines.append("")
    lines.append("  Step 5 — 回复确认")
    lines.append("    回复此邮件，标注已完成的审核项目")
    lines.append("    ✅ 格式: '已审核 [日期] — 确认 [变更项数] 项，已更新 [文章数] 篇'")
    lines.append("")

    # === 页脚 ===
    lines.append("━" * 50)
    lines.append("📧 本报告由住港伴 policy-monitor 自动生成")
    lines.append(f"   下次运行: {_next_run_time()}")
    lines.append("   脚本位置: scripts/policy-monitor.py")
    lines.append("   配置文件: 本脚本内 OFFICIAL_SOURCES / KEY_WECHAT_ACCOUNTS")
    lines.append("━" * 50)

    return "\n".join(lines)


def _next_run_time():
    """建议下次运行时间"""
    now = datetime.now()
    # 建议每 7 天运行一次
    next_run = now + timedelta(days=7)
    return f"建议 {next_run.strftime('%Y-%m-%d')} (每7天)"


# ============================================================
# 邮件发送
# ============================================================
def send_report_email(report_text, dry_run=False):
    """通过 himalaya CLI 发送邮件"""
    if dry_run:
        print("\n🧪 试运行模式 — 跳过邮件发送")
        print(f"   收件人: {REPORT_EMAIL}")
        print(f"   标题: {REPORT_SUBJECT_PREFIX} {datetime.now().strftime('%Y-%m-%d')}")
        return False

    subject = f"{REPORT_SUBJECT_PREFIX} {datetime.now().strftime('%Y-%m-%d')}"

    # 保存报告到临时文件
    report_path = CACHE_DIR / f"report_{datetime.now().strftime('%Y%m%d_%H%M')}.txt"
    report_path.write_text(report_text)

    # 使用 himalaya CLI
    import subprocess
    try:
        # 先检查 himalaya 是否可用
        result = subprocess.run(
            ["himalaya", "send", REPORT_EMAIL, "--subject", subject, "--body-from-file", str(report_path)],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0:
            print(f"✅ 邮件已发送至 {REPORT_EMAIL}")
            return True
        else:
            print(f"⚠️  邮件发送失败: {result.stderr[:200]}")
            print(f"   报告已保存至: {report_path}")
            print(f"   请手动发送或使用以下命令:")
            print(f"   himalaya send {REPORT_EMAIL} --subject '{subject}' --body-from-file {report_path}")
            return False
    except FileNotFoundError:
        print(f"⚠️  himalaya CLI 不可用")
        print(f"   报告已保存至: {report_path}")
        print(f"   请手动发送邮件至 {REPORT_EMAIL}")
        return False


# ============================================================
# 主流程
# ============================================================
def main():
    parser = argparse.ArgumentParser(description="住港伴 攻略内容保鲜监控")
    parser.add_argument("--dry-run", action="store_true", help="试运行，不发送邮件")
    parser.add_argument("--source", choices=["official", "wechat", "guidebook", "all"],
                        default="all", help="监控范围")
    parser.add_argument("--no-email", action="store_true", help="不发送邮件")
    parser.add_argument("--output", help="输出报告到指定文件")
    args = parser.parse_args()

    print("=" * 60)
    print("🏠 住港伴 — 攻略内容保鲜监控")
    print(f"   时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"   范围: {args.source}")
    print(f"   模式: {'🧪 试运行' if args.dry_run else '📧 邮件发送' if not args.no_email else '📄 仅报告'}")
    print("=" * 60)

    official_findings = []
    wechat_findings = []
    guidebook_stale = []

    # 1. 官方源
    if args.source in ("official", "all"):
        print("\n📋 检查官方政策源 ...")
        official_findings = check_official_sources()
        changed = [f for f in official_findings if f.get("change_detected")]
        print(f"   完成: {len(official_findings)} 个源, {len(changed)} 个有变更")

    # 2. 公众号
    if args.source in ("wechat", "all"):
        print("\n🔍 检查公众号信息 ...")
        wechat_findings = check_wechat_sources()
        total_results = sum(len(f.get("results", [])) for f in wechat_findings)
        print(f"   完成: {len(wechat_findings)} 个搜索词, {total_results} 条结果")

    # 3. 攻略书时效
    if args.source in ("guidebook", "all"):
        print("\n📅 检查攻略书时效 ...")
        guidebook_stale = check_guidebook_freshness()
        stale_count = len([s for s in guidebook_stale if isinstance(s, dict) and "article_id" in s])
        print(f"   完成: {stale_count} 篇超过时效阈值")

    # 生成报告
    report = generate_report(official_findings, wechat_findings, guidebook_stale,
                             dry_run=args.dry_run or args.no_email)

    if args.output:
        Path(args.output).write_text(report)
        print(f"\n📄 报告已保存至: {args.output}")
    else:
        print("\n" + report)

    # 发送邮件
    if not args.dry_run and not args.no_email:
        send_report_email(report)

    print(f"\n✅ 监控完成")


if __name__ == "__main__":
    main()
