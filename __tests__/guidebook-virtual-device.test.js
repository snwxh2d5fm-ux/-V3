/**
 * 虚拟真机测试 — 攻略书P0修复验收
 *
 * 模拟微信小程序环境，验证:
 *   1. 8个phase文件正确加载 (P0 fix)
 *   2. assemblePath 端到端工作
 *   3. 场景速查 Tab 1 全路径
 *   4. 数据损失后恢复+攻略书重新初始化
 *
 * 测试账户: "符生" — IANG签证，单身，新到港
 */

const path = require('path');
const vm = require('vm');

// ============================================================
// 虚拟微信环境 Mock
// ============================================================

let mockStorage = {};
let mockCloudData = {};
let mockUI = { toasts: [], modals: [], navigations: [], loadings: [] };
let mockLoggedIn = true;
let mockToken = 'mock-token-virtual-device';
let mockOpenid = 'fusheng-wechat';

function resetMocks() {
  mockStorage = {};
  mockUI = { toasts: [], modals: [], navigations: [], loadings: [] };
  mockLoggedIn = true;
  mockToken = 'mock-token-virtual-device';

  // 预置基础数据
  mockStorage['__cloud_user__'] = { isNew: false, _openid: mockOpenid };
  mockStorage['__session__'] = { token: mockToken, userStatus: 'approved' };
  mockStorage['__user_status__'] = 'approved';
  mockStorage['__user_sub_status__'] = 'approved_employed';
  mockStorage['__selected_path__'] = 'iang';
}

global.wx = {
  getStorageSync(key) { return mockStorage[key]; },
  setStorageSync(key, val) { mockStorage[key] = val; },
  removeStorageSync(key) { delete mockStorage[key]; },
  getStorageInfoSync() {
    return { keys: Object.keys(mockStorage), currentSize: 0, limitSize: 10240 };
  },
  cloud: {
    init() {},
    async callFunction({ name, data }) {
      // guidebook-sync getProgress
      if (name === 'guidebook-sync' && data.action === 'getProgress') {
        return { result: { code: 0, data: { progress: null } } };
      }
      // queryLifeGuideTasks
      if (name === 'queryLifeGuideTasks') {
        return { result: { code: 0, data: [], total: 0 } };
      }
      // user-auth getProfile
      if (name === 'user-auth' && data.action === 'getProfile') {
        return {
          result: {
            code: 0,
            userInfo: {
              _id: 'u_fusheng', _openid: mockOpenid,
              currentPhase: 'approved', subStatus: 'approved_employed',
              selectedPath: 'iang', activeProcessId: 'proc_1',
              membershipLevel: 'free', guidebookAllUnlocked: false,
              nickName: '符生', phoneBound: true,
            },
          },
        };
      }
      return { result: { code: 404 } };
    },
  },
  showToast(opts) { mockUI.toasts.push(opts); },
  showModal(opts) { mockUI.modals.push(opts); opts?.success?.({ confirm: true }); },
  showLoading(opts) { mockUI.loadings.push(opts); },
  hideLoading() {},
  navigateTo(opts) { mockUI.navigations.push({ type: 'navigateTo', url: opts.url }); },
  redirectTo(opts) { mockUI.navigations.push({ type: 'redirectTo', url: opts.url }); },
  reLaunch(opts) { mockUI.navigations.push({ type: 'reLaunch', url: opts.url }); },
  switchTab(opts) { mockUI.navigations.push({ type: 'switchTab', url: opts.url }); },
  getNetworkType(opts) { opts?.success?.({ networkType: 'wifi' }); },
  onNetworkStatusChange() {},
  getSystemInfoSync() {
    return { model: 'iPhone 14 Pro', system: 'iOS 18', platform: 'ios', SDKVersion: '3.15.2',
      pixelRatio: 3, screenWidth: 393, screenHeight: 852, windowWidth: 393, windowHeight: 852,
      statusBarHeight: 54 };
  },
  stopPullDownRefresh() {},
  setClipboardData(opts) { opts?.success?.(); },
  chooseImage(opts) { opts?.success?.({ tempFilePaths: ['/mock/photo.jpg'] }); },
  saveImageToPhotosAlbum(opts) { opts?.success?.(); },
  previewImage() {},
  openDocument() {},
  requestPayment(opts) { opts?.fail?.({ errMsg: 'requestPayment:fail cancel' }); },
  env: { USER_DATA_PATH: '/mock/user/data' },
  getFileSystemManager() { return { accessSync() {}, mkdirSync() {} }; },
  CanIUse() { return true; },
};

