/**
 * 单元测试：storage.js V4.1 — 存储版本管理 + Schema 校验降级 + 启动完整性
 * P0 修复：坏数据不阻塞正常流程
 */
const storage = require('../utils/storage');

function clearMockStorage() {
  Object.keys(global.__mockStorage).forEach(function (k) {
    delete global.__mockStorage[k];
  });
}

function seedProcesses(lines) {
  global.__mockStorage[storage.PROCESS_KEY] = lines;
}

function getProcesses() {
  return global.__mockStorage[storage.PROCESS_KEY] || [];
}

// ============================================================
// validateProcessLine
// ============================================================
describe('validateProcessLine — Schema 校验', function () {
  const validLine = {
    id: 'p1',
    name: '优才计划',
    templateId: 'qmas',
    status: 'active',
    stages: [{ stageId: 's1', stageName: '评估', order: 1, status: 'in_progress' }],
  };

  test('完整流程线 → valid', function () {
    expect(storage.validateProcessLine(validLine)).toEqual({ valid: true });
  });

  test('null → not_object', function () {
    expect(storage.validateProcessLine(null)).toEqual({ valid: false, reason: 'not_object' });
  });

  test('undefined → not_object', function () {
    expect(storage.validateProcessLine(undefined)).toEqual({ valid: false, reason: 'not_object' });
  });

  test('string → not_object', function () {
    expect(storage.validateProcessLine('hello')).toEqual({ valid: false, reason: 'not_object' });
  });

  test('缺少 id → missing_id', function () {
    const bad = Object.assign({}, validLine);
    delete bad.id;
    expect(storage.validateProcessLine(bad)).toEqual({ valid: false, reason: 'missing_id' });
  });

  test('缺少 name → missing_name', function () {
    const bad = Object.assign({}, validLine);
    delete bad.name;
    expect(storage.validateProcessLine(bad)).toEqual({ valid: false, reason: 'missing_name' });
  });

  test('缺少 templateId → missing_templateId', function () {
    const bad = Object.assign({}, validLine);
    delete bad.templateId;
    expect(storage.validateProcessLine(bad)).toEqual({ valid: false, reason: 'missing_templateId' });
  });

  test('缺少 status → missing_status', function () {
    const bad = Object.assign({}, validLine);
    delete bad.status;
    expect(storage.validateProcessLine(bad)).toEqual({ valid: false, reason: 'missing_status' });
  });

  test('缺少 stages → missing_stages', function () {
    const bad = Object.assign({}, validLine);
    delete bad.stages;
    expect(storage.validateProcessLine(bad)).toEqual({ valid: false, reason: 'missing_stages' });
  });

  test('stages 非数组 → stages_not_array', function () {
    const bad = Object.assign({}, validLine, { stages: 'not_array' });
    expect(storage.validateProcessLine(bad)).toEqual({ valid: false, reason: 'stages_not_array' });
  });

  test('stages 为空数组 → stages_empty', function () {
    const bad = Object.assign({}, validLine, { stages: [] });
    expect(storage.validateProcessLine(bad)).toEqual({ valid: false, reason: 'stages_empty' });
  });

  test('id 为 null → missing_id', function () {
    const bad = Object.assign({}, validLine, { id: null });
    expect(storage.validateProcessLine(bad)).toEqual({ valid: false, reason: 'missing_id' });
  });
});

