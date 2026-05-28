/**
 * QA 测试: 错误监控体系 — 边界与回归
 * Phase 3: 第三方质检视角 (功能/边界/回归)
 */
const path = require('path');
const cfError = require(path.resolve(__dirname, '../cloudfunctions/invite-code/_cf-error.js'));

describe('QA — 功能验证: 错误上报链路', () => {
  let mockColl, mockDb;
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    mockColl = { add: jest.fn().mockResolvedValue({}) };
    mockDb = { collection: jest.fn().mockReturnValue(mockColl) };
  });
  afterEach(() => jest.restoreAllMocks());

  [
    { story: 'invite-code 依赖缺失', fn: 'invite-code', action: 'redeem-code', err: new Error('Cannot find module wx-server-sdk') },
    { story: 'user-auth DB连接失败', fn: 'user-auth', action: 'login', err: new Error('ENOTFOUND') },
    { story: 'payment 支付超时', fn: 'payment', action: 'createOrder', err: new Error('Payment timeout') },
    { story: 'feedback-submit 模板错', fn: 'feedback-submit', action: 'submit', err: new Error('Cannot read properties') },
  ].forEach(({ story, fn, action, err }) => {
    it(story, async () => {
      await cfError.reportError({ db: mockDb, fnName: fn, action, error: err });
      expect(mockColl.add).toHaveBeenCalled();
      expect(mockColl.add.mock.calls[0][0].data.fnName).toBe(fn);
      expect(mockColl.add.mock.calls[0][0].data.action).toBe(action);
    });
  });

  it('5个已接入云函数 catch 链包含 reportError', () => {
    const fs = require('fs');
    ['invite-code','user-auth','payment','feedback-submit'].forEach(fn => {
      const c = fs.readFileSync(path.resolve(__dirname,'../cloudfunctions',fn,'index.js'),'utf-8');
      expect(c).toContain("require('./_cf-error')");
      expect(c).toContain('reportError({');
      expect(c).toContain(`fnName: '${fn}'`);
    });
    const ai = fs.readFileSync(path.resolve(__dirname,'../cloudfunctions/ai-chat/index.js'),'utf-8');
    expect(ai).toContain('reportErrorHttp');
  });
});

describe('QA — 边界测试', () => {
  let mockColl, mockDb;
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    mockColl = { add: jest.fn().mockResolvedValue({}) };
    mockDb = { collection: jest.fn().mockReturnValue(mockColl) };
  });
  afterEach(() => jest.restoreAllMocks());

  it('空 action', async () => { await cfError.reportError({db:mockDb,fnName:'t',action:'',error:new Error('x')}); expect(mockColl.add).toHaveBeenCalled(); });
  it('undefined error', async () => { await cfError.reportError({db:mockDb,fnName:'t',action:'m',error:undefined}); expect(mockColl.add).toHaveBeenCalled(); });
  it('非标准Error对象', async () => { await cfError.reportError({db:mockDb,fnName:'t',action:'m',error:{name:'X'}}); expect(mockColl.add).toHaveBeenCalled(); });
  it('10000字符消息截断到1000', async () => { await cfError.reportError({db:mockDb,fnName:'t',action:'m',error:new Error('A'.repeat(10000))}); expect(mockColl.add.mock.calls[0][0].data.errorMsg.length).toBeLessThanOrEqual(1000); });
  it('超深调用栈截断到2000', async () => { const e=new Error('d');e.stack='E:d\n'+'  at fn'.repeat(500); await cfError.reportError({db:mockDb,fnName:'t',action:'m',error:e}); expect(mockColl.add.mock.calls[0][0].data.errorStack.length).toBeLessThanOrEqual(2000); });
  it('中文云函数名', async () => { await cfError.reportError({db:mockDb,fnName:'中文名称',action:'测试',error:new Error('x')}); expect(mockColl.add).toHaveBeenCalled(); });
  it('并发10次不丢失', async () => { const ps=Array(10).fill(0).map((_,i)=>cfError.reportError({db:mockDb,fnName:`c${i}`,action:'s',error:new Error(`e${i}`)})); await Promise.all(ps); expect(mockColl.add).toHaveBeenCalledTimes(10); });
});

describe('QA — 回归测试', () => {
  it('cloudbaserc.json 包含 cf-alert', () => {
    const c = JSON.parse(require('fs').readFileSync(path.resolve(__dirname,'../cloudbaserc.json'),'utf-8'));
    const names = c.functions.map(f=>f.name);
    expect(names).toContain('cf-alert');
    expect(names).toContain('feedback-submit');
  });
  it('cf-alert package.json 有效', () => {
    const p = JSON.parse(require('fs').readFileSync(path.resolve(__dirname,'../cloudfunctions/cf-alert/package.json'),'utf-8'));
    expect(p.name).toBe('cf-alert');
    expect(p.dependencies).toHaveProperty('@cloudbase/node-sdk');
  });
  it('_cf-error.js 加载不抛异常', () => {
    ['invite-code','user-auth','payment','feedback-submit'].forEach(d=>{
      expect(()=>require(path.resolve(__dirname,'../cloudfunctions',d,'_cf-error.js'))).not.toThrow();
    });
  });
  it('所有模块使用同一集合名 cf_error_logs', () => {
    const fs = require('fs');
    ['_shared/error-reporter.js','invite-code/_cf-error.js','user-auth/_cf-error.js','payment/_cf-error.js','feedback-submit/_cf-error.js'].forEach(p2=>{
      expect(fs.readFileSync(path.resolve(__dirname,'../cloudfunctions',p2),'utf-8')).toContain("'cf_error_logs'");
    });
  });
});

describe('QA Sign-off', () => {
  it('无硬编码 webhook URL', () => {
    const fs=require('fs');
    ['_shared/error-reporter.js','invite-code/_cf-error.js','cf-alert/index.js'].forEach(f=>{
      expect(fs.readFileSync(path.resolve(__dirname,'../cloudfunctions',f),'utf-8')).not.toMatch(/https:\/\/qyapi\.weixin\.qq\.com\/cgi-bin\/webhook\/send\?key=[a-zA-Z0-9\-_]+/);
    });
  });
  it('config 中注册的函数目录均存在', () => {
    const fs=require('fs');
    const c=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../cloudbaserc.json'),'utf-8'));
    c.functions.forEach(fn=>{
      expect(fs.existsSync(path.resolve(__dirname,'../cloudfunctions',fn.name))).toBe(true);
    });
  });
});
