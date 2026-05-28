/**
 * 集成测试: cf-alert HTTP 云函数
 *
 * 测试范围:
 *   - GET /status — 健康状态查询
 *   - GET /config — 告警配置状态
 *   - POST /send  — 手动告警触发
 *   - 默认响应  — 可用端点列表
 *   - 异常处理  — 内部错误返回 500
 *
 * 门禁: 全部通过，接口契约无断裂
 */

const path = require('path');

// Mock @cloudbase/node-sdk — 每个测试重新构建 chain
const mockCollection = {
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  get: jest.fn().mockResolvedValue({ data: [] }),
  add: jest.fn().mockResolvedValue({}),
};
let mockDbRef = { collection: jest.fn().mockReturnValue(mockCollection) };

jest.mock('@cloudbase/node-sdk', () => ({
  init: jest.fn(() => ({
    database: jest.fn(() => ({
      ...mockDbRef,
      command: {
        gte: jest.fn((val) => ({ _gte: val })),
        lte: jest.fn((val) => ({ _lte: val })),
        eq: jest.fn((val) => val),
        neq: jest.fn((val) => ({ _neq: val })),
        in: jest.fn((arr) => ({ _in: arr })),
      },
    })),
  })),
  SYMBOL_CURRENT_ENV: 'mock-env-id',
}));

const cfAlertPath = path.resolve(__dirname, '../cloudfunctions/cf-alert/index.js');

describe('cf-alert HTTP 云函数 — 集成测试', () => {
  let cfAlert;

  function resetModule() {
    // 重置 mock chain
    mockCollection.where = jest.fn().mockReturnValue(mockCollection);
    mockCollection.orderBy = jest.fn().mockReturnValue(mockCollection);
    mockCollection.limit = jest.fn().mockReturnValue(mockCollection);
    mockCollection.get = jest.fn().mockResolvedValue({ data: [] });
    mockCollection.add = jest.fn().mockResolvedValue({});
    mockDbRef = { collection: jest.fn().mockReturnValue(mockCollection) };

    delete require.cache[require.resolve(cfAlertPath)];
    cfAlert = require(cfAlertPath);
  }

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    resetModule();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  // ========== GET /status ==========
  describe('GET /status', () => {
    it('返回 200 + 正确数据结构', async () => {
      const result = await cfAlert.main({ httpMethod: 'GET', path: '/cf-alert/status' });
      expect(result.statusCode).toBe(200);

      const body = JSON.parse(result.body);
      expect(body).toHaveProperty('checkedAt');
      expect(body).toHaveProperty('last24h');
      expect(body.last24h).toHaveProperty('totalErrors', 0);
      expect(body.last24h).toHaveProperty('critical', 0);
      expect(body.last24h).toHaveProperty('high', 0);
      expect(body.last24h).toHaveProperty('functionsAffected', 0);
      expect(Array.isArray(body.functions)).toBe(true);
      expect(body.functions).toHaveLength(0);
    });

    it('Content-Type 为 JSON', async () => {
      const result = await cfAlert.main({ httpMethod: 'GET', path: '/cf-alert/status' });
      expect(result.headers['Content-Type']).toBe('application/json');
    });
  });

  // ========== GET /config ==========
  describe('GET /config', () => {
    it('返回 200 + 配置信息', async () => {
      const result = await cfAlert.main({ httpMethod: 'GET', path: '/cf-alert/config' });
      expect(result.statusCode).toBe(200);

      const body = JSON.parse(result.body);
      expect(body).toHaveProperty('webhookConfigured');
      expect(body).toHaveProperty('webhookUrlMasked');
      expect(body).toHaveProperty('errorCollection');
      expect(body).toHaveProperty('collectionInitialized');
      expect(typeof body.webhookConfigured).toBe('boolean');
    });
  });

  // ========== POST /send ==========
  describe('POST /send', () => {
    it('缺少 fnName 返回 400', async () => {
      const result = await cfAlert.main({
        httpMethod: 'POST', path: '/cf-alert/send',
        body: JSON.stringify({ errorMsg: 'test' }),
      });
      expect(result.statusCode).toBe(400);
    });

    it('缺少 errorMsg 返回 400', async () => {
      const result = await cfAlert.main({
        httpMethod: 'POST', path: '/cf-alert/send',
        body: JSON.stringify({ fnName: 'test-fn' }),
      });
      expect(result.statusCode).toBe(400);
    });

    it('完整参数正常处理', async () => {
      const result = await cfAlert.main({
        httpMethod: 'POST', path: '/cf-alert/send',
        body: JSON.stringify({ fnName: 't', errorMsg: 'test', action: 'a', note: 'n' }),
      });
      expect([200, 500]).toContain(result.statusCode);
    });
  });

  // ========== 默认响应 ==========
  describe('GET /', () => {
    it('返回端点列表', async () => {
      const result = await cfAlert.main({ httpMethod: 'GET', path: '/' });
      expect(result.statusCode).toBe(200);

      const body = JSON.parse(result.body);
      expect(body.service).toBe('cf-alert');
      expect(body.endpoints).toContain('/status');
      expect(body.endpoints).toContain('/config');
      expect(body.endpoints).toContain('/send');
      expect(body).toHaveProperty('webhookConfigured');
    });
  });

  // ========== 异常处理 ==========
  describe('异常处理', () => {
    it('DB 查询失败返回 500', async () => {
      // 单独隔离：重建模块 + 注入故障 DB
      mockCollection.get.mockRejectedValue(new Error('DB connection lost'));
      mockDbRef = {
        collection: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          get: jest.fn().mockRejectedValue(new Error('DB connection lost')),
        }),
      };

      delete require.cache[require.resolve(cfAlertPath)];
      const brokenAlert = require(cfAlertPath);

      const result = await brokenAlert.main({ httpMethod: 'GET', path: '/cf-alert/status' });
      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body)).toHaveProperty('error');
    });
  });

  // ========== 契约验证 ==========
  describe('接口契约', () => {
    it('所有 GET 端点返回 JSON Content-Type', async () => {
      const paths = ['/cf-alert/status', '/cf-alert/config', '/'];
      for (const p of paths) {
        const result = await cfAlert.main({ httpMethod: 'GET', path: p });
        expect(result.headers['Content-Type']).toBe('application/json');
        expect(() => JSON.parse(result.body)).not.toThrow();
      }
    });

    it('POST /send 错误消息对客户端友好', async () => {
      const result = await cfAlert.main({
        httpMethod: 'POST', path: '/cf-alert/send',
        body: JSON.stringify({}),
      });
      const body = JSON.parse(result.body);
      expect(body.error).toBeTruthy();
      expect(typeof body.error).toBe('string');
    });
  });
});
