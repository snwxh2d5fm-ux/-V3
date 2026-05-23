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
    // 直接查询 CloudBase 数据库，绕开 db-admin 的缓存问题
    const db = wx.cloud.database();
    const [docsRes, remindersRes, processesRes] = await Promise.all([
      db.collection('user_documents').where({ _openid: '{openid}' }).get().catch(() => ({ data: [] })),
      db.collection('reminders').where({ _openid: '{openid}' }).get().catch(() => ({ data: [] })),
      db.collection('user_processes').where({ _openid: '{openid}' }).get().catch(() => ({ data: [] })),
    ]);

    const documents = docsRes.data || [];
    const reminders = remindersRes.data || [];
    const processes = processesRes.data || [];

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

    // 恢复流程线（CloudBase可信源，不做schema校验阻塞恢复）
    if (processes && Array.isArray(processes) && processes.length > 0) {
      try {
        saveProcessLines(processes);
        recovered.processes = processes.length;
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
 *
 * 三层检测策略（避免 __cloud_user__ 被 wipe 时的盲区）：
 * 1. 有本地 __*__corrupted__ 备份键 → 明确的数据迁移痕迹
 * 2. __cloud_user__ 存在且 isNew !== true → 回访用户标记
 * 3. 已登录（有有效session）→ 必定是回访用户
 *
 * @param {object} app - App实例
 * @returns {boolean}
 */
function detectDataLoss(app) {
  try {
    const processes = getAllProcessLines();
    const reminders = getAllReminders();

    // 数据非空 → 无需恢复
    if ((processes && processes.length > 0) || (reminders && reminders.length > 0)) {
      return false;
    }

    // 策略1: 有本地备份键 → 明确发生过数据迁移
    try {
      const { keys } = wx.getStorageInfoSync();
      const hasBackup = keys.some(k => k.includes('__corrupted__'));
      if (hasBackup) return true;
    } catch (e) { /* getStorageInfoSync 失败不阻塞 */ }

    // 策略2: __cloud_user__ 标记为回访用户
    try {
      const cloudUser = wx.getStorageSync('__cloud_user__');
      if (cloudUser && cloudUser.isNew !== true) return true;
    } catch (e) { /* 读 storage 失败不阻塞 */ }

    // 策略3: 当前已登录 → 必定非新用户
    if (app && app.globalData && app.globalData.isLoggedIn) return true;

    return false;
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

  if (!detectDataLoss(app)) return { recovered: false, source, details };

  console.warn('[recovery] 检测到数据损失，开始恢复...');
  wx.showLoading({ title: '恢复数据中...' });

  // 本地备份
  const localBackup = restoreFromLocalBackup();
  if (localBackup.processes && localBackup.processes.length > 0) {
    saveProcessLines(localBackup.processes);
    details.local += localBackup.processes.length;
    recovered = true;
    source = 'local_backup';
  }
  if (localBackup.reminders && localBackup.reminders.length > 0) {
    saveReminders(localBackup.reminders);
    details.local += localBackup.reminders.length;
    source = 'local_backup';
  }
  if (localBackup.vaultMeta?.documents) {
    const docCount = Object.keys(localBackup.vaultMeta.documents).length;
    if (docCount > 0) { wx.setStorageSync(META_KEY, localBackup.vaultMeta); details.local += docCount; source = 'local_backup'; }
  }

  // CloudBase
  if (app.globalData.cloudReady && app.globalData.isLoggedIn) {
    try {
      const cloudResult = await pullFromCloud();
      console.warn('[recovery] pullFromCloud:', JSON.stringify({success:cloudResult.success,recovered:cloudResult.recovered}));
      if (cloudResult.success) {
        details.cloud = cloudResult.recovered.processes + cloudResult.recovered.reminders + cloudResult.recovered.documents;
        if (details.cloud > 0) { recovered = true; source = source === 'local_backup' ? 'local_backup+cloud' : 'cloud'; }
      }

      const profileResult = await pullUserProfile();
      console.warn('[recovery] pullUserProfile:', JSON.stringify({success:profileResult.success,hasData:!!profileResult.data}));
      if (profileResult.success && profileResult.data) {
        const p = profileResult.data;
        if (p.userStatus) wx.setStorageSync('__user_status__', p.userStatus);
        if (p.userSubStatus) wx.setStorageSync('__user_sub_status__', p.userSubStatus);
        if (p.selectedPath) wx.setStorageSync('__selected_path__', p.selectedPath);
        if (p.activeProcessId) wx.setStorageSync('__active_process_id__', p.activeProcessId);
        Object.assign(app.globalData, {
          userStatus: p.userStatus, userSubStatus: p.userSubStatus,
          selectedPath: p.selectedPath, activeProcessId: p.activeProcessId,
          membershipLevel: p.membershipLevel,
        });
        details.profile = true;
        recovered = true;
      }
    } catch (e) {
      console.error('[recovery] CloudBase恢复异常:', e.message);
    }
  }

  wx.hideLoading();
  if (recovered) {
    wx.setStorageSync('__recovery_applied__', { source, at: new Date().toISOString(), details });
    wx.showToast({ title: `已恢复${details.local + details.cloud}条数据`, icon: 'success', duration: 2000 });
  }

  console.warn('[recovery] 完成: recovered=' + recovered + ' source=' + source + ' local=' + details.local + ' cloud=' + details.cloud + ' profile=' + details.profile);
  return { recovered, source, details };
}

module.exports = {
  restoreFromLocalBackup,
  pullFromCloud,
  pullUserProfile,
  detectDataLoss,
  recoverUserData,
};
