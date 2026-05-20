// 住港伴 — 身份路径选择页（独立页面，供status-badge路径标签点击跳转）
const app = getApp();
const templates = require('../../data/templates.js');
const { getAllProcessLines, saveProcessLine } = require('../../utils/storage');

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
    submitting: false
  },

  onSelect(e) {
    if (this.data.submitting) return;
    var id = e.currentTarget.dataset.id;
    var opts = this.data.pathOptions;
    var label = '';
    for (var i = 0; i < opts.length; i++) {
      if (opts[i].id === id) { label = opts[i].name; break; }
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
        if ((p.id || '').includes('phase2') || (p.id || '').includes('onboarding')) {
          var phase2Stages = [
            { id: 'phase2_material_prep', name: '材料准备', order: (p.order||2)*10+1, isMilestone: true, milestoneDocType: '路径确认凭证', steps: (p.steps||[]).slice(0, Math.ceil((p.steps||[]).length/4)||1) },
            { id: 'phase2_submission', name: '线上申请', order: (p.order||2)*10+2, isMilestone: true, milestoneDocType: '递交回执/确认邮件', steps: (p.steps||[]).slice(Math.ceil((p.steps||[]).length/4)||1, 2) },
            { id: 'phase2_awaiting', name: '等待获批', order: (p.order||2)*10+3, isMilestone: true, milestoneDocType: '入境处受理回执', steps: [] },
            { id: 'phase2_activation', name: '获批激活', order: (p.order||2)*10+4, isMilestone: true, milestoneDocType: '签证/进入许可', steps: (p.steps||[]).slice(2) }
          ];
          phase2Stages.forEach(function(ps) {
            stages.push({
              stageId: ps.id, stageName: ps.name, order: ps.order,
              isMilestone: ps.isMilestone, milestoneDocType: ps.milestoneDocType,
              phaseId: p.id,
              status: stages.length === 0 ? 'in_progress' : 'locked',
              steps: (ps.steps || []).map(function(st) { return { stepId: st.id || '', stepName: st.name || '', status: 'pending', completedAt: null }; })
            });
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

    // ★ phase1_evaluation 选路径即完成，阶段从 phase2_material_prep 开始
    for (var si = 0; si < stages.length; si++) {
      if ((stages[si].stageId || '').includes('phase1') || (stages[si].stageId || '').includes('evaluation')) {
        stages[si].status = 'completed';
        stages[si].steps = (stages[si].steps || []).map(function(st) { return Object.assign({}, st, { status: 'completed', completedAt: new Date().toISOString() }); });
      } else if (stages[si].status === 'locked') {
        stages[si].status = 'in_progress';
        break;
      }
    }

    var processLine = {
      id: 'direct_' + Date.now(),
      name: label,
      templateId: id,
      pathType: id,
      riskLevel: 'medium',
      totalCycle: '7年',
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

    // 3. 同步创建云端流程
    wx.cloud.callFunction({
      name: 'process-manager',
      data: { action: 'start', templateId: id }
    }).then(function(startRes) {
      if (startRes.result && startRes.result.code === 0 && startRes.result.data) {
        var cloudId = startRes.result.data.processId;
        var savedProcessId = processLine.id;
        // 关联云端ID到本地流程线
        var lines = getAllProcessLines();
        var line = lines.find(function(l) { return l.id === savedProcessId; });
        if (line) { line.cloudId = cloudId; saveProcessLine(line); }
        // 更新全局
        app.globalData.activeProcess.cloudId = cloudId;
        app.globalData.activeProcess._cloudId = cloudId;
      }
    }).catch(function(e) {
      console.warn('[路径选择] 云端流程创建失败:', e);
    });

    // 4. 跳回流程控
    wx.showToast({ title: '已选择：' + label, icon: 'success', duration: 1000 });
    setTimeout(function() {
      wx.switchTab({ url: '/pages/process/index/index' });
    }, 1200);
  }
});
