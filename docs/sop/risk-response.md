# SOP: 风险应对预案

**维护者**: MT天衣  
**版本**: v1.0  
**最后更新**: 2026-05-15

---

## R1: DevTools编译失败 / 粘滞旧项目

**症状**: `app.json: 在项目根目录未找到` / `AppID: undefined` / `code 10`

**根因**: DevTools连着旧项目或僵尸进程。

**标准修复**:
```bash
cli quit && sleep 2
cli open --project /Users/chillment/Downloads/港动人生/住港伴V3-开发中 && sleep 4
cli auto-preview --project /Users/chillment/Downloads/港动人生/住港伴V3-开发中 2>&1 | tee /tmp/devtools_log.txt
grep -iE "error|Error|WXML|WXSS|编译错误|code 10|expect|ReferenceError" /tmp/devtools_log.txt
```

**注意**:
- exit code 0 ≠ 无编译错误，必须grep扫描日志
- `cli quit` 后立即 `cli open` 可能超时，需 sleep 2-3
- `pkill` 可能被security-guard拦截，优先用 `cli quit`

---

## R2: verify.sh set-e 提前退出

**症状**: verify.sh输出不到50行就结束，exit code 1。

**根因**: `set -euo pipefail` 在B2 Jest失败时截断后续检查。

**临时方案**:
```bash
sed 's/set -euo pipefail/set -uo pipefail/' scripts/verify.sh | bash
```

**规则**: 若verify.sh输出不到50行 → 是set-e提前退出，用临时方案获取真实结果。

---

## R3: automator WebSocket断连

**症状**: `currentPage()` / `evaluate()` 全部timeout，约15-20次操作后。

**根因**: miniprogram-automator v0.12 WebSocket物理寿命限制，与载荷大小无关。

**已知稳定基线**: smoke(7) + documents(4) + reminders(3) = 14项，单次session 100%通过。

**应对**:
- E2E分批跑，每批约12项，批间重启DevTools
- 不要在beforeEach中连续调用多个evaluate
- 禁止在globalSetup中使用reLaunch（会断连）
- switchTab用 `mp.evaluate(() => wx.switchTab({ url }))` 绕过automator内部方法

**当前策略**: L1搁置，Jest单元测试(386/386)替代L1作为push门禁。

---

## R4: verify.sh A8 PII假阳性

**症状**: A8扫描报 `发现N个文件含疑似PII`。

**根因**: verify.sh A8未排除 `cloudfunctions/*/node_modules/`，第三方库数字常量被误匹配。

**判断方法**:
```bash
find . -name "*.js" -not -path "*/node_modules/*" | xargs grep -lE '手机号|身份证号' 2>/dev/null
```
排除node_modules后结果为空 → 假阳性，标记「预存」放行。

---

## R5: Claude声称完成但代码未提交

**症状**: outbox有done.md，但 `git status` 显示24个文件未提交。

**应对**:
1. 写 outbox/URGENT_{task}_NOT_COMMITTED.md 催更
2. 同步到 ~/Claude/cowork/inbox/
3. claude-cowork 后台通知（background=true）
4. 更新PROGRESS.md阻塞项

**禁止**: Hermes自己commit Claude的代码。

---

## R6: Claude Desktop沙盒陷阱

**症状**: Claude产出文件但Hermes找不到（outbox引用路径不存在）。

**根因**: Claude Desktop文件编辑写入沙盒（Claude-3p/），不落地项目目录。

**应对**: 通知Claude用 `mcp__hermes__write_file` 重写到项目目录。

---

## R7: 包体积超2MB

**症状**: `code 10, 80051, source size exceed max limit 2MB`

**应对**:
- 图片走云存储，不打包进小程序
- 检查是否有大文件误入包体
- `du -sh pages/ data/ utils/ components/` 排查

---

## R8: claude-cowork前台阻塞

**症状**: Hermes调用claude-cowork后长时间无响应，超时中断。

**根因**: claude-cowork前台调用会阻塞Hermes。

**修复**: 必须 `terminal(background=true)` 或命令末尾加 `&`。

---

## R9: subagent审查误报P0

**症状**: 麒麟subagent报告P0问题，但代码中已修复。

**根因**: subagent可能查看了未提交版本或错误解读代码。

**应对**:
1. 每个P0问题用 `read_file` 独立验证代码
2. 不直接采信subagent P0清单写入TASK
3. 先确认问题真实存在，再写outbox分派

---

## R10: inbox路径不同步

**症状**: Claude报"文件不存在"，但Hermes已写入。

**根因**: claude-cowork CWD=项目目录，只看 `项目/inbox/`，不看 `~/Claude/cowork/inbox/`。

**修复**:
```bash
cp ~/Claude/cowork/inbox/*.md /Users/chillment/Downloads/港动人生/住港伴V3-开发中/inbox/
```

**预防**: 每次写inbox必须同步双路径（见communication-flow.md §ACL通知协议）。
