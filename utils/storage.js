/**
 * 住港伴 — 本地存储引擎
 * 基于微信小程序本地文件系统和 Storage API
 * 所有用户原始材料存储在设备本地，不上传服务端
 */
const FILE_BASE = `${wx.env.USER_DATA_PATH}/vault/`;
const META_KEY = '__vault_meta__';
const REMINDER_KEY = '__reminders__';
const PROCESS_KEY = '__processes__';
const USER_KEY = '__user_data__';
const CONFIG_KEY = '__config__';

// 初始化存储目录
async function initStorage() {
  try {
    const fs = wx.getFileSystemManager();
    try { fs.accessSync(FILE_BASE); } catch (e) { fs.mkdirSync(FILE_BASE, true); }
    // 初始化子目录
    const dirs = ['identities', 'education', 'employment', 'assets', 'visas', 'renewal', 'family', 'custom'];
    dirs.forEach(dir => {
      try { fs.accessSync(FILE_BASE + dir); } catch (e) { fs.mkdirSync(FILE_BASE + dir, true); }
    });
    // 初始化元数据结构
    if (!wx.getStorageSync(META_KEY)) {
      wx.setStorageSync(META_KEY, { documents: {}, version: 1 });
    }
    if (!wx.getStorageSync(REMINDER_KEY)) {
      wx.setStorageSync(REMINDER_KEY, { items: [], version: 1 });
    }
    if (!wx.getStorageSync(PROCESS_KEY)) {
      wx.setStorageSync(PROCESS_KEY, { lines: [], version: 1 });
    }
    console.log('[存储] 初始化完成');
    return true;
  } catch (e) {
    console.error('[存储] 初始化失败:', e);
    return false;
  }
}

// 保存证件元数据
function saveDocumentMeta(doc) {
  const meta = wx.getStorageSync(META_KEY) || { documents: {}, version: 1 };
  meta.documents[doc.id] = doc;
  meta.version = (meta.version || 1) + 1;
  wx.setStorageSync(META_KEY, meta);
}

// 获取证件元数据
function getDocumentMeta(docId) {
  const meta = wx.getStorageSync(META_KEY);
  return meta && meta.documents ? meta.documents[docId] : null;
}

// 获取所有证件
function getAllDocuments() {
  const meta = wx.getStorageSync(META_KEY);
  return meta && meta.documents ? Object.values(meta.documents) : [];
}

// 按类型获取证件
function getDocumentsByType(type) {
  return getAllDocuments().filter(d => d.category === type);
}

// 保存文件到本地
function saveFile(tempPath, docId, category) {
  return new Promise((resolve, reject) => {
    const fs = wx.getFileSystemManager();
    const ext = tempPath.split('.').pop() || 'jpg';
    const targetPath = `${FILE_BASE}${category}/${docId}.${ext}`;
    fs.copyFile({
      srcPath: tempPath,
      destPath: targetPath,
      success: () => resolve(targetPath),
      fail: (err) => reject(err)
    });
  });
}

// 读取文件
function readFile(filePath) {
  return new Promise((resolve, reject) => {
    const fs = wx.getFileSystemManager();
    fs.readFile({
      filePath,
      encoding: 'base64',
      success: (res) => resolve(res.data),
      fail: (err) => reject(err)
    });
  });
}

// 删除证件
function deleteDocument(docId) {
  const meta = wx.getStorageSync(META_KEY);
  if (!meta || !meta.documents[docId]) return false;
  const doc = meta.documents[docId];
  // 删除文件
  try {
    const fs = wx.getFileSystemManager();
    if (doc.filePath) fs.unlinkSync(doc.filePath);
  } catch (e) { /* 文件可能不存在 */ }
  // 删除元数据
  delete meta.documents[docId];
  wx.setStorageSync(META_KEY, meta);
  return true;
}

// 搜索证件
function searchDocuments(query) {
  const docs = getAllDocuments();
  const q = query.toLowerCase();
  return docs.filter(d =>
    (d.name && d.name.toLowerCase().includes(q)) ||
    (d.category && d.category.toLowerCase().includes(q)) ||
    (d.docNumber && d.docNumber.includes(q))
  );
}

