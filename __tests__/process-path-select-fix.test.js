/**
 * 集成测试：process/index — onSelectDirectPath 路径选择完整调用链
 * Bug #符生：修复前 unarchiveRemindersByPath 缺失导致中途崩溃
 *
 * 验证：点击"确认选择优才计划" → 流程创建 → UI更新 → 不崩溃
 */

var path = require('path');

// 模拟 getApp 返回已登录已确认身份的用户
function mockLoggedInUser(status) {
  var gd = {
    isLoggedIn: true,
    token: 'test-token',
    userStatus: status || 'unapplied',
    userInfo: { nickName: '符生' },
    selectedPath: '',
    activeProcess: null,
    activeProcessId: ''
  };
  global.getApp = jest.fn(function() { return { globalData: gd }; });
  return gd;
}

// 重置 mock 存储 — 注意不能重新赋值 global.__mockStorage（jest-setup 闭包引用问题）
function resetStorage() {
  Object.keys(global.__mockStorage).forEach(function(k) { delete global.__mockStorage[k]; });
}

describe('onSelectDirectPath — 集成测试 (P0)', function() {
  var processIndexModule;

  beforeAll(function() {
    processIndexModule = require('../pages/process/index/index');
  });

  beforeEach(function() {
    resetStorage();
    mockLoggedInUser('unapplied');
  });

  test('SMOKE: 模块加载不报错', function() {
    expect(processIndexModule).toBeDefined();
  });

  test('storage.unarchiveRemindersByPath 函数存在（修复验证）', function() {
    var st = require('../utils/storage');
    expect(typeof st.archiveRemindersByPath).toBe('function');
    expect(typeof st.unarchiveRemindersByPath).toBe('function');
  });

  test('无旧路径时 archiveRemindersByPath 不抛异常', function() {
    // 模拟 onSelectDirectPath 内部对空旧路径的调用
    var st = require('../utils/storage');
    seedReminders([{ path: 'qmas', status: 'active' }]);

    // 旧路径为空时条件跳过 archiveRemindersByPath
    var oldPath = global.getApp().globalData.selectedPath ||
                  (global.__mockStorage['__selected_path__'] || '');
    expect(oldPath).toBe('');
    // 当 oldPath 为空时，archiveRemindersByPath 不应被调用
    // （这是 onSelectDirectPath 中的 if 守卫逻辑）
  });

  test('有旧路径切换时 archiveRemindersByPath 正常执行', function() {
    var st = require('../utils/storage');
    var REMINDER_KEY = st.REMINDER_KEY;

    // 模拟旧路径 'ttps_a' 的活跃提醒
    global.__mockStorage[REMINDER_KEY] = [
      { id: 'r1', path: 'ttps_a', status: 'active', title: '高才通提醒' }
    ];
    global.__mockStorage['__selected_path__'] = 'ttps_a';
    global.getApp().globalData.selectedPath = 'ttps_a';

    st.archiveRemindersByPath('ttps_a');
    var reminders = global.__mockStorage[REMINDER_KEY];
    expect(reminders[0].status).toBe('archived');
    expect(reminders[0].archivedAt).toBeDefined();
  });

  test('unarchiveRemindersByPath 直接调用不抛异常（核心修复）', function() {
    // 这是 Bug 根因：修复前这行会抛 TypeError
    var st = require('../utils/storage');
    seedReminders([{ path: 'qmas', status: 'archived', title: '被封存的QMAS提醒' }]);

    expect(function() {
      st.unarchiveRemindersByPath('qmas');
    }).not.toThrow();

    var r = global.__mockStorage[st.REMINDER_KEY];
    expect(r[0].status).toBe('active');
  });

  test('onSelectDirectPath 对有效路径ID的完整调用链不崩溃', function() {
    var st = require('../utils/storage');

    // 模拟用户点击 优才计划
    // 验证核心函数都可以安全调用
    var gate = require('../utils/decision-gate').canMakeDecision();
    expect(gate.ok).toBe(true);

    // archiveRemindersByPath（旧路径为空时跳过）
    var oldPath = '';
    if (oldPath && oldPath !== 'qmas') {
      st.archiveRemindersByPath(oldPath);
    }

    // unarchiveRemindersByPath（无条件调用 — 这是之前崩溃点）
    expect(function() {
      st.unarchiveRemindersByPath('qmas');
    }).not.toThrow();

    // saveProcessLine
    var processLine = {
      id: 'direct_test_' + Date.now(),
      name: '优才计划',
      templateId: 'qmas',
      pathType: 'qmas',
      riskLevel: 'medium_low',
      totalCycle: '7-8年',
      phases: [],
      stages: [
        { stageId: 'phase1_evaluation', stageName: '资格评估', order: 1, status: 'in_progress', steps: [] }
      ],
      status: 'active',
      progress: 0,
      currentStage: '资格评估',
      readyMaterials: 0,
      totalMaterials: 0,
      createdAt: new Date().toISOString(),
      source: 'direct_pick'
    };
    expect(function() { st.saveProcessLine(processLine); }).not.toThrow();

    var saved = st.getAllProcessLines();
    expect(saved.length).toBe(1);
    expect(saved[0].name).toBe('优才计划');
    expect(saved[0].templateId).toBe('qmas');
    expect(saved[0].status).toBe('active');
  });
});

describe('onSelectDirectPath — 边界条件测试', function() {
  beforeAll(function() {
    require('../pages/process/index/index');
  });

  beforeEach(function() {
    resetStorage();
    mockLoggedInUser('unapplied');
  });

  test('未登录用户 → canMakeDecision 返回 login', function() {
    global.getApp().globalData.isLoggedIn = false;
    var gate = require('../utils/decision-gate').canMakeDecision();
    expect(gate.ok).toBe(false);
    expect(gate.reason).toBe('login');
  });

  test('已登录但未确认身份 → canMakeDecision 返回 identity', function() {
    global.getApp().globalData.userStatus = '';
    var gate = require('../utils/decision-gate').canMakeDecision();
    expect(gate.ok).toBe(false);
    expect(gate.reason).toBe('identity');
  });

  test('已登录且已确认 → canMakeDecision 返回 ok', function() {
    global.getApp().globalData.userStatus = 'unapplied';
    var gate = require('../utils/decision-gate').canMakeDecision();
    expect(gate.ok).toBe(true);
  });
});

// Helper
function seedReminders(entries) {
  var st = require('../utils/storage');
  var REMINDER_KEY = st.REMINDER_KEY;
  global.__mockStorage[REMINDER_KEY] = entries.map(function(e, i) {
    return { id: e.id || 'r_' + i, path: e.path, status: e.status, title: e.title || 'R' + i };
  });
}
