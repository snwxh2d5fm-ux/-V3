"""
住港伴 V3 — pytest conftest

提供 CloudBase mock fixture 和 Node.js 验证辅助函数。
"""

import json
import os
import subprocess
from pathlib import Path

import pytest

# ── 项目路径 ─────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
CLOUDFUNCTIONS_DIR = PROJECT_ROOT / "cloudfunctions"
HELPERS_DIR = Path(__file__).resolve().parent / "helpers"

REQUIRED_CLOUD_FUNCTIONS = [
    "rag-search",
    "ai-chat",
    "preaudit-engine",
    "user-auth",
    "reminder-engine",
    "match-engine",
]


# ── Node.js 检查工具 ─────────────────────────────────────────────
def _node_syntax_check(file_path: str) -> bool:
    """使用 node -c 检查 JS 文件语法。返回 True 表示语法正确。"""
    result = subprocess.run(
        ["node", "-c", str(file_path)],
        capture_output=True,
        text=True,
        cwd=str(PROJECT_ROOT),
        timeout=15,
    )
    return result.returncode == 0


def _node_syntax_check_stderr(file_path: str) -> str:
    """检查语法，返回 stderr 输出（语法错误时含错误信息）。"""
    result = subprocess.run(
        ["node", "-c", str(file_path)],
        capture_output=True,
        text=True,
        cwd=str(PROJECT_ROOT),
        timeout=15,
    )
    return result.stderr.strip()


def _node_mock_node_path() -> str:
    """返回 wx-server-sdk mock 所在的 node_modules 路径"""
    return str(HELPERS_DIR.parent / "mocks" / "node_modules")


def _verify_exports_main(function_name: str) -> dict:
    """
    通过 mock wx-server-sdk 后 require 目标云函数，
    验证 exports.main 存在且为函数。

    使用 NODE_PATH 指向 mock wx-server-sdk，避免找不到依赖。

    返回 dict:
      { name, hasExportsMain, isMainFunction, mainType, exportsKeys, error? }
    """
    helper = HELPERS_DIR / "verify-cloud-function.js"
    env = os.environ.copy()
    env["NODE_PATH"] = _node_mock_node_path()

    result = subprocess.run(
        ["node", str(helper), function_name, str(CLOUDFUNCTIONS_DIR)],
        capture_output=True,
        text=True,
        cwd=str(PROJECT_ROOT),
        env=env,
        timeout=15,
    )
    # stdout 含 JSON (错误时也一律写入 stdout)
    output = result.stdout.strip()
    if output:
        try:
            return json.loads(output)
        except json.JSONDecodeError:
            pass
    # 回退: 检查 stderr
    output = result.stderr.strip()
    if output:
        try:
            return json.loads(output)
        except json.JSONDecodeError:
            pass
    return {
        "name": function_name,
        "hasExportsMain": False,
        "error": "No JSON output from helper",
        "stdout": result.stdout,
        "stderr": result.stderr,
    }


def invoke_cloud_function(function_name: str, params: dict) -> dict:
    """
    调用云函数 main 并返回结果。
    使用子进程执行 Node.js inline 脚本以支持 async main。
    """
    params_json = json.dumps(params).replace('"', '\\"')
    script = (
        f"const helper = require('{HELPERS_DIR}/verify-cloud-function.js');"
        f"const mod = require('{CLOUDFUNCTIONS_DIR}/{function_name}/index.js');"
        f"mod.main({json.dumps(params)}).then(r => console.log(JSON.stringify(r))).catch(e => console.log(JSON.stringify({{error: e.message}})));"
    )
    result = subprocess.run(
        ["node", "-e", script],
        capture_output=True,
        text=True,
        cwd=str(PROJECT_ROOT),
        timeout=15,
    )
    for line in [result.stdout, result.stderr]:
        line = line.strip()
        if line:
            try:
                return json.loads(line)
            except json.JSONDecodeError:
                continue
    return {"error": "No JSON output", "stdout": result.stdout, "stderr": result.stderr}


# ── pytest fixtures ──────────────────────────────────────────────
def pytest_configure(config):
    """注册自定义标记"""
    config.addinivalue_line("markers", "smoke: smoke test for cloud functions")


# ── conftest fixtures ────────────────────────────────────────────
@pytest.fixture
def project_root() -> Path:
    """项目根目录"""
    return PROJECT_ROOT


@pytest.fixture
def cloudfunctions_dir() -> Path:
    """云函数根目录"""
    return CLOUDFUNCTIONS_DIR


@pytest.fixture
def required_functions() -> list:
    """6 个核心云函数列表"""
    return list(REQUIRED_CLOUD_FUNCTIONS)


@pytest.fixture
def cloudbase_mock():
    """
    CloudBase mock fixture — 返回一个模拟的 CloudBase 环境对象。
    可用于需要 mock 环境变量的测试验证。
    """
    return {
        "env": "cloudbase-d1g17tgt7cc199a60",
        "appid": "wx08c2222c1bf042fd",
        "mock_openid": "mock-openid",
    }


# ── 函数型 fixture (包装为 fixture 以便 pytest 注入) ──────────
@pytest.fixture
def node_syntax_check():
    """Fixture 返回 node_syntax_check 函数"""
    return _node_syntax_check


@pytest.fixture
def node_syntax_check_stderr():
    """Fixture 返回 node_syntax_check_stderr 函数"""
    return _node_syntax_check_stderr


@pytest.fixture
def verify_exports_main():
    """Fixture 返回 verify_exports_main 函数"""
    return _verify_exports_main
