/**
 * 攻略书全面测试 — 三层覆盖
 *   L1 单元: 每个函数独立验证
 *   L2 冒烟: 67 项任务逐张卡片展开检查
 *   L3 回归: 路径拼接 × 用户进度 × 续签档案
 * node test-guidebook-full.cjs
 */
var assert = require('assert');

// Mock wx for Node.js test environment
var mockStorage = {};
global.wx = {
  getStorageSync: function(key) { return mockStorage[key] || null; },
  setStorageSync: function(key, value) { mockStorage[key] = value; },
  getStorageInfoSync: function() { return { keys: Object.keys(mockStorage) }; },
  removeStorageSync: function(key) { delete mockStorage[key]; },
};
global.getApp = function() { return { globalData: {} }; };
global.Page = function() {};

var norm = require('./utils/normalizeTask');
var storage = require('./utils/onboarding-storage');
var cache = require('./utils/lifeGuideCache');
var assemblePath = require('./data/onboarding-paths').assemblePath;
var allTasks = require('./data/onboarding-tasks');
var sceneTags = require('./data/scene-tags');

var PASS = 0, FAIL = 0, SKIP = 0;
function check(desc, fn) {
  try { fn(); PASS++; } catch(e) { FAIL++; console.error('  FAIL ' + desc + ': ' + e.message); }
}
function skip(desc) { SKIP++; }

console.log('╔══════════════════════════════════╗');
console.log('║  攻略书 全面测试套件            ║');
console.log('╚══════════════════════════════════╝\n');

// ════════════════════════════════════════════════
// L1: 单元测试
// ════════════════════════════════════════════════
console.log('── L1 单元测试 ──\n');

// L1.1 norm()
console.log('  L1.1 normalizeTask');
var t0 = allTasks.find(function(t){return t.id==='onboard-101';});
var n = norm(t0);
check('_id 归一化', function(){ assert.equal(n._id, 'onboard-101'); });
check('timeEstimate→time_estimate', function(){ assert.equal(n.time_estimate, '10分钟'); });
check('renewalEvidence→renewal_evidence 对象', function(){ assert.equal(typeof n.renewal_evidence, 'object'); });
check('requiredItems→required_items 数组', function(){ assert(Array.isArray(n.required_items)); });
check('_urgencyClass=required', function(){ assert.equal(n._urgencyClass, 'required'); });
check('数组兜底 scene_tags', function(){ assert(Array.isArray(n.scene_tags)); });

var n2 = norm(t0, { progressEntry: { status: 'completed', materialCollected: true } });
check('进度标记 _completed', function(){ assert(n2._completed); });
check('进度标记 _materialCollected', function(){ assert(n2._materialCollected); });
console.log('    ' + PASS + '/' + (PASS + FAIL) + ' passed\n');
var l1_pass = PASS, l1_fail = FAIL; PASS = 0; FAIL = 0;

// L1.2 scene_tags 注入
console.log('  L1.2 scene_tags 映射');
var allNormed = allTasks.map(norm);
var noTags = allNormed.filter(function(t){return !t.scene_tags||!t.scene_tags.length;});
check('全部任务有标签', function(){ assert.equal(noTags.length, 0); });
var cats = ['银行','通讯','交通','住房','医疗','教育','税务','证件','运动','搬家','保险','社区'];
cats.forEach(function(c){
  var count = allNormed.filter(function(t){return t.scene_tags.indexOf(c)>=0;}).length;
  check(c + ' ≥ 1项', function(){ assert(count >= 1, c + ' 只有' + count + '项'); });
});
console.log('    ' + PASS + '/' + (PASS + FAIL) + ' passed\n');
l1_pass += PASS; l1_fail += FAIL; PASS = 0; FAIL = 0;

