/**
 * 住港伴 v6.2 — 攻略书主页 (港漂通关手册)
 *
 * 四Tab框架: 生活指南 | 场景速查 | 我的进度 | 攻略精选
 * 数据源 (方案C): 本地 assemblePath 为主 → CloudBase queryLifeGuideTasks 为增强
 *   本地优先保证离线可用 + 数据完整; CloudBase 用于跨设备进度同步 (V2)
 */
var cache = require('../../../utils/lifeGuideCache');
var storage = require('../../../utils/onboarding-storage');
var norm = require('../../../utils/normalizeTask');

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
    browseKeyword: '',
    browseTasks: [],
    browseTasksAll: [],  // Full unfiltered list for search
    articles: [],
    articleLoading: false,
    loading: true,
    loadError: false,
    showPathSetup: false,
    showMilestone: false,
    milestoneMsg: '',
    dataSource: '',
    // Housing wizard — persisted in storage.flags.housingWizardDone
    housingWizardDone: false,
    phase3Unlocked: false,
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
    articleCategory: '全部',
    expandedBrowseTask: null,
    expandedBrowseTaskId: '',
    showTaskDetail: false,
    taskDetail: {},
    assetOptions: [
      { v: 'hkid', l: '香港身份证' },
      { v: 'bank-account', l: '银行户口' },
      { v: 'rental', l: '已签租约' },
      { v: 'driving-license', l: '香港驾照' }
    ]
  },

  onLoad: function() { this.init(); },
  onShow: function() {
    if (this.data.progress) {
      this.refreshProgress();
      // Refresh housingWizardDone from storage (persists across sessions)
      this.setData({ housingWizardDone: storage.isHousingWizardDone() });
    }
  },
  onPullDownRefresh: function() {
    var self = this;
    cache.invalidateCache();
    try { self.init(); } catch(e) {}
    wx.stopPullDownRefresh();
  },

  /**
   * 方案C: 本地 assemblePath 为主数据源, CloudBase 为增强层
   *
   * 流程:
   *   1. 先从本地 assemblePath 取数据 (离线可用, 保证完整)
   *   2. 再异步从 CloudBase 拉取 (补充云端更新的任务 + 跨设备进度)
   *   3. 如果 CloudBase 有更新 → 静默替换; 如果失败 → 本地数据已就位
   */
  init: function() {
    var self = this;
    if (self._loading) return;
    self._loading = true;

    // One-time cache cleanup
    if (!wx.getStorageSync('__cache_cleared_v3__')) {
      cache.invalidateCache();
      wx.setStorageSync('__cache_cleared_v3__', true);
    }
    self.setData({ loading: true, loadError: false });

    var progress = storage.getProgress();
    if (!progress) {
      self._loading = false;
      // Check for prefill from assessment or direct path selection
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
        self.setData({
          loading: false, showPathSetup: true,
          setupStep: presetVisa ? 1 : 0,
          setupData: sd, selectedAssets: {}
        });
        return;
      }
      self.setData({ loading: false, showPathSetup: true });
      return;
    }

    // ── Step 1: Load from local assemblePath (primary, always works offline) ──
    var params = progress.pathParams;
    var localResult = null;
    try {
      localResult = cache.fetchByPathLocal(
        params.visaType, params.familyStatus, params.arrivalScenario, params.existingAssets
      );
    } catch (e) {
      console.error('[Guidebooks] local assemblePath failed:', e);
    }

    // Render local data immediately
    if (localResult && localResult.data) {
      var localTasks = localResult.data.tasks || [];
      var merged = self.mergeProgress(localTasks, progress);
      self.setData({
        pathConfigured: true,
        phases: merged.phases,
        tasks: merged.tasks,
        summary: merged.summary,
        progress: progress,
        renewalDossier: progress.renewalDossier || {},
        currentPhase: progress.currentPhase || 0,
        phase3Unlocked: merged.phase3Unlocked || false,
        housingWizardDone: storage.isHousingWizardDone(),
        dataSource: 'local',
        loading: false,
        loadError: false
      });
    }

    // ── Step 2: Try CloudBase for fresher / supplemental data ──
    cache.fetchByPath(params.visaType, params.familyStatus, params.arrivalScenario, params.existingAssets)
      .then(function(cloudResult) {
        self._loading = false;
        if (!cloudResult || !cloudResult.data) {
          // CloudBase unavailable — local data already rendered, nothing to do
          if (!localResult) {
            self.setData({ loading: false, loadError: true });
          }
          return;
        }
        var cloudTasks = cloudResult.data.tasks || cloudResult.data.data || cloudResult.data || [];

        // Merge CloudBase tasks with local: CloudBase wins on conflict, local fills gaps
        var combinedTasks = self.mergeCloudWithLocal(cloudTasks, localResult);
        var merged = self.mergeProgress(combinedTasks, progress);

        self.setData({
          phases: merged.phases,
          tasks: merged.tasks,
          summary: merged.summary,
          progress: progress,
          renewalDossier: progress.renewalDossier || {},
          currentPhase: progress.currentPhase || 0,
          phase3Unlocked: merged.phase3Unlocked || false,
          housingWizardDone: storage.isHousingWizardDone(),
          dataSource: cloudResult.fromCache ? 'cloud-cache' : (cloudResult.stale ? 'cloud-stale' : 'cloud'),
          loading: false,
          loadError: false
        });
      })
      .catch(function(e) {
        console.error('[Guidebooks] CloudBase fetch failed:', e);
        self._loading = false;
        // Local data already rendered — show stale indicator if localResult was null
        if (!localResult) {
          self.setData({ loading: false, loadError: true });
        }
      });
  },

  /**
   * Merge CloudBase tasks with local tasks.
   *
   * Strategy: match by title (since CloudBase _id ≠ local id).
   * When both exist, local content ALWAYS wins (steps/tips/pitfalls are
   * always complete in local onboarding-tasks.js, CloudBase may be truncated).
   * CloudBase provides only the _id for progress tracking.
   * Local-only tasks (new additions like onboard-300, 501a-507b) are appended.
   */
  mergeCloudWithLocal: function(cloudTasks, localResult) {
    var localTasks = (localResult && localResult.data && localResult.data.tasks) || [];
    if (!cloudTasks || !cloudTasks.length) return localTasks;
    if (!localTasks.length) return cloudTasks;

    // Build title → localTask index for matching
    var localByTitle = {};
    localTasks.forEach(function(lt) {
      if (lt.title) localByTitle[lt.title] = lt;
    });

    var combined = [];
    cloudTasks.forEach(function(ct) {
      var ctTitle = ct.title || '';
      var localMatch = ctTitle ? localByTitle[ctTitle] : null;
      if (localMatch) {
        // Both exist — clone from local (full content), carry CloudBase _id for progress
        var merged = JSON.parse(JSON.stringify(localMatch));
        if (ct._id) merged._id = ct._id;
        if (ct.status) merged.status = ct.status;
        combined.push(merged);
        // Mark consumed so we don't re-add as "local only"
        delete localByTitle[ctTitle];
      } else {
        // CloudBase-only task
        combined.push(ct);
      }
    });

    // Append remaining local tasks (not in CloudBase at all)
    Object.keys(localByTitle).forEach(function(title) {
      combined.push(localByTitle[title]);
    });

    return combined;
  },

  mergeProgress: function(tasks, progress) {
    var progressTasks = progress.tasks || {};
    var phaseNames = { 0:'抵港前准备',1:'落地生存',2:'行政开户',3:'安居乐业',4:'出行融入',5:'子女教育',6:'财务税务',7:'续签准备' };
    var phaseMap = {};

    // ── 规范化管线：一次性处理字段名/ID/渲染标记 ──
    tasks = tasks.map(function(t) { return norm(t, { progressEntry: progressTasks[t._id || t.id] }); });

    // 去重: 按_id和title双重去重
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

      var p = t.phase;
      if (!phaseMap[p]) {
        phaseMap[p] = { phase: p, name: phaseNames[p] || '', totalRequired: 0, totalTasks: 0, requiredCompleted: 0, unlocked: true };
      }
      phaseMap[p].totalTasks++;
      if (t.urgency === '必修' && !t._skipped) phaseMap[p].totalRequired++;
      if (t.urgency === '必修' && t._completed) phaseMap[p].requiredCompleted++;
    });

    var phases = Object.keys(phaseMap).map(function(k) { return phaseMap[k]; }).sort(function(a,b){ return a.phase-b.phase; });

    // Lock phases based on progress.phases[].unlocked
    // Compatible with old progress data: missing phases default to unlocked
    var phase3Unlocked = false;
    if (progress.currentPhase !== undefined) {
      phases.forEach(function(ph) {
        var stored = progress.phases && progress.phases[ph.phase];
        // Only lock if explicitly marked locked (backward compat: missing = unlocked)
        if (stored && stored.unlocked === false) {
          ph.unlocked = false;
        }
        if (ph.phase === 3 && ph.unlocked !== false) {
          phase3Unlocked = true;
        }
      });
    } else {
      phases.forEach(function(ph) {
        if (ph.phase === 3) phase3Unlocked = true;
      });
    }

    return {
      tasks: tasks,
      phases: phases,
      phase3Unlocked: phase3Unlocked,
      summary: {
        totalRequired: Object.keys(phaseMap).map(function(k){return phaseMap[k]}).reduce(function(s,p){return s+p.totalRequired;},0),
        totalTasks: tasks.length
      }
    };
  },

  refreshProgress: function() {
    var progress = storage.getProgress();
    if (!progress) return;
    var self = this;
    var tasks = this.data.tasks;
    var progressTasks = progress.tasks || {};
    tasks.forEach(function(t) {
      var pt = progressTasks[t._id];
      if (pt) {
        t._completed = pt.status === 'completed' || pt.status === 'skipped';
        t._materialCollected = !!pt.materialCollected;
        t._skipped = pt.status === 'skipped';
      }
    });
    var merged = self.mergeProgress(tasks, progress);
    this.setData({
      tasks: merged.tasks,
      phases: merged.phases,
      phase3Unlocked: merged.phase3Unlocked || false,
      progress: progress,
      renewalDossier: progress.renewalDossier || {}
    });
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
    var localGuides = require('../../../data/guidebook-data');
    var rawCards = localGuides.getAllCards ? localGuides.getAllCards() : [];
    if (rawCards.length > 0) {
      var mapped = rawCards.map(function(c) {
        var full = localGuides.getById ? localGuides.getById(c.id) : null;
        var layers = [];
        if (c.desc) layers.push({ id: 'overview', title: '概览', content: c.desc, open: true });
        if (full && full.sections) {
          full.sections.forEach(function(s, i) {
            layers.push({ id: 's' + i, title: s.heading || '', content: s.body || '', open: false });
          });
        }
        if (full && full.pitfalls && full.pitfalls.length) {
          layers.push({ id: 'pitfalls', title: '⚠️ 避坑指南', content: full.pitfalls.map(function(p, i) { return (i+1) + '. ' + p; }).join('\n'), open: false });
        }
        if (full && full.materials && full.materials.length) {
          layers.push({ id: 'materials', title: '📎 所需材料', content: full.materials.join('\n'), open: false });
        }
        if (c.source) layers.push({ id: 'source', title: '📜 信息来源', content: c.source + (c.updated ? '\n更新: ' + c.updated : ''), open: false });
        return {
          id: c.id, title: c.title, knowledge_domain: c.category, topics: c.tags || [],
          summary: c.desc || '', usefulCount: c.helpful || 0, imageUrl: '',
          publishDate: c.updated || '', source: c.source || '',
          layers: layers, lastUpdated: c.updated || ''
        };
      });
      wx.setStorageSync('__guides_cache__', mapped);
      self.setData({ articles: mapped, articleLoading: false });
      return;
    }
    wx.cloud.callFunction({
      name: 'guidebook',
      data: { action: 'getArticles', limit: 50 },
      success: function(res) {
        var articles = (res.result && res.result.data && res.result.data.articles) || [];
        if (articles.length > 0) wx.setStorageSync('__guides_cache__', articles);
        self.setData({ articles: articles, articleLoading: false });
      },
      fail: function() { self.setData({ articleLoading: false }); }
    });
  },

  onArticleCategory: function(e) {
    var cat = e.currentTarget.dataset.category;
    this.setData({ articleCategory: cat });
    var categoryMap = { '优才':'qmas', '高才通':'ttps', 'IANG':'iang', '专才':'asmpt', '生活':'life', '税务':'tax', '教育':'education' };
    var key = categoryMap[cat] || '';
    if (key) {
      var all = wx.getStorageSync('__guides_cache__') || [];
      this.setData({ articles: all.filter(function(a) { return a.knowledge_domain === key; }) });
    } else {
      this.setData({ articles: wx.getStorageSync('__guides_cache__') || [] });
    }
  },

  onArticleTap: function(e) {
    var id = e.currentTarget.dataset.id;
    if (id) { wx.navigateTo({ url: '/pages/guide/detail/detail?id=' + id }); }
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
    // 关卡0: 可选关，无需必修项即可自动通过（PRD v6.2 §2.2）
    // 但至少等用户完成一个任务再触发，避免页面加载即弹窗
    // 其他关卡: 须完成 ≥ 指定数量的必修项
    var milestones = {
      0: { n: 0, m: '🛫 出发前准备就绪！' },
      1: { n: 4, m: '🎉 生存模式通关！你已可以在香港独立出行和通讯。' },
      2: { n: 5, m: '🎉 行政关卡通关！银行、医疗、运动、图书馆全部就绪。' },
      3: { n: 5, m: '🏠 家已安好。你在香港有自己的窝了。' },
      4: { n: 5, m: '🚗 你不再是游客了。这座城市开始有你的生活痕迹。' },
      5: { n: 4, m: '📚 孩子的学校已就位。这是给家庭最大的安全感。' },
      6: { n: 4, m: '💰 你的财务系统已运转起来了。' },
      7: { n: 3, m: '✅ 续签一切就绪。你已经可以独立应对香港身份规划了。' }
    };
    var m = milestones[phase];
    var phaseHasCompletedTasks = phaseTasks.some(function(t) { return t._completed; });
    // 关卡0特殊处理: 至少完成一个任务才触发
    var shouldFire = (phase === 0)
      ? phaseHasCompletedTasks && completed.length >= m.n
      : (m && completed.length >= m.n);
    if (shouldFire) {
      storage.completePhase(phase);
      var nextPhase = phase + 1;
      // Auto-expand the next phase so user sees what's ahead
      var phases = this.data.phases.map(function(ph) {
        if (ph.phase === nextPhase && ph.unlocked !== false) ph.expanded = true;
        // Collapse completed phase
        if (ph.phase === phase) ph.expanded = false;
        return ph;
      });
      var p3u = false;
      phases.forEach(function(ph) { if (ph.phase === 3 && ph.unlocked !== false) p3u = true; });

      this.setData({
        showMilestone: true,
        milestoneMsg: m.m,
        currentPhase: nextPhase,
        phases: phases,
        phase3Unlocked: p3u
      });
      var self = this;
      setTimeout(function() {
        self.setData({ showMilestone: false });
      }, 3000);
    }
  },

  // ── Tab 1: Scene browse — PRD v6.2 §4.3: 结构化卡片 + 搜索 + 加入指南 ──

  /**
   * Load browse tasks by category — local-first, CloudBase supplement.
   * Mirrors Tab 0 architecture: local data renders immediately, CloudBase merges later.
   */
  loadBrowse: function(category) {
    var self = this;
    self.setData({ activeCategory: category, browseKeyword: '' });

    // Step 1: Load all local tasks immediately (always works, content complete)
    var localAll = self._loadAllLocalTasks();
    var localFiltered = category === '全部'
      ? localAll
      : localAll.filter(function(t) {
          var tags = t.scene_tags || [];
          return tags.indexOf(category) >= 0;
        });
    localFiltered = self._markBrowseCompletion(localFiltered);
    self.setData({ browseTasks: localFiltered, browseTasksAll: localFiltered });

    // Step 2: Try CloudBase as supplement (async, merges into existing data)
    var promise = category === '全部'
      ? cache.fetchAllTasks()
      : cache.fetchTasks('bySceneTags', { tags: [category] });

    promise.then(function(r) {
      var cloudTasks = [];
      if (r && r.data) {
        cloudTasks = r.data.tasks || r.data.data || (Array.isArray(r.data) ? r.data : []);
        cloudTasks = (Array.isArray(cloudTasks) ? cloudTasks : []).filter(function(t) {
          return t && typeof t.title === 'string' && t.title.length > 0;
        });
      }
      if (cloudTasks.length === 0) return; // Nothing to merge

      // Merge CloudBase tasks into local: title match → local content wins
      var localTitleMap = {};
      localAll.forEach(function(t) { if (t.title) localTitleMap[t.title] = t; });

      var merged = localAll.slice();
      cloudTasks.forEach(function(ct) {
        var lm = ct.title ? localTitleMap[ct.title] : null;
        if (lm) {
          // Local task exists — keep local _id for stable tap matching.
          // CloudBase _id is only used for progress in Tab 0, not Tab 1.
        } else {
          merged.push(norm(ct));
        }
      });

      // Re-filter and render
      var filtered = category === '全部'
        ? merged
        : merged.filter(function(t) {
            var tags = t.scene_tags || [];
            return tags.indexOf(category) >= 0;
          });
      filtered = self._markBrowseCompletion(filtered);
      self.setData({ browseTasks: filtered, browseTasksAll: filtered });
    }).catch(function(e) {
      console.error('[Browse] CloudBase supplement failed:', e);
      // Local data already rendered, nothing to do
    });
  },

  /** Load ALL local tasks (unfiltered by path) for full browse coverage */
  _loadAllLocalTasks: function() {
    var allTasks = require('../../../data/onboarding-tasks');
    return (Array.isArray(allTasks) ? allTasks : []).map(norm);
  },

  /** Deprecated: kept for reference, no longer primary path */
  _loadBrowseLocal: function(category) {
    var progress = storage.getProgress();
    if (!progress) return [];
    var params = progress.pathParams;
    var result = cache.fetchByPathLocal(params.visaType, params.familyStatus, params.arrivalScenario, params.existingAssets);
    var tasks = (result && result.data && result.data.tasks) || [];
    if (category !== '全部') {
      tasks = tasks.filter(function(t) {
        var tags = t.scene_tags || t.sceneTags || [];
        return tags.indexOf(category) >= 0;
      });
    }
    return tasks.map(norm);
  },

  /** Normalize + mark each browse task's completion status from user progress */
  _markBrowseCompletion: function(tasks) {
    var progress = storage.getProgress();
    var progressTasks = progress ? (progress.tasks || {}) : {};
    return tasks.map(function(t) {
      return norm(t, { progressEntry: progressTasks[t._id || t.id] });
    });
  },

  onCategoryTap: function(e) { this.loadBrowse(e.currentTarget.dataset.category); },

  /** Search — client-side filter on title + subtitle + scene_tags */
  onBrowseSearch: function(e) {
    var keyword = (e.detail.value || '').trim().toLowerCase();
    this.setData({ browseKeyword: keyword });
    if (!keyword) {
      this.setData({ browseTasks: this.data.browseTasksAll });
      return;
    }
    var filtered = (this.data.browseTasksAll || []).filter(function(t) {
      var title = (t.title || '').toLowerCase();
      var sub = (t.subtitle || '').toLowerCase();
      var tags = (t.scene_tags || t.sceneTags || []).join(' ').toLowerCase();
      return title.indexOf(keyword) >= 0 || sub.indexOf(keyword) >= 0 || tags.indexOf(keyword) >= 0;
    });
    this.setData({ browseTasks: filtered, expandedBrowseTaskId: '', expandedBrowseTask: null });
  },

  /** Toggle card expansion — shows structured detail, not text dump */
  onBrowseTaskTap: function(e) {
    var id = e.currentTarget.dataset.id;
    if (!id) return;
    if (id === this.data.expandedBrowseTaskId) {
      this.setData({ expandedBrowseTask: null, expandedBrowseTaskId: '' });
      return;
    }
    var task = null;
    var tasks = this.data.browseTasks;
    for (var i = 0; i < tasks.length; i++) {
      if (tasks[i]._id === id) { task = tasks[i]; break; }
    }
    if (!task) return;
    this.setData({ expandedBrowseTask: task, expandedBrowseTaskId: id });
  },

  /**
   * "加入我的生活指南" — inject task into Tab 0 guide list and auto-switch so
   * the user immediately sees where it landed.
   *
   * Flow:
   *   1. Mark task as in_progress in storage
   *   2. Inject task into this.data.tasks if not already present
   *   3. Rebuild phases (the task's phase may need unlocking)
   *   4. Auto-switch to Tab 0 + expand the target phase + scroll to the task
   */
  onBrowseAddToGuide: function(e) {
    var id = e.currentTarget.dataset.id;
    if (!id) return;
    var progress = storage.getProgress();
    if (!progress) {
      wx.showToast({ title: '请先完成路径设置', icon: 'none' });
      return;
    }

    // 1. Persist to storage
    if (!progress.tasks) progress.tasks = {};
    progress.tasks[id] = { status: 'in_progress', materialCollected: false };
    storage.saveProgress(progress);

    // 2. Find the full task object from browseTasks
    var browseTasks = this.data.browseTasks;
    var browseTask = null;
    for (var i = 0; i < browseTasks.length; i++) {
      if (browseTasks[i]._id === id) { browseTask = browseTasks[i]; break; }
    }

    // 3. Inject into Tab 0 task list if missing
    var mainTasks = this.data.tasks.slice();
    var existsInMain = false;
    for (var j = 0; j < mainTasks.length; j++) {
      if (mainTasks[j]._id === id) {
        mainTasks[j]._completed = false;
        mainTasks[j]._materialCollected = false;
        existsInMain = true;
        break;
      }
    }
    if (!existsInMain && browseTask) {
      var clone = norm(browseTask);
      clone._expanded = true; // Auto-expand so user sees it immediately
      mainTasks.push(clone);
    }

    // 4. Rebuild phases (may need to unlock the task's phase)
    var targetPhase = browseTask ? browseTask.phase : null;
    var merged = this.mergeProgress(mainTasks, progress);
    // Ensure the target phase is unlocked if it was locked
    if (targetPhase !== null) {
      if (!progress.phases) progress.phases = {};
      if (!progress.phases[String(targetPhase)]) {
        progress.phases[String(targetPhase)] = { unlocked: true, completed: false };
      } else {
        progress.phases[String(targetPhase)].unlocked = true;
      }
      storage.saveProgress(progress);
      // Re-merge with updated phases
      merged = this.mergeProgress(mainTasks, progress);
    }

    // 5. Expand the target phase in the rebuilt phases array
    var phases = merged.phases;
    for (var k = 0; k < phases.length; k++) {
      if (phases[k].phase === targetPhase) {
        phases[k].expanded = true;
        break;
      }
    }

    // 6. Update browse tab UI
    if (browseTask) {
      browseTask._completed = false;
      browseTask._materialCollected = false;
    }

    // 7. Auto-switch to Tab 0 so user sees where the task landed
    // Close task detail modal if it's open (加入 triggered from 了解详情 popup)
    this.setData({
      activeTab: 0,
      tasks: merged.tasks,
      phases: phases,
      summary: merged.summary,
      progress: progress,
      renewalDossier: progress.renewalDossier || {},
      phase3Unlocked: merged.phase3Unlocked || false,
      browseTasks: browseTasks,
      expandedBrowseTaskId: '',
      expandedBrowseTask: null,
      showTaskDetail: false,
      taskDetail: {}
    });

    wx.showToast({ title: '已加入生活指南', icon: 'success' });
  },

  /** "了解详情" — open task in a full-screen detail modal */
  onBrowseViewDetail: function(e) {
    var id = e.currentTarget.dataset.id;
    if (!id) return;
    var task = null;
    var tasks = this.data.browseTasks;
    for (var i = 0; i < tasks.length; i++) {
      if (tasks[i]._id === id) { task = tasks[i]; break; }
    }
    if (!task) return;
    this.setData({ showTaskDetail: true, taskDetail: norm(task) });
  },

  /** Close task detail modal */
  onTaskDetailClose: function() {
    this.setData({ showTaskDetail: false, taskDetail: {} });
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
    phases = phases.map(function(p) {
      if (p.phase === phase && p.unlocked !== false) { p.expanded = !p.expanded; }
      return p;
    });
    this.setData({ phases: phases });
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
    if (allDone && !task._completed) { this.onTaskToggle(e); }
  },

  onMaterialPrompt: function(e) {
    var taskId = e.currentTarget.dataset.id;
    var self = this;
    var task = self.data.tasks.find(function(t) { return t._id === taskId; });
    if (!task || !task.renewal_evidence) return;

    wx.chooseImage({
      count: 1, sizeType: ['compressed'], sourceType: ['camera', 'album'],
      success: function(res) {
        var filePath = res.tempFilePaths[0];
        // 保存到手机系统相册（不做任何上传或校验）
        wx.saveImageToPhotosAlbum({
          filePath: filePath,
          success: function() {
            var ev = task.renewal_evidence;
            // 仅标记材料已收集，不存储文件路径
            storage.completeTaskWithMaterial(taskId, '', ev.doc_type || '', ev.doc_category || '');
            self.refreshProgress();
            wx.showToast({ title: '已保存到相册', icon: 'success' });
          },
          fail: function() {
            // 授权被拒或保存失败，仍标记已收集
            storage.completeTaskWithMaterial(taskId, '', ev.doc_type || '', ev.doc_category || '');
            self.refreshProgress();
            wx.showToast({ title: '已标记完成', icon: 'success' });
          }
        });
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
    if (idx >= 0) { assets.splice(idx, 1); selectedAssets[asset] = false; }
    else { assets.push(asset); selectedAssets[asset] = true; }
    setupData.existingAssets = assets;
    this.setData({ setupData: setupData, selectedAssets: selectedAssets });
  },

  onSetupBack: function() {
    var step = this.data.setupStep;
    if (step > 0) this.setData({ setupStep: step - 1 });
  },

  onSetupConfirm: function() {
    var params = this.data.setupData;
    // Pass housingIntent through to storage so it's persisted
    storage.initOnboarding({
      visaType: params.visaType,
      familyStatus: params.familyStatus,
      arrivalScenario: params.arrivalScenario,
      housingIntent: params.housingIntent || 'undecided',
      existingAssets: params.existingAssets || []
    });
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
  onHousingBannerTap: function() {
    this.setData({ showHousingWizard: true, wizardStep: 0, wizardBudget: '', wizardWork: '', wizardHasKids: false });
  },

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
    // Persist housing wizard completion across sessions
    storage.markHousingWizardDone();
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
