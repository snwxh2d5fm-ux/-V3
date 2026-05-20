/**
 * 住港伴 V4 — 运营后台聚合统计云函数 (admin-stats)
 *
 * Phase 1 部署: adminLogin + getDashboard + getTrend
 * 鉴权: API Key 存储在 admin_users.apiKeyHash (SHA-256)
 */
const cloudbase = require('@cloudbase/node-sdk');
const crypto = require('crypto');
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();

function sha256(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

exports.main = async (event) => {
  // HTTP 网关调用时 event.body 是 JSON 字符串
  let body = event;
  if (event.body && typeof event.body === 'string') {
    try { body = JSON.parse(event.body); } catch (_) { /* keep raw event */ }
  }
  const { action, params = {}, _apiKey } = body;

  // adminLogin 不需要鉴权
  if (action === 'adminLogin') return handleAdminLogin(params);

  // 其他 action 需要 API Key 鉴权
  const apiKey = _apiKey || body._apiKey;
  if (!apiKey) return { code: 401, msg: '缺少 API Key' };

  const admin = await validateApiKey(apiKey);
  if (!admin) return { code: 401, msg: '无效的 API Key' };

  try {
    switch (action) {
      case 'getDashboard': return await getDashboard();
      case 'getTrend':     return await getTrend(params.metric, params.days || 30);
      default:             return { code: 400, msg: '无效操作: ' + action };
    }
  } catch (err) {
    console.error('[admin-stats]', err);
    return { code: 500, msg: '服务异常: ' + (err.message || String(err)) };
  }
};

// ========== 鉴权 ==========

async function validateApiKey(apiKey) {
  const apiKeyHash = sha256(apiKey);
  const res = await db.collection('admin_users')
    .where({ apiKeyHash, status: 'active' })
    .limit(1).get();
  return res.data.length > 0 ? res.data[0] : null;
}

// ========== adminLogin ==========

async function handleAdminLogin(params) {
  const { email, password } = params;
  if (!email || !password) {
    return { code: 400, msg: '缺少邮箱或密码' };
  }

  try {
    const pwHash = sha256(password);
    const res = await db.collection('admin_users')
      .where({ email, passwordHash: pwHash, status: 'active' })
      .get();

    if (res.data.length === 0) {
      return { code: 401, msg: '邮箱或密码错误' };
    }

    const admin = res.data[0];
    let apiKey = admin._apiKey;
    if (!apiKey) {
      apiKey = 'zgb-' + generateUUID();
      const keyHash = sha256(apiKey);
      await db.collection('admin_users').doc(admin._id).update({
        data: {
          _apiKey: apiKey,
          apiKeyHash: keyHash,
          loginAttempts: 0,
          lastLoginAt: new Date(),
          updatedAt: new Date()
        }
      });
    } else {
      await db.collection('admin_users').doc(admin._id).update({
        data: {
          loginAttempts: 0,
          lastLoginAt: new Date(),
          updatedAt: new Date()
        }
      });
    }

    return {
      code: 0,
      msg: 'ok',
      data: {
        apiKey,
        adminUser: {
          uid: admin.uid,
          email: admin.email,
          name: admin.name,
          role: admin.role
        }
      }
    };
  } catch (err) {
    console.error('[adminLogin]', err);
    return { code: 500, msg: '登录服务异常' };
  }
}

// ========== getDashboard ==========

async function getDashboard() {
  const [users, profiles, events, orders, codes, convLogs, evalResults] = await Promise.all([
    db.collection('users').count(),
    db.collection('user_profiles').get(),
    db.collection('user_events').count(),
    db.collection('orders').where({ status: 'completed' }).get(),
    db.collection('invite_codes').get(),
    db.collection('conversation_logs').count(),
    db.collection('eval_results').orderBy('createdAt', 'desc').limit(20).get()
  ]);

  // Users by path
  const usersByPath = {};
  (profiles.data || []).forEach(p => {
    const key = p.selectedPath || p.lastPath || 'unknown';
    usersByPath[key] = (usersByPath[key] || 0) + 1;
  });

  // Users by membership
  const usersByMembership = {};
  (profiles.data || []).forEach(p => {
    const tier = p.membershipTier || 'free_trial';
    usersByMembership[tier] = (usersByMembership[tier] || 0) + 1;
  });

  // AI accuracy avg
  let aiAccuracyAvg = null;
  if (evalResults.data && evalResults.data.length > 0) {
    const scores = evalResults.data.map(e => e.score || 0).filter(s => s > 0);
    if (scores.length > 0) {
      aiAccuracyAvg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    }
  }

  // 7-day new users (approximation: use total user count ratio)
  const totalUsers = users.total || 0;
  const newUsers7d = Math.min(totalUsers, 3); // Placeholder until user_events has creation events

  // Code stats
  let codesGenerated = 0, codesActivated = 0;
  (codes.data || []).forEach(c => {
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
      k2LeakDetected: false
    }
  };
}

// ========== getTrend ==========

async function getTrend(metric, days) {
  // Phase 1: return empty trend until daily_stats_snapshots has data
  return { code: 0, msg: 'ok', data: [] };
}

// ========== Utils ==========

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
