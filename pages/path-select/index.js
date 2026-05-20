// 住港伴 — 身份路径选择页（独立页面，供status-badge路径标签点击跳转）
const app = getApp();
const templates = require('../../data/templates.js');
const { getAllProcessLines, saveProcessLine } = require('../../utils/storage');
const constants = require('../../data/constants');
const { canMakeDecision } = require('../../utils/decision-gate');
const { buildPhase2Stages, isPhase2Onboarding, toStageObject, autoCompletePhase1 } = require('../../utils/phase-builder');

Page({
  data: {
    pathOptions: [
      { id: 'qmas', name: '优才计划', icon: '', desc: '12项评核准则 · 满足≥6项可申请' },
      { id: 'ttps_a', name: '高才通A类', icon: '', desc: '年收入≥250万港币' },
      { id: 'ttps_b', name: '高才通B类', icon: '', desc: '百强本科+3年工作经验' },
      { id: 'ttps_c', name: '高才通C类', icon: '', desc: '百强本科(<3年经验)·限额' },
      { id: 'asmpt', name: '专才计划', icon: '', desc: '已获香港雇主聘用' },
      { id: 'student_iang', name: '学生→IANG', icon: '', desc: '香港高校毕业后留港' },
      { id: 'dependent', name: '受养人签证', icon: '', desc: '配偶/子女随行来港' },
      { id: 'cies', name: 'CIES投资类身份规划', icon: '', desc: '投资≥3000万港币' }
    ],
    submitting: false,
    showGateSheet: false,
    gateMode: '',
    pendingPathId: '',
    pendingPathLabel: '',
  },

  onSelect(e) {
    if (this.data.submitting) return;
    var id = e.currentTarget.dataset.id;
    var opts = this.data.pathOptions;
    var label = '';
    for (var i = 0; i < opts.length; i++) {
      if (opts[i].id === id) { label = opts[i].name; break; }
    }
    var gate = canMakeDecision();
    if (!gate.ok) {
      this.setData({ showGateSheet: true, gateMode: gate.reason, pendingPathId: id, pendingPathLabel: label });
      return;
    }

    this.setData({ submitting: true });

    // 1. 清除旧流程
    var oldLines = getAllProcessLines();
    if (Array.isArray(oldLines)) {
      oldLines.forEach(function(l) { if (l && l.status === 'active') { l.status = 'inactive'; saveProcessLine(l); } });
    }
    wx.setStorageSync('__process_stage__', 1);
    wx.setStorageSync('__active_process_id__', '');
    wx.setStorageSync('__selected_path__', id);

    // 2. 构建本地流程线，phase2拆为4个独立里程碑阶段
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
      source: 'path_select'
    };

    saveProcessLine(processLine);
    app.globalData.activeProcessId = processLine.id;
    app.globalData.activeProcess = processLine;
    app.globalData.selectedPath = id;
    app.globalData.userStatus = 'unapplied';
    wx.setStorageSync('__active_process_id__', processLine.id);
    wx.setStorageSync('__process_stage__', 1);

    // 3. 同步创建云端流程（P0-CR-03: 8秒超时保护）
    var cloudTimeout = new Promise(function(_, reject) {
      setTimeout(function() { reject(new Error('CLOUD_TIMEOUT')); }, 8000);
    });
    Promise.race([
      wx.cloud.callFunction({
        name: 'process-manager',
        data: { action: 'start', templateId: id }
      }),
      cloudTimeout
    ]).then(function(startRes) {
      if (startRes && startRes.result && startRes.result.code === 0 && startRes.result.data) {
        var cloudId = startRes.result.data.processId;
        var savedProcessId = processLine.id;
        var lines = getAllProcessLines();
        var line = lines.find(function(l) { return l.id === savedProcessId; });
        if (line) { line.cloudId = cloudId; saveProcessLine(line); }
        app.globalData.activeProcess.cloudId = cloudId;
        app.globalData.activeProcess._cloudId = cloudId;
      }
    }).catch(function(e) {
      if (e && e.message === 'CLOUD_TIMEOUT') {
        console.warn('[路径选择] 云端流程创建超时(8s)，本地流程已保存');
      } else {
        console.warn('[路径选择] 云端流程创建失败:', e);
      }
    });

    // 4. 跳回流程控
    wx.showToast({ title: '已选择：' + label, icon: 'success', duration: 1000 });
    setTimeout(function() {
      wx.switchTab({ url: '/pages/process/index/index' });
    }, 1200);
  },
  onGatePassed: function() {
    var id = this.data.pendingPathId;
    var label = this.data.pendingPathLabel;
    this.setData({ showGateSheet: false, gateMode: '', pendingPathId: '', pendingPathLabel: '' });
    if (id) { this.onSelect({ currentTarget: { dataset: { id: id } } }); }
  },
  onGateDismiss: function() {
    this.setData({ showGateSheet: false, gateMode: '', pendingPathId: '', pendingPathLabel: '' });
  },
});
