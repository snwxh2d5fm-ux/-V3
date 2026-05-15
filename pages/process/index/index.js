// 住港伴 v5 — 流程控首页（内联详情版）
const app = getApp();
const { getGlobalStages, getActiveStageIndex } = require('../../../utils/stage-helper');
const constants = require('../../../data/constants');
const templates = require('../../../data/templates.js');
const { getAllProcessLines, getProcessLine, saveProcessLine } = require('../../../utils/storage');
const tracker = require('../../../utils/tracker');

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
    showDisclaimer: false,

    // 空状态·模板选择
    showTemplateSelect: false,
    templates: templates.processTemplates,

    // 直接选择路径
    showDirectPathPicker: false,
    directSelectedPath: '',
    directSelectedPathLabel: '',
    directPathOptions: [
      { id: 'qmas', name: '优才计划', icon: '🎯', desc: '综合计分制 · 12项准则≥6项' },
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
    disclaimerConfirmed: false
  },

  onShow() {
    try { this.setData({ stageSteps: getGlobalStages(), stageProgress: Math.min(((getActiveStageIndex() + 1) / 7) * 100, 100) }); } catch(e) { this.setData({ stageProgress: 14 }); }
    try {
      var userStatus = app.globalData.userStatus || wx.getStorageSync(constants.STORAGE_KEYS.USER_STATUS);
      this.setData({
        isSkipped: userStatus === 'skipped',
        isUnapplied: userStatus === 'unapplied'
      });
      this.loadActiveProcess();
      // Bug #13: 检查是否需要风险提醒
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
    for (var i = 0; i < opts.length; i++) {
      if (opts[i].id === id) { label = opts[i].name; break; }
    }
    this.setData({ directSelectedPath: id, directSelectedPathLabel: label });
  },

  onConfirmDirectPath() {
    var path = this.data.directSelectedPath;
    if (!path) return;
    wx.setStorageSync('__direct_path__', path);
    app.globalData.selectedPath = path;
    wx.switchTab({ url: '/pages/guidebooks/index/index' });
  },

  startAssessment() {
    const persona = wx.getStorageSync('__assessment_persona__') || app.globalData._persona || 0;
    wx.navigateTo({ url: `/pages/assessment/index/index?persona=${persona}` });
  },

  goToDocuments() {
    wx.switchTab({ url: '/pages/documents/index/index' });
  },

  // v5 快捷入口 (DSG-1 P0-01: 双中枢合并)
  goToGuide() {
    wx.navigateTo({ url: '/pages/guide/index/index' });
  },
  goToPrecheck() {
    const documents = require('../../../utils/storage').getAllDocuments();
    if (documents.length >= 4) {
      wx.navigateTo({ url: '/pages/precheck/index/index' });
    } else {
      wx.showToast({ title: '请先添加至少4份材料', icon: 'none' });
    }
  },
  goToInfo() {
    wx.navigateTo({ url: '/pages/info/index/index' });
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
      // 无流程但用户已选路径+状态→自动创建流程并定位阶段
      var session = wx.getStorageSync('__session__') || {};
      var userStatus = app.globalData.userStatus || session.userStatus || 'unapplied';
      var selectedPath = app.globalData.selectedPath || session.selectedPath || '';
      if (selectedPath && userStatus !== 'unapplied') {
        var stageMap = { submitted: 3, approved: 4, permanent: 6 };
        var startStep = stageMap[userStatus] || 0;
        var pathNames = { qmas:'优才计划', ttps_a:'高才通A类', ttps_b:'高才通B类', ttps_c:'高才通C类', asmpt:'专才计划', student_iang:'学生→IANG', dependent:'受养人', cies:'CIES投资类身份规划' };
        var mockProcess = {
          name: pathNames[selectedPath] || selectedPath,
          pathway: selectedPath,
          stages: [
            { id:'stg_eval', name:'资格评估', phaseId:'phase0_evaluation', order:0, status:'completed' },
            { id:'stg_prep', name:'材料准备', phaseId:'phase1_preparation', order:1, status:'completed' },
            { id:'stg_submit', name:'线上申请', phaseId:'phase2_onboarding', order:0, status:'completed' },
            { id:'stg_wait', name:'等待获批', phaseId:'phase2_onboarding', order:1, status:startStep > 3 ? 'completed' : 'in_progress' },
            { id:'stg_activate', name:'获批激活', phaseId:'phase2_onboarding', order:2, status:startStep > 4 ? 'completed' : (startStep === 4 ? 'in_progress' : 'pending') },
            { id:'stg_settle', name:'抵港生活', phaseId:'phase3_maintenance', order:0, status:startStep > 5 ? 'completed' : (startStep === 5 ? 'in_progress' : 'pending') },
            { id:'stg_pr', name:'永居', phaseId:'phase4_pr', order:0, status:startStep === 6 ? 'in_progress' : 'pending' }
          ]
        };
        var mockPhases = [
          { id:'evaluation', name:'资格评估', icon:'🎯', stepIndex:0, status:startStep>0?'done':'current', materials:[], materialCount:0, doneCount:0, hasAssessBtn:true, linkDocs:false },
          { id:'preparation', name:'材料准备', icon:'📋', stepIndex:1, status:startStep>1?'done':(startStep===1?'current':'pending'), materials:[{id:'m1',name:'身份证明文件',status:startStep>1?'completed':'locked'},{id:'m2',name:'学历证明',status:startStep>1?'completed':'locked'},{id:'m3',name:'工作证明',status:startStep>1?'completed':'locked'},{id:'m4',name:'资产证明',status:startStep>1?'completed':'locked'}], materialCount:4, doneCount:startStep>1?4:0, hasAssessBtn:false, linkDocs:true },
          { id:'submission', name:'线上申请', icon:'📤', stepIndex:2, status:startStep>2?'done':(startStep===2?'current':'pending'), materials:[], materialCount:0, doneCount:0, hasAssessBtn:false, linkDocs:false },
          { id:'waiting', name:'等待获批', icon:'⏳', stepIndex:3, status:startStep>3?'done':(startStep===3?'current':'pending'), materials:[], materialCount:0, doneCount:0, hasAssessBtn:false, linkDocs:false },
          { id:'activation', name:'获批激活', icon:'✅', stepIndex:4, status:startStep>4?'done':(startStep===4?'current':'pending'), materials:[], materialCount:0, doneCount:0, hasAssessBtn:false, linkDocs:false },
          { id:'settlement', name:'抵港生活', icon:'🏠', stepIndex:5, status:startStep>5?'done':(startStep===5?'current':'pending'), materials:[], materialCount:0, doneCount:0, hasAssessBtn:false, linkDocs:false },
          { id:'pr', name:'永居', icon:'🏁', stepIndex:6, status:startStep===6?'current':'pending', materials:[], materialCount:0, doneCount:0, hasAssessBtn:false, linkDocs:false }
        ];
        var doneCount = mockProcess.stages.filter(function(s){return s.status==='completed';}).length;
        var prog = Math.round((doneCount / mockProcess.stages.length) * 100);
        this.setData({ activeProcess: mockProcess, phases: mockPhases, progress: prog, materialDoneCount: doneCount, materialTotalCount: mockProcess.stages.length, expandedPhaseIdx: startStep });
        return;
      }
      this.setData({ activeProcess: null, phases: [], progress: 0, expandedPhaseIdx: -1 });
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

    // 模板4阶段 → 7步映射（phase1 实际是材料准备，资格评估独立）
    allStages.forEach(s => {
      const pid = s.phaseId || '';
      let stepIdx = -1;

      if (pid.includes('phase1') || pid.includes('evaluation'))  stepIdx = 1;  // → 材料准备
      else if (pid.includes('phase2') || pid.includes('onboarding')) {
        // phase2 拆分为：线上申请(2) / 等待获批(3) / 获批激活(4)
        const o = s.order || 0;
        const total = allStages.filter(ss => (ss.phaseId||'').includes('phase2')||(ss.phaseId||'').includes('onboarding')).length;
        if (total <= 3) { stepIdx = [2,3,4][o] ?? 4; }
        else { stepIdx = o < total/3 ? 2 : o < total*2/3 ? 3 : 4; }
      }
      else if (pid.includes('phase3') || pid.includes('maintenance')) stepIdx = 5;  // → 抵港生活
      else if (pid.includes('phase4') || pid.includes('pr'))         stepIdx = 6;  // → 永居

      if (stepIdx >= 1 && stepIdx < 7) stepMaterials[stepIdx].push(s);
    });

    var doneCount = allStages.filter(function(s) { return s.status === 'completed'; }).length;
    var progress = allStages.length > 0 ? Math.round((doneCount / allStages.length) * 100) : 0;
    this.setData({ materialDoneCount: doneCount, materialTotalCount: allStages.length });
    // 仅0%完成度时出示免责声明
    // showDisclaimer 已移除 — 自评弹窗统一由 checkDisclaimerNeeded 管理

    // 当前阶段：资格评估完成后 → 材料准备解锁
    // 资格评估的状态：有 activeProcess 即表示已完成
    const assessmentDone = !!activeProcess;
    let currentStepIdx = assessmentDone ? 1 : 0;

    // 在材料准备及之后找第一个未完成的
    for (let i = 1; i < 7; i++) {
      const mats = stepMaterials[i];
      if (mats.length > 0 && mats.every(m => m.status === 'completed')) continue;
      if (mats.length === 0 && i > currentStepIdx) continue; // 空步骤保持 current 不变
      // 关键：如果该步骤所有 material 都处于 locked 状态，说明尚未解锁，不应视为当前步骤
      if (mats.length > 0 && mats.every(m => m.unlocked === false)) continue;
      if (i <= currentStepIdx) continue; // 已完成不回溯
      currentStepIdx = i;
      break;
    }

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
        materials: mats,
        materialCount: mats.length,
        doneCount: mats.filter(m => m.status === 'completed').length,
        // 材料准备步骤 → 链接到证件夹
        linkDocs: step.linkDocs && status !== 'pending'
      };
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
      url: `/pages/process/detail/detail?id=${this.data.activeProcess.id}&focus=${stageId}`
    });
  },

  // 模板选择
  toggleTemplateSelect() { this.setData({ showTemplateSelect: !this.data.showTemplateSelect }); },
  catchStop() {},
  closeDisclaimer() { this.setData({ showDisclaimer: false }); },
  showSelfAssessDisclaimer() {
    this.setData({
      showDisclaimerPopup: true,
      disclaimerType: 'self_assessed',
      disclaimerTitle: '自评数据说明',
      disclaimerBody: '此数据由用户自行评估填写，并非香港入境事务处官方认可。\n\n请在提交申请前自行核准所有标准与信息。\n\n官方申请标准请以入境处官网 immd.gov.hk 最新公布为准。'
    });
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
    app.globalData.selectedPath = template.pathType || templateId;
    app.globalData.activeProcessId = processLine.id;
    app.globalData.activeProcess = processLine;
    wx.setStorageSync('__active_process_id__', processLine.id);
    wx.setStorageSync('__selected_path__', template.pathType || templateId);

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
  }
});
