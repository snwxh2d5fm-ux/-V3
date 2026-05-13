#!/bin/bash
# 麒麟 E2E 运行脚本 — DevTools in ~/Applications
export WECHAT_IDE_CLI="$HOME/Applications/wechatwebdevtools.app/Contents/MacOS/cli"
npx jest -c tests/e2e/jest.config.js --testPathPattern="$1"