// --- 提醒相关 ---
function saveReminder(reminder) {
  const data = wx.getStorageSync(REMINDER_KEY) || { items: [], version: 1 };
  data.items.push(reminder);
  data.version += 1;
  wx.setStorageSync(REMINDER_KEY, data);
}

function getAllReminders() {
  const data = wx.getStorageSync(REMINDER_KEY);
  return data ? data.items : [];
}

function updateReminder(reminderId, updates) {
  const data = wx.getStorageSync(REMINDER_KEY) || { items: [], version: 1 };
  const idx = data.items.findIndex(r => r.id === reminderId);
  if (idx >= 0) {
    data.items[idx] = { ...data.items[idx], ...updates };
    data.version += 1;
    wx.setStorageSync(REMINDER_KEY, data);
    return true;
  }
  return false;
}

function deleteReminder(reminderId) {
  const data = wx.getStorageSync(REMINDER_KEY) || { items: [], version: 1 };
  data.items = data.items.filter(r => r.id !== reminderId);
  data.version += 1;
  wx.setStorageSync(REMINDER_KEY, data);
}

// --- 流程相关 ---
function saveProcessLine(processLine) {
  const data = wx.getStorageSync(PROCESS_KEY) || { lines: [], version: 1 };
  const idx = data.lines.findIndex(p => p.id === processLine.id);
  if (idx >= 0) {
    data.lines[idx] = processLine;
  } else {
    data.lines.push(processLine);
  }
  data.version += 1;
  wx.setStorageSync(PROCESS_KEY, data);
}

function getProcessLine(processId) {
  const data = wx.getStorageSync(PROCESS_KEY);
  return data ? data.lines.find(p => p.id === processId) : null;
}

function getAllProcessLines() {
  const data = wx.getStorageSync(PROCESS_KEY);
  return data ? data.lines : [];
}

// --- 配置 ---
function getConfig(key) {
  const config = wx.getStorageSync(CONFIG_KEY) || {};
  return config[key];
}

function setConfig(key, value) {
  const config = wx.getStorageSync(CONFIG_KEY) || {};
  config[key] = value;
  wx.setStorageSync(CONFIG_KEY, config);
}

// --- 批量保存（云端同步用） ---
function saveDocuments(docs) {
  const meta = wx.getStorageSync(META_KEY) || { documents: {}, version: 1 };
  docs.forEach(d => { meta.documents[d.id] = d; });
  meta.version += 1;
  wx.setStorageSync(META_KEY, meta);
}

function saveReminders(reminders) {
  const data = { items: reminders, version: (wx.getStorageSync(REMINDER_KEY)?.version || 1) + 1 };
  wx.setStorageSync(REMINDER_KEY, data);
}

// --- 云端同步 ---
async function initDBSync() {
  try {
    const lastSync = wx.getStorageSync('__db_sync_state__');
    return lastSync?.status === 'synced';
  } catch (e) { return false; }
}

async function syncAllToCloud() {
  const app = getApp();
  if (!app || !app.globalData.cloudReady) return;
  const documents = getAllDocuments();
  const reminders = getAllReminders();
  const processes = getAllProcessLines();
  try {
    await wx.cloud.callFunction({
      name: 'db-admin',
      data: {
        action: 'sync',
        data: { documents, reminders, processes }
      }
    });
    wx.setStorageSync('__db_sync_state__', { status: 'synced', time: Date.now() });
  } catch (e) {
    console.error('[Storage] sync failed:', e);
    throw e;
  }
}

module.exports = {
  initStorage, initDBSync, syncAllToCloud,
  saveDocumentMeta, getDocumentMeta, getAllDocuments, getDocumentsByType,
  saveFile, readFile, deleteDocument, searchDocuments,
  saveReminder, getAllReminders, updateReminder, deleteReminder,
  saveProcessLine, getProcessLine, getAllProcessLines,
  saveDocuments, saveReminders,
  getConfig, setConfig,
  FILE_BASE, META_KEY, REMINDER_KEY, PROCESS_KEY
};
