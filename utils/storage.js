/**
 * @fileoverview 住港伴 — 本地存储引擎
 * 基于微信小程序本地文件系统和 Storage API
 * 所有用户原始材料存储在设备本地，不上传服务端
 */

/** @const {string} 证件文件存储根目录 */
var FILE_BASE = wx.env.USER_DATA_PATH + '/vault/';
/** @const {string} 证件元数据storage key */
var META_KEY = '__vault_meta__';
/** @const {string} 提醒数据storage key */
var REMINDER_KEY = '__reminders__';
/** @const {string} 流程数据storage key */
var PROCESS_KEY = '__processes__';
/** @const {string} 用户数据storage key */
var USER_KEY = '__user_data__';
/** @const {string} 配置storage key */
var CONFIG_KEY = '__config__';

/**
 * 初始化存储目录结构和元数据
 * @returns {Promise<boolean>}
 */
function initStorage() {
  return new Promise(function(resolve) {
    try {
      var fs = wx.getFileSystemManager();
      try { fs.accessSync(FILE_BASE); } catch(e) { fs.mkdirSync(FILE_BASE, true); }
      var dirs = ['identities', 'education', 'employment', 'assets', 'visas', 'renewal', 'family', 'custom'];
      dirs.forEach(function(dir) {
        try { fs.accessSync(FILE_BASE + dir); } catch(e) { fs.mkdirSync(FILE_BASE + dir, true); }
      });
      if (!wx.getStorageSync(META_KEY)) wx.setStorageSync(META_KEY, { documents: {}, version: 1 });
      if (!wx.getStorageSync(REMINDER_KEY)) wx.setStorageSync(REMINDER_KEY, []);
      if (!wx.getStorageSync(PROCESS_KEY)) wx.setStorageSync(PROCESS_KEY, []);
      resolve(true);
    } catch(e) { resolve(false); }
  });
}

/** @param {object} doc @returns {object} */
function saveDocumentMeta(doc) {
  var meta = wx.getStorageSync(META_KEY) || { documents: {}, version: 1 };
  meta.documents[doc.id] = Object.assign({}, meta.documents[doc.id] || {}, doc, { updatedAt: new Date().toISOString() });
  if (!doc.createdAt) meta.documents[doc.id].createdAt = new Date().toISOString();
  meta.version = (meta.version || 0) + 1;
  wx.setStorageSync(META_KEY, meta);
  return doc;
}

/** @param {string} docId @returns {object|null} */
function getDocumentMeta(docId) {
  var meta = wx.getStorageSync(META_KEY);
  return (meta && meta.documents && meta.documents[docId]) ? meta.documents[docId] : null;
}

/** @returns {Array<object>} */
function getAllDocuments() {
  var meta = wx.getStorageSync(META_KEY);
  if (!meta || !meta.documents) return [];
  return Object.keys(meta.documents).map(function(k) { return meta.documents[k]; });
}

/** @param {string} type @returns {Array<object>} */
function getDocumentsByType(type) {
  return getAllDocuments().filter(function(d) { return d.category === type || d.type === type; });
}

/** @param {string} tempPath @param {string} docId @param {string} category @returns {string} */
function saveFile(tempPath, docId, category) {
  var fs = wx.getFileSystemManager();
  var ext = (tempPath.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi, '');
  var dir = FILE_BASE + (category || 'custom') + '/';
  try { fs.accessSync(dir); } catch(e) { fs.mkdirSync(dir, true); }
  var persistPath = dir + docId + '.' + ext;
  try { fs.copyFileSync(tempPath, persistPath); } catch(ce) {
    var data = fs.readFileSync(tempPath);
    fs.writeFileSync(persistPath, data, 'binary');
  }
  return persistPath;
}

/** @param {string} filePath @returns {string} */
function readFile(filePath) {
  try {
    var fs = wx.getFileSystemManager();
    var data = fs.readFileSync(filePath, 'base64');
    return 'data:image/jpeg;base64,' + data;
  } catch(e) { return ''; }
}

/** @param {string} docId @returns {boolean} */
function deleteDocument(docId) {
  var doc = getDocumentMeta(docId);
  if (!doc) return false;
  if (doc.filePath) {
    try { var fs = wx.getFileSystemManager(); fs.unlinkSync(doc.filePath); } catch(e) {}
  }
  var meta = wx.getStorageSync(META_KEY);
  if (meta && meta.documents) { delete meta.documents[docId]; wx.setStorageSync(META_KEY, meta); }
  return true;
}

/** @param {string} query @returns {Array<object>} */
function searchDocuments(query) {
  var q = query.toLowerCase();
  return getAllDocuments().filter(function(d) {
    return (d.name && d.name.toLowerCase().indexOf(q) >= 0) || (d.category && d.category.indexOf(q) >= 0) || (d.docNumber && d.docNumber.indexOf(q) >= 0);
  });
}