global.getApp = () => ({
  globalData: {
    userInfo: { nickName: '符生' },
    userStatus: mockStorage['__user_status__'] || 'approved',
    userSubStatus: mockStorage['__user_sub_status__'] || 'approved_employed',
    isLoggedIn: mockLoggedIn,
    token: mockToken,
    phoneBound: true,
    membershipLevel: 'free',
    cloudReady: true,
    activeProcessId: 'proc_1',
    activeProcess: { name: 'IANG毕业生' },
    selectedPath: 'iang',
    guidebookAllUnlocked: false,
    membershipExpiry: null,
    rulesLoaded: true,
    dbSyncStatus: 'idle',
    encryptionKey: null,
    dataVersion: 'v5',
    isOnline: true,
    networkType: 'wifi',
  },
});

// Mock Page constructor — captures config for testing
global.__lastPageConfig = null;
global.Page = function(config) {
  global.__lastPageConfig = config;
  // Store methods on the instance for direct testing
  global.__pageInstance = {
    data: JSON.parse(JSON.stringify(config.data || {})),
    setData: function(obj) {
      Object.assign(global.__pageInstance.data, obj);
    },
  };
  // Bind all methods
  for (const key of Object.keys(config)) {
    if (typeof config[key] === 'function' && key !== 'data') {
      global.__pageInstance[key] = config[key].bind(global.__pageInstance);
    }
  }
};

// ============================================================
// Test Runner
// ============================================================

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  PASS: ' + name);
  } catch (e) {
    failed++;
    failures.push({ name, error: e.message });
    console.log('  FAIL: ' + name + ' — ' + e.message);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'assertion failed');
}

// ============================================================
// Test Suite
// ============================================================

console.log('===========================================');
console.log('虚拟真机测试: 攻略书P0修复验收');
console.log('设备: iPhone 14 Pro (iOS 18)');
console.log('账户: 符生 (IANG/单身/新到港)');
console.log('===========================================\n');

// ─── VD-1: 8相文件全部正确加载 (P0根因验证) ───
console.log('--- VD-1: P0根因验证 ---');

test('VD-1.1: Phase-0 加载 (抵港前准备)', () => {
  const tasks = require('../data/tasks/phase-0');
  assert(Array.isArray(tasks), 'Must be array');
  assert(tasks.length === 5, 'Expected 5 tasks, got ' + tasks.length);
  assert(tasks[0].id === 'onboard-001', 'First task should be onboard-001');
  assert(tasks[0].title === '确认签证标签页信息无误');
});

test('VD-1.2: Phase-3 加载 (安居乐业 — 最大关卡)', () => {
  const tasks = require('../data/tasks/phase-3');
  assert(tasks.length === 14, 'Expected 14 tasks, got ' + tasks.length);
});

test('VD-1.3: Phase-7 加载 (续签准备)', () => {
  const tasks = require('../data/tasks/phase-7');
  assert(tasks.length === 5, 'Expected 5 tasks, got ' + tasks.length);
});

test('VD-1.4: onboarding-tasks 聚合66条任务', () => {
  const all = require('../data/onboarding-tasks');
  assert(all.length === 66, 'Expected 66, got ' + all.length);
  // 8关全部有任务
  const phases = {};
  all.forEach(t => { phases[t.phase] = (phases[t.phase] || 0) + 1; });
  for (let p = 0; p < 8; p++) {
    assert(phases[p] > 0, 'Phase ' + p + ' has 0 tasks');
  }
});

// ─── VD-2: 全链路 — path setup → init → 数据就位 ───
console.log('\n--- VD-2: 全链路数据流 ---');

test('VD-2.1: assemblePath 非会员返回正确数据', () => {
  const { assemblePath } = require('../data/onboarding-paths');
  const result = assemblePath({
    visaType: 'iang', familyStatus: 'single',
    arrivalScenario: 'fresh', existingAssets: [],
  });
  assert(result.phases.length === 8, 'Expected 8 phases');
  assert(result.tasks.length === 49, 'Expected 49 tasks for IANG+fresh');
  assert(result.summary.totalRequired === 27);
  assert(result.summary.totalTasks === 49);
});

