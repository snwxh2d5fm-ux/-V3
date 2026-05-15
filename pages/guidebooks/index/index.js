/**
 * 住港伴 v6 — 攻略书主页 (港漂通关手册)
 *
 * 三Tab框架: 生活指南 | 场景速查 | 我的进度
 * 数据源: queryLifeGuideTasks 云函数 → lifeGuideCache 缓存层
 */
var cache = require('../../../utils/lifeGuideCache');
var storage = require('../../../utils/onboarding-storage');

Page({
  data: {
    activeTab: 0,
    tabs: [
      { id: 0, label: '生活指南' },
      { id: 1, label: '场景速查' },
      { id: 2, label: '我的进度' },
      { id: 3, label: '攻略精选' }
    ],
    phases: [],
    tasks: [],
    summary: { totalRequired: 0, totalTasks: 0 },
    progress: null,
    renewalDossier: null,
    readiness: null,
    activeCategory: '全部',
    browseTasks: [],
    articles: [],
    articleLoading: false,
    loading: true,
    loadError: false,
    showPathSetup: false,
    showMilestone: false,
    milestoneMsg: '',
    dataSource: '',
    housingWizardDone: false,
    showHousingWizard: false,
    wizardStep: 0,
    wizardBudget: '',
    wizardWork: '',
    wizardHasKids: false,
    wizardResults: [],
    currentPhase: 0,
    setupStep: 0,
    setupData: { visaType: '', familyStatus: '', arrivalScenario: '', housingIntent: '', existingAssets: [] },
    selectedAssets: {},
    expandedBrowseTask: null,
    expandedBrowseTaskId: '',
    expandedBrowseContent: '',
    assetOptions: [
      { v: 'hkid', l: '香港身份证' },
      { v: 'bank-account', l: '银行户口' },
      { v: 'rental', l: '已签租约' },
      { v: 'driving-license', l: '香港驾照' }
    ]
  },

  onLoad: function() { this.init(); },
  onShow: function() { if (this.data.progress) this.refreshProgress(); },
  onPullDownRefresh: function() {
    var self = this;
    cache.invalidateCache();
    this.init().finally(function() { wx.stopPullDownRefresh(); });
  },

  init: function() {
    var self = this;
    if (self._loading) return;
    self._loading = true;
    // 清除旧缓存以修复云端数据重复问题(一次性)
    if (!wx.getStorageSync('__cache_cleared_v2__')) {
      cache.invalidateCache();
      wx.setStorageSync('__cache_cleared_v2__', true);
    }
    self.setData({ loading: true, loadError: false });

    var progress = storage.getProgress();
    if (!progress) {
      // 读取直接选路径或评估预填数据
      var prefill = null;
      var directPath = null;
      try { prefill = wx.getStorageSync('__assess_prefill__'); } catch(e) {}
      try { directPath = wx.getStorageSync('__direct_path__'); } catch(e) {}
      if (!directPath) { directPath = (getApp().globalData && getApp().globalData.selectedPath) || ''; }
      if (directPath || (prefill && prefill.recommendedPath)) {
        var pathMap = { 'qmas':'qmas', 'ttps':'ttps-bc', 'ttps_a':'ttps-a', 'ttps_b':'ttps-b', 'ttps_c':'ttps-c', 'asmpt':'asmpt', 'iang':'iang', 'student_iang':'iang', 'dependent':'dependent', 'cies':'dependent', 'ttps-a':'ttps-a', 'ttps-bc':'ttps-bc' };
        var familyMap = { '单身':'single', '已婚无子女':'couple', '已婚有子女（1个）':'preschool', '已婚有子女（2个+）':'preschool' };
        var presetVisa = directPath ? (pathMap[directPath] || directPath) : (pathMap[prefill.recommendedPath] || '');
        var presetFamily = prefill ? (familyMap[prefill.familyStatus] || '') : '';
        var sd = { visaType: presetVisa, familyStatus: presetFamily, arrivalScenario: '', housingIntent: '', existingAssets: [] };
        wx.removeStorageSync('__direct_path__');
        self._loading = false;
        self.setData({
          loading: false, showPathSetup: true,
          setupStep: presetVisa ? 1 : 0,
          setupData: sd,
          selectedAssets: {}
        });
        return;
      }
      self._loading = false;
      self.setData({ loading: false, showPathSetup: true });
      return;
    }

    var params = progress.pathParams;
    cache.fetchByPath(params.visaType, params.familyStatus, params.arrivalScenario, params.existingAssets)
      .then(function(result) {
        self._loading = false;
        if (!result || !result.data) {
          self.setData({ loading: false, loadError: true });
          return;
        }
        var tasks = result.data.tasks || result.data.data || result.data || [];
        var merged = self.mergeProgress(tasks, progress);
        self.setData({
          pathConfigured: true, phases: merged.phases, tasks: merged.tasks,
          summary: merged.summary, progress: progress,
          renewalDossier: progress.renewalDossier || {},
          currentPhase: progress.currentPhase || 0,
          dataSource: result.fromCache ? 'cache' : (result.stale ? 'stale' : 'cloud'),
          loading: false, loadError: false
        });
      })
      .catch(function(e) {
        console.error('[Guidebooks]', e);
        self._loading = false;
        self.setData({ loading: false, loadError: true });
      });
  },

  mergeProgress: function(tasks, progress) {
    var progressTasks = progress.tasks || {};
    var phaseNames = { 0:'抵港前准备',1:'落地生存',2:'行政开户',3:'安居乐业',4:'出行融入',5:'子女教育',6:'财务税务',7:'续签准备' };
    var phaseMap = {};

    // 去重: 按_id和title双重去重，防止云端数据重复
    var seenId = {};
    var seenTitle = {};
    tasks = tasks.filter(function(t) {
      var id = t._id || '';
      var title = t.title || '';
      if (id && seenId[id]) return false;
      if (title && seenTitle[title]) return false;
      if (id) seenId[id] = true;
      if (title) seenTitle[title] = true;
      return true;
    });

    tasks.forEach(function(t) {
      var pt = progressTasks[t._id];
      t._completed = pt ? (pt.status === 'completed' || pt.status === 'skipped') : false;
      t._materialCollected = pt ? !!pt.materialCollected : false;
      t._skipped = pt ? pt.status === 'skipped' : (t.autoSkipped || false);
      t._skipReason = pt ? (pt.skipReason || '') : (t.skipReason || '');
      t._urgencyClass = t.urgency === '必修' ? 'required' : (t.urgency === '建议' ? 'suggest' : 'optional');

      var p = t.phase;
      if (!phaseMap[p]) {
        phaseMap[p] = { phase: p, name: phaseNames[p] || '', totalRequired: 0, totalTasks: 0, requiredCompleted: 0, unlocked: true };
      }
      phaseMap[p].totalTasks++;
      if (t.urgency === '必修' && !t._skipped) phaseMap[p].totalRequired++;
      if (t.urgency === '必修' && t._completed) phaseMap[p].requiredCompleted++;
    });

    var phases = Object.keys(phaseMap).map(function(k) { return phaseMap[k]; }).sort(function(a,b){ return a.phase-b.phase; });
    // Lock phases based on progress.phases[].unlocked instead of numeric phase comparison
    if (progress.currentPhase !== undefined) {
      phases.forEach(function(ph) { if (!(progress.phases && progress.phases[ph.phase] && progress.phases[ph.phase].unlocked)) ph.unlocked = false; });
    }

    return { tasks: tasks, phases: phases, summary: { totalRequired: Object.keys(phaseMap).map(function(k){return phaseMap[k]}).reduce(function(s,p){return s+p.totalRequired;},0), totalTasks: tasks.length } };
  },

  refreshProgress: function() {
    var progress = storage.getProgress();
    if (!progress) return;
    var self = this;
    var tasks = this.data.tasks;
    var progressTasks = progress.tasks || {};
    tasks.forEach(function(t) { var pt = progressTasks[t._id]; if (pt) { t._completed = pt.status === 'completed' || pt.status === 'skipped'; t._materialCollected = !!pt.materialCollected; t._skipped = pt.status === 'skipped'; } });
    var merged = self.mergeProgress(tasks, progress);
    this.setData({ tasks: merged.tasks, phases: merged.phases, progress: progress, renewalDossier: progress.renewalDossier || {} });
  },

  // ── Path setup dialog ──
  onPathConfirm: function(e) {
    var params = e.detail;
    storage.initOnboarding(params);
    this.setData({ showPathSetup: false });
    this.init();
  },

  // ── Tab switching ──
  switchTab: function(e) {
    var tabId = parseInt(e.currentTarget.dataset.tab);
    this.setData({ activeTab: tabId });
    if (tabId === 1 && this.data.browseTasks.length === 0) this.loadBrowse('全部');
    if (tabId === 3 && this.data.articles.length === 0) this.loadArticles();
  },

  loadArticles: function() {
    var self = this;
    self.setData({ articleLoading: true });
    // 优先用本地48篇攻略填充，映射字段供旧详情页读取
    var localGuides = require('../../../data/guidebook-data');
    var rawCards = localGuides.getAllCards ? localGuides.getAllCards() : [];
    if (rawCards.length > 0) {
      var mapped = rawCards.map(function(c) { return {
        id: c.id, title: c.title, knowledge_domain: c.category, topics: c.tags || [],
        summary: c.desc || '', usefulCount: c.helpful || 0, imageUrl: '',
        publishDate: c.updated || '', source: c.source || ''
      }; });
      wx.setStorageSync('__guides_cache__', mapped);
      self.setData({ articles: mapped, articleLoading: false });
      return;
    }
    // 兜底: 云端加载
    wx.cloud.callFunction({
      name: 'guidebook',
      data: { action: 'getArticles', limit: 50 },
      success: function(res) {
        var articles = (res.result && res.result.data && res.result.data.articles) || [];
        if (articles.length > 0) wx.setStorageSync('__guides_cache__', articles);
        self.setData({ articles: articles, articleLoading: false });
      },
      fail: function() {
        self.setData({ articleLoading: false });
      }
    });
  },

  onArticleTap: function(e) {
    var id = e.currentTarget.dataset.id;
    if (id) {
      wx.navigateTo({ url: '/pages/guide/detail/detail?id=' + id });
    }
  },
  onTaskToggle: function(e) {
    var taskId = e.currentTarget.dataset.id;
    var task = this.data.tasks.find(function(t) { return t._id === taskId; });
    if (!task || task._completed) return;
    storage.completeTask(taskId);
    this.refreshProgress();
    this.checkPhaseComplete(task.phase);
  },

  checkPhaseComplete: function(phase) {
    var phaseTasks = this.data.tasks.filter(function(t) { return t.phase === phase && !t._skipped; });
    var required = phaseTasks.filter(function(t) { return t.urgency === '必修'; });
    var completed = required.filter(function(t) { return t._completed; });
    var milestones = { 1:{n:4,m:'🎉 生存模式通关！'}, 2:{n:5,m:'🎉 行政关卡通关！'}, 3:{n:5,m:'🏠 家已安好。'}, 4:{n:5,m:'🚗 你不再是游客了。'}, 5:{n:4,m:'📚 孩子的学校已就位。'}, 6:{n:4,m:'💰 财务系统已运转。'}, 7:{n:3,m:'✅ 续签就绪。'} };
    var m = milestones[phase];
    if (m && completed.length >= m.n) {
      storage.completePhase(phase);
      this.setData({ showMilestone: true, milestoneMsg: m.m });
      var self = this;
      setTimeout(function() { self.setData({ showMilestone: false }); }, 2500);
    }
  },

  // ── Tab 1: Scene browse ──
  loadBrowse: function(category) {
    var self = this;
    self.setData({ activeCategory: category });
    var promise = category === '全部' ? cache.fetchAllTasks() : cache.fetchTasks('bySceneTags', { tags: [category] });
    promise.then(function(r) { 
      if (r && r.data) {
        var tasks = r.data.tasks || r.data.data || (Array.isArray(r.data) ? r.data : []);
        self.setData({ browseTasks: tasks }); 
      }
    });
  },
  onCategoryTap: function(e) { this.loadBrowse(e.currentTarget.dataset.category); },
  onBrowseTaskTap: function(e) {
    var id = e.currentTarget.dataset.id;
    if (!id) return;
    var tasks = this.data.browseTasks;
    var task = null;
    for (var i = 0; i < tasks.length; i++) {
      if (tasks[i]._id === id) { task = tasks[i]; break; }
    }
    if (!task) return;
    // 已展开则收起
    if (task._id === this.data.expandedBrowseTaskId) {
      this.setData({ expandedBrowseTask: null, expandedBrowseTaskId: '' });
      return;
    }
    // 从task对象聚合所有可用字段生成详情HTML
    var lines = [];
    var desc = task.desc || task.description || task.content || task.summary || task.subtitle || '';
    if (desc) lines.push(desc);
    // 步骤 — 兼容多种字段名
    var steps = task.steps || task.step_list || [];
    if (steps.length) {
      lines.push('');
      lines.push('【步骤指引】');
      steps.forEach(function(s) { lines.push('• ' + (typeof s === 'string' ? s : (s.title || s.content || s.name || ''))); });
    }
    // 材料
    var mats = task.requiredItems || task.required_items || task.material_list || task.materials || [];
    if (mats.length) {
      lines.push('');
      lines.push('【所需材料】');
      mats.forEach(function(m) { lines.push('📎 ' + (typeof m === 'string' ? m : (m.name || m.label || ''))); });
    }
    // 贴士
    var tips = task.tips || task.hints || task.tip_list || [];
    if (tips.length) {
      lines.push('');
      lines.push('【小贴士】');
      tips.forEach(function(t) { lines.push('💡 ' + (typeof t === 'string' ? t : (t.text || t.content || ''))); });
    }
    // 坑点
    var pits = task.pitfalls || task.warnings || task.pitfall_list || [];
    if (pits.length) {
      lines.push('');
      lines.push('【常见坑点】');
      pits.forEach(function(p) { lines.push('⚠️ ' + (typeof p === 'string' ? p : (p.text || p.content || ''))); });
    }
    // 链接
    var links = task.official_links || task.officialLinks || task.links || task.officialLinks || [];
    if (links.length) {
      lines.push('');
      lines.push('【参考链接】');
      links.forEach(function(l) { lines.push('🔗 ' + (typeof l === 'string' ? l : (l.label || l.url || ''))); });
    }
    // 通过 applicable_to 显示适用范围
    if (task.applicable_to) {
      var at = task.applicable_to;
      var tags = [];
      if (at.visa_types && at.visa_types !== 'all') tags.push('适用路径: ' + (Array.isArray(at.visa_types) ? at.visa_types.join('/') : at.visa_types));
      if (at.family_status && at.family_status !== 'all') tags.push('家庭: ' + (Array.isArray(at.family_status) ? at.family_status.join('/') : at.family_status));
      if (at.skip_if_existing && at.skip_if_existing.length) tags.push('已有资产可跳过');
      if (tags.length) { lines.push(''); lines.push('【适用范围】'); tags.forEach(function(t) { lines.push(t); }); }
    }
    // 兜底：显示所有简单字段
    var stringKeys = Object.keys(task).filter(function(k) {
      return k[0] !== '_' && task[k] !== null && task[k] !== undefined &&
        typeof task[k] !== 'object' &&
        ['title','subtitle','urgency','time_estimate','scene_tags','phase','sequence','status','desc','description','content','steps','tips','pitfalls','links'].indexOf(k) === -1;
    });
    if (stringKeys.length) {
      lines.push('');
      lines.push('【其他信息】');
      stringKeys.forEach(function(k) { lines.push(k + ': ' + task[k]); });
    }
    this.setData({
      expandedBrowseTask: task,
      expandedBrowseTaskId: task._id,
      expandedBrowseContent: lines.join('\n')
    });
  },

  // ── Tab 2: Export ──
  onExportDossier: function() {
    var text = storage.exportChecklist();
    if (text) wx.setClipboardData({ data: text, success: function() { wx.showToast({ title: '已复制到剪贴板', icon: 'success' }); } });
  },

  // ── Phase tap: expand/collapse ──
  onPhaseTap: function(e) {
    var phase = parseInt(e.currentTarget.dataset.phase);
    var phases = this.data.phases;
    var self = this;
    phases = phases.map(function(p) {
      if (p.phase === phase && p.unlocked !== false) { p.expanded = !p.expanded; }
      return p;
    });
    this.setData({ phases: phases });
    // Auto-expand current phase on first view
    var progress = this.data.progress;
    if (progress && progress.currentPhase !== undefined && phase === progress.currentPhase) {
      // always expanded
    }
  },

  onTaskExpand: function(e) {
    var taskId = e.currentTarget.dataset.id;
    var tasks = this.data.tasks;
    tasks.forEach(function(t) { if (t._id === taskId) t._expanded = !t._expanded; });
    this.setData({ tasks: tasks });
  },

  onStepCheck: function(e) {
    var taskId = e.currentTarget.dataset.taskId;
    var stepSeq = parseInt(e.currentTarget.dataset.step);
    var tasks = this.data.tasks;
    var task = tasks.find(function(t) { return t._id === taskId; });
    if (!task) return;
    task['_step' + stepSeq] = !task['_step' + stepSeq];
    if (!task.steps || !task.steps.length) return;
    var allDone = task.steps.every(function(s) { return task['_step' + s.seq]; });
    task._allStepsDone = allDone;
    this.setData({ tasks: tasks });
    // If all steps done, auto-complete the task
    if (allDone && !task._completed) {
      this.onTaskToggle(e);
    }
  },

  onMaterialPrompt: function(e) {
    var taskId = e.currentTarget.dataset.id;
    var self = this;
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['camera', 'album'],
      success: function(res) {
        var task = self.data.tasks.find(function(t) { return t._id === taskId; });
        if (task && task.renewal_evidence) {
          var ev = task.renewal_evidence;
          storage.completeTaskWithMaterial(taskId, res.tempFilePaths[0], ev.doc_type || '', ev.doc_category || '');
          self.refreshProgress();
          wx.showToast({ title: '材料已收集', icon: 'success' });
        }
      }
    });
  },

  // ── Path setup (5-step wizard) ──

  onSetupNext: function(e) {
    var step = this.data.setupStep;
    var data = JSON.parse(JSON.stringify(this.data.setupData));
    var value = e.currentTarget.dataset.value;

    if (step === 0) data.visaType = value;
    else if (step === 1) data.familyStatus = value;
    else if (step === 2) data.arrivalScenario = value;
    else if (step === 3) data.housingIntent = value;
    else if (step === 4) {
      // Asset toggles
      var asset = value;
      var assets = data.existingAssets.slice();
      var selectedAssets = JSON.parse(JSON.stringify(this.data.selectedAssets));
      var idx = assets.indexOf(asset);
      if (idx >= 0) { assets.splice(idx, 1); selectedAssets[asset] = false; }
      else { assets.push(asset); selectedAssets[asset] = true; }
      data.existingAssets = assets;
      this.setData({ setupData: data, selectedAssets: selectedAssets });
      return;
    }

    this.setData({ setupStep: step + 1, setupData: data });
    // 进入步骤4时同步 selectedAssets
    if (step + 1 === 4) {
      var synced = {};
      (data.existingAssets || []).forEach(function(a) { synced[a] = true; });
      this.setData({ selectedAssets: synced });
    }
  },

  onSetupAssetToggle: function(e) {
    var asset = e.currentTarget.dataset.value;
    if (!asset) return;
    var setupData = JSON.parse(JSON.stringify(this.data.setupData));
    var selectedAssets = JSON.parse(JSON.stringify(this.data.selectedAssets));
    var assets = setupData.existingAssets || [];
    var idx = assets.indexOf(asset);
    if (idx >= 0) {
      assets.splice(idx, 1);
      selectedAssets[asset] = false;
    } else {
      assets.push(asset);
      selectedAssets[asset] = true;
    }
    setupData.existingAssets = assets;
    this.setData({ setupData: setupData, selectedAssets: selectedAssets });
  },

  onSetupBack: function() {
    var step = this.data.setupStep;
    if (step > 0) this.setData({ setupStep: step - 1 });
  },

  onSetupConfirm: function() {
    var params = this.data.setupData;
    storage.initOnboarding(params);
    this.setData({ showPathSetup: false, setupStep: 0, selectedAssets: {} });
    this.init();
  },

  onSetupQuick: function() {
    var params = { visaType: 'ttps-bc', familyStatus: 'single', arrivalScenario: 'fresh', housingIntent: 'undecided', existingAssets: [] };
    storage.initOnboarding(params);
    this.setData({ showPathSetup: false, setupStep: 0, selectedAssets: {} });
    this.init();
  },

  onRetry: function() { this.init(); },

  // ── Housing wizard ──
  onHousingBannerTap: function() { this.setData({ showHousingWizard: true, wizardStep: 0, wizardBudget: '', wizardWork: '', wizardHasKids: false }); },
  onWizardNext: function(e) {
    var step = this.data.wizardStep;
    var value = e.currentTarget.dataset.value;
    if (step === 0) this.setData({ wizardBudget: value });
    else if (step === 1) this.setData({ wizardWork: value });
    else if (step === 2) this.setData({ wizardHasKids: value === 'yes' });

    if (step === 2) {
      var districtData = require('../../../data/district-data');
      var budgetBrackets = districtData.BUDGET_BRACKETS;
      var budgetId = this.data.wizardBudget;
      var budgetValue = 10000;
      for (var bi = 0; bi < budgetBrackets.length; bi++) {
        if (budgetBrackets[bi].id === budgetId) { budgetValue = budgetBrackets[bi].min; break; }
      }
      var results = districtData.matchDistricts(budgetValue, this.data.wizardWork, this.data.wizardHasKids);
      results.forEach(function(r) {
        r.stars = r.familyFriendly ? new Array(r.familyFriendly + 1).join('⭐') : '⭐';
        r._hasSchoolNet = !!(r.schoolNet && r.schoolNet.primary > 0);
      });
      this.setData({ wizardStep: 3, wizardResults: results });
    } else {
      this.setData({ wizardStep: step + 1 });
    }
  },
  onWizardDone: function() {
    storage.completeTask('onboard-300');
    this.setData({ showHousingWizard: false, housingWizardDone: true });
    this.refreshProgress();
    var phases = this.data.phases;
    phases = phases.map(function(p) {
      if (p.phase === 3) p.expanded = true;
      return p;
    });
    this.setData({ phases: phases });
    wx.showToast({ title: '找房向导完成 ✓', icon: 'success' });
  },
  onWizardClose: function() { this.setData({ showHousingWizard: false }); }
});
