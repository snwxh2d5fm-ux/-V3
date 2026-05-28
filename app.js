/**
 * 住港伴 v4.2 — 香港身份全流程陪伴工具 (PRD v4 完整对齐)
 * 基于 PRD v4 + V5校验 + 方案库v1.0 + 7阶段流程指示器
 */
const api = require('./utils/api');
const { initStorage, initDBSync, syncAllToCloud, runStorageStartupCheck, getAllReminders, getAllProcessLines, getAllDocuments } = require('./utils/storage');
const { initCrypto } = require('./utils/crypto');
const { loadRules } = require('./utils/rule-engine');
const { matchPersonaToPaths } = require('./data/solution-library');
const { recoverUserData } = require('./utils/recovery');
const constants = require('./data/constants');

// ========== 云端恢复字段映射 ==========
function normalizeReminder(r) {
  return {
    id: r._id || r.id,
    title: r.title || '',
    deadline: r.deadline || r.deadlineDate || '',
    description: r.description || '',
    status: r.status === 'pending' ? 'active' : (r.status || 'active'),
    type: r.type || 'manual',
    confidence: r.confidence || 'B',
    pathway: r.pathway || null,
    chainId: r.chainId || null,
    chainLabel: r.chainLabel || null,
    chainOrder: r.chainOrder,
    linkedDocIds: r.linkedDocIds || [],
    offsetDays: r.offsetDays,
    createdAt: r.createdAt || new Date().toISOString(),
    updatedAt: r.updatedAt || new Date().toISOString(),
  };
}

function normalizeProcess(p) {
  return {
    id: p._id || p.id,
    name: p.name || '',
    templateId: p.templateId || '',
    status: p.status || 'active',
    stages: p.stages || [],
    completedStages: p.completedStages || [],
    currentStageId: p.currentStageId || '',
    createdAt: p.createdAt || new Date().toISOString(),
    updatedAt: p.updatedAt || new Date().toISOString(),
  };
}

function normalizeDocument(d) {
  return {
    id: d._id || d.id,
    name: d.name || '',
    type: d.type || '',
    category: d.category || '',
    number: d.number || '',
    expiryDate: d.expiryDate || null,
    issueDate: d.issueDate || null,
    status: d.status || 'active',
    createdAt: d.createdAt || new Date().toISOString(),
    updatedAt: d.updatedAt || new Date().toISOString(),
  };
}

