# 测试命令速查卡

## 日常开发

```bash
npm test                        # 单元测试
npm run test:e2e:smoke          # 冒烟 E2E
```

## 提交前

```bash
npm test && npm run test:e2e:smoke
```

## 模块变更

```bash
npm run test:e2e:docs           # 证件夹
npm run test:e2e:process        # 流程控
npm run test:e2e:reminders      # 提醒器
npm run test:e2e:guidebooks     # 攻略书
npm run test:e2e:chat           # AI Chat
```

## 发版前

```bash
npm run test:ci                 # 全量: 单元 + E2E + 报告
npm run wetest:gen              # 生成 WeTest 脚本
```

## Pre-Push Hook

```bash
# 安装 (一次性)
ln -s ../../scripts/ci/pre-push-check.sh .git/hooks/pre-push
chmod +x .git/hooks/pre-push

# 跳过 (紧急)
SKIP_CHECK=1 git push
```
