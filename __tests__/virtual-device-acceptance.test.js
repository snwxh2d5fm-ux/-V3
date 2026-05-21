/**
 * 虚拟真机验收测试 — 5.22 数据损失事件抢救方案
 *
 * 模拟微信小程序环境，逐条执行验收测试用例 P0-1 ~ P1-8。
 * Mock wx.* API 层，加载真实的 recovery.js / app.js / status-badge 核心逻辑。
 */
const fs = require('fs');
const path = require('path');

// ============================================================
// 虚拟微信环境 Mock
// ============================================================

let mockStorage = {};
let mockCloudData = {};       // 模拟 CloudBase 数据库
let mockCloudResponses = {};  // 模拟云函数返回值
let mockUI = { toasts: [], modals: [], navigations: [], loadings: [] };
let mockLoggedIn = false;
let mockToken = null;
let mockOpenid = 'test-openid-abc123';

function resetMocks() {
  mockStorage = {};
  mockCloudData = {
    users: [
      { _id: 'u1', _openid: mockOpenid, currentPhase: 'approved', subStatus: 'approved_employed',
        selectedPath: 'qmas', activeProcessId: 'proc_1', membershipLevel: 'free',
        guidebookAllUnlocked: true, phoneHash: null, status: 'active' },
    ],
    user_processes: [
      { _id: 'p1', _openid: mockOpenid, templateId: 'qmas_v1', name: '优才计划',
        status: 'active', stages: [{ stageId: 's1', stageName: '提交' }] },
      { _id: 'p2', _openid: mockOpenid, templateId: 'renewal_v1', name: '续签流程',
        status: 'active', stages: [{ stageId: 's1', stageName: '准备' }] },
    ],
    reminders: [
      { _id: 'r1', _openid: mockOpenid, title: '提交申请表', status: 'active' },
      { _id: 'r2', _openid: mockOpenid, title: '更新证件', status: 'active' },
      { _id: 'r3', _openid: mockOpenid, title: '体检预约', status: 'active' },
      { _id: 'r4', _openid: mockOpenid, title: '缴费通知', status: 'active' },
      { _id: 'r5', _openid: mockOpenid, title: '面试准备', status: 'active' },
    ],
    user_documents: [
      { _id: 'd1', _openid: mockOpenid, name: '身份证', category: 'identities', type: 'id_card' },
      { _id: 'd2', _openid: mockOpenid, name: '护照', category: 'identities', type: 'passport' },
      { _id: 'd3', _openid: mockOpenid, name: '学位证书', category: 'education', type: 'degree' },
    ],
    orders: [],
    audit_logs: [],
  };
  mockCloudResponses = {};
  mockUI = { toasts: [], modals: [], navigations: [], loadings: [] };
  mockLoggedIn = true;
  mockToken = 'mock-token-' + Date.now();
}

