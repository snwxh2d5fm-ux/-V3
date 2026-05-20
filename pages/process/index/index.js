// 住港伴 v5 — 流程控首页（内联详情版）
const app = getApp();
const { getGlobalStages, getActiveStageIndex } = require('../../../utils/stage-helper');
const constants = require('../../../data/constants');
const templates = require('../../../data/templates.js');
const { getAllProcessLines, getProcessLine, saveProcessLine } = require('../../../utils/storage');
const tracker = require('../../../utils/tracker');
const { canMakeDecision } = require('../../../utils/decision-gate');
const { buildPhase2Stages, isPhase2Onboarding, toStageObject, autoCompletePhase1 } = require('../../../utils/phase-builder');

Page({
  data: {
    isSkipped: false,
    isUnapplied: false,

    // 指标说明弹窗
    showHelpPopup: false,
    helpTitle: '',
    helpBody: '',

    // 7阶段指示器
    stageSteps: [
      { id: 'evaluation', label: '资格评估', status: 'active' },
      { id: 'preparation', label: '材料准备', status: 'pending' },
      { id: 'submission', label: '线上申请', status: 'pending' },
      { id: 'waiting', label: '等待获批', status: 'pending' },
      { id: 'activation', label: '获批激活', status: 'pending' },
      { id: 'settlement', label: '抵港生活', status: 'pending' },
      { id: 'pr', label: '永居', status: 'pending' }
    ],
    stageProgress: 0,

    // 流程详情
    activeProcess: null,
    phases: [],            // 四阶段分组
    progress: 0,
    materialDoneCount: 0,
    materialTotalCount: 0,
    expandedPhaseIdx: 0,
    completingStageIdx: -1,
    showDisclaimer: false,

    // 空状态·模板选择
    showTemplateSelect: false,
    templates: templates.processTemplates,

    // 直接选择路径
    showDirectPathPicker: false,
    directSelectedPath: '',
    directSelectedPathLabel: '',
    directPathOptions: [
      { id: 'qmas', name: '优才计划', icon: '🎯', desc: '12项评核准则 · 满足≥6项可申请' },
      { id: 'ttps_a', name: '高才通A类', icon: '💰', desc: '年收入≥250万港币' },
      { id: 'ttps_b', name: '高才通B类', icon: '🎓', desc: '百强本科+3年工作经验' },
      { id: 'ttps_c', name: '高才通C类', icon: '🏃', desc: '百强本科(<3年经验)·限额' },
      { id: 'asmpt', name: '专才计划', icon: '💼', desc: '已获香港雇主聘用' },
      { id: 'student_iang', name: '学生→IANG', icon: '📚', desc: '香港高校毕业后留港' },
      { id: 'dependent', name: '受养人签证', icon: '👨‍👩‍👧', desc: '配偶/子女随行来港' },
      { id: 'cies', name: 'CIES投资类身份规划', icon: '🏦', desc: '投资≥3000万港币' }
    ],

    // Bug #13: 风险提醒弹窗
    showDisclaimerPopup: false,
    disclaimerType: '',
    disclaimerTitle: '',
    disclaimerBody: '',
    disclaimerConfirmed: false,

    showGateSheet: false,
    gateMode: '',
    pendingPathId: '',
    pendingPathLabel: '',
    pendingTemplateId: '',
    expandedPathId: '',
  },

  onShow() {
    // ★ 里程碑验证后强制刷新
    var dataVer = wx.getStorageSync('__process_data_version__') || 0;
    if (dataVer !== this.__lastDataVersion) {
      this.__lastDataVersion = dataVer;
      console.log('[流程控] 检测到数据变更，强制刷新 version=' + dataVer);
    }
    try { this.setData({ stageSteps: getGlobalStages(), stageProgress: Math.min(((getActiveStageIndex() + 1) / 7) * 100, 100) }); } catch(e) { this.setData({ stageProgress: 14 }); }
    try {
      var userStatus = app.globalData.userStatus || wx.getStorageSync(constants.STORAGE_KEYS.USER_STATUS);
      this.setData({
        isSkipped: userStatus === 'skipped',
        isUnapplied: userStatus === 'unapplied'
      });
      this.loadActiveProcess();
      var that = this;
      setTimeout(function() { that.checkDisclaimerNeeded(); }, 500);
    } catch (e) {
      console.error('[流程控] onShow 异常:', e);
      this.setData({
        activeProcess: null,
        phases: [],
        progress: 0,
        isSkipped: true  // 降级到跳过状态
      });
    }
  },

  goSelectIdentity() { wx.navigateTo({ url: '/pages/status-select/status-select' }); },

  toggleDirectPathPicker() {
    this.setData({ showDirectPathPicker: !this.data.showDirectPathPicker });
  },

  onSelectDirectPath(e) {
    var id = e.currentTarget.dataset.id;
    var opts = this.data.directPathOptions;
    var label = '';
    var desc = '';
    for (var i = 0; i < opts.length; i++) {
      if (opts[i].id === id) { label = opts[i].name; desc = opts[i].desc || ''; break; }
    }
    var gate = canMakeDecision();
    if (!gate.ok) {
      this.setData({ showGateSheet: true, gateMode: gate.reason, pendingPathId: id, pendingPathLabel: label });
      return;
    }
    if (this.__selectingPath) return;
    this.__selectingPath = true;
    var that = this;
    setTimeout(function() { that.__selectingPath = false; }, 2000);
    // ★ 封存旧路径提醒
    var oldPath = app.globalData.selectedPath || wx.getStorageSync('__selected_path__') || '';
    if (oldPath && oldPath !== id) {
      require('../../../utils/storage').archiveRemindersByPath(oldPath);
    }
    // 一触即选：点击即确认，创建最小流程线
    app.globalData.selectedPath = id;
    app.globalData.userStatus = 'unapplied';  // P1-02: 双写 globalData

    // 清除旧流程残留，防止阶段跳转
    var oldLines = getAllProcessLines();
    if (Array.isArray(oldLines)) {
      oldLines.forEach(function(l) { if (l && l.status === 'active') { l.status = 'inactive'; saveProcessLine(l); } });
    }
    wx.setStorageSync('__process_stage__', 1);
    wx.setStorageSync('__active_process_id__', '');
    // 持久化路径
    wx.setStorageSync('__selected_path__', id);
    require('../../../utils/storage').unarchiveRemindersByPath(id);

    // 从模板填充 stages，phase2拆为4个独立里程碑阶段
    var tmpl = templates.processTemplates.find(function(t) { return t.id === id || t.pathType === id; });
    var stages = [];
    if (tmpl && tmpl.phases) {
      tmpl.phases.forEach(function(p) {
        if (isPhase2Onboarding(p)) {
          buildPhase2Stages(p).forEach(function(ps) {
            stages.push(toStageObject(ps, p.id, stages.length === 0));
          });
          return;
        }
        var stageSteps = (p.steps || []).map(function(st) {
          return { stepId: st.id, stepName: st.name, status: 'pending', completedAt: null };
        });
        stages.push({
          stageId: p.id, stageName: p.name, order: p.order,
          isMilestone: p.isMilestone || false,
          milestoneDocType: p.milestoneDocType || null,
          phaseId: p.id,
          status: stages.length === 0 ? 'in_progress' : 'locked',
          steps: stageSteps
        });
      });
    }

    autoCompletePhase1(stages);

    var processLine = {
      id: 'direct_' + Date.now(),
      name: label,
      templateId: id,
      pathType: id,
      riskLevel: (constants.PATH_RISK_LEVELS && constants.PATH_RISK_LEVELS[id]) ? constants.PATH_RISK_LEVELS[id].level : 'medium',
      totalCycle: (constants.PATH_CYCLES && constants.PATH_CYCLES[id]) ? constants.PATH_CYCLES[id].label : '7年',
      phases: [],
      stages: stages,
      status: 'active',
      progress: 0,
      currentStage: '资格评估',
      readyMaterials: 0,
      totalMaterials: 0,
      createdAt: new Date().toISOString(),
      source: 'direct_pick'
    };

    saveProcessLine(processLine);
    app.globalData.activeProcessId = processLine.id;
    app.globalData.activeProcess = processLine;
    wx.setStorageSync('__active_process_id__', processLine.id);
    wx.setStorageSync('__process_stage__', 1);

    // ★ 同步创建云端流程（verifyMilestone需要云端user_processes记录）
    var cloudProcessId = processLine.id;
    var cloudTimeout = new Promise(function(_, reject) {
      setTimeout(function() { reject(new Error('CLOUD_TIMEOUT')); }, 8000);
    });
    Promise.race([
      wx.cloud.callFunction({ name: 'process-manager', data: { action: 'start', templateId: id } }),
      cloudTimeout
    ]).then(function(startRes) {
      if (startRes && startRes.result && startRes.result.code === 0 && startRes.result.data && startRes.result.data.processId) {
        var lines = getAllProcessLines();
        var line = lines.find(function(l) { return l.id === processLine.id; });
        if (line) { line.cloudId = startRes.result.data.processId; saveProcessLine(line); }
      }
    }).catch(function(e) {
      if (e && e.message === 'CLOUD_TIMEOUT') {
        console.warn('[流程控] 云端流程创建超时(8s)，本地流程已保存');
      } else {
        console.warn('[流程控] 云端流程创建失败（本地降级）:', e);
      }
    });

    this.setData({ showDirectPathPicker: false, directSelectedPath: '', directSelectedPathLabel: '' });
    wx.showToast({ title: '已选择：' + label, icon: 'success', duration: 1500 });
    this.loadActiveProcess();
  },

  startAssessment() {
    const persona = wx.getStorageSync('__assessment_persona__') || app.globalData._persona || 0;
    wx.navigateTo({ url: `/subpkg-low/pages/assessment-index/index?persona=${persona}` });
  },

  goToDocuments() {
    wx.switchTab({ url: '/pages/documents/index/index' });
  },

  // ★ 通道A: 完成当前阶段所有步骤 → 自动推进
  completeAllSteps: function(e) {
    var index = parseInt((e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.stageIndex)) || -1;
    // 立即设置视觉反馈 (按钮变灰"推进中...")
    this.setData({ completingStageIdx: index });

    // 防重入: 异步操作进行中则拒绝新点击 + 恢复按钮(麒麟P1: 防粘滞)
    if (this.__completingAllSteps) {
      this.setData({ completingStageIdx: -1 });
      return;
    }

    console.log('[completeAllSteps] 触发 index=' + index);
    console.log('[completeAllSteps] index=' + index + ' phases.length=' + (this.data.phases ? this.data.phases.length : 0));

    // ── 校验阶段 (锁未设置，允许失败后重试) ──
    var phase = this.data.phases[index];
    if (!phase) {
      wx.showToast({ title: '阶段不存在 index=' + index, icon: 'none', duration: 2000 });
      this.setData({ completingStageIdx: -1 });
      return;
    }
    console.log('[completeAllSteps] phase.status=' + phase.status + ' phase.name=' + phase.name);
    if (phase.status !== 'current') {
      wx.showToast({ title: '当前阶段是"' + (phase.name||'?') + '"(' + phase.status + ')，非进行中', icon: 'none', duration: 2000 });
      this.setData({ completingStageIdx: -1 });
      return;
    }

    var app = getApp();
    var activeProcess = app.globalData.activeProcess;
    console.log('[completeAllSteps] activeProcess=' + (activeProcess ? 'YES' : 'NO') + ' stages=' + (activeProcess && activeProcess.stages ? activeProcess.stages.length : 0));
    if (!activeProcess || !activeProcess.stages || activeProcess.stages.length === 0) {
      wx.showToast({ title: '请先在流程控选择身份路径，创建流程', icon: 'none', duration: 3000 });
      this.setData({ completingStageIdx: -1 });
      return;
    }

    // 通过 phaseId 匹配当前阶段
    var allStages = activeProcess.stages;
    var BRIDGE = require('../../../data/constants').STAGE_BRIDGE_MAP;
    var phaseId = BRIDGE.ui_to_phase[index];
    var currentStage = allStages.find(function(s) {
      return (s.phaseId && s.phaseId === phaseId) ||
             (s.stageId && s.stageId === phaseId);
    });
    if (!currentStage && index < allStages.length) {
      var sortedStages = allStages.slice().sort(function(a, b) { return (a.order || 0) - (b.order || 0); });
      currentStage = sortedStages[index];
    }
    if (!currentStage) {
      wx.showToast({ title: '未找到对应阶段数据 index=' + index, icon: 'none', duration: 2000 });
      this.setData({ completingStageIdx: -1 });
      return;
    }

    var stageId = currentStage.stageId || currentStage.id;
    var pendingSteps = (currentStage.steps || []).filter(function(st) {
      return st.status !== 'completed';
    });
    if (pendingSteps.length === 0) {
      wx.showToast({ title: '所有步骤已完成', icon: 'none' });
      this.setData({ completingStageIdx: -1 });
      return;
    }

    var processId = this.data.activeProcessId || wx.getStorageSync('__active_process_id__');
    if (!processId) {
      wx.showToast({ title: '未找到流程ID', icon: 'none' });
      this.setData({ completingStageIdx: -1 });
      return;
    }

    // ── 所有校验通过，加锁进入异步操作 ──
    this.__completingAllSteps = true;
    var self = this;
    wx.showLoading({ title: '推进中...' });

    // P0-02: 30秒超时保护 — 防止云函数挂起导致永久loading
    var TIMEOUT_MS = 30000;
    var timeoutId = setTimeout(function() {
      wx.hideLoading();
      self.__completingAllSteps = false;
      self.setData({ completingStageIdx: -1 });
      wx.showToast({ title: '操作超时，请检查网络后重试', icon: 'none', duration: 2500 });
    }, TIMEOUT_MS);

    var lastResult = null;
    function processStep(si) {
      if (si >= pendingSteps.length) {
        return Promise.resolve(lastResult);
      }
      var st = pendingSteps[si];
      return wx.cloud.callFunction({
        name: 'process-manager',
        data: {
          action: 'completeStep',
          processId: processId,
          stageId: stageId,
          stepId: st.stepId
        }
      }).then(function(res) {
        lastResult = res;
        return processStep(si + 1);
      });
    }

    processStep(0).then(function() {
      clearTimeout(timeoutId);
      wx.hideLoading();
      if (lastResult && lastResult.result && lastResult.result.code === 0) {
        wx.setStorageSync('__process_stage__', index);
        var updatedProcess = getProcessLine(processId);
        if (updatedProcess) {
          app.globalData.activeProcess = updatedProcess;
          app.globalData.activeProcessId = processId;
        }
        var data = lastResult.result.data || {};
        if (data.requiresMilestone) {
          wx.showToast({ title: '请上传里程碑材料验证后解锁', icon: 'none' });
        } else {
          wx.showToast({ title: '阶段已推进', icon: 'success' });
        }
        self.loadActiveProcess();
      } else {
        var errMsg = (lastResult && lastResult.result && lastResult.result.msg) || '操作失败';
        wx.showToast({ title: errMsg, icon: 'none', duration: 2000 });
      }
    }).catch(function(err) {
      // 云函数不可用 → 本地推进（非里程碑阶段直接跳过）
      console.error('[completeAllSteps] 云函数调用异常，执行本地推进:', err);
      clearTimeout(timeoutId);
      wx.hideLoading();
      self._localAdvanceStage(index);
      wx.showToast({ title: '阶段已推进', icon: 'success' });
      self.loadActiveProcess();
    }).finally(function() {
      clearTimeout(timeoutId);
      self.__completingAllSteps = false;
      self.setData({ completingStageIdx: -1 });
    });
  },

  // ★ 本地推进（非里程碑阶段的兜底）
  _localAdvanceStage: function(stageIdx) {
    try {
      var localId = this.data.activeProcessId || wx.getStorageSync('__active_process_id__') || '';
      var { getAllProcessLines: gl, saveProcessLine: sp } = require('../../../utils/storage');
      var ls = gl();
      var line = ls.find(function(l) { return l.id === localId || l.cloudId === localId; });
      if (line && line.stages) {
        var doneIdx = -1;
        for (var si = 0; si < line.stages.length; si++) {
          if (line.stages[si].status === 'in_progress') { doneIdx = si; break; }
        }
        if (doneIdx >= 0) {
          line.stages[doneIdx].status = 'completed';
          line.stages[doneIdx].steps = (line.stages[doneIdx].steps || []).map(function(st) { return Object.assign({}, st, { status: 'completed', completedAt: new Date().toISOString() }); });
          if (doneIdx + 1 < line.stages.length && line.stages[doneIdx + 1].status === 'locked') {
            line.stages[doneIdx + 1].status = 'in_progress';
            line.stages[doneIdx + 1].steps = (line.stages[doneIdx + 1].steps || []).map(function(st) { return Object.assign({}, st, { status: 'pending' }); });
          }
          sp(line);
          getApp().globalData.activeProcess = line;
          wx.setStorageSync('__process_stage__', Math.min(doneIdx + 1, 6));
          wx.setStorageSync('__process_data_version__', Date.now());
        }
      }
    } catch(e) { console.warn('[_localAdvanceStage] 失败:', e); }
  },

  // ★ 通道B: 上传里程碑材料验证
  uploadMilestone: function(e) {
    var index = e.currentTarget.dataset.stageIndex;
    var phase = this.data.phases[index];
    if (!phase || phase.status !== 'current') return;
    var localProcessId = this.data.activeProcessId || wx.getStorageSync('__active_process_id__') || '';
    // 优先使用云端processId（verifyMilestone查询云端user_processes集合）
    var cloudProcessId = '';
    try {
      var lines = getAllProcessLines();
      var currentLine = lines.find(function(l) { return l.id === localProcessId || l.cloudId === localProcessId; });
      cloudProcessId = (currentLine && currentLine.cloudId) || '';
    } catch(e) {}
    var processId = cloudProcessId || localProcessId;
    // ★ 从本地流程线中查找实际的stageId
    var actualStageId = phase.stageId || phase.id;
    if (currentLine && currentLine.stages) {
      var inProgressStage = currentLine.stages.find(function(s) { return s.status === 'in_progress'; });
      if (inProgressStage) actualStageId = inProgressStage.stageId;
      console.log('[uploadMilestone] foundLine=YES stages=' + currentLine.stages.length + ' inProgressStage=' + (inProgressStage ? inProgressStage.stageId : 'NOT_FOUND'));
    } else {
      console.log('[uploadMilestone] currentLine=' + (currentLine ? 'YES_NO_STAGES' : 'NOT_FOUND'));
    }
    console.log('[uploadMilestone] localId=' + localProcessId + ' stageId=' + actualStageId + ' stageIndex=' + index);
    wx.navigateTo({ url: '/subpkg-process/pages/milestone-verify/index?processId=' + processId + '&localProcessId=' + localProcessId + '&stageId=' + actualStageId + '&stageIndex=' + index + '&status=' + (phase.id || '') + '&milestoneType=' + (phase.milestoneDocType || '') + '&label=' + encodeURIComponent(phase.name || '') });
  },

  // v5 快捷入口 (DSG-1 P0-01: 双中枢合并)
  goToGuide() {
    wx.navigateTo({ url: '/subpkg-guide/pages/guide-index/index' });
  },
  goToPrecheck() {
    wx.showToast({ title: '预审功能已迁移至证件详情页', icon: 'none' });
  },
  goToInfo() {
    wx.navigateTo({ url: '/subpkg-process/pages/info/index' });
  },

  loadActiveProcess() {
    try {
      var lines = getAllProcessLines();
      if (!Array.isArray(lines)) { lines = []; }
      lines = lines.filter(function(l) { return l && l.status === 'active'; });
      lines.sort(function(a, b) {
        var ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        var tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
      var seen = {};
      lines = lines.filter(function(l) {
        var k = (l.name || '') + (l.source || '');
        if (seen[k]) return false;
        seen[k] = true;
        return true;
      });
    const activeProcess = lines[0] || null;

    if (!activeProcess) {
      // 无活跃流程 → 引导用户选择身份路径
      this.setData({
        activeProcess: null,
        phases: [],
        progress: 0,
        expandedPhaseIdx: -1,
        showDirectPathPicker: true
      });
      return;
    }
    // 7步框架（用户视角）
    const SEVEN_STEPS = [
      { id: 'evaluation',  name: '资格评估',   icon: '🎯', desc: 'AI评估最佳身份路径',       minTime: '1-2周',   hasAssessBtn: true },
      { id: 'preparation', name: '材料准备',   icon: '📋', desc: '收集申请所需全部文件',       minTime: '2-4周',   linkDocs: true },
      { id: 'submission',  name: '线上申请',   icon: '📤', desc: '通过入境处系统递交申请',     minTime: '1-3天' },
      { id: 'waiting',     name: '等待获批',   icon: '⏳', desc: '入境处审批中，耐心等待',     minTime: '4-8周' },
      { id: 'activation',  name: '获批激活',   icon: '✅', desc: '激活签证·办理香港身份证',   minTime: '2-4周' },
      { id: 'settlement',  name: '抵港生活',   icon: '🏠', desc: '在港安居乐业·续签维持',     minTime: '1-6年' },
      { id: 'pr',          name: '永居',       icon: '🏁', desc: '满7年申请香港永久居民',     minTime: '7年总计' }
    ];

    const allStages = activeProcess.stages || [];
    const stepMaterials = SEVEN_STEPS.map(() => []);

    // P0-01 fix: 共享phaseId→步骤索引映射(stepMaterials + currentStepIdx 两处共用)
    // 归一化order到phase2内部0-based索引，避免全局order直接当数组下标
    var _phase2MinOrder = Infinity;
    allStages.forEach(function(ss) {
      if ((ss.phaseId||'').includes('phase2') || (ss.phaseId||'').includes('onboarding')) {
        _phase2MinOrder = Math.min(_phase2MinOrder, ss.order || 0);
      }
    });
    if (_phase2MinOrder === Infinity) _phase2MinOrder = 0;

    var _toStepIdx = function(pid, order) {
      if (pid.includes('phase1') || pid.includes('evaluation')) return 0; // → 资格评估
      if (pid.includes('phase2') || pid.includes('onboarding')) {
        var total = allStages.filter(function(ss) { return (ss.phaseId||'').includes('phase2')||(ss.phaseId||'').includes('onboarding'); }).length;
        var localOrder = (order || 0) - _phase2MinOrder;
        if (localOrder < 0) localOrder = 0;
        // 4子阶段各映射到 1/2/3/4（材料准备/线上申请/等待获批/获批激活）
        if (total >= 4) return Math.min(localOrder + 1, 4);
        if (total <= 3) return [1,2,3][localOrder] != null ? [1,2,3][localOrder] : 3;
        return localOrder < Math.ceil(total/2) ? 1 : localOrder < total-1 ? 2 : 3;
      }
      if (pid.includes('phase3') || pid.includes('maintenance')) return 5;
      if (pid.includes('phase4') || pid.includes('pr')) return 6;
      return -1;
    };

    allStages.forEach(s => {
      const pid = s.phaseId || '';
      const stepIdx = _toStepIdx(pid, s.order);
      if (stepIdx >= 0 && stepIdx < 7) stepMaterials[stepIdx].push(s);
    });

    var doneCount = allStages.filter(function(s) { return s.status === 'completed'; }).length;
    var progress = allStages.length > 0 ? Math.round((doneCount / allStages.length) * 100) : 0;
    this.setData({ materialDoneCount: doneCount, materialTotalCount: allStages.length });
    // 仅0%完成度时出示免责声明
    // showDisclaimer 已移除 — 自评弹窗统一由 checkDisclaimerNeeded 管理

    // 找到第一个 in_progress 的 stage 作为当前阶段
    var currentStepIdx = 0;
    for (var si = 0; si < allStages.length; si++) {
      if (allStages[si].status === 'in_progress') {
        var mapped = _toStepIdx(allStages[si].phaseId || '', allStages[si].order);
        // P0-02: mapped=-1表示未知phaseId，按order兜底计算避免回退到步骤1
        if (mapped === -1) {
          // 兜底: 按全局order比例映射到7步
          var ratio = allStages.length > 1 ? si / (allStages.length - 1) : 0;
          mapped = Math.max(1, Math.min(6, Math.round(ratio * 6)));
        }
        currentStepIdx = Math.max(0, mapped);
        break;
      }
    }
    // P0-02: 全阶段完成 → currentStepIdx=7 (所有步骤标记done), 不再回退到步骤1
    // 同时修复: 找不到in_progress但未全完成时，按最后一个completed推算
    if (currentStepIdx === 0) {
      if (allStages.length > 0 && doneCount === allStages.length) {
        currentStepIdx = 7;
      } else if (doneCount > 0 && doneCount < allStages.length) {
        // 有完成但无进行中: 找到最后完成的stage + 1
        var lastCompletedIdx = 0;
        for (var sj = allStages.length - 1; sj >= 0; sj--) {
          if (allStages[sj].status === 'completed') {
            var cm = _toStepIdx(allStages[sj].phaseId || '', allStages[sj].order);
            if (cm >= 1) { lastCompletedIdx = cm; break; }
          }
        }
        currentStepIdx = Math.min(lastCompletedIdx + 1, 6);
      } else {
        currentStepIdx = 1;
      }
    }
    // P2-01: assessmentDone 与 activeProcess 解耦说明
    // activeProcess存在即表示用户已完成资格评估(选择或评估了路径)
    // 该变量仅用于标记SEVEN_STEPS[0]的done/current状态，不参与其他逻辑
    var assessmentDone = !!activeProcess;

    const phases = SEVEN_STEPS.map((step, i) => {
      const isAssessment = step.hasAssessBtn;
      let status;
      if (isAssessment) {
        status = assessmentDone ? 'done' : 'current';
      } else if (i < currentStepIdx) {
        status = 'done';
      } else if (i === currentStepIdx) {
        status = 'current';
      } else {
        status = 'pending';
      }
      const mats = stepMaterials[i] || [];
      return {
        ...step,
        stepIndex: i,
        status,
        isMilestone: constants.STAGE_BRIDGE_MAP.ui_stages[i] ? constants.STAGE_BRIDGE_MAP.ui_stages[i].isMilestone : false,
        milestoneDocType: constants.STAGE_BRIDGE_MAP.ui_stages[i] ? constants.STAGE_BRIDGE_MAP.ui_stages[i].milestoneDocType : null,
        materials: mats,
        materialCount: mats.length,
        doneCount: mats.filter(m => m.status === 'completed').length,
        // 材料准备步骤 → 链接到证件夹
        linkDocs: step.linkDocs && status !== 'pending'
      };
    });

    // P1-03: 已完成检测 — 材料全部completed的步骤标记为done
    // 防御currentStepIdx映射错误导致的进度回退假象
    phases.forEach(function(ph) {
      if (ph.status !== 'done' && !ph.hasAssessBtn && ph.materialCount > 0 && ph.doneCount === ph.materialCount) {
        ph.status = 'done';
      }
    });

    this.setData({
      activeProcess,
      phases,
      progress,
      expandedPhaseIdx: currentStepIdx,
      // 同步7阶段指示器
      stageSteps: SEVEN_STEPS.map((s, i) => ({
        id: s.id,
        label: s.name,
        status: i < currentStepIdx ? 'done' : i === currentStepIdx ? 'active' : 'pending'
      })),
      stageProgress: Math.round((currentStepIdx / 7) * 100)
    });
    } catch (e) {
      console.error('[流程控] loadActiveProcess 异常:', e);
      // 降级：清空流程数据，让用户重新选择
      this.setData({
        activeProcess: null,
        phases: [],
        progress: 0,
        expandedPhaseIdx: -1,
        stageProgress: 0
      });
      wx.showToast({ title: '流程数据加载失败，请重新创建', icon: 'none' });
    }
  },

  // 展开/折叠阶段
  togglePhase(e) {
    const idx = parseInt(e.currentTarget.dataset.index);
    const phase = this.data.phases[idx];
    if (!phase || phase.phaseId === 'assessment') return; // 评估阶段不可折叠
    this.setData({ expandedPhaseIdx: this.data.expandedPhaseIdx === idx ? -1 : idx });
  },

  // 点击步骤 → 跳转对应操作
  handleStep(e) {
    const { stageId } = e.currentTarget.dataset;
    const stage = (this.data.activeProcess?.stages || []).find(s => s.id === stageId);
    if (!stage) return;
    if (!stage.unlocked) {
      wx.showToast({ title: '请先完成上一阶段', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/subpkg-process/pages/process-detail/index?id=${this.data.activeProcess.id}&focus=${stageId}`
    });
  },

  // 模板选择
  toggleTemplateSelect() { this.setData({ showTemplateSelect: !this.data.showTemplateSelect }); },
  catchStop() {},
  closeDisclaimer() { this.setData({ showDisclaimer: false }); },
  showSelfAssessDisclaimer() {
    this.setData({ showSelfAssessPopup: true });
  },
  closeSelfAssessPopup() {
    this.setData({ showSelfAssessPopup: false });
  },

  // ===== 指标说明弹窗 =====
  showCycleHelp() {
    this.setData({
      showHelpPopup: true,
      helpTitle: '⏱ 预计总周期',
      helpBody: '从首次申请到获得香港永久居民身份的预计总时长。不同路径因审批流程、签证年限和续签要求不同而存在差异。\n\n"7年"为最短标准路径（如高才通、专才），"7-8年"含额外评估/准备时间（如优才），"8-9年"含投资审查期（如CIES）。\n\n该估算基于入境处公开指引和多数申请人实践经验，个案可能因材料完整性、审批排队等因素有所延长。'
    });
  },

  showRiskHelp() {
    this.setData({
      showHelpPopup: true,
      helpTitle: '🛡 路径风险等级',
      helpBody: '综合评估该身份路径的申请被拒概率、续签难度和政策稳定性。\n\n🟢 低风险：政策明确、审批透明、续签条件稳定，被拒率通常低于10%。如高才通A/B类、专才、CIES。\n\n🟡 中风险：存在一定不确定性，如优才计分制主观性、高才通C类名额限制、部分路径续签需证明"通常居住"。\n\n🔴 高风险：政策变动频繁、审批尺度收紧或对申请人背景要求苛刻。\n\n风险等级基于入境处公开数据和行业实践评估，仅供参考，不构成保证。'
    });
  },

  closeHelpPopup() {
    this.setData({ showHelpPopup: false });
  },

  // 不在页面加载时弹窗打扰用户
  checkDisclaimerNeeded() {},
  confirmDisclaimer() {
    this.setData({ showDisclaimerPopup: false, disclaimerConfirmed: true });
  },
  closeDisclaimerPopup() {
    this.setData({ showDisclaimerPopup: false });
  },

  selectTemplate(e) {
    var gate = canMakeDecision();
    if (!gate.ok) {
      this.setData({ showGateSheet: true, gateMode: gate.reason, pendingTemplateId: e.currentTarget.dataset.id });
      return;
    }
    const templateId = e.currentTarget.dataset.id;
    const template = this.data.templates.find(t => t.id === templateId);
    if (!template) return;

    const stages = [];
    if (template.phases) {
      template.phases.forEach((phase, pi) => {
        (phase.steps || []).forEach((step, si) => {
          stages.push({
            id: step.id || `${phase.id}_s${si}`,
            order: stages.length,
            name: step.name,
            phaseId: phase.id,
            phaseName: phase.name,
            phaseOrder: pi,
            confidence: step.confidence || phase.confidence || 'B',
            steps: [step.name],
            status: pi === 0 && si === 0 ? 'current' : 'pending',
            unlocked: pi === 0 && si === 0,
            completedSteps: [],
            progress: 0,
            startedAt: pi === 0 && si === 0 ? new Date().toISOString() : null
          });
        });
      });
    }

    const processLine = {
      id: `manual_${Date.now()}`,
      name: template.name,
      templateId,
      pathType: template.pathType,
      riskLevel: template.riskLevel,
      totalCycle: template.totalCycle,
      decisionPoints: template.decisionPoints || [],
      phases: template.phases || [],
      stages,
      status: 'active',
      progress: 0,
      currentStage: stages[0]?.name || '',
      readyMaterials: 0,
      totalMaterials: stages.length,
      createdAt: new Date().toISOString(),
      source: 'manual'
    };

    saveProcessLine(processLine);
    // ★ 封存旧路径提醒
    var oldPath = app.globalData.selectedPath || wx.getStorageSync('__selected_path__') || '';
    var newPath = template.pathType || templateId;
    if (oldPath && oldPath !== newPath) {
      require('../../../utils/storage').archiveRemindersByPath(oldPath);
    }
    app.globalData.selectedPath = template.pathType || templateId;
    app.globalData.activeProcessId = processLine.id;
    app.globalData.activeProcess = processLine;
    app.globalData.userStatus = 'unapplied';  // P1-01: 重置状态双写
    wx.setStorageSync('__active_process_id__', processLine.id);
    wx.setStorageSync('__selected_path__', template.pathType || templateId);
    require('../../../utils/storage').unarchiveRemindersByPath(newPath);
    wx.setStorageSync('__process_stage__', 0);  // P1-01: 重置阶段

    // 追踪：流程创建
    tracker.track('process_created', {
      pathType: template.pathType || templateId,
      pathLabel: template.name,
      source: processLine.source || 'manual',
      riskLevel: template.riskLevel,
      totalCycle: template.totalCycle
    });

    this.setData({ showTemplateSelect: false });
    wx.showToast({ title: '流程已创建', icon: 'success' });
    this.loadActiveProcess();
  },
  onGatePassed: function() {
    var id = this.data.pendingPathId;
    var templateId = this.data.pendingTemplateId;
    this.setData({ showGateSheet: false, gateMode: '', pendingPathId: '', pendingPathLabel: '', pendingTemplateId: '' });
    if (id) {
      this.onSelectDirectPath({ currentTarget: { dataset: { id: id } } });
    } else if (templateId) {
      this.selectTemplate({ currentTarget: { dataset: { id: templateId } } });
    }
  },
  onGateDismiss: function() {
    this.setData({ showGateSheet: false, gateMode: '', pendingPathId: '', pendingPathLabel: '', pendingTemplateId: '' });
  },
  togglePathExpand: function(e) {
    var id = e.currentTarget.dataset.id;
    this.setData({ expandedPathId: this.data.expandedPathId === id ? '' : id, showDirectPathPicker: true });
  },
  catchStop: function() {},

  onShareAppMessage() {
    return { title: '我正在使用住港伴，你也来看看', path: '/pages/process/index/index' };
  }
});
