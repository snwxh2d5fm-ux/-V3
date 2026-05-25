/**
 * 住港伴 V4 — 共享审计日志模块 (P0-08)
 *
 * append-only: 仅 .add(), 禁止 .update() / .remove()
 * Schema: admin_audit_trail 集合
 */
const cloudbase = require('@cloudbase/node-sdk');
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();

const AUDIT_EVENTS = {
  LOGIN: 'admin_login',
  LOGOUT: 'admin_logout',
  FAILED_LOGIN: 'admin_login_failed',
  DATA_EXPORT: 'data_export',
  SENSITIVE_VIEW: 'sensitive_field_view',
  PERMISSION_CHANGE: 'permission_change',
  CRUD: 'crud_operation',
};

// append-only: only insert, never update/delete
async function logAudit({ admin, event, targetType, targetId, detail, ip }) {
  return db.collection('admin_audit_trail').add({
    admin_email: admin.email || 'unknown',
    admin_role: admin.role || 'unknown',
    event,
    targetType: targetType || '',
    targetId: targetId || '',
    detail: detail || {},
    ip: ip || '',
    createdAt: Date.now(),
  });
}

module.exports = { AUDIT_EVENTS, logAudit };
