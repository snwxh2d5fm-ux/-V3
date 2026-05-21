/**
 * @fileoverview 住港伴 — 数据恢复引擎 (V4.2 紧急抢救)
 * 2026-05-23: 5.22存储升级导致部分用户 __processes__ / __reminders__ 被清空
 * 恢复策略：本地备份 → CloudBase云端 → 降级引导
 */

const {
  PROCESS_KEY, REMINDER_KEY, META_KEY,
  saveProcessLines, saveReminders, saveDocuments,
  getAllProcessLines, getAllReminders, getAllDocuments
} = require('./storage');

/** @const {string} 坏数据备份键后缀 */
const CORRUPTED_SUFFIX = '__corrupted__';

/**
 * 尝试从本地备份恢复数据
 * 扫描所有 __*__corrupted__{timestamp} 键，取最新的备份数据
 * @returns {{ processes: Array|null, reminders: Array|null, vaultMeta: object|null }}
 */
function restoreFromLocalBackup() {
  const result = { processes: null, reminders: null, vaultMeta: null };
  try {
    const { keys } = wx.getStorageInfoSync();
    const corruptedKeys = keys.filter(k => k.includes(CORRUPTED_SUFFIX));

    for (const key of corruptedKeys) {
      try {
        const val = wx.getStorageSync(key);
        if (!val) continue;

        if (key.startsWith(PROCESS_KEY + CORRUPTED_SUFFIX) && Array.isArray(val) && val.length > 0) {
          if (!result.processes || key > (PROCESS_KEY + CORRUPTED_SUFFIX)) {
            result.processes = val;
          }
        } else if (key.startsWith(REMINDER_KEY + CORRUPTED_SUFFIX) && Array.isArray(val) && val.length > 0) {
          if (!result.reminders) {
            result.reminders = val;
          }
        } else if (key.startsWith(META_KEY + CORRUPTED_SUFFIX) && val && val.documents) {
          if (!result.vaultMeta) {
            result.vaultMeta = val;
          }
        }
      } catch (e) {
        console.warn('[recovery] 备份键读取失败:', key, e.message);
      }
    }

    return result;
  } catch (e) {
    return result;
  }
}

/**
 * 从CloudBase云端拉取用户全量数据
 * 调用 db-admin pullAll → 写入本地storage
 * @returns {Promise<{success: boolean, recovered: {processes: number, reminders: number, documents: number}, error?: string}>}
 */
