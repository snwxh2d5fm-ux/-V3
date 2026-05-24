/**
 * 住港伴 v6.2 — 攻略书主页 (港漂通关手册)
 *
 * 四Tab框架: 生活指南 | 场景速查 | 我的进度 | 攻略精选
 * 数据源 (方案C): 本地 assemblePath 为主 → CloudBase queryLifeGuideTasks 为增强
 *   本地优先保证离线可用 + 数据完整; CloudBase 用于跨设备进度同步 (V2)
 */
const cache = require('../../../utils/lifeGuideCache');
const storage = require('../../../utils/onboarding-storage');
const norm = require('../../../utils/normalizeTask');
const wizards = require('../wizards');
const { getGlobalStages, getActiveStageIndex } = require('../../../utils/stage-helper');
const { canMakeDecision } = require('../../../utils/decision-gate');

Page({
  data: {
    activeTab: 0,
    tabs: [
      { id: 0, label: '生活指南' },
      { id: 1, label: '场景速查' },
      { id: 2, label: '我的进度' },
      { id: 3, label: '攻略精选' },
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
    browseTasksAll: [], // Full unfiltered list for search
    articles: [],
    articleLoading: false,
    loading: true,
    stageSteps: [],
    stageProgress: 0,
    loadError: false,
    showPathSetup: false,
    showMilestone: false,
    isMember: false,
    hasLockedPhases: false,
    milestoneMsg: '',
    dataSource: '',
    // Housing wizard — persisted in storage.flags.housingWizardDone
    housingWizardDone: false,
    phase3Unlocked: false,
    showHousingWizard: false,
    wizardStep: 0,
    wizardBudget: '',
    wizardWork: '',
    wizardSubRegion: '',
    wizardSubRegions: [],
    wizardHasKids: false,
    wizardResults: [],
    // 校网向导
    showSchoolNetWizard: false,
    snWizardStep: 0,
    snWizardLevel: '',
    snWizardRegion: '',
    snWizardBudget: '',
    snWizardResults: [],
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
      { v: 'driving-license', l: '香港驾照' },
    ],
  },

  onLoad: function () {
    this.init();
  },
  onShow: function () {
    // Sync global stage indicator (shared across all tabs)
    try {
      const stages = getGlobalStages();
      this.setData({ stageSteps: stages, stageProgress: Math.min(((getActiveStageIndex() + 1) / 7) * 100, 100) });
    } catch (e) {
      this.setData({ stageProgress: 14 });
    }

    // V4.2-fix: 恢复引擎写入后，如果 onLoad 时 progress 为 null 而错过了 init，
    // 从 storage 重新读取 onboarding 数据后再执行刷新
    if (this.data.progress) {
      this.refreshProgress();
      this.setData({ housingWizardDone: storage.isHousingWizardDone() });
      this._syncCloudProgress();
    } else {
      const recoveryApplied = wx.getStorageSync('__recovery_applied__');
      if (recoveryApplied) {
        this.init(); // 恢复后重新初始化攻略书
      }
    }
  },
  onPullDownRefresh: function () {
    const self = this;
    cache.invalidateCache();
    try {
      self.init();
    } catch (e) {}
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
  init: function () {
    const self = this;
    if (self._loading) return;
    self._loading = true;

    // One-time cache cleanup
    if (!wx.getStorageSync('__cache_cleared_v3__')) {
      cache.invalidateCache();
      wx.setStorageSync('__cache_cleared_v3__', true);
    }
    self.setData({ loading: true, loadError: false });

    const progress = storage.getProgress();
    if (!progress) {
      self._loading = false;
      // Check for prefill from assessment or direct path selection
      let prefill = null;
      let directPath = null;
      try {
        prefill = wx.getStorageSync('__assess_prefill__');
      } catch (e) {}
      try {
        directPath = wx.getStorageSync('__direct_path__');
      } catch (e) {}
      if (!directPath) {
        directPath = (getApp().globalData && getApp().globalData.selectedPath) || '';
      }
      if (directPath || (prefill && prefill.recommendedPath)) {
        const pathMap = {
          qmas: 'qmas',
          ttps: 'ttps-bc',
          ttps_a: 'ttps-a',
          ttps_b: 'ttps-b',
          ttps_c: 'ttps-c',
          asmpt: 'asmpt',
          iang: 'iang',
          student_iang: 'iang',
          dependent: 'dependent',
          cies: 'dependent',
          'ttps-a': 'ttps-a',
          'ttps-bc': 'ttps-bc',
        };
        const familyMap = {
          单身: 'single',
          已婚无子女: 'couple',
          '已婚有子女（1个）': 'preschool',
          '已婚有子女（2个+）': 'preschool',
        };
        const presetVisa = directPath ? pathMap[directPath] || directPath : pathMap[prefill.recommendedPath] || '';
        const presetFamily = prefill ? familyMap[prefill.familyStatus] || '' : '';
        const sd = {
          visaType: presetVisa,
          familyStatus: presetFamily,
          arrivalScenario: '',
          housingIntent: '',
          existingAssets: [],
        };
        wx.removeStorageSync('__direct_path__');
        self.setData({
          loading: false,
          showPathSetup: true,
          setupStep: presetVisa ? 1 : 0,
          setupData: sd,
          selectedAssets: {},
        });
        return;
      }
      self.setData({ loading: false, showPathSetup: true });
      return;
    }

    // ── Step 1: Load from local assemblePath (primary, always works offline) ──
    const params = progress.pathParams;
    const app = getApp();
    // 始终加载全部任务（从所有签证类型），关卡可见性由 mergeProgress 的解锁逻辑控制
    const unlockAll = true;
    let localResult = null;
    try {
      localResult = cache.fetchByPathLocal(
        params.visaType,
        params.familyStatus,
        params.arrivalScenario,
        params.existingAssets,
        unlockAll,
      );
    } catch (e) {
      console.error('[Guidebooks] local assemblePath failed:', e);
    }

    // Render local data immediately
    if (localResult && localResult.data) {
      const localTasks = localResult.data.tasks || [];
      const merged = self.mergeProgress(localTasks, progress);
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
        isMember: (getApp().globalData && getApp().globalData.membershipLevel !== 'free') || false,
        hasLockedPhases: merged.phases.some(function (p) {
          return p.unlocked === false;
        }),
        dataSource: 'local',
        loading: false,
        loadError: false,
      });
    }

    // ── Step 2: Try CloudBase for fresher / supplemental data ──
    cache
      .fetchByPath(params.visaType, params.familyStatus, params.arrivalScenario, params.existingAssets)
      .then(function (cloudResult) {
        self._loading = false;
        if (!cloudResult || !cloudResult.data) {
          // CloudBase unavailable — local data already rendered, nothing to do
          if (!localResult) {
            self.setData({ loading: false, loadError: true });
          }
          return;
        }
        const cloudTasks = cloudResult.data.tasks || cloudResult.data.data || cloudResult.data || [];

        // Merge CloudBase tasks with local: CloudBase wins on conflict, local fills gaps
        const combinedTasks = self.mergeCloudWithLocal(cloudTasks, localResult);
        const merged = self.mergeProgress(combinedTasks, progress);

        self.setData({
          phases: merged.phases,
          tasks: merged.tasks,
          summary: merged.summary,
          progress: progress,
          renewalDossier: progress.renewalDossier || {},
          currentPhase: progress.currentPhase || 0,
          phase3Unlocked: merged.phase3Unlocked || false,
          housingWizardDone: storage.isHousingWizardDone(),
          isMember: (getApp().globalData && getApp().globalData.membershipLevel !== 'free') || false,
          hasLockedPhases: merged.phases.some(function (p) {
            return p.unlocked === false;
          }),
          dataSource: cloudResult.fromCache ? 'cloud-cache' : cloudResult.stale ? 'cloud-stale' : 'cloud',
          loading: false,
          loadError: false,
        });
      })
      .catch(function (e) {
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
  mergeCloudWithLocal: function (cloudTasks, localResult) {
    const localTasks = (localResult && localResult.data && localResult.data.tasks) || [];
    if (!cloudTasks || !cloudTasks.length) return localTasks;
    if (!localTasks.length) return cloudTasks;

    // Build title → localTask index for matching
    const localByTitle = {};
    localTasks.forEach(function (lt) {
      if (lt.title) localByTitle[lt.title] = lt;
    });

    const combined = [];
    cloudTasks.forEach(function (ct) {
      const ctTitle = ct.title || '';
      const localMatch = ctTitle ? localByTitle[ctTitle] : null;
      if (localMatch) {
        // Both exist — clone from local (full content), carry CloudBase _id for progress
        const merged = JSON.parse(JSON.stringify(localMatch));
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
    Object.keys(localByTitle).forEach(function (title) {
      combined.push(localByTitle[title]);
    });

    return combined;
  },

  mergeProgress: function (tasks, progress) {
    const progressTasks = progress.tasks || {};
    const phaseNames = {
      0: '抵港前准备',
      1: '落地生存',
      2: '行政开户',
      3: '安居乐业',
      4: '出行融入',
      5: '子女教育',
      6: '财务税务',
      7: '续签准备',
    };
    const phaseMap = {};

    // ── 规范化管线：一次性处理字段名/ID/渲染标记 ──
    tasks = tasks.map(function (t) {
      return norm(t, { progressEntry: progressTasks[t._id || t.id] });
    });

    // 去重: 按_id和title双重去重
    const seenId = {};
    const seenTitle = {};
    tasks = tasks.filter(function (t) {
      const id = t._id || '';
      const title = t.title || '';
      if (id && seenId[id]) return false;
      if (title && seenTitle[title]) return false;
      if (id) seenId[id] = true;
      if (title) seenTitle[title] = true;
      return true;
    });

    tasks.forEach(function (t) {
      const p = t.phase;
      if (!phaseMap[p]) {
        phaseMap[p] = {
          phase: p,
          name: phaseNames[p] || '',
          totalRequired: 0,
          totalTasks: 0,
          requiredCompleted: 0,
          unlocked: true,
        };
      }
      phaseMap[p].totalTasks++;
      if (t.urgency === '必修' && !t._skipped) phaseMap[p].totalRequired++;
      if (t.urgency === '必修' && t._completed) phaseMap[p].requiredCompleted++;
    });

    // TC-3.1.1 fix: 补齐全部8关 (空关卡也渲染)
    for (let p = 0; p <= 7; p++) {
      if (!phaseMap[p]) {
        phaseMap[p] = {
          phase: p,
          name: phaseNames[p] || '关卡' + p,
          totalRequired: 0,
          totalTasks: 0,
          requiredCompleted: 0,
          unlocked: true,
        };
      }
    }
    const phases = Object.keys(phaseMap)
      .map(function (k) {
        return phaseMap[k];
      })
      .sort(function (a, b) {
        return a.phase - b.phase;
      });

    // ── 关卡解锁判定 (Phase 1: 双通道里程碑解锁) ──
    // 优先级: guidebookAllUnlocked(¥9.90) > 会员 > processStage(流程控联动) > 默认
    const BRIDGE = require('../../../data/constants').STAGE_BRIDGE_MAP;
    const app = getApp();
    const membershipLevel = (app.globalData && app.globalData.membershipLevel) || 'free';
    const guidebookAllUnlocked = (app.globalData && app.globalData.guidebookAllUnlocked) || false;

    // process_stage 读取 (默认0 = 流程控未推进, 关卡0~2始终解锁)
    let processStage = 0;
    try {
      const psVal = wx.getStorageSync('__process_stage__');
      if (psVal !== null && psVal !== undefined && psVal !== '' && !isNaN(Number(psVal))) {
        processStage = Math.max(0, Math.min(6, Number(psVal)));
      }
    } catch (e) {}
    // processStage already set

    const unlockState = BRIDGE.getGuideUnlockState(processStage);

    phases.forEach(function (ph) {
      // 优先级1: ¥9.90 或 会员 → 全部解锁
      if (guidebookAllUnlocked || membershipLevel !== 'free') {
        ph.unlocked = true;
        return;
      }
      // 优先级2: 流程控联动
      if (unlockState[ph.phase] !== undefined) {
        ph.unlocked = unlockState[ph.phase];
      } else {
        // 优先级3: 默认 (关卡0~2始终解锁)
        ph.unlocked = Number(ph.phase) <= 2;
      }
    });

    // 找房向导：关卡3任务存在且未被显式锁定即可见（不依赖 progress phases）
    const phase3Unlocked = phaseMap['3'] && phaseMap['3'].unlocked !== false;

    return {
      tasks: tasks,
      phases: phases,
      phase3Unlocked: phase3Unlocked,
      summary: {
        totalRequired: Object.keys(phaseMap)
          .map(function (k) {
            return phaseMap[k];
          })
          .reduce(function (s, p) {
            return s + p.totalRequired;
          }, 0),
        totalTasks: tasks.length,
      },
    };
  },

  refreshProgress: function () {
    const progress = storage.getProgress();
    if (!progress) return;
    const self = this;
    const tasks = this.data.tasks;
    const progressTasks = progress.tasks || {};
    tasks.forEach(function (t) {
      const pt = progressTasks[t._id];
      if (pt) {
        t._completed = pt.status === 'completed' || pt.status === 'skipped';
        t._materialCollected = !!pt.materialCollected;
        t._skipped = pt.status === 'skipped';
      }
    });
    const merged = self.mergeProgress(tasks, progress);
    this.setData({
      tasks: merged.tasks,
      phases: merged.phases,
      phase3Unlocked: merged.phase3Unlocked || false,
      progress: progress,
      renewalDossier: progress.renewalDossier || {},
    });
  },

  /**
   * P0-E fix: 从云端拉取进度，与本地合并
   *
   * 跨设备场景: 设备A完成的任务在设备B上通过本方法同步可见。
   * 策略: 云端时间戳更新 → 云端覆盖本地对应字段; 本地未同步的任务保留。
   */
  _syncCloudProgress: function () {
    const self = this;
    if (!wx.cloud || !wx.cloud.callFunction) return;
    wx.cloud
      .callFunction({
        name: 'guidebook-sync',
        data: { action: 'getProgress' },
      })
      .then(function (res) {
        if (!res || !res.result || res.result.code !== 0) return;
        const cloudData = res.result.data;
        if (!cloudData || !cloudData.progress) return;
        const cloudProgress = cloudData.progress;
        const localProgress = storage.getProgress();
        if (!localProgress) return;

        // Timestamp 比对: 云端更新则合并
        const cloudTime = cloudProgress.updatedAt ? new Date(cloudProgress.updatedAt).getTime() : 0;
        const localTime = localProgress.updatedAt ? new Date(localProgress.updatedAt).getTime() : 0;
        if (cloudTime <= localTime) return; // 本地已是最新

        // 云端更新 → 合并任务 (云端覆盖, 保留本地独有)
        if (cloudProgress.tasks) {
          if (!localProgress.tasks) localProgress.tasks = {};
          const cloudTasks = cloudProgress.tasks;
          for (const taskId in cloudTasks) {
            if (cloudTasks.hasOwnProperty(taskId)) {
              localProgress.tasks[taskId] = cloudTasks[taskId];
            }
          }
        }

        // 合并关卡状态
        if (cloudProgress.phases) {
          if (!localProgress.phases) localProgress.phases = {};
          const cloudPhases = cloudProgress.phases;
          for (const phaseKey in cloudPhases) {
            if (cloudPhases.hasOwnProperty(phaseKey)) {
              if (!localProgress.phases[phaseKey]) {
                localProgress.phases[phaseKey] = cloudPhases[phaseKey];
              } else if (cloudPhases[phaseKey].completed) {
                localProgress.phases[phaseKey].completed = true;
                localProgress.phases[phaseKey].completedAt = cloudPhases[phaseKey].completedAt;
              }
            }
          }
        }

        // 同步 currentPhase (取较大值)
        if (typeof cloudProgress.currentPhase === 'number') {
          localProgress.currentPhase = Math.max(localProgress.currentPhase || 0, cloudProgress.currentPhase);
        }

        // 持久化合并结果
        storage.saveProgress(localProgress);
        // 刷新 UI
        self.refreshProgress();
      })
      .catch(function (e) {
        console.warn('[Guidebooks] Cloud progress sync failed (non-blocking):', e && e.errMsg);
      });
  },

  // ── Path setup dialog ──
  onPathConfirm: function (e) {
    const params = e.detail;
    storage.initOnboarding(params);
    this.setData({ showPathSetup: false });
    this.init();
  },

  // ★ ¥9.90 即刻提前解锁全部关卡
  unlockAllPhasesPay: function () {
    const gate = canMakeDecision();
    if (!gate.ok) {
      wx.showModal({
        title: gate.reason === 'login' ? '需要登录' : '请先确认身份状态',
        content: '登录后即可购买解锁全部关卡。',
        confirmText: gate.reason === 'login' ? '去登录' : '去确认',
        cancelText: '稍后',
        success: function (res) {
          if (res.confirm) {
            wx.navigateTo({
              url: gate.reason === 'login' ? '/pages/login/login' : '/pages/status-select/status-select',
            });
          }
        },
      });
      return;
    }
    const self = this;
    wx.showLoading({ title: '处理中...' });
    wx.cloud
      .callFunction({
        name: 'payment',
        data: { action: 'unlockAllPhases' },
      })
      .then(function (res) {
        wx.hideLoading();
        if (res.result.code === 0) {
          const payData = res.result.data;
          if (!payData || !payData.payment || !payData.payment.timeStamp) {
            wx.showToast({ title: '支付参数异常，请重试', icon: 'none' });
            return;
          }
          const payParams = payData.payment;
          wx.requestPayment({
            timeStamp: payParams.timeStamp,
            nonceStr: payParams.nonceStr,
            package: payParams.package,
            signType: payParams.signType || 'RSA',
            paySign: payParams.paySign,
            success: function () {
              // ★ 先同步本地 globalData，再调 confirmPayment
              const app = getApp();
              app.globalData.guidebookAllUnlocked = true;
              wx.cloud
                .callFunction({
                  name: 'payment',
                  data: { action: 'confirmPayment', orderId: payData.orderId },
                })
                .then(function (confirmRes) {
                  if (confirmRes.result && confirmRes.result.code === 0) {
                    wx.showToast({ title: '全部关卡已解锁！', icon: 'success' });
                    self.init();
                  } else {
                    setTimeout(function () {
                      self.init();
                    }, 1500);
                    wx.showToast({ title: '订单确认中，稍后刷新查看', icon: 'none' });
                  }
                })
                .catch(function (err) {
                  console.error('[guidebooks] confirmPayment失败:', err);
                  setTimeout(function () {
                    self.init();
                  }, 1500);
                });
            },
            fail: function (err) {
              if (err.errMsg.indexOf('cancel') === -1) {
                wx.showToast({ title: '支付失败，请重试', icon: 'none' });
              }
            },
          });
        } else if (res.result.code === 409) {
          wx.showToast({ title: res.result.msg, icon: 'none' });
        } else {
          wx.showToast({ title: res.result.msg || '支付创建失败', icon: 'none' });
        }
      })
      .catch(function () {
        wx.hideLoading();
        wx.showToast({ title: '网络异常，请重试', icon: 'none' });
      });
  },

  // ★ 跳转会员中心
  goMembership: function () {
    const gate = canMakeDecision();
    if (!gate.ok) {
      wx.showModal({
        title: gate.reason === 'login' ? '需要登录' : '请先确认身份状态',
        content: '登录后可查看会员方案。',
        confirmText: gate.reason === 'login' ? '去登录' : '去确认',
        cancelText: '稍后',
        success: function (res) {
          if (res.confirm) {
            wx.navigateTo({
              url: gate.reason === 'login' ? '/pages/login/login' : '/pages/status-select/status-select',
            });
          }
        },
      });
      return;
    }
    wx.navigateTo({ url: '/subpkg-chat/pages/membership/index' });
  },

  // ── Tab switching ──
  switchTab: function (e) {
    const tabId = parseInt(e.currentTarget.dataset.tab);
    this.setData({ activeTab: tabId });
    if (tabId === 1 && this.data.browseTasks.length === 0) this.loadBrowse('全部');
    if (tabId === 3 && this.data.articles.length === 0) this.loadArticles();
  },

  loadArticles: function () {
    const self = this;
    self.setData({ articleLoading: true });
    const localGuides = require('../../../data/guidebook-cards');
    const rawCards = localGuides.getAllCards ? localGuides.getAllCards() : [];
    if (rawCards.length > 0) {
      const mapped = rawCards.map(function (c) {
        let full = null;
        try {
          const content = require('../../../data/guidebook-content');
          full = content ? content[c.id] : null;
        } catch (e) {}
        const layers = [];
        if (c.desc) layers.push({ id: 'overview', title: '概览', content: c.desc, open: true });
        if (full && full.sections) {
          full.sections.forEach(function (s, i) {
            layers.push({ id: 's' + i, title: s.heading || '', content: s.body || '', open: false });
          });
        }
        if (full && full.pitfalls && full.pitfalls.length) {
          layers.push({
            id: 'pitfalls',
            title: '⚠️ 避坑指南',
            content: full.pitfalls
              .map(function (p, i) {
                return i + 1 + '. ' + p;
              })
              .join('\n'),
            open: false,
          });
        }
        if (full && full.materials && full.materials.length) {
          layers.push({ id: 'materials', title: '📎 所需材料', content: full.materials.join('\n'), open: false });
        }
        if (c.source)
          layers.push({
            id: 'source',
            title: '📜 信息来源',
            content: c.source + (c.updated ? '\n更新: ' + c.updated : ''),
            open: false,
          });
        return {
          id: c.id,
          title: c.title,
          knowledge_domain: c.category,
          topics: c.tags || [],
          summary: c.desc || '',
          usefulCount: c.helpful || 0,
          imageUrl: '',
          publishDate: c.updated || '',
          source: c.source || '',
          layers: layers,
          lastUpdated: c.updated || '',
        };
      });
      wx.setStorageSync('__guides_cache__', mapped);
      self.setData({ articles: mapped, articleLoading: false });
      return;
    }
    wx.cloud.callFunction({
      name: 'guidebook',
      data: { action: 'getArticles', limit: 50 },
      success: function (res) {
        const articles = (res.result && res.result.data && res.result.data.articles) || [];
        if (articles.length > 0) wx.setStorageSync('__guides_cache__', articles);
        self.setData({ articles: articles, articleLoading: false });
      },
      fail: function () {
        self.setData({ articleLoading: false });
      },
    });
  },

  onArticleCategory: function (e) {
    const cat = e.currentTarget.dataset.category;
    this.setData({ articleCategory: cat });
    const categoryMap = {
      优才: 'qmas',
      高才通: 'ttps',
      IANG: 'iang',
      专才: 'asmpt',
      生活: 'life',
      税务: 'tax',
      教育: 'education',
    };
    const key = categoryMap[cat] || '';
    if (key) {
      const all = wx.getStorageSync('__guides_cache__') || [];
      this.setData({
        articles: all.filter(function (a) {
          return a.knowledge_domain === key;
        }),
      });
    } else {
      this.setData({ articles: wx.getStorageSync('__guides_cache__') || [] });
    }
  },

  onArticleTap: function (e) {
    const id = e.currentTarget.dataset.id;
    if (id) {
      wx.navigateTo({ url: '/subpkg-guide/pages/guide-detail/index?id=' + id });
    }
  },

  onTaskToggle: function (e) {
    const taskId = e.currentTarget.dataset.id || e.currentTarget.dataset.taskId;
    const task = this.data.tasks.find(function (t) {
      return t._id === taskId;
    });
    if (!task || task._completed) return;

    // 锁定关卡不可操作
    const phaseObj = this.data.phases.find(function (p) {
      return p.phase === task.phase;
    });
    if (phaseObj && phaseObj.unlocked === false) {
      wx.showToast({ title: '请先解锁本关卡', icon: 'none' });
      return;
    }

    storage.completeTask(taskId);
    this.refreshProgress();
    this.checkPhaseComplete(task.phase);
  },

  checkPhaseComplete: function (phase) {
    const phaseTasks = this.data.tasks.filter(function (t) {
      return t.phase === phase && !t._skipped;
    });
    const required = phaseTasks.filter(function (t) {
      return t.urgency === '必修';
    });
    const completed = required.filter(function (t) {
      return t._completed;
    });
    // 关卡0: 可选关，无需必修项即可自动通过（PRD v6.2 §2.2）
    // 但至少等用户完成一个任务再触发，避免页面加载即弹窗
    // 其他关卡: 须完成 ≥ 指定数量的必修项
    const milestones = {
      0: { n: 0, m: '🛫 出发前准备就绪！' },
      1: { n: 4, m: '🎉 生存模式通关！你已可以在香港独立出行和通讯。' },
      2: { n: 5, m: '🎉 行政关卡通关！银行、医疗、运动、图书馆全部就绪。' },
      3: { n: 5, m: '🏠 家已安好。你在香港有自己的窝了。' },
      4: { n: 5, m: '🚗 你不再是游客了。这座城市开始有你的生活痕迹。' },
      5: { n: 4, m: '📚 孩子的学校已就位。这是给家庭最大的安全感。' },
      6: { n: 4, m: '💰 你的财务系统已运转起来了。' },
      7: { n: 3, m: '✅ 续签一切就绪。你已经可以独立应对香港身份规划了。' },
    };
    const m = milestones[phase];
    const phaseHasCompletedTasks = phaseTasks.some(function (t) {
      return t._completed;
    });
    // 关卡0特殊处理: 至少完成一个任务才触发
    const shouldFire = phase === 0 ? phaseHasCompletedTasks && completed.length >= m.n : m && completed.length >= m.n;
    if (shouldFire) {
      storage.completePhase(phase);
      const nextPhase = phase + 1;
      // Auto-expand the next phase so user sees what's ahead
      const phases = this.data.phases.map(function (ph) {
        if (ph.phase === nextPhase && ph.unlocked !== false) ph.expanded = true;
        // Collapse completed phase
        if (ph.phase === phase) ph.expanded = false;
        return ph;
      });
      let p3u = false;
      phases.forEach(function (ph) {
        if (ph.phase === 3 && ph.unlocked !== false) p3u = true;
      });

      this.setData({
        showMilestone: true,
        milestoneMsg: m.m,
        currentPhase: nextPhase,
        phases: phases,
        phase3Unlocked: p3u,
      });
      const self = this;
      setTimeout(function () {
        self.setData({ showMilestone: false });
      }, 3000);
    }
  },

  // ── Tab 1: Scene browse — PRD v6.2 §4.3: 结构化卡片 + 搜索 + 加入指南 ──

  /**
   * Load browse tasks by category — local-first, CloudBase supplement.
   * Mirrors Tab 0 architecture: local data renders immediately, CloudBase merges later.
   */
  loadBrowse: function (category) {
    const self = this;
    self.setData({ activeCategory: category, browseKeyword: '' });

    // Step 1: Load all local tasks immediately (always works, content complete)
    const localAll = self._loadAllLocalTasks();
    let localFiltered =
      category === '全部'
        ? localAll
        : localAll.filter(function (t) {
            const tags = t.scene_tags || [];
            return tags.indexOf(category) >= 0;
          });
    localFiltered = self._markBrowseCompletion(localFiltered);
    self.setData({ browseTasks: localFiltered, browseTasksAll: localFiltered });

    // Step 2: Try CloudBase as supplement (async, merges into existing data)
    const promise = category === '全部' ? cache.fetchAllTasks() : cache.fetchTasks('bySceneTags', { tags: [category] });

    promise
      .then(function (r) {
        let cloudTasks = [];
        if (r && r.data) {
          cloudTasks = r.data.tasks || r.data.data || (Array.isArray(r.data) ? r.data : []);
          cloudTasks = (Array.isArray(cloudTasks) ? cloudTasks : []).filter(function (t) {
            return t && typeof t.title === 'string' && t.title.length > 0;
          });
        }
        if (cloudTasks.length === 0) return; // Nothing to merge

        // Merge CloudBase tasks into local: title match → local content wins
        const localTitleMap = {};
        localAll.forEach(function (t) {
          if (t.title) localTitleMap[t.title] = t;
        });

        const merged = localAll.slice();
        cloudTasks.forEach(function (ct) {
          const lm = ct.title ? localTitleMap[ct.title] : null;
          if (lm) {
            // Local task exists — keep local _id for stable tap matching.
            // CloudBase _id is only used for progress in Tab 0, not Tab 1.
          } else {
            merged.push(norm(ct));
          }
        });

        // Re-filter and render
        let filtered =
          category === '全部'
            ? merged
            : merged.filter(function (t) {
                const tags = t.scene_tags || [];
                return tags.indexOf(category) >= 0;
              });
        filtered = self._markBrowseCompletion(filtered);
        self.setData({ browseTasks: filtered, browseTasksAll: filtered });
      })
      .catch(function (e) {
        console.error('[Browse] CloudBase supplement failed:', e);
        // Local data already rendered, nothing to do
      });
  },

  /** Load ALL local tasks (unfiltered by path) for full browse coverage */
  _loadAllLocalTasks: function () {
    const allTasks = require('../../../data/onboarding-tasks');
    return (Array.isArray(allTasks) ? allTasks : []).map(norm);
  },

  /** Deprecated: kept for reference, no longer primary path */
  _loadBrowseLocal: function (category) {
    const progress = storage.getProgress();
    if (!progress) return [];
    const params = progress.pathParams;
    const result = cache.fetchByPathLocal(
      params.visaType,
      params.familyStatus,
      params.arrivalScenario,
      params.existingAssets,
    );
    let tasks = (result && result.data && result.data.tasks) || [];
    if (category !== '全部') {
      tasks = tasks.filter(function (t) {
        const tags = t.scene_tags || t.sceneTags || [];
        return tags.indexOf(category) >= 0;
      });
    }
    return tasks.map(norm);
  },

  /** Normalize + mark each browse task's completion status from user progress */
  _markBrowseCompletion: function (tasks) {
    const progress = storage.getProgress();
    const progressTasks = progress ? progress.tasks || {} : {};
    return tasks.map(function (t) {
      return norm(t, { progressEntry: progressTasks[t._id || t.id] });
    });
  },

  onCategoryTap: function (e) {
    this.loadBrowse(e.currentTarget.dataset.category);
  },

  /** Search — client-side filter on title + subtitle + scene_tags */
  onBrowseSearch: function (e) {
    const keyword = (e.detail.value || '').trim().toLowerCase();
    this.setData({ browseKeyword: keyword });
    if (!keyword) {
      this.setData({ browseTasks: this.data.browseTasksAll });
      return;
    }
    const filtered = (this.data.browseTasksAll || []).filter(function (t) {
      const title = (t.title || '').toLowerCase();
      const sub = (t.subtitle || '').toLowerCase();
      const tags = (t.scene_tags || t.sceneTags || []).join(' ').toLowerCase();
      return title.indexOf(keyword) >= 0 || sub.indexOf(keyword) >= 0 || tags.indexOf(keyword) >= 0;
    });
    this.setData({ browseTasks: filtered, expandedBrowseTaskId: '', expandedBrowseTask: null });
  },

  /** Toggle card expansion — shows structured detail, not text dump */
  onBrowseTaskTap: function (e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    if (id === this.data.expandedBrowseTaskId) {
      this.setData({ expandedBrowseTask: null, expandedBrowseTaskId: '' });
      return;
    }
    let task = null;
    const tasks = this.data.browseTasks;
    for (let i = 0; i < tasks.length; i++) {
      if (tasks[i]._id === id) {
        task = tasks[i];
        break;
      }
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
  onBrowseAddToGuide: function (e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const progress = storage.getProgress();
    if (!progress) {
      wx.showToast({ title: '请先完成路径设置', icon: 'none' });
      return;
    }

    // 1. Persist to storage
    if (!progress.tasks) progress.tasks = {};
    progress.tasks[id] = { status: 'in_progress', materialCollected: false };
    storage.saveProgress(progress);

    // 2. Find the full task object from browseTasks
    const browseTasks = this.data.browseTasks;
    let browseTask = null;
    for (let i = 0; i < browseTasks.length; i++) {
      if (browseTasks[i]._id === id) {
        browseTask = browseTasks[i];
        break;
      }
    }

    // 3. Inject into Tab 0 task list if missing
    const mainTasks = this.data.tasks.slice();
    let existsInMain = false;
    for (let j = 0; j < mainTasks.length; j++) {
      if (mainTasks[j]._id === id) {
        mainTasks[j]._completed = false;
        mainTasks[j]._materialCollected = false;
        existsInMain = true;
        break;
      }
    }
    if (!existsInMain && browseTask) {
      const clone = norm(browseTask);
      clone._expanded = true; // Auto-expand so user sees it immediately
      mainTasks.push(clone);
    }

    // 4. Rebuild phases (may need to unlock the task's phase)
    const targetPhase = browseTask ? browseTask.phase : null;
    let merged = this.mergeProgress(mainTasks, progress);
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
    const phases = merged.phases;
    for (let k = 0; k < phases.length; k++) {
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
      isMember: (getApp().globalData && getApp().globalData.membershipLevel !== 'free') || false,
      hasLockedPhases: phases.some(function (p) {
        return p.unlocked === false;
      }),
      browseTasks: browseTasks,
      expandedBrowseTaskId: '',
      expandedBrowseTask: null,
      showTaskDetail: false,
      taskDetail: {},
    });

    wx.showToast({ title: '已加入生活指南', icon: 'success' });
  },

  /** "了解详情" — open task in a full-screen detail modal */
  onBrowseViewDetail: function (e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    let task = null;
    const tasks = this.data.browseTasks;
    for (let i = 0; i < tasks.length; i++) {
      if (tasks[i]._id === id) {
        task = tasks[i];
        break;
      }
    }
    if (!task) return;
    this.setData({ showTaskDetail: true, taskDetail: norm(task) });
  },

  /** Close task detail modal */
  onTaskDetailClose: function () {
    this.setData({ showTaskDetail: false, taskDetail: {} });
  },

  // ── Tab 2: Export ──
  onExportDossier: function () {
    const text = storage.exportChecklist();
    if (text)
      wx.setClipboardData({
        data: text,
        success: function () {
          wx.showToast({ title: '已复制到剪贴板', icon: 'success' });
        },
      });
  },

  // ── Phase tap: expand/collapse ──
  onPhaseTap: function (e) {
    const phase = parseInt(e.currentTarget.dataset.phase);
    let phases = this.data.phases;
    const tp = phases.find(function (p) {
      return p.phase === phase;
    });
    // phase tap routing
    phases = phases.map(function (p) {
      if (p.phase === phase) {
        p.expanded = !p.expanded;
      }
      return p;
    });
    this.setData({ phases: phases });
  },

  onTaskExpand: function (e) {
    const taskId = e.currentTarget.dataset.id;
    const tasks = this.data.tasks;
    tasks.forEach(function (t) {
      if (t._id === taskId) t._expanded = !t._expanded;
    });
    this.setData({ tasks: tasks });
  },

  onStepCheck: function (e) {
    const taskId = e.currentTarget.dataset.taskId;
    const stepSeq = parseInt(e.currentTarget.dataset.step);
    const tasks = this.data.tasks;
    const task = tasks.find(function (t) {
      return t._id === taskId;
    });
    if (!task) return;
    task['_step' + stepSeq] = !task['_step' + stepSeq];
    if (!task.steps || !task.steps.length) return;
    const allDone = task.steps.every(function (s) {
      return task['_step' + s.seq];
    });
    task._allStepsDone = allDone;
    this.setData({ tasks: tasks });
    if (allDone && !task._completed) {
      this.onTaskToggle(e);
    }
  },

  onMaterialPrompt: function (e) {
    const taskId = e.currentTarget.dataset.id;
    const self = this;
    const task = self.data.tasks.find(function (t) {
      return t._id === taskId;
    });
    if (!task || !task.renewal_evidence) return;

    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['camera', 'album'],
      success: function (res) {
        const filePath = res.tempFilePaths[0];
        // 保存到手机系统相册（不做任何上传或校验）
        wx.saveImageToPhotosAlbum({
          filePath: filePath,
          success: function () {
            const ev = task.renewal_evidence;
            // 仅标记材料已收集，不存储文件路径
            storage.completeTaskWithMaterial(taskId, '', ev.doc_type || '', ev.doc_category || '');
            self.refreshProgress();
            wx.showToast({ title: '已保存到相册', icon: 'success' });
          },
          fail: function () {
            // 授权被拒或保存失败，仍标记已收集
            storage.completeTaskWithMaterial(taskId, '', ev.doc_type || '', ev.doc_category || '');
            self.refreshProgress();
            wx.showToast({ title: '已标记完成', icon: 'success' });
          },
        });
      },
    });
  },

  // ── Path setup (5-step wizard) ──
  onSetupNext: function (e) {
    const step = this.data.setupStep;
    const data = JSON.parse(JSON.stringify(this.data.setupData));
    const value = e.currentTarget.dataset.value;

    if (step === 0) data.visaType = value;
    else if (step === 1) data.familyStatus = value;
    else if (step === 2) data.arrivalScenario = value;
    else if (step === 3) data.housingIntent = value;
    else if (step === 4) {
      const asset = value;
      const assets = data.existingAssets.slice();
      const selectedAssets = JSON.parse(JSON.stringify(this.data.selectedAssets));
      const idx = assets.indexOf(asset);
      if (idx >= 0) {
        assets.splice(idx, 1);
        selectedAssets[asset] = false;
      } else {
        assets.push(asset);
        selectedAssets[asset] = true;
      }
      data.existingAssets = assets;
      this.setData({ setupData: data, selectedAssets: selectedAssets });
      return;
    }
    this.setData({ setupStep: step + 1, setupData: data });
    if (step + 1 === 4) {
      const synced = {};
      (data.existingAssets || []).forEach(function (a) {
        synced[a] = true;
      });
      this.setData({ selectedAssets: synced });
    }
  },

  onSetupAssetToggle: function (e) {
    const asset = e.currentTarget.dataset.value;
    if (!asset) return;
    const setupData = JSON.parse(JSON.stringify(this.data.setupData));
    const selectedAssets = JSON.parse(JSON.stringify(this.data.selectedAssets));
    const assets = setupData.existingAssets || [];
    const idx = assets.indexOf(asset);
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

  onSetupBack: function () {
    const step = this.data.setupStep;
    if (step > 0) this.setData({ setupStep: step - 1 });
  },

  onSetupConfirm: function () {
    const params = this.data.setupData;
    // Pass housingIntent through to storage so it's persisted
    storage.initOnboarding({
      visaType: params.visaType,
      familyStatus: params.familyStatus,
      arrivalScenario: params.arrivalScenario,
      housingIntent: params.housingIntent || 'undecided',
      existingAssets: params.existingAssets || [],
    });
    this.setData({ showPathSetup: false, setupStep: 0, selectedAssets: {} });
    this.init();
  },

  onSetupQuick: function () {
    const params = {
      visaType: 'ttps-bc',
      familyStatus: 'single',
      arrivalScenario: 'fresh',
      housingIntent: 'undecided',
      existingAssets: [],
    };
    storage.initOnboarding(params);
    this.setData({ showPathSetup: false, setupStep: 0, selectedAssets: {} });
    this.init();
  },

  onRetry: function () {
    this.init();
  },

  // ── 向导已提取到 ../wizards.js ──
  onHousingBannerTap: function () {
    wizards.housingWizard(this, storage).onHousingBannerTap();
  },
  onWizardNext: function (e) {
    wizards.housingWizard(this, storage).onWizardNext(e);
  },
  onWizardDone: function () {
    wizards.housingWizard(this, storage).onWizardDone();
  },
  onWizardClose: function () {
    wizards.housingWizard(this, storage).onWizardClose();
  },
  onSchoolNetBannerTap: function () {
    wizards.schoolNetWizard(this).onSchoolNetBannerTap();
  },
  onSNWizardNext: function (e) {
    wizards.schoolNetWizard(this).onSNWizardNext(e);
  },
  onSNWizardDone: function () {
    wizards.schoolNetWizard(this).onSNWizardDone();
  },
  onSNWizardClose: function () {
    wizards.schoolNetWizard(this).onSNWizardClose();
  },
  onSNOpenSchools: function () {
    wizards.schoolNetWizard(this).onSNOpenSchools();
  },

  onShareAppMessage() {
    return { title: '我正在使用住港伴，你也来看看', path: '/pages/guidebooks/index/index' };
  },
});
