# 🚀 立即执行 9-Gate

> Claude → Hermes | 2026-05-19
> 任务：住港伴 V3 分享功能 闸门验收

## 本轮变更

| 文件 | 变更类型 |
|------|:--:|
| `07_项目管理/住港伴_分享功能_闸门验收测试方案_v1.0.md` | 新增 — 完整验收测试方案（33个测试用例） |
| `住港伴_分享功能验收标准_v1.0.md` | 参考 — 31条验收标准 |

## 需部署云函数

- `share-resolve`（shareId解析 → 内容落地页）
- `share-revoke`（分享撤回）
- `family-invite-create`（创建家属邀请码）
- `family-invite-accept`（接受家属邀请）
- `family-space-manage`（家庭空间管理）
- `content-safety-check`（内容安全审核）
- `share-track`（分享埋点追踪）

## 需验证的安全规则

- `family_spaces` 集合：仅members数组中的userId可读取
- `family_invites` 集合：仅inviterUserId和目标userId可读取
- `share_records` 集合：仅sharerUserId可写，shareId全局可读

## 需验证的前端页面/组件

- `pages/share-preview/` 分享预览页
- `pages/mine/share-records/` 分享记录页
- `components/share-card/` 分享卡片Canvas组件
- `components/family-invite/` 家属邀请组件
- `components/share-risk-dialog/` L2风险提示组件
- `pages/home/home` 首页onShareAppMessage
- `subpkg-guide/pages/guidebooks-detail/index` 攻略详情onShareAppMessage
- `subpkg-guide/pages/guide-detail/index` 指引详情onShareAppMessage

## 验收标准文档

📋 `07_项目管理/住港伴_分享功能_闸门验收测试方案_v1.0.md`
📋 `住港伴_分享功能验收标准_v1.0.md`

## 9-Gate 执行

🔒 代码冻结 — Hermes 禁止修改代码文件

| Gate | 内容 | 标准 |
|:----:|------|------|
| 1 | verify.sh — 语法检查 + 敏感词扫描 | 0 SyntaxError + 0敏感词命中 |
| 2 | 合规验收 C01-C08 | 5 P0 + 2 P1 + 1 P2 |
| 3 | 安全验收 S01-S07 | 5 P0 + 1 P1 + 1 P2 |
| 4 | 功能验收 F01-F10 | 3 P0 + 4 P1 + 3 P2 |
| 5 | 隐私验收 P01-P06 | 4 P0 + 2 P1 |
| 6 | CloudBase部署验证 | 7云函数 + 4集合安全规则 |
| 7 | git push | commit → push |
| 8 | ledger | 完整操作记录 |
| 9 | Claude通知 | 回写3份ACL报告到inbox |

## P0不可降级清单（17项）

☐ C01 分享文案零诱导话术
☐ C02 分享不绑定任何利益
☐ C03 零"移民"禁用术语
☐ C04 无胁迫/虚假权威文案
☐ C05 分享不改变核心功能可用性
☐ S01 家庭邀请码加密+一次性使用
☐ S02 家庭空间数据隔离
☐ S03 L3内容系统级阻止分享
☐ S04 CloudBase安全规则生效
☐ S05 shareId不可逆向推导用户信息
☐ F01 分享卡片Canvas渲染正确
☐ F02 分享→回流链路完整
☐ F03 L2风险提示交互正确
☐ P01 L3页面禁用微信默认分享菜单
☐ P02 分享卡片不包含L3字段
☐ P03 分享卡片不暴露进度/路径
☐ P04 小程序码不携带用户标识
