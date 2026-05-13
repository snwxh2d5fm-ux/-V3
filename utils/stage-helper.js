/**
 * 住港伴 — 全局7阶段进度引擎
 * 根据用户当前流程阶段，统一计算 stageSteps 状态
 * 所有页面通过 getGlobalStages() 获取同步的进度条
 */

var STAGE_DEFS = [
  { id: 'evaluation',  label: '资格评估', order: 0 },
  { id: 'preparation', label: '材料准备', order: 1 },
  { id: 'submission',  label: '线上申请', order: 2 },
  { id: 'waiting',     label: '等待获批', order: 3 },
  { id: 'activation',  label: '获批激活', order: 4 },
  { id: 'settlement',  label: '抵港生活', order: 5 },
  { id: 'pr',          label: '永居',     order: 6 }
];

function getActiveStageIndex() {
  try {
    var app;
    try { app = getApp(); } catch(e) { app = null; }

    // 1. globalData.userStatus
    if (app && app.globalData && app.globalData.userStatus) {
      var s = app.globalData.userStatus;
      if (s === 'permanent') return 6;
      if (s === 'approved')  return 3;
      if (s === 'submitted') return 2;
    }

    // 2. activeProcess
    if (app && app.globalData && app.globalData.activeProcess) {
      var ap = app.globalData.activeProcess;
      if (ap.completedStages && ap.completedStages.length > 0) return ap.completedStages.length;
      if (ap.name || ap.templateId) return 1;
    }

    // 3. globalData.selectedPath — 已选路径至少进入材料准备
    if (app && app.globalData && app.globalData.selectedPath) return 1;

    // 4. storage 兜底
    var session = wx.getStorageSync('__session__') || {};
    if (session.userStatus === 'approved') return 3;
    if (session.userStatus === 'submitted') return 2;
    if (session.selectedPath) return 1;

    // 5. 其他storage检查
    var userStatus = wx.getStorageSync('_user_status') || wx.getStorageSync('userStatus') || '';
    if (userStatus === 'approved') return 3;
    if (userStatus === 'submitted') return 2;
    if (userStatus === 'unapplied') return 0;

    var path = wx.getStorageSync('__selected_path__') || wx.getStorageSync('__active_process_id__') || '';
    if (path) return 1;
  } catch(e) {
    console.error('[stage-helper] error:', e.message);
  }

  return 0;
}

function getGlobalProgress() {
  var idx = getActiveStageIndex();
  return Math.min(Math.round(((idx + 1) / 7) * 100), 100);
}

function getGlobalStages() {
  var activeIdx = getActiveStageIndex();
  return STAGE_DEFS.map(function(s) {
    var status = 'pending';
    if (s.order < activeIdx) status = 'done';
    else if (s.order === activeIdx) status = 'active';
    return { id: s.id, label: s.label, status: status };
  });
}

module.exports = { getGlobalStages, getGlobalProgress, getActiveStageIndex };
