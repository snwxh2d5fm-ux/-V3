/**
 * 住港伴 V4 — 埋点追踪模块
 * Phase 1: 15核心页 page_view (1:10采样) + 20种业务事件 (批量10条/批上传)
 *
 * 用法:
 *   const t = require('./tracker');
 *   t.pageView({ page: 'pages/guidebooks/index/index', from: 'tabBar' });
 *   t.event('guidebook_task_complete', { taskId: 'T001' });
 *   t.setReferrer('pages/home/home'); // 在 onHide 中调用
 */
const CONFIG = { SAMPLE_RATE: 0.1, BATCH_SIZE: 10, FLUSH_MS: 30000, MAX_CACHE: 200 };
let _cache = [];
let _timer = null;
let _sessionId = '';
let _lastPage = '';
let _lastPageTime = 0;

// 恢复离线缓存
function _restore() {
  try {
    const r = wx.getStorageSync('_zgb_tracker');
    if (r) _cache = r;
  } catch (_) {}
}
function _save() {
  try {
    wx.setStorageSync('_zgb_tracker', _cache.slice(-CONFIG.MAX_CACHE));
  } catch (_) {}
}
function _schedule() {
  if (_timer) clearTimeout(_timer);
  _timer = setTimeout(_flush, CONFIG.FLUSH_MS);
}

function _flush() {
  if (!_cache.length) return;
  const batch = _cache.splice(0, CONFIG.BATCH_SIZE);
  _save();
  try {
    wx.cloud.callFunction({ name: 'usage-tracker', data: { action: 'trackBatch', events: batch } });
  } catch (_) {
    _cache.unshift.apply(_cache, batch);
    _save();
  }
  if (_cache.length) _schedule();
}

function _enq(evt) {
  _cache.push(evt);
  _save();
  _cache.length >= CONFIG.BATCH_SIZE ? _flush() : _schedule();
}

function _sid() {
  if (!_sessionId) {
    _sessionId = 's_' + Date.now();
    wx.setStorageSync('__sid__', _sessionId);
  }
  return _sessionId;
}

// === 公开 API ===

function pageView(opts) {
  if (Math.random() >= CONFIG.SAMPLE_RATE) return;
  _sid();
  _enq({
    eventType: 'page_view',
    payload: {
      page: opts.page,
      from: opts.from || '',
      referrer: opts.referrer || '',
      sessionId: _sessionId,
      timeOnPrevious: _lastPageTime ? Math.round((Date.now() - _lastPageTime) / 1000) : 0,
      tabActive: opts.tabActive || '',
    },
    createdAt: Date.now(),
  });
}

function event(type, payload) {
  _sid();
  _enq({ eventType: type, payload: payload || {}, sessionId: _sessionId, createdAt: Date.now() });
}

function setReferrer(page) {
  _lastPage = page;
  _lastPageTime = Date.now();
}

_restore();
module.exports = { pageView: pageView, event: event, setReferrer: setReferrer };
