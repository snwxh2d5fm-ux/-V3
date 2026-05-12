# 住港伴 MCP 扩展评估报告

> 日期: 2026-05-12 · Phase H2-D
> 当前 MCP: CloudBase MCP (cloudbase-mcp@latest)
> 覆盖能力: 云函数部署 / 数据库操作 / 存储管理 / 网关配置

---

## 当前 MCP 能力覆盖

| 能力 | 工具 | 使用频率 | 评价 |
|------|------|:--:|------|
| 云函数创建/更新 | createFunction/updateFunctionCode | 🔴 高频 | ✅ 已稳定使用 |
| 云函数调用验证 | invokeFunction | 🔴 高频 | ✅ 已稳定使用 |
| 数据库读写 | readNoSqlContent/writeNoSqlContent | 🟡 中频 | ✅ |
| 存储管理 | manageStorage | 🟢 低频 | ✅ |
| 静态托管 | uploadFiles | 🟢 低频 | ✅ |
| 环境查询 | envQuery | 🟡 中频 | ✅ |

---

## 扩展评估矩阵

### 1. CI 构建 MCP

**场景**: 自动触发微信开发者工具编译、读取编译日志
**住港伴诉求**: 开发 Agent 完成代码修改后，自动验证编译通过

| 维度 | 评估 |
|------|------|
| 可行性 | 🟡 中 — 微信开发者工具支持 CLI (`cli build`)，但没有标准 MCP |
| 替代方案 | `wechat-devtools-cli` Skill 已有，通过 CLI 操作 |
| 是否需要 MCP | ❌ 不需要 — CLI 封装在 Skill 中已足够 |
| 优先级 | P3 — 当前流程已覆盖（Dev Agent 手动确认编译） |

**结论**: 不新建 MCP。现有 `wechat-devtools-cli` Skill 可扩展 `cli build --quiet` 自动化编译检查，集成到 verify.sh 的 B 类检查中。

---

### 2. 微信小程序上传 MCP

**场景**: 自动上传代码包到微信后台，提交审核
**住港伴诉求**: 减少人工上传步骤

| 维度 | 评估 |
|------|------|
| 可行性 | 🔴 低 — 微信小程序上传需要 `ci.upload` + `privateKey`，涉及敏感凭证 |
| 安全风险 | 🔴 高 — 上传密钥泄漏 = 小程序被恶意覆盖 |
| 替代方案 | 人工上传（当前），或 CI 平台的微信小程序上传插件 |
| 是否需要 MCP | ❌ 不需要 — 上传是低频操作（每次发布才做），人工安全可控 |
| 优先级 | P4 — 当前人工上传 2 分钟完成，MCP 化收益极低 |

**结论**: 不做。上传是安全敏感操作，人员手动可控。

---

### 3. 发布状态回写 MCP

**场景**: 发布后自动更新任务看板、发送通知
**住港伴诉求**: 发布结果自动回流到 task-board.yaml

| 维度 | 评估 |
|------|------|
| 可行性 | 🟢 高 — 纯工程内部操作，读写本地 YAML + 调用 send_message |
| 是否已有方案 | ✅ verify.sh 已存在，task-board.yaml 可被 Agent 直接更新 |
| 是否需要 MCP | ❌ 不需要 — Agent 直接 patch task-board.yaml |
| 优先级 | P3 — 可集成到 PM Agent 的 S7 交付阶段 |

**结论**: 不新建 MCP。PM Agent 在 S7 交付阶段自动更新 task-board.yaml。

---

### 4. 知识库同步 MCP（额外发现）

**场景**: 本地语料 → CloudBase knowledge_chunks 的批量同步
**住港伴诉求**: 当前 knowledge-import 云函数已存在，但需要手动触发

| 维度 | 评估 |
|------|------|
| 可行性 | 🟢 高 — CloudBase MCP 已有 invokeFunction |
| 当前方案 | `knowledge-import` 云函数 + `data-cleaning-run` Skill |
| 是否需要 MCP | ❌ 不需要 — Skill 已经覆盖 |
| 优先级 | P3 |

---

## 总结

| 扩展方向 | 结论 | 动作 |
|---------|------|------|
| CI 构建 MCP | 不需要 | 扩展 `wechat-devtools-cli` Skill 增加 `cli build` |
| 小程序上传 MCP | 不做 | 人工操作，安全可控 |
| 发布回写 MCP | 不需要 | PM Agent S7 阶段自动更新 task-board |
| 知识库同步 MCP | 不需要 | 现有 Skill 已覆盖 |

**核心判断**: 住港伴当前不需要新增 MCP。CloudBase MCP 已覆盖所有远程操作（云函数/数据库/存储），本地操作通过 `.hermes/skills/` 和 `scripts/` 覆盖。MCP 适合「需要安全接上外部工程系统」的场景，而住港伴目前所有外部系统要么通过 CloudBase MCP 已接入（腾讯云），要么低频手工操作即可（微信上传）。

---

## 后续动作（P3，非阻塞）

1. `wechat-devtools-cli` Skill 增加 `cli build --quiet` 自动化编译 → verify.sh B0 检查项
2. PM Agent 定义中补充 S7 交付时自动更新 task-board.yaml 的逻辑
