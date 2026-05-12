# 云函数部署标准流程

> 技能类型: 固定操作手册
> 每次部署/修改云函数时严格按此流程

## 前置检查
1. 确认 CloudBase 环境为 `cloudbase-d1g17tgt7cc199a60`
2. 确认本地代码与云端版本一致 (如有冲突，以本地为准但需记录)

## 部署步骤
1. 修改代码后，先在本地验证语法: `node -c cloudfunctions/<name>/index.js`
2. 通过 MCP 部署:
   ```
   mcp_cloudbase_manageFunctions({
     action: 'createFunction',
     func: { name: '<functionName>', ... },
     functionRootPath: '/absolute/path/to/cloudfunctions'
   })
   ```
3. 部署后立即调用 smoke test 验证:
   ```
   mcp_cloudbase_manageFunctions({
     action: 'invokeFunction',
     functionName: '<functionName>',
     params: { _smoke: true }
   })
   ```
4. 检查返回结果，确认无异常

## 回滚规则
- 如部署后 smoke test 失败，**必须回滚**到上一个已知良好版本
- 回滚后记录失败原因到 task-board.yaml
- 同一函数**连续2次部署失败**，必须暂停并触发代码审查

## 部署后验证清单
- [ ] 云函数状态为 Active
- [ ] 日志无 CRITICAL/ERROR
- [ ] 调用参数正确应答
- [ ] 依赖的集合/索引完好
- [ ] K2 安全规则未被绕过