/** @param {object} reminder @returns {object} */
function saveReminder(reminder) {
  var reminders = getAllReminders();
  if (!reminder.id) reminder.id = 'rem_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  var idx = reminders.findIndex(function(r) { return r.id === reminder.id; });
  if (idx >= 0) reminders[idx] = Object.assign({}, reminders[idx], reminder, { updatedAt: new Date().toISOString() });
  else reminders.push(Object.assign({}, reminder, { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));
  wx.setStorageSync(REMINDER_KEY, reminders);
  return reminder;
}

/** @returns {Array<object>} */
function getAllReminders() { return wx.getStorageSync(REMINDER_KEY) || []; }

/** @param {string} reminderId @param {object} updates @returns {object|null} */
function updateReminder(reminderId, updates) {
  var reminders = getAllReminders();
  var idx = reminders.findIndex(function(r) { return r.id === reminderId; });
  if (idx < 0) return null;
  reminders[idx] = Object.assign({}, reminders[idx], updates, { updatedAt: new Date().toISOString() });
  wx.setStorageSync(REMINDER_KEY, reminders);
  return reminders[idx];
}

/** @param {string} reminderId @returns {boolean} */
function deleteReminder(reminderId) {
  var reminders = getAllReminders();
  var filtered = reminders.filter(function(r) { return r.id !== reminderId; });
  wx.setStorageSync(REMINDER_KEY, filtered);
  return true;
}

/** @param {object} processLine @returns {object} */
function saveProcessLine(processLine) {
  var lines = getAllProcessLines();
  if (!processLine.id) processLine.id = 'proc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  var idx = lines.findIndex(function(l) { return l.id === processLine.id; });
  if (idx >= 0) lines[idx] = Object.assign({}, lines[idx], processLine, { updatedAt: new Date().toISOString() });
  else lines.push(Object.assign({}, processLine, { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));
  wx.setStorageSync(PROCESS_KEY, lines);
  return processLine;
}

/** @param {string} processId @returns {object|null} */
function getProcessLine(processId) { return (getAllProcessLines().find(function(l) { return l.id === processId; })) || null; }

/** @returns {Array<object>} */
function getAllProcessLines() { return wx.getStorageSync(PROCESS_KEY) || []; }

/** @param {Array<object>} processLines */
function saveProcessLines(processLines) { wx.setStorageSync(PROCESS_KEY, processLines); }

/** @param {string} key @returns {*} */
function getConfig(key) { var c = wx.getStorageSync(CONFIG_KEY) || {}; return c[key]; }

/** @param {string} key @param {*} value */
function setConfig(key, value) { var c = wx.getStorageSync(CONFIG_KEY) || {}; c[key] = value; wx.setStorageSync(CONFIG_KEY, c); }

/** @param {Array<object>} docs */
function saveDocuments(docs) {
  var meta = wx.getStorageSync(META_KEY) || { documents: {}, version: 1 };
  docs.forEach(function(d) { meta.documents[d.id] = Object.assign({}, meta.documents[d.id] || {}, d); });
  meta.version = (meta.version || 0) + 1;
  wx.setStorageSync(META_KEY, meta);
}

/** @param {Array<object>} reminders */
function saveReminders(reminders) { wx.setStorageSync(REMINDER_KEY, reminders); }

function initDBSync() { var s = wx.getStorageSync('__db_sync_state__'); return s === 'synced' || s === 'syncing'; }

function syncAllToCloud() {
  return new Promise(function(resolve, reject) {
    var app = getApp();
    if (!app || !app.globalData.cloudReady) { resolve(false); return; }
    wx.cloud.callFunction({ name: 'db-admin', data: { action: 'sync', data: { documents: getAllDocuments(), reminders: getAllReminders(), processes: getAllProcessLines() } }, success: function() { wx.setStorageSync('__db_sync_state__', 'synced'); resolve(true); }, fail: reject });
  });
}

module.exports = {
  initStorage: initStorage, saveDocumentMeta: saveDocumentMeta, getDocumentMeta: getDocumentMeta,
  getAllDocuments: getAllDocuments, getDocumentsByType: getDocumentsByType, saveFile: saveFile,
  readFile: readFile, deleteDocument: deleteDocument, searchDocuments: searchDocuments,
  saveReminder: saveReminder, getAllReminders: getAllReminders, updateReminder: updateReminder,
  deleteReminder: deleteReminder, saveProcessLine: saveProcessLine, getProcessLine: getProcessLine,
  getAllProcessLines: getAllProcessLines, saveProcessLines: saveProcessLines,
  getConfig: getConfig, setConfig: setConfig, saveDocuments: saveDocuments, saveReminders: saveReminders,
  initDBSync: initDBSync, syncAllToCloud: syncAllToCloud,
  FILE_BASE: FILE_BASE, META_KEY: META_KEY, REMINDER_KEY: REMINDER_KEY, PROCESS_KEY: PROCESS_KEY
};