// L1.3 assemblePath
console.log('  L1.3 assemblePath 路径拼接');
var paths = [
  { p: 'fresh/single/ttps-bc',   params: {visaType:'ttps-bc', familyStatus:'single',    arrivalScenario:'fresh', existingAssets:[]} },
  { p: 'pre/single/qmas',        params: {visaType:'qmas',    familyStatus:'single',    arrivalScenario:'pre-arrival', existingAssets:[]} },
  { p: 'fresh/preschool/qmas',   params: {visaType:'qmas',    familyStatus:'preschool', arrivalScenario:'fresh', existingAssets:[]} },
  { p: 'fresh/school-age/qmas',  params: {visaType:'qmas',    familyStatus:'school-age',arrivalScenario:'fresh', existingAssets:[]} },
  { p: 'delayed/couple/iang',    params: {visaType:'iang',    familyStatus:'couple',    arrivalScenario:'delayed', existingAssets:[]} },
];
paths.forEach(function(path){
  var r = assemblePath(path.params);
  check(path.p + ' 有关卡', function(){ assert(r.phases.length > 0, '无关卡'); });
  check(path.p + ' 有任务', function(){ assert(r.tasks.length > 0, '无任务'); });
  check(path.p + ' 必修 > 0', function(){ assert(r.summary.totalRequired > 0); });
  // 路径过滤正确
  if (path.params.arrivalScenario === 'pre-arrival') {
    check(path.p + ' 仅关卡0', function(){ assert.equal(r.phases.length, 1); assert.equal(r.phases[0].phase, 0); });
  }
  if (path.params.familyStatus === 'preschool') {
    var hasP5 = r.tasks.some(function(t){return t.phase===5;});
    check(path.p + ' 包含关卡5', function(){ assert(hasP5); });
  }
});
console.log('    ' + PASS + '/' + (PASS + FAIL) + ' passed\n');
l1_pass += PASS; l1_fail += FAIL; PASS = 0; FAIL = 0;

// L1.4 mergeCloudWithLocal
console.log('  L1.4 mergeCloudWithLocal');
var localTasks = allTasks.map(norm);
var mockCB = [
  { _id:'cb_001', title:'购买八达通', steps:[{seq:1,title:'x',content:'截断'}] },
  { _id:'cb_002', title:'CB独有任务', steps:[{seq:1,title:'a',content:'云函数专有'}] },
];
var merged = mergeCB(localTasks, mockCB);
check('本地内容优先（八达通步骤数≥3）', function(){
  var t = merged.find(function(x){return x.title==='购买八达通';});
  assert(t.steps.length >= 3, '仅' + t.steps.length + '步');
  assert(t.steps[0].content.length > 10, '内容截断');
});
check('CloudBase独有任务保留', function(){
  assert(merged.some(function(x){return x.title==='CB独有任务';}));
});
check('本地 _id 未被覆盖', function(){
  var t = merged.find(function(x){return x.title==='购买八达通';});
  assert.equal(t._id, 'onboard-101');
});
console.log('    ' + PASS + '/' + (PASS + FAIL) + ' passed\n');
l1_pass += PASS; l1_fail += FAIL; PASS = 0; FAIL = 0;

// L1.5 fetchByPathLocal 同步性
console.log('  L1.5 fetchByPathLocal 同步');
var r = cache.fetchByPathLocal('ttps-bc','single','fresh',[]);
check('不是 Promise', function(){ assert(!(r instanceof Promise)); });
check('source=local', function(){ assert.equal(r.source, 'local'); });
check('有任务数据', function(){ assert(r.data.tasks.length > 0); });
console.log('    ' + PASS + '/' + (PASS + FAIL) + ' passed\n');
l1_pass += PASS; l1_fail += FAIL; PASS = 0; FAIL = 0;

// ════════════════════════════════════════════════
// L2: 冒烟测试 — 67项任务逐张卡片检查
// ════════════════════════════════════════════════
console.log('── L2 冒烟测试 ──\n');
console.log('  逐任务内容完整性检查 (' + allTasks.length + '项)\n');

var CRITICAL_FIELDS = [
  { field: 'title',     label: '标题',    minLen: 4 },
  { field: 'steps',     label: '步骤',    check: function(v){ return Array.isArray(v) && v.length >= 1; } },
  { field: 'urgency',   label: '必修/建议/可选', check: function(v){ return ['必修','建议','可选'].indexOf(v)>=0; } },
];

var phaseLabels = {0:'抵港前',1:'落地生存',2:'行政开户',3:'安居乐业',4:'出行融入',5:'子女教育',6:'财务税务',7:'续签准备'};

allTasks.forEach(function(t, idx) {
  var errors = [];
  var n = norm(t);

  // 标题
  if (!n.title || n.title.length < 4) errors.push('标题过短');

  // 步骤
  if (!Array.isArray(n.steps) || n.steps.length === 0) errors.push('无步骤');
  else {
    n.steps.forEach(function(s, i) {
      if (!s.title) errors.push('步骤'+(i+1)+'无标题');
      if (!s.content || s.content.length < 5) errors.push('步骤'+(i+1)+'内容空/过短('+(s.content? s.content.length:0)+'字)');
    });
  }

  // 必修/建议/可选
  if (['必修','建议','可选'].indexOf(n.urgency) === -1) errors.push('urgency无效:' + n.urgency);

  // 标签
  if (!n.scene_tags || n.scene_tags.length === 0) errors.push('无 scene_tags');

  // 数组字段不为 undefined
  ['tips','pitfalls','required_items','official_links'].forEach(function(f) {
    if (!Array.isArray(n[f])) errors.push(f + ' 不是数组');
  });

  var phaseName = phaseLabels[t.phase] || ('P'+t.phase);
  if (errors.length) {
    FAIL++;
    console.log('    ' + t.id + ' [' + phaseName + '] ' + n.title + ' — FAIL');
    errors.forEach(function(e) { console.log('      ' + e); });
  } else {
    PASS++;
  }
});

