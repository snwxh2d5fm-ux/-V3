# 编译验证标准流程

> 技能类型: 固定操作手册
> 每次代码修改后必须执行

## 前置条件
- Node.js 已安装
- 微信开发者工具已安装（用于小程序编译验证）

## 验证步骤

### 1. 云函数语法检查
```bash
for f in cloudfunctions/*/index.js; do
  node -c "$f" || { echo "❌ 语法错误: $f"; exit 1; }
done
```

### 2. 运行总验证脚本
```bash
bash scripts/verify.sh
```
返回码 0 = 通过，非0 = 有未通过项。

### 3. 微信开发者工具编译验证
- 打开微信开发者工具
- 导入项目 `住港伴V3-开发中/`
- 确认编译无 error（warning 可接受）
- 确认所有 Tab 页面可正常切换

### 4. 常见错误处理

| 错误 | 解决方案 |
|------|---------|
| error code 10 (通用编译失败) | cli cache --clean → cli quit → 重开 |
| button 样式异常 | 显式 `::after { border: none }` + `line-height: 1.4` |
| switchTab 静默失败 | 改用 `wx.reLaunch` |
| Page() 箭头函数报错 | 必须用 `function(){}` 和 `var` |

## 验证通过标准
- [ ] 所有云函数语法正确
- [ ] verify.sh 全部通过
- [ ] 微信编译无 error
- [ ] 无新增敏感词
- [ ] 无新增 app.json 未注册页面
