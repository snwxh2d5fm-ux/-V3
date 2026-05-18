// pages/documents/combine/combine.js — UX 深度优化 v5
// 智能分区、环形进度、到期提醒、阶段感知、快捷添加
const CONSTANTS = require('../../../data/constants.js');
const { getAllDocuments } = require('../../../utils/storage');

// 文档规格提示库
const DOC_SPECS = {
  'id_card': { tip: '身份证正反面彩色扫描，JPG/PDF，文件<5MB', validity: '长期', size: 'A4' },
  'hk_permit': { tip: '港澳通行证个人信息页+签注页，有效期需>6个月', validity: '6个月', size: 'A4' },
  'passport': { tip: '护照个人信息页彩色扫描，有效期需>6个月', validity: '6个月', size: 'A4' },
  'degree_cert': { tip: '学位证书原件彩色扫描+英文翻译件(如有)', validity: '长期', size: 'A4' },
  'transcript': { tip: '官方成绩单密封件或电子认证版', validity: '长期', size: 'A4' },
  'degree_auth': { tip: '学信网/学位网认证报告，或香港学术评审局认证', validity: '长期', size: 'A4' },
  'emp_letter': { tip: '公司信纸打印，注明职位、入职日期、薪资，加盖公章', validity: '3个月', size: 'A4' },
  'reference_letter': { tip: '上级或HR签字推荐信，注明推荐人联系方式', validity: '6个月', size: 'A4' },
  'salary_proof': { tip: '近12个月银行流水或工资单，显示固定收入', validity: '3个月', size: 'A4' },
  'bank_statement': { tip: '银行开具的中英文存款证明，金额覆盖在港生活费', validity: '3个月', size: 'A4' },
  'tax_record': { tip: '个人所得税完税证明，税务局官网下载', validity: '12个月', size: 'A4' },
  'plan_statement': { tip: '赴港计划书，500-800字，说明赴港目的和贡献计划', validity: '6个月', size: 'A4' },
  'photo': { tip: '白底彩色证件照，33mm×48mm，JPG格式，<5MB', validity: '6个月', size: '33×48mm' },
  'income_250w': { tip: '税单+银行流水+雇主证明，证明过去一年收入≥250万港币', validity: '3个月', size: 'A4' },
  'tax_250w': { tip: '税务局开具的完税证明，覆盖最近一个纳税年度', validity: '12个月', size: 'A4' },
  'student_visa': { tip: '入境处签发的学生签证标签页', validity: '学制内', size: 'A4' },
  'admission': { tip: '香港院校正式录取通知书原件', validity: '长期', size: 'A4' },
  'nol_letter': { tip: '入境处签发的"不反对通知书"，允许兼职/实习', validity: '学制内', size: 'A4' },
  'financial_proof': { tip: '银行存款证明(≥15万港币等值)或奖学金证明', validity: '3个月', size: 'A4' },
  'hk_id': { tip: '香港身份证正反面', validity: '长期', size: 'A4' },
  'visa_label': { tip: '历次签证/进入许可标签页', validity: '长期', size: 'A4' },
  'residence_proof': { tip: '租房合同/水电煤账单/银行月结单(每年至少2份)', validity: '3个月', size: 'A4' },
  'tax_7y': { tip: '过去7年香港税务局评税通知书', validity: '长期', size: 'A4' },
  'hk_employ': { tip: '香港雇主出具的工作证明，注明职位和在职期间', validity: '3个月', size: 'A4' },
  'pr_form': { tip: '入境处ROP145表格，可官网下载', validity: '3个月', size: 'A4' }
};

