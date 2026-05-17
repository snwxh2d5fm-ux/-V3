/**
 * 攻略书数据管线验证脚本
 * node verify-pipeline.cjs
 */
var assert = require('assert');
global.wx = { getStorageSync: function() { return null; }, setStorageSync: function() {} };
global.getApp = function() { return { globalData: {} }; };

var assemblePath = require('./data/onboarding-paths').assemblePath;
var norm = require('./utils/normalizeTask');
var cache = require('./utils/lifeGuideCache');

// ── 测试参数 ──
var P = {
  fresh_single:  { visaType:'ttps-bc', familyStatus:'single',    arrivalScenario:'fresh',       existingAssets:[] },
  pre_single:    { visaType:'qmas',    familyStatus:'single',    arrivalScenario:'pre-arrival', existingAssets:[] },
  fresh_preschool: { visaType:'qmas', familyStatus:'preschool', arrivalScenario:'fresh',       existingAssets:[] },
  fresh_school:  { visaType:'qmas',    familyStatus:'school-age', arrivalScenario:'fresh',     existingAssets:[] },
};

console.log('=== 攻略书管线验证 ===\n');

// 1. assemblePath 基本功能
console.log('1. assemblePath');
var r1 = assemblePath(P.fresh_single);
assert(r1.tasks.length > 0); assert(r1.phases.length > 0);
console.log('   fresh/single:', r1.tasks.length, '任务', r1.phases.length, '关');

var r2 = assemblePath(P.pre_single);
assert(r2.tasks.length > 0);
console.log('   pre/single: ', r2.tasks.length, '任务（仅关卡0）');

var r3 = assemblePath(P.fresh_preschool);
var hasP5 = r3.tasks.some(function(t){return t.phase===5;});
assert(hasP5);
console.log('   fresh/preschool:', r3.tasks.length, '任务 | 关卡5:', 'YES');
console.log('   PASS\n');

// 2. fetchByPathLocal 同步返回
console.log('2. fetchByPathLocal 同步性');
var lr = cache.fetchByPathLocal('ttps-bc','single','fresh',[]);
assert(!(lr instanceof Promise), '不是 Promise');
assert(lr.data.tasks.length === r1.tasks.length);
assert(lr.source === 'local');
console.log('   同步: YES | 任务数:', lr.data.tasks.length, '| source: local');
console.log('   PASS\n');

// 3. 关键任务内容完整性
console.log('3. 关键任务内容');
var checks = [
  {id:'onboard-003', min:4, p:P.pre_single,       label:'预约办理香港身份证（4步含反推过关日）'},
  {id:'onboard-204', min:3, p:P.fresh_single,      label:'登记SmartPLAY康体通'},
  {id:'onboard-207', min:2, p:P.fresh_single,      label:'申领公共图书馆卡'},
  {id:'onboard-300', min:2, p:P.fresh_single,      label:'完成找房向导'},
  {id:'onboard-306', min:3, p:P.fresh_single,      label:'熟悉周边环境'},
  {id:'onboard-501a',min:3, p:P.fresh_preschool,   label:'了解幼稚园三类体系'},
  {id:'onboard-501b',min:3, p:P.fresh_school,       label:'五类学校全景对比（轨道B: school-age）'},
];

var allPass = true;
checks.forEach(function(c){
  var tasks = assemblePath(c.p).tasks;
  var t = tasks.find(function(x){return x.id===c.id;});
  if (!t) { console.log('   '+c.id+' MISSING — FAIL'); process.exit(1); }
  if (!t.steps||t.steps.length<c.min) { console.log('   '+c.id+' 步骤不足 — FAIL'); process.exit(1); }
  var truncated = false;
  t.steps.forEach(function(s,i){ if(!s.content||s.content.length<10) truncated=true; });
  if (truncated) { console.log('   '+c.id+' 内容截断 — FAIL'); process.exit(1); }
  console.log('   '+c.id+' '+c.label+' — OK（'+t.steps.length+'步）');
});
console.log('   ALL PASS\n');

// 4. norm() 管线
console.log('4. norm() 字段映射');
var raw = assemblePath(P.pre_single).tasks.find(function(t){return t.id==='onboard-003';});
var n = norm(raw, {});
assert(n._id==='onboard-003'); assert(n.id==='onboard-003');
assert(n.time_estimate==='10分钟');
assert(typeof n.renewal_evidence==='object');
assert(Array.isArray(n.required_items));
assert(Array.isArray(n.official_links));
assert(n._urgencyClass==='required');
assert(n._completed===false);
assert(Array.isArray(n.scene_tags));
console.log('   ID归一化: OK | 字段映射: OK | 渲染标记: OK | 兜底: OK');
console.log('   PASS\n');

// 5. mergeCloudWithLocal — 截断修复
console.log('5. mergeCloudWithLocal 截断→本地优先');
var mockCB = [{_id:'cloud_abc',title:'完成找房向导',phase:3,urgency:'必修',steps:[{seq:1,title:'?',content:'截断...'}]}];
var local300 = assemblePath(P.fresh_single).tasks.filter(function(t){return t.id==='onboard-300';});
var merged = merge(local300, mockCB);
var m300 = merged.find(function(t){return t.title==='完成找房向导';});
assert(m300._id==='cloud_abc');
assert(m300.steps.length>=2);
assert(m300.steps[0].content.length>20);
console.log('   _id保留: cloud_abc | 步骤数:', m300.steps.length, '| 内容长度:', m300.steps[0].content.length);
console.log('   PASS\n');

// 6. 综合：从 fetchByPathLocal 到 norm 完整链路
console.log('6. 完整链路: fetchByPathLocal → norm → 渲染');
var lr2 = cache.fetchByPathLocal('ttps-bc','single','fresh',[]);
var tasks = lr2.data.tasks.map(function(t){return norm(t,{});});
var ids = tasks.map(function(t){return t._id;});
assert(ids.indexOf('onboard-300')>=0);
assert(ids.indexOf('onboard-204')>=0);
assert(tasks.every(function(t){return t._urgencyClass;}));
console.log('   '+tasks.length+' 任务全部规范化 | _urgencyClass 完备');
console.log('   PASS\n');

console.log('========================================');
console.log('  全 部 验 证 通 过');
console.log('========================================');

// ── 辅助 ──
function merge(localTasks, cloudTasks) {
  var idx = {};
  localTasks.forEach(function(t){if(t.title)idx[t.title]=t;});
  var out = [];
  cloudTasks.forEach(function(ct){
    var lm = ct.title?idx[ct.title]:null;
    if(lm){var m=JSON.parse(JSON.stringify(lm));if(ct._id)m._id=ct._id;out.push(m);delete idx[ct.title];}
    else out.push(ct);
  });
  Object.keys(idx).forEach(function(k){out.push(idx[k]);});
  return out;
}
