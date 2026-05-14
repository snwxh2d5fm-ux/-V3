/**
 * 住港伴 V3 — Jest 全局 setup (v2)
 * Mock 微信小程序 wx.* / wx.cloud.* / 全局 API
 *
 * 被 package.json jest.setupFiles 引用，在所有测试文件之前执行
 */

// ============================================================
// 共享 mockStorage — 测试文件可直接操作 global.__mockStorage
// ============================================================
const mockStorage = {};
global.__mockStorage = mockStorage;

// ============================================================
// wx 基础 API
// ============================================================
global.wx = {
  // -- 存储 --
  getStorageSync: jest.fn((key) => {
    if (key === '__mockStorage__') return mockStorage;
    return mockStorage[key] !== undefined ? mockStorage[key] : null;
  }),
  setStorageSync: jest.fn((key, value) => { mockStorage[key] = value; }),
  removeStorageSync: jest.fn((key) => { delete mockStorage[key]; }),
  clearStorageSync: jest.fn(() => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }),
  getStorageInfoSync: jest.fn(() => ({
    currentSize: 128,
    limitSize: 10240,
    keys: Object.keys(mockStorage)
  })),

  // -- 交互 --
  showToast: jest.fn(),
  showModal: jest.fn((opts) => {
    const resolved = typeof opts === 'object' ? opts : {};
    if (resolved.success) resolved.success({ confirm: true, cancel: false });
  }),
  showActionSheet: jest.fn((opts) => {
    if (opts && opts.success) opts.success({ tapIndex: 0 });
  }),
  showLoading: jest.fn(),
  hideLoading: jest.fn(),

  // -- 导航 --
  navigateTo: jest.fn(),
  navigateBack: jest.fn(),
  redirectTo: jest.fn(),
  reLaunch: jest.fn(),
  switchTab: jest.fn(),

  // -- 媒体 --
  previewImage: jest.fn((opts) => { if (opts && opts.success) opts.success(); }),
  chooseImage: jest.fn((opts) => {
    if (opts && opts.success) opts.success({ tempFilePaths: ['/tmp/mock_photo.jpg'] });
  }),
  compressImage: jest.fn((opts) => {
    if (opts && opts.success) opts.success({ tempFilePath: '/tmp/mock_compressed.jpg' });
  }),

  // -- 文档 --
  openDocument: jest.fn((opts) => { if (opts && opts.success) opts.success(); }),
  setClipboardData: jest.fn((opts) => { if (opts && opts.success) opts.success(); }),

  // -- 下拉刷新 --
  stopPullDownRefresh: jest.fn(),

  // -- 网络 --
  request: jest.fn((opts) => {
    if (opts && opts.success) opts.success({ statusCode: 200, data: {} });
  }),
  uploadFile: jest.fn((opts) => {
    if (opts && opts.success) opts.success({ statusCode: 200, data: {} });
  }),
  downloadFile: jest.fn((opts) => {
    if (opts && opts.success) opts.success({ tempFilePath: '/tmp/mock_download.pdf' });
  }),

  // -- 系统 --
  getSystemInfoSync: jest.fn(() => ({
    model: 'iPhone 14',
    system: 'iOS 18.0',
    platform: 'ios',
    SDKVersion: '3.15.2',
    pixelRatio: 3,
    screenWidth: 390,
    screenHeight: 844,
    windowWidth: 390,
    windowHeight: 844,
    statusBarHeight: 54
  })),
  getNetworkType: jest.fn((opts) => {
    if (opts && opts.success) opts.success({ networkType: 'wifi' });
  }),

  // -- 环境 --
  env: {
    USER_DATA_PATH: '/tmp/wx_user_data'
  },

  // -- 文件系统 --
  getFileSystemManager: jest.fn(() => ({
    accessSync: jest.fn(() => { throw new Error('not exist'); }),
    mkdirSync: jest.fn(),
    readFileSync: jest.fn(() => ''),
    writeFileSync: jest.fn(),
    unlinkSync: jest.fn(),
    readdirSync: jest.fn(() => []),
    statSync: jest.fn(() => ({ size: 0 }))
  })),

  // -- 云开发 (wx.cloud.*) --
  cloud: {
    init: jest.fn(),
    callFunction: jest.fn((opts) => {
      const call = opts && opts.name;
      if (call === 'ai-chat') return Promise.resolve({ result: { data: { content: 'mock reply' } } });
      if (call === 'rag-search') return Promise.resolve({ result: { data: { results: [] } } });
      return Promise.resolve({ result: { data: null } });
    }),
    database: jest.fn(() => ({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn(() => Promise.resolve({ data: {} })),
          update: jest.fn(() => Promise.resolve({ stats: { updated: 1 } })),
          set: jest.fn(() => Promise.resolve({}))
        })),
        where: jest.fn(() => ({
          get: jest.fn(() => Promise.resolve({ data: [] })),
          count: jest.fn(() => Promise.resolve({ total: 0 }))
        })),
        add: jest.fn(() => Promise.resolve({ _id: 'test-id' })),
        get: jest.fn(() => Promise.resolve({ data: [] })),
        count: jest.fn(() => Promise.resolve({ total: 0 }))
      }))
    })),
    uploadFile: jest.fn(() => Promise.resolve({ fileID: 'cloud://mock-file-id', statusCode: 200 })),
    downloadFile: jest.fn(() => Promise.resolve({ tempFilePath: '/tmp/mock_cloud_download.pdf', statusCode: 200 })),
    deleteFile: jest.fn(() => Promise.resolve({ fileList: [] })),
    getTempFileURL: jest.fn(() => Promise.resolve({ fileList: [] }))
  }
};

// ============================================================
// 全局 API (非 wx 命名空间)
// ============================================================
global.Page = jest.fn((config) => { global.__lastPageConfig = config; });
global.App = jest.fn();
global.getApp = jest.fn(() => ({
  globalData: {
    token: 'test_token',
    userData: null
  }
}));
global.Component = jest.fn();

// ============================================================
// global.cloud — ai-chat 云函数直接检查 global.cloud.callFunction
// 微信云函数环境与 wx-server-sdk 兼容
// ============================================================
global.cloud = {
  init: jest.fn(),
  callFunction: jest.fn((opts) => {
    const call = opts && opts.name;
    if (call === 'ai-chat') return Promise.resolve({ result: { data: { content: 'mock reply' } } });
    if (call === 'rag-search') return Promise.resolve({ result: { data: { results: [] } } });
    return Promise.resolve({ result: { data: null } });
  }),
  database: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(() => Promise.resolve({ data: {} })),
        update: jest.fn(() => Promise.resolve({ stats: { updated: 1 } })),
        set: jest.fn(() => Promise.resolve({}))
      })),
      where: jest.fn(() => ({
        get: jest.fn(() => Promise.resolve({ data: [] })),
        count: jest.fn(() => Promise.resolve({ total: 0 }))
      })),
      add: jest.fn(() => Promise.resolve({ _id: 'test-id' })),
      get: jest.fn(() => Promise.resolve({ data: [] })),
      count: jest.fn(() => Promise.resolve({ total: 0 }))
    }))
  }))
};

// ============================================================
// 防止 unhandled rejection 污染测试输出
// ============================================================
process.on('unhandledRejection', (reason) => {
  console.warn('Unhandled Rejection:', reason);
});
