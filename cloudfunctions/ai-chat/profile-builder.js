/**
 * 住港伴 v5.0 — AI-Chat 四维用户画像构建器
 *
 * [V4.1-PHASE1] ZGB-AI-107 (P2-007提前) 新增文件
 *
 * 并行查询4个集合构建用户画像:
 *   - 身份画像: user_profiles (persona, personaLabel, selectedPath, pathLabel, switchCount)
 *   - 阶段画像: user_processes (currentStageId, stageName, overallProgress, milestone状态)
 *   - 行为画像: user_events (最近 assessment_completed 的 topMatches)
 *   - 会话画像: conversation_logs (最近5轮对话记录)
 *
 * 缓存策略: 内存缓存 TTL=300s, max 200条目
 * 容错: Promise.allSettled + 空值降级
 *
 * 输入: openid (string)
 * 输出: { identity, stage, behavior, conversation, hasData }
 */
const cloudbase = require('@cloudbase/node-sdk');

// ========== CloudBase 初始化 (复用单例) ==========
let _app = null;
function getApp() {
  if (!_app) {
    _app = cloudbase.init({ env: process.env.ENV_ID });
  }
  return _app;
}

function getDb() {
  return getApp().database();
}

// ========== 画像缓存 ==========
const PROFILE_CACHE_TTL = 300 * 1000; // 5 minutes
let profileCache = {};

function getCachedProfile(openid) {
  var entry = profileCache[openid];
  if (entry && (Date.now() - entry.ts) < PROFILE_CACHE_TTL) {
    return entry.data;
  }
  return null;
}

function setCachedProfile(openid, data) {
  // 空画像不缓存
  if (!data || !data.hasData) return;

  profileCache[openid] = { ts: Date.now(), data: data };

  // 限制缓存大小，淘汰最早1/4条目
  var keys = Object.keys(profileCache);
  if (keys.length > 200) {
    var sorted = keys.slice().sort(function (a, b) {
      return profileCache[a].ts - profileCache[b].ts;
    });
    for (var i = 0; i < 50; i++) {
      delete profileCache[sorted[i]];
    }
  }
}

// ========== 四维并行查询 ==========

/**
 * L1: 身份画像 — 查询 user_profiles 集合
 * 字段: persona, personaLabel, selectedPath, pathLabel, switchCount
 */
async function queryIdentityProfile(openid) {
  var ddb = getDb();
  var res = await ddb.collection('user_profiles')
    .where({ _openid: openid })
    .limit(1)
    .get();
  if (!res.data || res.data.length === 0) return null;
  var p = res.data[0];
  // 只提取关键字段
  return {
    persona: p.persona,
    personaLabel: p.personaLabel,
    selectedPath: p.selectedPath,
    pathLabel: p.pathLabel,
    switchCount: p.switchCount
  };
}

/**
 * L2: 阶段画像 — 查询 user_processes 集合
 * 字段: currentStageId, stageName (from stages[]), overallProgress, milestones
 */
async function queryStageProfile(openid) {
  var ddb = getDb();
  // 只查活跃进程
  var res = await ddb.collection('user_processes')
    .where({ _openid: openid, status: 'active' })
    .orderBy('updatedAt', 'desc')
    .limit(1)
    .get();
  if (!res.data || res.data.length === 0) return null;
  var p = res.data[0];
  // 提取关键字段
  var stage = {
    currentStageId: p.currentStageId,
    overallProgress: p.overallProgress,
    milestones: null
  };
  // 从 stages[] 中查找当前 stageName
  if (p.stages && Array.isArray(p.stages)) {
    for (var i = 0; i < p.stages.length; i++) {
      if (p.stages[i].id === p.currentStageId) {
        stage.stageName = p.stages[i].name;
        break;
      }
    }
  }
  // 提取里程碑状态
  if (p.milestones && Array.isArray(p.milestones) && p.milestones.length > 0) {
    stage.milestones = p.milestones.map(function (m) {
      return { docType: m.docType, status: m.status };
    });
  }
  return stage;
}

/**
 * L3: 行为画像 — 查询 user_events 集合
 * 查询最近 assessment_completed 事件的 topMatches
 */
async function queryBehaviorProfile(openid) {
  var ddb = getDb();
  var res = await ddb.collection('user_events')
    .where({
      _openid: openid,
      type: 'assessment_completed'
    })
    .orderBy('timestamp', 'desc')
    .limit(1)
    .get();

  // 兼容 createdAt 字段
  if (!res.data || res.data.length === 0) {
    // 重试用 createdAt 排序
    res = await ddb.collection('user_events')
      .where({
        _openid: openid,
        type: 'assessment_completed'
      })
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
  }

  if (!res.data || res.data.length === 0) return null;
  var ev = res.data[0];
  return {
    assessmentCompleted: true,
    topMatches: ev.topMatches || ev.payload || null
  };
}

/**
 * L4: 会话画像 — 查询 conversation_logs 集合
 * 最近5轮对话历史 (query + response_preview)
 * 注意: 现有日志没有 _openid 字段，新写入后有效
 */
async function queryConversationProfile(openid) {
  var ddb = getDb();
  var res = await ddb.collection('conversation_logs')
    .where({ _openid: openid })
    .orderBy('timestamp', 'desc')
    .limit(5)
    .get();
  if (!res.data || res.data.length === 0) return null;
  return res.data.map(function (log) {
    return {
      query: log.query,
      response_preview: log.response_preview,
      mode: log.mode,
      timestamp: log.timestamp
    };
  });
}

// ========== 画像总入口 ==========

/**
 * 主入口: 并行查询四维画像
 * 使用 Promise.allSettled 保证单路失败不影响其他路
 * 空用户不崩溃: 返回 hasData=false 的降级对象
 */
async function buildProfile(openid) {
  // 空 openid 快速返回
  if (!openid) {
    return { hasData: false };
  }

  // 缓存优先
  var cached = getCachedProfile(openid);
  if (cached) {
    console.log('[profile-builder] cache hit for', openid);
    return cached;
  }

  console.log('[profile-builder] building profile for', openid);

  // 四路并行查询
  var results = await Promise.allSettled([
    queryIdentityProfile(openid),
    queryStageProfile(openid),
    queryBehaviorProfile(openid),
    queryConversationProfile(openid)
  ]);

  var profile = {
    identity: results[0].status === 'fulfilled' ? results[0].value : null,
    stage: results[1].status === 'fulfilled' ? results[1].value : null,
    behavior: results[2].status === 'fulfilled' ? results[2].value : null,
    conversation: results[3].status === 'fulfilled' ? results[3].value : null,
    hasData: false
  };

  // 记录各维查询异常
  var queryNames = ['identity', 'stage', 'behavior', 'conversation'];
  for (var i = 0; i < results.length; i++) {
    if (results[i].status === 'rejected') {
      console.warn('[profile-builder] ' + queryNames[i] + ' query rejected:', results[i].reason && results[i].reason.message);
    }
  }

  // 判定是否有有效数据
  profile.hasData = !!(
    profile.identity ||
    profile.stage ||
    profile.behavior ||
    profile.conversation
  );

  // 写入缓存
  setCachedProfile(openid, profile);

  return profile;
}

module.exports = { buildProfile };
