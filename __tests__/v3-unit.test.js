/**
 * 住港伴 v3 — 单元测试套件
 * 运行: npx jest __tests__/v3-unit.test.js --verbose
 *
 * 共享 mock 由 __tests__/jest-setup.js 提供
 * 测试通过 global.__mockStorage 操作模拟存储
 */

// ============================================================
// 工具函数
// ============================================================
function resetMocks() {
  var ms = global.__mockStorage;
  Object.keys(ms).forEach(function(k) { delete ms[k]; });
  // 清除 wx.* mock 调用记录（保留实现）
  Object.values(global.wx).forEach(function(v) {
    if (v && v.mockClear) { try { v.mockClear(); } catch(e) {} }
  });
  if (global.wx.cloud) {
    Object.values(global.wx.cloud).forEach(function(v) {
      if (v && v.mockClear) { try { v.mockClear(); } catch(e) {} }
    });
  }
}

const path = require('path');
const projectRoot = path.resolve(__dirname, '..');

function loadPage(relativePath) {
  // jest.resetModules() 清空模块缓存，确保每次 require 重新执行页面 Page() 注册
  jest.resetModules();
  const fullPath = path.join(projectRoot, relativePath);
  global.__lastPageConfig = null;
  require(fullPath);
  return global.__lastPageConfig || {};
}

function createPageContext(pageModule, initialData) {
  initialData = initialData || {};
  var ctx = { data: {} };
  // 先合并页面默认 data (如 page:1, guides:[] 等)，再叠加 initialData
  if (pageModule.data) {
    Object.keys(pageModule.data).forEach(function(k) { ctx.data[k] = pageModule.data[k]; });
  }
  Object.keys(initialData).forEach(function(k) { ctx.data[k] = initialData[k]; });
  // 复制页面所有方法到 ctx，确保 onLoad 中 this.xxx() 可用
  Object.keys(pageModule).forEach(function(key) {
    if (typeof pageModule[key] === 'function') {
      ctx[key] = pageModule[key];
    }
  });
  ctx.setData = function(obj) { Object.assign(this.data, obj); };
  return ctx;
}

// 辅助：构建 vault meta 结构
function makeVaultMeta(docsObj) {
  return { documents: docsObj, version: 1 };
}

