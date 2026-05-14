/**
 * 住港伴 v4.1 — 提醒详情页
 * PRD v3.1: 描述、关联证件、前置提醒链、操作按钮(完成/延期/忽略)
 * 支持 OCR / 粘贴 / 手动 / 规则引擎 四种来源
 */
const app = getApp();
const { getAllReminders, saveReminder, updateReminder, deleteReminder } = require('../../../utils/storage');
const { getAllDocuments } = require('../../../utils/storage');
const { getCountdown, formatDate, parseDateFromText } = require('../../../utils/date-parser');
const { TIMELINE_TEMPLATES } = require('../../../data/timeline-templates');
const constants = require('../../../data/constants');

Page({
  data: {
    // 模式
    action: '',               // '' | 'ocr' | 'paste' | 'add' | 'rule' | 'timeline'
    isEdit: false,

    // 路径感知时间线
    timelinePath: '',
    timelinePathName: '',
    timelineStages: [],
    activationDate: '',
    hkidDate: '',
    visaYears: '2',

    // 提醒数据
    reminderId: '',
    reminder: null,
    countdown: null,

    // 关联证件
    linkedDocs: [],
    allDocs: [],              // 全部证件(供选择)

    // 前置提醒链
    dependencyChain: [],      // 依赖此提醒的前置提醒链
    dependents: [],           // 依赖此提醒的后续提醒

    // 编辑表单
    formTitle: '',
    formDeadline: '',
    formDescription: '',
    formConfidence: 'B',
    formType: 'manual',
    formLinkedDocIds: [],

    // 粘贴模式
    pasteText: '',
    parsedDates: [],

    // OCR模式
    ocrImagePath: '',
    ocrResult: null,
    ocrParsing: false,

    // 延期弹窗
    showDeferModal: false,
    deferDays: 7,
    deferDate: '',

    // 选择证件弹窗
    showDocSelector: false,

    // 规则引擎
    availableRules: [],
    selectedRuleId: '',

    loading: true
  },

  onLoad(options) {
    const action = options.action || '';
    const id = options.id || '';

    // Bug #9: 保存path参数供initTimeline使用 + _autogen标记触发自动生成
    this._options_path = options.path || '';
    this._options_from_autogen = (options._autogen === '1');

    this.setData({ action });

    if (id) {
      this.loadReminderDetail(id);
    } else if (action === 'rule') {
      this.loadAvailableRules();
      this.setData({ loading: false });
    } else if (action === 'timeline') {
      this.initTimeline();
      this.setData({ loading: false });
    } else {
      this.setData({ loading: false });
    }

    // 预加载证件列表
    this.loadAllDocuments();
  },

  // ========== 路径感知时间线 ==========
  initTimeline() {
    var session = wx.getStorageSync('__session__') || {};
    var app = getApp();
    // Bug #9 修复: 优先从options.path读取（来自自动生成流程），否则fallback到globalData
    var path = this._options_path || (app && app.globalData && app.globalData.selectedPath) || session.selectedPath || '';
    var pathNames = {
      'qmas': '优才计划', 'ttps_a': '高才通A类', 'ttps_b': '高才通B类', 'ttps_c': '高才通C类',
      'asmpt': '专才计划', 'student_iang': '学生→IANG', 'dependent': '受养人',
      'cies': 'CIES投资类身份规划', 'permanent': '永居申请'
    };
    var visaYearsMap = { 'qmas': 2, 'ttps_a': 3, 'ttps_b': 2, 'ttps_c': 2, 'asmpt': 2, 'student_iang': 1 };
    this.setData({
      timelinePath: path,
      timelinePathName: pathNames[path] || path,
      visaYears: String(visaYearsMap[path] || 2)
    });

    // Bug #9 修复: 自动生成时间线 — 以今天作为默认激活日期
    // 用户来自 auto-generate 流程已确认要生成，避免空状态
    if (path && this._options_from_autogen) {
      var today = new Date();
      var y = today.getFullYear();
      var m = today.getMonth() + 1;
      var d = today.getDate();
      var todayStr = y + '-' + (m < 10 ? '0' + m : m) + '-' + (d < 10 ? '0' + d : d);
      this.setData({ activationDate: todayStr });
      this.generateTimeline();
      // 自动生成后直接保存提醒到列表，不等用户手动点保存
      var that = this;
      setTimeout(function() { that.saveTimelineReminders(); }, 500);
    }
  },

  /** 根据激活日期+模板生成时间线 */
  generateTimeline() {
    var activation = this.data.activationDate;
    if (!activation) { wx.showToast({ title: '请填写预期提交申请时间', icon: 'none' }); return; }

    var path = this.data.timelinePath;
    var template = TIMELINE_TEMPLATES[path] || TIMELINE_TEMPLATES['qmas'];
    var start = new Date(activation);
    var stages = [];

    template.nodes.forEach(function(node) {
      var date = addDays(start, node.offsetDays);
      var iconMap = { milestone: '✅', deadline: '📅', renewal: '🔄', pr: '🏁', material: '📋' };
      stages.push({
        label: node.label,
        date: date,
        type: node.type,
        icon: iconMap[node.type] || '📍',
        desc: node.desc || '',
        materials: node.materials || [],
        range: node.range || null
      });
    });

    // 如果填了身份证日期，插入HKID节点
    if (this.data.hkidDate) {
      stages.push({ label: '办理香港身份证', date: this.data.hkidDate, type: 'milestone', icon: '🆔', desc: '', materials: ['photo'], range: null });
    }

    // 按日期排序
    stages.sort(function(a, b) { return new Date(a.date) - new Date(b.date); });
    stages.forEach(function(s, i) { s.index = i + 1; });

    this.setData({ timelineStages: stages });
  },

  /** 一键生成提醒到提醒列表 */
  saveTimelineReminders() {
    var that = this;
    var stages = this.data.timelineStages;
    if (!stages.length) { wx.showToast({ title: '先生成时间线', icon: 'none' }); return; }

    wx.showModal({
      title: '批量生成提醒',
      content: '将为 ' + stages.length + ' 个时间节点生成提醒，确认？',
      success: function(res) {
        if (!res.confirm) return;
        var count = 0;
        stages.forEach(function(s) {
          saveReminder({
            id: 'TL_' + Date.now() + '_' + (count++),
            title: s.label, deadline: s.date,
            description: that.data.timelinePathName + ' · ' + s.type,
            type: 'rule_engine', confidence: 'B',
            linkedDocIds: [], status: 'active',
            createdAt: new Date().toISOString()
          });
        });
        wx.showToast({ title: '已生成 ' + stages.length + ' 个提醒', icon: 'success' });
        setTimeout(function() { wx.navigateBack(); }, 1200);
      }
    });
  },

  onActivationDateChange(e) { this.setData({ activationDate: (e.detail && e.detail.value) || e.detail }); },
  onHkidDateChange(e) { this.setData({ hkidDate: (e.detail && e.detail.value) || e.detail }); },
  onVisaYearsChange(e) { this.setData({ visaYears: e.detail.value }); },

  // ========== 加载提醒详情 ==========
  loadReminderDetail(id) {
    const reminders = getAllReminders();
    const reminder = reminders.find(r => r.id === id);

    if (!reminder) {
      wx.showToast({ title: '提醒不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1000);
      return;
    }

    const countdown = getCountdown(reminder.deadline);
    const confidenceInfo = constants.CONFIDENCE_LEVELS[reminder.confidence] || constants.CONFIDENCE_LEVELS.B;

    // 加载关联证件
    const linkedDocs = this.getLinkedDocuments(reminder.linkedDocIds || []);

    // 构建依赖链
    const dependencyChain = this.buildDependencyChain(reminder);
    const dependents = this.buildDependents(reminder, reminders);

    // 初始化表单
    this.setData({
      reminderId: id,
      reminder,
      countdown,
      linkedDocs,
      dependencyChain,
      dependents,
      formTitle: reminder.title || reminder.label || '',
      formDeadline: reminder.deadline || '',
      formDescription: reminder.description || '',
      formConfidence: reminder.confidence || 'B',
      formType: reminder.type || 'manual',
      formLinkedDocIds: reminder.linkedDocIds || [],
      loading: false
    });
  },

  // ========== 关联证件 ==========
  loadAllDocuments() {
    try {
      const docs = getAllDocuments();
      this.setData({ allDocs: docs });
    } catch (e) {
      console.log('[提醒详情] 加载证件列表失败');
    }
  },

  getLinkedDocuments(docIds) {
    if (!docIds || docIds.length === 0) return [];
    const allDocs = getAllDocuments();
    return allDocs.filter(d => docIds.includes(d.id));
  },

  // ========== 依赖链 ==========
  buildDependencyChain(reminder) {
    if (!reminder.dependsOn) return [];
    const allReminders = getAllReminders();
    const chain = [];
    let currentId = reminder.dependsOn;
    const visited = new Set();

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const dep = allReminders.find(r => r.id === currentId);
      if (dep) {
        chain.unshift({
          id: dep.id,
          label: dep.title || dep.label,
          deadline: dep.deadline,
          status: dep.status,
          countdown: getCountdown(dep.deadline)
        });
        currentId = dep.dependsOn;
      } else {
        break;
      }
    }
    return chain;
  },

  buildDependents(reminder, allReminders) {
    return allReminders
      .filter(r => r.dependsOn === reminder.id)
      .map(r => ({
        id: r.id,
        label: r.title || r.label,
        deadline: r.deadline,
        status: r.status,
        countdown: getCountdown(r.deadline)
      }));
  },

  // ========== 操作: 完成 ==========
  async markComplete() {
    wx.showLoading({ title: '更新中...' });
    try {
      updateReminder(this.data.reminderId, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      // 检查并激活后续依赖提醒
      this.activateDependents();
      // 同步云端
      if (app.globalData.cloudReady) {
        await wx.cloud.callFunction({
          name: 'reminder-engine',
          data: { action: 'complete', reminderId: this.data.reminderId }
        }).catch(() => {});
      }
      wx.hideLoading();
      wx.showToast({ title: '✅ 已完成', icon: 'success' });
      this.loadReminderDetail(this.data.reminderId);
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  // 当前置提醒完成时，激活后续依赖提醒
  activateDependents() {
    if (this.data.dependents.length === 0) return;
    this.data.dependents.forEach(dep => {
      if (dep.status === 'locked') {
        updateReminder(dep.id, { status: 'active', updatedAt: new Date().toISOString() });
      }
    });
  },

  // ========== 操作: 延期 ==========
  openDeferModal() {
    const reminder = this.data.reminder;
    const currentDeadline = new Date(reminder.deadline);
    const newDate = new Date(currentDeadline.getTime() + 7 * 86400000);
    this.setData({
      showDeferModal: true,
      deferDays: 7,
      deferDate: newDate.toISOString().slice(0, 10)
    });
  },

  onDeferDaysChange(e) {
    const days = parseInt(e.detail.value) || 7;
    const reminder = this.data.reminder;
    const currentDeadline = new Date(reminder.deadline);
    const newDate = new Date(currentDeadline.getTime() + days * 86400000);
    this.setData({
      deferDays: days,
      deferDate: newDate.toISOString().slice(0, 10)
    });
  },

  async confirmDefer() {
    wx.showLoading({ title: '延期处理中...' });
    try {
      updateReminder(this.data.reminderId, {
        status: 'deferred',
        deadline: this.data.deferDate,
        deferredFrom: this.data.reminder.deadline,
        updatedAt: new Date().toISOString()
      });
      if (app.globalData.cloudReady) {
        await wx.cloud.callFunction({
          name: 'reminder-engine',
          data: { action: 'defer', reminderId: this.data.reminderId, newDeadline: this.data.deferDate }
        }).catch(() => {});
      }
      wx.hideLoading();
      wx.showToast({ title: '已延期', icon: 'success' });
      this.setData({ showDeferModal: false });
      this.loadReminderDetail(this.data.reminderId);
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  cancelDefer() {
    this.setData({ showDeferModal: false });
  },

  // ========== 操作: 忽略 ==========
  async ignoreReminder() {
    wx.showModal({
      title: '忽略提醒',
      content: '确定忽略此提醒吗？忽略后不再推送通知，但可在列表中查看。',
      confirmColor: '#6B7280',
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '处理中...' });
        try {
          updateReminder(this.data.reminderId, {
            status: 'ignored',
            updatedAt: new Date().toISOString()
          });
          if (app.globalData.cloudReady) {
            await wx.cloud.callFunction({
              name: 'reminder-engine',
              data: { action: 'ignore', reminderId: this.data.reminderId }
            }).catch(() => {});
          }
          wx.hideLoading();
          wx.showToast({ title: '已忽略', icon: 'success' });
          this.loadReminderDetail(this.data.reminderId);
        } catch (e) {
          wx.hideLoading();
          wx.showToast({ title: '操作失败', icon: 'none' });
        }
      }
    });
  },

  // ========== 操作: 删除 ==========
  deleteReminder() {
    wx.showModal({
      title: '删除提醒',
      content: '删除后不可恢复，确定删除吗？',
      confirmColor: '#DC2626',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          deleteReminder(this.data.reminderId);
          if (app.globalData.cloudReady) {
            await wx.cloud.callFunction({
              name: 'reminder-engine',
              data: { action: 'delete', reminderId: this.data.reminderId }
            }).catch(() => {});
          }
          wx.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 800);
        } catch (e) {
          wx.showToast({ title: '操作失败', icon: 'none' });
        }
      }
    });
  },

  // ========== 操作: 编辑 ==========
  toggleEdit() {
    this.setData({ isEdit: !this.data.isEdit });
  },

  onTitleInput(e) { this.setData({ formTitle: e.detail.value }); },
  onDeadlineInput(e) { this.setData({ formDeadline: e.detail.value }); },
  onDescriptionInput(e) { this.setData({ formDescription: e.detail.value }); },
  onConfidenceChange(e) { this.setData({ formConfidence: e.detail.value }); },

  async saveEdit() {
    if (!this.data.formTitle.trim()) {
      wx.showToast({ title: '请输入标题', icon: 'none' });
      return;
    }
    if (!this.data.formDeadline) {
      wx.showToast({ title: '请选择截止日期', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...' });
    try {
      updateReminder(this.data.reminderId, {
        title: this.data.formTitle.trim(),
        label: this.data.formTitle.trim(),
        deadline: this.data.formDeadline,
        description: this.data.formDescription.trim(),
        confidence: this.data.formConfidence,
        linkedDocIds: this.data.formLinkedDocIds,
        updatedAt: new Date().toISOString()
      });
      if (app.globalData.cloudReady) {
        await wx.cloud.callFunction({
          name: 'reminder-engine',
          data: {
            action: 'update',
            reminderId: this.data.reminderId,
            updates: {
              title: this.data.formTitle.trim(),
              deadline: this.data.formDeadline,
              description: this.data.formDescription.trim(),
              confidence: this.data.formConfidence
            }
          }
        }).catch(() => {});
      }
      wx.hideLoading();
      wx.showToast({ title: '已保存', icon: 'success' });
      this.setData({ isEdit: false });
      this.loadReminderDetail(this.data.reminderId);
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  // ========== 证件关联 ==========
  toggleDocSelector() {
    this.setData({ showDocSelector: !this.data.showDocSelector });
  },

  toggleLinkedDoc(e) {
    const docId = e.currentTarget.dataset.docId;
    let ids = [...this.data.formLinkedDocIds];
    const idx = ids.indexOf(docId);
    if (idx >= 0) {
      ids.splice(idx, 1);
    } else {
      ids.push(docId);
    }
    this.setData({ formLinkedDocIds: ids });
  },

  viewDocument(e) {
    const docId = e.currentTarget.dataset.docId;
    wx.navigateTo({ url: `/pages/documents/detail/detail?id=${docId}` });
  },

  // ========== 粘贴文本识别 ==========
  onPasteTextInput(e) {
    this.setData({ pasteText: e.detail.value });
  },

  parsePastedText() {
    if (!this.data.pasteText.trim()) {
      wx.showToast({ title: '请先粘贴文本', icon: 'none' });
      return;
    }
    const dates = parseDateFromText(this.data.pasteText);
    this.setData({ parsedDates: dates });
    if (dates.length === 0) {
      wx.showToast({ title: '未识别到日期', icon: 'none' });
    }
  },

  useParsedDate(e) {
    const date = e.currentTarget.dataset.date;
    this.setData({
      formDeadline: date,
      formType: 'ocr',
      parsedDates: []
    });
  },

  // ========== OCR 识别 ==========
  chooseImageForOCR() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['camera', 'album'],
      success: (res) => {
        const imagePath = res.tempFilePaths[0];
        this.setData({ ocrImagePath: imagePath });
        this.runOCR(imagePath);
      }
    });
  },

  async runOCR(imagePath) {
    this.setData({ ocrParsing: true, ocrResult: null });
    try {
      // 压缩→上传云存储→获取fileID→调用云函数
      var compressedPath = imagePath;
      try {
        var compressRes = await new Promise((resolve, reject) => {
          wx.compressImage({ src: imagePath, quality: 40, success: (r) => resolve(r.tempFilePath), fail: reject });
        });
        compressedPath = compressRes;
      } catch (e) { /* 压缩失败用原图 */ }

      // 上传到云存储
      var cloudPath = '_ocr_temp/reminder_' + Date.now() + '.jpg';
      var uploadRes = await new Promise((resolve, reject) => {
        wx.cloud.uploadFile({ cloudPath, filePath: compressedPath, success: resolve, fail: reject });
      });
      var fileID = uploadRes.fileID;

      // 调用云函数识别日期
      var cloudRes = await wx.cloud.callFunction({
        name: 'ocr-service',
        data: { action: 'recognizeDates', fileID: fileID }
      });

      var result = cloudRes.result || {};
      if (result.code === 0 && result.data && result.data.dates && result.data.dates.length > 0) {
        this.setData({ ocrResult: result.data, ocrParsing: false });
        return;
      }

      // 无日期
      this.setData({
        ocrResult: result.data || { dates: [], message: '未能识别到有效日期，请尝试手动输入' },
        ocrParsing: false
      });
    } catch (e) {
      console.error('[OCR] 识别失败:', e);
      this.setData({
        ocrResult: { dates: [], message: '识别失败，请重试或手动输入' },
        ocrParsing: false
      });
    }
  },

  runLocalOCR(imagePath) {
    // 本地无法真正OCR，此处为占位
    return null;
  },

  useOCRDate(e) {
    const date = e.currentTarget.dataset.date;
    const label = e.currentTarget.dataset.label || '';
    this.setData({
      formDeadline: date,
      formTitle: label || this.data.formTitle,
      formType: 'ocr'
    });
  },

  // ========== 规则引擎 ==========
  loadAvailableRules() {
    try {
      var reminderRules = require('../../../data/rules/reminders.js');
      var ruleNames = {
        'R_PASSPORT_EXPIRY': '护照到期提醒', 'R_EEP_EXPIRY': '回乡证到期提醒',
        'R_PERMIT_EXPIRY': '港澳通行证到期提醒', 'R_VISA_EXPIRY_GENERAL': '签证到期通用提醒',
        'R_HKID_RENEWAL': '香港身份证换领提醒', 'R_ADDRESS_PROOF': '住址证明更新提醒',
        'R_ADDRESS_PROOF_QUARTERLY': '季度住址证明提醒', 'R_TAX_FILING': '报税截止提醒',
        'R_TAX_PROVISIONAL': '暂缴税提醒', 'R_MPF_CONTRIBUTION': 'MPF供款提醒',
        'R_MPF_ANNUAL': 'MPF年度审查提醒', 'R_BANK_ACCOUNT_OPEN': '银行开户提醒',
        'R_BANK_STATEMENT': '银行月结单提醒', 'R_MEDICAL_INSURANCE': '医疗保险续保提醒',
        'R_VISA_ACTIVATION': '签证激活截止提醒', 'R_IANG_APPLY': 'IANG申请窗口提醒',
        'R_QMAS_TIMELINE': '优才申请时间线', 'R_TTPS_TIMELINE': '高才通申请时间线',
        'R_ASMTP_TIMELINE': '专才申请时间线', 'R_PR_APPLICATION': '永居申请时间窗',
        'R_DEPENDENT_VISA': '受养人签证到期提醒', 'R_RENEWAL_WINDOW': '续签窗口提醒'
      };
      var rulesWithNames = reminderRules.map(function(r) {
        r.name = ruleNames[r.rule_id] || r.rule_id;
        r.icon = r.icon || '📋';
        return r;
      });
      this.setData({ availableRules: rulesWithNames });
    } catch (e) {
      console.error('[规则引擎] 加载规则失败:', e);
      this.setData({ availableRules: [] });
    }
  },

  selectRule(e) {
    const ruleId = e.currentTarget.dataset.ruleId;
    this.setData({ selectedRuleId: ruleId });
  },

  async applyRule() {
    if (!this.data.selectedRuleId) {
      wx.showToast({ title: '请选择规则', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '生成提醒链...' });

    try {
      const rule = this.data.availableRules.find(r => r.rule_id === this.data.selectedRuleId);
      if (!rule) {
        wx.hideLoading();
        wx.showToast({ title: '规则未找到', icon: 'none' });
        return;
      }

      // 为规则链中的每个提醒创建条目
      const now = Date.now();
      const baseEventDate = new Date().toISOString().slice(0, 10);

      rule.reminders.forEach((r, idx) => {
        const deadline = this.calcDeadline(baseEventDate, r.offset_days);
        const prevReminderId = rule.reminders[idx - 1]
          ? `rem_${now}_${idx - 1}_${Math.random().toString(36).slice(2, 6)}`
          : null;

        const reminder = {
          id: `rem_${now}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
          title: r.label,
          label: r.label,
          description: r.note || '',
          deadline: deadline,
          type: 'rule_engine',
          confidence: rule.confidence || 'B',
          status: idx === 0 ? 'active' : 'locked',
          priority: 'normal',
          chainId: rule.rule_id,
          chainLabel: this.getRuleChainLabel(rule.rule_id),
          chainOrder: idx,
          dependsOn: idx > 0 ? `rem_${now}_${idx - 1}_*` : null,
          depends_on: r.depends_on || null,
          alerts: r.alerts || [],
          source: {
            type: 'rule_engine',
            ruleId: rule.rule_id,
            eventDate: baseEventDate
          },
          linkedDocIds: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        saveReminder(reminder);
      });

      wx.hideLoading();
      wx.showToast({
        title: `已生成 ${rule.reminders.length} 个提醒`,
        icon: 'success',
        duration: 2000
      });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '生成失败', icon: 'none' });
      console.error('[规则引擎] 应用规则失败:', e);
    }
  },

  calcDeadline(baseDate, offsetDays) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  },

  getRuleChainLabel(ruleId) {
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
    return map[ruleId] || '规则链';
  },

  // ========== 手动添加 ==========
  async addManualReminder() {
    if (!this.data.formTitle.trim()) {
      wx.showToast({ title: '请输入标题', icon: 'none' });
      return;
    }
    if (!this.data.formDeadline) {
      wx.showToast({ title: '请选择截止日期', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '添加中...' });
    try {
      const reminder = {
        id: 'rem_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        title: this.data.formTitle.trim(),
        label: this.data.formTitle.trim(),
        description: this.data.formDescription.trim(),
        deadline: this.data.formDeadline,
        type: 'manual',
        confidence: this.data.formConfidence,
        status: 'active',
        priority: 'normal',
        chainId: null,
        chainLabel: null,
        chainOrder: 0,
        dependsOn: null,
        depends_on: null,
        alerts: [],
        source: { type: 'manual' },
        linkedDocIds: this.data.formLinkedDocIds,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      saveReminder(reminder);

      if (app.globalData.cloudReady) {
        await wx.cloud.callFunction({
          name: 'reminder-engine',
          data: { action: 'add', reminder }
        }).catch(() => {});
      }

      wx.hideLoading();
      wx.showToast({ title: '添加成功', icon: 'success', duration: 1500 });
      setTimeout(() => wx.navigateBack(), 1200);
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '添加失败', icon: 'none' });
    }
  },

  // ========== 导航 ==========
  viewDependency(e) {
    const id = e.currentTarget.dataset.id;
    wx.redirectTo({ url: `/pages/reminders/detail/detail?id=${id}` });
  },

  goBack() {
    wx.navigateBack();
  }
});

/** 日期加减天数 */
function addDays(date, days) {
  var d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
