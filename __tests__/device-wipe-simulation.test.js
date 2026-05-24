/**
 * 真机模拟 — 测试账号"符生"
 * 模拟 e72591a wipe: 清空 __processes__ + __reminders__
 * 验证恢复引擎自动触发并完整恢复
 */

// ============================================================
// Mock WeChat 环境
// ============================================================
const mockStorage = {};
let mockCloudCalls = [];
let recoveryLog = [];

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
      mockCloudCalls.push({ name, data, time: Date.now() });
      if (name === 'db-admin' && data.action === 'pullAll') {
        return {
          result: {
            code: 200,
            data: {
              processes: [
                { id: 'proc_qmas', name: '高才通B类·名校学士通道', templateId: 'ttps_b', status: 'active',
                  stages: [{ stageId: 's1', stageName: '资格评估' }, { stageId: 's2', stageName: '材料准备' }],
                  pathType: 'ttps_b', createdAt: '2026-03-15' },
                { id: 'proc_renewal', name: '续签流程·IANG转永居', templateId: 'iang_renewal', status: 'active',
                  stages: [{ stageId: 's1', stageName: '确认资格' }, { stageId: 's2', stageName: '提交申请' }],
                  pathType: 'iang', createdAt: '2026-05-01' },
              ],
              reminders: [
                { id: 'r1', title: '提交高才通申请表', path: 'ttps_b', status: 'active', dueDate: '2026-04-01' },
                { id: 'r2', title: '更新港澳通行证', path: 'all', status: 'active', dueDate: '2026-06-15' },
                { id: 'r3', title: '体检预约', path: 'ttps_b', status: 'active', dueDate: '2026-04-15' },
                { id: 'r4', title: '缴付签证费', path: 'all', status: 'active', dueDate: '2026-05-01' },
                { id: 'r5', title: '准备面试材料', path: 'ttps_b', status: 'completed', dueDate: '2026-03-20' },
              ],
              documents: [
                { id: 'd1', name: '身份证', category: 'identities', type: 'id_card', docNumber: '4401xxxxxxxxxxxxxx' },
                { id: 'd2', name: '港澳通行证', category: 'identities', type: 'hk_pass', docNumber: 'Cxxxxxxxx' },
                { id: 'd3', name: '学位证书·清华大学', category: 'education', type: 'degree', docNumber: 'THU-2020-BS' },
                { id: 'd4', name: '在职证明', category: 'employment', type: 'employment_letter' },
                { id: 'd5', name: '银行流水', category: 'assets', type: 'bank_statement' },
              ],
            },
          },
        };
      }
      if (name === 'user-auth' && data.action === 'getProfile') {
        return {
          result: {
            code: 0,
            userInfo: {
              _id: 'u_fusheng', _openid: 'fusheng_wechat_id',
              currentPhase: 'submitted', subStatus: 'submitted_ttps',
              selectedPath: 'ttps_b', activeProcessId: 'proc_qmas',
              membershipLevel: 'basic', guidebookAllUnlocked: true,
              nickName: '符生', phoneBound: true,
            },
          },
        };
      }
      return { result: { code: 404 } };
    },
  },
  showToast(opts) { recoveryLog.push(`TOAST: ${opts.title}`); },
  showModal(opts) { recoveryLog.push(`MODAL: ${opts.title}`); },
  showLoading(opts) { recoveryLog.push(`LOADING: ${opts.title}`); },
  hideLoading() {},
  redirectTo(opts) { recoveryLog.push(`NAV: redirectTo ${opts.url}`); },
  reLaunch(opts) { recoveryLog.push(`NAV: reLaunch ${opts.url}`); },
  navigateTo(opts) {},
  getNetworkType(opts) { opts.success?.({ networkType: 'wifi' }); },
  onNetworkStatusChange() {},
  getFileSystemManager() { return { accessSync() {}, mkdirSync() {} }; },
  env: { USER_DATA_PATH: '/mock/user/data' },
};

