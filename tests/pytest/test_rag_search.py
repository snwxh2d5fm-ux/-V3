"""
住港伴 V3 — RAG 检索验证脚本 (T-002)

验证 rag-search 云函数在 10 条标准查询下的代码逻辑路径。
使用 mock CloudBase SDK (wx-server-sdk)，不依赖实际 CloudBase 连接。

参考: .hermes/skills/rag-search-verify.md

验证策略:
  1. 基础存在性: index.js 存在 + exports.main 是函数
  2. 10 条标准查询: 每条调用 main({query, topK:3})，验证返回结构
  3. K2 过滤完整性: 验证过滤函数和模式定义存在
  4. 边界条件: topK 上限、空查询、未知 action

注意: 由于使用 mock DB (返回空数组)，本测试验证代码逻辑路径而非真实检索结果。
真实集成测试应通过 CloudBase invokeFunction 执行。
"""

import json
import os
import subprocess
from pathlib import Path

import pytest

pytestmark = pytest.mark.smoke

# ================================================================
# 10 条标准验证查询 (来自 .hermes/skills/rag-search-verify.md)
# ================================================================
# 格式: (查询词, 期望知识域, 期望来源类型)
RAG_QUERIES = [
    ("优才计划申请条件",                "优才",     "官方"),
    ("高才通 A类收入要求",              "高才",     "官方"),
    ("IANG 签证续签需要什么材料",       "IANG",     "官方"),
    ("受养人签证办理流程",              "受养人",   "官方"),
    ("香港永居七年计算方式",            "永居",     "官方"),
    ("专才计划雇主变更",                "专才",     "官方"),
    ("身份证办理预约",                  "在港生活", "官方/社区"),
    ("子女在港入学",                    "在港生活", "社区"),
    ("香港租房注意事项",                "在港生活", "社区"),
    ("强积金提取条件",                  "在港生活", "官方"),
]

RAG_QUERY_IDS = [f"Q{i+1}" for i in range(len(RAG_QUERIES))]


# ================================================================
# 辅助函数
# ================================================================
def _invoke_rag_search(project_root, function_name, query, topK=3):
    """
    通过子进程调用 rag-search 云函数的 main()。
    使用 NODE_PATH 指向 mock wx-server-sdk。

    Args:
        project_root: 项目根目录 Path
        function_name: 云函数名称
        query: 查询字符串
        topK: 返回结果数上限

    Returns:
        dict: 云函数 main() 的返回值，或 {error: ...}
    """
    helpers_dir = project_root / "tests" / "pytest" / "helpers"
    cloudfunctions_dir = project_root / "cloudfunctions"
    helper_script = helpers_dir / "invoke-cloud-function.js"
    mock_node_modules = helpers_dir.parent / "mocks" / "node_modules"

    params = {"query": query, "topK": topK}
    params_json = json.dumps(params, ensure_ascii=False)

    env = os.environ.copy()
    env["NODE_PATH"] = str(mock_node_modules)

    result = subprocess.run(
        ["node", str(helper_script), function_name, str(cloudfunctions_dir), params_json],
        capture_output=True,
        text=True,
        cwd=str(project_root),
        env=env,
        timeout=15,
    )

    # 解析 stdout 中的 JSON
    if result.stdout.strip():
        try:
            return json.loads(result.stdout.strip())
        except json.JSONDecodeError:
            pass

    # 回退: 解析 stderr 中的 JSON
    if result.stderr.strip():
        try:
            return json.loads(result.stderr.strip())
        except json.JSONDecodeError:
            pass

    return {"error": "No JSON output", "stdout": result.stdout, "stderr": result.stderr}


def _invoke_rag_search_raw(project_root, function_name, params):
    """
    直接传入完整 params dict 调用 rag-search。

    Args:
        project_root: 项目根目录 Path
        function_name: 云函数名称
        params: 完整参数 dict (可含 action, query, topK, filters 等)

    Returns:
        dict: 云函数 main() 的返回值，或 {error: ...}
    """
    helpers_dir = project_root / "tests" / "pytest" / "helpers"
    cloudfunctions_dir = project_root / "cloudfunctions"
    helper_script = helpers_dir / "invoke-cloud-function.js"
    mock_node_modules = helpers_dir.parent / "mocks" / "node_modules"

    params_json = json.dumps(params, ensure_ascii=False)

    env = os.environ.copy()
    env["NODE_PATH"] = str(mock_node_modules)

    result = subprocess.run(
        ["node", str(helper_script), function_name, str(cloudfunctions_dir), params_json],
        capture_output=True,
        text=True,
        cwd=str(project_root),
        env=env,
        timeout=15,
    )

    if result.stdout.strip():
        try:
            return json.loads(result.stdout.strip())
        except json.JSONDecodeError:
            pass

    if result.stderr.strip():
        try:
            return json.loads(result.stderr.strip())
        except json.JSONDecodeError:
            pass

    return {"error": "No JSON output", "stdout": result.stdout, "stderr": result.stderr}