test('VD-2.2: onboarding-storage.initOnboarding + getProgress', () => {
  const storage = require('../utils/onboarding-storage');
  storage.initOnboarding({
    visaType: 'iang', familyStatus: 'single',
    arrivalScenario: 'fresh', existingAssets: [],
  });
  const progress = storage.getProgress();
  assert(progress !== null, 'Progress must not be null');
  assert(progress.pathParams.visaType === 'iang');
  assert(progress.pathParams.familyStatus === 'single');
});

test('VD-2.3: lifeGuideCache.fetchByPathLocal', () => {
  const cache = require('../utils/lifeGuideCache');
  const result = cache.fetchByPathLocal('iang', 'single', 'fresh', [], false);
  assert(result.source === 'local');
  assert(result.data.tasks.length === 49);
  assert(result.data.phases.length === 8);
});

// ─── VD-3: 攻略书页面核心逻辑 ───
console.log('\n--- VD-3: 攻略书页面逻辑 ---');

test('VD-3.1: _loadAllLocalTasks 加载全部66条', () => {
  // 模拟 guidebooks/index line 925
  const allTasks = require('../data/onboarding-tasks');
  assert(allTasks.length === 66);
  // 每条任务都有必需字段
  allTasks.forEach((t, i) => {
    assert(t.id, 'Task ' + i + ' missing id');
    assert(t.title, 'Task ' + i + ' missing title');
    assert(typeof t.phase === 'number', 'Task ' + i + ' missing phase');
  });
});

test('VD-3.2: mergeProgress 核心逻辑', () => {
  const { assemblePath } = require('../data/onboarding-paths');
  const result = assemblePath({
    visaType: 'iang', familyStatus: 'single',
    arrivalScenario: 'fresh', existingAssets: [],
  });
  let tasks = JSON.parse(JSON.stringify(result.tasks));

  const progress = {
    tasks: {
      'onboard-101': { status: 'completed', materialCollected: false },
      'onboard-104': { status: 'skipped', materialCollected: false },
    },
    phases: {},
    currentPhase: 1,
    pathParams: { visaType: 'iang', familyStatus: 'single', arrivalScenario: 'fresh' },
  };

  // 模拟 normalizeTask → mergeProgress
  tasks = tasks.map(t => {
    const pt = progress.tasks[t.id];
    if (pt) {
      return {
        ...t,
        _completed: pt.status === 'completed' || pt.status === 'skipped',
        _materialCollected: !!pt.materialCollected,
        _skipped: pt.status === 'skipped',
      };
    }
    return { ...t, _completed: false, _materialCollected: false, _skipped: false };
  });

  // 构建 phaseMap
  const phaseMap = {};
  tasks.forEach(t => {
    const p = t.phase;
    if (!phaseMap[p]) phaseMap[p] = { phase: p, totalRequired: 0, totalTasks: 0, requiredCompleted: 0 };
    phaseMap[p].totalTasks++;
    if (t.urgency === '必修' && !t._skipped) phaseMap[p].totalRequired++;
    if (t.urgency === '必修' && t._completed) phaseMap[p].requiredCompleted++;
  });

  // 验证
  const onboard101 = tasks.find(t => t.id === 'onboard-101');
  assert(onboard101._completed === true, 'onboard-101 should be completed');

  const onboard104 = tasks.find(t => t.id === 'onboard-104');
  assert(onboard104._skipped === true, 'onboard-104 should be skipped');
});

// ─── VD-4: 场景速查 (Tab 1) 全路径 ───
console.log('\n--- VD-4: 场景速查 (Tab 1) ---');

test('VD-4.1: 全部分类加载66条', () => {
  const allTasks = require('../data/onboarding-tasks');
  assert(allTasks.length === 66);
});

test('VD-4.2: 按 scene_tags 过滤 (模拟云函数行为)', () => {
  // 本地任务没有 scene_tags，但可以按 category 过滤
  const allTasks = require('../data/onboarding-tasks');
  const phase0Tasks = allTasks.filter(t => t.category === '抵港前准备');
  assert(phase0Tasks.length === 5, 'Phase 0 has 5 tasks');

  const phase3Tasks = allTasks.filter(t => t.category === '安居乐业');
  assert(phase3Tasks.length === 14, 'Phase 3 has 14 tasks');
});

