# 住港伴 V3 自动化测试操作手册

> 版本: v1.0  
> 最后更新: 2026-05-13  
> 适用范围: 住港伴 V3 微信小程序  

---

## 三层测试体系总览

```
┌──────────────────────────────────────────────────────┐
│              住港伴 V3 测试体系                        │
├──────────────┬──────────────────┬────────────────────┤
│  第一层       │  第二层            │  第三层              │
│  单元测试      │  E2E 自动化        │  云真机兼容性        │
│  (Jest)       │  (automator)      │  (WeTest)          │
├──────────────┼──────────────────┼────────────────────┤
│  运行速度: 秒  │  运行速度: 分钟     │  运行速度: 小时       │
│  覆盖: 逻辑层  │  覆盖: UI+交互     │  覆盖: 多机型         │
│  成本: 零     │  成本: 零          │  成本: 按次计费       │
│  频率: 每次push│  频率: 每日/PR     │  频率: 每周/发版前    │
└──────────────┴──────────────────┴────────────────────┘
```

---

## 第一层: 单元测试 (Jest)

### 运行

```bash
npm test                    # 全量单元测试
npm run test:watch          # 监听模式
npm run test:coverage       # 覆盖率报告
```

### 测试文件位置

```
__tests__/                  # 数据层、工具函数测试
tests/jest/                 # Jest 配置和 mock
```

### 覆盖范围

- `data/` 目录下所有 JS 文件加载验证
- 敏感词合规扫描 (utils/、data/ 目录)
- 云函数入口文件存在性检查
- 数据文件内容完整性

---

## 第二层: E2E 自动化 (miniprogram-automator)

### 环境准备

1. 安装微信开发者工具 (macOS: `/Applications/wechatwebdevtools.app`)
2. 开启 CLI 服务端口: 开发者工具 → 设置 → 安全 → 服务端口 (默认 9420)
3. 在开发者工具中打开住港伴 V3 项目
4. 安装依赖:

```bash
npm ci
```

### 运行命令

```bash
# 全量 E2E
npm run test:e2e

# 各模块独立运行
npm run test:e2e:smoke         # 冒烟测试 (启动+登录+TabBar)
npm run test:e2e:docs          # 证件夹模块
npm run test:e2e:process       # 流程控模块 ★重点
npm run test:e2e:guidebooks    # 攻略书模块
npm run test:e2e:reminders     # 提醒器模块
npm run test:e2e:chat          # AI Chat 模块
npm run test:e2e:regression    # 全量回归 (我的+会员+异常+PRD变更)

# CI 模式 (含前置检查)
npm run test:ci                # 全量: 单元测试 + E2E
npm run test:ci:quick          # 快速: 仅冒烟 E2E
```

### 测试文件结构

```
tests/e2e/
├── jest.config.js             # E2E Jest 配置
├── setup.js                   # 全局启动 (启动开发者工具连接)
├── teardown.js                # 全局清理
├── helpers/
│   └── index.js               # 辅助工具库 (导航/断言/截图/TabBar)
├── specs/
│   ├── smoke.test.js          # 冒烟: 启动+登录+TabBar (对应清单 §1-2)
│   ├── documents.test.js      # 证件夹 (对应清单 §3)
│   ├── reminders.test.js      # 提醒器 (对应清单 §4)
│   ├── process.test.js        # 流程控 (对应清单 §5) ★重点
│   ├── guidebooks.test.js     # 攻略书 (对应清单 §6)
│   ├── ai-chat.test.js        # AI Chat (对应清单 §7)
│   └── regression.test.js     # 回归: 我的+异常+PRD变更 (§8-11)
└── reports/                   # 测试报告 (gitignore)
    ├── e2e-report.html        # HTML 报告
    └── screenshots/           # 截图
```

### 真机测试清单覆盖映射

| 真机清单 | E2E 文件 | 测试项数 | 自动化程度 |
|---------|---------|:------:|:--------:|
| §0 DSG-1 P0验证 | process.test.js | 14 | 部分可自动化 |
| §1 启动与登录 | smoke.test.js | 5 | 可自动化 |
| §2 TabBar导航 | smoke.test.js | 6 | 可自动化 |
| §3 证件夹 | documents.test.js | 10 | 可自动化 |
| §4 提醒器 | reminders.test.js | 8 | 可自动化 |
| §5 流程控 | process.test.js | 9 | 可自动化 |
| §6 攻略书 | guidebooks.test.js | 6 | 可自动化 |
| §7 AI Chat | ai-chat.test.js | 7 | 部分可自动化 |
| §8 我的+会员 | regression.test.js | 7 | 可自动化 |
| §9 数据持久化 | regression.test.js | 3 | 需真机验证 |
| §10 异常场景 | regression.test.js | 5 | 部分可自动化 |
| §11 PRD变更 | regression.test.js | 10 | 可自动化 |

> 标注"需真机验证"的项涉及杀进程恢复、隔天恢复、断网等系统级操作，automator 无法完整模拟。

---

## 第三层: 云真机兼容性 (WeTest)

### 生成测试脚本

```bash
npm run wetest:gen
```

此命令生成 `tests/e2e/reports/wetest-script.json`，可在 WeTest 平台直接上传。

### 手动上传步骤

