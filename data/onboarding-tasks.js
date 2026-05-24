/**
 * 港漂通关手册 — 任务模板库（按关卡拆分）
 *
 * 数据按关卡拆分到 data/tasks/phase-{0-7}.js（8个文件）
 * 本文件合并导出为统一数组，兼容所有旧调用方
 *
 * 关卡0(抵港前)   phase-0.js
 * 关卡1(落地生存) phase-1.js
 * 关卡2(行政开户) phase-2.js
 * 关卡3(安居乐业) phase-3.js
 * 关卡4(出行融入) phase-4.js
 * 关卡5(子女教育) phase-5.js
 * 关卡6(财务税务) phase-6.js
 * 关卡7(续签准备) phase-7.js
 */

// ★ P0-FIX: 显式静态 require，WeChat bundler 才能正确打包各关卡文件
// 原动态 require('./tasks/phase-' + p + '.js') 被 bundler 忽略 → 全部 phase-*.js 未打包 → 崩溃
var allTasks = [].concat(
  require('./tasks/phase-0.js'),
  require('./tasks/phase-1.js'),
  require('./tasks/phase-2.js'),
  require('./tasks/phase-3.js'),
  require('./tasks/phase-4.js'),
  require('./tasks/phase-5.js'),
  require('./tasks/phase-6.js'),
  require('./tasks/phase-7.js'),
);

module.exports = allTasks;
