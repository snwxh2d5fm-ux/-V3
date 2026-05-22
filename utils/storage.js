/**
 * @fileoverview 住港伴 — 本地存储引擎
 * 基于微信小程序本地文件系统和 Storage API
 * 所有用户原始材料存储在设备本地，不上传服务端
 *
 * V4.1: 增加存储版本管理 + Schema校验降级 + 备份容灾 (2026-05-22)
 */

/** @const {string} 证件文件存储根目录 */
const FILE_BASE = wx.env.USER_DATA_PATH + '/vault/';
/** @const {string} 证件元数据storage key */
const META_KEY = '__vault_meta__';
/** @const {string} 提醒数据storage key */
const REMINDER_KEY = '__reminders__';
/** @const {string} 流程数据storage key */
const PROCESS_KEY = '__processes__';
/** @const {string} 用户数据storage key */
const USER_KEY = '__user_data__';
/** @const {string} 配置storage key */
const CONFIG_KEY = '__config__';

// ============================================================
// 存储版本管理 (V4.1 — 2026-05-22)
// ============================================================
/** @const {number} 当前写入格式版本 */
const STORAGE_VERSION = 2;
/** @const {number} 最低可读格式版本（低于此版本 → 备份后重置） */
const MIN_READABLE_VERSION = 1;
/** @const {string} 存储版本号 key */
const VERSION_KEY = '__storage_version__';
/** @const {string} 存储健康状态 key */
const HEALTH_KEY = '__storage_health__';
/** @const {string} 坏数据备份键后缀 */
const CORRUPTED_SUFFIX = '__corrupted__';
/** @const {Array<string>} 流程线必需字段（缺一视为坏数据） */
const PROCESS_REQUIRED_FIELDS = ['id', 'name', 'templateId', 'status', 'stages'];

/**
 * 获取存储版本号
 * @returns {number}
 */
function getStorageVersion() {
  return wx.getStorageSync(VERSION_KEY) || 1;
}

/**
 * 写入存储版本号
 * @param {number} v
 */
function setStorageVersion(v) {
  wx.setStorageSync(VERSION_KEY, v);
}

/**
 * 备份指定 storage key 到带时间戳的副本
 * @param {string} key
 */
function _backupKey(key) {
  try {
    const val = wx.getStorageSync(key);
    if (val !== undefined && val !== null && val !== '') {
      wx.setStorageSync(key + CORRUPTED_SUFFIX + Date.now(), val);
    }
  } catch (e) {
    /* 备份失败不阻塞主流程 */
  }
}

/**
 * 上报存储健康状态
 * @param {string} event
 * @param {object} detail
 */
function _reportHealth(event, detail) {
  try {
    const health = wx.getStorageSync(HEALTH_KEY) || {};
    health[event] = { at: new Date().toISOString(), detail: detail || {} };
    wx.setStorageSync(HEALTH_KEY, health);
  } catch (e) {
    /* 健康上报失败不阻塞启动流程 */
  }
}

// ============================================================
// Schema 校验与数据修复
// ============================================================
// ============================================================

/**
 * 校验单条流程线结构完整性
 * @param {*} line
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateProcessLine(line) {
  if (!line || typeof line !== 'object') return { valid: false, reason: 'not_object' };
  for (let i = 0; i < PROCESS_REQUIRED_FIELDS.length; i++) {
    const f = PROCESS_REQUIRED_FIELDS[i];
    if (line[f] === undefined || line[f] === null) return { valid: false, reason: 'missing_' + f };
  }
  if (!Array.isArray(line.stages)) return { valid: false, reason: 'stages_not_array' };
  if (line.stages.length === 0) return { valid: false, reason: 'stages_empty' };
  return { valid: true };
}

/**
 * 启动时校验全部流程线，坏数据重命名备份后移除
 * 确保坏数据不阻塞正常流程（P0-2 修复）
 * @returns {{ repaired: boolean, corrupted: number, kept: number }}
 */
