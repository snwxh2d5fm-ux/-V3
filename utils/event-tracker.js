/**
 * 住港伴 V4.1 — AI-Chat 事件埋点工具 (Phase 1)
 * =============================================
 * 事件类型: ai_chat_open, ai_chat_send, ai_chat_close, ai_chat_feedback, ai_chat_milestone
 * 双通道: 本地离线埋点 (复用 tracker.js) + 云端同步 (非阻塞)
 * =============================================
 *
 * 用法:
 *   var eventTracker = require('../../utils/event-tracker');
 *   eventTracker.track('open', { source: 'tabBar' });
 *   eventTracker.track('send', { input_mode: 'keyboard', message_length: 42 });
 *   eventTracker.track('close', { duration_seconds: 120 });
 */

const trackerUtil = require('./tracker');

/**
 * 追踪 AI-Chat 事件
 * 双通道上报: 本地离线埋点 (1:10 采样) + 云端同步 (非阻塞)
 * @param {string} eventType - 事件类型 (open/send/close/feedback/milestone)
 * @param {object} payload - 事件数据
 */
function track(eventType, payload) {
  const fullType = 'ai_chat_' + eventType;

  // 通道1: 本地离线埋点 (1:10 采样 + 20种业务事件)
  // [V4.1-PHASE1] Task 4: 利用已有的 tracker.js 离线批处理队列
  trackerUtil.event(fullType, payload);

  // 通道2: 云端同步 (非阻塞，失败不影响用户体验)
  // [V4.1-PHASE1] Task 4: 直调 ai-chat 云函数 trackEvent action
  try {
    wx.cloud
      .callFunction({
        name: 'ai-chat',
        data: {
          action: 'trackEvent',
          type: fullType,
          data: payload,
          timestamp: Date.now(),
        },
      })
      .catch(function (err) {
        console.warn('[EventTracker] 云端埋点失败(非关键):', err);
      });
  } catch (e) {
    // 静默失败 — 埋点不应影响主功能
  }
}

module.exports = { track: track };