Page({
  data: {
    // 路径相关
    userPath: '',
    pathName: '',
    // 身份画像
    identity: null,        // { maritalStatus, hasChildren, childCount, persona, personaLabel }
    identityMatched: false, // 是否已完成身份适配
    pathOptions: [
      { value: 'qmas', label: '优才 QMAS' },
      { value: 'ttps_a', label: '高才通 A类' },
      { value: 'ttps_b', label: '高才通 B类' },
      { value: 'asmpt', label: '专才 ASMTP' },
      { value: 'student_iang', label: '学生→IANG' },
      { value: 'cies', label: '投资类身份规划 CIES' },
      { value: 'permanent', label: '永居申请' }
    ],
    showPathSwitcher: false,

    // 进度
    progress: 0,
    hasCount: 0,
    missingCount: 0,
    optionalCount: 0,
    totalRequired: 0,

    // 分区数据（替代旧 categoryGroups）
    priorityZones: [],   // [{ zone:'urgent', label:'当前阶段急需', items:[] }, ...]
    showZoneDetail: {},  // { zoneName: true/false }

    // 底部操作
    currentStage: { name: '材料准备', index: 1, total: 7 },
    exportMode: false,

    // 规格弹窗
    showSpecSheet: false,
    specDoc: null,

    // 导出预览
    showExportPreview: false,
    exportText: ''
  },

  onLoad() { this.init(); },
  onShow() { this.refresh(); },

  refresh() {
    this.loadUserPath();
    this.loadIdentity();
    this.loadDocuments();
  },

  init() {
    this.loadIdentity();
    this.loadUserPath();
    this.loadDocuments();
  },

  loadUserPath() {
    try {
      var app = getApp();
      // 五级回退：globalData(实时) > SESSION > USER_PROFILE > activeProcess
      var session = wx.getStorageSync(CONSTANTS.STORAGE_KEYS.SESSION) || {};
      var userData = wx.getStorageSync(CONSTANTS.STORAGE_KEYS.USER_PROFILE) || {};
      // 优先取 globalData（实时，无存储延迟）
      var path = (app && app.globalData && app.globalData.selectedPath)
        || session.selectedPath
        || userData.selectedPath
        || '';
      // 若仍为空，尝试从 activeProcess 提取
      if (!path && app && app.globalData && app.globalData.activeProcess) {
        path = app.globalData.activeProcess.pathType || app.globalData.activeProcess.templateId || '';
      }
      if (!path) path = '';  // 不默认 qmas，让用户主动选择

      // 优先取 activeProcess.name（与流程控hero卡片同源）
      var nameFromProcess = (app && app.globalData && app.globalData.activeProcess && app.globalData.activeProcess.name) || '';
      var pathNames = {
        'qmas': '优才计划 (QMAS)',
        'ttps_a': '高才通 A类', 'ttps_b': '高才通 B类', 'ttps_c': '高才通 C类',
        'asmpt': '专才计划 (ASMTP)', 'student_iang': '学生→IANG',
        'dependent': '受养人', 'cies': '投资类身份规划 (CIES)', 'permanent': '永居申请'
      };
      this.setData({ userPath: path, pathName: nameFromProcess || pathNames[path] || (path ? path : '未选择路径') });
      if (path) this.buildChecklist(path);
    } catch(e) {
      this.setData({ userPath: '', pathName: '路径加载失败' });
    }
  },

  loadIdentity() {
    try {
      var profile = wx.getStorageSync(CONSTANTS.STORAGE_KEYS.IDENTITY_PROFILE) || {};
      var subStatus = wx.getStorageSync(CONSTANTS.STORAGE_KEYS.USER_SUB_STATUS) || '';
      var persona = 0;
      var personaLabel = '';
      if (subStatus.indexOf('student') > -1) { persona = 1; personaLabel = '在校学生'; }
      else if (subStatus.indexOf('employed') > -1) { persona = 2; personaLabel = '在职人士'; }
      else if (subStatus.indexOf('owner') > -1) { persona = 4; personaLabel = '企业主'; }
      else if (subStatus.indexOf('overseas') > -1) { persona = 7; personaLabel = '海外华人'; }

      var identity = {
        maritalStatus: profile.maritalStatus || 'unknown',
        hasChildren: !!(profile.hasChildren || (profile.childCount > 0)),
        childCount: profile.childCount || 0,
        persona: persona,
        personaLabel: personaLabel,
        matched: !!(profile.maritalStatus)
      };
      this.setData({ identity: identity, identityMatched: identity.matched });
    } catch(e) {
      this.setData({ identity: null, identityMatched: false });
    }
  },

  loadDocuments() {
    try {
      var docs = getAllDocuments().filter(function(d) { return d.status !== 'archived'; });
      this.setData({ allDocs: docs || [] });
      this.matchChecklist();
    } catch(e) {
      this.setData({ allDocs: [] });
    }
  },

  buildChecklist(path) {
    var pathChecklists = {
      'qmas': [
        { id:'id_card', name:'身份证', category:'身份证明', required:true, stage:1 },
        { id:'hk_permit', name:'港澳通行证', category:'身份证明', required:true, stage:1 },
        { id:'passport', name:'护照', category:'身份证明', required:false, stage:1 },
        { id:'degree_cert', name:'学位证书', category:'学历证明', required:true, stage:2 },
        { id:'transcript', name:'成绩单', category:'学历证明', required:true, stage:2 },
        { id:'degree_auth', name:'学位认证', category:'学历证明', required:true, stage:2 },
        { id:'emp_letter', name:'工作证明信', category:'工作经历', required:true, stage:3 },
        { id:'reference_letter', name:'推荐信', category:'工作经历', required:true, stage:3 },
        { id:'salary_proof', name:'收入证明', category:'资产证明', required:true, stage:3 },
        { id:'bank_statement', name:'银行存款证明', category:'资产证明', required:true, stage:3 },
        { id:'tax_record', name:'纳税记录', category:'资产证明', required:false, stage:3 },
        { id:'plan_statement', name:'赴港计划书', category:'申请材料', required:true, stage:4 },
        { id:'photo', name:'证件照', category:'其他', required:true, stage:1 }
      ],
      'ttps_a': [
        { id:'id_card', name:'身份证', category:'身份证明', required:true, stage:1 },
        { id:'hk_permit', name:'港澳通行证', category:'身份证明', required:true, stage:1 },
        { id:'income_250w', name:'年收入250万证明', category:'资产证明', required:true, stage:2 },
        { id:'tax_250w', name:'完税证明', category:'资产证明', required:true, stage:2 },
        { id:'emp_letter', name:'工作证明', category:'工作经历', required:true, stage:2 },
        { id:'photo', name:'证件照', category:'其他', required:true, stage:1 }
      ],
      'ttps_b': [
        { id:'id_card', name:'身份证', category:'身份证明', required:true, stage:1 },
        { id:'hk_permit', name:'港澳通行证', category:'身份证明', required:true, stage:1 },
        { id:'degree_cert', name:'合资格大学学位证', category:'学历证明', required:true, stage:2 },
        { id:'emp_letter', name:'3年工作证明', category:'工作经历', required:true, stage:2 },
        { id:'photo', name:'证件照', category:'其他', required:true, stage:1 }
      ],
      'ttps_c': [
        { id:'id_card', name:'身份证', category:'身份证明', required:true, stage:1 },
        { id:'hk_permit', name:'港澳通行证', category:'身份证明', required:true, stage:1 },
        { id:'degree_cert', name:'合资格大学学位证', category:'学历证明', required:true, stage:2 },
        { id:'emp_letter', name:'5年工作经验证明', category:'工作经历', required:true, stage:2 },
        { id:'income_250w', name:'年收入250万证明', category:'资产证明', required:true, stage:2 },
        { id:'tax_250w', name:'完税证明', category:'资产证明', required:true, stage:2 },
        { id:'photo', name:'证件照', category:'其他', required:true, stage:1 }
      ],
      'asmpt': [
        { id:'id_card', name:'身份证', category:'身份证明', required:true, stage:1 },
        { id:'hk_permit', name:'港澳通行证', category:'身份证明', required:true, stage:1 },
        { id:'passport', name:'护照', category:'身份证明', required:false, stage:1 },
        { id:'emp_letter', name:'聘用书/合同', category:'工作经历', required:true, stage:2 },
        { id:'degree_cert', name:'学位证书', category:'学历证明', required:true, stage:2 },
        { id:'reference_letter', name:'推荐信', category:'工作经历', required:true, stage:3 },
        { id:'salary_proof', name:'收入证明', category:'资产证明', required:true, stage:3 },
        { id:'photo', name:'证件照', category:'其他', required:true, stage:1 }
      ],
      'cies': [
        { id:'id_card', name:'身份证', category:'身份证明', required:true, stage:1 },
        { id:'hk_permit', name:'港澳通行证', category:'身份证明', required:true, stage:1 },
        { id:'passport', name:'护照', category:'身份证明', required:true, stage:1 },
        { id:'bank_statement', name:'大额资产证明(≥3000万港币)', category:'资产证明', required:true, stage:2 },
        { id:'income_250w', name:'收入证明', category:'资产证明', required:true, stage:2 },
        { id:'plan_statement', name:'投资计划书', category:'申请材料', required:true, stage:3 },
        { id:'photo', name:'证件照', category:'其他', required:true, stage:1 }
      ],
      'student_iang': [
        { id:'id_card', name:'身份证', category:'身份证明', required:true, stage:1 },
        { id:'hk_permit', name:'港澳通行证', category:'身份证明', required:true, stage:1 },
        { id:'student_visa', name:'学生签证', category:'获批文件', required:true, stage:1 },
        { id:'admission', name:'录取通知书', category:'学历证明', required:true, stage:1 },
        { id:'nol_letter', name:'NOL不反对通知书', category:'获批文件', required:false, stage:2 },
        { id:'financial_proof', name:'经济能力证明', category:'资产证明', required:true, stage:1 },
        { id:'photo', name:'证件照', category:'其他', required:true, stage:1 }
      ],
      'permanent': [
        { id:'hk_id', name:'香港身份证', category:'身份证明', required:true, stage:1 },
        { id:'hk_permit', name:'港澳通行证', category:'身份证明', required:true, stage:1 },
        { id:'visa_label', name:'签证标签', category:'获批文件', required:true, stage:1 },
        { id:'residence_proof', name:'7年居住证明', category:'永居材料', required:true, stage:2 },
        { id:'tax_7y', name:'7年税务记录', category:'永居材料', required:true, stage:2 },
        { id:'hk_employ', name:'香港工作证明', category:'永居材料', required:true, stage:2 },
        { id:'pr_form', name:'永居申请表', category:'永居材料', required:true, stage:3 },
        { id:'photo', name:'证件照', category:'其他', required:true, stage:1 }
      ]
    };
    // 注入身份适配的条件材料
    var withConditional = this.injectConditionalDocs(pathChecklists[path] || []);
    this.setData({ checklist: withConditional });
  },

  // 根据身份画像注入条件材料
  injectConditionalDocs(baseList) {
    var list = baseList.slice();
    var identity = this.data.identity;
    if (!identity) return list;

    var conditionalDocs = [];

    // 已婚 → 结婚证 + 配偶证件
    if (identity.maritalStatus === 'married') {
      conditionalDocs.push(
        { id:'marriage_cert', name:'结婚证书', category:'家属材料', required:true, stage:1, identityAdapted:true },
        { id:'spouse_id', name:'配偶身份证', category:'家属材料', required:true, stage:1, identityAdapted:true },
        { id:'spouse_passport', name:'配偶港澳通行证', category:'家属材料', required:true, stage:1, identityAdapted:true }
      );
    }

    // 有子女 → 出生证明（每个子女一份）
    if (identity.hasChildren) {
      for (var c = 1; c <= identity.childCount; c++) {
        conditionalDocs.push(
          { id:'child_birth_cert_' + c, name:'子女' + c + '出生证明', category:'家属材料', required:true, stage:1, identityAdapted:true },
          { id:'child_id_' + c, name:'子女' + c + '身份证/护照', category:'家属材料', required:true, stage:1, identityAdapted:true }
        );
      }
    }

    // 企业主 → 营业执照 + 公司财报
    if (identity.persona === 4) {
      conditionalDocs.push(
        { id:'biz_license', name:'营业执照', category:'经营证明', required:true, stage:2, identityAdapted:true },
        { id:'biz_financial', name:'公司财务报表', category:'经营证明', required:false, stage:2, identityAdapted:true },
        { id:'biz_tax', name:'企业纳税证明', category:'经营证明', required:true, stage:2, identityAdapted:true }
      );
    }

    // 海外华人 → 海外居留证明 + 无犯罪记录
    if (identity.persona === 7) {
      conditionalDocs.push(
        { id:'overseas_residence', name:'海外居留证明', category:'海外材料', required:true, stage:1, identityAdapted:true },
        { id:'police_clearance', name:'无犯罪记录证明', category:'海外材料', required:true, stage:2, identityAdapted:true },
        { id:'overseas_transcript', name:'海外学历公证', category:'学历证明', required:false, stage:2, identityAdapted:true }
      );
    }

    // 学生 → 在校证明（如已申请状态）
    if (identity.persona === 1) {
      conditionalDocs.push(
        { id:'enrollment_proof', name:'在读证明', category:'学历证明', required:true, stage:1, identityAdapted:true }
      );
    }

    return list.concat(conditionalDocs);
  },

  matchChecklist() {
    var checklist = this.data.checklist;
    var allDocs = this.data.allDocs || [];
    var hasCount = 0, missingCount = 0, optionalCount = 0;

    var matched = checklist.map(function(item) {
      var found = allDocs.find(function(d) {
        return (d.docType && d.docType.indexOf(item.id) !== -1) ||
               (d.docSubType && d.docSubType.indexOf(item.id) !== -1) ||
               (d.category === item.category && d.name && d.name.indexOf(item.name.slice(0,2)) !== -1);
      });

      var status;
      if (found) {
        hasCount++;
        status = 'has';
      } else if (item.required) {
        missingCount++;
        status = 'missing';
      } else {
        optionalCount++;
        status = 'optional';
      }

      // 检查到期状态
      var expiryWarning = false;
      var expiryDays = null;
      if (found && found.expiryDate) {
        var now = new Date();
        var exp = new Date(found.expiryDate);
        expiryDays = Math.ceil((exp - now) / 86400000);
        if (expiryDays <= 30) expiryWarning = true;
      }

      var docSpec = DOC_SPECS[item.id] || {};
      return {
        id: item.id,
        name: item.name,
        category: item.category,
        required: item.required,
        stage: item.stage || 1,
        status: status,
        docId: found ? found.id : null,
        docData: found || null,
        expiryWarning: expiryWarning,
        expiryDays: expiryDays,
        spec: docSpec
      };
    });

    // 构建优先级分区
    var totalRequired = checklist.filter(function(c) { return c.required; }).length;
    var progress = totalRequired > 0 ? Math.round(hasCount / totalRequired * 100) : 0;

    var zones = [
      { zone: 'urgent',   label: '当前阶段急需', icon: '🔴', items: [], emptyText: '暂无紧急缺失' },
      { zone: 'missing',  label: '待补充材料',   icon: '🟡', items: [], emptyText: '所有必需材料已就绪' },
      { zone: 'ready',    label: '已就绪',       icon: '🟢', items: [], emptyText: '尚未添加任何材料' },
      { zone: 'optional', label: '建议准备',     icon: '⚪', items: [], emptyText: '无建议材料' }
    ];

    matched.forEach(function(m) {
      if (m.status === 'missing' && m.stage <= 2) {
        zones[0].items.push(m); // urgent: missing + early stage
      } else if (m.status === 'missing') {
        zones[1].items.push(m); // missing
      } else if (m.status === 'has') {
        zones[2].items.push(m); // ready
      } else {
        zones[3].items.push(m); // optional
      }
    });

    // 移除空分区
    var priorityZones = zones.filter(function(z) { return z.items.length > 0; });

    // 初始化展开状态
    var showZoneDetail = {};
    priorityZones.forEach(function(z) { showZoneDetail[z.zone] = true; });

    this.setData({
      checklist: matched,
      priorityZones: priorityZones,
      showZoneDetail: showZoneDetail,
      progress: progress,
      hasCount: hasCount,
      missingCount: missingCount,
      optionalCount: optionalCount,
      totalRequired: totalRequired
    });
  },

  // 路径切换
  togglePathSwitcher() {
    this.setData({ showPathSwitcher: !this.data.showPathSwitcher });
  },
  switchPath(e) {
    var path = e.currentTarget.dataset.path;
    var userData = wx.getStorageSync(CONSTANTS.STORAGE_KEYS.USER_PROFILE) || {};
    userData.selectedPath = path;
    wx.setStorageSync(CONSTANTS.STORAGE_KEYS.USER_PROFILE, userData);
    this.setData({ showPathSwitcher: false });
    this.loadUserPath();
    this.loadDocuments();
  },

  // 分区折叠
  toggleZone(e) {
    var zone = e.currentTarget.dataset.zone;
    var show = this.data.showZoneDetail;
    show[zone] = !show[zone];
    this.setData({ showZoneDetail: show });
  },

  // 文档点击
  onDocTap(e) {
    var item = e.currentTarget.dataset.item;
    if (item.status === 'has' && item.docId) {
      wx.navigateTo({ url: '/pages/documents/detail/detail?id=' + item.docId });
    } else {
      // 缺失/可选：弹出规格说明 + 快速添加
      this.showSpecForDoc(item);
    }
  },

  // 规格弹窗
  showSpecForDoc(item) {
    var doc = DOC_SPECS[item.id] || { tip: '请按要求准备材料', validity: '未知', size: 'A4' };
    this.setData({ showSpecSheet: true, specDoc: { name: item.name, id: item.id, spec: doc } });
  },
  hideSpecSheet() {
    this.setData({ showSpecSheet: false, specDoc: null });
  },
  quickAddDoc() {
    this.hideSpecSheet();
    wx.navigateTo({ url: '/pages/documents/add/add' });
  },

  // 添加证件
  navigateToAdd() {
    wx.navigateTo({ url: '/pages/documents/add/add' });
  },

  // 完善身份画像 — Bug #11修复: 自动从证件/评估/路径读取，不再跳转"我的"
  navigateToProfile() {
    var that = this;
    wx.showLoading({ title: '分析数据中...' });

    // 自动读取: 证件数据 → 评估结果 → 身份状态 → 路径选择
    try {
      var app = getApp();
      var profile = wx.getStorageSync(CONSTANTS.STORAGE_KEYS.IDENTITY_PROFILE) || {};
      var session = wx.getStorageSync(CONSTANTS.STORAGE_KEYS.SESSION) || {};

      // 从证件提取姓名/证件号
      var storage = require('../../../utils/storage');
      var docs = storage.getAllDocuments ? storage.getAllDocuments() : [];
      var idDoc = docs.find(function(d) { return d.category === 'identity' && d.type === 'id_card'; });
      if (idDoc && idDoc.ocrData) {
        if (idDoc.ocrData.name) profile.name = idDoc.ocrData.name;
        if (idDoc.ocrData.idNumber) profile.idNumber = idDoc.ocrData.idNumber;
      }

      // 从评估结果读取
      var assessment = wx.getStorageSync('__assessment_result__') || {};
      if (assessment.selectedPath) profile.selectedPath = assessment.selectedPath;
      if (assessment.persona !== undefined) profile.persona = assessment.persona;

      // 从全局/会话读取
      if (app && app.globalData) {
        if (app.globalData.selectedPath) profile.selectedPath = app.globalData.selectedPath;
        if (app.globalData.userStatus) profile.userStatus = app.globalData.userStatus;
      }
      if (session.selectedPath) profile.selectedPath = session.selectedPath;
      if (session.userStatus) profile.userStatus = session.userStatus;

      profile.updatedAt = new Date().toISOString();

      wx.setStorageSync(CONSTANTS.STORAGE_KEYS.IDENTITY_PROFILE, profile);
      wx.hideLoading();

      // 重新加载当前页面数据
      that.loadIdentity();
      that.refresh();

      var hasName = !!profile.name;
      var hasPath = !!profile.selectedPath;
      if (hasName && hasPath) {
        wx.showToast({ title: '身份画像已完善 ✅', icon: 'success' });
      } else {
        var missing = [];
        if (!hasName) missing.push('姓名');
        if (!hasPath) missing.push('申请路径');
        wx.showModal({
          title: '部分信息缺失',
          content: '以下信息未能自动获取：' + missing.join('、') + '\n\n请前往「资格评估」或「我的→身份设置」手动补充。',
          confirmText: '去资格评估',
          cancelText: '稍后',
          success: function(res) {
            if (res.confirm) wx.navigateTo({ url: '/pages/assessment/index/index' });
          }
        });
      }
    } catch (e) {
      wx.hideLoading();
      console.error('[身份画像] 自动构建失败:', e);
      wx.showToast({ title: '数据读取失败，请手动设置', icon: 'none' });
    }
  },

  // 导出
  toggleExportMode() {
    if (!this.data.exportMode) {
      this.generateExportText();
    }
    this.setData({ exportMode: !this.data.exportMode, showExportPreview: !this.data.exportMode });
  },
  generateExportText() {
    var zones = this.data.priorityZones;
    var lines = ['📋 住港伴 · 智能材料清单', '路径: ' + this.data.pathName, '完成度: ' + this.data.progress + '%', ''];
    zones.forEach(function(z) {
      lines.push('── ' + z.icon + ' ' + z.label + ' ──');
      z.items.forEach(function(item) {
        var icon = item.status === 'has' ? '✅' : item.status === 'missing' ? '⬜' : '⚪';
        var tag = item.required ? '[必需]' : '[建议]';
        lines.push(icon + ' ' + item.name + ' ' + tag + ' · ' + item.category);
      });
      lines.push('');
    });
    this.setData({ exportText: lines.join('\n') });
  },
  copyExport() {
    wx.setClipboardData({ data: this.data.exportText,
      success: function() { wx.showToast({ title: '已复制到剪贴板', icon: 'success' }); }
    });
  },
  hideExportPreview() {
    this.setData({ showExportPreview: false, exportMode: false });
  },

  // 阻止冒泡
  noop() {}
});