function validateAndRepairProcesses() {
  const raw = wx.getStorageSync(PROCESS_KEY);
  // null/undefined → 首次启动，无数据，正常
  if (raw === null || raw === undefined) {
    return { repaired: false, corrupted: 0, kept: 0 };
  }
  // 空字符串 / 非数组 → 整键损坏 → 备份后清空
  if (raw === '' || !Array.isArray(raw)) {
    _backupKey(PROCESS_KEY);
    wx.setStorageSync(PROCESS_KEY, []);
    _reportHealth('processes_key_corrupted', {});
    return { repaired: true, corrupted: -1, kept: 0 };
  }

  const lines = raw;
  const validLines = [];
  let corruptedCount = 0;
  for (let i = 0; i < lines.length; i++) {
    const result = validateProcessLine(lines[i]);
    if (result.valid) {
      validLines.push(lines[i]);
    } else {
      const backupKey = PROCESS_KEY + CORRUPTED_SUFFIX + Date.now() + '_' + i;
      try {
        wx.setStorageSync(backupKey, lines[i]);
      } catch (e) {
        /* 备份失败不阻塞修复流程 */
      }
      corruptedCount++;
      console.warn('[storage] 检测到损坏流程线(' + result.reason + ')，已自动修复并备份');
    }
  }

  if (corruptedCount > 0) {
    wx.setStorageSync(PROCESS_KEY, validLines);
    _reportHealth('processes_repaired', { corrupted: corruptedCount, kept: validLines.length });
    return { repaired: true, corrupted: corruptedCount, kept: validLines.length };
  }

  return { repaired: false, corrupted: 0, kept: validLines.length };
}

/**
 * 校验提醒数据结构
 * @returns {{ repaired: boolean, corrupted: number }}
 */
function validateAndRepairReminders() {
  const reminders = wx.getStorageSync(REMINDER_KEY) || [];
  if (!Array.isArray(reminders)) {
    _backupKey(REMINDER_KEY);
    wx.setStorageSync(REMINDER_KEY, []);
    _reportHealth('reminders_key_corrupted', {});
    return { repaired: true, corrupted: -1 };
  }
  return { repaired: false, corrupted: 0 };
}

// ============================================================
// 版本迁移与启动完整性校验
// ============================================================

/**
 * 启动时执行存储版本迁移链
 * - 版本过低 → 备份后重置
 * - 版本在可读范围内但不等于当前 → 执行迁移
 * - 版本高于当前 → 标记 _future_data，保留原样不删除
 */
function ensureStorageVersion() {
  const v = getStorageVersion();

  if (v < MIN_READABLE_VERSION) {
    // 过于陈旧的格式 → 备份后重置
    _backupKey(PROCESS_KEY);
    _backupKey(REMINDER_KEY);
    wx.setStorageSync(PROCESS_KEY, []);
    wx.setStorageSync(REMINDER_KEY, []);
    setStorageVersion(STORAGE_VERSION);
    _reportHealth('storage_reset_old_version', { from: v, to: STORAGE_VERSION });
    return;
  }

  if (v < STORAGE_VERSION) {
    // 逐步迁移（未来可扩展具体迁移逻辑）
    setStorageVersion(STORAGE_VERSION);
    wx.setStorageSync('__last_migration__', { from: v, to: STORAGE_VERSION, at: new Date().toISOString() });
    return;
  }

  if (v > STORAGE_VERSION) {
    // 未来格式 → 保留原样，标记风险
    const health = wx.getStorageSync(HEALTH_KEY) || {};
    health._future_data = true;
    health._future_version = v;
    wx.setStorageSync(HEALTH_KEY, health);
    console.warn('[storage] 检测到未来版本格式，数据已保留未删除');
    return;
  }

  // 版本一致，无需操作
}

/**
 * 启动完整性校验入口（供 app.js onLaunch 调用）
 * 执行顺序：版本迁移 → 数据校验修复
 * @returns {{ version: number, processes: {repaired:boolean,corrupted:number,kept:number}, reminders: {repaired:boolean,corrupted:number} }}
 */
function runStorageStartupCheck() {
  ensureStorageVersion();
  const pResult = validateAndRepairProcesses();
  const rResult = validateAndRepairReminders();
  setStorageVersion(STORAGE_VERSION);
  return {
    version: STORAGE_VERSION,
    processes: pResult,
    reminders: rResult,
  };
}