// ============================================================
// 1. 证件夹详情页 — PII 脱敏逻辑
// ============================================================
describe('证件夹详情页 (PII脱敏)', function() {
  var detailPath = 'pages/documents/detail/detail';

  var sampleDoc = {
    id: 'doc_001', docType: '身份证', status: 'active', createdAt: '2026-05-09',
    ocrData: {
      name: '张三', idNumber: '110101199001011234', birthDate: '1990-01-01',
      issueDate: '2020-05-01', expiryDate: '2040-05-01', issuingAuthority: '北京市公安局'
    }
  };

  function setupVault(docOverride) {
    var doc = docOverride || sampleDoc;
    global.__mockStorage.__vault_meta__ = makeVaultMeta((function() {
      var m = {}; m[doc.id] = JSON.parse(JSON.stringify(doc)); return m;
    })());
    global.__mockStorage.__privacy_mode__ = 'L1';
  }

  test('L1 绝对脱敏：姓名=***，证件号=全掩码', function() {
    resetMocks();
    setupVault();
    var mod = loadPage(detailPath);
    mod.onLoad.call(createPageContext(mod), { id: 'doc_001' });
    var ctx = createPageContext(mod, { docId: 'doc_001' });
    mod.onLoad.call(ctx, { id: 'doc_001' });
    var nameF = ctx.data.ocrFields.find(function(f) { return f.key === 'name'; });
    var idF = ctx.data.ocrFields.find(function(f) { return f.key === 'idNumber'; });
    expect(nameF.value).toBe('***');
    expect(idF.value).toBe('**** **** **** ****');
  });

  test('L2 泛化脱敏：证件号保留首3尾2', function() {
    resetMocks();
    setupVault();
    global.__mockStorage.__privacy_mode__ = 'L2';
    var mod = loadPage(detailPath);
    var ctx = createPageContext(mod, { docId: 'doc_001' });
    mod.onLoad.call(ctx, { id: 'doc_001' });
    var idF = ctx.data.ocrFields.find(function(f) { return f.key === 'idNumber'; });
    expect(idF.value).toBe('110****34');
  });

  test('L3 可保留：完整显示证件号', function() {
    resetMocks();
    setupVault();
    global.__mockStorage.__privacy_mode__ = 'L3';
    var mod = loadPage(detailPath);
    var ctx = createPageContext(mod, { docId: 'doc_001' });
    mod.onLoad.call(ctx, { id: 'doc_001' });
    var idF = ctx.data.ocrFields.find(function(f) { return f.key === 'idNumber'; });
    expect(idF.value).toBe('110101199001011234');
  });

  test('切换脱敏级别：L1→L2→L3→L1 循环', function() {
    resetMocks();
    setupVault();
    var mod = loadPage(detailPath);
    var ctx = createPageContext(mod, { docId: 'doc_001' });
    mod.onLoad.call(ctx, { id: 'doc_001' });
    expect(ctx.data.currentPIILevel).toBe('L1');
    mod.togglePIILevel.call(ctx); expect(ctx.data.currentPIILevel).toBe('L2');
    mod.togglePIILevel.call(ctx); expect(ctx.data.currentPIILevel).toBe('L3');
    mod.togglePIILevel.call(ctx); expect(ctx.data.currentPIILevel).toBe('L1');
  });

  test('归档证件：status→archived + archivedAt', function() {
    resetMocks();
    setupVault();
    var mod = loadPage(detailPath);
    var ctx = createPageContext(mod, { docId: 'doc_001' });
    mod.onLoad.call(ctx, { id: 'doc_001' });
    mod.archiveDocument.call(ctx);
    var doc = global.__mockStorage.__vault_meta__.documents.doc_001;
    expect(doc.status).toBe('archived');
    expect(doc.archivedAt).toBeDefined();
  });

  test('恢复证件：status→active', function() {
    resetMocks();
    setupVault({ id: 'doc_001', docType: '身份证', status: 'archived', createdAt: '2026-05-09', ocrData: { name: '张三', idNumber: '110101199001011234' } });
    var mod = loadPage(detailPath);
    var ctx = createPageContext(mod, { docId: 'doc_001' });
    mod.onLoad.call(ctx, { id: 'doc_001' });
    mod.restoreDocument.call(ctx);
    var doc = global.__mockStorage.__vault_meta__.documents.doc_001;
    expect(doc.status).toBe('active');
  });

  test('隐私面板：L1安全评分=100', function() {
    resetMocks();
    var mod = loadPage(detailPath);
    var ctx = createPageContext(mod, {});
    ctx.data.currentPIILevel = 'L1';
    ctx.data.ocrFields = [
      { key: 'name', isPII: true, value: '***' },
      { key: 'idNumber', isPII: true, value: '****' },
      { key: 'issueDate', isPII: false, value: '2020-05-01' }
    ];
    var stats = mod.getPIIStats.call(ctx);
    expect(stats.securityScore).toBe(100);
    expect(stats.piiCount).toBe(2);
    expect(stats.totalCount).toBe(3);
  });
});

// ============================================================
// 2. 证件夹组合页 — 路径匹配
// ============================================================
describe('证件夹组合页 (路径匹配)', function() {
  var combinePath = 'pages/documents/combine/combine';

  function setupCombine() {
    resetMocks();
    global.__mockStorage.__user_profile__ = { selectedPath: 'qmas' };
    global.__mockStorage.__identity_profile__ = {};
    global.__mockStorage.__user_sub_status__ = '';
    global.__mockStorage.__session__ = {};
    global.__mockStorage.__vault_meta__ = makeVaultMeta({
      'd1': { id: 'd1', docType: 'id_card', category: '身份证明', name: '身份证' },
      'd2': { id: 'd2', docType: 'degree_cert', category: '学历证明', name: '学位证' }
    });
  }

  test('QMAS路径生成清单≥10项', function() {
    setupCombine();
    var mod = loadPage(combinePath);
    var ctx = createPageContext(mod, {});
    mod.onLoad.call(ctx);
    expect(ctx.data.checklist.length).toBeGreaterThanOrEqual(10);
    expect(ctx.data.pathName).toContain('优才');
  });

  test('已有证件匹配为has', function() {
    setupCombine();
    var mod = loadPage(combinePath);
    var ctx = createPageContext(mod, {});
    mod.onLoad.call(ctx);
    expect(ctx.data.checklist.find(function(c) { return c.id === 'id_card'; }).status).toBe('has');
    expect(ctx.data.checklist.find(function(c) { return c.id === 'degree_cert'; }).status).toBe('has');
  });

  test('缺失必需项为missing', function() {
    setupCombine();
    var mod = loadPage(combinePath);
    var ctx = createPageContext(mod, {});
    mod.onLoad.call(ctx);
    expect(ctx.data.checklist.find(function(c) { return c.id === 'plan_statement'; }).status).toBe('missing');
  });

  test('导出清单调用剪贴板', function() {
    setupCombine();
    var mod = loadPage(combinePath);
    var ctx = createPageContext(mod, {});
    mod.onLoad.call(ctx);
    // generateExportText 填充 exportText，copyExport 调用剪贴板
    mod.generateExportText.call(ctx);
    mod.copyExport.call(ctx);
    expect(global.wx.setClipboardData).toHaveBeenCalled();
  });
});

