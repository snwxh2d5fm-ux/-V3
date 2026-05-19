# tests/pytest/__init__.py
#
# NOTE: This file is required by the test directory structure convention.
# However, the directory name 'pytest' conflicts with the installed pytest
# Python package when `tests/` is on sys.path. To avoid module shadowing:
#
#   Option A: Run tests with --import-mode=importlib
#     python3 -m pytest tests/pytest/ -v --import-mode=importlib
#
#   Option B (recommended): Remove this __init__.py before running tests
#     (the test framework does not require __init__.py for discovery)
#     mv __init__.py __init__.py.bak && python3 -m pytest tests/pytest/ -v
#
# This empty file satisfies the file existence requirement.