global.getApp = () => ({
  globalData: {
    userInfo: { nickName: '符生' },
    userStatus: 'submitted',
    userSubStatus: 'submitted_ttps',
    isLoggedIn: true,
    token: 'token_fusheng_20260523',
    phoneBound: true,
    membershipLevel: 'basic',
    cloudReady: true,
    activeProcessId: 'proc_qmas',
    activeProcess: { name: '高才通B类·名校学士通道', pathType: 'ttps_b' },
    selectedPath: 'ttps_b',
    solutionRecommendation: null,
    isLocked: false,
    membershipExpiry: '2027-03-15',
    rulesLoaded: true,
    dbSyncStatus: 'idle',
    encryptionKey: null,
    dataVersion: 'v5',
    isOnline: true,
    networkType: 'wifi',
  },
});

// ============================================================
// 模拟场景
// ============================================================
async function simulateFushengWipe() {
  console.log('═══════════════════════════════════════════');
  console.log('  真机模拟 — 账号: 符生');
  console.log('  事件: e72591a wipe (存储版本升级)');
  console.log('═══════════════════════════════════════════\n');

  // Step 1: 预置正常数据
  console.log('📦 Step 1: 预置用户数据');
  mockStorage['__session__'] = {
    token: 'token_fusheng_20260523',
    userInfo: { nickName: '符生' },
    userStatus: 'submitted',
    userSubStatus: 'submitted_ttps',
    membershipLevel: 'basic',
    activeProcessId: 'proc_qmas',
    selectedPath: 'ttps_b',
  };
  mockStorage['__user_status__'] = 'submitted';
  mockStorage['__user_sub_status__'] = 'submitted_ttps';
  mockStorage['__active_process_id__'] = 'proc_qmas';
  mockStorage['__selected_path__'] = 'ttps_b';
  mockStorage['__onboarding__'] = { currentPhase: 3, tasks: {}, phases: {} };
  mockStorage['__process_stage__'] = 2;
  mockStorage['__cloud_user__'] = { isNew: false, _openid: 'fusheng_wechat_id' };

  // 正常流程数据
  mockStorage['__processes__'] = [
    { id: 'proc_qmas', name: '高才通B类·名校学士通道', templateId: 'ttps_b', status: 'active',
      stages: [{ stageId: 's1', stageName: '资格评估' }, { stageId: 's2', stageName: '材料准备' }] },
    { id: 'proc_renewal', name: '续签流程·IANG转永居', templateId: 'iang_renewal', status: 'active',
      stages: [{ stageId: 's1', stageName: '确认资格' }] },
  ];
  mockStorage['__reminders__'] = [
    { id: 'r1', title: '提交高才通申请表', status: 'active' },
    { id: 'r2', title: '更新港澳通行证', status: 'active' },
  ];
  console.log(`  流程: ${mockStorage['__processes__'].length}条`);
  console.log(`  提醒: ${mockStorage['__reminders__'].length}条`);
  console.log(`  状态: ${mockStorage['__user_status__']}`);
  console.log('');

  // Step 2: 模拟 e72591a wipe
  console.log('💥 Step 2: 模拟 e72591a wipe (存储版本升级)');
  console.log('  ensureStorageVersion: v < MIN_READABLE_VERSION');
  console.log('  → 备份 __processes__');
  mockStorage['__processes____corrupted__1748000000000'] = [
    ...mockStorage['__processes__'],
  ];
  console.log('  → 备份 __reminders__');
  mockStorage['__reminders____corrupted__1748000000000'] = [
    ...mockStorage['__reminders__'],
  ];
  console.log('  → wipe __processes__ = []');
  mockStorage['__processes__'] = [];
  console.log('  → wipe __reminders__ = []');
  mockStorage['__reminders__'] = [];
  console.log('');

  // Step 3: 验证 wipe 效果
  console.log('🔍 Step 3: 验证 wipe 效果');
  const { getAllProcessLines, getAllReminders } = require('../utils/storage');
  const processes = getAllProcessLines();
  const reminders = getAllReminders();
  console.log(`  __processes__: ${processes.length}条 (应为0)`);
  console.log(`  __reminders__: ${reminders.length}条 (应为0)`);
  console.log(`  备份键存在: ${!!mockStorage['__processes____corrupted__1748000000000'] ? '是' : '否'}`);
  console.log('');

  if (processes.length !== 0 || reminders.length !== 0) {
    console.log('❌ wipe 不完整，停止测试');
    return;
  }

  // Step 4: 运行恢复引擎
  console.log('🔄 Step 4: 运行恢复引擎');
  const { detectDataLoss, restoreFromLocalBackup, pullFromCloud, pullUserProfile } =
    require('../utils/recovery');
  const app = getApp();

  const detected = detectDataLoss(app);
  console.log(`  detectDataLoss: ${detected ? '✅ 触发' : '❌ 未触发'}`);
  console.log('');

  if (!detected) {
    console.log('❌ 恢复引擎未触发！检查 detectDataLoss 逻辑。');
    return;
  }

  console.log('  → restoreFromLocalBackup()');
  const local = restoreFromLocalBackup();
  console.log(`    本地备份: ${local.processes?.length || 0}条流程, ${local.reminders?.length || 0}条提醒`);

  console.log('  → pullFromCloud()');
  const cloud = await pullFromCloud();
  console.log(`    云端数据: ${cloud.recovered.processes}条流程, ${cloud.recovered.reminders}条提醒, ${cloud.recovered.documents}份证件`);

  console.log('  → pullUserProfile()');
  const profile = await pullUserProfile();
  console.log(`    用户状态: ${profile.data?.userStatus}, 路径: ${profile.data?.selectedPath}`);
  console.log('');

  // Step 5: 验证恢复结果
  console.log('✅ Step 5: 验证恢复结果');

  // 恢复数据写入 storage（模拟 recoverUserData 中的操作）
  if (local.processes) {
    const { saveProcessLines } = require('../utils/storage');
    saveProcessLines(local.processes);
  }
  if (local.reminders) {
    const { saveReminders } = require('../utils/storage');
    saveReminders(local.reminders);
  }
  if (profile.data) {
    mockStorage['__user_status__'] = profile.data.userStatus;
    mockStorage['__user_sub_status__'] = profile.data.userSubStatus;
    mockStorage['__selected_path__'] = profile.data.selectedPath;
    mockStorage['__active_process_id__'] = profile.data.activeProcessId;
  }

  const finalProcesses = getAllProcessLines();
  const finalReminders = getAllReminders();
  const finalStatus = mockStorage['__user_status__'];
  const recoveryMark = mockStorage['__recovery_applied__'];

  console.log(`  流程: ${finalProcesses.length}条 (预置2条 → wipe → 恢复后应为2)`);
  console.log(`  提醒: ${finalReminders.length}条 (预置2条 → wipe → 恢复后应为2)`);
  console.log(`  状态: ${finalStatus} (应为 'submitted')`);
  console.log(`  恢复标记: ${recoveryMark ? '已写入' : '未写入'}`);
  console.log('');

  // 判定
  const checks = [
    { name: '流程恢复', pass: finalProcesses.length === 2 },
    { name: '提醒恢复', pass: finalReminders.length === 2 },
    { name: '身份状态', pass: finalStatus === 'submitted' },
    { name: '恢复检测', pass: detected === true },
  ];

  console.log('═══════════════════════════════════════════');
  console.log('  验收结果');
  console.log('═══════════════════════════════════════════');
  let allPass = true;
  checks.forEach(c => {
    console.log(`  ${c.pass ? '✅' : '❌'} ${c.name}: ${c.pass ? '通过' : '失败'}`);
    if (!c.pass) allPass = false;
  });
  console.log('');
  console.log(`  最终判定: ${allPass ? '✅ P0-1 通过 — 数据完整恢复' : '❌ P0-1 失败 — 阻断发布'}`);
  console.log('═══════════════════════════════════════════\n');

  return allPass;
}

simulateFushengWipe().then(pass => {
  if (!pass) process.exit(1);
});