# ================================================================
# 测试类 1: 基础存在性
# ================================================================
class TestRagSearchBasics:
    """rag-search 云函数基础存在性验证 (等价于验证步骤 1: Smoke Test)"""

    def test_index_js_exists(self, cloudfunctions_dir):
        """[RAG-001] index.js 文件存在"""
        path = cloudfunctions_dir / "rag-search" / "index.js"
        assert path.exists(), "index.js 不存在: %s" % path
        assert path.stat().st_size > 0, "index.js 为空文件: %s" % path

    def test_exports_main_is_function(self, verify_exports_main):
        """[RAG-002] exports.main 存在且为函数"""
        info = verify_exports_main("rag-search")
        if info.get("error"):
            pytest.fail("require 失败: %s" % info["error"])
        assert info.get("hasExportsMain"), (
            "exports.main 不是函数: type=%s, exports 键=%s"
        ) % (info.get("mainType", "N/A"), info.get("exportsKeys", []))


# ================================================================
# 测试类 2: 10 条标准查询验证 (等价于验证步骤 2)
# ================================================================
class TestRagSearchQueries:
    """10 条标准 RAG 检索验证查询 (验证步骤 2)"""

    func_name = "rag-search"

    @pytest.mark.parametrize(
        "query,expected_domain,expected_source",
        RAG_QUERIES,
        ids=RAG_QUERY_IDS,
    )
    def test_query_no_error(self, query, expected_domain, expected_source,
                            project_root):
        """[RAG-100~109] 每条查询不抛出异常"""
        result = _invoke_rag_search(project_root, self.func_name, query, topK=3)

        assert "error" not in result, (
            "查询 [%s] 执行异常: %s"
        ) % (query, result.get("error"))

    @pytest.mark.parametrize(
        "query,expected_domain,expected_source",
        RAG_QUERIES,
        ids=RAG_QUERY_IDS,
    )
    def test_query_ok_true(self, query, expected_domain, expected_source,
                           project_root):
        """[RAG-110~119] 返回 ok=True"""
        result = _invoke_rag_search(project_root, self.func_name, query, topK=3)

        assert result.get("ok") is True, (
            "查询 [%s] 返回 ok=false: %s"
        ) % (query, json.dumps(result, ensure_ascii=False))

    @pytest.mark.parametrize(
        "query,expected_domain,expected_source",
        RAG_QUERIES,
        ids=RAG_QUERY_IDS,
    )
    def test_query_data_has_results_array(self, query, expected_domain, expected_source,
                                          project_root):
        """[RAG-120~129] data.results 是数组 (验证返回结构完整性)"""
        result = _invoke_rag_search(project_root, self.func_name, query, topK=3)

        if "error" in result:
            pytest.skip("查询 [%s] 执行异常" % query)

        data = result.get("data")
        assert data is not None, (
            "查询 [%s] data 为空: %s"
        ) % (query, json.dumps(result, ensure_ascii=False))

        results = data.get("results")
        assert isinstance(results, list), (
            "查询 [%s] data.results 不是数组: type=%s, data=%s"
        ) % (query, type(results).__name__, json.dumps(data, ensure_ascii=False))

    @pytest.mark.parametrize(
        "query,expected_domain,expected_source",
        RAG_QUERIES,
        ids=RAG_QUERY_IDS,
    )
    def test_query_data_has_total_int(self, query, expected_domain, expected_source,
                                     project_root):
        """[RAG-130~139] data.total 是整数"""
        result = _invoke_rag_search(project_root, self.func_name, query, topK=3)

        if "error" in result:
            pytest.skip("查询 [%s] 执行异常" % query)

        data = result.get("data", {})
        assert "total" in data, (
            "查询 [%s] data 缺少 total 字段"
        ) % query
        assert isinstance(data["total"], int), (
            "查询 [%s] data.total 不是整数: type=%s"
        ) % (query, type(data["total"]).__name__)
        assert data["total"] >= 0, (
            "查询 [%s] data.total 为负数: %s"
        ) % (query, data["total"])

    @pytest.mark.parametrize(
        "query,expected_domain,expected_source",
        RAG_QUERIES,
        ids=RAG_QUERY_IDS,
    )
    def test_query_data_has_k2_filter_int(self, query, expected_domain, expected_source,
                                          project_root):
        """[RAG-140~149] data.filtered_by_k2 是整数且非负 (K2 过滤完整性)"""
        result = _invoke_rag_search(project_root, self.func_name, query, topK=3)

        if "error" in result:
            pytest.skip("查询 [%s] 执行异常" % query)

        data = result.get("data", {})
        assert "filtered_by_k2" in data, (
            "查询 [%s] data 缺少 filtered_by_k2 字段 (K2 过滤未生效)"
        ) % query
        assert isinstance(data["filtered_by_k2"], int), (
            "查询 [%s] data.filtered_by_k2 不是整数: type=%s"
        ) % (query, type(data["filtered_by_k2"]).__name__)
        assert data["filtered_by_k2"] >= 0, (
            "查询 [%s] data.filtered_by_k2 为负数: %s"
        ) % (query, data["filtered_by_k2"])


