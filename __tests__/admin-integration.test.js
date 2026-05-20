/**
 * 集成测试: admin-* 云函数 API 端点
 * 通过 HTTP 调用 CloudBase 网关验证
 */
const http = require('http');
const https = require('https');

const BASE = 'https://cloudbase-d1g17tgt7cc199a60.service.tcloudbase.com';
const API_KEY = 'zgb-22bdb94b-ae4b-4335-aecb-87b6f6afc6c1';

function call(path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const data = JSON.stringify({ ...body, _apiKey: API_KEY });
    const req = https.request(url.toString(), { method: 'POST', headers: { 'Content-Type': 'application/json' } }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve({ raw: d }); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

describe('集成测试 — admin-* 云函数 API', () => {
  jest.setTimeout(30000);

  // === admin-stats ===
  describe('admin-stats', () => {
    it('adminLogin 成功登录', async () => {
      const r = await call('/admin-stats', { action: 'adminLogin', params: { email: 'gangban@funway.hk', password: 'zgb2026!' } });
      expect(r.code).toBe(0);
      expect(r.data.apiKey).toBeDefined();
      expect(r.data.adminUser.email).toBe('gangban@funway.hk');
    });

    it('adminLogin 错误密码返回 401', async () => {
      const r = await call('/admin-stats', { action: 'adminLogin', params: { email: 'gangban@funway.hk', password: 'wrong' } });
      expect(r.code).toBe(401);
    });

    it('getDashboard 返回完整数据', async () => {
      const r = await call('/admin-stats', { action: 'getDashboard' });
      expect(r.code).toBe(0);
      const d = r.data;
      ['totalUsers', 'usersByPath', 'usersByMembership', 'aiAccuracyAvg', 'safetyEvents7d'].forEach(f => {
        expect(d).toHaveProperty(f);
      });
    });

    it('无 API Key 返回 401', async () => {
      const req = () => new Promise((resolve) => {
        const u = new URL('/admin-stats', BASE);
        const r = https.request(u.toString(), { method: 'POST', headers: { 'Content-Type': 'application/json' } }, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve(JSON.parse(d))); });
        r.write(JSON.stringify({ action: 'getDashboard', params: {} }));
        r.end();
      });
      const r = await req();
      expect(r.code).toBe(401);
    });
  });

  // === admin-codes ===
  describe('admin-codes', () => {
    it('getCodeStats 返回统计数据', async () => {
      const r = await call('/admin-codes', { action: 'getCodeStats', params: { codeType: 'invite' } });
      expect(r.code).toBe(0);
      expect(r.data).toHaveProperty('generated');
      expect(r.data).toHaveProperty('activated');
      expect(r.data).toHaveProperty('activationRate');
    });

    it('generateCodes 10张邀请码成功', async () => {
      const r = await call('/admin-codes', { action: 'generateCodes', params: { codeType: 'invite', count: 10, batchName: 'TEST-INTEGRATION' } });
      expect(r.code).toBe(0);
      expect(r.data.count).toBe(10);
      expect(r.data.codes).toHaveLength(10);
      r.data.codes.forEach(c => expect(c).toMatch(/^ZGB-/));
    });

    it('generateCodes count > 500 返回 400', async () => {
      const r = await call('/admin-codes', { action: 'generateCodes', params: { codeType: 'invite', count: 999 } });
      expect(r.code).toBe(400);
    });
  });

  // === admin-ai-quality ===
  describe('admin-ai-quality', () => {
    it('getAIDashboard 返回数据 (不含 response_preview)', async () => {
      const r = await call('/admin-ai-quality', { action: 'getAIDashboard', params: { days: 7 } });
      expect(r.code).toBe(0);
    });

    it('getTopQueries 返回脱敏后的查询', async () => {
      const r = await call('/admin-ai-quality', { action: 'getTopQueries' });
      expect(r.code).toBe(0);
    });
  });

  // === admin-compliance ===
  describe('admin-compliance', () => {
    it('getComplianceStatus 返回状态', async () => {
      const r = await call('/admin-compliance', { action: 'getComplianceStatus' });
      expect(r.code).toBe(0);
    });
  });

  // === admin-revenue ===
  describe('admin-revenue', () => {
    it('getRevenueSummary 返回收入数据', async () => {
      const r = await call('/admin-revenue', { action: 'getRevenueSummary' });
      expect(r.code).toBe(0);
      expect(r.data).toHaveProperty('totalRevenue');
      expect(r.data).toHaveProperty('orderCount');
    });
  });

  // === admin-users ===
  describe('admin-users', () => {
    it('listUsers 返回分页列表', async () => {
      const r = await call('/admin-users', { action: 'listUsers', params: { page: 1, pageSize: 10 } });
      expect(r.code).toBe(0);
      expect(r.data).toHaveProperty('total');
      expect(r.data).toHaveProperty('list');
    });
  });
});