1. 登录 [WeTest 云真机](https://wetest.qq.com/cloud/miniprogram)
2. 上传开发版小程序
3. 导入 `wetest-script.json`
4. 选择机型池 (建议至少覆盖 iOS + Android 各 3 款)
5. 启动兼容性测试
6. 约 15-30 分钟后查看报告

### 推荐机型池

| 平台 | 机型 | 优先级 |
|------|------|:----:|
| iOS | iPhone 16 Pro Max | 高 |
| iOS | iPhone 15 | 高 |
| iOS | iPhone SE (3rd) | 中 |
| Android | 华为 P60 Pro (HarmonyOS) | 高 |
| Android | 小米 14 Pro | 高 |
| Android | OPPO Find X7 | 中 |
| Android | vivo X100 Pro | 中 |
| Android | 三星 Galaxy S24 Ultra | 低 |

---

## Git 质量门禁 (Pre-Push Hook)

### 安装

```bash
ln -s ../../scripts/ci/pre-push-check.sh .git/hooks/pre-push
chmod +x .git/hooks/pre-push
```

### 自动检查项

每次 `git push` 前自动执行:

1. 敏感词合规扫描 (检查 pages/、components/、utils/、data/、cloudfunctions/)
2. 单元测试全量运行
3. 页面路径完整性验证

### 跳过检查

紧急修复时:

```bash
SKIP_CHECK=1 git push
```

---

## 日常开发流程

### 开发阶段

```
写代码 → npm test → 通过 → 提交
           ↓ 失败
        修复 → 重测
```

### 提交前

```
git add → npm run test:e2e:smoke → git commit → git push
                                     ↓
                              pre-push hook 自动触发
                              (合规+单元+路径检查)
```

### 合并 PR 前

```
npm run test:ci          # 全量 E2E + 单元
npm run wetest:gen       # 生成 WeTest 脚本
# → 上传 WeTest 跑兼容性
```

### 发版前

```
npm run test:ci           # 本地全量
WeTest 云真机兼容性测试    # 多机型覆盖
真机验证 (仅 P0 场景)     # 人工抽查高风险路径
```

---

## 编写新的 E2E 用例

### 模板

```javascript
const {
  goToTab, navigateTo,
  expectVisible, tapElement, findElement,
  screenshot, mockLogin, clearStorage,
} = require('../helpers');

let mp;
beforeAll(() => { mp = global.__miniProgram__; });
beforeEach(async () => {
  await clearStorage(mp);
  await mockLogin(mp);
});
afterEach(async () => { await screenshot(mp, '模块名'); });

describe('模块名', () => {
  test('用例描述', async () => {
    // 1. 导航到目标页面
    await goToTab(mp, 'process');

    // 2. 操作
    const btn = await findElement(mp, '.target-btn');
    if (btn) await btn.tap();

    // 3. 断言
    const page = await mp.currentPage();
    expect(page.path).toContain('expected');
  });
});
```

### 常用 Helper API

| 函数 | 说明 |
|------|------|
| `goToTab(mp, name)` | 切换到指定 Tab |
| `navigateTo(mp, url)` | 跳转页面 |
| `findElement(mp, selector)` | 查找单个元素 |
| `findElements(mp, selector)` | 查找多个元素 |
| `tapElement(mp, selector)` | 点击元素 |
| `typeText(mp, selector, text)` | 输入文本 |
| `expectVisible(mp, selector)` | 断言元素可见 |
| `expectText(mp, selector, text)` | 断言文本包含 |
| `screenshot(mp, name)` | 截图 |
| `mockLogin(mp)` | Mock 登录状态 |
| `clearStorage(mp)` | 清除缓存 |

### 注意事项

1. automator 不能调用真实的微信登录，需要用 `mockLogin` 模拟
2. `wx.chooseImage`、`wx.scanCode` 等原生 API 在 automator 中不可用
3. 云函数调用在 automator 中可以正常工作
4. 复杂动画和手势需要人工验证

---

## 已知限制

| 场景 | 限制 | 替代方案 |
|------|------|---------|
| 微信登录 | automator 无法调用真实微信授权 | mockLogin 模拟 |
| 相机/扫码 | 原生能力不可用 | 真机验证 |
| 支付流程 | 微信支付不可模拟 | Sandbox 环境 |
| 消息推送 | 模板消息不可测试 | 真机验证 |
| 杀进程恢复 | 系统级操作 | 真机验证 |
| 性能测试 | automator 不适合压测 | 独立压测工具 |

---

## 常见问题

**Q: 运行 E2E 时报 "CLI 未找到"**

A: 检查微信开发者工具是否已安装并打开。macOS 默认路径为 `/Applications/wechatwebdevtools.app`。确保"设置 → 安全 → 服务端口"已开启。

**Q: 测试超时怎么办?**

A: 在 `tests/e2e/jest.config.js` 中调整 `testTimeout`（默认 60000ms）。云函数调用可能需要更长的等待时间。

**Q: 如何在 CI 中运行?**

A: CI 机器需要安装微信开发者工具 CLI。可以使用 `scripts/ci/run-e2e.sh`，它包含完整的前置检查和错误处理。建议使用 Mac 节点的 GitHub Actions runner。

**Q: 截图存在哪里?**

A: `tests/e2e/reports/screenshots/` 目录。HTML 报告中也包含了失败用例的截图。