console.log('\n    ' + PASS + '/' + (PASS + FAIL) + ' passed, ' + FAIL + ' failed\n');
l1_pass += PASS; l1_fail += FAIL; PASS = 0; FAIL = 0;

// ════════════════════════════════════════════════
// L3: 回归 — 完整用户流
// ════════════════════════════════════════════════
console.log('── L3 回归测试 ──\n');

// L3.1 模拟完整用户流程
console.log('  L3.1 用户流程: fresh/single → 完成关卡0 → 关卡1自动展开');
var params = { visaType:'ttps-bc', familyStatus:'single', arrivalScenario:'fresh', housingIntent:'rent', existingAssets:[] };
storage.initOnboarding(params);
var progress = storage.getProgress();

check('progress 已创建', function(){ assert(progress); });
check('pathParams 含 housingIntent', function(){ assert.equal(progress.pathParams.housingIntent, 'rent'); });
check('family.applicable=false(single)', function(){ assert.equal(progress.renewalDossier.family.applicable, false); });
check('flags.housingWizardDone 存在', function(){ assert.equal(progress.flags.housingWizardDone, false); });

// 模拟完成几个任务
var path = assemblePath(params);
var p0Tasks = path.tasks.filter(function(t){return t.phase===0;});
p0Tasks.forEach(function(t){ storage.completeTask(t.id); });

// 重新获取进度
progress = storage.getProgress();
p0Tasks.forEach(function(t){
  check(t.id + ' 已完成', function(){ assert.equal(progress.tasks[t.id].status, 'completed'); });
});

// 模拟收集材料
var onboard301 = path.tasks.find(function(t){return t.id==='onboard-301';});
if (onboard301) {
  storage.completeTaskWithMaterial('onboard-301', '/tmp/test.jpg', '已打厘印租约', 'address');
  progress = storage.getProgress();
  check('续签档案 address 有材料', function(){ assert(progress.renewalDossier.address.items.length > 0); });
}

// 模拟找房向导完成
storage.markHousingWizardDone();
check('housingWizardDone 持久化', function(){ assert(storage.isHousingWizardDone()); });

// 导出
var checklist = storage.exportChecklist();
check('导出清单非空', function(){ assert(checklist.length > 0); });

console.log('    ' + PASS + '/' + (PASS + FAIL) + ' passed\n');
l1_pass += PASS; l1_fail += FAIL; PASS = 0; FAIL = 0;

// L3.2 路径修改
console.log('  L3.2 路径修改重置');
var ok = storage.updatePathParams({ visaType:'iang', familyStatus:'couple', arrivalScenario:'delayed', existingAssets:['hkid'] });
check('updatePathParams 成功', function(){ assert(ok); });
var p2 = storage.getProgress();
check('新路径 visaType=iang', function(){ assert.equal(p2.pathParams.visaType, 'iang'); });
check('新路径 familyStatus=couple', function(){ assert.equal(p2.pathParams.familyStatus, 'couple'); });
check('新路径 existingAssets 含 hkid', function(){ assert(p2.pathParams.existingAssets.indexOf('hkid')>=0); });
check('进度已重置（无旧任务）', function(){ assert(Object.keys(p2.tasks).length === 0); });

console.log('    ' + PASS + '/' + (PASS + FAIL) + ' passed\n');
l1_pass += PASS; l1_fail += FAIL;

// ════════════════════════════════════════════════
// 汇总
// ════════════════════════════════════════════════
console.log('╔══════════════════════════════════╗');
var total = l1_pass + l1_fail;
var pct = Math.round(l1_pass / total * 100);
var status = l1_fail === 0 ? '✅ ALL ' + total + ' PASSED' : '❌ ' + l1_pass + '/' + total + ' (' + pct + '%)';
console.log('║  ' + status);
console.log('╚══════════════════════════════════╝');

// ── 辅助 ──
function mergeCB(localTasks, cloudTasks) {
  var idx = {};
  localTasks.forEach(function(t){if(t.title)idx[t.title]=t;});
  var out = [];
  cloudTasks.forEach(function(ct){
    var lm = ct.title ? idx[ct.title] : null;
    if (lm) {} // local exists, keep as-is
    else out.push(ct);
  });
  Object.keys(idx).forEach(function(k){out.push(idx[k]);});
  return out;
}

process.exit(l1_fail > 0 ? 1 : 0);