async function pullFromCloud() {
  const recovered = { processes: 0, reminders: 0, documents: 0 };

  try {
    const res = await wx.cloud.callFunction({
      name: 'db-admin',
      data: { action: 'pullAll' },
    });

    if (!res.result || res.result.code !== 200) {
      return { success: false, recovered, error: '云端数据拉取失败: ' + (res.result?.msg || 'unknown') };
    }

    const { documents, reminders, processes } = res.result.data;

    // V4.2-fix: Schema guard — 验证云端数据格式再写入（CRIT-01）
    const PROCESS_REQUIRED = ['id', 'name', 'templateId', 'status', 'stages'];

    // 恢复证件夹
    if (documents && Array.isArray(documents) && documents.length > 0) {
      try {
        saveDocuments(documents);
        recovered.documents = documents.length;
      } catch (e) {
        console.error('[recovery] 证件夹恢复失败:', e.message);
      }
    }

    // 恢复提醒
    if (reminders && Array.isArray(reminders) && reminders.length > 0) {
      try {
        saveReminders(reminders);
        recovered.reminders = reminders.length;
      } catch (e) {
        console.error('[recovery] 提醒恢复失败:', e.message);
      }
    }

    // 恢复流程线（含 schema 校验）
    if (processes && Array.isArray(processes) && processes.length > 0) {
      const validProcesses = processes.filter(p => {
        if (!p || typeof p !== 'object') return false;
        return PROCESS_REQUIRED.every(f => p[f] !== undefined);
      });
      if (validProcesses.length === 0) {
        console.warn('[recovery] 云端流程数据全部未通过schema校验，跳过恢复');
      } else {
        try {
          saveProcessLines(validProcesses);
          recovered.processes = validProcesses.length;
      } catch (e) {
        console.error('[recovery] 流程线恢复失败:', e.message);
      }
    }

    return { success: true, recovered };
  } catch (e) {
    return { success: false, recovered, error: e.message || '网络异常' };
  }
}

/**
 * 从CloudBase users集合恢复用户身份状态
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
async function pullUserProfile() {
  try {
    const res = await wx.cloud.callFunction({
      name: 'user-auth',
      data: { action: 'getProfile' },
    });

    if (!res.result || res.result.code !== 0) {
      return { success: false, error: '获取用户资料失败' };
    }

    const profile = res.result.userInfo || res.result.data || res.result.user || {};
    return {
      success: true,
      data: {
        userStatus: profile.currentPhase || profile.userStatus || 'unapplied',
        userSubStatus: profile.subStatus || profile.userSubStatus || null,
        selectedPath: profile.selectedPath || null,
        activeProcessId: profile.activeProcessId || null,
        membershipLevel: profile.membershipLevel || 'free',
      },
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * 检测当前是否处于"数据被清空但用户非新用户"状态
 * 判断标准：
 * 1. __cloud_user__ 存在且 isNew !== true（回访用户）
 * 2. __processes__ 和 __reminders__ 均为空数组（刚被wipe）
 * @returns {boolean}
 */
function detectDataLoss() {
  try {
    const cloudUser = wx.getStorageSync('__cloud_user__');
    if (!cloudUser || cloudUser.isNew === true) return false;

    const processes = getAllProcessLines();
    const reminders = getAllReminders();

    // 如果流程和提醒均为空 → 极可能是被wipe了
    return (!processes || processes.length === 0) && (!reminders || reminders.length === 0);
  } catch (e) {
    return false;
  }
}

/**
 * 主恢复入口：app.js onLaunch 中调用
 * 策略：本地备份 → 云端拉取 → 静默恢复
 * @param {object} app - App实例
 * @returns {Promise<{recovered: boolean, source: string, details: object}>}
 */
async function recoverUserData(app) {
  const details = { local: 0, cloud: 0, profile: false };
  let recovered = false;
  let source = 'none';

  // 第一步：检测是否需要恢复
  if (!detectDataLoss()) {
    return { recovered: false, source, details };
  }

  console.debug('[recovery] 检测到数据损失，开始恢复...');

  // 第二步：优先从本地备份恢复（最快，不消耗网络）
  const localBackup = restoreFromLocalBackup();
  if (localBackup.processes && localBackup.processes.length > 0) {
    saveProcessLines(localBackup.processes);
    details.local += localBackup.processes.length;
    recovered = true;
    source = 'local_backup';
    console.debug(`[recovery] 本地备份恢复: ${localBackup.processes.length} 条流程`);
  }
  if (localBackup.reminders && localBackup.reminders.length > 0) {
    saveReminders(localBackup.reminders);
    details.local += localBackup.reminders.length;
    source = 'local_backup';
    console.debug(`[recovery] 本地备份恢复: ${localBackup.reminders.length} 条提醒`);
  }
  if (localBackup.vaultMeta && localBackup.vaultMeta.documents) {
    const docCount = Object.keys(localBackup.vaultMeta.documents).length;
    if (docCount > 0) {
      wx.setStorageSync(META_KEY, localBackup.vaultMeta);
      details.local += docCount;
      source = 'local_backup';
      console.debug(`[recovery] 本地备份恢复: ${docCount} 份证件`);
    }
  }

  // 第三步：如果本地备份不足，从CloudBase补充
  if (app.globalData.cloudReady && app.globalData.isLoggedIn) {
    try {
      const cloudResult = await pullFromCloud();
      if (cloudResult.success) {
        details.cloud = cloudResult.recovered.processes + cloudResult.recovered.reminders + cloudResult.recovered.documents;
        if (details.cloud > 0 && !recovered) {
          recovered = true;
          source = 'cloud';
        } else if (details.cloud > 0) {
          source = 'local_backup+cloud';
        }
      }

      // 第四步：恢复身份状态
      const profileResult = await pullUserProfile();
      if (profileResult.success && profileResult.data) {
        const p = profileResult.data;
        // 写入storage
        if (p.userStatus) wx.setStorageSync('__user_status__', p.userStatus);
        if (p.userSubStatus) wx.setStorageSync('__user_sub_status__', p.userSubStatus);
        if (p.selectedPath) wx.setStorageSync('__selected_path__', p.selectedPath);
        if (p.activeProcessId) wx.setStorageSync('__active_process_id__', p.activeProcessId);
        // 更新globalData
        app.globalData.userStatus = p.userStatus;
        app.globalData.userSubStatus = p.userSubStatus;
        app.globalData.selectedPath = p.selectedPath;
        app.globalData.activeProcessId = p.activeProcessId;
        app.globalData.membershipLevel = p.membershipLevel;
        details.profile = true;
      }
    } catch (e) {
      console.warn('[recovery] CloudBase恢复遇错:', e.message);
    }
  }

  if (recovered) {
    // 写入恢复标记，供前端展示
    wx.setStorageSync('__recovery_applied__', {
      source,
      at: new Date().toISOString(),
      details,
    });
    console.debug(`[recovery] 数据恢复完成: source=${source} local=${details.local} cloud=${details.cloud}`);
  }

  return { recovered, source, details };
}

module.exports = {
  restoreFromLocalBackup,
  pullFromCloud,
  pullUserProfile,
  detectDataLoss,
  recoverUserData,
};
