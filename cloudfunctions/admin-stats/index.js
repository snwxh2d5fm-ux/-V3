/**
 * 住港伴 V4 — 运营后台聚合统计云函数 (admin-stats)
 *
 * Phase 1 部署: adminLogin + getDashboard + getTrend
 * 鉴权: API Key 存储在 admin_users.apiKeyHash (SHA-256)
 */
const cloudbase = require('@cloudbase/node-sdk');
const auth = require('./auth');
const audit = require('./audit'); // P0-08
const app = cloudbase.init({ env: 'cloudbase-d1g17tgt7cc199a60' });
const db = app.database();

exports.main = async (event) => {
  // P0-08: extract client IP before body parsing
  const clientIp = event.headers?.['x-forwarded-for']?.split(',')[0]?.trim()
    || event.headers?.['x-real-ip']
    || event.httpHeaders?.['x-forwarded-for']?.split(',')[0]?.trim()
    || '';
  // HTTP 网关调用时 event.body 是 JSON 字符串
  let body = event;
  if (event.body && typeof event.body === 'string') {
    try {
      body = JSON.parse(event.body);
    } catch (_) {
      /* keep raw event */
    }
  }
  const { action, params = {}, _apiKey } = body;

  // adminLogin 不需要鉴权
  if (action === 'adminLogin') return handleAdminLogin(params, clientIp);
  // adminLogout 不需要鉴权 (just log the attempt, don't reject)
  if (action === 'adminLogout') return handleAdminLogout(params, clientIp);

  // 其他 action 需要 API Key 鉴权
  const apiKey = _apiKey || body._apiKey;
  if (!apiKey) return { code: 401, msg: '缺少 API Key' };

  const admin = await validateApiKey(apiKey, clientIp);
  if (!admin) return { code: 401, msg: '无效的 API Key' };

  try {
    switch (action) {
      case 'getDashboard':
        return await getDashboard();
      case 'getTrend':
        return await getTrend(params.metric, params.days || 30);
      default:
        return { code: 400, msg: '无效操作: ' + action };
    }
  } catch (err) {
    console.error('[admin-stats]', err);
    return { code: 500, msg: '服务异常: ' + (err.message || String(err)) };
  }
};

// ========== 鉴权 ==========

async function validateApiKey(apiKey, clientIp) {
  const apiKeyHash = auth.sha256(apiKey);
  const res = await db.collection('admin_users').where({ apiKeyHash, status: 'active' }).limit(1).get();
  if (res.data.length === 0) return null;
  const admin = res.data[0];
  const lock = auth.checkLockout(admin);
  if (lock.locked) return null;
  // P0-08 IP白名单
  const ipCheck = auth.checkIPWhitelist(clientIp);
  if (!ipCheck.allowed) {
    console.warn('[IP白名单] 拒绝:', clientIp, ipCheck.reason);
    return null;
  }
  // Attach IP for downstream audit logging
  admin._clientIp = clientIp;
  return admin;
}

// ========== adminLogin ==========

async function handleAdminLogin(params, clientIp) {
  const { email, password } = params;
  if (!email || !password) {
    return { code: 400, msg: '缺少邮箱或密码' };
  }

  try {
    // 1. Find user by email only (not by password hash — supports scrypt migration)
    const res = await db.collection('admin_users').where({ email, status: 'active' }).limit(1).get();

    if (res.data.length === 0) {
      // P0-08: audit failed login
      await audit.logAudit({
        admin: { email: email || 'unknown', role: 'unknown' },
        event: audit.AUDIT_EVENTS.FAILED_LOGIN,
        targetType: 'admin_login',
        detail: { reason: 'email_not_found' },
        ip: clientIp,
      }).catch((e) => console.error('[audit]', e));
      return { code: 401, msg: '邮箱或密码错误' };
    }

    const admin = res.data[0];

    // 2. Check brute-force lockout
    const lock = auth.checkLockout(admin);
    if (lock.locked) {
      // P0-08: audit locked login attempt
      await audit.logAudit({
        admin: { email: admin.email, role: admin.role || 'unknown' },
        event: audit.AUDIT_EVENTS.FAILED_LOGIN,
        targetType: 'admin_login',
        detail: { reason: 'account_locked', retryAfterMinutes: lock.retryAfterMinutes },
        ip: clientIp,
      }).catch((e) => console.error('[audit]', e));
      return { code: 429, msg: lock.reason };
    }

    // 3. Verify password — try scrypt first, then legacy SHA-256 fallback
    let valid = false;
    let needsMigration = false;

    if (admin.passwordHash && admin.passwordHash.includes(':')) {
      const result = await auth.verifyPassword(password, admin.passwordHash);
      valid = result.valid;
    } else {
      const result = auth.verifyLegacy(password, admin.passwordHash);
      valid = result.valid;
      needsMigration = result.needsMigration;
    }

    if (!valid) {
      // 4a. Failed login — increment attempts, lock if threshold reached
      const newAttempts = (admin.loginAttempts || 0) + 1;
      const updateData = { loginAttempts: newAttempts, updatedAt: new Date() };
      if (newAttempts >= auth.MAX_LOGIN_ATTEMPTS) {
        updateData.lockedUntil = new Date(Date.now() + auth.LOCKOUT_MINUTES * 60 * 1000).toISOString();
      }
      await db.collection('admin_users').doc(admin._id).update({ data: updateData });
      // P0-08: audit failed login
      await audit.logAudit({
        admin: { email: admin.email, role: admin.role || 'unknown' },
        event: audit.AUDIT_EVENTS.FAILED_LOGIN,
        targetType: 'admin_login',
        detail: { reason: 'invalid_password', attempts: newAttempts },
        ip: clientIp,
      }).catch((e) => console.error('[audit]', e));
      return { code: 401, msg: '邮箱或密码错误' };
    }

    // 4b. Successful login — reset lockout, migrate password if needed
    const updateData = {
      loginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      updatedAt: new Date(),
    };

    if (needsMigration) {
      const newHash = await auth.hashPassword(password);
      updateData.passwordHash = newHash;
    }

    let apiKey = admin._apiKey;
    if (!apiKey) {
      apiKey = 'zgb-' + generateUUID();
      updateData._apiKey = apiKey;
      updateData.apiKeyHash = auth.sha256(apiKey);
    }

    await db.collection('admin_users').doc(admin._id).update({ data: updateData });

    // P0-08: audit successful login
    await audit.logAudit({
      admin: { email: admin.email, role: admin.role || 'unknown' },
      event: audit.AUDIT_EVENTS.LOGIN,
      targetType: 'admin_login',
      detail: { uid: admin.uid },
      ip: clientIp,
    }).catch((e) => console.error('[audit]', e));

    return {
      code: 0,
      msg: 'ok',
      data: {
        apiKey,
        adminUser: {
          uid: admin.uid,
          email: admin.email,
          name: admin.name,
          role: admin.role,
        },
      },
    };
  } catch (err) {
    console.error('[adminLogin]', err);
    return { code: 500, msg: '登录服务异常' };
  }
}