/**
 * 初始化存储目录结构和元数据
 * @returns {Promise<boolean>}
 */
function initStorage() {
  return new Promise(function (resolve) {
    try {
      const fs = wx.getFileSystemManager();
      try {
        fs.accessSync(FILE_BASE);
      } catch (e) {
        fs.mkdirSync(FILE_BASE, true);
      }
      const dirs = ['identities', 'education', 'employment', 'assets', 'visas', 'renewal', 'family', 'custom'];
      dirs.forEach(function (dir) {
        try {
          fs.accessSync(FILE_BASE + dir);
        } catch (e) {
          fs.mkdirSync(FILE_BASE + dir, true);
        }
      });
      if (!wx.getStorageSync(META_KEY)) wx.setStorageSync(META_KEY, { documents: {}, version: 1 });
      if (!wx.getStorageSync(REMINDER_KEY)) wx.setStorageSync(REMINDER_KEY, []);
      if (!wx.getStorageSync(PROCESS_KEY)) wx.setStorageSync(PROCESS_KEY, []);
      resolve(true);
    } catch (e) {
      console.error('[storage] initVault 失败:', e);
      resolve(false);
    }
  });
}

/** @param {object} doc @returns {object} */
function saveDocumentMeta(doc) {
  const meta = wx.getStorageSync(META_KEY) || { documents: {}, version: 1 };
  meta.documents[doc.id] = Object.assign({}, meta.documents[doc.id] || {}, doc, {
    updatedAt: new Date().toISOString(),
  });
  if (!doc.createdAt) meta.documents[doc.id].createdAt = new Date().toISOString();
  meta.version = (meta.version || 0) + 1;
  wx.setStorageSync(META_KEY, meta);
  return doc;
}

/** @param {string} docId @returns {object|null} */
function getDocumentMeta(docId) {
  const meta = wx.getStorageSync(META_KEY);
  return meta && meta.documents && meta.documents[docId] ? meta.documents[docId] : null;
}

/** @returns {Array<object>} */
function getAllDocuments() {
  const meta = wx.getStorageSync(META_KEY);
  if (!meta || !meta.documents) return [];
  return Object.keys(meta.documents).map(function (k) {
    return meta.documents[k];
  });
}

/** @param {string} type @returns {Array<object>} */
function getDocumentsByType(type) {
  return getAllDocuments().filter(function (d) {
    return d.category === type || d.type === type;
  });
}

/** @param {string} tempPath @param {string} docId @param {string} category @returns {string} */
function saveFile(tempPath, docId, category) {
  const fs = wx.getFileSystemManager();
  const ext = (tempPath.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi, '');
  const dir = FILE_BASE + (category || 'custom') + '/';
  try {
    fs.accessSync(dir);
  } catch (e) {
    fs.mkdirSync(dir, true);
  }
  const persistPath = dir + docId + '.' + ext;
  try {
    fs.copyFileSync(tempPath, persistPath);
  } catch (ce) {
    const data = fs.readFileSync(tempPath);
    fs.writeFileSync(persistPath, data, 'binary');
  }
  return persistPath;
}

/** @param {string} filePath @returns {string} */
function readFile(filePath) {
  try {
    const fs = wx.getFileSystemManager();
    const data = fs.readFileSync(filePath, 'base64');
    const ext = (filePath.split('.').pop() || 'jpeg').toLowerCase();
    const mimeMap = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      pdf: 'application/pdf',
    };
    const mime = mimeMap[ext] || 'image/jpeg';
    return 'data:' + mime + ';base64,' + data;
  } catch (e) {
    return '';
  }
}

/** @param {string} docId @returns {boolean} */
function deleteDocument(docId) {
  const doc = getDocumentMeta(docId);
  if (!doc) return false;
  if (doc.filePath) {
    try {
      const fs = wx.getFileSystemManager();
      fs.unlinkSync(doc.filePath);
    } catch (e) {
      console.warn('[storage] deleteDocument 文件删除失败:', e.message);
    }
  }
  const meta = wx.getStorageSync(META_KEY);
  if (meta && meta.documents) {
    delete meta.documents[docId];
    wx.setStorageSync(META_KEY, meta);
  }
  return true;
}

