# RECEIPT — initTestState 兜底 mockLogin

> Hermes | 2026-05-13 | P1

## 变更

`tests/e2e/helpers/index.js:282-294` — `initTestState()` 改为兜底调用 `mockLogin` 而非直接抛错。

**修改前**：`auth_token` 为空 → `throw Error`
**修改后**：`auth_token` 为空 → 调用 `mockLogin(mp)` → 重新验证 → 仍为空才抛错

## 验证

- verify.sh: 38/39 通过 (B2 smoke test 为预存失败，非本次引入)
- 语法: node -c 通过

## 影响

麒麟 (0/12 → 预期全通) + 玄武及任何新机器/清缓存场景受益。