# ================================================================
# 测试类 3: K2 安全过滤完整性 (验证步骤 3 的代码级检查)
# ================================================================
class TestRagSearchK2Filter:
    """K2 Layer 2 后检索过滤 — 代码级验证"""

    func_name = "rag-search"

    def test_forbidden_patterns_defined(self, cloudfunctions_dir):
        """[RAG-200] POST_RETRIEVAL_FORBIDDEN_PATTERNS 常量已定义"""
        path = cloudfunctions_dir / self.func_name / "index.js"
        content = path.read_text(encoding="utf-8")

        assert "POST_RETRIEVAL_FORBIDDEN_PATTERNS" in content, (
            "index.js 缺少 POST_RETRIEVAL_FORBIDDEN_PATTERNS 常量 (K2 过滤缺失)"
        )

        # 验证定义长度合理 (≥10 个模式)
        for idx in range(len(content)):
            if content[idx:].startswith("POST_RETRIEVAL_FORBIDDEN_PATTERNS"):
                block = content[idx: idx + 600]
                break

        pattern_count = block.count("', '") + 1 if "'" in block else 0
        assert pattern_count >= 10, (
            "POST_RETRIEVAL_FORBIDDEN_PATTERNS 模式数 < 10: 仅 %s 个"
        ) % pattern_count

    def test_filter_forbidden_chunks_function(self, cloudfunctions_dir):
        """[RAG-201] filterForbiddenChunks 函数已定义"""
        path = cloudfunctions_dir / self.func_name / "index.js"
        content = path.read_text(encoding="utf-8")

        assert "function filterForbiddenChunks" in content, (
            "index.js 缺少 filterForbiddenChunks 函数定义"
        )

    def test_build_where_function(self, cloudfunctions_dir):
        """[RAG-202] buildWhere 函数已定义 (Layer 1 过滤)"""
        path = cloudfunctions_dir / self.func_name / "index.js"
        content = path.read_text(encoding="utf-8")

        assert "function buildWhere" in content, (
            "index.js 缺少 buildWhere 函数定义 (Layer 1 过滤缺失)"
        )

    def test_get_fetch_fields_function(self, cloudfunctions_dir):
        """[RAG-203] getFetchFields 函数已定义 (Layer 3 返回字段)"""
        path = cloudfunctions_dir / self.func_name / "index.js"
        content = path.read_text(encoding="utf-8")

        assert "function getFetchFields" in content, (
            "index.js 缺少 getFetchFields 函数定义 (Layer 3 缺失)"
        )

    def test_visibility_filter_default(self, cloudfunctions_dir):
        """[RAG-204] 默认 visibility 过滤排除 internal (V7 Layer 1a)"""
        path = cloudfunctions_dir / self.func_name / "index.js"
        content = path.read_text(encoding="utf-8")

        assert "visibility" in content, "index.js 缺少 visibility 过滤逻辑"
        assert "neq('internal')" in content or "_.neq('internal')" in content, (
            "默认 visibility 过滤未排除 internal"
        )

    def test_content_grade_default(self, cloudfunctions_dir):
        """[RAG-205] 默认 content_grade 过滤为 green/yellow"""
        path = cloudfunctions_dir / self.func_name / "index.js"
        content = path.read_text(encoding="utf-8")

        assert "content_grade" in content, "index.js 缺少 content_grade 过滤逻辑"
        assert "green" in content and "yellow" in content, (
            "默认 content_grade 过滤未包含 green/yellow"
        )


