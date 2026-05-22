# REVIEW: 工作区未提交文件 — commit + push

**日期**: 2026-05-19
**来源**: Hermes
**优先级**: P1

---

## 未提交文件

### Modified (5)

- `app.json` — 页面注册变更
- `ledger.jsonl` — 操作日志
- `pages/mine/index/index.js` — 我的页面
- `pages/mine/notify-settings/notify-settings.wxml` — 通知设置
- `pages/mine/notify-settings/notify-settings.wxss` — 通知设置样式

### Untracked (6)

- `cloudfunctions/wecom-bot/` — 企业微信机器人云函数
- `subpkg-feedback/pages/list/` — 反馈列表子包
- `subpkg-feedback/pages/wecom-qr/` — 企业微信群二维码
- `wecom-qr.png` — 二维码图片
- `inbox/NOTIFY_fix_all_tests.md` — Hermes 通知文件
- `inbox/REVIEW_fix_all_tests.md` — Hermes 审查文件

## 操作

```
cd ~/Downloads/港动人生/住港伴V3-开发中
git add -A
git commit -m 'feat: 企业微信bot + 反馈子包 + mine页面更新'
git push origin main
```

## 验证

- `npx jest --forceExit` 344+
- git status 干净
