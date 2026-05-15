# 经验教训库

**维护者**: MT天衣  
**最后更新**: 2026-05-15

---

## L001: 静态闸门通过 ≠ 无Bug（2026-05-15）

**事件**: P2修复批次6 commits，verify.sh 38/39、Jest 367/425、DevTools三连全绿——7项静态闸门全部通过。但麒麟+玄武并行双审独立发现3个P0阻塞问题。

| P0 | 发现 | 逃过静态闸门原因 |
|----|------|-----------------|
| fetchByPath参数位移 | existingAssets填入housingIntent形参 | JS语法正确，无lint报错 |
| matchDistricts类型Bug | 字符串'b1' vs 数值10000比较永远false | JS隐式转换无报错 |
| Tab4 WXML缺渲染块 | 无activeTab===3的wx:elif块 | verify.sh不扫描功能完整性 |

**教训**: 静态闸门只检查代码红线（语法、规范、隐私），不检查逻辑正确性和功能完整性。双审是唯一能捕获此类问题的机制。

---

## L002: Claude声称完成但闸门未过（2026-05-14）

**事件**: Claude口头报告"9-Gate闭环，2aff77a已推送"。实际Gate 6 (DevTools编译)仍然失败——pages/guidebooks/index/index.wxml:257 WXML语法错误原封未动。

**根因**: Hermes没跑实际DevTools编译就接受了Claude的声称。

**教训**:
- 禁止信Claude的口头报告，每个Gate必须有独立验证证据
- Gate 6必须跑DevTools编译+grep扫描错误日志，不能只看exit code
- verify.sh通过 ≠ Gate 6通过

---

## L003: automator v0.12 WebSocket物理极限（2026-05-14）

**事件**: 三轮方案验证（大evaluate/文件种子/小evaluate分批），v0.12 WebSocket在~15-20次操作后必然降级。

**已验证的无效方案**:
1. mp.evaluate(大JSON) — 载荷大，连接提前断
2. 文件种子 + readFileSync — 权限denied
3. 多次小mp.evaluate — 与载荷大小无关，操作次数到即断
4. per-suite automator.launch()重连 — 全局状态污染

**教训**: 这是工具物理限制，非代码问题。当前策略：L1搁置，Jest单元测试替代。

---

## L004: claude-cowork inbox路径陷阱（2026-05-13）

**事件**: Hermes写入 ~/Claude/cowork/inbox/，Claude报"文件不存在"。

**根因**: claude-cowork CWD=项目目录，只看项目/inbox/，不看~/Claude/cowork/inbox/。

**教训**: 每次写inbox必须同步双路径。

---

## L005: Hermes修改测试代码被制止（2026-05-13）

**事件**: E2E冒烟switchTab断连，Hermes直接修改了tests/e2e/helpers/index.js。

**根因**: 误以为测试辅助代码不是"项目代码"。

**教训**: tests/e2e/helpers/、tests/e2e/specs/同样是项目代码，受红线约束。发现问题→写inbox委托Claude。

---

## L006: subagent审查误报P0（2026-05-15）

**事件**: 麒麟subagent将P0-1(fetchByPath参数位移)标记为未修复，但该问题已在cc4a0d3 commit中修复。Hermes基于误报写了P0修复任务后才独立验证发现已修复。

**教训**: subagent报告的每个P0问题，Hermes必须用read_file独立验证代码，不可直接采信。

---

## L007: 要求Claude跑测试导致会话卡死（2026-05-13）

**事件**: 两次通知要求Claude"复验regression"，第二次卡死23分钟被kill。

**根因**: Claude连不上DevTools或测试超时。

**教训**: Claude角色=写代码。测试/验证/BenchRun全部由Hermes执行。禁止在claude-cowork通知中要求Claude执行测试命令。
