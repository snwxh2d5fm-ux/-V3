# CODE_REVIEW_KIRIN — R3

## P0 (2)

**P0-1** documents/index/index.js:102 — `getActiveStageIndex` 未导入，必抛 ReferenceError
**P0-2** cloudfunctions/generate-pdf/index.js:37 — 图片下载无逐条错误隔离，一张失败=全部失败

## P1 (9)

slot__btn--full CSS未定义、误删setNavigationBarTitle、死代码、无图片尺寸上限、totalRequired计数不一致、存储键名不一致(_user_status)、try-catch吞错过于激进、actionSheet超限静默失败、summary国际化断裂

## P2 (6)

var/const混用、数组假设无防御、非标准aria-label、substring surrogate pair风险、新增模板缺mode维度
