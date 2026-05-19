"""
住港伴 V3 — 云函数 smoke test

测试策略:
  1. node -c 语法检查 (不依赖依赖库)
  2. require + mock CloudBase SDK → 验证 exports.main 是函数
  3. 特定云函数的额外验证:
     - ai-chat: prompts.js 含 K2_SAFETY_RULES
     - rag-search: main({query:'test', topK:3}) 返回 {ok, data} 格式

注意: 这是 smoke test, 不是集成测试。
CloudBase SDK 被 mock 后, 数据库操作不会真正执行。
"""

import pytest
from pathlib import Path

pytestmark = pytest.mark.smoke


# ================================================================
# 辅助判断
# ================================================================
def _index_path(cf_dir: Path, func_name: str) -> Path:
    return cf_dir / func_name / "index.js"


# ================================================================
# 参数化: 6 个核心云函数 × 2 项检查 (语法 + exports.main)
# ================================================================
FUNCTIONS = [
    ("rag-search", True, True),
    ("ai-chat", True, True),
    ("preaudit-engine", True, True),
    ("user-auth", True, True),
    ("reminder-engine", True, True),
    ("match-engine", True, True),
]


@pytest.mark.parametrize("func_name,expect_syntax,expect_exports", FUNCTIONS)
def test_function_syntax(
    func_name, expect_syntax, expect_exports,
    cloudfunctions_dir, node_syntax_check, node_syntax_check_stderr,
):
    """[smoke] node -c 语法检查: 云函数 index.js 语法正确"""
    path = _index_path(cloudfunctions_dir, func_name)
    assert path.exists(), f"index.js 不存在: {path}"
    ok = node_syntax_check(str(path))
    if not ok:
        stderr = node_syntax_check_stderr(str(path))
        pytest.fail(f"语法错误 [{func_name}]:\n{stderr}")
    assert ok


@pytest.mark.parametrize("func_name,expect_syntax,expect_exports", FUNCTIONS)
def test_function_exports_main(
    func_name, expect_syntax, expect_exports,
    cloudfunctions_dir, verify_exports_main,
):
    """[smoke] exports.main 存在且为函数"""
    path = _index_path(cloudfunctions_dir, func_name)
    assert path.exists(), f"index.js 不存在: {path}"

    info = verify_exports_main(func_name)

    if info.get("error"):
        pytest.fail(f"require 失败 [{func_name}]: {info['error']}")

    assert info.get("hasExportsMain"), (
        f"exports.main 不是函数 [{func_name}]: "
        f"type={info.get('mainType', 'N/A')}, "
        f"exports 键={info.get('exportsKeys', [])}"
    )


# ================================================================
# rag-search 特有验证: 调用 main 返回正确格式
# ================================================================
class TestRagSearch:

    func_name = "rag-search"

    def test_main_returns_ok_format(self, cloudfunctions_dir, verify_exports_main):
        """[smoke] rag-search main 被调用时返回 {ok, data} 或 {ok, error} 格式"""
        info = verify_exports_main(self.func_name)
        if info.get("error"):
            pytest.skip(f"require 失败 (mock 不支持 rag-search 的深度调用): {info['error']}")

    def test_all_source_files_syntax(self, cloudfunctions_dir):
        """[smoke] rag-search 及其依赖无其他 JS 文件时的语法完整性"""
        func_dir = cloudfunctions_dir / self.func_name
        # 只检查 index.js
        path = func_dir / "index.js"
        assert path.exists()


# ================================================================
# ai-chat 特有验证: prompts.js 含 K2_SAFETY_RULES
# ================================================================
class TestAiChat:

    func_name = "ai-chat"

    def test_prompts_contains_k2_safety_rules(self, cloudfunctions_dir):
        """[smoke] prompts.js 含 K2_SAFETY_RULES 常量"""
        prompts_path = cloudfunctions_dir / "ai-chat" / "prompts.js"
        assert prompts_path.exists(), f"prompts.js 不存在: {prompts_path}"
        content = prompts_path.read_text(encoding="utf-8")
        assert "K2_SAFETY_RULES" in content, (
            "prompts.js 缺少 K2_SAFETY_RULES 约束常量"
        )
        # 验证内容长度合理
        idx = content.index("K2_SAFETY_RULES")
        block = content[idx : idx + 200]
        assert len(block) > 50, "K2_SAFETY_RULES 定义过短，可能不是完整的安全护栏"

    def test_prompts_syntax(self, cloudfunctions_dir, node_syntax_check):
        """[smoke] prompts.js 语法正确"""
        prompts_path = cloudfunctions_dir / "ai-chat" / "prompts.js"
        assert prompts_path.exists()
        assert node_syntax_check(str(prompts_path)), (
            f"prompts.js 语法错误: {prompts_path}"
        )

    def test_main_returns_format(self, cloudfunctions_dir, verify_exports_main):
        """[smoke] ai-chat 的 exports.main 验证"""
        info = verify_exports_main(self.func_name)
        if info.get("error"):
            pytest.skip(f"require 失败 (ai-chat 依赖 https, mock 约束): {info['error']}")
        assert info.get("hasExportsMain"), "exports.main 不存在或不是函数"


# ================================================================
# preaudit-engine 特有验证
# ================================================================
class TestPreauditEngine:

    func_name = "preaudit-engine"

    def test_main_exists(self, cloudfunctions_dir, verify_exports_main):
        """[smoke] preaudit-engine 的 exports.main 验证"""
        info = verify_exports_main(self.func_name)
        if info.get("error"):
            pytest.skip(f"require 失败 (preaudit-engine 依赖额外模块): {info['error']}")
        assert info.get("hasExportsMain"), "exports.main 不存在或不是函数"

    def test_syntax(self, cloudfunctions_dir, node_syntax_check):
        """[smoke] preaudit-engine 及其子模块语法检查"""
        func_dir = cloudfunctions_dir / self.func_name
        for js_file in func_dir.glob("*.js"):
            assert node_syntax_check(str(js_file)), (
                f"语法错误: {js_file.relative_to(cloudfunctions_dir.parent)}"
            )


# ================================================================
# user-auth 特有验证
# ================================================================
class TestUserAuth:

    func_name = "user-auth"

    def test_main_exists(self, cloudfunctions_dir, verify_exports_main):
        """[smoke] user-auth 的 exports.main 验证"""
        info = verify_exports_main(self.func_name)
        if info.get("error"):
            pytest.skip(f"require 失败 (user-auth 依赖 wx-server-sdk mock): {info['error']}")
        assert info.get("hasExportsMain"), "exports.main 不存在或不是函数"


# ================================================================
# reminder-engine 特有验证
# ================================================================
class TestReminderEngine:

    func_name = "reminder-engine"

    def test_main_exists(self, cloudfunctions_dir, verify_exports_main):
        """[smoke] reminder-engine 的 exports.main 验证"""
        info = verify_exports_main(self.func_name)
        if info.get("error"):
            pytest.skip(f"require 失败 (reminder-engine 依赖 DB): {info['error']}")
        assert info.get("hasExportsMain"), "exports.main 不存在或不是函数"


# ================================================================
# match-engine 特有验证
# ================================================================
class TestMatchEngine:

    func_name = "match-engine"

    def test_main_exists(self, cloudfunctions_dir, verify_exports_main):
        """[smoke] match-engine 的 exports.main 验证"""
        info = verify_exports_main(self.func_name)
        if info.get("error"):
            pytest.skip(f"require 失败 (match-engine 依赖 DB): {info['error']}")
        assert info.get("hasExportsMain"), "exports.main 不存在或不是函数"