// ============================================================
// 3. 提醒器详情 — 状态操作
// ============================================================
describe('提醒器详情页 (状态操作)', function() {
  var reminderDetailPath = 'pages/reminders/detail/detail';

  var sampleReminder = {
    id: 'rem_001', title: '续签材料准备', deadline: '2026-07-01',
    type: '续签', status: 'active', confidence: 'A',
    description: '准备续签所需材料', relatedDocIds: ['d1'], parentIds: ['rem_000']
  };

  function setupReminder(overrides) {
    resetMocks();
    var reminder = overrides || sampleReminder;
    global.__mockStorage.__reminders__ = { items: [JSON.parse(JSON.stringify(reminder))], version: 1 };
    global.__mockStorage.__vault_meta__ = makeVaultMeta({
      'd1': { id: 'd1', docType: '证件', name: '测试证件' }
    });
    global.__mockStorage.__session__ = {};
  }

  test('加载提醒显示标题', function() {
    setupReminder();
    var mod = loadPage(reminderDetailPath);
    var ctx = createPageContext(mod, {});
    mod.onLoad.call(ctx, { id: 'rem_001' });
    expect(ctx.data.reminder.title).toBe('续签材料准备');
  });

  test('标记完成', function() {
    setupReminder();
    var mod = loadPage(reminderDetailPath);
    var ctx = createPageContext(mod, {});
    mod.onLoad.call(ctx, { id: 'rem_001' });
    mod.markComplete.call(ctx);
    var items = global.__mockStorage.__reminders__.items;
    expect(items[0].status).toBe('completed');
  });

  test('延期：openDeferModal设置延期面板', function() {
    setupReminder();
    var mod = loadPage(reminderDetailPath);
    var ctx = createPageContext(mod, {});
    mod.onLoad.call(ctx, { id: 'rem_001' });
    mod.openDeferModal.call(ctx);
    expect(ctx.data.showDeferModal).toBe(true);
    expect(ctx.data.deferDays).toBe(7);
    // confirmDefer 执行实际延期
    mod.confirmDefer.call(ctx);
    var items = global.__mockStorage.__reminders__.items;
    expect(items[0].status).toBe('deferred');
  });

  test('忽略提醒', function() {
    setupReminder();
    var mod = loadPage(reminderDetailPath);
    var ctx = createPageContext(mod, {});
    mod.onLoad.call(ctx, { id: 'rem_001' });
    mod.ignoreReminder.call(ctx);
    var items = global.__mockStorage.__reminders__.items;
    expect(items[0].status).toBe('ignored');
  });
});

