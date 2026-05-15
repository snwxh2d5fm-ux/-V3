/**
 * 住港伴 v4.1 — 提醒器主页 (Tab3)
 * PRD v3.1: 时间线视图+列表视图切换，提醒卡片(标题/日期/类型标签/置信度/状态颜色)
 * 来源：OCR日期识别 + 粘贴文本 + 规则引擎
 * 免费：首条流程线；付费：100+规则链式
 */
const app = getApp();
const { getAllReminders, saveReminders, saveReminder, updateReminder } = require('../../../utils/storage');
const { getCountdown, formatDate } = require('../../../utils/date-parser');
const { getGlobalStages, getActiveStageIndex } = require('../../../utils/stage-helper');
const constants = require('../../../data/constants');

Page({
  data: {
    // PRD v4: 7阶段流程指示器
    stageSteps: [],
    stageProgress: 0,
    // 视图模式
    viewMode: 'timeline',
    hasPath: false,

    // 提醒数据
    allReminders: [],        // 全部提醒
    activeReminders: [],     // 活跃提醒(未完成)
    completedReminders: [],  // 已完成
    chainGroups: [],         // 规则链分组(时间线用)
    allChainGroups: [],      // 含已完成项
    displayChainGroups: [],  // 当前显示用(受筛选影响)
    collapsedChains: {},     // 折叠的规则链id

    // 筛选
    filterStatus: 'all',     // 'all' | 'active' | 'completed'
    filterType: 'all',       // 'all' | 'rule_engine' | 'ocr' | 'manual'

    // 统计数据
    stats: {
      total: 0,
      active: 0,
      completed: 0,
      urgent: 0               // 紧急(3天内)
    },

    // 会员
    membershipLevel: 'free',
    isPro: false,             // 付费会员标识
    freeLimitReached: false,

    loading: true,
    showAddMenu: false,       // 底部添加菜单
    generatingPrep: false     // 逆向时间轴生成中
  },

  onLoad() {
    this.refreshMembership();
  },

  onShow() {
    try { this.setData({ stageSteps: getGlobalStages(), stageProgress: Math.min(((getActiveStageIndex() + 1) / 7) * 100, 100) }); } catch(e) { this.setData({ stageProgress: 14 }); }
    this.loadReminders().then((function() {
      this.checkAutoGenerate();
    }).bind(this));
    this.refreshMembership();
  },

  // Bug #9: 选择路径后自动检测是否需要生成提醒
  checkAutoGenerate() {
    var that = this;
    var app = getApp();
    var session = wx.getStorageSync('__session__') || {};
    var selectedPath = (app && app.globalData && app.globalData.selectedPath) || session.selectedPath || '';

    this.setData({ hasPath: !!selectedPath });
    if (!selectedPath) return; // 未选路径

    // 检查是否已有提醒
    var allReminders = getAllReminders();
    if (allReminders.length > 0) return; // 已有提醒，不打扰

    // 检查是否已询问过（避免重复弹窗）
    var askedKey = '__auto_reminder_asked_' + selectedPath;
    if (wx.getStorageSync(askedKey)) return;

    var pathNames = {
      'qmas': '优才计划', 'ttps_a': '高才通A类', 'ttps_b': '高才通B类', 'ttps_c': '高才通C类',
      'asmpt': '专才计划', 'student_iang': '学生→IANG', 'dependent': '受养人',
      'cies': 'CIES投资类身份规划', 'permanent': '永居申请'
    };
    var pathName = pathNames[selectedPath] || selectedPath;

    wx.showModal({
      title: '检测到路径选择',
      content: '你已选择「' + pathName + '」路径。是否基于该路径自动生成关键日期提醒？\n\n包含：递交日期、获批提醒、续签节点、永居窗口等。',
      confirmText: '立即生成',
      cancelText: '稍后再说',
      success: function(res) {
        if (res.confirm) {
          that.doAutoGenerate(selectedPath, pathName);
        }
        wx.setStorageSync(askedKey, true);
      }
    });
  },

  // Bug #9: 执行自动生成 — 直接基于今日生成时间线提醒，无需跳转
  doAutoGenerate: function(path, pathName) {
    var that = this;
    var TIMELINE_TEMPLATES = require('../../../data/timeline-templates').TIMELINE_TEMPLATES;
    var template = TIMELINE_TEMPLATES[path];

    if (!template) {
      wx.showToast({ title: '暂无该路径的时间线模板', icon: 'none' });
      return;
    }

    var today = new Date();
    today.setHours(0, 0, 0, 0);

    // 未申请用户：以今天为起点，负偏移节点(准备材料等)从现在开始而非过去
    var app = getApp();
    var session = wx.getStorageSync('__session__') || {};
    var userStatus = (app && app.globalData && app.globalData.userStatus) || session.userStatus || '';
    var minOffset = 0;
    if (userStatus === 'unapplied' || !userStatus) {
      template.nodes.forEach(function(n) {
        if (n.offsetDays < minOffset) minOffset = n.offsetDays;
      });
    }
    var shiftDays = minOffset < 0 ? Math.abs(minOffset) : 0;

    // 未申请用户：只显示资料准备→递交激活阶段，排除续签/永居节点
    var EXCLUDE_TYPES = shiftDays > 0 ? ['renewal', 'pr'] : [];

    var iconMap = { milestone: '✅', deadline: '📅', renewal: '🔄', pr: '🏁', material: '📋' };
    var count = 0;

    template.nodes.forEach(function(node) {
      if (EXCLUDE_TYPES.indexOf(node.type) !== -1) return;
      var date = new Date(today);
      date.setDate(date.getDate() + (node.offsetDays || 0) + shiftDays);
      var y = date.getFullYear();
      var m = date.getMonth() + 1;
      var d = date.getDate();
      var ds = y + '-' + (m < 10 ? '0' + m : m) + '-' + (d < 10 ? '0' + d : d);

      var rangeText = '';
      if (node.range) {
        rangeText = ' (审批周期: ' + node.range[0] + '-' + node.range[1] + '天)';
      }

      saveReminder({
        id: 'TL_' + path + '_' + node.id + '_' + Date.now(),
        title: node.label,
        deadline: ds,
        description: (pathName || '') + ' · ' + (node.type || 'milestone') + rangeText + (node.desc ? '\n' + node.desc : ''),
        type: 'rule_engine',
        confidence: node.range ? 'C' : 'B',
        linkedDocIds: (node.materials || []),
        status: 'active',
        offsetDays: (node.offsetDays || 0) + shiftDays,
        pathway: path,
        createdAt: new Date().toISOString()
      });
      count++;
    });

    wx.showToast({ title: '已生成 ' + count + ' 个提醒节点', icon: 'success' });
    this.loadReminders();
  },

  onPullDownRefresh() {
    this.loadReminders().then(() => wx.stopPullDownRefresh());
  },

  // ========== 会员状态 ==========
  refreshMembership() {
    const level = app.globalData.membershipLevel || 'free';
    const isPro = level !== 'free';
    this.setData({ membershipLevel: level, isPro });
  },

  // ========== 数据加载 ==========
  async loadReminders() {
    this.setData({ loading: true });

    var session = wx.getStorageSync('__session__') || {};
    let reminders = getAllReminders();

    // 云端同步
    if (app.globalData.cloudReady && app.globalData.isLoggedIn) {
      try {
        const res = await wx.cloud.callFunction({
          name: 'reminder-engine',
          data: { action: 'list' }
        });
        if (res.result && res.result.reminders) {
          const map = new Map();
          reminders.forEach(r => map.set(r.id, r));
          res.result.reminders.forEach(r => {
            if (!map.has(r.id) || (r.updatedAt > (map.get(r.id).updatedAt || 0))) {
              map.set(r.id, r);
            }
          });
          reminders = Array.from(map.values());
          saveReminders(reminders);
        }
      } catch (e) {
        console.log('[提醒器] 云端同步失败，使用本地数据');
      }
    }

    // 动态时间线：未完成节点的日期随今天漂移，直到前一个节点完成为止
    var todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    var tlReminders = reminders.filter(function(r) { return r.offsetDays !== undefined; });
    if (tlReminders.length > 0) {
      // 找到第一个已完成的节点（最低offsetDays中status为completed的）
      var firstDoneOffset = Infinity;
      tlReminders.forEach(function(r) {
        if (r.status === 'completed' && r.offsetDays < firstDoneOffset) {
          firstDoneOffset = r.offsetDays;
        }
      });
      // 未完成的节点：如果其offsetDays < firstDoneOffset，重新计算deadline
      tlReminders.forEach(function(r) {
        if (r.status !== 'completed' && r.offsetDays < firstDoneOffset) {
          var newDate = new Date(todayDate);
          newDate.setDate(newDate.getDate() + r.offsetDays);
          var y = newDate.getFullYear();
          var m = newDate.getMonth() + 1;
          var d = newDate.getDate();
          r.deadline = y + '-' + (m < 10 ? '0' + m : m) + '-' + (d < 10 ? '0' + d : d);
          r.updatedAt = new Date().toISOString();
        }
      });
    }

    // 格式化
    const now = Date.now();
    var formatted = reminders.map(r => this.formatReminder(r));

    // 按当前路径过滤: 有pathway的提醒只显示当前路径的
    var currentPath = app.globalData.selectedPath || session.selectedPath || '';
    if (currentPath) {
      formatted = formatted.filter(function(r) {
        return !r.pathway || r.pathway === currentPath;
      });
    }

    // 分类
    const activeReminders = formatted
      .filter(r => r.status !== 'completed' && r.status !== 'ignored')
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

    const completedReminders = formatted
      .filter(r => r.status === 'completed')
      .sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));

    // 时间线: 按规则链分组（含已完成项，用于"全部"视图）
    const chainGroups = this.buildChainGroups(activeReminders);
    const allChainGroups = this.buildChainGroups(activeReminders.concat(completedReminders));

    // 统计
    const stats = {
      total: formatted.length,
      active: activeReminders.length,
      completed: completedReminders.length,
      urgent: activeReminders.filter(r => r.countdownDays > 0 && r.countdownDays <= 3).length
    };

    // 免费用户限制
    const freeLimitReached = !this.data.isPro && stats.active >= constants.FREE_LIMITS.MAX_PROCESS_LINES;

    this.setData({
      allReminders: formatted,
      activeReminders,
      completedReminders,
      chainGroups,
      allChainGroups,
      displayChainGroups: this.data.filterStatus === 'all' ? allChainGroups : chainGroups,
      stats,
      freeLimitReached,
      loading: false
    });
  },

  // ========== 格式化提醒 ==========
  formatReminder(r) {
    const countdown = getCountdown(r.deadline);
    const priority = this.calcPriority(r.deadline, r.status);
    const confidenceInfo = constants.CONFIDENCE_LEVELS[r.confidence] || constants.CONFIDENCE_LEVELS.B;

    // 类型标签
    const typeLabels = {
      rule_engine: { text: '规则引擎', cls: 'tag-info' },
      ocr: { text: 'OCR识别', cls: 'tag-warning' },
      manual: { text: '手动添加', cls: 'tag-muted' }
    };
    const typeInfo = typeLabels[r.type] || typeLabels.manual;

    // 状态颜色类
    const statusClsMap = {
      active: priority === 'urgent' ? 'card--urgent' : priority === 'warning' ? 'card--warning' : 'card--success',
      completed: '',
      deferred: 'card--highlight',
      ignored: ''
    };

    return {
      ...r,
      countdownDays: countdown.days,
      countdownDisplay: countdown.display,
      countdownIsPast: countdown.isPast,
      countdownIsToday: countdown.isToday,
      priority,
      priorityLabel: priority === 'urgent' ? '🔴 紧急' : priority === 'warning' ? '🟡 注意' : '🟢 正常',
      priorityCls: priority === 'urgent' ? 'tag-danger' : priority === 'warning' ? 'tag-warning' : 'tag-success',
      statusCls: statusClsMap[r.status] || '',
      confidenceLabel: confidenceInfo.label,
      confidenceColor: confidenceInfo.color,
      confidenceBg: confidenceInfo.bg,
      typeLabel: typeInfo.text,
      typeCls: typeInfo.cls,
      deadlineFormatted: formatDate(r.deadline, 'CN'),
      isLinkedToDoc: (r.linkedDocIds && r.linkedDocIds.length > 0)
    };
  },

  // ========== 计算优先级 ==========
  calcPriority(deadline, status) {
    if (status === 'completed' || status === 'ignored') return 'normal';
    const now = Date.now();
    const target = new Date(deadline).getTime();
    const daysLeft = Math.ceil((target - now) / 86400000);
    if (daysLeft <= 3) return 'urgent';
    if (daysLeft <= 7) return 'warning';
    return 'normal';
  },

  // ========== 规则链分组 ==========
  buildChainGroups(reminders) {
    const groups = [];

    // 有链ID的提醒分组
    const chainMap = new Map();
    const ungrouped = [];

    reminders.forEach(r => {
      if (r.chainId) {
        if (!chainMap.has(r.chainId)) {
          chainMap.set(r.chainId, {
            chainId: r.chainId,
            chainLabel: r.chainLabel || this.getChainLabel(r.chainId),
            items: [],
            progress: 0
          });
        }
        chainMap.get(r.chainId).items.push(r);
      } else {
        ungrouped.push(r);
      }
    });

    // 计算每组进度
    chainMap.forEach(group => {
      group.items.sort((a, b) => (a.chainOrder || 0) - (b.chainOrder || 0));
      const completed = group.items.filter(i => i.status === 'completed').length;
      group.progress = Math.round((completed / group.items.length) * 100);
    });

    // 合并: 链分组在前, 独立提醒在后
    groups.push(...chainMap.values());
    if (ungrouped.length > 0) {
      groups.push({ chainId: null, chainLabel: '独立提醒', items: ungrouped, progress: 0 });
    }

    return groups;
  },

  getChainLabel(chainId) {
    const map = {
      'R_APPROVAL_001': '获批后流程',
      'R_VISA_ACTIVATE_001': '签证激活流程',
      'R_HKID_001': '身份证办理',
      'R_RENEWAL_PREP_001': '续签准备',
      'R_TAX_001': '税务提醒',
      'R_PR_001': '永居冲刺',
      'R_MPF_001': '强积金检查',
      'R_PERMIT_EXPIRY_001': '通行证到期'
    };
    return map[chainId] || '规则链';
  },

  // ========== 视图切换 ==========
  switchView(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ viewMode: mode });
  },

  // ========== 筛选 ==========
  onFilterStatus(e) {
    const status = e.currentTarget.dataset.status;
    var displayGroups;
    if (status === 'all') {
      displayGroups = this.data.allChainGroups;
    } else if (status === 'completed') {
      displayGroups = this.buildChainGroups(this.data.completedReminders);
    } else {
      displayGroups = this.data.chainGroups;
    }
    this.setData({
      filterStatus: status,
      displayChainGroups: displayGroups
    });
  },

  onFilterType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ filterType: type });
  },

  // ========== 获取筛选后的提醒 ==========
  getFilteredReminders() {
    var ft = this.data.filterType;
    var list;
    if (this.data.filterStatus === 'completed') {
      list = this.data.completedReminders;
    } else if (this.data.filterStatus === 'all') {
      list = this.data.activeReminders.concat(this.data.completedReminders);
    } else {
      list = this.data.activeReminders;
    }
    if (ft !== 'all') {
      list = list.filter(function(r) { return r.type === ft; });
    }
    return list;
  },

  // ========== 导航 ==========
  viewReminder(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/reminders/detail/detail?id=${id}` });
  },

  viewChain(e) {
    const chainId = e.currentTarget.dataset.chainId;
    wx.navigateTo({ url: `/pages/reminders/detail/detail?chainId=${chainId}` });
  },

  toggleChain(e) {
    var chainId = e.currentTarget.dataset.chainId;
    var collapsed = JSON.parse(JSON.stringify(this.data.collapsedChains));
    if (collapsed[chainId]) delete collapsed[chainId];
    else collapsed[chainId] = true;
    this.setData({ collapsedChains: collapsed });
  },

  // ========== 快捷操作 ==========
  async markComplete(e) {
    const id = e.currentTarget.dataset.id;
    wx.showLoading({ title: '更新中...' });
    try {
      updateReminder(id, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      // 同步云端
      if (app.globalData.cloudReady) {
        await wx.cloud.callFunction({
          name: 'reminder-engine',
          data: { action: 'complete', reminderId: id }
        }).catch(() => {});
      }
      wx.hideLoading();
      wx.showToast({ title: '已标记完成', icon: 'success' });
      this.loadReminders();
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  // ========== 底部添加菜单 ==========
  toggleAddMenu() {
    this.setData({ showAddMenu: !this.data.showAddMenu });
  },

  navigateToOCR() {
    this.setData({ showAddMenu: false });
    wx.navigateTo({ url: '/pages/reminders/detail/detail?action=ocr' });
  },

  navigateToPaste() {
    this.setData({ showAddMenu: false });
    wx.navigateTo({ url: '/pages/reminders/detail/detail?action=paste' });
  },

  navigateToManual() {
    this.setData({ showAddMenu: false });
    wx.navigateTo({ url: '/pages/reminders/detail/detail?action=add' });
  },

  navigateToRuleEngine() {
    if (this.data.freeLimitReached) {
      wx.showModal({
        title: '免费用户限制',
        content: '免费用户仅支持首条规则链。开通专业会员可解锁全部100+规则链式提醒。',
        confirmText: '了解会员',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) wx.navigateTo({ url: '/pages/membership/index/index' });
        }
      });
      return;
    }
    this.setData({ showAddMenu: false });
    wx.navigateTo({ url: '/pages/reminders/detail/detail?action=rule' });
  },

  // ========== 详情页入口（原list页已合并至detail） ==========
  // 逆向时间轴：基于今天+资料准备模板，一键生成预估日期
  generatePrepTimeline() {
    var that = this;
    var app = getApp();
    var session = wx.getStorageSync('__session__') || {};
    var path = (app && app.globalData && app.globalData.selectedPath) || session.selectedPath || '';

    var pathNames = {
      'qmas': '优才计划', 'ttps_a': '高才通A类', 'ttps_b': '高才通B类', 'ttps_c': '高才通C类',
      'asmpt': '专才计划', 'student_iang': '学生→IANG', 'dependent': '受养人',
      'cies': 'CIES投资类身份规划', 'permanent': '永居申请'
    };

    // 根据路径匹配准备模板（基于实际项目Task Table）
    var prepNodes;
    if (path === 'qmas') {
      // 优才计划 — 基于 Task Table_20260505
      prepNodes = [
        { label: '自我评估 (需求80分以上)', offsetDays: 1, type: 'milestone', desc: '自评工具+名校/国际经验/名企/高管加分核实' },
        { label: '学历学位认证', offsetDays: 20, type: 'material', desc: '学信网/留服认证(15-20工作日)·海外学历需成绩单' },
        { label: '工作经验证明', offsetDays: 25, type: 'material', desc: '每段工作需公司名+时间+职位一致·组织架构图' },
        { label: '雇主推荐信 (每段工作一份)', offsetDays: 30, type: 'material', desc: '公司抬头纸+盖章+授权人签署·职责成就详述' },
        { label: '赴港计划书 (500字)', offsetDays: 35, type: 'material', desc: '规划为主·成就为辅·学业/事业/计划三段式' },
        { label: 'A-个人资料文件 (5个自然日)', offsetDays: 40, type: 'deadline', desc: '简历+通行证+ID981表+身份证+户口本+结婚证+55×45mm白底照' },
        { label: 'B-家属资料文件', offsetDays: 42, type: 'material', desc: '配偶证件照+身份证/通行证+ID997+学历认证+结婚证+子女出生证' },
        { label: 'C-资产证明文件 (2个自然日)', offsetDays: 44, type: 'material', desc: '个人≥20万/家庭30-60万·银行存款/房产/股票/股权均可' },
        { label: 'D-学历及语言证明 (1个自然日)', offsetDays: 45, type: 'material', desc: '学位证+学位认证报告+语言成绩(雅思6/托福80·2年内有效)' },
        { label: 'E-工作证明文件 (15个自然日)', offsetDays: 60, type: 'deadline', desc: '工作经历+管理经历(架构图)+雇主推荐信(每份雇主一份)' }
      ];
    } else if (path === 'ttps_a' || path === 'ttps_b' || path === 'ttps_c') {
      prepNodes = [
        { label: '确认高才通资格', offsetDays: 3, type: 'milestone', desc: 'A类:年收入≥250万HKD·B/C类:百强大学名单核查' },
        { label: '学历认证', offsetDays: 18, type: 'material', desc: '百强大学毕业证+成绩单+认证(如需)' },
        { label: '收入/工作证明', offsetDays: 25, type: 'material', desc: 'A类:完税证明+银行流水+雇主证明·B/C类:工作证明' },
        { label: '个人资料文件', offsetDays: 30, type: 'deadline', desc: '通行证+身份证+户口本+证件照+申请表' }
      ];
    } else if (path) {
      prepNodes = [
        { label: '确认路径条件与资格', offsetDays: 3, type: 'milestone', desc: '核实' + (pathNames[path] || path) + '申请条件' },
        { label: '个人基础证件收集', offsetDays: 10, type: 'material', desc: '身份证+户口本+通行证+证件照' },
        { label: '学历与资格认证', offsetDays: 22, type: 'material', desc: '学位证+成绩单+专业资格+认证报告' },
        { label: '工作/经历证明', offsetDays: 30, type: 'material', desc: '工作证明+推荐信+组织架构图(如需)' },
        { label: '财务/资产证明', offsetDays: 35, type: 'material', desc: '银行流水+存款证明+税单(按路径要求)' },
        { label: '申请文书与材料复核', offsetDays: 42, type: 'material', desc: '计划书/申请表·逐项核对' }
      ];
    }

    if (!prepNodes) {
      wx.showToast({ title: '暂无该路径的准备模板', icon: 'none' });
      return;
    }

    this._doGeneratePrepTimeline(prepNodes, pathNames[path] || '资料准备');
  },

  _doGeneratePrepTimeline: function(nodes, pathName) {
    var that = this;
    this.setData({ generatingPrep: true });

    var today = new Date();
    today.setHours(0, 0, 0, 0);

    var count = 0;
    nodes.forEach(function(node) {
      var date = new Date(today);
      date.setDate(date.getDate() + Math.abs(node.offsetDays || 7));
      var ds = date.getFullYear() + '-' +
        String(date.getMonth() + 1).padStart(2, '0') + '-' +
        String(date.getDate()).padStart(2, '0');

      var iconMap = { milestone: '✅', deadline: '📅', renewal: '🔄', pr: '🏁', material: '📋' };
      saveReminder({
        id: 'PREP_' + Date.now() + '_' + (count++),
        title: node.label,
        deadline: ds,
        description: (pathName || '资料准备') + ' · ' + (node.type || 'milestone'),
        type: 'rule_engine',
        confidence: 'B',
        linkedDocIds: [],
        status: 'active',
        createdAt: new Date().toISOString()
      });
    });

    this.setData({ generatingPrep: false });
    wx.showToast({ title: '已生成 ' + nodes.length + ' 个节点', icon: 'success' });
    this.loadReminders();
  },

  // 手动触发生成路径时间线提醒
  manualGenerateTimeline() {
    var app = getApp();
    var session = wx.getStorageSync('__session__') || {};
    var path = (app && app.globalData && app.globalData.selectedPath) || session.selectedPath || '';
    if (!path) { wx.showToast({ title: '请先选择身份路径', icon: 'none' }); return; }
    wx.navigateTo({ url: '/pages/reminders/detail/detail?action=timeline&path=' + path });
  },

  navigateToList() {
    wx.navigateTo({ url: '/pages/reminders/detail/detail' });
  },

  // ========== 升级会员 ==========
  viewPremium() {
    wx.navigateTo({ url: '/pages/membership/index/index' });
  }
});
