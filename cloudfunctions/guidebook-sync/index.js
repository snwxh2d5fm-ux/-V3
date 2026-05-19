/**
 * guidebook-sync — 攻略书进度云端同步
 *
 * 数据模型: users.guidebookProgress = {
 *   phases: { "0": { unlocked:true, completed:true, completedAt:"..." }, ... },
 *   tasks:  { "onboard-101": { status:"completed", completedAt:"..." }, ... },
 *   renewalDossier: { address:{ items:[], completeness:0.5 }, ... },
 *   currentPhase: 2,
 *   updatedAt: "ISO8601"
 * }
 *
 * 冲突策略: 混合合并
 *   - 主结构(phases/tasks/flags/currentPhase): 文档级 timestamp 比对覆盖
 *   - renewalDossier.items: 字段级按 taskId 去重合并 (不同设备收集的材料不覆盖)
 *
 * 同步触发:
 *   - saveProgress: onboarding-storage.js saveProgress → 异步调用
 *   - getProgress:  guidebooks/index onShow → 拉取云端副本
 */
const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { action, progress } = event;
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { code: 401, msg: '未登录' };

  try {
    switch (action) {
      case 'saveProgress': return await saveProgress(OPENID, progress);
      case 'getProgress':  return await getProgress(OPENID);
      default:             return { code: 400, msg: '无效操作' };
    }
  } catch (e) {
    console.error('[guidebook-sync]', e);
    return { code: 500, msg: '同步服务异常', error: e.message };
  }
};

async function saveProgress(openid, progress) {
  if (!progress || !progress.updatedAt) {
    return { code: 400, msg: '缺少 progress 或 updatedAt' };
  }

  const userRes = await db.collection('users')
    .where({ _openid: openid })
    .field({ guidebookProgress: true })
    .get();

  if (userRes.data.length === 0) return { code: 404, msg: '用户不存在' };

  const cloudProgress = userRes.data[0].guidebookProgress || null;
  const merged = resolveConflict(cloudProgress, progress);

  await db.collection('users')
    .where({ _openid: openid })
    .update({
      data: {
        guidebookProgress: merged,
        updatedAt: db.serverDate()
      }
    });

  return {
    code: 0,
    data: { syncedAt: merged.updatedAt, strategyUsed: merged._conflictStrategy || 'push' }
  };
}

async function getProgress(openid) {
  const userRes = await db.collection('users')
    .where({ _openid: openid })
    .field({ guidebookProgress: true })
    .get();

  if (userRes.data.length === 0) return { code: 404, msg: '用户不存在' };

  const cloudProgress = userRes.data[0].guidebookProgress || null;

  return {
    code: 0,
    data: {
      progress: cloudProgress,
      serverUpdatedAt: cloudProgress ? cloudProgress.updatedAt : null,
      exists: !!cloudProgress
    }
  };
}

/**
 * 冲突消解引擎
 *
 * 场景A: 云端无数据 → 本地推送到云端 (push)
 * 场景B: 本地无数据 → 云端拉取 (pull)
 * 场景C: 两端都有，本地更新 → timestamp 比对取新 (local_wins / cloud_wins)
 * 场景D: timestamp 相同 → 逐字段比对，取合并结果
 *
 * renewalDossier.items 采用字段级合并 (按 taskId 去重)
 */
function resolveConflict(cloudProgress, localProgress) {
  // 场景A: 云端无数据
  if (!cloudProgress) {
    localProgress._conflictStrategy = 'push';
    return sanitizeProgress(localProgress);
  }

  // 场景B: 本地无数据 (由调用方处理，此处不会进入)
  if (!localProgress) {
    return cloudProgress;
  }

  const cloudTime = new Date(cloudProgress.updatedAt || 0).getTime();
  const localTime = new Date(localProgress.updatedAt || 0).getTime();

  let winner;

  // 场景C: timestamp 比对
  if (localTime > cloudTime) {
    winner = deepClone(localProgress);
    winner._conflictStrategy = 'local_wins';
  } else if (cloudTime > localTime) {
    winner = deepClone(cloudProgress);
    winner._conflictStrategy = 'cloud_wins';
  } else {
    // 场景D: timestamp 相同 — 逐字段比对
    winner = deepClone(cloudProgress);
    winner._conflictStrategy = 'merged';

    // 逐字段合并任务 — 取 completed === true 的并集
    if (localProgress.tasks && winner.tasks) {
      const localTasks = localProgress.tasks;
      const cloudTasks = winner.tasks;
      for (const taskId of Object.keys(localTasks)) {
        if (!cloudTasks[taskId]) {
          cloudTasks[taskId] = localTasks[taskId];
        } else if (localTasks[taskId].completedAt && cloudTasks[taskId].completedAt) {
          // 保留较晚完成的
          if (new Date(localTasks[taskId].completedAt).getTime() >
              new Date(cloudTasks[taskId].completedAt).getTime()) {
            cloudTasks[taskId] = localTasks[taskId];
          }
        }
      }
    }

    // 合并关卡 completed
    if (localProgress.phases && winner.phases) {
      const localPhases = localProgress.phases;
      const cloudPhases = winner.phases;
      for (const key of Object.keys(localPhases)) {
        if (localPhases[key] && localPhases[key].completed && cloudPhases[key]) {
          cloudPhases[key].completed = true;
          cloudPhases[key].completedAt = cloudPhases[key].completedAt || localPhases[key].completedAt;
        }
      }
    }
  }

  // ★ 关键: renewalDossier.items 字段级按 taskId 去重合并
  if (localProgress.renewalDossier && winner.renewalDossier) {
    const categories = ['address', 'employment', 'family', 'visa'];
    for (const cat of categories) {
      if (!localProgress.renewalDossier[cat] || !winner.renewalDossier[cat]) continue;
      const localItems = localProgress.renewalDossier[cat].items || [];
      const winnerItems = winner.renewalDossier[cat].items || [];
      const mergedItems = [];
      const seenTaskIds = {};

      for (const item of [...localItems, ...winnerItems]) {
        if (!item.taskId) continue;
        if (!seenTaskIds[item.taskId]) {
          seenTaskIds[item.taskId] = true;
          mergedItems.push(item);
        }
      }
      winner.renewalDossier[cat].items = mergedItems;
      winner.renewalDossier[cat].completeness = Math.min(mergedItems.length / 4, 1.0);
    }
  }

  return sanitizeProgress(winner);
}

/** 脱敏: 移除本地路径，仅保留任务状态和材料类型 */
function sanitizeProgress(progress) {
  if (!progress) return progress;
  if (progress.tasks) {
    for (const key of Object.keys(progress.tasks)) {
      const task = progress.tasks[key];
      if (task && task.imagePath) {
        delete task.imagePath;
      }
    }
  }
  if (progress.renewalDossier) {
    for (const cat of ['address', 'employment', 'family', 'visa']) {
      if (progress.renewalDossier[cat] && progress.renewalDossier[cat].items) {
        for (const item of progress.renewalDossier[cat].items) {
          if (item.imagePath) delete item.imagePath;
        }
      }
    }
  }
  return progress;
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}
