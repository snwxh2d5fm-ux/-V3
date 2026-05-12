/**
 * 住港伴 v3 — 单元测试套件
 * 运行: npx jest __tests__/v3-unit.test.js --verbose
 */

// ============================================================
// Mock 微信小程序全局 API
// ============================================================
const mockStorage = {};

global.wx = {
  getStorageSync: jest.fn((key) => mockStorage[key] || null),
  setStorageSync: jest.fn((key, value) => { mockStorage[key] = value; }),
  removeStorageSync: jest.fn((key) => { delete mockStorage[key]; }),
  getStorageInfoSync: jest.fn(() => ({ currentSize: 128, keys: Object.keys(mockStorage) })),
  clearStorageSync: jest.fn(() => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }),
  showToast: jest.fn(),
  showModal: jest.fn((opts) => { if (opts.success) opts.success({ confirm: true }); }),
  showActionSheet: jest.fn((opts) => { if (opts.success) opts.success({ tapIndex: 0 }); }),
  navigateTo: jest.fn(),
  navigateBack: jest.fn(),
  redirectTo: jest.fn(),
  reLaunch: jest.fn(),
  switchTab: jest.fn(),
  setClipboardData: jest.fn((opts) => { if (opts.success) opts.success(); }),
  stopPullDownRefresh: jest.fn(),
};

global.getApp = jest.fn(() => ({
  globalData: { token: 'test_token', userData: null }
}));

global.__lastPageConfig = null;
global.Page = jest.fn((config) => { global.__lastPageConfig = config; });
global.App = jest.fn();

// 重置 mock 状态
function resetMocks() {
  Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
  jest.clearAllMocks();
}

// 模拟 require (处理相对路径)
const path = require('path');
const projectRoot = path.resolve(__dirname, '..');

function loadPage(relativePath) {
  const fullPath = path.join(projectRoot, relativePath);
  delete require.cache[require.resolve(fullPath)];
  global.__lastPageConfig = null;
  require(fullPath);
  return global.__lastPageConfig || {};
}

function createPageContext(pageModule, initialData = {}) {
  const ctx = { data: { ...initialData } };
  ctx.setData = function(obj) { Object.assign(this.data, obj); };
  if (pageModule.onLoad) pageModule.onLoad.call(ctx, {});
  return ctx;
}

// ============================================================
// 1. 证件夹详情页 — PII 脱敏逻辑
// ============================================================
describe('证件夹详情页 (PII脱敏)', () => {
  let ctx = null;
  const detailPath = 'pages/documents/detail/detail';

  const sampleDocs = [{
    id: 'doc_001', docType: '身份证', status: 'active', createdAt: '2026-05-09',
    ocrData: {
      name: '张三', idNumber: '110101199001011234', birthDate: '1990-01-01',
      issueDate: '2020-05-01', expiryDate: '2040-05-01', issuingAuthority: '北京市公安局'
    }
  }];

  const STORAGE_DOCS = '__documents__';
  const STORAGE_PRIVACY = '__privacy_mode__';

  beforeEach(() => {
    resetMocks();
    mockStorage[STORAGE_DOCS] = JSON.parse(JSON.stringify(sampleDocs));
    mockStorage[STORAGE_PRIVACY] = 'L1';
    const mod = loadPage(detailPath);
    ctx = createPageContext(mod, {});
    ctx.setData({ docId: 'doc_001' });
  });

  test('L1 绝对脱敏：姓名=***，证件号=全掩码', () => {
    const mod = loadPage(detailPath);
    mod.onLoad.call(ctx, { id: 'doc_001' });
    const nameF = ctx.data.ocrFields.find(f => f.key === 'name');
    const idF = ctx.data.ocrFields.find(f => f.key === 'idNumber');
    expect(nameF.value).toBe('***');
    expect(idF.value).toBe('**** **** **** ****');
  });

  test('L2 泛化脱敏：证件号保留首3尾2', () => {
    mockStorage[STORAGE_PRIVACY] = 'L2';
    const mod = loadPage(detailPath);
    mod.onLoad.call(ctx, { id: 'doc_001' });
    const idF = ctx.data.ocrFields.find(f => f.key === 'idNumber');
    expect(idF.value).toBe('110****34');
  });

  test('L3 可保留：完整显示证件号', () => {
    mockStorage[STORAGE_PRIVACY] = 'L3';
    const mod = loadPage(detailPath);
    mod.onLoad.call(ctx, { id: 'doc_001' });
    const idF = ctx.data.ocrFields.find(f => f.key === 'idNumber');
    expect(idF.value).toBe('110101199001011234');
  });

  test('切换脱敏级别：L1→L2→L3→L1 循环', () => {
    const mod = loadPage(detailPath);
    mod.onLoad.call(ctx, { id: 'doc_001' });
    expect(ctx.data.currentPIILevel).toBe('L1');
    mod.togglePIILevel.call(ctx); expect(ctx.data.currentPIILevel).toBe('L2');
    mod.togglePIILevel.call(ctx); expect(ctx.data.currentPIILevel).toBe('L3');
    mod.togglePIILevel.call(ctx); expect(ctx.data.currentPIILevel).toBe('L1');
  });

  test('归档证件：status→archived + archivedAt', () => {
    const mod = loadPage(detailPath);
    mod.onLoad.call(ctx, { id: 'doc_001' });
    mod.archiveDocument.call(ctx);
    expect(mockStorage[STORAGE_DOCS][0].status).toBe('archived');
    expect(mockStorage[STORAGE_DOCS][0].archivedAt).toBeDefined();
  });

  test('恢复证件：status→active', () => {
    mockStorage[STORAGE_DOCS][0].status = 'archived';
    const mod = loadPage(detailPath);
    mod.onLoad.call(ctx, { id: 'doc_001' });
    mod.restoreDocument.call(ctx);
    expect(mockStorage[STORAGE_DOCS][0].status).toBe('active');
  });

  test('隐私面板：L1安全评分=100', () => {
    ctx.data.currentPIILevel = 'L1';
    ctx.data.ocrFields = [
      { key: 'name', isPII: true, value: '***' },
      { key: 'idNumber', isPII: true, value: '****' },
      { key: 'issueDate', isPII: false, value: '2020-05-01' },
    ];
    const mod = loadPage(detailPath);
    const stats = mod.getPIIStats.call(ctx);
    expect(stats.securityScore).toBe(100);
    expect(stats.piiCount).toBe(2);
    expect(stats.totalCount).toBe(3);
  });
});