// ============================================================
// validateAndRepairProcesses
// ============================================================
describe('validateAndRepairProcesses — 坏数据降级', function () {
  beforeEach(function () {
    clearMockStorage();
  });

  test('空存储 → 无修复', function () {
    const result = storage.validateAndRepairProcesses();
    expect(result.repaired).toBe(false);
    expect(result.corrupted).toBe(0);
    expect(result.kept).toBe(0);
  });

  test('全部有效流程线 → 不修改', function () {
    seedProcesses([
      {
        id: 'p1',
        name: '优才',
        templateId: 'qmas',
        status: 'active',
        stages: [{ stageId: 's1', stageName: '评估', order: 1, status: 'in_progress' }],
      },
      {
        id: 'p2',
        name: '高才A',
        templateId: 'ttps_a',
        status: 'inactive',
        stages: [{ stageId: 's1', stageName: '评估', order: 1, status: 'completed' }],
      },
    ]);
    const result = storage.validateAndRepairProcesses();
    expect(result.repaired).toBe(false);
    expect(result.kept).toBe(2);
    expect(getProcesses().length).toBe(2);
  });

  test('混合有效和损坏 → 保留有效、备份损坏', function () {
    seedProcesses([
      {
        id: 'p1',
        name: '优才',
        templateId: 'qmas',
        status: 'active',
        stages: [{ stageId: 's1', stageName: '评估', order: 1 }],
      },
      { id: 'bad1' }, // 缺少 name/templateId/status/stages
      {
        id: 'p2',
        name: '高才A',
        templateId: 'ttps_a',
        status: 'inactive',
        stages: [{ stageId: 's1', stageName: '评估', order: 1 }],
      },
    ]);
    const result = storage.validateAndRepairProcesses();
    expect(result.repaired).toBe(true);
    expect(result.corrupted).toBe(1);
    expect(result.kept).toBe(2);
    expect(getProcesses().length).toBe(2);
  });

  test('全部损坏 → 清空 + 全部备份', function () {
    seedProcesses([{ id: 'bad1' }, { name: 'missing_id' }]);
    const result = storage.validateAndRepairProcesses();
    expect(result.repaired).toBe(true);
    expect(result.corrupted).toBe(2);
    expect(result.kept).toBe(0);
    expect(getProcesses().length).toBe(0);
  });

  test('PROCESS_KEY 存的是字符串 → 备份+清空', function () {
    global.__mockStorage[storage.PROCESS_KEY] = 'not_an_array';
    const result = storage.validateAndRepairProcesses();
    expect(result.repaired).toBe(true);
    expect(result.corrupted).toBe(-1);
    expect(result.kept).toBe(0);
    // 原始值已备份
    const backupKeys = Object.keys(global.__mockStorage).filter(function (k) {
      return k.indexOf('__processes____corrupted__') === 0;
    });
    expect(backupKeys.length).toBe(1);
  });

  test('PROCESS_KEY 存的是数字 → 备份+清空', function () {
    global.__mockStorage[storage.PROCESS_KEY] = 42;
    const result = storage.validateAndRepairProcesses();
    expect(result.repaired).toBe(true);
    expect(result.corrupted).toBe(-1);
    expect(storage.getAllProcessLines().length).toBe(0);
  });
});

// ============================================================
// STORAGE_VERSION 管理
// ============================================================
describe('ensureStorageVersion — 版本迁移', function () {
  beforeEach(function () {
    clearMockStorage();
  });

  test('首次启动（无版本号） → 写入当前版本', function () {
    storage.ensureStorageVersion();
    expect(storage.getStorageVersion()).toBe(storage.STORAGE_VERSION);
  });

  test('版本一致 → 无操作', function () {
    storage.setStorageVersion(storage.STORAGE_VERSION);
    storage.ensureStorageVersion();
    expect(storage.getStorageVersion()).toBe(storage.STORAGE_VERSION);
  });

  test('旧版本在可读范围内 → 升级到当前版本', function () {
    storage.setStorageVersion(1);
    seedProcesses([
      {
        id: 'p1',
        name: 'old',
        templateId: 'qmas',
        status: 'active',
        stages: [{ stageId: 's1', stageName: 's', order: 1 }],
      },
    ]);
    storage.ensureStorageVersion();
    expect(storage.getStorageVersion()).toBe(storage.STORAGE_VERSION);
    // 旧数据保留
    expect(getProcesses().length).toBe(1);
  });

  test('未来版本（高于当前）→ 标记 _future_data，不删除', function () {
    storage.setStorageVersion(99);
    seedProcesses([
      {
        id: 'p1',
        name: 'future',
        templateId: 'qmas',
        status: 'active',
        stages: [{ stageId: 's1', stageName: 's', order: 1 }],
      },
    ]);
    storage.ensureStorageVersion();
    // 数据保留
    expect(getProcesses().length).toBe(1);
    // 健康状态标记
    const health = global.__mockStorage[storage.HEALTH_KEY];
    expect(health._future_data).toBe(true);
    expect(health._future_version).toBe(99);
  });
});

// ============================================================
// runStorageStartupCheck — 启动完整性入口
// ============================================================
describe('runStorageStartupCheck — 启动完整性', function () {
  beforeEach(function () {
    clearMockStorage();
  });

  test('正常启动 → 返回完整状态', function () {
    seedProcesses([
      {
        id: 'p1',
        name: '优才',
        templateId: 'qmas',
        status: 'active',
        stages: [{ stageId: 's1', stageName: 's', order: 1 }],
      },
    ]);
    const result = storage.runStorageStartupCheck();
    expect(result.version).toBe(storage.STORAGE_VERSION);
    expect(result.processes.repaired).toBe(false);
    expect(result.processes.kept).toBe(1);
  });

  test('损坏数据启动 → 修复并返回状态', function () {
    seedProcesses([
      { id: 'bad1' }, // 损坏
      {
        id: 'p1',
        name: '优才',
        templateId: 'qmas',
        status: 'active',
        stages: [{ stageId: 's1', stageName: 's', order: 1 }],
      },
    ]);
    const result = storage.runStorageStartupCheck();
    expect(result.processes.repaired).toBe(true);
    expect(result.processes.corrupted).toBe(1);
    expect(result.processes.kept).toBe(1);
  });

  test('无数据启动 → 正常', function () {
    const result = storage.runStorageStartupCheck();
    expect(result.processes.repaired).toBe(false);
    expect(result.processes.kept).toBe(0);
  });
});