/** @param {string} query @returns {Array<object>} */
function searchDocuments(query) {
  const q = query.toLowerCase();
  return getAllDocuments().filter(function (d) {
    return (
      (d.name && d.name.toLowerCase().indexOf(q) >= 0) ||
      (d.category && d.category.indexOf(q) >= 0) ||
      (d.docNumber && d.docNumber.indexOf(q) >= 0)
    );
  });
}

/** @param {object} reminder @returns {object} */
function saveReminder(reminder) {
  const reminders = getAllReminders();
  if (!reminder.id) reminder.id = 'rem_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const idx = reminders.findIndex(function (r) {
    return r.id === reminder.id;
  });
  if (idx >= 0) reminders[idx] = Object.assign({}, reminders[idx], reminder, { updatedAt: new Date().toISOString() });
  else
    reminders.push(
      Object.assign({}, reminder, { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }),
    );
  wx.setStorageSync(REMINDER_KEY, reminders);
  return reminder;
}

/** @returns {Array<object>} */
function getAllReminders() {
  return wx.getStorageSync(REMINDER_KEY) || [];
}

/** @param {string} reminderId @param {object} updates @returns {object|null} */
function updateReminder(reminderId, updates) {
  const reminders = getAllReminders();
  const idx = reminders.findIndex(function (r) {
    return r.id === reminderId;
  });
  if (idx < 0) return null;
  reminders[idx] = Object.assign({}, reminders[idx], updates, { updatedAt: new Date().toISOString() });
  wx.setStorageSync(REMINDER_KEY, reminders);
  return reminders[idx];
}

/** @param {string} reminderId @returns {boolean} */
function deleteReminder(reminderId) {
  const reminders = getAllReminders();
  const filtered = reminders.filter(function (r) {
    return r.id !== reminderId;
  });
  wx.setStorageSync(REMINDER_KEY, filtered);
  return true;
}

/**
 * 封存指定路径的所有活跃提醒
 * @param {string} pathId
 */
function archiveRemindersByPath(pathId) {
  if (!pathId) return;
  try {
    const reminders = getAllReminders();
    let hasChange = false;
    const updated = reminders.map(function (r) {
      if (r.path === pathId && r.status === 'active') {
        hasChange = true;
        return Object.assign({}, r, { status: 'archived', archivedAt: new Date().toISOString() });
      }
      return r;
    });
    if (hasChange) {
      wx.setStorageSync(REMINDER_KEY, updated);
    }
  } catch (e) {
    console.warn('[storage] archiveRemindersByPath error:', e);
  }
}

/**
 * 恢复指定路径的所有被封存提醒
 * @param {string} pathId
 */
function unarchiveRemindersByPath(pathId) {
  if (!pathId) return;
  try {
    const reminders = getAllReminders();
    let hasChange = false;
    const updated = reminders.map(function (r) {
      if (r.path === pathId && r.status === 'archived') {
        hasChange = true;
        return Object.assign({}, r, { status: 'active', unarchivedAt: new Date().toISOString() });
      }
      return r;
    });
    if (hasChange) {
      wx.setStorageSync(REMINDER_KEY, updated);
    }
  } catch (e) {
    console.warn('[storage] unarchiveRemindersByPath error:', e);
  }
}

/** @param {object} processLine @returns {object} */
function saveProcessLine(processLine) {
  const lines = getAllProcessLines();
  if (!processLine.id) processLine.id = 'proc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const idx = lines.findIndex(function (l) {
    return l.id === processLine.id;
  });
  if (idx >= 0) lines[idx] = Object.assign({}, lines[idx], processLine, { updatedAt: new Date().toISOString() });
  else
    lines.push(
      Object.assign({}, processLine, { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }),
    );
  wx.setStorageSync(PROCESS_KEY, lines);
  return processLine;
}