// ============================================================
// 2. 证件夹组合页 — 路径匹配
// ============================================================
describe('证件夹组合页 (路径匹配)', () => {
  let ctx = null;
  const combinePath = 'pages/documents/combine/combine';

  beforeEach(() => {
    resetMocks();
    mockStorage['__user_profile__'] = { selectedPath: 'qmas' };
    mockStorage['__documents__'] = [
      { id: 'd1', docType: 'id_card', category: '身份证明', name: '身份证' },
      { id: 'd2', docType: 'degree_cert', category: '学历证明', name: '学位证' }
    ];
    const mod = loadPage(combinePath);
    ctx = createPageContext(mod, {});
  });

  test('QMAS路径生成清单≥10项', () => {
    const mod = loadPage(combinePath);
    mod.onLoad.call(ctx);
    expect(ctx.data.checklist.length).toBeGreaterThanOrEqual(10);
    expect(ctx.data.pathName).toContain('优才');
  });

  test('已有证件匹配为has', () => {
    const mod = loadPage(combinePath);
    mod.onLoad.call(ctx);
    expect(ctx.data.checklist.find(c => c.id === 'id_card').status).toBe('has');
    expect(ctx.data.checklist.find(c => c.id === 'degree_cert').status).toBe('has');
  });

  test('缺失必需项为missing', () => {
    const mod = loadPage(combinePath);
    mod.onLoad.call(ctx);
    expect(ctx.data.checklist.find(c => c.id === 'plan_statement').status).toBe('missing');
  });

  test('导出清单调用剪贴板', () => {
    const mod = loadPage(combinePath);
    mod.onLoad.call(ctx);
    mod.exportChecklist.call(ctx);
    expect(global.wx.setClipboardData).toHaveBeenCalled();
  });
});

// ============================================================
// 3. 提醒器详情 — 状态操作
// ============================================================
describe('提醒器详情页 (状态操作)', () => {
  let ctx = null;
  const reminderDetailPath = 'pages/reminders/detail/detail';

  beforeEach(() => {
    resetMocks();
    mockStorage['__reminders__'] = [{
      id: 'rem_001', title: '续签材料准备', deadline: '2026-07-01',
      type: '续签', status: 'active', confidence: 'A',
      description: '准备续签所需材料', relatedDocIds: ['d1'], parentIds: ['rem_000']
    }];
    mockStorage['__documents__'] = [{ id: 'd1', docType: '证件', name: '测试证件' }];
    const mod = loadPage(reminderDetailPath);
    ctx = createPageContext(mod, {});
  });

  test('加载提醒显示标题', () => {
    const mod = loadPage(reminderDetailPath);
    mod.onLoad.call(ctx, { id: 'rem_001' });
    expect(ctx.data.reminder.title).toBe('续签材料准备');
  });

  test('标记完成', () => {
    const mod = loadPage(reminderDetailPath);
    mod.onLoad.call(ctx, { id: 'rem_001' });
    mod.markComplete.call(ctx);
    expect(mockStorage['__reminders__'][0].status).toBe('completed');
  });

  test('延期弹出ActionSheet', () => {
    const mod = loadPage(reminderDetailPath);
    mod.onLoad.call(ctx, { id: 'rem_001' });
    mod.snoozeReminder.call(ctx);
    expect(global.wx.showActionSheet).toHaveBeenCalled();
    expect(mockStorage['__reminders__'][0].status).toBe('snoozed');
  });

  test('忽略提醒', () => {
    const mod = loadPage(reminderDetailPath);
    mod.onLoad.call(ctx, { id: 'rem_001' });
    mod.ignoreReminder.call(ctx);
    expect(mockStorage['__reminders__'][0].status).toBe('ignored');
  });
});