test('VD-4.3: 客户端搜索 (title/subtitle)', () => {
  const allTasks = require('../data/onboarding-tasks');
  const keyword = '银行';
  const filtered = allTasks.filter(t => {
    const title = (t.title || '').toLowerCase();
    const sub = (t.subtitle || '').toLowerCase();
    return title.includes(keyword) || sub.includes(keyword);
  });
  assert(filtered.length >= 1, 'Should find at least 1 bank-related task');
  const bankTask = filtered.find(t => t.title.includes('银行'));
  assert(bankTask, 'Should find bank task');
  assert(bankTask.urgency === '必修');
});

// ─── VD-5: 数据损失恢复 + 攻略书重新初始化 ───
console.log('\n--- VD-5: 数据损失恢复 ---');

test('VD-5.1: wipe后 re-init 仍可加载攻略数据', () => {
  // 模拟wipe: 清除onboarding
  delete mockStorage['__onboarding__'];

  // 重新执行 initOnboarding
  const storage = require('../utils/onboarding-storage');
  storage.initOnboarding({
    visaType: 'ttps-bc', familyStatus: 'couple',
    arrivalScenario: 'fresh', existingAssets: [],
  });

  const progress = storage.getProgress();
  assert(progress !== null, 'Should recover progress after wipe');

  // assemblePath 仍能工作
  const { assemblePath } = require('../data/onboarding-paths');
  const result = assemblePath({
    visaType: 'ttps-bc', familyStatus: 'couple',
    arrivalScenario: 'fresh', existingAssets: [],
  });
  assert(result.tasks.length > 0, 'Should still load tasks after wipe+re-init');
});

// ─── VD-6: 6种签证×5种家庭状态 真机矩阵 ───
console.log('\n--- VD-6: 签证×家庭状态 矩阵 ---');

const visas = ['qmas', 'ttps-a', 'ttps-bc', 'asmpt', 'iang', 'dependent'];
const families = ['single', 'couple', 'preschool', 'school-age', 'teen'];

visas.forEach(visa => {
  families.forEach(family => {
    test('VD-6: ' + visa + ' × ' + family, () => {
      const { assemblePath } = require('../data/onboarding-paths');
      const r = assemblePath({
        visaType: visa, familyStatus: family,
        arrivalScenario: 'fresh', existingAssets: [],
      });
      assert(r.tasks.length > 0, 'No tasks for ' + visa + '/' + family);
      assert(r.phases.length === 8, 'Wrong phase count');
      assert(r.summary.totalTasks >= r.summary.totalRequired, 'totalTasks < totalRequired');
    });
  });
});

// ─── VD-7: 会员解锁全关卡 ───
console.log('\n--- VD-7: 会员解锁 ---');

test('VD-7.1: memberUnlockAll=true → 全部任务可见', () => {
  const { assemblePath } = require('../data/onboarding-paths');
  const r = assemblePath({
    visaType: 'dependent', familyStatus: 'single',
    arrivalScenario: 'fresh', existingAssets: [],
    memberUnlockAll: true,
  });
  assert(r.tasks.length > 0);
  // 会员模式下，所有 phase 任务都应该不被签证/家庭状态过滤
  const nonMember = assemblePath({
    visaType: 'dependent', familyStatus: 'single',
    arrivalScenario: 'fresh', existingAssets: [],
  });
  assert(r.tasks.length >= nonMember.tasks.length, 'Member should see >= tasks');
});

// ============================================================
// 结果汇总
// ============================================================
console.log('\n' + '='.repeat(50));
console.log('虚拟真机验收结果: 攻略书P0修复');
console.log('='.repeat(50));
console.log('通过: ' + passed + ' | 失败: ' + failed);

if (failures.length > 0) {
  console.log('\n失败详情:');
  failures.forEach(f => console.log('  FAIL: ' + f.name + ' — ' + f.error));
}

console.log('\n验收结论: ' + (failed === 0 ? 'PASS — 可上传' : 'FAIL — 阻断发布'));

process.exit(failed > 0 ? 1 : 0);
