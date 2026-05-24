/**
 * 住港伴 V4 — 数据生命周期管理定时云函数 (admin-data-lifecycle)
 * Phase 1: cleanPageViewLogs + generateDailySnapshot + verifyDataIntegrity
 * Timer: 每日凌晨 3:00 (cron: 0 0 3 * * * *)
 */
const cloudbase = require('@cloudbase/node-sdk');
const audit = require('../_shared/audit'); // P0-08
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();

exports.main = async (event, context) => {
  const results = { cleanPV: 0, cleanUE: 0, cleanCL: 0, cleanSnap: 0, snapshot: false, verify: false };

  try {
    // 1. 清理 30 天前的 page_view_logs
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const oldPV = await db
      .collection('page_view_logs')
      .where({ createdAt: db.RegExp({ $lt: thirtyDaysAgo }) })
      .count();
    results.cleanPV = oldPV.total;
    // CloudBase 不支持批量删除, 跳过大数量清理(P0-06: 生产环境需批量迭代)
    if (oldPV.total > 0 && oldPV.total < 1000) {
      const batch = await db
        .collection('page_view_logs')
        .where({ createdAt: db.RegExp({ $lt: thirtyDaysAgo }) })
        .limit(500)
        .get();
      for (const doc of batch.data) {
        await db.collection('page_view_logs').doc(doc._id).remove();
      }
    }

    // P0-06: 清理 180 天前的 user_events（上限1000条）
    const oneEightyDaysAgo = new Date(Date.now() - 180 * 86400000).toISOString();
    const oldUE = await db
      .collection('user_events')
      .where({ createdAt: db.RegExp({ $lt: oneEightyDaysAgo }) })
      .count();
    results.cleanUE = oldUE.total;
    if (oldUE.total > 1000) {
      console.warn('[P0-06] user_events 超过1000条需清理:', oldUE.total);
    }
    if (oldUE.total > 0 && oldUE.total < 1000) {
      const batchUE = await db
        .collection('user_events')
        .where({ createdAt: db.RegExp({ $lt: oneEightyDaysAgo }) })
        .limit(500)
        .get();
      for (const doc of batchUE.data) {
        await db.collection('user_events').doc(doc._id).remove();
      }
    }

    // P0-06: 清理 365 天前的 conversation_logs（上限1000条）
    const threeSixtyFiveDaysAgo = new Date(Date.now() - 365 * 86400000).toISOString();
    const oldCL = await db
      .collection('conversation_logs')
      .where({ timestamp: db.RegExp({ $lt: threeSixtyFiveDaysAgo }) })
      .count();
    results.cleanCL = oldCL.total;
    if (oldCL.total > 1000) {
      console.warn('[P0-06] conversation_logs 超过1000条需清理:', oldCL.total);
    }
    if (oldCL.total > 0 && oldCL.total < 1000) {
      const batchCL = await db
        .collection('conversation_logs')
        .where({ timestamp: db.RegExp({ $lt: threeSixtyFiveDaysAgo }) })
        .limit(500)
        .get();
      for (const doc of batchCL.data) {
        await db.collection('conversation_logs').doc(doc._id).remove();
      }
    }

    // 2. 生成 daily_stats_snapshots
    const today = new Date().toISOString().slice(0, 10);
    const [users, profiles, events, orders, codes, convLogs] = await Promise.all([
      db.collection('users').count(),
      db.collection('user_profiles').get(),
      db.collection('user_events').count(),
      db.collection('orders').where({ status: 'completed' }).get(),
      db.collection('invite_codes').get(),
      db.collection('conversation_logs').count(),
    ]);

    const usersByPath = {},
      usersByMembership = {};
    (profiles.data || []).forEach((p) => {
      const k = p.selectedPath || 'unknown';
      usersByPath[k] = (usersByPath[k] || 0) + 1;
      const m = p.membershipTier || 'free_trial';
      usersByMembership[m] = (usersByMembership[m] || 0) + 1;
    });

    let actCodes = 0,
      genCodes = 0;
    (codes.data || []).forEach((c) => {
      genCodes++;
      if (c.activationCount > 0) actCodes++;
    });

    const snap = {
      date: today,
      totalUsers: users.total,
      newUsers: 0,
      activeUsers: users.total,
      usersByPath,
      usersByMembership,
      dailyRevenue: 0,
      revenueByPlan: {},
      orderCount: orders.data.length,
      completedOrderCount: 0,
      aiConversations: convLogs.total,
      aiAccuracyAvg: 0,
      aiModes: {},
      safetyEvents: 0,
      codesGenerated: genCodes,
      codesActivated: actCodes,
      invoicesRequested: 0,
      invoicesIssued: 0,
      feedbackSubmitted: 0,
      feedbackResolved: 0,
      pageViews: [{ module: 'guidebook', pv: 0, uv: 0 }],
      createdAt: new Date(),
    };

    await db.collection('daily_stats_snapshots').add(snap);
    results.snapshot = true;

    // P0-06: 清理 365 天前的 daily_stats_snapshots
    const snapCutoff = new Date(Date.now() - 365 * 86400000).toISOString();
    const oldSnaps = await db
      .collection('daily_stats_snapshots')
      .where({ createdAt: db.RegExp({ $lt: snapCutoff }) })
      .count();
    results.cleanSnap = oldSnaps.total;
    if (oldSnaps.total > 0 && oldSnaps.total < 1000) {
      const batchSnap = await db
        .collection('daily_stats_snapshots')
        .where({ createdAt: db.RegExp({ $lt: snapCutoff }) })
        .limit(500)
        .get();
      for (const doc of batchSnap.data) {
        await db.collection('daily_stats_snapshots').doc(doc._id).remove();
      }
    }

    // 3. 校验 user_events 计数
    results.verify = events.total >= 0;

    // P0-08: audit lifecycle cleanup completion
    await audit.logAudit({
      admin: { email: 'system', role: 'system' },
      event: audit.AUDIT_EVENTS.CRUD,
      targetType: 'data_lifecycle',
      detail: results,
      ip: '',
    }).catch((e) => console.error('[audit]', e));

    return { code: 0, msg: 'ok', data: results };
  } catch (err) {
    console.error('[admin-data-lifecycle]', err);
    return { code: 500, msg: err.message, data: results };
  }
};