// ============================================================
// 4. 分类攻略主页 — 分类+搜索+评分
// ============================================================
describe('分类攻略主页 (分类+评分)', () => {
  let ctx = null;
  const playbookPath = 'pages/playbook/index/index';

  beforeEach(() => {
    resetMocks();
    const mod = loadPage(playbookPath);
    ctx = createPageContext(mod, {});
  });

  test('初始化加载≥8条内置攻略', () => {
    const mod = loadPage(playbookPath);
    mod.onLoad.call(ctx);
    expect(ctx.data.guides.length).toBeGreaterThanOrEqual(8);
  });

  test('切换QMAS分类全为QMAS域', () => {
    const mod = loadPage(playbookPath);
    mod.onLoad.call(ctx);
    mod.switchCategory.call(ctx, { currentTarget: { dataset: { key: 'QMAS' } } });
    ctx.data.guides.forEach(g => expect(g.knowledge_domain).toBe('QMAS'));
  });

  test('有用评分+1', () => {
    const mod = loadPage(playbookPath);
    mod.onLoad.call(ctx);
    const gid = ctx.data.guides[0].id;
    const before = ctx.data.guides[0].usefulCount;
    mod.onUsefulTap.call(ctx, { currentTarget: { dataset: { id: gid } } });
    expect(ctx.data.guides[0].usefulCount).toBe(before + 1);
    expect(ctx.data.guides[0].userVoted).toBe(true);
  });

  test('搜索过滤匹配', () => {
    const mod = loadPage(playbookPath);
    mod.onLoad.call(ctx);
    ctx.setData({ searchKeyword: '高才' });
    mod.onSearch.call(ctx);
    expect(ctx.data.guides.length).toBeGreaterThan(0);
    ctx.data.guides.forEach(g => expect(g.title + g.topics.join('')).toMatch(/高才/));
  });
});

// ============================================================
// 5. 设置页 — 开关+注销
// ============================================================
describe('设置页 (通知+注销)', () => {
  let ctx = null;
  const settingsPath = 'pages/mine/settings/settings';

  beforeEach(() => {
    resetMocks();
    const mod = loadPage(settingsPath);
    ctx = createPageContext(mod, {});
  });

  test('默认通知：提醒+政策开，更新关', () => {
    const mod = loadPage(settingsPath);
    mod.onLoad.call(ctx);
    expect(ctx.data.notifyReminder).toBe(true);
    expect(ctx.data.notifyPolicy).toBe(true);
    expect(ctx.data.notifyUpdate).toBe(false);
  });

  test('关闭提醒通知并持久化', () => {
    const mod = loadPage(settingsPath);
    mod.toggleReminder.call(ctx, { detail: { value: false } });
    expect(ctx.data.notifyReminder).toBe(false);
    const s = JSON.parse(JSON.stringify(mockStorage['__app_settings__']));
    expect(s.notifyReminder).toBe(false);
  });

  test('退出登录：清user_data→跳login', () => {
    mockStorage['user_data'] = { phone: '13800138000' };
    const mod = loadPage(settingsPath);
    mod.logout.call(ctx);
    expect(mockStorage['user_data']).toBeUndefined();
    expect(global.wx.reLaunch).toHaveBeenCalledWith({ url: '/pages/login/login' });
  });
});

// ============================================================
// 6. 隐私中心 — 评分+标签
// ============================================================
describe('隐私中心 (评分+标签)', () => {
  beforeEach(() => {
    resetMocks();
    mockStorage['__privacy_mode__'] = 'L1';
  });

  test('L1安全评分95', () => {
    const mod = loadPage('pages/privacy/index/index');
    const ctx = createPageContext(mod, {});
    mod.onLoad.call(ctx);
    expect(ctx.data.privacyScore).toBe(95);
  });

  test('加载8个PII标签', () => {
    const mod = loadPage('pages/privacy/index/index');
    const ctx = createPageContext(mod, {});
    mod.onLoad.call(ctx);
    expect(ctx.data.piiLabels.length).toBe(8);
  });

  test('切换标签授权状态', () => {
    const mod = loadPage('pages/privacy/index/index');
    const ctx = createPageContext(mod, {});
    mod.onLoad.call(ctx);
    mod.toggleLabel.call(ctx, { currentTarget: { dataset: { key: 'phone' } } });
    expect(ctx.data.piiLabels.find(l => l.key === 'phone').enabled).toBe(true);
  });

  test('导出隐私报告复制到剪贴板', () => {
    const mod = loadPage('pages/privacy/index/index');
    const ctx = createPageContext(mod, {});
    mod.onLoad.call(ctx);
    mod.exportPrivacyReport.call(ctx);
    expect(global.wx.setClipboardData).toHaveBeenCalled();
  });
});
