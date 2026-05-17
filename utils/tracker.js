/**
 * 住港伴 — 用户行为追踪工具
 * 异步上报，不阻塞主流程
 */
var app = null;

function getApp() {
  if (!app) {
    try { app = require('./app'); } catch (e) {}
    if (!app) {
      try { app = getApp(); } catch (e2) {}
    }
  }
  return app;
}

/**
 * 上报事件到 usage-tracker 云函数
 * @param {string} eventType - 事件类型: assessment_completed | path_selected | process_created | document_added
 * @param {object} payload - 事件数据
 */
function track(eventType, payload) {
  if (!eventType) return;
  try {
    wx.cloud.callFunction({
      name: 'usage-tracker',
      data: {
        action: 'track',
        eventType: eventType,
        payload: payload || {},
        sessionId: getSessionId()
      }
    }).then(function() {
      // 静默成功
    }).catch(function(e) {
      console.warn('[tracker] 上报失败:', eventType, e.message);
    });
  } catch (e) {
    console.warn('[tracker] 上报异常 (云函数未就绪或离线):', eventType, e.message);
  }
}

var _sessionId = '';
function getSessionId() {
  if (!_sessionId) {
    _sessionId = wx.getStorageSync('__session_id__') || ('s_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6));
    wx.setStorageSync('__session_id__', _sessionId);
  }
  return _sessionId;
}

module.exports = { track };