App({
  globalData: {
    // 用户状态
    userInfo: null,
    userStatus: null, // 主状态: unapplied|submitted|approved|permanent
    userSubStatus: null, // V5新增: 子状态(细化选项)
    isLoggedIn: false,
    token: null,

    // 手机号绑定
    phoneBound: false,

    // 隐私模式
    privacyMode: 'local',

    // 当前活跃流程
    activeProcessId: null,
    activeProcess: null,
    selectedPath: null, // V5新增: 选择的身份规划路径

    // V5新增: 方案库推荐
    solutionRecommendation: null,

    // 会员等级
    membershipLevel: 'free',
    membershipExpiry: null,
    isLocked: false, // 试用过期/会员到期锁定

    // AI 助手状态
    aiSessionId: null,
    aiConversation: [],
    aiReady: false,

    // 系统状态
    cloudReady: false,
    dbSyncStatus: 'idle',
    rulesLoaded: false,
    encryptionKey: null,
    dataVersion: constants.DATA_VERSION,
    isOnline: true,
    networkType: 'unknown',

    // 流程控中枢配置
    hubSections: ['process', 'playbook', 'precheck'],
  },

  async onLaunch() {
    if (wx.cloud) {
      wx.cloud.init({
        env: constants.CLOUD_ENV_ID,
        traceUser: true,
      });
      this.globalData.cloudReady = true;
    }

    // v5: 网络状态监听 (DSG-1 P0-04)
    wx.onNetworkStatusChange((res) => {
      this.globalData.isOnline = res.isConnected;
      this.globalData.networkType = res.networkType;
    });
    // 初始化时获取当前网络状态
    wx.getNetworkType({
      success: (res) => {
        this.globalData.isOnline = res.networkType !== 'none';
        this.globalData.networkType = res.networkType;
      },
    });

    await Promise.all([initStorage(), initCrypto(), loadRules()]);

    // V4.1: 存储版本管理 + Schema 校验 + 健康上报
    // V4.2-fix: 包裹try/catch防止存储检查异常阻断启动
    try {
      runStorageStartupCheck();
    } catch (e) {
      console.error('[住港伴] 存储启动检查异常（不阻塞后续流程）:', e);
    }

    this.globalData.rulesLoaded = true;

    await this.loadSession();
    this.initAISession();

    // V4.2-fix: 数据抢救 — 本地备份恢复无需网络，优先执行
    try {
      const recoveryResult = await recoverUserData(this);
      if (recoveryResult.recovered) {
        // 将恢复后更新到 globalData 的状态写回 SESSION 键，而非从旧 SESSION 键覆盖恢复结果
        if (this.globalData.token) {
          wx.setStorageSync(constants.STORAGE_KEYS.SESSION, {
            token: this.globalData.token,
            userInfo: this.globalData.userInfo,
            userStatus: this.globalData.userStatus,
            userSubStatus: this.globalData.userSubStatus,
            membershipLevel: this.globalData.membershipLevel,
            membershipExpiry: this.globalData.membershipExpiry,
            isNew: false,
            isLocked: this.globalData.isLocked || false,
            phoneBound: this.globalData.phoneBound || false,
            activeProcessId: this.globalData.activeProcessId,
            activeProcess: this.globalData.activeProcess,
            selectedPath: this.globalData.selectedPath,
            solutionRecommendation: this.globalData.solutionRecommendation,
          });
        }
      }
    } catch (e) {
      console.error('[住港伴] 数据恢复异常（不阻塞启动）:', e);
    }

    if (this.globalData.isLoggedIn && this.globalData.cloudReady) {
      this.checkAndRestoreFromCloud();
      this.syncDataToCloud();
    }
  },

  async onShow() {
    if (this.globalData.isLoggedIn) {
      this.refreshProcessData();
      this.syncLockStatus(); // 每次切回前台同步锁定状态
    }
  },

  // ========== 会话管理 ==========
  async loadSession() {
    try {
      const session = wx.getStorageSync(constants.STORAGE_KEYS.SESSION);
      if (session && session.token) {
        const valid = await this.validateToken(session.token);
        if (valid) {
          this.globalData.userInfo = session.userInfo;
          this.globalData.userStatus = session.userStatus || 'unapplied';
          this.globalData.userSubStatus = session.userSubStatus || null;
          this.globalData.isLoggedIn = true;
          this.globalData.token = session.token;
          this.globalData.membershipLevel = session.membershipLevel || 'free';
          this.globalData.membershipExpiry = session.membershipExpiry;
          this.globalData.isLocked = session.isLocked || false;
          this.globalData.phoneBound = session.phoneBound || false;
          this.globalData.activeProcessId = session.activeProcessId;
          this.globalData.activeProcess = session.activeProcess;
          this.globalData.selectedPath = session.selectedPath || null;
          this.globalData.solutionRecommendation = session.solutionRecommendation || null;
        }
      }
    } catch (e) {
      // 无有效会话，用户需重新登录
    }
  },

  async validateToken(token) {
    if (!this.globalData.cloudReady) return false;
    try {
      const res = await wx.cloud.callFunction({
        name: 'user-auth',
        data: { action: 'validate', token },
      });
      return res.result && res.result.valid;
    } catch (e) {
      return false;
    }
  },

  async saveSession(sessionData) {
    Object.assign(this.globalData, sessionData);
    // V4.2-fix: isNew 从 sessionData/globalData 透传，不硬编码。
    // 新用户首次登录时 isNew=true，完成 status-select 后翻转为 false。
    const isNew = sessionData.isNew !== undefined ? sessionData.isNew : this.globalData.isNew;
    wx.setStorageSync(constants.STORAGE_KEYS.SESSION, {
      token: this.globalData.token,
      userInfo: this.globalData.userInfo,
      userStatus: this.globalData.userStatus,
      userSubStatus: this.globalData.userSubStatus,
      membershipLevel: this.globalData.membershipLevel,
      membershipExpiry: this.globalData.membershipExpiry,
      isNew: isNew,
      isLocked: this.globalData.isLocked || false,
      phoneBound: this.globalData.phoneBound || false,
      activeProcessId: this.globalData.activeProcessId,
      activeProcess: this.globalData.activeProcess,
      selectedPath: this.globalData.selectedPath,
      solutionRecommendation: this.globalData.solutionRecommendation,
    });
    if (this.globalData.cloudReady && this.globalData.token) {
      await api.syncUserProfile({
        userStatus: this.globalData.userStatus,
        userSubStatus: this.globalData.userSubStatus,
        membershipLevel: this.globalData.membershipLevel,
        activeProcessId: this.globalData.activeProcessId,
        selectedPath: this.globalData.selectedPath,
      });
    }
  },

  // ========== V5新增: 方案库路径推荐 ==========
  async getSolutionRecommendation(userProfile) {
    if (this.globalData.solutionRecommendation) {
      return this.globalData.solutionRecommendation;
    }
    // 客户端确定性匹配
    const localMatches = matchPersonaToPaths(userProfile);
    // 云端增强匹配
    let cloudMatches = [];
    if (this.globalData.cloudReady) {
      try {
        const res = await api.matchSolutionPath(userProfile);
        cloudMatches = res.matches || [];
      } catch (e) {
        // 云端匹配不可用，降级使用本地匹配
      }
    }
    const merged = mergeRecommendations(localMatches, cloudMatches);
    this.globalData.solutionRecommendation = merged;
    wx.setStorageSync(constants.STORAGE_KEYS.SOLUTION_RECOMMENDATION, merged);
    return merged;
  },

  // ========== 新设备恢复（云端→本地） ==========
  async checkAndRestoreFromCloud() {
    var hasReminders = getAllReminders().length > 0;
    var hasProcesses = getAllProcessLines().length > 0;
    var docs = getAllDocuments();
    var hasDocuments = Object.keys(docs).length > 0;

    // 有任何本地数据 → 跳过，本地优先
    if (hasReminders || hasProcesses || hasDocuments) return;

    // 确认弹窗
    var that = this;
    var confirmed = await new Promise(function (resolve) {
      wx.showModal({
        title: '数据恢复',
        content: '检测到云端有备份数据，是否恢复到当前设备？',
        confirmText: '恢复',
        cancelText: '暂不',
        success: function (res) { resolve(res.confirm); },
      });
    });
    if (!confirmed) return;

    try {
      var res = await wx.cloud.callFunction({ name: 'db-admin', data: { action: 'pullAll' } });
      if (res.result && res.result.code === 200 && res.result.data) {
        var d = res.result.data;
        if (d.reminders && d.reminders.length) {
          wx.setStorageSync('__reminders__', d.reminders.map(normalizeReminder));
        }
        if (d.processes && d.processes.length) {
          wx.setStorageSync('__processes__', d.processes.map(normalizeProcess));
        }
        if (d.documents && d.documents.length) {
          var docMap = {};
          d.documents.forEach(function (doc) { docMap[doc._id] = normalizeDocument(doc); });
          wx.setStorageSync('__vault_meta__', { documents: docMap, version: 1 });
        }
        wx.showToast({ title: '数据已恢复', icon: 'success' });
      }
    } catch (e) {
      console.warn('[restore] 云端恢复失败:', e);
    }
  },

  // ========== 数据同步 ==========
  async syncDataToCloud() {
    if (this.globalData.dbSyncStatus === 'syncing') return;
    this.globalData.dbSyncStatus = 'syncing';
    try {
      await syncAllToCloud();
      this.globalData.dbSyncStatus = 'synced';
    } catch (e) {
      this.globalData.dbSyncStatus = 'error';
      console.error('[住港伴] 数据同步失败:', e);
    }
  },

  async refreshProcessData() {
    if (!this.globalData.cloudReady) return;
    try {
      const res = await wx.cloud.callFunction({
        name: 'process-manager',
        data: { action: 'getActive', processId: this.globalData.activeProcessId },
      });
      if (res.result && res.result.data) {
        this.globalData.activeProcess = res.result.data;
      }
    } catch (e) {
      // 流程数据刷新失败，下次 onShow 重试
    }
  },

  // ========== AI 助手 ==========
  initAISession() {
    this.globalData.aiSessionId = 'ai_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
    this.globalData.aiReady = true;
    this.globalData.aiConversation = [
      {
        role: 'assistant',
        content:
          '你好！我是住港伴AI专员 v4.1，基于最新V5知识库。可以帮你：\n• 评估香港身份路径\n• 解答入境政策问题\n• 整理材料清单\n• 规划时间线\n随时问我吧！',
      },
    ];
  },

  async sendAIMessage(message) {
    if (!this.globalData.aiReady) return null;
    try {
      const res = await wx.cloud.callFunction({
        name: 'ai-chat',
        data: {
          sessionId: this.globalData.aiSessionId,
          message,
          mode: 'general',
          context: {
            userStatus: this.globalData.userStatus,
            userSubStatus: this.globalData.userSubStatus,
            membershipLevel: this.globalData.membershipLevel,
            activeProcess: this.globalData.activeProcess,
            selectedPath: this.globalData.selectedPath,
            dataVersion: constants.DATA_VERSION,
          },
        },
      });
      return res.result;
    } catch (e) {
      console.error('[住港伴] AI消息发送失败:', e);
      return { code: 500, message: 'AI服务暂时不可用' };
    }
  },

  // ========== 隐私模式 ==========
  setPrivacyMode(mode) {
    const validModes = ['local', 'desensitized', 'feature'];
    if (validModes.includes(mode)) {
      this.globalData.privacyMode = mode;
      wx.setStorageSync(constants.STORAGE_KEYS.PRIVACY_MODE, mode);
      this.emitPrivacyChange(mode);
    }
  },

  getPrivacyMode() {
    return wx.getStorageSync(constants.STORAGE_KEYS.PRIVACY_MODE) || 'local';
  },

  emitPrivacyChange(mode) {
    const pages = getCurrentPages();
    pages.forEach((page) => {
      if (page.onPrivacyModeChange) {
        page.onPrivacyModeChange(mode);
      }
    });
  },

  onError(err) {
    console.error('[住港伴] 全局错误:', err);
    const safeError = { message: err.message || String(err), timestamp: Date.now(), page: '' };
    try {
      const pages = getCurrentPages();
      if (pages.length > 0) safeError.page = pages[pages.length - 1].route;
    } catch (e) {}
    wx.setStorageSync(constants.STORAGE_KEYS.ERROR_LOG, safeError);
    // 异步上报到云端（静默失败不影响用户体验）
    if (this.globalData.cloudReady) {
      wx.cloud
        .callFunction({ name: 'usage-tracker', data: { action: 'track', eventType: 'app_error', payload: safeError } })
        .catch(function () {});
    }
  },

  /** 性能打点：记录首屏渲染时间 */
  _perfStartTime: 0,
  markPerfComplete: function () {
    if (!this._perfStartTime) return;
    const elapsed = Date.now() - this._perfStartTime;
    if (elapsed > 3000) console.warn('[住港伴] ⚠️ 首屏超过3秒: ' + elapsed + 'ms');
    if (this.globalData.cloudReady) {
      wx.cloud
        .callFunction({
          name: 'usage-tracker',
          data: { action: 'track', eventType: 'perf_launch', payload: { elapsedMs: elapsed } },
        })
        .catch(function () {});
    }
  },

  // ========== 锁定状态同步 ==========
  /**
   * 从云端同步 isLocked 状态（支付云函数最权威）
   * 在 onShow 和支付后调用
   */
  syncLockStatus: async function () {
    if (!this.globalData.cloudReady || !this.globalData.isLoggedIn) return;
    try {
      const res = await wx.cloud.callFunction({
        name: 'payment',
        data: { action: 'checkSubscription' },
      });
      const data = (res.result && res.result.data) || {};
      const isLocked = data.isLocked || false;
      // 本地数据比云端更可靠（已在 payment 激活时写入）
      // 但如果云端说是 locked，以云端为准
      if (isLocked) {
        this.globalData.isLocked = true;
        // 同步到 profile
        const profile = wx.getStorageSync('__user_profile__') || {};
        profile.isLocked = true;
        wx.setStorageSync('__user_profile__', profile);
      }
    } catch (e) {
      // 降级使用已有状态
    }
  },
});

// 合并本地和云端推荐结果
function mergeRecommendations(localMatches, cloudMatches) {
  const matchMap = {};
  localMatches.forEach((m) => {
    const s = m.matchScore || m.score || 0;
    matchMap[m.path] = (matchMap[m.path] || 0) + s;
  });
  cloudMatches.forEach((m) => {
    const s = m.matchScore || (typeof m.score === 'number' ? m.score : 0) || (m.confidence === 'high' ? 90 : 50);
    matchMap[m.path] = (matchMap[m.path] || 0) + s;
  });
  return Object.entries(matchMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([path, score]) => ({ path, matchScore: Math.min(score / 2, 100) }));
}
