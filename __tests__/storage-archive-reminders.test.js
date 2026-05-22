/**
 * 单元测试：storage.js — archiveRemindersByPath / unarchiveRemindersByPath
 * Bug #符生-确认选择优才计划无响应：修复前两函数缺失导致 onSelectDirectPath 崩溃
 */

const storage = require('../utils/storage');
const REMINDER_KEY = storage.REMINDER_KEY;

// Helpers — 注意：不能重新赋值 global.__mockStorage（jest-setup 的 getStorageSync 闭包
// 引用了原始对象），只能用清空 keys 的方式重置
function clearMockStorage() {
  Object.keys(global.__mockStorage).forEach(function (k) {
    delete global.__mockStorage[k];
  });
}

function seedReminders(entries) {
  global.__mockStorage[REMINDER_KEY] = entries.map(function (e) {
    return {
      id: e.id || 'r_' + Math.random().toString(36).slice(2, 8),
      path: e.path,
      status: e.status,
      title: e.title || '',
    };
  });
}

function getReminders() {
  return global.__mockStorage[REMINDER_KEY] || [];
}

describe('archiveRemindersByPath (P0修复)', function () {
  beforeEach(function () {
    clearMockStorage();
  });

  test('空 pathId → 不操作，不报错', function () {
    seedReminders([{ path: 'qmas', status: 'active' }]);
    expect(function () {
      storage.archiveRemindersByPath('');
    }).not.toThrow();
    expect(function () {
      storage.archiveRemindersByPath(null);
    }).not.toThrow();
    expect(function () {
      storage.archiveRemindersByPath(undefined);
    }).not.toThrow();
    // 数据不变
    expect(getReminders()[0].status).toBe('active');
  });

  test('封存一条匹配路径的活跃提醒', function () {
    seedReminders([{ path: 'qmas', status: 'active', title: '续签提醒' }]);
    storage.archiveRemindersByPath('qmas');
    const r = getReminders();
    expect(r[0].status).toBe('archived');
    expect(r[0].archivedAt).toBeDefined();
  });

  test('封存多条匹配路径的活跃提醒', function () {
    seedReminders([
      { path: 'qmas', status: 'active', title: 'R1' },
      { path: 'qmas', status: 'active', title: 'R2' },
      { path: 'ttps_a', status: 'active', title: 'R3' },
    ]);
    storage.archiveRemindersByPath('qmas');
    const r = getReminders();
    expect(r[0].status).toBe('archived');
    expect(r[1].status).toBe('archived');
    expect(r[2].status).toBe('active'); // 其他路径不变
  });

  test('已封存的提醒不被重复封存', function () {
    seedReminders([{ path: 'qmas', status: 'archived', title: '旧提醒' }]);
    storage.archiveRemindersByPath('qmas');
    expect(getReminders()[0].status).toBe('archived');
  });

  test('无匹配路径 → 不修改 Storage', function () {
    seedReminders([{ path: 'ttps_a', status: 'active' }]);
    storage.archiveRemindersByPath('qmas');
    expect(getReminders()[0].status).toBe('active');
  });

  test('空提醒列表 → 不报错', function () {
    seedReminders([]);
    expect(function () {
      storage.archiveRemindersByPath('qmas');
    }).not.toThrow();
    expect(getReminders().length).toBe(0);
  });
});

