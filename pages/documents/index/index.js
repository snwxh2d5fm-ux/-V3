/**
 * 住港伴 — 证件夹主页 (Tab2) · PRD v4.1 深度 UX 优化版
 * ─────────────────────────────────────────────────
 * 核心理念：状态感知的证件索引系统，槽位引导而非文件夹
 * 设计方向：Luxury/refined — 深色基调+暖金点缀
 */
const app = getApp();
const { getAllDocuments, saveDocuments } = require('../../../utils/storage');
const { desensitizeFields, MODES } = require('../../../utils/desensitize');
const constants = require('../../../data/constants');

Page({
  data: {
    // === 页面状态 ===
    pageState: 'loading',  // loading | no_path | index_loaded | locked
    loading: true,
    privacyMode: 'local',
    membershipLevel: 'free',
    isFreeUser: true,
    isPayingUser: false,
    effectiveLimit: { maxDocuments: 10 },
    isLocked: false,

    // === 7阶段流程指示器 ===
    stageSteps: [
      { id: 'evaluation',  label: '资格评估', status: 'active' },
      { id: 'preparation', label: '材料准备', status: 'pending' },
      { id: 'submission',  label: '线上申请', status: 'pending' },
      { id: 'waiting',     label: '等待获批', status: 'pending' },
      { id: 'activation',  label: '获批激活', status: 'pending' },
      { id: 'settlement',  label: '抵港生活', status: 'pending' },
      { id: 'pr',          label: '永居',     status: 'pending' }
    ],
    stageProgress: 14,

    // === 身份/路径/状态 ===
    userStatus: '',
    selectedPath: '',
    selectedPathName: '',
    isSkipped: false,
    hasSelectedPath: false,

    // === 证件索引模板 ===
    slotTemplate: null,
    slotCategories: [],
    slotProgress: { filled: 0, total: 0, percentage: 0, rightDeg: 0, leftDeg: 0 },
    collapsedCategories: {},

    // === 身份卡槽切换 ===
    identityOwner: 'self',        // 身份分类下的当前所属人
    ownerOptions: [
      { value: 'self',   label: '本人' },
      { value: 'spouse', label: '配偶' },
      { value: 'child',  label: '子女' }
    ],

    // === 溢出区（其他文件） ===
    overflowDocs: [],
    overflowCount: 0,

    // === 已归档材料 ===
    archivedDocs: [],
    archivedCount: 0,
    showArchived: false,

    // === 智能上传 ===
    smartUploadSuggestion: '',

    // === 画廊模式 ===
    showGallery: false,
    showImageViewer: false,
    previewIndex: 0,
    filteredDocsWithImage: [],

    // === 历史列表（兼容旧版证件列表） ===
    categoryTabs: [
      { key: 'all',       label: '全部', cssIcon: 'all' },
      { key: 'identity',  label: '身份', cssIcon: 'identity' },
      { key: 'education', label: '学历', cssIcon: 'education' },
      { key: 'work',      label: '工作', cssIcon: 'work' },
      { key: 'assets',    label: '资产', cssIcon: 'assets' },
      { key: 'approved',  label: '获批', cssIcon: 'approved' },
      { key: 'renewal',   label: '续签', cssIcon: 'renewal' },
      { key: 'permanent', label: '永居', cssIcon: 'permanent' }
    ],
    activeCategory: 'all',
    allDocuments: [],
    filteredDocs: [],
    searchQuery: '',
    documentCount: 0,
    maxFreeDocs: constants.FREE_LIMITS.MAX_DOCUMENTS,  // @deprecated — 用 effectiveLimit 取代
    showLimitTip: false,
    showEmptyGuide: false,

    // === 上传半屏弹窗 ===
    showUploadModal: false,
    uploadTarget: null,

    // === 云存储 ===
    hasCloudStorage: false,
    cloudStorageUsed: 0,
    cloudStorageTotal: 0
  },

  /* ============================================================
     LIFECYCLE
     ============================================================ */
  onShow() {
    const userStatus = app.globalData.userStatus ||
      wx.getStorageSync(constants.STORAGE_KEYS.USER_STATUS) || '';
    const selectedPath = app.globalData.selectedPath ||
      wx.getStorageSync('__active_process_id__') || '';
    const isSkipped = userStatus === 'skipped';
    const hasSelectedPath = !!selectedPath;

    const membership = app.globalData.membershipLevel || 'free';
    const isPayingUser = constants.isPayingMember(membership);
    const isFreeUser = !isPayingUser;
    const effectiveLimit = {
      maxDocuments: constants.getEffectiveLimit(membership, 'maxDocuments')
    };

    // 检查账户锁定（试用过期或会员到期未续费）
    const isLocked = app.globalData.isLocked || false;
    if (isLocked) {
      this.setData({
        isLocked: true,
        pageState: 'locked',
        loading: false
      });
      return;
    }

    // 获取路径名称 — 优先 activeProcess.name（与流程控hero卡片同源）
    let selectedPathName = '';
    if (selectedPath) {
      selectedPathName = (app.globalData.activeProcess && app.globalData.activeProcess.name)
        || constants.PATH_NAMES?.[selectedPath]
        || (app.globalData.selectedPath && constants.PATH_NAMES?.[app.globalData.selectedPath])
        || (app.globalData.activeProcess && constants.PATH_NAMES?.[app.globalData.activeProcess.pathType || app.globalData.activeProcess.templateId])
        || selectedPath;
    }

    this.setData({
      privacyMode: app.getPrivacyMode(),
      membershipLevel: membership,
      isFreeUser,
      isPayingUser,
      effectiveLimit,
      userStatus,
      selectedPath,
      selectedPathName,
      isSkipped,
      hasSelectedPath,
      pageState: hasSelectedPath ? 'index_loaded' : 'no_path',
      hasCloudStorage: !!app.globalData.hasCloudStorage,
      cloudStorageUsed: app.globalData.cloudStorageUsed || 0,
      cloudStorageTotal: app.globalData.cloudStorageTotal || 0
    });

    // 有路径 → 加载卡槽模板；无路径 → 引导选择
    if (hasSelectedPath && userStatus !== 'skipped') {
      this.loadSlotTemplate(userStatus, selectedPath);
    }

    this.loadDocuments();
  },

  /* ============================================================
     证件索引模板 — 槽位系统
     ============================================================ */

  /**
   * 加载路径专属卡槽模板 (PRD §3.4.1)
   */
  loadSlotTemplate(userStatus, selectedPath) {
    try {
      const { matchTemplate, computeSlotStates } = require('../../../data/document-index-templates');
      const template = matchTemplate(userStatus, selectedPath, 'application');
      if (!template) {
        this.setData({ slotCategories: [], slotTemplate: null });
        return;
      }

      var uploadedDocs = getAllDocuments();
      var slotCategories = computeSlotStates(template, uploadedDocs, this.data.identityOwner);

      // 计算溢出区文档
      var overflowDocs = uploadedDocs.filter(function(d) {
        return !slotCategories.some(function(cat) {
          return cat.slots.some(function(s) {
            return s.uploadedDocs && s.uploadedDocs.some(function(ud) { return ud.id === d.id; });
          });
        }) && !d.archived;
      });

      // 已归档材料
      const archivedDocs = uploadedDocs.filter(d => d.archived);

      const filledTotal = slotCategories.reduce((sum, cat) =>
        sum + (cat.categoryProgress?.filled || 0), 0);
      const requiredTotal = slotCategories.reduce((sum, cat) =>
        sum + (cat.categoryProgress?.total || 0), 0);
      const percentage = requiredTotal > 0
        ? Math.round((filledTotal / requiredTotal) * 100) : 0;

      // 进度环角度计算
      const deg = (percentage / 100) * 360;
      const rightDeg = Math.min(deg, 180);
      const leftDeg = Math.max(0, deg - 180);

      // 智能上传建议 — 随机选一个未填的必需槽位
      var smartUploadSuggestion = '';
      var allSlots = slotCategories.reduce(function(arr, c) { return arr.concat(c.slots); }, []);
      var emptyRequired = allSlots.filter(
        function(s) { return s.requirement === 'required' && s.fillStatus === 'empty'; }
      );
      if (emptyRequired.length > 0) {
        var pick = emptyRequired[Math.floor(Math.random() * emptyRequired.length)];
        smartUploadSuggestion = pick.docName;
      }

      // 存储模板引用以供身份切换时重新计算
      this._slotTemplate = template;

      this.setData({
        slotTemplate: template,
        slotCategories,
        slotProgress: { filled: filledTotal, total: requiredTotal, percentage, rightDeg, leftDeg },
        overflowDocs,
        overflowCount: overflowDocs.length,
        archivedDocs,
        archivedCount: archivedDocs.length,
        smartUploadSuggestion,
        pageState: 'index_loaded'
      });
    } catch (e) {
      console.error('[证件夹] 模板加载失败:', e);
      this.setData({ slotCategories: [], slotTemplate: null, pageState: 'index_loaded' });
    }
  },

  /** 切换身份卡槽所属人 */
  switchIdentityOwner(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({ identityOwner: value });
    // 重新计算身份分类的槽位填充状态
    if (this.data.slotCategories.length > 0) {
      this.refreshIdentitySlots();
    }
  },

  /** 切换分类折叠 */
  toggleCategory(e) {
    const key = e.currentTarget.dataset.key;
    const collapsed = { ...this.data.collapsedCategories };
    collapsed[key] = !collapsed[key];
    this.setData({ collapsedCategories: collapsed });
  },

  /** 上传到指定槽位 */
  uploadToSlot(e) {
    const slotKey = e.currentTarget.dataset.slotKey;
    const slot = this.findSlot(slotKey);
    if (!slot) return;

    // 免费用户检查上限（付费用户跳过）
    var docLimit = this.data.effectiveLimit ? this.data.effectiveLimit.maxDocuments : constants.FREE_LIMITS.MAX_DOCUMENTS;
    if (this.data.isFreeUser && this.data.documentCount >= docLimit) {
      wx.showModal({
        title: '免费额度已满',
        content: '免费用户最多添加' + docLimit + '份证件。升级会员可无限制添加。',
        confirmText: '了解会员',
        success: (res) => {
          if (res.confirm) wx.navigateTo({ url: '/pages/membership/index/index' });
        }
      });
      return;
    }

    // 跳转到添加页，预填槽位类型和所属人
    const ownerParam = (this.data.identityOwner && this.data.identityOwner !== 'self') 
      ? `&ownerType=${this.data.identityOwner}` : '';
    wx.navigateTo({
      url: `/pages/documents/add/add?slotKey=${slotKey}&docName=${encodeURIComponent(slot.docName)}&guideId=${slot.guideId || ''}${ownerParam}`
    });
  },

  /** 在槽位列表中查找指定槽位 */
  findSlot(slotKey) {
    for (const cat of this.data.slotCategories) {
      const found = cat.slots.find(s => s.slotKey === slotKey);
      if (found) return found;
    }
    return null;
  },

  /* ============================================================
     证件列表 — 历史兼容
     ============================================================ */

  async loadDocuments() {
    this.setData({ loading: true });

    let documents = getAllDocuments();

    // 云端同步
    if (app.globalData.cloudReady && app.globalData.isLoggedIn) {
      try {
        const res = await wx.cloud.callFunction({
          name: constants.CLOUD_FUNCTIONS.DOCUMENT_MANAGER,
          data: { action: 'list' }
        });
        if (res.result && res.result.documents) {
          const map = new Map();
          documents.forEach(d => map.set(d.id, d));
          res.result.documents.forEach(d => {
            if (!map.has(d.id) || (d.updatedAt > (map.get(d.id).updatedAt || 0))) {
              map.set(d.id, d);
            }
          });
          documents = Array.from(map.values());
          saveDocuments(documents);
        }
      } catch (e) {
        console.log('[证件夹] 云端同步不可用，使用本地数据');
      }
    }

    documents.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    this.setData({
      allDocuments: documents,
      documentCount: documents.length,
      loading: false,
      showLimitTip: this.data.isFreeUser && documents.length >= (this.data.effectiveLimit ? this.data.effectiveLimit.maxDocuments : constants.FREE_LIMITS.MAX_DOCUMENTS)
    });

    // 刷新身份分类槽位状态
    this.refreshIdentitySlots();

    this.applyFilter();
  },

  /** 刷新全部槽位（按当前 identityOwner 过滤所有分类） */
  refreshIdentitySlots() {
    var template = this._slotTemplate;
    var allDocuments = this.data.allDocuments;
    var identityOwner = this.data.identityOwner;
    if (!template || !allDocuments) return;

    var computeSlotStates = require('../../data/document-index-templates').computeSlotStates;
    var updated = computeSlotStates(template, allDocuments, identityOwner);

    // 重新计算溢出区文档
    var overflowDocs = allDocuments.filter(function(d) {
      return !updated.some(function(cat) {
        return cat.slots.some(function(s) {
          return s.uploadedDocs && s.uploadedDocs.some(function(ud) { return ud.id === d.id; });
        });
      }) && !d.archived;
    });

    // 重新计算进度
    var filledTotal = updated.reduce(function(sum, cat) {
      return sum + (cat.categoryProgress ? cat.categoryProgress.filled : 0);
    }, 0);
    var requiredTotal = updated.reduce(function(sum, cat) {
      return sum + (cat.categoryProgress ? cat.categoryProgress.total : 0);
    }, 0);
    var percentage = requiredTotal > 0 ? Math.round((filledTotal / requiredTotal) * 100) : 0;
    var deg = (percentage / 100) * 360;
    var rightDeg = Math.min(deg, 180);
    var leftDeg = Math.max(0, deg - 180);

    this.setData({
      slotCategories: updated,
      overflowDocs: overflowDocs,
      overflowCount: overflowDocs.length,
      slotProgress: { filled: filledTotal, total: requiredTotal, percentage: percentage, rightDeg: rightDeg, leftDeg: leftDeg }
    });
  },

  applyFilter() {
    const { activeCategory, allDocuments, searchQuery } = this.data;
    let docs = [...allDocuments];

    if (activeCategory !== 'all') {
      docs = docs.filter(d => d.category === activeCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      docs = docs.filter(d =>
        (d.name && d.name.toLowerCase().includes(q)) ||
        (d.docNumber && d.docNumber.includes(q)) ||
        (d.categoryLabel && d.categoryLabel.includes(q)) ||
        (d.notes && d.notes.toLowerCase().includes(q))
      );
    }

    const filteredDocs = docs.map(doc => ({
      ...doc,
      displayName: this.getDisplayName(doc),
      displayDesc: this.getDisplayDesc(doc),
      statusTag: this.getStatusTag(doc),
      cssIcon: this.getCssIcon(doc)
    }));

    this.setData({
      filteredDocs,
      showEmptyGuide: filteredDocs.length === 0 && allDocuments.length === 0
    });
  },

  getDisplayName(doc) {
    if (doc.name && doc.name !== '未命名证件') return doc.name;
    const typeNames = {
      id_card: '身份证', hk_id: '香港身份证', passport: '护照', eep: '回乡证',
      degree: '学位证书', work_proof: '工作证明', income_proof: '收入证明',
      bank_statement: '银行流水', visa: '签证', approval_notice: '获批通知',
      tax_record: '税单', rental_contract: '租约', mpf_record: 'MPF记录',
      recommendation: '推荐信', plan_statement: '赴港计划书', slip: '签证标签纸'
    };
    return typeNames[doc.type] || '证件';
  },

  getDisplayDesc(doc) {
    const parts = [];
    // 所属人标签
    const ownerLabels = { self: '', spouse: '配偶', child: doc.ownerName || '子女' };
    const ownerLabel = ownerLabels[doc.ownerType || 'self'];
    if (ownerLabel) parts.push(ownerLabel);
    if (doc.docNumber) parts.push('No. ' + doc.docNumber.substring(0, 4) + '****');
    if (doc.validTo) parts.push('有效期 ' + doc.validTo);
    if (doc.categoryLabel) parts.push(doc.categoryLabel);
    return parts.join(' · ') || '点击查看详情';
  },

  getStatusTag(doc) {
    if (doc.archived) return { text: '已归档', cls: 'tag-archived' };
    if (doc.status === 'expired') return { text: '已过期', cls: 'tag-expired' };
    if (doc.validTo) {
      const days = Math.ceil((new Date(doc.validTo) - new Date()) / 86400000);
      if (days < 0) return { text: '已过期', cls: 'tag-expired' };
      if (days <= 90) return { text: days + '天后到期', cls: 'tag-expiring' };
    }
    if (doc.ocrVerified) return { text: '已验证', cls: 'tag-verified' };
    return { text: '待完善', cls: 'tag-pending' };
  },

  /** CSS class icon — replaces emoji */
  getCssIcon(doc) {
    const map = {
      identity: 'ico-id', education: 'ico-edu', work: 'ico-work',
      assets: 'ico-asset', approved: 'ico-done', renewal: 'ico-renew', permanent: 'ico-pr',
      identities: 'ico-id', employment: 'ico-work', financial: 'ico-asset',
      application: 'ico-doc', visas: 'ico-visa', custom: 'ico-file'
    };
    return map[doc.category] || 'ico-file';
  },

  /* ============================================================
     事件处理
     ============================================================ */

  onCategoryTap(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ 
      activeCategory: key,
      identityOwner: 'self'   // 切换分类时重置所属人为本人
    });
    this.applyFilter();
  },

  onSearchInput(e) {
    this.setData({ searchQuery: e.detail.value });
    this.applyFilter();
  },

  onClearSearch() {
    this.setData({ searchQuery: '' });
    this.applyFilter();
  },

  navigateToAdd() {
    var docLimit = this.data.effectiveLimit ? this.data.effectiveLimit.maxDocuments : constants.FREE_LIMITS.MAX_DOCUMENTS;
    if (this.data.isFreeUser && this.data.documentCount >= docLimit) {
      wx.showModal({
        title: '免费额度已满',
        content: '免费用户最多添加' + docLimit + '份证件。升级会员即可无限制添加，并解锁端到端加密云存储。',
        confirmText: '升级会员',
        cancelText: '稍后再说',
        success: (res) => {
          if (res.confirm) wx.navigateTo({ url: '/pages/membership/index/index' });
        }
      });
      return;
    }
    wx.navigateTo({ url: '/pages/documents/add/add' });
  },

  navigateToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/documents/detail/detail?id=${id}` });
  },

  navigateToCombine() {
    wx.navigateTo({ url: '/pages/documents/combine/combine' });
  },

  // ===== 画廊功能 =====
  toggleGallery() {
    var show = !this.data.showGallery;
    if (show) {
      var allDocs = this.data.allDocuments || [];
      var docsWithImg = allDocs.filter(function(d) { return d.filePath && !d.archived; });
      this.setData({ showGallery: show, filteredDocsWithImage: docsWithImg });
    } else {
      this.setData({ showGallery: false, showImageViewer: false });
    }
  },

  previewImage(e) {
    var idx = e.currentTarget.dataset.index;
    this.setData({ showImageViewer: true, previewIndex: idx });
  },

  closeImageViewer() {
    this.setData({ showImageViewer: false });
  },

  onSwiperChange(e) {
    this.setData({ previewIndex: e.detail.current });
  },

  catchStop() {},

  goSelectIdentity() {
    wx.navigateTo({ url: '/pages/status-select/status-select' });
  },

  /** 账户锁定 → 跳转会员页解锁 */
  goUnlock: function() {
    wx.navigateTo({ url: '/pages/membership/index/index' });
  },

  goSelectPath() {
    wx.reLaunch({ url: '/pages/process/index/index' });
  },

  /** 智能上传 — 拍照后自动分类 */
  smartUpload() {
    var docLimit = this.data.effectiveLimit ? this.data.effectiveLimit.maxDocuments : constants.FREE_LIMITS.MAX_DOCUMENTS;
    if (this.data.isFreeUser && this.data.documentCount >= docLimit) {
      wx.showModal({
        title: '免费额度已满',
        content: '升级会员解锁无限制上传',
        confirmText: '了解',
        success: (res) => {
          if (res.confirm) wx.navigateTo({ url: '/pages/membership/index/index' });
        }
      });
      return;
    }
    wx.navigateTo({ url: '/pages/documents/add/add?mode=smart' });
  },

  /** 智能组合 */
  onSmartCombine() {
    wx.navigateTo({ url: '/pages/documents/combine/combine' });
  },

  /** 隐私模式变化 */
  onPrivacyModeChange(e) {
    this.setData({ privacyMode: e.detail.mode });
    this.loadDocuments();
  },

  /** 点击云存储升级 */
  onCloudUpgrade() {
    wx.showToast({ title: '云存储功能开发中', icon: 'none' });
  }
});