// ========== adminLogout (P0-08) ==========

async function handleAdminLogout(params, clientIp) {
  // Logout is informational — record the attempt even without a valid session
  await audit.logAudit({
    admin: { email: params.email || 'unknown', role: 'unknown' },
    event: audit.AUDIT_EVENTS.LOGOUT,
    targetType: 'admin_logout',
    detail: {},
    ip: clientIp,
  }).catch((e) => console.error('[audit]', e));
  return { code: 0, msg: 'ok' };
}

// ========== getDashboard ==========

async function getDashboard() {
  // P0-15: 全量拉取加 limit 防止生产 OOM
  const MAX_DASHBOARD_ROWS = 1000;
  const [users, profiles, events, orders, codes, convLogs, evalResults] = await Promise.all([
    db.collection('users').count(),
    db.collection('user_profiles').limit(MAX_DASHBOARD_ROWS).get(),
    db.collection('user_events').count(),
    db.collection('orders').where({ status: 'completed' }).limit(MAX_DASHBOARD_ROWS).get(),
    db.collection('invite_codes').limit(5000).get(),
    db.collection('conversation_logs').count(),
    db.collection('eval_results').orderBy('createdAt', 'desc').limit(20).get(),
  ]);

  // Users by path
  const usersByPath = {};
  (profiles.data || []).forEach((p) => {
    const key = p.selectedPath || p.lastPath || 'unknown';
    usersByPath[key] = (usersByPath[key] || 0) + 1;
  });

  // Users by membership
  const usersByMembership = {};
  (profiles.data || []).forEach((p) => {
    const tier = p.membershipTier || 'free_trial';
    usersByMembership[tier] = (usersByMembership[tier] || 0) + 1;
  });

  // AI accuracy avg
  let aiAccuracyAvg = null;
  if (evalResults.data && evalResults.data.length > 0) {
    const scores = evalResults.data.map((e) => e.score || 0).filter((s) => s > 0);
    if (scores.length > 0) {
      aiAccuracyAvg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    }
  }

  // 7-day new users (approximation: use total user count ratio)
  const totalUsers = users.total || 0;
  const newUsers7d = Math.min(totalUsers, 3); // Placeholder until user_events has creation events

  // Code stats
  let codesGenerated = 0,
    codesActivated = 0;
  (codes.data || []).forEach((c) => {
    codesGenerated++;
    if (c.activationCount > 0) codesActivated++;
  });

  return {
    code: 0,
    msg: 'ok',
    data: {
      totalUsers,
      newUsers7d,
      activeUsers7d: totalUsers,
      usersByPath,
      usersByMembership,
      aiAccuracyAvg,
      aiConversations7d: convLogs.total || 0,
      safetyEvents7d: 0, // TODO: query content_moderation_logs
      codesGenerated,
      codesActivated,
      complianceIssues: false,
      k2LeakDetected: false,
    },
  };
}

// ========== getTrend ==========

async function getTrend(metric, days) {
  // Phase 1: return empty trend until daily_stats_snapshots has data
  return { code: 0, msg: 'ok', data: [] };
}

// ========== Utils ==========

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