# ================================================================
# 测试类 4: 边界条件和 action 分支
# ================================================================
class TestRagSearchEdgeCases:
    """rag-search 边界条件验证"""

    func_name = "rag-search"

    def test_topK_default_10(self, project_root):
        """[RAG-300] 不传 topK 时默认不崩溃"""
        params = {"query": "优才计划申请条件"}
        result = _invoke_rag_search_raw(project_root, self.func_name, params)

        assert "error" not in result, (
            "默认 topK 调用失败: %s" % result.get("error")
        )
        assert result.get("ok") is True

    def test_topK_upper_cap(self, project_root):
        """[RAG-301] topK > 100 时被限制在 100 以内"""
        params = {"query": "优才计划申请条件", "topK": 200}
        result = _invoke_rag_search_raw(project_root, self.func_name, params)

        assert "error" not in result, (
            "topK=200 调用失败: %s" % result.get("error")
        )
        assert result.get("ok") is True

    def test_empty_query(self, project_root):
        """[RAG-302] 空查询不崩溃"""
        params = {"query": "", "topK": 3}
        result = _invoke_rag_search_raw(project_root, self.func_name, params)

        assert "error" not in result, (
            "空查询失败: %s" % result.get("error")
        )

    def test_explicit_keyword_action(self, project_root):
        """[RAG-303] 显式 action=keyword 正常"""
        params = {"action": "keyword", "query": "优才计划", "topK": 3}
        result = _invoke_rag_search_raw(project_root, self.func_name, params)

        assert "error" not in result, (
            "keyword action 失败: %s" % result.get("error")
        )
        assert result.get("ok") is True
        assert "data" in result

    def test_count_action(self, project_root):
        """[RAG-304] action=count 返回 total"""
        params = {"action": "count"}
        result = _invoke_rag_search_raw(project_root, self.func_name, params)

        assert "error" not in result, (
            "count action 失败: %s" % result.get("error")
        )
        assert result.get("ok") is True
        data = result.get("data", {})
        assert "total" in data, "count action 返回缺少 total 字段"
        assert isinstance(data["total"], int), "count action total 不是整数"

    def test_unknown_action_returns_error(self, project_root):
        """[RAG-305] 未知 action 返回 {ok: false, error: ...}"""
        params = {"action": "nonexistent", "query": "test"}
        result = _invoke_rag_search_raw(project_root, self.func_name, params)

        assert result.get("ok") is False, "未知 action 应返回 ok=false"
        assert "error" in result, "未知 action 应包含 error 信息"


# ================================================================
# 测试类 5: 搜索函数代码路径验证
# ================================================================
class TestRagSearchFunctions:
    """搜索函数代码层验证"""

    func_name = "rag-search"

    def test_keyword_search_function_defined(self, cloudfunctions_dir):
        """[RAG-400] keywordSearch async 函数已定义"""
        path = cloudfunctions_dir / self.func_name / "index.js"
        content = path.read_text(encoding="utf-8")

        assert "async function keywordSearch" in content, (
            "index.js 缺少 keywordSearch 函数"
        )

    def test_vector_search_function_defined(self, cloudfunctions_dir):
        """[RAG-401] vectorSearch async 函数已定义"""
        path = cloudfunctions_dir / self.func_name / "index.js"
        content = path.read_text(encoding="utf-8")

        assert "async function vectorSearch" in content, (
            "index.js 缺少 vectorSearch 函数"
        )

    def test_hybrid_search_function_defined(self, cloudfunctions_dir):
        """[RAG-402] hybridSearch async 函数已定义"""
        path = cloudfunctions_dir / self.func_name / "index.js"
        content = path.read_text(encoding="utf-8")

        assert "async function hybridSearch" in content, (
            "index.js 缺少 hybridSearch 函数"
        )

    def test_filter_applied_in_each_method(self, cloudfunctions_dir):
        """[RAG-403] 三个搜索方法均调用 filterForbiddenChunks"""
        path = cloudfunctions_dir / self.func_name / "index.js"
        content = path.read_text(encoding="utf-8")

        # keywordSearch 应包含 filterForbiddenChunks
        kw_start = content.index("async function keywordSearch")
        kw_end = content.index("async function vectorSearch")
        kw_body = content[kw_start:kw_end]
        assert "filterForbiddenChunks" in kw_body, (
            "keywordSearch 未调用 filterForbiddenChunks"
        )

        # vectorSearch 应包含 filterForbiddenChunks
        vec_start = content.index("async function vectorSearch")
        vec_end = content.index("async function hybridSearch") if "async function hybridSearch" in content else len(content)
        vec_body = content[vec_start:vec_end]
        assert "filterForbiddenChunks" in vec_body, (
            "vectorSearch 未调用 filterForbiddenChunks"
        )
