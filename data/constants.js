/**
 * 住港伴 v4.1 — 全局常量定义 (PRD v3.1 对齐版)
 * 基于 2026-05-08 PRD v3.1 迭代升级
 * 新增: 12条路径 + 五级置信度 + 四阶段框架 + 6决策节点 + 方案库对齐
 */
module.exports = {
  // 云开发环境ID
  CLOUD_ENV_ID: 'cloudbase-d1g17tgt7cc199a60',

  // ============ 版本号 ============
  APP_VERSION: '4.1.0',
  PRD_VERSION: '3.1',
  DATA_VERSION: 'v5-20260508',

  // ============ 存储键名 ============
  STORAGE_KEYS: {
    SESSION: '__session__',
    PRIVACY_MODE: '__privacy_mode__',
    ERROR_LOG: '__error_log__',
    USER_STATUS: '__user_status__',
    USER_SUB_STATUS: '__user_sub_status__',
    USER_PROFILE: '__user_profile__',
    DOCUMENTS: '__documents__',
    REMINDERS: '__reminders__',
    PROCESSES: '__processes__',
    ACTIVE_PROCESS_ID: '__active_process_id__',
    AI_CONVERSATION: '__ai_conversation__',
    DB_SYNC_STATE: '__db_sync_state__',
    IDENTITY_PROFILE: '__identity_profile__',
    SOLUTION_RECOMMENDATION: '__solution_recommendation__',
    POLICY_VERSION_STAMP: '__policy_version_stamp__'
  },

  // ============ 隐私与PII ============
  PRIVACY_STATES: {
    PROTECTED: 'protected',
    PROCESSING: 'processing',
    UPLOADING: 'uploading'
  },

  PII_LEVELS: {
    L1: 'L1',  // 绝对脱敏 - 姓名/证件号/手机/邮箱/身份证格式 → 占位符
    L2: 'L2',  // 泛化脱敏 - 公司/学校/收入/日期/城市/精确日期 → 泛化标签
    L3: 'L3'   // 可保留标签 - 行业/学历/工作年限 → 用户自选
  },

  // ============ 五级置信度框架 (PRD v3.1 新增) ============
  CONFIDENCE_LEVELS: {
    A: { label: 'A级·法源明确', color: '#059669', bg: '#ECFDF5', description: 'Cap.115/基本法明确，无争议', showBanner: false },
    B: { label: 'B级·政策明确', color: '#2563EB', bg: '#EFF6FF', description: '入境处政策明确，有公开指引', showBanner: false },
    C: { label: 'C级·多数实践', color: '#EA580C', bg: '#FFF7ED', description: '多数实践一致，入境处有酌情权', showBanner: false },
    D: { label: 'D级·合理推断', color: '#DC2626', bg: '#FEF2F2', description: '法律/政策未明确，合理推断', showBanner: true, bannerText: '以下内容基于合理推断，入境处有酌情权，建议个案咨询' },
    E: { label: 'E级·无法确认', color: '#9CA3AF', bg: '#F3F4F6', description: '无法确认，须个案咨询', showBanner: true, bannerText: '此问题建议直接咨询入境处或持证律师', hideContent: true }
  },

  // ============ 法源强度标注 (PRD v3.1 新增) ============
  LEGAL_SOURCE_TYPES: {
    STATUTE: { label: '法典', icon: '📜', weight: 5 },
    POLICY: { label: '政策', icon: '📋', weight: 4 },
    PRECEDENT: { label: '判例', icon: '⚖️', weight: 3 },
    PRACTICE: { label: '惯例', icon: '📊', weight: 2 },
    INFERENCE: { label: '推断', icon: '💡', weight: 1 }
  },

  // ============ 会员体系 ============
  MEMBERSHIP_TIERS: {
    FREE: 'free',
    BASIC: 'basic',
    PRO: 'pro',
    PREMIUM: 'premium'
  },

  MEMBERSHIP_PRICES: {
    free: 0,
    basic: 39900,    // 399元/年(分)
    pro: 299900,     // 2999元/年(分)
    premium: 699900  // 6999元/年(分)
  },

  MEMBERSHIP_NAMES: {
    free: '免费会员',
    basic: '基础会员',
    pro: '专业会员',
    premium: '尊享会员'
  },

  // @deprecated — 保留向后兼容，新代码用 MEMBERSHIP_LIMITS + getEffectiveLimit()
  FREE_LIMITS: {
    MAX_DOCUMENTS: 10,
    MAX_PROCESS_LINES: 1,
    ASSESSMENT_PER_MONTH: 3,
    AI_QUESTIONS_PER_DAY: 5
  },

  // 分级限制 (PRD v4: 基础会员及以上=无限证件位)
  MEMBERSHIP_LIMITS: {
    free:    { maxDocuments: 10,   maxProcessLines: 1,   assessmentPerMonth: 3,   aiQuestionsPerDay: 5 },
    basic:   { maxDocuments: Infinity, maxProcessLines: Infinity, assessmentPerMonth: Infinity, aiQuestionsPerDay: Infinity },
    pro:     { maxDocuments: Infinity, maxProcessLines: Infinity, assessmentPerMonth: Infinity, aiQuestionsPerDay: Infinity },
    premium: { maxDocuments: Infinity, maxProcessLines: Infinity, assessmentPerMonth: Infinity, aiQuestionsPerDay: Infinity }
  },

  /** 获取用户的有效限制 */
  getEffectiveLimit: function(membershipLevel, key) {
    var tier = (membershipLevel && this.MEMBERSHIP_LIMITS[membershipLevel])
      ? membershipLevel : 'free';
    return this.MEMBERSHIP_LIMITS[tier][key];
  },

  /** 是否为付费会员（含 basic/pro/premium）。防御性：未知等级→非付费 */
  isPayingMember: function(membershipLevel) {
    var level = (membershipLevel && this.MEMBERSHIP_LIMITS[membershipLevel])
      ? membershipLevel : 'free';
    return level !== 'free' && level !== 'free_trial';
  },

  // ============ 12条身份规划路径 (PRD v3.1 完整版) ============
  APPLICATION_PATHS: {
    STUDENT_IANG:     'student_iang',      // 1: 全日制学生→IANG→永居
    PARTTIME_QMAS:    'parttime_qmas',     // 2: 兼读制→优才/专才→永居
    TTPS_A:           'ttps_a',            // 3: 高才通A类(≥250万)
    TTPS_B:           'ttps_b',            // 4: 高才通B类(合资格学士+3年)
    TTPS_C:           'ttps_c',            // 5: 高才通C类(合资格学士<3年)
    QMAS:             'qmas',              // 6: 优才QMAS(12准则≥6)
    ASMTP:            'asmpt',             // 7: 专才ASMTP(雇主sponsor)
    TECHTAS:          'techtas',           // 8: 科技人才TechTAS
    CIES:             'cies',              // 9: 投资类身份规划CIES(3000万)
    DEPENDENT:        'dependent',         // 10: 受养人(配偶/子女)
    MINOR_STUDENT:    'minor_student',     // 11: 未成年学生(父母不陪读)
    EXCHANGE:         'exchange',          // 12: 交换生/短期课程
    RETIREMENT:       'retirement'         // 13: 退休身份规划(CIES/家属/优才)
  },

  PATH_NAMES: {
    student_iang:    '赴港升学通道',
    parttime_qmas:   '兼读进修通道',
    ttps_a:          '高才通A类',
    ttps_b:          '高才通B类',
    ttps_c:          '高才通C类',
    qmas:            '优才计划',
    asmpt:           '专才计划',
    techtas:         '科技人才计划',
    cies:            '投资者入境计划',
    dependent:       '受养人签证',
    minor_student:   '未成年学生',
    exchange:        '交换生/短期课程',
    retirement:      '退休身份规划'
  },

  PATH_RISK_LEVELS: {
    student_iang:    { level: 'low', label: '🟢低', color: '#059669' },
    parttime_qmas:   { level: 'medium_high', label: '🟡中高', color: '#EA580C' },
    ttps_a:          { level: 'low', label: '🟢低', color: '#059669' },
    ttps_b:          { level: 'low', label: '🟢低', color: '#059669' },
    ttps_c:          { level: 'medium', label: '🟡中', color: '#EA580C' },
    qmas:            { level: 'medium_low', label: '🟡中低', color: '#CA8A04' },
    asmpt:           { level: 'medium', label: '🟡中', color: '#EA580C' },
    techtas:         { level: 'low', label: '🟢低', color: '#059669' },
    cies:            { level: 'low', label: '🟢低', color: '#059669' },
    dependent:       { level: 'low', label: '🟢低', color: '#059669' },
    minor_student:   { level: 'medium', label: '🟡中', color: '#EA580C' },
    exchange:        { level: 'low', label: '🟢低', color: '#059669' },
    retirement:      { level: 'medium', label: '🟡中', color: '#EA580C' }
  },

  PATH_CYCLES: {
    student_iang:    { label: '7-8年', firstVisa: '学生签(13-14月)' },
    parttime_qmas:   { label: '7-9年', firstVisa: '—' },
    ttps_a:          { label: '7年', firstVisa: '36月' },
    ttps_b:          { label: '7年', firstVisa: '24月' },
    ttps_c:          { label: '7年', firstVisa: '24月' },
    qmas:            { label: '7-8年', firstVisa: '24月' },
    asmpt:           { label: '7年', firstVisa: '~2年' },
    techtas:         { label: '7年', firstVisa: '2年' },
    cies:            { label: '8-9年', firstVisa: '—' },
    dependent:       { label: '跟随主申', firstVisa: '跟随主申' },
    minor_student:   { label: '7-10年', firstVisa: '按学制' },
    exchange:        { label: '4-6月', firstVisa: '短期学生签(不构成永居)' },
    retirement:      { label: '8-9年(CIES)/跟随主申', firstVisa: '24月(CIES)/跟随主申' }
  },

  // ============ 四阶段框架 (PRD v3.1 新增) ============
  PROCESS_PHASES: {
    PHASE1_EVALUATION:  { id: 'phase1_evaluation',  order: 1, name: '资格评估', nameCN: '资格评估(Pre-Application)', icon: '🎯' },
    PHASE2_ONBOARDING:  { id: 'phase2_onboarding',  order: 2, name: '获批激活', nameCN: '获批与激活(0-6个月)',       icon: '✅' },
    PHASE3_MAINTENANCE: { id: 'phase3_maintenance', order: 3, name: '中期维持', nameCN: '中期维持(1-6年)',            icon: '🔄' },
    PHASE4_PR_SPRINT:   { id: 'phase4_pr_sprint',   order: 4, name: '永居冲刺', nameCN: '永居冲刺(第6-7年)',         icon: '🏁' }
  },

  // ============ 6个标准决策节点 (PRD v3.1 新增) ============
  DECISION_POINTS: {
    DP1: { id: 'dp1_initial_path',  name: '首次路径选择', description: '评估各路径资格条件，选择最优首次签证路径' },
    DP2: { id: 'dp2_student_to_work', name: '学生→工作转换', description: '学生签证到期前选择：IANG/优才/专才/高才通' },
    DP3: { id: 'dp3_renewal_strategy', name: '续签策略', description: '选择续签方式：雇主sponsor/自雇/创业/转换类别' },
    DP4: { id: 'dp4_category_switch', name: '类别转换', description: '评估是否/何时从当前类别转换到其他类别' },
    DP5: { id: 'dp5_pr_sprint',     name: '永居冲刺', description: '第6-7年冲刺永居：材料整理/离港解释/递交策略' },
    DP6: { id: 'dp6_family_sync',   name: '家庭同步', description: '主申与受养人状态的同步协调（如受养人独立申请永居）' }
  },

  // ============ 用户身份状态 (PRD v3.1 从4种细化为4×N种子选项) ============
  USER_STATUS: {
    UNAPPLIED: 'unapplied',
    SUBMITTED: 'submitted',
    APPROVED: 'approved',
    PERMANENT: 'permanent',
    SKIPPED: 'skipped'        // 暂不选择身份
  },

  USER_STATUS_OPTIONS: [
    // 未申请 — 细化4种子选项
    { value: 'unapplied_student',   label: '未申请·在校学生', group: 'unapplied', persona: 1 },
    { value: 'unapplied_employed',  label: '未申请·在职人士', group: 'unapplied', persona: 2 },
    { value: 'unapplied_owner',     label: '未申请·企业主',   group: 'unapplied', persona: 4 },
    { value: 'unapplied_overseas',  label: '未申请·海外华人', group: 'unapplied', persona: 7 },
    // 已交件 — 细化6种子选项
    { value: 'submitted_qmas',      label: '已交件·优才',     group: 'submitted', path: 'qmas' },
    { value: 'submitted_ttps',      label: '已交件·高才通',   group: 'submitted', path: 'ttps_a' },
    { value: 'submitted_asmpt',     label: '已交件·专才',     group: 'submitted', path: 'asmpt' },
    { value: 'submitted_iang',      label: '已交件·IANG',     group: 'submitted', path: 'student_iang' },
    { value: 'submitted_cies',      label: '已交件·CIES',     group: 'submitted', path: 'cies' },
    { value: 'submitted_techtas',   label: '已交件·TechTAS',  group: 'submitted', path: 'techtas' },
    // 已获得身份 — 细化4种子选项
    { value: 'approved_employed',   label: '已获批·在港就业', group: 'approved' },
    { value: 'approved_business',   label: '已获批·在港创业', group: 'approved' },
    { value: 'approved_studying',   label: '已获批·在港学习', group: 'approved' },
    { value: 'approved_mainland',   label: '已获批·大部分时间在内地', group: 'approved' },
    // 已永居
    { value: 'permanent',           label: '已永居',          group: 'permanent' }
  ],

  // ============ 流程阶段 (保留兼容旧版) ============
  PROCESS_STAGES: {
    ASSESS:    { order: 1, name: '评估',   icon: '🎯', phase: 'phase1' },
    MATERIALS: { order: 2, name: '材料',   icon: '📋', phase: 'phase1' },
    SUBMIT:    { order: 3, name: '递交',   icon: '📤', phase: 'phase2' },
    WAIT:      { order: 4, name: '等待',   icon: '⏳', phase: 'phase2' },
    APPROVED:  { order: 5, name: '获批',   icon: '✅', phase: 'phase2' },
    ARRIVE:    { order: 6, name: '抵港',   icon: '🛬', phase: 'phase2' },
    MAINTAIN:  { order: 7, name: '维持',   icon: '🔄', phase: 'phase3' },
    RENEW:     { order: 8, name: '续签',   icon: '📝', phase: 'phase3' },
    PR_SPRINT: { order: 9, name: '永居冲刺', icon: '🏁', phase: 'phase4' }
  },

  // ============ 阶段ID桥接映射表（2026-05-20 V3里程碑解锁） ============
  //
  // 连接三套独立编号体系：
  //   数据层4阶段 stageId:   phase1_evaluation, phase2_onboarding(拆4子阶段), phase3_maintenance, phase4_pr_sprint
  //   流程控UI层7阶段索引:   0(资格评估)~6(永居)
  //   攻略书8关卡:           0(抵港前准备)~7(续签准备)
  //
  // phase2_onboarding 2026-05-20 拆分为4个独立里程碑子阶段:
  //   UI 1 材料准备(路径确认凭证) → UI 2 线上申请(递交回执) → UI 3 等待获批(受理回执) → UI 4 获批激活(签证)
  //   代码层 stageId: phase2_material_prep / phase2_submission / phase2_awaiting / phase2_activation
  //
  // 核心原则：
  //   1. __process_stage__ 存储 UI层7阶段索引 (0~6)
  //   2. 攻略书 rebuildPhases 读取 __process_stage__ 并通过 guide_unlock_thresholds 计算关卡解锁
  //   3. process-manager 使用 data层 stageId
  //   4. 所有模块统一引用此映射表，杜绝各自硬编码
  //
  STAGE_BRIDGE_MAP: {
    // ── 正向映射: 数据层 stageId → UI层信息 ──
    phase_to_ui: {
      phase1_evaluation: {
        label: '资格评估',
        uiStageIndices: [0, 1],
        milestoneStageIndex: 1,
        milestoneDocType: '路径确认凭证（评估结果截图）'
      },
      phase2_onboarding: {
        label: '获批与激活(4子阶段)',
        uiStageIndices: [1, 2, 3, 4],
        milestoneStageIndex: 1,
        milestoneDocType: '路径确认凭证'
      },
      phase3_maintenance: {
        label: '中期维持',
        uiStageIndices: [5],
        milestoneStageIndex: null,
        milestoneDocType: null
      },
      phase4_pr_sprint: {
        label: '永居冲刺',
        uiStageIndices: [6],
        milestoneStageIndex: 6,
        milestoneDocType: '永居身份证'
      }
    },

    // ── 反向映射: UI层7阶段索引 → 数据层 stageId ──
    ui_to_phase: {
      0: 'phase1_evaluation',
      1: 'phase1_evaluation',
      2: 'phase2_onboarding',
      3: 'phase2_onboarding',
      4: 'phase2_onboarding',
      5: 'phase3_maintenance',
      6: 'phase4_pr_sprint'
    },

    // ── 攻略书关卡解锁阈值 ──
    // guidebook phase N 需 processStage >= threshold 才能解锁
    guide_unlock_thresholds: {
      0: 0,
      1: 0,
      2: 0,
      3: 1,
      4: 1,
      5: 4,
      6: 4,
      7: 5
    },

    // ── UI层7阶段完整元数据 ──
    ui_stages: [
      { uiStage: 0, name: '资格评估',  isMilestone: false, milestoneDocType: null },
      { uiStage: 1, name: '材料准备',  isMilestone: true,  milestoneDocType: '路径确认凭证' },
      { uiStage: 2, name: '线上申请',  isMilestone: true,  milestoneDocType: '递交回执/确认邮件' },
      { uiStage: 3, name: '等待获批',  isMilestone: true,  milestoneDocType: '入境处受理回执' },
      { uiStage: 4, name: '获批激活',  isMilestone: true,  milestoneDocType: '签证/进入许可' },
      { uiStage: 5, name: '抵港生活',  isMilestone: false, milestoneDocType: null },
      { uiStage: 6, name: '永居',      isMilestone: true,  milestoneDocType: '永居身份证' }
    ],

    // ── 工具函数 ──
    stageToUiStage: function(phaseId, uiStageIndex) {
      if (arguments.length >= 2 && typeof uiStageIndex === 'number') return uiStageIndex;
      var info = this.phase_to_ui[phaseId];
      if (info && info.uiStageIndices.length > 0) return info.uiStageIndices[0];
      return 0;
    },

    uiStageToPhase: function(uiStageIndex) {
      return this.ui_to_phase[uiStageIndex] || 'phase1_evaluation';
    },

    getGuideUnlockState: function(processStage) {
      processStage = Math.max(0, Math.min(6, Number(processStage) || 0));
      var result = {};
      for (var p = 0; p <= 7; p++) {
        result[p] = processStage >= (this.guide_unlock_thresholds[p] || 0);
      }
      return result;
    },

    _validateBridgeMap: function() {
      var issues = [];
      if (Object.keys(this.phase_to_ui).length !== 4) issues.push('phase_to_ui应有4个phase');
      if (Object.keys(this.ui_to_phase).length < 7) issues.push('ui_to_phase应覆盖0~6');
      if (Object.keys(this.guide_unlock_thresholds).length !== 8) issues.push('guide_unlock_thresholds应覆盖0~7');
      if (this.ui_stages.length !== 7) issues.push('ui_stages应有7个阶段');
      for (var i = 0; i < this.ui_stages.length; i++) {
        if (this.ui_stages[i].uiStage !== i) issues.push('ui_stages[' + i + '].uiStage应为' + i);
      }
      if (issues.length > 0) {
        console.error('[STAGE_BRIDGE_MAP] 自校验失败:', issues.join('; '));
        return false;
      }
      return true;
    }
  },

  // ============ 文档类型 ============
  DOC_TYPES: {
    ID_CARD: 'id_card',
    HK_ID: 'hk_id',
    PASSPORT: 'passport',
    EEP: 'eep',
    VISA: 'visa',
    DEGREE: 'degree',
    WORK_PROOF: 'work_proof',
    INCOME_PROOF: 'income_proof',
    BANK_STATEMENT: 'bank_statement',
    RECOMMENDATION: 'recommendation',
    PLAN_STATEMENT: 'plan_statement',
    APPROVAL_NOTICE: 'approval_notice',
    TAX_RECORD: 'tax_record',
    RENTAL_CONTRACT: 'rental_contract',
    MPF_RECORD: 'mpf_record',
    SLIP: 'slip'
  },

  DOC_CATEGORIES: {
    IDENTITY: 'identity',
    EDUCATION: 'education',
    WORK: 'work',
    FINANCIAL: 'financial',
    APPLICATION: 'application',
    RENEWAL: 'renewal',
    CORE: 'core'
  },

  // ============ 提醒优先级 ============
  REMINDER_PRIORITY: {
    URGENT: 'urgent',
    WARNING: 'warning',
    NORMAL: 'normal'
  },

  // ============ 评估问题模板 v5.1 (分层标准·法源标注·双维度学历·DB嵌入) ============
  //
  // 法源标注符号:
  //   [A] Cap.115 / 基本法 / 成文法 — 法律明确，无争议
  //   [B] 入境处政策 / 公开指引 — 政策明确
  //   [C] 入境处实践 / 判例 — 多数实践一致，酌情权
  //   [D] 合理推断 — 法律/政策未明确，合理推断
  //
  ASSESSMENT_QUESTIONS: [
    {
      id: 'age',
      question: '你的年龄是多少？',
      type: 'select',
      options: ['18-25岁', '26-30岁', '31-39岁', '40-44岁', '45-50岁', '50岁以上'],
      criteria: [
        '优才QMAS：18-50岁可申请（准则A）[A]。31-39岁得分最高；51岁及以上不符合QMAS年龄分',
        '高才通A/B/C：无年龄限制 [A]',
        '专才ASMTP：无硬性年龄限制，但雇主要求通常倾向≤55岁 [C]',
        'CIES资本投资：须年满18岁，无上限 [A]',
        'IANG：须在港全日制课程毕业，年龄不限 [A]',
        '⚠️ 50岁以上：不再符合QMAS；可走 高才A（看收入）/ CIES（看资产）/ 专才（看雇主）'
      ].join('\n'),
      source: '[A] QMAS评核准则A（2025.11改革）; [A] Cap.115 §2A; [A] CIES规则',
      examples: ['32岁硕士 • 优才QMAS最优年龄分', '48岁企业主+高收入 • 高才A最佳通道', '55岁+高资产 • CIES唯一路径，QMAS已不可用']
    },
    {
      id: 'education',
      question: '你的最高学历是什么（含在读）？',
      type: 'select',
      options: ['博士', '硕士', '本科', '大专/副学士', '高中及以下'],
      note: '注意：最高学历 与 学士学位是否来自合资格大学 是独立的两个维度。',
      criteria: [
        '优才QMAS：硕士及以上得分（准则B1）[B]。博士=最高分，本科=无分',
        '高才通B/C：须「合资格大学」学士学位 [A]。只看学士，不看硕士/博士',
        'IANG：须全日制香港认可课程毕业（本科/硕士/博士均可）[A]',
        'TechTAS：STEM硕士/博士优先 [B]',
        '专才ASMTP：学历要求视雇主职位而定 [C]',
        '⚠️ 大专/高中：无法走QMAS/高才/IANG；可选 CIES（看资产）/ 受养人（看家庭成员）'
      ].join('\n'),
      source: '[A] 高才通资格规则; [B] QMAS准则B1; [A] IANG入境条例',
      examples: ['清华大学硕士+985本科 • 高才B✓（合资格学士）+ QMAS✓（硕士加分）', '非合资格大学本科+硕士 • 不能走高才B/C，可走优才QMAS', '高中毕业+资产充裕 • 走CIES或作为受养人']
    },
    {
      id: 'school',
      question: '你的「学士学位」是否来自合资格大学？',
      type: 'select',
      options: ['是（QS/THÉ世界百强）', '是（入境处合资格名单其他院校）', '否'],
      note: '本项仅问学士学位，与最高学历（硕士/博士）无关。合资格大学名单由入境处每年更新，当前约199所。',
      criteria: [
        '高才通B/C：必须合资格大学学士 [A] — 即使有硕士/博士，也只看学士',
        '优才QMAS：合资格大学毕业有加分倾向 [C]（非硬性要求，属评估优势）',
        '非合资格学士：依然可走优才/专才/CIES，但无高才B/C资格',
        '内地合资格大学约22所（含清华、北大、复旦、浙大、上海交大、中科大、南大、中山大学、华中科大等）[B]'
      ].join('\n'),
      source: '[A] 高才通合资格大学综合名单（入境处官网）; [B] 2024.10更新版名单',
      examples: ['清华大学学士+海外硕士 • 高才B✓（学士合资格），硕士另外加分', '双非本科+港大硕士 • 高才B✗（学士不合资格），优才✓', '港中文本科 • IANG✓ + 高才B✓（港校均在名单内）'],
      // 合资格大学参考数据（嵌入自知识库 AnswerKey）
      qualifyingList: {
        total: 199,
        mainland: ['清华大学', '北京大学', '复旦大学', '浙江大学', '上海交通大学', '中国科学技术大学', '南京大学', '中山大学', '华中科技大学', '武汉大学', '西安交通大学', '哈尔滨工业大学', '中南大学', '中国人民大学', '北京航空航天大学', '南开大学', '天津大学', '同济大学', '东南大学', '北京理工大学', '四川大学', '华东师范大学'],
        hk: ['香港大学', '香港中文大学', '香港科技大学', '香港城市大学', '香港理工大学', '香港浸会大学', '香港教育大学'],
        checkUrl: 'https://www.immd.gov.hk/hks/services/visas/TTPS.html'
      }
    },
    {
      id: 'major',
      question: '你的专业领域是？',
      type: 'select',
      options: ['STEM（科学/技术/工程/数学）', '金融/会计', '法律', '医学/护理', '商科/管理', '人文社科', '其他'],
      criteria: [
        'STEM专业 → TechTAS优先通道 [B] + 优才准则B2加分 [B]',
        '金融/法律/医学 → 如在人才清单行业可加分（准则D3）[B]',
        '商科/管理 → 优才仅凭工作经验通道；高才看收入和学士',
        '人文社科 → 路径选择更依赖工作经验/收入等其他维度'
      ].join('\n'),
      source: '[B] TechTAS合资格科技领域清单; [B] QMAS准则B2（STEM）; [B] 香港人才清单2025',
      examples: ['计算机博士+专利 • TechTAS+优才准则F1双通道', '金融专业+CFA+10年 • 优才人才清单+准则D1', '人文社科硕士 • 优才仅靠工作经验/语言等其他准则']
    },
    {
      id: 'industry',
      question: '你目前在哪个行业工作？',
      type: 'select',
      options: ['金融/会计', '资讯科技', '工程/制造', '医疗/护理', '教育/学术', '法律', '创科/研发', '其他'],
      criteria: [
        '优才准则D3：在入境处「人才清单」行业 ≥3年经验可得额外分 [B]',
        '人才清单重点行业（2025版）：金融科技、ESG、精算、海运、创新科技、创意产业、法律争议解决等 [B]',
        '非人才清单行业：仍可申请优才，但不触发准则D3加分',
        '专才ASMTP：行业不限，只要香港有雇主担保 [A]'
      ].join('\n'),
      source: '[B] 香港人才清单2025; [B] QMAS准则D3; [A] ASMTP申请资格',
      examples: ['金融科技5年 • 人才清单+准则D3触发', '传统制造业8年 • 走专才ASMTP（雇主担保）', '创科研发3年 • TechTAS优先+人才清单叠加']
    },
    {
      id: 'experience',
      question: '你的工作年限（毕业后全职）？',
      type: 'select',
      options: ['< 3年', '3-5年', '5-10年', '10年及以上'],
      criteria: [
        '优才准则D1：≥5年工作经验得分；≥10年最高分 [B]',
        '高才通B类：须 ≥3年工作经验 [A]；C类：≤3年，且受年度配额限制（10,000名/年）[A]',
        '专才ASMTP：通常要求 ≥2年相关经验（非硬性，视雇主）[C]',
        '应届毕业生：主要走IANG（在港毕业）或高才C（合资格学士）'
      ].join('\n'),
      source: '[B] QMAS准则D1; [A] 高才通B/C类申请资格; [C] ASMTP实践',
      examples: ['8年金融经验 • 优才QMAS准则D1✓ + 高才B✓', '< 3年+合资格学士 • 高才C（配额制，先到先得）', '应届+港校毕业 • IANG✓，工作后再转优才']
    },
    {
      id: 'position',
      question: '你目前/最近的职位层级是？',
      type: 'select',
      options: ['高管（CXO/VP/Director及以上）', '高级经理/总监', '经理/主管', '高级专业人员', '初级/应届'],
      criteria: [
        '优才准则D1/D2：高级管理职位 + 名企经历可叠加得分 [B]',
        '高才通A类：不看职位，仅看年收入 ≥HK$250万 [A]',
        '专才ASMTP：职位需与雇主担保岗位匹配 [C]',
        '注意：职位层级影响优才评分，但不决定是否能申请'
      ].join('\n'),
      source: '[B] QMAS准则D1/D2; [A] 高才通A类规则; [C] 专才ASMTP在职证明要求',
      examples: ['跨国公司VP+≥5年+名企 • 优才D1+D2双加分', '高级工程师 • 仅D1工作经验分，无管理加分']
    },
    {
      id: 'hasFamousCompany',
      question: '是否有 ≥3年 名企/跨国公司工作经历？',
      type: 'select',
      options: ['是（世界500强/上市公司≥3年）', '否'],
      criteria: [
        '优才准则D2：≥3年名企/跨国公司经验可得额外分 [B]',
        '名企范围：世界500强、《福布斯》全球2000强、上市公司、跨国公司 [B]',
        '需提供在职证明/劳动合同/推荐信佐证',
        '注意：D2可与D1叠加 — 5年名企工作经验 = D1+D2双得分'
      ].join('\n'),
      source: '[B] QMAS准则D2; [B] 入境处对「名企」认定指引（2025更新）',
      examples: ['华为研发8年 • 准则D1（年限）+ D2（名企）双得分', '中小企业10年 • 仅D1得分，D2不触发']
    },
    {
      id: 'hasIntlExp',
      question: '是否有 ≥2年 国际工作经验（含港澳台）？',
      type: 'select',
      options: ['是（含本人在境外工作的经历）', '否'],
      criteria: [
        '优才准则D4：≥2年国际工作经验可得额外分 [B]',
        '不限国家/地区（含港澳台，含驻外外派）',
        '需提供境外工作证明（在职证明+纳税记录 / 社保记录）',
        '注意：D4可与D1/D2叠加 — 10年经验（其中3年海外+7年内地）= D1+D4双得分'
      ].join('\n'),
      source: '[B] QMAS准则D4',
      examples: ['新加坡3年+内地5年 • D1（8年）+ D4（≥2年国际）双得分', '纯内地10年 • 仅D1得分，D4不触发']
    },
    {
      id: 'income',
      question: '你的个人年收入范围（港币，税前）？',
      type: 'select',
      options: ['HK$250万及以上（约¥233万）', 'HK$100-250万（约¥93-233万）', 'HK$50-100万（约¥47-93万）', 'HK$30-50万（约¥28-47万）', 'HK$30万以下'],
      criteria: [
        '高才通A类：年收入 ≥HK$250万（薪金/津贴/分红/股票期权均可，需税务局或公司证明）[A]',
        '优才准则E：年收入 ≥HK$100万可得额外分 [B]（非硬性要求，属加分项）',
        '收入以港币或等值外币计算，参考递交前12个月或上一课税年度',
        '⚠️ HK$100万 ≠ 高才A — 高才A硬性门槛是HK$250万；HK$100万仅在优才中加分'
      ].join('\n'),
      source: '[A] 高才通A类申请资格（Cap.115）; [B] QMAS准则E',
      examples: ['年收入HK$280万 • 高才A✓，优才准则E✓', '年收入HK$80万+名校硕士 • 优才为主（准则E不触发），高才A✗', '年收入HK$25万 • 优才/专才为主，暂不符合高才A']
    },
    {
      id: 'company',
      question: '你目前/最近的雇主类型？',
      type: 'select',
      options: ['世界500强/上市企业', '知名企业/跨国公司', '中小企业', '创业/自雇（有香港公司）', '创业/自雇（无香港公司）', '自由职业/无固定雇主'],
      criteria: [
        '专才ASMTP：须有香港雇主担保并获入境处批准 [A] — 雇员无法自行申请',
        '高才A续签：续签时须证明在港就业或业务运营 [B]',
        '创业/自雇→可走 高才A（看收入）/ 企业主专才（在港注册公司+运营）/ CIES',
        '自由职业者：无雇主条件下，主要靠 高才A（收入）/ CIES（资产）/ 优才'
      ].join('\n'),
      source: '[A] ASMTP申请资格; [B] 高才通续签要求（入境处）',
      examples: ['香港雇主担保 • 直接走专才ASMTP', '自雇+在港注册公司+运营2年 • 自雇专才/高才A续签', '自由职业+高收入 • 高才A（达标收入即可，不需雇主）']
    },
    {
      id: 'language',
      question: '你的语言能力（可多选）？',
      type: 'multiSelect',
      options: ['中文（母语）', '英语流利（雅思≥6.5或同等）', '英语一般', '粤语流利', '其他外语（日/韩/法等）'],
      criteria: [
        '优才准则C1：中文书面及口语能力 [B]',
        '优才准则C2：英文书面及口语能力，非母语者须提供雅思≥6.0/托福≥80或同等 [B]',
        '粤语：中国公民用中文申报即可覆盖（C1）',
        '其他外语：虽不在QMAS计分但体现语言能力，可用于个案说明'
      ].join('\n'),
      source: '[B] QMAS准则C1/C2; [B] 入境处认可的语言能力证明标准',
      examples: ['中文母语+雅思7.0 • C1✓ + C2✓ 双得分', '仅中文母语 • C1✓，C2不触发', '英语母语+中文一般 • C2✓，C1视情况']
    },
    {
      id: 'family',
      question: '你的家庭情况？',
      type: 'select',
      options: ['单身', '已婚无子女', '已婚有子女（1个，< 18岁）', '已婚有子女（2个及以上）', '离异/其他'],
      criteria: [
        '受养人签证：主申请人获批后可添加配偶和 <18岁未婚子女 [A]',
        '受养人在港：配偶可在港工作（除非主申为学生签）[A]；子女可在港读书',
        '受养人永居：跟随主申满7年可独立申请永居 [A]',
        '注意：父母不适用受养人签证；主申转永居后可申请单程证（60岁+独生子女+内地无子女）[C]'
      ].join('\n'),
      source: '[A] Cap.115受养人条款; [A] 受养人签证政策（入境处）; [C] 单程证实践',
      examples: ['已婚+1个未成年子女 • 全家同步申请受养人', '单身 • 仅本人申请，未来可添加', '主申永居后+父母60岁+独生 • 可申请父母赴港']
    },
    {
      id: 'hasIP',
      question: '是否拥有专利/知识产权/上市公司股权？',
      type: 'select',
      options: ['是（拥有已授权专利/重大IP）', '是（持上市公司≥10%股权）', '否'],
      criteria: [
        '优才准则F1：拥有已授权专利/重大知识产权可得额外分 [B]',
        '优才准则F2：持有上市公司 ≥10% 股权可得额外分 [B]',
        '创新科技署认可的专利优先 [C]',
        '注意：仅有专利申请未授权不适用F1'
      ].join('\n'),
      source: '[B] QMAS准则F1/F2',
      examples: ['3项发明专利+博士 • 准则F1加分显著', '持有科技公司20%股权+上市 • 准则F2触发', '仅有专利申请号未授权 • 不触发F1']
    },
    {
      id: 'capital',
      question: '可用于投资的净资产规模（港币）？',
      type: 'select',
      options: ['HK$3,000万及以上', 'HK$1,000-3,000万', 'HK$500-1,000万', 'HK$500万以下'],
      criteria: [
        'CIES（资本投资）：须证明拥有 ≥HK$3,000万净资产 + 投资于合资格资产 [A]',
        '合资格资产：股票/债券/基金/合资格集体投资计划/非住宅物业（不含住宅）[A]',
        '高才A：不要求资产，仅看年收入 ≥HK$250万 [A]',
        '注意：CIES不要求学历/语言/工作经验 — 是高净值用户的独立通道'
      ].join('\n'),
      source: '[A] 新资本投资者入境计划规则（CIES 2024）; [A] 高才通A类资格',
      examples: ['净资产HK$3,500万 • CIES单一路径（不看学历/年龄）', '净资产HK$800万+高收入 • 高才A优先，CIES暂不达标']
    }
  ],

  // ============ AI 对话模式 ============
  AI_MODES: {
    ASSESSMENT: 'assessment',
    QA: 'qa',
    GENERAL: 'general',
    SOLUTION_RECOMMEND: 'solution_recommend'
  },

  // ============ 云函数列表 ============
  CLOUD_FUNCTIONS: {
    USER_AUTH: 'user-auth',
    AI_CHAT: 'ai-chat',
    AI_ASSESS: 'ai-assess',
    AI_DOC_GEN: 'ai-doc-gen'
  }
};