describe('unarchiveRemindersByPath (P0修复)', function () {
  beforeEach(function () {
    clearMockStorage();
  });

  test('空 pathId → 不操作，不报错', function () {
    seedReminders([{ path: 'qmas', status: 'archived' }]);
    expect(function () {
      storage.unarchiveRemindersByPath('');
    }).not.toThrow();
    expect(function () {
      storage.unarchiveRemindersByPath(null);
    }).not.toThrow();
    expect(function () {
      storage.unarchiveRemindersByPath(undefined);
    }).not.toThrow();
    expect(getReminders()[0].status).toBe('archived');
  });

  test('恢复一条被封存的提醒', function () {
    seedReminders([{ path: 'qmas', status: 'archived', title: '续签提醒' }]);
    storage.unarchiveRemindersByPath('qmas');
    const r = getReminders();
    expect(r[0].status).toBe('active');
    expect(r[0].unarchivedAt).toBeDefined();
  });

  test('恢复多条被封存的提醒', function () {
    seedReminders([
      { path: 'qmas', status: 'archived', title: 'R1' },
      { path: 'qmas', status: 'archived', title: 'R2' },
      { path: 'ttps_a', status: 'archived', title: 'R3' },
    ]);
    storage.unarchiveRemindersByPath('qmas');
    const r = getReminders();
    expect(r[0].status).toBe('active');
    expect(r[1].status).toBe('active');
    expect(r[2].status).toBe('archived'); // 其他路径不变
  });

  test('已是活跃状态的提醒不被影响', function () {
    seedReminders([{ path: 'qmas', status: 'active', title: '活跃提醒' }]);
    storage.unarchiveRemindersByPath('qmas');
    expect(getReminders()[0].status).toBe('active');
  });

  test('无匹配路径 → 不修改 Storage', function () {
    seedReminders([{ path: 'ttps_a', status: 'archived' }]);
    storage.unarchiveRemindersByPath('qmas');
    expect(getReminders()[0].status).toBe('archived');
  });

  test('空提醒列表 → 不报错', function () {
    seedReminders([]);
    expect(function () {
      storage.unarchiveRemindersByPath('qmas');
    }).not.toThrow();
  });

  test('只有变化时才写 Storage（性能优化验证）', function () {
    seedReminders([{ path: 'qmas', status: 'active' }]);
    const before = JSON.stringify(getReminders());
    storage.unarchiveRemindersByPath('qmas');
    const after = JSON.stringify(getReminders());
    // 无封存提醒待恢复 → 数据应不变
    expect(before).toBe(after);
  });
});

describe('archiveRemindersByPath + unarchiveRemindersByPath 往返', function () {
  beforeEach(function () {
    clearMockStorage();
  });

  test('封存 → 恢复 → 状态回到 active', function () {
    seedReminders([
      { path: 'qmas', status: 'active', title: 'A' },
      { path: 'qmas', status: 'active', title: 'B' },
    ]);
    storage.archiveRemindersByPath('qmas');
    expect(
      getReminders().every(function (r) {
        return r.status === 'archived';
      }),
    ).toBe(true);

    storage.unarchiveRemindersByPath('qmas');
    expect(
      getReminders().every(function (r) {
        return r.status === 'active';
      }),
    ).toBe(true);
    expect(
      getReminders().every(function (r) {
        return r.unarchivedAt;
      }),
    ).toBe(true);
  });

  test('跨路径操作互不干扰', function () {
    seedReminders([
      { path: 'qmas', status: 'active', title: 'QMAS-1' },
      { path: 'ttps_a', status: 'active', title: 'TTPS-1' },
      { path: 'qmas', status: 'active', title: 'QMAS-2' },
      { path: 'asmpt', status: 'active', title: 'ASMTP-1' },
    ]);

    // 封存 qmas + ttps_a
    storage.archiveRemindersByPath('qmas');
    storage.archiveRemindersByPath('ttps_a');

    const afterArchive = getReminders();
    expect(
      afterArchive.filter(function (r) {
        return r.status === 'archived';
      }).length,
    ).toBe(3);
    expect(
      afterArchive.find(function (r) {
        return r.path === 'asmpt';
      }).status,
    ).toBe('active');

    // 恢复 qmas
    storage.unarchiveRemindersByPath('qmas');
    const afterUnarchive = getReminders();
    expect(
      afterUnarchive.filter(function (r) {
        return r.path === 'qmas' && r.status === 'active';
      }).length,
    ).toBe(2);
    expect(
      afterUnarchive.find(function (r) {
        return r.path === 'ttps_a';
      }).status,
    ).toBe('archived');
    expect(
      afterUnarchive.find(function (r) {
        return r.path === 'asmpt';
      }).status,
    ).toBe('active');
  });
});
