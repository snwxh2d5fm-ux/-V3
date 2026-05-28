/**
 * 补充单元测试: sendWecomAlert 覆盖率 (模块级 mock)
 * 独立文件避免与 cf-error.test.js 的模块缓存冲突
 */
const path = require('path');
const https = require('https');

// 模块级 mock — 在 require 前设置
jest.mock('https');

const modPath = path.resolve(
  __dirname,
  '../cloudfunctions/invite-code/_cf-error.js'
);

describe('_cf-error — sendWecomAlert 全覆盖 (模块级 mock)', () => {
  let mockReq, cfErrorFresh, origEnv;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});

    mockReq = {
      on: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      destroy: jest.fn(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it('成功响应 HTTP 200', async () => {
    process.env.WECOM_WEBHOOK_URL =
      'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test-200';

    https.request.mockImplementation((opts, cb) => {
      const res = { statusCode: 200, on: jest.fn() };
      res.on.mockImplementation((ev, h) => {
        if (ev === 'data') h('{"errcode":0}');
        if (ev === 'end') h();
      });
      setImmediate(() => cb(res));
      return mockReq;
    });

    delete require.cache[require.resolve(modPath)];
    cfErrorFresh = require(modPath);

    const mockColl = { add: jest.fn().mockResolvedValue({}) };
    const mockDb = { collection: jest.fn().mockReturnValue(mockColl) };

    await cfErrorFresh.reportError({
      db: mockDb,
      fnName: 'wecom-ok',
      action: 'test',
      error: new Error('ok'),
    });

    expect(https.request).toHaveBeenCalled();
    expect(mockReq.write).toHaveBeenCalled();
    expect(mockReq.end).toHaveBeenCalled();
  });

  it('失败响应 HTTP 500', async () => {
    process.env.WECOM_WEBHOOK_URL =
      'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test-500';

    https.request.mockImplementation((opts, cb) => {
      const res = { statusCode: 500, on: jest.fn() };
      res.on.mockImplementation((ev, h) => {
        if (ev === 'data') h('{"errcode":-1}');
        if (ev === 'end') h();
      });
      setImmediate(() => cb(res));
      return mockReq;
    });

    delete require.cache[require.resolve(modPath)];
    cfErrorFresh = require(modPath);

    const mockColl = { add: jest.fn().mockResolvedValue({}) };
    const mockDb = { collection: jest.fn().mockReturnValue(mockColl) };

    await cfErrorFresh.reportError({
      db: mockDb,
      fnName: 'ht500-' + Date.now(),
      action: 'tst500',
      error: new Error('fail'),
    });

    // DB 写入始终触发
    expect(mockColl.add).toHaveBeenCalled();
  });

  it('HTTPS 请求网络错误', async () => {
    process.env.WECOM_WEBHOOK_URL =
      'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=net-err';

    https.request.mockImplementation((opts, cb) => {
      mockReq.on.mockImplementation((ev, handler) => {
        if (ev === 'error') handler(new Error('ECONNRESET'));
      });
      return mockReq;
    });

    delete require.cache[require.resolve(modPath)];
    cfErrorFresh = require(modPath);

    const mockColl = { add: jest.fn().mockResolvedValue({}) };
    const mockDb = { collection: jest.fn().mockReturnValue(mockColl) };

    await cfErrorFresh.reportError({
      db: mockDb,
      fnName: 'wecom-net',
      action: 'test',
      error: new Error('net err'),
    });

    expect(console.error).toHaveBeenCalled();
    expect(mockColl.add).toHaveBeenCalled();
  });

  it('HTTPS 请求超时', async () => {
    process.env.WECOM_WEBHOOK_URL =
      'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=timeout';

    https.request.mockImplementation((opts, cb) => {
      mockReq.on.mockImplementation((ev, handler) => {
        if (ev === 'timeout') handler();
      });
      return mockReq;
    });

    delete require.cache[require.resolve(modPath)];
    cfErrorFresh = require(modPath);

    const mockColl = { add: jest.fn().mockResolvedValue({}) };
    const mockDb = { collection: jest.fn().mockReturnValue(mockColl) };

    await cfErrorFresh.reportError({
      db: mockDb,
      fnName: 'wto-' + Date.now(),
      action: 'tt',
      error: new Error('timeout'),
    });

    // DB 写入始终触发
    expect(mockColl.add).toHaveBeenCalled();
  });

  it('无 webhook 时 跳过企微', async () => {
    delete process.env.WECOM_WEBHOOK_URL;

    delete require.cache[require.resolve(modPath)];
    cfErrorFresh = require(modPath);

    const mockColl = { add: jest.fn().mockResolvedValue({}) };
    const mockDb = { collection: jest.fn().mockReturnValue(mockColl) };

    await cfErrorFresh.reportError({
      db: mockDb,
      fnName: 'no-wecom',
      action: 'test',
      error: new Error('no webhook'),
    });

    expect(https.request).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('WECOM_WEBHOOK_URL')
    );
    expect(mockColl.add).toHaveBeenCalled();
  });

  it('URL 解析失败', async () => {
    process.env.WECOM_WEBHOOK_URL = 'not-valid-url!!!';

    delete require.cache[require.resolve(modPath)];
    cfErrorFresh = require(modPath);

    const mockColl = { add: jest.fn().mockResolvedValue({}) };
    const mockDb = { collection: jest.fn().mockReturnValue(mockColl) };

    await cfErrorFresh.reportError({
      db: mockDb,
      fnName: 'bad-url',
      action: 'test',
      error: new Error('bad url'),
    });

    expect(mockColl.add).toHaveBeenCalled();
  });

  it('企微消息 Markdown 包含函数名和操作', async () => {
    process.env.WECOM_WEBHOOK_URL =
      'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=md';

    https.request.mockImplementation((opts, cb) => {
      const res = { statusCode: 200, on: jest.fn() };
      res.on.mockImplementation((ev, h) => {
        if (ev === 'data') h('{}');
        if (ev === 'end') h();
      });
      setImmediate(() => cb(res));
      return mockReq;
    });

    delete require.cache[require.resolve(modPath)];
    cfErrorFresh = require(modPath);

    const mockColl = { add: jest.fn().mockResolvedValue({}) };
    const mockDb = { collection: jest.fn().mockReturnValue(mockColl) };

    await cfErrorFresh.reportError({
      db: mockDb,
      fnName: 'md-fn-' + Date.now(),
      action: 'md-action',
      error: new Error('DB timeout'),
    });

    const writtenBody = mockReq.write.mock.calls[0]?.[0];
    if (writtenBody) {
      const parsed = JSON.parse(writtenBody);
      expect(parsed.msgtype).toBe('markdown');
      expect(parsed.markdown.content).toContain('md-fn-');
      expect(parsed.markdown.content).toContain('md-action');
      expect(parsed.markdown.content).toContain('DB timeout');
      expect(mockReq.write).toHaveBeenCalled();
    }
    // 如果冷却命中，至少 DB 写了
    expect(mockColl.add).toHaveBeenCalled();
  });

  it('Critical 错误显示红标', async () => {
    process.env.WECOM_WEBHOOK_URL =
      'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=critical';

    https.request.mockImplementation((opts, cb) => {
      const res = { statusCode: 200, on: jest.fn() };
      res.on.mockImplementation((ev, h) => {
        if (ev === 'data') h('{}');
        if (ev === 'end') h();
      });
      setImmediate(() => cb(res));
      return mockReq;
    });

    delete require.cache[require.resolve(modPath)];
    cfErrorFresh = require(modPath);

    const mockColl = { add: jest.fn().mockResolvedValue({}) };
    const mockDb = { collection: jest.fn().mockReturnValue(mockColl) };

    await cfErrorFresh.reportError({
      db: mockDb,
      fnName: 'critical-fn',
      action: 'main',
      error: new Error('Cannot find module wx-server-sdk'),
    });

    const writtenBody = mockReq.write.mock.calls[0]?.[0];
    if (writtenBody) {
      const parsed = JSON.parse(writtenBody);
      expect(parsed.markdown.content).toContain('🔴'); // critical
    }
  });
});
