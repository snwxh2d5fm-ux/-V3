# 玄武PRD审查报告 — 住港伴 V3

**审查对象**: commit `6d9204f` (企业微信bot + 反馈子包 + mine页面更新)  
**审查者**: 玄武 (via Hermes delegate_task)  
**审查时间**: 2026-05-19  
**变更规模**: 23 files, +1126/-2

---

## 🔴 P0 — 阻断 (必须立即修复)

### P0-01: 企业微信密钥硬编码暴露到Git仓库

- **PRD要求**: 企业微信回调密钥属机密信息，不得明文提交代码仓库
- **实际代码**: `cloudfunctions/wecom-bot/config.json` 明文写入 CorpID/Token/EncodingAESKey/AgentSecret/AgentID
- **偏差**: 密钥随 commit 6d9204f 进入 Git 历史。任何人可获取企微完整控制权
- **修复**:
  1. 紧急: 企业微信管理后台轮换全部密钥
  2. 从 config.json 和 index.js 删除硬编码，仅从 process.env 读取
  3. git filter-branch 或 BFG 清理历史后 force push

### P0-02: 反馈提交时图片内容安全审核未实际执行

- **PRD要求**: 用户上传截图应做内容安全审核(色情/暴恐/违法)
- **实际代码**: `subpkg-feedback/pages/submit/index.js` L89-L92:
  ```javascript
  wx.cloud.callFunction({
    name: 'content-moderation',
    data: { action: 'moderateText', content: 'image_upload' }  // BUG: 传字符串非图片
  }).catch(function() { /* 降级 */ });
  ```
- **偏差**: 
  1. 审核的是字符串 "image_upload" 而非图片内容
  2. content-moderation 无 moderateImage 接口
  3. .catch() 静默吞错，审核失败也继续上传
- **修复**:
  1. content-moderation 新增 moderateImage action (腾讯云IMS)
  2. 调用改为 `data: { action: 'moderateImage', fileID: uploadRes.fileID }`
  3. 审核失败阻断上传并提示用户

### P0-03: 反馈列表"处理中"Tab无法匹配 in_progress 状态工单

- **PRD要求**: "处理中"Tab应展示所有未完结反馈(submitted + in_progress)
- **实际代码**:
  - 前端 `list/index.js` L8: `{ key: 'submitted', label: '处理中' }` → Tab发 `status: 'submitted'`
  - 后端 `feedback-submit/index.js` L142: `where.status = status` → 精确匹配单个状态
  - 前端 L102-103: `in_progress` 也映射为"处理中"标签
- **偏差**: 客服改状态为 in_progress 后，用户点"处理中" Tab 看不到该工单(只能在"全部"中看到)
- **修复**: 
  - 方案A(推荐): 后端 `list` action 将 `status: 'submitted'` 转义为 `status: _.in(['submitted', 'in_progress'])`
  - 方案B: 前端增加独立"处理中(in_progress)" Tab

### P0-04: wecom-bot 云函数架构 — 普通云函数自建 http.Server

- **PRD要求**: 企微回调应在 HTTP 云函数或 CloudRun 上运行
- **实际代码**: `cloudfunctions/wecom-bot/index.js` L41-L44 在普通云函数中启动 `http.createServer` 监听 9000 端口
- **偏差**:
  1. 普通云函数环境不一定允许绑定自定义端口
  2. 函数实例生命周期短暂，冷启动后端口可能未就绪
  3. 缺少固定公网域名
- **修复**:
  1. 改为 CloudBase HTTP 云函数(入口为 `exports.main`)
  2. 或部署到云托管(CloudRun)

---

## 🟡 P1 — 重要 (发版前修复)

### P1-01: 反馈列表 hasMore 逻辑误报
- **文件**: `feedback-submit/index.js` L185: `hasMore: items.length >= limit`
- **问题**: 恰好返回 limit 条时恒为 true，可能已是最后一页
- **修复**: 先 count() 总数，`hasMore = (skip + items.length) < total`

### P1-02: 通知设置页客服按钮 session-from 参数空值
- **文件**: `notify-settings.wxml` L114: `session-from="{{'notify-settings|' + userStatus + '|' + crt01.tmplAuth}}"`
- **问题**: userStatus/crt01 初始为空，数据加载完成前参数不完整
- **修复**: JS 计算属性拼接，数据加载完成前不渲染客服按钮: `wx:if="{{userStatus}}"`

### P1-03: wecom-qr.png 仅为占位文件
- **文件**: `wecom-qr.png` 908字节，不像是有效二维码
- **问题**: 代码中引用的是云存储路径，但本地有占位文件
- **修复**: 确认有效性，若非有效则从仓库删除

### P1-04: 反馈提交页未对文本做安全审核
- **文件**: `subpkg-feedback/pages/submit/index.js`
- **问题**: 提交时仅调 feedback-submit 做PII脱敏，未调 content-moderation 做文本违规审核
- **修复**: onSubmit 中先调 content-moderation moderateText，审核通过再提交

### P1-05: 反馈列表页缺少返回"我的"页面入口
- **文件**: `subpkg-feedback/pages/list/index.wxml`
- **问题**: 无返回"我的"入口，从深层链接进入时可能"死胡同"
- **修复**: 底部增加"返回首页"入口: `wx.switchTab({ url: '/pages/mine/index/index' })`

---

## 🟢 P2 — 建议 (后续迭代)

### P2-01: CSS 变量 --gray-100 在子包 page 级别引用需确认作用域
- **文件**: 反馈子包三页 `.page { background:var(--gray-100) }`
- **问题**: 子包样式隔离可能导致全局 CSS 变量未生效
- **修复**: 显式引用 app.wxss 或确保 styleIsolation 配置正确

### P2-02: 反馈截图 mode="aspectFill" 可能裁切关键内容
- **文件**: `list/index.wxml` L64
- **问题**: aspectFill 等比填满裁切超出部分，Bug截图边缘信息可能丢失
- **修复**: 改为 mode="widthFix" 或 aspectFit

### P2-03: 企微机器人回复文案中路径指引与实际不一致
- **文件**: `wecom-bot/index.js` L181
- **问题**: "住港伴小程序→我的→意见反馈→添加客服微信" 缺少"提交页→扫客服二维码"步骤
- **修复**: 改为"我的→意见反馈→扫码咨询客服"

### P2-04: formatRelativeTime 超过12个月显示不自然
- **文件**: `list/index.js` L201-L202
- **问题**: 超过12个月显示"13月前""24月前"等不自然表述
- **修复**: 超过365天显示"1年前"，或直接显示完整日期

---

## 汇总

| 级别 | 数量 | 关键项 |
|:----:|:----:|--------|
| P0 | 4 | 密钥泄露 / 审核虚设 / 状态筛选断裂 / wecom-bot架构 |
| P1 | 5 | hasMore逻辑 / 客服参数 / 二维码占位 / 文本审核缺失 / 导航死胡同 |
| P2 | 4 | CSS作用域 / 截图裁切 / 文案准确性 / 时间格式化 |

**总体评价**: 反馈子包前后端链路(submit→list→detail→append)基本闭合，feedback-submit 的 PII 脱敏和数据隔离设计良好。P0-01(密钥泄露)和 P0-02(审核虚设)必须在合并前修复。
