/**
 * usage-tracker — 用户行为追踪 + 路径偏好校验
 * 记录每一次测试/选择/切换行为，用于分析用户真实路径偏好
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  const { action } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  try {
    switch (action) {
      case 'track':
        return await trackEvent(openid, event);
      case 'stats':
        return await getStats(openid, event);
      case 'userProfile':
        return await getUserProfile(openid);
      default:
        return { code: 400, msg: '无效操作，支持: track / stats / userProfile' };
    }
  } catch (err) {
    console.error('[usage-tracker]', err);
    return { code: 500, msg: '服务异常: ' + (err.message || String(err)) };
  }
};

// ========== 事件追踪 ==========

async function trackEvent(openid, event) {
  const { eventType, payload } = event;
  if (!eventType) return { code: 400, msg: '缺少 eventType' };

  const record = {
    _openid: openid,
    eventType: eventType,
    payload: payload || {},
    // 设备信息
    platform: event.platform || '',
    appVersion: event.appVersion || '',
    // 时间
    createdAt: db.serverDate(),
    sessionId: event.sessionId || '',
  };

  try {
    const res = await db.collection('user_events').add({ data: record });
    console.debug('[track]', eventType, '→', res._id);

    // 如果是路径选择事件，同步更新用户画像
    if (eventType === 'path_selected' && payload && payload.pathType) {
      await upsertUserProfile(openid, payload);
    }

    return { code: 0, msg: 'ok', eventId: res._id };
  } catch (e) {
    console.error('[track] 写入失败:', e);
    return { code: 500, msg: '记录写入失败' };
  }
}

// ========== 用户画像更新 ==========

async function upsertUserProfile(openid, payload) {
  try {
    const existing = await db.collection('user_profiles').where({ _openid: openid }).get();

    const now = Date.now();
    const profile = {
      _openid: openid,
      selectedPath: payload.pathType || '',
      pathLabel: payload.pathLabel || '',
      pathSource: payload.source || '', // assessment / manual / ai_chat
      persona: payload.persona || 0,
      personaLabel: payload.personaLabel || '',
      userStatus: payload.userStatus || '',
      switchCount: ((existing.data[0] && existing.data[0].switchCount) || 0) + (payload.isSwitch ? 1 : 0),
      firstPath: (existing.data[0] && existing.data[0].firstPath) || payload.pathType || '',
      lastPath: payload.pathType || '',
      pathHistory: ((existing.data[0] && existing.data[0].pathHistory) || [])
        .concat([
          {
            path: payload.pathType,
            label: payload.pathLabel,
            source: payload.source,
            timestamp: now,
          },
        ])
        .slice(-20), // 保留最近20条
      updatedAt: now,
    };

    if (existing.data.length > 0) {
      await db.collection('user_profiles').doc(existing.data[0]._id).update({ data: profile });
    } else {
      profile.createdAt = now;
      await db.collection('user_profiles').add({ data: profile });
    }
  } catch (e) {
    console.warn('[track] 用户画像更新失败:', e);
    // 不阻塞主流程
  }
}

// ========== 统计查询（管理后台用） ==========

async function getStats(openid, event) {
  const { type, days } = event; // type: 'path_preference' | 'funnel' | 'user_summary'

  try {
    switch (type) {
      case 'path_preference':
        return await getPathPreferenceStats(days || 30);
      case 'funnel':
        return await getFunnelStats(days || 30);
      case 'user_summary':
        return await getUserSummaryStats();
      default:
        return { code: 400, msg: '未知统计类型' };
    }
  } catch (e) {
    console.error('[stats] 查询失败:', e);
    return { code: 500, msg: '统计查询失败' };
  }
}

// 路径偏好分布
async function getPathPreferenceStats(days) {
  const since = new Date(Date.now() - days * 86400000);

  // 从 user_profiles 读取（比 events 更聚合）
  const profiles = await db
    .collection('user_profiles')
    .field({ selectedPath: true, pathLabel: true, pathSource: true, lastPath: true })
    .get();

  const paths = profiles.data || [];
  const total = paths.length;
  const distribution = {};

  paths.forEach((p) => {
    const key = p.selectedPath || p.lastPath || 'unknown';
    if (!distribution[key]) {
      distribution[key] = { count: 0, label: p.pathLabel || key, sources: {} };
    }
    distribution[key].count++;
    const src = p.pathSource || 'unknown';
    distribution[key].sources[src] = (distribution[key].sources[src] || 0) + 1;
  });

  return {
    code: 0,
    data: {
      totalUsers: total,
      period: `${days}天`,
      distribution: Object.entries(distribution)
        .map(([path, info]) => ({
          path,
          label: info.label,
          count: info.count,
          percentage: total > 0 ? Math.round((info.count / total) * 100) : 0,
          sources: info.sources,
        }))
        .sort((a, b) => b.count - a.count),
    },
  };
}

// 漏斗统计
async function getFunnelStats(days) {
  const since = new Date(Date.now() - days * 86400000);

  // 各事件计数
  const counts = {};
  const eventTypes = [
    'assessment_started',
    'assessment_completed',
    'path_selected',
    'process_created',
    'document_added',
  ];

  for (const et of eventTypes) {
    const res = await db.collection('user_events').where({ eventType: et }).count();
    counts[et] = res.total || 0;
  }

  return {
    code: 0,
    data: {
      period: `${days}天`,
      funnel: [
        { step: '开始评估', count: counts.assessment_started || 0 },
        { step: '完成评估', count: counts.assessment_completed || 0 },
        { step: '选择路径', count: counts.path_selected || 0 },
        { step: '创建流程', count: counts.process_created || 0 },
        { step: '添加证件', count: counts.document_added || 0 },
      ],
    },
  };
}

// 用户摘要
async function getUserSummaryStats() {
  const [profiles, events] = await Promise.all([
    db.collection('user_profiles').count(),
    db.collection('user_events').count(),
  ]);

  return {
    code: 0,
    data: {
      totalTrackedUsers: profiles.total || 0,
      totalEvents: events.total || 0,
    },
  };
}

// ========== 用户画像查询 ==========

async function getUserProfile(openid) {
  const res = await db.collection('user_profiles').where({ _openid: openid }).get();

  if (res.data.length === 0) {
    return { code: 0, data: { hasProfile: false } };
  }

  const profile = res.data[0];
  return {
    code: 0,
    data: {
      hasProfile: true,
      selectedPath: profile.selectedPath,
      pathLabel: profile.pathLabel,
      pathSource: profile.pathSource,
      persona: profile.persona,
      personaLabel: profile.personaLabel,
      switchCount: profile.switchCount || 0,
      firstPath: profile.firstPath,
      lastPath: profile.lastPath,
      pathHistory: profile.pathHistory || [],
    },
  };
}