/** @param {string} processId @returns {object|null} */
function getProcessLine(processId) {
  return (
    getAllProcessLines().find(function (l) {
      return l.id === processId;
    }) || null
  );
}

/** @returns {Array<object>} */
function getAllProcessLines() {
  return wx.getStorageSync(PROCESS_KEY) || [];
}

/** @param {Array<object>} processLines */
function saveProcessLines(processLines) {
  wx.setStorageSync(PROCESS_KEY, processLines);
}

/** @param {string} key @returns {*} */
function getConfig(key) {
  const c = wx.getStorageSync(CONFIG_KEY) || {};
  return c[key];
}

/** @param {string} key @param {*} value */
function setConfig(key, value) {
  const c = wx.getStorageSync(CONFIG_KEY) || {};
  c[key] = value;
  wx.setStorageSync(CONFIG_KEY, c);
}

/** @param {Array<object>} docs */
function saveDocuments(docs) {
  const meta = wx.getStorageSync(META_KEY) || { documents: {}, version: 1 };
  docs.forEach(function (d) {
    meta.documents[d.id] = Object.assign({}, meta.documents[d.id] || {}, d);
  });
  meta.version = (meta.version || 0) + 1;
  wx.setStorageSync(META_KEY, meta);
}

/** @param {Array<object>} reminders */
function saveReminders(reminders) {
  wx.setStorageSync(REMINDER_KEY, reminders);
}

function initDBSync() {
  const s = wx.getStorageSync('__db_sync_state__');
  return s === 'synced' || s === 'syncing';
}

function syncAllToCloud() {
  return new Promise(function (resolve, reject) {
    const app = getApp();
    if (!app || !app.globalData.cloudReady) {
      resolve(false);
      return;
    }
    wx.cloud.callFunction({
      name: 'db-admin',
      data: {
        action: 'sync',
        data: { documents: getAllDocuments(), reminders: getAllReminders(), processes: getAllProcessLines() },
      },
      success: function () {
        wx.setStorageSync('__db_sync_state__', 'synced');
        resolve(true);
      },
      fail: reject,
    });
  });
}

module.exports = {
  initStorage: initStorage,
  saveDocumentMeta: saveDocumentMeta,
  getDocumentMeta: getDocumentMeta,
  getAllDocuments: getAllDocuments,
  getDocumentsByType: getDocumentsByType,
  saveFile: saveFile,
  readFile: readFile,
  deleteDocument: deleteDocument,
  searchDocuments: searchDocuments,
  saveReminder: saveReminder,
  getAllReminders: getAllReminders,
  updateReminder: updateReminder,
  deleteReminder: deleteReminder,
  archiveRemindersByPath: archiveRemindersByPath,
  unarchiveRemindersByPath: unarchiveRemindersByPath,
  saveProcessLine: saveProcessLine,
  getProcessLine: getProcessLine,
  getAllProcessLines: getAllProcessLines,
  saveProcessLines: saveProcessLines,
  getConfig: getConfig,
  setConfig: setConfig,
  saveDocuments: saveDocuments,
  saveReminders: saveReminders,
  initDBSync: initDBSync,
  syncAllToCloud: syncAllToCloud,
  // V4.1 存储版本管理 + Schema 校验降级
  getStorageVersion: getStorageVersion,
  setStorageVersion: setStorageVersion,
  validateProcessLine: validateProcessLine,
  validateAndRepairProcesses: validateAndRepairProcesses,
  validateAndRepairReminders: validateAndRepairReminders,
  ensureStorageVersion: ensureStorageVersion,
  runStorageStartupCheck: runStorageStartupCheck,
  // 常量导出
  STORAGE_VERSION: STORAGE_VERSION,
  MIN_READABLE_VERSION: MIN_READABLE_VERSION,
  VERSION_KEY: VERSION_KEY,
  HEALTH_KEY: HEALTH_KEY,
  CORRUPTED_SUFFIX: CORRUPTED_SUFFIX,
  FILE_BASE: FILE_BASE,
  META_KEY: META_KEY,
  REMINDER_KEY: REMINDER_KEY,
  PROCESS_KEY: PROCESS_KEY,
};