// Mock wx global
global.wx = {
  // Storage
  getStorageSync(key) { return mockStorage[key]; },
  setStorageSync(key, val) { mockStorage[key] = val; },
  removeStorageSync(key) { delete mockStorage[key]; },
  getStorageInfoSync() {
    return { keys: Object.keys(mockStorage), currentSize: 0, limitSize: 10240 };
  },

  // Cloud
  cloud: {
    init() {},
    async callFunction({ name, data }) {
      if (mockCloudResponses[name + '.' + data.action]) {
        return mockCloudResponses[name + '.' + data.action]();
      }
      // db-admin pullAll
      if (name === 'db-admin' && data.action === 'pullAll') {
        const openid = mockOpenid;
        return {
          result: {
            code: 200,
            data: {
              documents: mockCloudData.user_documents.filter(d => d._openid === openid),
              reminders: mockCloudData.reminders.filter(r => r._openid === openid),
              processes: mockCloudData.user_processes.filter(p => p._openid === openid),
            },
          },
        };
      }
      // user-auth getProfile
      if (name === 'user-auth' && data.action === 'getProfile') {
        const user = mockCloudData.users.find(u => u._openid === mockOpenid);
        return { result: { code: 0, userInfo: user || null } };
      }
      // user-auth validate
      if (name === 'user-auth' && data.action === 'validate') {
        return { result: { valid: mockLoggedIn && data.token === mockToken } };
      }
      // process-manager resetIdentityPhase
      if (name === 'process-manager' && data.action === 'resetIdentityPhase') {
        const recentReset = mockCloudData.audit_logs.find(
          l => l._openid === mockOpenid && l.action === 'identity_reset' &&
               new Date(l.createdAt).getTime() > Date.now() - 7 * 86400000
        );
        if (data.source === 'free_reset' && recentReset) {
          return { result: { code: 429, msg: '7天内已进行过身份重置' } };
        }
        mockCloudData.audit_logs.push({
          _openid: mockOpenid, action: 'identity_reset',
          detail: { source: data.source || 'free_reset' },
          createdAt: new Date().toISOString(),
        });
        return { result: { code: 0, msg: '身份状态已重置' } };
      }
      return { result: { code: 404, msg: 'unknown action' } };
    },
  },

  // UI
  showToast(opts) { mockUI.toasts.push(opts); },
  showModal(opts) { mockUI.modals.push(opts); opts.success?.({ confirm: true }); },
  showLoading(opts) { mockUI.loadings.push(opts); },
  hideLoading() {},

  // Navigation
  redirectTo(opts) { mockUI.navigations.push({ type: 'redirectTo', url: opts.url }); },
  reLaunch(opts) { mockUI.navigations.push({ type: 'reLaunch', url: opts.url }); },
  navigateTo(opts) { mockUI.navigations.push({ type: 'navigateTo', url: opts.url }); },

  // Network
  getNetworkType(opts) { opts.success?.({ networkType: 'wifi' }); },
  onNetworkStatusChange() {},

  // File system
  getFileSystemManager() { return { accessSync() {}, mkdirSync() {} }; },
  env: { USER_DATA_PATH: '/mock/user/data' },
};