// ============================================================
// 4. 分类攻略主页 — 分类+搜索+评分
// ============================================================
describe('分类攻略主页 (分类+评分)', function() {
  var playbookPath = 'pages/playbook/index/index';

  function setupPlaybook() {
    resetMocks();
  }

  test('初始化加载≥8条内置攻略', function() {
    setupPlaybook();
    var mod = loadPage(playbookPath);
    var ctx = createPageContext(mod, {});
    mod.onLoad.call(ctx);
    expect(ctx.data.guides.length).toBeGreaterThanOrEqual(8);
  });

  test('切换QMAS分类全为QMAS域', function() {
    setupPlaybook();
    var mod = loadPage(playbookPath);
    var ctx = createPageContext(mod, {});
    mod.onLoad.call(ctx);
    mod.switchCategory.call(ctx, { currentTarget: { dataset: { key: 'QMAS' } } });
    ctx.data.guides.forEach(function(g) { expect(g.knowledge_domain).toBe('QMAS'); });
  });

  test('有用评分+1', function() {
    setupPlaybook();
    var mod = loadPage(playbookPath);
    var ctx = createPageContext(mod, {});
    mod.onLoad.call(ctx);
    var gid = ctx.data.guides[0].id;
    var before = ctx.data.guides[0].usefulCount;
    mod.onUsefulTap.call(ctx, { currentTarget: { dataset: { id: gid } } });
    expect(ctx.data.guides[0].usefulCount).toBe(before + 1);
    expect(ctx.data.guides[0].userVoted).toBe(true);
  });

  test('搜索过滤匹配', function() {
    setupPlaybook();
    var mod = loadPage(playbookPath);
    var ctx = createPageContext(mod, {});
    mod.onLoad.call(ctx);
    ctx.setData({ searchKeyword: '高才' });
    mod.onSearch.call(ctx);
    expect(ctx.data.guides.length).toBeGreaterThan(0);
    ctx.data.guides.forEach(function(g) {
      expect(g.title + g.topics.join('')).toMatch(/高才/);
    });
  });
});

// ============================================================
// 5. 设置页 — 开关+注销
// ============================================================
describe('设置页 (通知+注销)', function() {
  var settingsPath = 'pages/mine/settings/settings';

  function setupSettings() {
    resetMocks();
    global.__mockStorage.__privacy_mode__ = 'L1';
  }

  test('默认通知：提醒+政策开，更新关', function() {
    setupSettings();
    var mod = loadPage(settingsPath);
    var ctx = createPageContext(mod, {});
    mod.onLoad.call(ctx);
    expect(ctx.data.notifyReminder).toBe(true);
    expect(ctx.data.notifyPolicy).toBe(true);
    expect(ctx.data.notifyUpdate).toBe(false);
  });

  test('关闭提醒通知并持久化', function() {
    setupSettings();
    var mod = loadPage(settingsPath);
    var ctx = createPageContext(mod, {});
    mod.toggleReminder.call(ctx, { detail: { value: false } });
    expect(ctx.data.notifyReminder).toBe(false);
    var s = JSON.parse(JSON.stringify(global.__mockStorage.__app_settings__));
    expect(s.notifyReminder).toBe(false);
  });

  test('退出登录：清user_data→跳login', function() {
    setupSettings();
    global.__mockStorage.user_data = { phone: '13800138000' };
    var mod = loadPage(settingsPath);
    var ctx = createPageContext(mod, {});
    mod.logout.call(ctx);
    expect(global.__mockStorage.user_data).toBeUndefined();
    expect(global.wx.reLaunch).toHaveBeenCalledWith({ url: '/pages/login/login' });
  });
});

// ============================================================
// 6. 隐私中心 — 评分+标签
// ============================================================
describe('隐私中心 (评分+标签)', function() {
  var privacyPath = 'pages/privacy/index/index';

  function setupPrivacy() {
    resetMocks();
    global.__mockStorage.__privacy_mode__ = 'L1';
  }

  test('L1安全评分95', function() {
    setupPrivacy();
    var mod = loadPage(privacyPath);
    var ctx = createPageContext(mod, {});
    mod.onLoad.call(ctx);
    expect(ctx.data.privacyScore).toBe(95);
  });

  test('加载8个PII标签', function() {
    setupPrivacy();
    var mod = loadPage(privacyPath);
    var ctx = createPageContext(mod, {});
    mod.onLoad.call(ctx);
    expect(ctx.data.piiLabels.length).toBe(8);
  });

  test('切换标签授权状态', function() {
    setupPrivacy();
    var mod = loadPage(privacyPath);
    var ctx = createPageContext(mod, {});
    mod.onLoad.call(ctx);
    mod.toggleLabel.call(ctx, { currentTarget: { dataset: { key: 'phone' } } });
    expect(ctx.data.piiLabels.find(function(l) { return l.key === 'phone'; }).enabled).toBe(true);
  });

  test('导出隐私报告复制到剪贴板', function() {
    setupPrivacy();
    var mod = loadPage(privacyPath);
    var ctx = createPageContext(mod, {});
    mod.onLoad.call(ctx);
    mod.exportPrivacyReport.call(ctx);
    expect(global.wx.setClipboardData).toHaveBeenCalled();
  });
});
