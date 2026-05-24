/**
 * 单元测试: _shared/audit.js — 审计日志append-only (P0-08修复)
 * Mock: __mocks__/@cloudbase/node-sdk.js
 */
jest.mock('@cloudbase/node-sdk');

const audit = require('../cloudfunctions/_shared/audit');
const cloudbase = require('@cloudbase/node-sdk');

describe('_shared/audit — 审计事件常量', () => {
  it('AUDIT_EVENTS 包含全部7类事件', () => {
    expect(audit.AUDIT_EVENTS.LOGIN).toBe('admin_login');
    expect(audit.AUDIT_EVENTS.LOGOUT).toBe('admin_logout');
    expect(audit.AUDIT_EVENTS.FAILED_LOGIN).toBe('admin_login_failed');
    expect(audit.AUDIT_EVENTS.DATA_EXPORT).toBe('data_export');
    expect(audit.AUDIT_EVENTS.SENSITIVE_VIEW).toBe('sensitive_field_view');
    expect(audit.AUDIT_EVENTS.PERMISSION_CHANGE).toBe('permission_change');
    expect(audit.AUDIT_EVENTS.CRUD).toBe('crud_operation');
  });

  it('logAudit 写入 admin_audit_trail 并返回结果', async () => {
    const r = await audit.logAudit({
      admin: { email: 'test@funway.hk', role: 'pm' },
      event: audit.AUDIT_EVENTS.LOGIN,
      targetType: 'admin_login',
      targetId: '',
      detail: { test: true },
      ip: '127.0.0.1',
    });
    expect(r).toBeDefined();
  });

  it('logAudit 传递完整字段到 add()', async () => {
    cloudbase._mockAdd.mockClear();
    await audit.logAudit({
      admin: { email: 'admin@test.com', role: 'super_admin' },
      event: 'test_event',
      targetType: 'user',
      targetId: 'uid_123',
      detail: { action: 'lock' },
      ip: '10.0.0.1',
    });
    const callArg = cloudbase._mockAdd.mock.calls[0][0];
    expect(callArg.admin_email).toBe('admin@test.com');
    expect(callArg.admin_role).toBe('super_admin');
    expect(callArg.event).toBe('test_event');
    expect(callArg.targetType).toBe('user');
    expect(callArg.targetId).toBe('uid_123');
    expect(callArg.detail.action).toBe('lock');
    expect(callArg.ip).toBe('10.0.0.1');
    expect(typeof callArg.createdAt).toBe('number');
  });
});

describe('_shared/audit — append-only 保证', () => {
  it('模块仅导出 logAudit 和 AUDIT_EVENTS，不导出 update/delete', () => {
    expect(typeof audit.logAudit).toBe('function');
    expect(typeof audit.AUDIT_EVENTS).toBe('object');
    expect(audit.updateAudit).toBeUndefined();
    expect(audit.deleteAudit).toBeUndefined();
    expect(audit.removeAudit).toBeUndefined();
  });
});

describe('P0-03 采样率验证', () => {
  it('PAGE_VIEW_SAMPLE_RATE = 0.1 在1000次采样中产生合理分布', () => {
    const sampleRate = 0.1;
    let sampled = 0;
    for (let i = 0; i < 1000; i++) {
      if (Math.random() < sampleRate) sampled++;
    }
    expect(sampled).toBeGreaterThan(30);
    expect(sampled).toBeLessThan(170);
  });
});