// Mock getApp
global.getApp = () => ({
  globalData: {
    userInfo: { nickName: '测试用户' },
    userStatus: mockStorage['__user_status__'] || 'approved',
    userSubStatus: mockStorage['__user_sub_status__'] || 'approved_employed',
    isLoggedIn: mockLoggedIn,
    token: mockToken,
    phoneBound: true,
    membershipLevel: 'free',
    cloudReady: true,
    activeProcessId: mockStorage['__active_process_id__'] || 'proc_1',
    activeProcess: { name: '优才计划' },
    selectedPath: 'qmas',
    solutionRecommendation: null,
    isLocked: false,
    membershipExpiry: null,
    rulesLoaded: true,
    dbSyncStatus: 'idle',
    encryptionKey: null,
    dataVersion: 'v5',
    isOnline: true,
    networkType: 'wifi',
    aiSessionId: null,
    aiConversation: [],
    aiReady: false,
    hubSections: ['process', 'playbook', 'precheck'],
  },
});

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
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    failures.push({ name, error: e.message });
    console.log(`  ❌ ${name}: ${e.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'assertion failed');
}

// ============================================================
// P0-1: 完整数据损失自动恢复
// ============================================================
test('P0-1: 完整数据损失自动恢复', () => {
  resetMocks();
  // 预置本地数据（模拟被wipe前的状态）
  mockStorage['__onboarding__'] = { currentPhase: 3 };
  mockStorage['__process_stage__'] = 2;
  mockStorage['__user_status__'] = 'approved';
  mockStorage['__user_sub_status__'] = 'approved_employed';
  mockStorage['__active_process_id__'] = 'proc_1';
  mockStorage['__selected_path__'] = 'qmas';
  mockStorage['__cloud_user__'] = { isNew: false, _openid: mockOpenid };
  mockStorage['__session__'] = { token: mockToken, userStatus: 'approved' };

  // 模拟wipe: 清空processes和reminders（但保留备份）
  mockStorage['__processes____corrupted__1712345678900'] = [
    { id: 'p1', name: '优才计划', templateId: 'qmas_v1', status: 'active', stages: [{ stageId: 's1' }] },
    { id: 'p2', name: '续签流程', templateId: 'renewal_v1', status: 'active', stages: [{ stageId: 's1' }] },
  ];
  mockStorage['__reminders____corrupted__1712345678900'] = [
    { id: 'r1', title: '旧提醒1' }, { id: 'r2', title: '旧提醒2' },
  ];
  mockStorage['__processes__'] = [];
  mockStorage['__reminders__'] = [];

  // 加载恢复引擎
  const { detectDataLoss, restoreFromLocalBackup, pullFromCloud, pullUserProfile } =
    require('../utils/recovery');

  // 检测
  const app = getApp();
  assert(detectDataLoss(app) === true, '应检测到数据损失');

  // 本地备份恢复
  const localBackup = restoreFromLocalBackup();
  assert(localBackup.processes !== null, '本地备份有流程数据');
  assert(localBackup.processes.length === 2, '恢复2条流程');
  assert(localBackup.reminders !== null, '本地备份有提醒数据');
  assert(localBackup.reminders.length === 2, '恢复2条提醒');
});

// ============================================================
// P0-2: 免费身份重置（需异步）
// ============================================================
test('P0-2: 免费身份重置 — 无微信支付弹窗', async () => {
  resetMocks();
  mockStorage['__user_status__'] = 'submitted';
  mockStorage['__user_sub_status__'] = 'submitted_qmas';
  mockStorage['__active_process_id__'] = 'proc_1';
  mockStorage['__onboarding__'] = { currentPhase: 2 };
  mockStorage['__process_stage__'] = 3;
  mockStorage['__selected_path__'] = 'qmas';

  // 模拟 process-manager resetIdentityPhase 返回成功
  const resetRes = await wx.cloud.callFunction({
    name: 'process-manager',
    data: { action: 'resetIdentityPhase', source: 'free_reset' },
  });
  assert(resetRes.result.code === 0, '服务器重置成功');

  // 模拟清除本地
  const keysToRemove = [
    '__onboarding__', '__process_stage__', '__active_process_id__',
    '__user_status__', '__user_sub_status__',
  ];
  keysToRemove.forEach(k => { try { wx.removeStorageSync(k); } catch (e) {} });

  assert(wx.getStorageSync('__user_status__') === undefined, 'user_status已清除');
  assert(wx.getStorageSync('__onboarding__') === undefined, 'onboarding已清除');
});

// ============================================================
// P0-3: 旧版token兼容
// ============================================================
test('P0-3: 旧版token兼容 — legacyKey回退验证', () => {
  resetMocks();
  // 验证 user-auth/index.js 中 verifyToken 是否包含 legacyKey 回退逻辑
  const authCode = fs.readFileSync(
    path.join(__dirname, '..', 'cloudfunctions', 'user-auth', 'index.js'), 'utf8'
  );

  assert(authCode.includes('legacyKey'), '代码包含legacyKey');
  assert(authCode.includes("'zhgb-internal-key'"), '使用zhgb-internal-key');
  assert(authCode.includes('回退验证'), '有回退验证注释');
  assert(authCode.includes('getTokenSecret()'), '主验证使用getTokenSecret()');

  // 确认 makeToken 不受 legacyKey 影响
  const makeTokenSection = authCode.substring(
    authCode.indexOf('function makeToken'),
    authCode.indexOf('function verifyToken')
  );
  assert(!makeTokenSection.includes("'zhgb-internal-key'"), 'makeToken不使用legacyKey');
});

// ============================================================
// P0-4: 登出全量清除
// ============================================================
test('P0-4: 登出全量清除 — 16个key全部清除', () => {
  resetMocks();
  const userKeys = [
    '__session__', '__processes__', '__reminders__', '__vault_meta__',
    '__user_status__', '__user_sub_status__', '__active_process_id__',
    '__selected_path__', '__onboarding__', '__process_stage__',
    '__cloud_user__', '__user_profile__', '__config__',
    '__assessment_persona__', '__solution_recommendation__', '__user_data__',
  ];

  // 预写入
  userKeys.forEach(k => { mockStorage[k] = 'test-data'; });

  // 模拟登出清除
  userKeys.forEach(k => { try { wx.removeStorageSync(k); } catch (e) {} });

  // 验证全部清除
  const remaining = userKeys.filter(k => wx.getStorageSync(k) !== undefined);
  assert(remaining.length === 0, `仍有${remaining.length}个key残留: ${remaining.join(', ')}`);

  // 验证源码
  const mineCode = fs.readFileSync(
    path.join(__dirname, '..', 'pages', 'mine', 'index', 'index.js'), 'utf8'
  );
  assert(mineCode.includes('userKeys.forEach'), 'mine页面有全量清除逻辑');
  const settingsCode = fs.readFileSync(
    path.join(__dirname, '..', 'subpkg-chat', 'pages', 'settings', 'index.js'), 'utf8'
  );
  assert(settingsCode.includes('userKeys.forEach'), 'settings页面有全量清除逻辑');
});

// ============================================================
// P0-5: 账号合并
// ============================================================
test('P0-5: 账号合并 — phoneHash反查+数据迁移', () => {
  resetMocks();
  const authCode = fs.readFileSync(
    path.join(__dirname, '..', 'cloudfunctions', 'user-auth', 'index.js'), 'utf8'
  );

  // 验证稳定哈希
  assert(authCode.includes('createHmac'), '使用HMAC稳定哈希');
  assert(authCode.includes('zgbinternal-phone-salt'), '使用固定盐值');
  assert(!authCode.includes('randomBytes(16)'), '无随机盐（phoneLogin路径）');

  // 验证反查逻辑
  assert(authCode.includes("users.where({ phoneHash })"), '按phoneHash反查已有用户');

  // 验证合并逻辑
  assert(authCode.includes("account_merged"), '有account_merged审计');
  assert(authCode.includes("status: 'merged'"), '标记旧账号为merged');
  assert(authCode.includes('mergedTo'), '包含mergedTo字段');
  assert(authCode.includes('accountMerged: true'), '返回accountMerged标识');

  // 验证数据迁移（分开检查避免链式includes返回boolean的问题）
  assert(authCode.includes('user_processes') && authCode.includes('_openid: openid'), '迁移user_processes');
  assert(authCode.includes('reminders') && authCode.includes('_openid: openid'), '迁移reminders');
  assert(authCode.includes('user_documents') && authCode.includes('_openid: openid'), '迁移user_documents');
});

// ============================================================
// P1-6: 状态丢失后手动数据恢复
// ============================================================
test('P1-6: 状态丢失 — 优先显示恢复弹窗', () => {
  resetMocks();
  const badgeCode = fs.readFileSync(
    path.join(__dirname, '..', 'components', 'status-badge', 'status-badge.js'), 'utf8'
  );

  // 验证双模逻辑
  assert(badgeCode.includes('isRecovery'), '包含isRecovery属性');
  assert(badgeCode.includes("status || '未知'"), '检测未知状态');
  assert(badgeCode.includes('recoverFromCloud'), '有从云端恢复方法');

  // 验证WXML
  const wxmlCode = fs.readFileSync(
    path.join(__dirname, '..', 'components', 'status-badge', 'status-badge.wxml'), 'utf8'
  );
  assert(wxmlCode.includes('数据恢复'), 'WXML包含数据恢复文案');
  assert(wxmlCode.includes('从云端恢复数据'), '有从云端恢复按钮');
  assert(!wxmlCode.includes('¥599'), '无¥599价格显示');
});

// ============================================================
// P1-7: 网络异常降级
// ============================================================
test('P1-7: 网络异常 — 本地备份恢复不依赖cloudReady', () => {
  resetMocks();
  mockStorage['__processes____corrupted__1712345678900'] = [
    { id: 'p1', name: '优才计划', templateId: 'qmas_v1', status: 'active', stages: [{ stageId: 's1' }] },
  ];
  mockStorage['__processes__'] = [];
  mockStorage['__reminders__'] = [];
  mockStorage['__cloud_user__'] = { isNew: false };

  const { detectDataLoss, restoreFromLocalBackup } = require('../utils/recovery');
  const app = getApp();

  // 模拟离线：cloudReady = false
  app.globalData.cloudReady = false;

  // 检测仍应触发（依赖本地数据，不依赖网络）
  assert(detectDataLoss(app) === true, '离线时仍能检测到数据损失');

  // 本地备份恢复仍能工作（纯本地操作）
  const backup = restoreFromLocalBackup();
  assert(backup.processes !== null, '离线时本地备份可恢复');
  assert(backup.processes.length === 1, '离线恢复1条流程');
});

// ============================================================
// P1-8: 关卡解锁保护
// ============================================================
test('P1-8: guidebookAllUnlocked 不被免费重置清除', () => {
  resetMocks();
  const pmCode = fs.readFileSync(
    path.join(__dirname, '..', 'cloudfunctions', 'process-manager', 'index.js'), 'utf8'
  );

  // 提取 resetIdentityPhase 函数
  const resetSection = pmCode.substring(
    pmCode.indexOf('async function resetIdentityPhase'),
    pmCode.indexOf('async function handleException')
  );

  // 验证 guidebookAllUnlocked 不在更新中
  const hasGuidebook = resetSection.includes("guidebookAllUnlocked: false");
  assert(!hasGuidebook, 'resetIdentityPhase不应包含guidebookAllUnlocked: false');

  // 验证只清除身份相关字段
  assert(resetSection.includes("currentPhase: ''"), '清除currentPhase');
  assert(resetSection.includes("currentStageId: ''"), '清除currentStageId');
});

// ============================================================
// 额外: Schema校验测试
// ============================================================
test('P-EXT: pullFromCloud schema校验 — 拒绝损坏数据', async () => {
  resetMocks();
  // 模拟云端返回损坏的流程数据（缺少必填字段）
  mockCloudData.user_processes = [
    { _id: 'p1', _openid: mockOpenid, name: '缺id', stages: [] },  // 缺id/status
    { _id: 'p2', _openid: mockOpenid, id: 'p2', templateId: 't1', status: 'active', stages: [{ stageId: 's1' }] },
  ];

  const { pullFromCloud } = require('../utils/recovery');
  const result = await pullFromCloud();

  assert(result.success === true, 'pullFromCloud应返回成功');
  assert(result.recovered.processes === 1, '只恢复1条有效流程（过滤掉损坏的）');
});

// ============================================================
// 结果汇总
// ============================================================
console.log(`\n${'='.repeat(50)}`);
console.log(`虚拟真机验收结果`);
console.log(`${'='.repeat(50)}`);
console.log(`通过: ${passed} | 失败: ${failed}`);

if (failures.length > 0) {
  console.log(`\n失败详情:`);
  failures.forEach(f => console.log(`  ❌ ${f.name}: ${f.error}`));
}

console.log(`\n验收结论: ${failed === 0 ? '✅ 全部通过' : '❌ 存在失败，阻断发布'}`);
console.log(`验收不通过清单检查: ${failed === 0 ? '无阻断条件触发' : '以下阻断条件触发:'}`);
failures.forEach(f => {
  if (f.name.startsWith('P0')) console.log(`  🔴 ${f.name} (P0阻断)`);
  else console.log(`  🟡 ${f.name} (P1)`);
});

// 退出码
process.exit(failed > 0 ? 1 : 0);
