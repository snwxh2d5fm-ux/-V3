/**
 * db-seed — 数据库种子脚本
 * 一次性运行：为 Phase 1 插入初始数据
 *
 * 使用方法：
 *   1. 部署此云函数
 *   2. 在云开发控制台手动触发，或调用 action=seed
 *   3. 幂等：已存在的数据自动跳过
 *
 * Phase 1 种子内容:
 *   - 4 政策来源 (policy_sources)
 *   - 6 内容风控规则 (content_rules)
 *   - 17 提醒规则 (reminder_rules)
 *   - 17 归档规则 (archiving_rules)
 *   - 18 指引条目 (guide_items)
 *   - 12 材料标准 (material_standards)
 *   - 3 流程模板 (process_templates)
 *   - 2 会员计划 (membership_plans)
 *   - 2 商品 (products)
 *   - 4 模拟账号 (simulated_accounts)
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { action = 'seed' } = event || {};

  if (action !== 'seed') {
    return { code: 400, msg: '仅支持 action=seed' };
  }

  const stats = {
    policy_sources: 0, content_rules: 0, reminder_rules: 0,
    archiving_rules: 0, guide_items: 0, material_standards: 0,
    process_templates: 0, membership_plans: 0, products: 0,
    simulated_accounts: 0, skipped: 0, errors: 0,
  };

  try {
    await seedPolicySources(stats);
    await seedContentRules(stats);
    await seedReminderRules(stats);
    await seedArchivingRules(stats);
    await seedGuideItems(stats);
    await seedMaterialStandards(stats);
    await seedProcessTemplates(stats);
    await seedMembershipPlans(stats);
    await seedProducts(stats);
    await seedSimulatedAccounts(stats);

    return { code: 0, msg: '种子数据入库完成', data: stats };
  } catch (err) {
    console.error('[db-seed]', err);
    return { code: 500, msg: '种子脚本异常', error: err.message, data: stats };
  }
};

// ========== 批量插入辅助 ==========

async function _upsert(collection, keyField, items, stats, statKey) {
  for (const item of items) {
    try {
      const exist = await db.collection(collection)
        .where({ [keyField]: item[keyField] }).count();
      if (exist.total > 0) {
        stats.skipped++;
        continue;
      }
      item.createdAt = db.serverDate();
      item.updatedAt = db.serverDate();
      await db.collection(collection).add({ data: item });
      stats[statKey]++;
    } catch (e) {
      stats.errors++;
      console.error(`[seed] ${collection}.${item[keyField]}:`, e.message);
    }
  }
}

// ========== 1. 政策来源 ==========

async function seedPolicySources(stats) {
  const items = [
    {
      name: '入境处 — 优才计划',
      url: 'https://www.immd.gov.hk/hks/services/visas/quality_migrant_admission_scheme.html',
      category: 'qmas', institution: '入境处',
      checkFrequency: 'daily', priority: 1, isActive: true,
    },
    {
      name: '入境处 — 高才通计划',
      url: 'https://www.immd.gov.hk/hks/services/visas/TTPS.html',
      category: 'ttps', institution: '入境处',
      checkFrequency: 'daily', priority: 1, isActive: true,
    },
    {
      name: '入境处 — 一般就业政策（专才）',
      url: 'https://www.immd.gov.hk/hks/services/visas/general_employment_policy.html',
      category: 'asmpt', institution: '入境处',
      checkFrequency: 'daily', priority: 2, isActive: true,
    },
    {
      name: '入境处 — 非本地毕业生留港/回港就业安排 (IANG)',
      url: 'https://www.immd.gov.hk/hks/services/visas/IANG.html',
      category: 'iang', institution: '入境处',
      checkFrequency: 'daily', priority: 1, isActive: true,
    },
    {
      name: '入境处 — 资本投资者入境计划',
      url: 'https://www.immd.gov.hk/hks/services/visas/capital_investment_entrant_scheme.html',
      category: 'ci', institution: '入境处',
      checkFrequency: 'weekly', priority: 3, isActive: true,
    },
  ];
  await _upsert('policy_sources', 'name', items, stats, 'policy_sources');
}

// ========== 2. 内容风控规则 ==========

async function seedContentRules(stats) {
  const items = [
    {
      ruleType: 'blocked_keyword', category: 'fraud',
      keywords: ['代办', '包过', '保证通过', '100%成功', '内部渠道', '特殊关系', '走后门'],
      severity: 'high', isActive: true,
    },
    {
      ruleType: 'blocked_keyword', category: 'illegal_service',
      keywords: ['代考', '代签', '假材料', '伪造', 'PS证件', '刷分'],
      severity: 'high', isActive: true,
    },
    {
      ruleType: 'blocked_keyword', category: 'misleading',
      keywords: ['不用排队', '免面试', '特殊通道', '快速通道'],
      severity: 'medium', isActive: true,
    },
    {
      ruleType: 'policy_keyword', category: 'quota',
      keywords: ['配额', '名额', 'quota', 'cap', 'limit'],
      isActive: true,
    },
    {
      ruleType: 'policy_keyword', category: 'requirement',
      keywords: ['条件', '要求', '资格', 'requirement', 'eligibility', 'criteria'],
      isActive: true,
    },
    {
      ruleType: 'policy_keyword', category: 'relaxation',
      keywords: ['放宽', '简化', '便利', 'relax', 'simplify', 'streamline'],
      isActive: true,
    },
  ];
  await _upsert('content_rules', 'ruleType', items, stats, 'content_rules');
}

// ========== 3. 提醒规则 ==========

async function seedReminderRules(stats) {
  const items = [
    // QMAS 路径
    {
      ruleId: 'R_QMAS_EVAL', ruleName: '资格评估完成 → 启动材料准备',
      eventName: 'assessment_complete', pathType: 'qmas', phase: 'evaluation',
      triggerType: 'event', deadlineOffsetDays: 7, alertBeforeDays: [3, 1],
      titleTemplate: '开始准备{pathName}申请材料',
      descriptionTemplate: '评估已完成，建议在{deadlineOffsetDays}天内开始准备材料。',
      nextRuleId: 'R_QMAS_PREP', isActive: true,
    },
    {
      ruleId: 'R_QMAS_PREP', ruleName: '材料准备启动 → 推荐信准备',
      eventName: 'material_prep_start', pathType: 'qmas', phase: 'preparation',
      triggerType: 'event', deadlineOffsetDays: 14, alertBeforeDays: [7, 3, 1],
      titleTemplate: '准备推荐信',
      descriptionTemplate: '推荐信是QMAS申请的关键材料，建议尽早联系推荐人。',
      chainParentId: 'R_QMAS_EVAL', isActive: true,
    },
    {
      ruleId: 'R_QMAS_SUBMIT', ruleName: '材料齐备 → 递交申请',
      eventName: 'materials_ready', pathType: 'qmas', phase: 'submission',
      triggerType: 'event', deadlineOffsetDays: 30, alertBeforeDays: [14, 7, 3, 1],
      titleTemplate: '递交QMAS申请',
      descriptionTemplate: '材料已齐备，请在30天内递交申请。',
      isActive: true,
    },
    // TTPS 路径
    {
      ruleId: 'R_TTPS_EVAL', ruleName: '资格评估完成 → 启动材料准备',
      eventName: 'assessment_complete', pathType: 'ttps-a', phase: 'evaluation',
      triggerType: 'event', deadlineOffsetDays: 5, alertBeforeDays: [3, 1],
      titleTemplate: '开始准备{pathName}申请材料',
      isActive: true,
    },
    {
      ruleId: 'R_TTPS_BC_EVAL', ruleName: '资格评估完成 → 启动材料准备',
      eventName: 'assessment_complete', pathType: 'ttps-bc', phase: 'evaluation',
      triggerType: 'event', deadlineOffsetDays: 5, alertBeforeDays: [3, 1],
      titleTemplate: '开始准备{pathName}申请材料',
      isActive: true,
    },
    // IANG 路径
    {
      ruleId: 'R_IANG_GRAD', ruleName: '毕业 → 申请IANG签证',
      eventName: 'graduation', pathType: 'iang', phase: 'preparation',
      triggerType: 'event', deadlineOffsetDays: 180, alertBeforeDays: [90, 60, 30, 14, 7],
      titleTemplate: '即将毕业，准备IANG签证申请',
      descriptionTemplate: '毕业后6个月内需申请IANG签证。',
      isActive: true,
    },
    {
      ruleId: 'R_IANG_RENEWAL', ruleName: 'IANG续签提醒',
      eventName: 'visa_expiring', pathType: 'iang', phase: 'renewal',
      triggerType: 'event', deadlineOffsetDays: 28, alertBeforeDays: [90, 60, 30, 14, 7],
      titleTemplate: 'IANG签证即将到期',
      descriptionTemplate: '请在签证到期前28天提交续签申请。',
      isActive: true,
    },
    // 通用里程碑提醒
    {
      ruleId: 'R_DOC_EXPIRY', ruleName: '证件到期提醒',
      eventName: 'doc_expiring', pathType: '*', phase: '*',
      triggerType: 'ocr_date', deadlineOffsetDays: 0, alertBeforeDays: [90, 60, 30, 14, 7],
      titleTemplate: '{docType}即将到期',
      descriptionTemplate: '您的{docType}将在{daysRemaining}天后到期，请及时更新。',
      isActive: true,
    },
    {
      ruleId: 'R_PR_ELIGIBLE', ruleName: '永居资格提醒',
      eventName: 'pr_eligible', pathType: '*', phase: 'pr',
      triggerType: 'event', deadlineOffsetDays: 0, alertBeforeDays: [365, 180, 90, 60, 30],
      titleTemplate: '您已满足永居申请条件',
      descriptionTemplate: '在香港连续居住满7年，可申请核实永久居民身份。',
      isActive: true,
    },
    {
      ruleId: 'R_TRIAL_EXPIRY', ruleName: '免费试用到期提醒',
      eventName: 'trial_expiring', pathType: '*', phase: '*',
      triggerType: 'cron', deadlineOffsetDays: 180, alertBeforeDays: [30, 14, 7, 3, 1],
      titleTemplate: '免费试用即将到期',
      descriptionTemplate: '您的免费试用将在{daysRemaining}天后到期，到期后功能将锁定。',
      isActive: true,
    },
    {
      ruleId: 'R_SUBMISSION_FOLLOW', ruleName: '递交后跟进提醒',
      eventName: 'application_submitted', pathType: '*', phase: 'waiting',
      triggerType: 'event', deadlineOffsetDays: 90, alertBeforeDays: [60, 30, 14],
      titleTemplate: '已递交{pathName}申请{days}天',
      isActive: true,
    },
    // 定居阶段
    {
      ruleId: 'R_SETTLE_HKID', ruleName: '抵港后申领香港身份证',
      eventName: 'arrived_hk', pathType: '*', phase: 'settlement',
      triggerType: 'event', deadlineOffsetDays: 30, alertBeforeDays: [14, 7, 3],
      titleTemplate: '抵港后30天内申领香港身份证',
      isActive: true,
    },
    {
      ruleId: 'R_SETTLE_BANK', ruleName: '开立香港银行账户提醒',
      eventName: 'hkid_obtained', pathType: '*', phase: 'settlement',
      triggerType: 'event', deadlineOffsetDays: 30, alertBeforeDays: [14, 7],
      titleTemplate: '建议尽快开立香港银行账户',
      isActive: true,
    },
    // 续签
    {
      ruleId: 'R_RENEWAL_EMPLOYMENT', ruleName: '续签就业证明更新',
      eventName: 'renewal_period_start', pathType: '*', phase: 'renewal',
      triggerType: 'event', deadlineOffsetDays: 90, alertBeforeDays: [60, 30, 14, 7],
      titleTemplate: '请更新就业证明材料',
      isActive: true,
    },
    {
      ruleId: 'R_RENEWAL_TAX', ruleName: '续签税单准备',
      eventName: 'tax_season', pathType: '*', phase: 'renewal',
      triggerType: 'cron', deadlineOffsetDays: 90, alertBeforeDays: [60, 30, 14],
      titleTemplate: '报税季——请保留税单用于续签',
      isActive: true,
    },
    // 永居
    {
      ruleId: 'R_PR_DOCS', ruleName: '永居申请材料准备',
      eventName: 'pr_eligible', pathType: '*', phase: 'pr',
      triggerType: 'event', deadlineOffsetDays: 0, alertBeforeDays: [180, 90, 60, 30],
      titleTemplate: '永居申请材料清单确认',
      chainParentId: 'R_PR_ELIGIBLE', isActive: true,
    },
    {
      ruleId: 'R_PR_ABSENCE', ruleName: '永居离港天数检查',
      eventName: 'pr_eligible', pathType: '*', phase: 'pr',
      triggerType: 'event', deadlineOffsetDays: 0, alertBeforeDays: [180, 90],
      titleTemplate: '检查离港天数是否符合永居要求',
      descriptionTemplate: '连续7年每年离港不超过180天。',
      isActive: true,
    },
  ];
  await _upsert('reminder_rules', 'ruleId', items, stats, 'reminder_rules');
}

// ========== 4. 归档规则 ==========

async function seedArchivingRules(stats) {
  const items = [
    { ruleId: 'AR_QMAS_APPROVAL', pathType: 'qmas', stageName: '获批', triggerEvent: 'milestone_approval_qmas', archiveTitle: 'QMAS申请档案', deletableWhenArchived: false },
    { ruleId: 'AR_TTPS_APPROVAL', pathType: 'ttps-a', stageName: '获批', triggerEvent: 'milestone_approval_ttps', archiveTitle: '高才通A类申请档案', deletableWhenArchived: false },
    { ruleId: 'AR_TTPS_BC_APPROVAL', pathType: 'ttps-bc', stageName: '获批', triggerEvent: 'milestone_approval_ttps_bc', archiveTitle: '高才通B/C类申请档案', deletableWhenArchived: false },
    { ruleId: 'AR_ASMPT_APPROVAL', pathType: 'asmpt', stageName: '获批', triggerEvent: 'milestone_approval_asmpt', archiveTitle: '专才申请档案', deletableWhenArchived: false },
    { ruleId: 'AR_IANG_APPROVAL', pathType: 'iang', stageName: '获批', triggerEvent: 'milestone_approval_iang', archiveTitle: 'IANG申请档案', deletableWhenArchived: false },
    { ruleId: 'AR_CI_APPROVAL', pathType: 'ci', stageName: '获批', triggerEvent: 'milestone_approval_ci', archiveTitle: '资本投资者入境档案', deletableWhenArchived: false },
    { ruleId: 'AR_QMAS_RENEWAL_V1', pathType: 'qmas', stageName: '第一次续签', triggerEvent: 'renewal_1_complete', archiveTitle: 'QMAS第一次续签档案', deletableWhenArchived: false },
    { ruleId: 'AR_QMAS_RENEWAL_V2', pathType: 'qmas', stageName: '第二次续签', triggerEvent: 'renewal_2_complete', archiveTitle: 'QMAS第二次续签档案', deletableWhenArchived: false },
    { ruleId: 'AR_TTPS_RENEWAL_V1', pathType: 'ttps-a', stageName: '第一次续签', triggerEvent: 'renewal_1_complete', archiveTitle: '高才通A类第一次续签档案', deletableWhenArchived: false },
    { ruleId: 'AR_TTPS_RENEWAL_V2', pathType: 'ttps-a', stageName: '第二次续签', triggerEvent: 'renewal_2_complete', archiveTitle: '高才通A类第二次续签档案', deletableWhenArchived: false },
    { ruleId: 'AR_IANG_RENEWAL', pathType: 'iang', stageName: '续签', triggerEvent: 'renewal_complete', archiveTitle: 'IANG续签档案', deletableWhenArchived: false },
    { ruleId: 'AR_ASMPT_RENEWAL', pathType: 'asmpt', stageName: '续签', triggerEvent: 'renewal_complete', archiveTitle: '专才续签档案', deletableWhenArchived: false },
    { ruleId: 'AR_PR_APPROVAL', pathType: '*', stageName: '永居获批', triggerEvent: 'pr_approved', archiveTitle: '永居申请档案 —— 永久保存', deletableWhenArchived: false },
    { ruleId: 'AR_QMAS_ABANDONED', pathType: 'qmas', stageName: '放弃/被拒', triggerEvent: 'process_rejected', archiveTitle: 'QMAS申请档案（未获批）', deletableWhenArchived: true },
    { ruleId: 'AR_TTPS_ABANDONED', pathType: 'ttps-a', stageName: '放弃/被拒', triggerEvent: 'process_rejected', archiveTitle: '高才通申请档案（未获批）', deletableWhenArchived: true },
    { ruleId: 'AR_IANG_ABANDONED', pathType: 'iang', stageName: '放弃/被拒', triggerEvent: 'process_rejected', archiveTitle: 'IANG申请档案（未获批）', deletableWhenArchived: true },
    { ruleId: 'AR_GENERAL_ARCHIVE', pathType: '*', stageName: '*', triggerEvent: 'manual_archive', archiveTitle: '手动归档', deletableWhenArchived: true },
  ];
  await _upsert('archiving_rules', 'ruleId', items, stats, 'archiving_rules');
}

// ========== 5. 指引条目 ==========

async function seedGuideItems(stats) {
  const items = [
    {
      guideId: 'G_QMAS_OVERVIEW', nodeId: 'node_qmas', nodeName: '优才计划',
      title: '优才计划概览', category: 'overview', status: 'active',
      layers: {
        overview: '优秀人才入境计划（QMAS）2025年11月起改革，取消旧计分制，改为12项是/否评核准则，满足≥6项即可提交申请。',
        prerequisites: '12项评核准则（满足≥6项可申请）：A.年龄≤50岁 B1.合资格大学硕博 B2.STEM学科 C1.两种语言能力 C2.英文达标 D1.5年+经验 D2.3年+名企经验 D3.3年+创科/金融/贸易经验 D4.2年+国际经验 E.年收入≥100万港币 F1.拥有年盈利≥500万企业 F2.持上市公司≥10%股权',
        materials: '身份证、港澳通行证、学位证书、工作证明、推荐信、赴港计划书、资产证明。',
        steps: '1. 对照12项准则自评 → 2. 准备材料 → 3. 递交申请 → 4. 甄选程序 → 5. 获批通知 → 6. 办理签证',
        fees: '申请费：HKD XXX；签证费：HKD XXX（以入境处最新公告为准）',
        faqs: 'Q: 新版和旧版有什么区别？ A: 旧版为综合计分制（80分及格），新版改为12项准则是/否判断（≥6项可申请）。Q: 申请周期多长？ A: 一般6-12个月。',
      },
      layerVisibility: { overview: true, prerequisites: true, materials: true, steps: true, fees: true, faqs: true },
      sourceRefs: ['入境处官网 QMAS页面'],
      lastPolicyVersion: '2025-Q1', lastUpdatedAt: '2025-05-09',
    },
    {
      guideId: 'G_TTPS_A_OVERVIEW', nodeId: 'node_ttps_a', nodeName: '高才通A类',
      title: '高才通A类概览', category: 'overview', status: 'active',
      layers: {
        overview: '高端人才通行证计划A类：申请前一年全年收入达港币250万元或以上。',
        prerequisites: '申请前一年全年收入≥HKD 2,500,000（含薪金、津贴、股票期权等）。',
        materials: '身份证、港澳通行证、收入证明（税单、银行流水、雇主证明信）、学历证明。',
        steps: '1. 确认收入达标 → 2. 准备证明材料 → 3. 在线递交 → 4. 等候审批（约4周）',
        fees: '签证费：HKD XXX（以入境处最新公告为准）',
        faqs: 'Q: 收入包含哪些？ A: 薪金、津贴、股票期权、公司分红等均可计入。',
      },
      layerVisibility: { overview: true, prerequisites: true, materials: true, steps: true, fees: true, faqs: true },
      sourceRefs: ['入境处官网 TTPS页面'],
      lastPolicyVersion: '2024-Q4', lastUpdatedAt: '2024-12-01',
    },
    {
      guideId: 'G_TTPS_BC_OVERVIEW', nodeId: 'node_ttps_bc', nodeName: '高才通B/C类',
      title: '高才通B/C类概览', category: 'overview', status: 'active',
      layers: {
        overview: 'B类：获全球百强大学学士学位+申请前5年有3年工作经验。C类：获全球百强大学学士学位+工作经验少于3年（限额1万）。',
        prerequisites: 'B类：百强学士+3年经验。C类：百强学士+毕业5年内（年度限额10,000）。',
        materials: '身份证、港澳通行证、学位证书及成绩单、工作经验证明（B类）。',
        steps: '1. 确认学历资格 → 2. 准备材料 → 3. 在线递交 → 4. 等候审批',
        fees: '签证费：HKD XXX（以入境处最新公告为准）',
        faqs: 'Q: 哪些大学算百强？ A: 参考QS、THE、U.S. News、ARWU四大排名前100。',
      },
      layerVisibility: { overview: true, prerequisites: true, materials: true, steps: true, fees: true, faqs: true },
      sourceRefs: ['入境处官网 TTPS页面'],
      lastPolicyVersion: '2024-Q4', lastUpdatedAt: '2024-12-01',
    },
    {
      guideId: 'G_ASMPT_OVERVIEW', nodeId: 'node_asmpt', nodeName: '专才计划',
      title: '专才计划概览', category: 'overview', status: 'active',
      layers: {
        overview: '输入内地人才计划（ASMPT）旨在吸引具有认可资历的内地专业人才来港工作。',
        prerequisites: '已获香港雇主聘用、具备香港缺乏的专业技能/知识/经验、薪酬福利与香港市场水平相当。',
        materials: '身份证、港澳通行证、雇佣合约、学历证明、工作经验证明、雇主公司资料。',
        steps: '1. 获得香港雇主聘用 → 2. 雇主提交申请 → 3. 入境处审批 → 4. 获批后办理签证',
        fees: '申请费：HKD XXX；签证费：HKD XXX',
        faqs: 'Q: 需要先有工作才能申请吗？ A: 是的，需要先获香港雇主聘用。',
      },
      layerVisibility: { overview: true, prerequisites: true, materials: true, steps: true, fees: true, faqs: true },
      sourceRefs: ['入境处官网 GEP页面'],
      lastPolicyVersion: '2024-Q4', lastUpdatedAt: '2024-12-01',
    },
    {
      guideId: 'G_IANG_OVERVIEW', nodeId: 'node_iang', nodeName: 'IANG',
      title: 'IANG签证概览', category: 'overview', status: 'active',
      layers: {
        overview: '非本地毕业生留港/回港就业安排（IANG）：在香港修读全日制课程并获得学士或更高学位的非本地学生可申请。',
        prerequisites: '在香港高校获得学士或以上学位（全日制）。',
        materials: '身份证、港澳通行证、毕业证书/成绩单、在港住址证明。',
        steps: '1. 完成学业 → 2. 毕业后6个月内申请 → 3. 获批IANG签证（1年） → 4. 找/换工作',
        fees: '签证费：HKD XXX',
        faqs: 'Q: 毕业后多久内申请？ A: 毕业后6个月内申请无需先找到工作。',
      },
      layerVisibility: { overview: true, prerequisites: true, materials: true, steps: true, fees: true, faqs: true },
      sourceRefs: ['入境处官网 IANG页面'],
      lastPolicyVersion: '2024-Q4', lastUpdatedAt: '2024-12-01',
    },
    {
      guideId: 'G_CI_OVERVIEW', nodeId: 'node_ci', nodeName: '资本投资者入境计划',
      title: '资本投资者入境计划概览', category: 'overview', status: 'active',
      layers: {
        overview: '资本投资者入境计划：投资者将不少于港币3,000万元投资于获许金融资产。',
        prerequisites: '年满18岁、无犯罪记录、净资产≥HKD 30,000,000。',
        materials: '身份证、港澳通行证、资产证明文件、投资计划书、无犯罪记录证明。',
        steps: '1. 确认资产达标 → 2. 委托金融机构 → 3. 递交申请 → 4. 获批后完成投资',
        fees: '申请费：HKD XXX；签证费：HKD XXX',
        faqs: 'Q: 最低投资额多少？ A: 港币3,000万元。',
      },
      layerVisibility: { overview: true, prerequisites: true, materials: true, steps: true, fees: true, faqs: true },
      sourceRefs: ['入境处官网 CIES页面'],
      lastPolicyVersion: '2024-Q4', lastUpdatedAt: '2024-12-01',
    },
    // 核心节点指引 (MVP 6个节点 GD-03.1)
    {
      guideId: 'G_PHOTO_SPEC', nodeId: 'node_photo', nodeName: '证件照',
      title: '证件照规格要求', category: 'material', status: 'active',
      layers: {
        overview: '香港入境处对证件照有严格的规格要求，不符合将被退回。',
        prerequisites: '拍摄时需注意背景、尺寸、面部比例等要求。',
        materials: '证件照电子版或实体照片（视申请方式而定）。',
        steps: '1. 了解规格 → 2. 选择合规照相馆 → 3. 拍摄 → 4. 获取电子版+实体版',
        fees: '约HKD 50-150（视照相馆而定）',
        faqs: 'Q: 可以自己拍吗？ A: 不建议，容易因规格不符被退回。',
      },
      layerVisibility: { overview: true, prerequisites: true, materials: true, steps: true, fees: true, faqs: true },
      sourceRefs: ['入境处照片规格指引'],
      lastPolicyVersion: '2024-Q4', lastUpdatedAt: '2024-12-01',
    },
    {
      guideId: 'G_RECOMMENDATION', nodeId: 'node_recommendation', nodeName: '推荐信',
      title: '推荐信撰写指引', category: 'material', status: 'active',
      layers: {
        overview: '推荐信是优才计划（QMAS）等申请的关键材料之一，需由行业内有影响力的人士出具。',
        prerequisites: '推荐人应了解申请人的专业能力和成就。',
        materials: '推荐信（含推荐人签名和联系方式）。',
        steps: '1. 确定推荐人 → 2. 与推荐人沟通 → 3. 提供简历参考 → 4. 获取推荐信',
        fees: '免费（若有第三方撰写服务，约HKD 2,000-5,000）',
        faqs: 'Q: 需要几封？ A: 一般2-3封。 Q: 推荐人有要求吗？ A: 建议是本领域资深人士。',
      },
      layerVisibility: { overview: true, prerequisites: true, materials: true, steps: true, fees: true, faqs: true },
      sourceRefs: ['入境处 QMAS 申请指南'],
      lastPolicyVersion: '2024-Q4', lastUpdatedAt: '2024-12-01',
    },
    {
      guideId: 'G_PLAN_BOOK', nodeId: 'node_planbook', nodeName: '赴港计划书',
      title: '赴港计划书撰写指引', category: 'material', status: 'active',
      layers: {
        overview: '赴港计划书需要阐述申请人在港的发展规划及对香港的贡献。',
        prerequisites: '需结合自身专业背景和香港产业需求撰写。',
        materials: '赴港计划书（建议A4纸2-3页）。',
        steps: '1. 研究香港产业政策 → 2. 分析自身优势 → 3. 撰写计划书 → 4. 校对修改',
        fees: '免费（专业撰写服务约HKD 3,000-8,000）',
        faqs: 'Q: 多长合适？ A: 2-3页A4纸。 Q: 用中文还是英文？ A: 中文即可。',
      },
      layerVisibility: { overview: true, prerequisites: true, materials: true, steps: true, fees: true, faqs: true },
      sourceRefs: ['入境处 QMAS 申请指南'],
      lastPolicyVersion: '2024-Q4', lastUpdatedAt: '2024-12-01',
    },
    {
      guideId: 'G_DEGREE_AUTH', nodeId: 'node_degree', nodeName: '学位认证',
      title: '学历/学位认证指引', category: 'material', status: 'active',
      layers: {
        overview: '海外学历可能需要学信网或指定机构的认证。',
        prerequisites: '需提供学位证书原件扫描件和成绩单。',
        materials: '学位证书、成绩单、学信网认证报告（如适用）。',
        steps: '1. 确认是否需要认证 → 2. 登录学信网 → 3. 提交认证申请 → 4. 获取认证报告',
        fees: '学信网认证费约RMB XXX/次',
        faqs: 'Q: 哪些学位需要认证？ A: 非香港高校授予的学位一般需要认证。',
      },
      layerVisibility: { overview: true, prerequisites: true, materials: true, steps: true, fees: true, faqs: true },
      sourceRefs: ['学信网', '入境处学历认可指引'],
      lastPolicyVersion: '2024-Q4', lastUpdatedAt: '2024-12-01',
    },
    {
      guideId: 'G_BANK_STMT', nodeId: 'node_bank', nodeName: '资产证明',
      title: '银行流水/资产证明指引', category: 'material', status: 'active',
      layers: {
        overview: '需提供银行存款证明或银行流水，证明有足够经济能力在港生活。',
        prerequisites: '账户余额需符合入境处要求的最低金额。',
        materials: '银行存款证明（中英文版）、近3-6个月银行流水。',
        steps: '1. 确认金额要求 → 2. 联系银行开具 → 3. 核对中英文信息 → 4. 获取盖章版本',
        fees: '大部分银行开具存款证明免费或小额收费',
        faqs: 'Q: 最低金额多少？ A: 以入境处最新公告为准。 Q: 人民币可以吗？ A: 可以，一般折算港币。',
      },
      layerVisibility: { overview: true, prerequisites: true, materials: true, steps: true, fees: true, faqs: true },
      sourceRefs: ['入境处经济能力证明要求'],
      lastPolicyVersion: '2024-Q4', lastUpdatedAt: '2024-12-01',
    },
    {
      guideId: 'G_NO_CRIME', nodeId: 'node_nocrime', nodeName: '无犯罪记录证明',
      title: '无犯罪记录证明办理指引', category: 'material', status: 'active',
      layers: {
        overview: '部分签证类型需要提供无犯罪记录证明（俗称"良民证"）。',
        prerequisites: '需在户籍所在地或常住地公安机关申请。',
        materials: '身份证、户口本、申请表（各地要求略有不同）。',
        steps: '1. 确认是否需要 → 2. 前往户籍地派出所 → 3. 填写申请表 → 4. 等待出具（约7-15工作日）',
        fees: '免费或小额工本费',
        faqs: 'Q: 有效期多久？ A: 一般6个月。 Q: 需要公证吗？ A: 视入境处要求。',
      },
      layerVisibility: { overview: true, prerequisites: true, materials: true, steps: true, fees: true, faqs: true },
      sourceRefs: ['入境处背景审查要求'],
      lastPolicyVersion: '2024-Q4', lastUpdatedAt: '2024-12-01',
    },
    // 续签指引
    {
      guideId: 'G_RENEWAL_QMAS', nodeId: 'node_renewal', nodeName: '续签',
      title: 'QMAS/高才通续签指引', category: 'renewal', status: 'active',
      layers: {
        overview: '续签需要证明在港有实际居住和经济贡献。',
        prerequisites: '在港连续通常居住、有稳定工作或业务、无犯罪记录。',
        materials: '香港身份证、雇佣合约、最近一年税单、强积金记录、银行月结单（近半年）、住址证明。',
        steps: '1. 确认续签资格 → 2. 收集居住/工作证明 → 3. 递交续签申请 → 4. 等候审批',
        fees: '续签费：HKD XXX',
        faqs: 'Q: 提前多久申请续签？ A: 一般到期前4周。 Q: 续签批多久？ A: 一般2-3年。',
      },
      layerVisibility: { overview: true, prerequisites: true, materials: true, steps: true, fees: true, faqs: true },
      sourceRefs: ['入境处续签指引'],
      lastPolicyVersion: '2024-Q4', lastUpdatedAt: '2024-12-01',
    },
    {
      guideId: 'G_RENEWAL_IANG', nodeId: 'node_renewal', nodeName: '续签',
      title: 'IANG续签指引', category: 'renewal', status: 'active',
      layers: {
        overview: 'IANG续签需要证明在港有就业或已开办业务。',
        prerequisites: '持有有效IANG签证、在港有工作或业务。',
        materials: '香港身份证、雇佣合约、公司证明信、强积金记录、住址证明。',
        steps: '1. 确认在港就业状态 → 2. 收集就业证明 → 3. 递交续签申请 → 4. 等候审批',
        fees: '续签费：HKD XXX',
        faqs: 'Q: 可以转换雇主吗？ A: 可以，续签时提供新雇主资料即可。',
      },
      layerVisibility: { overview: true, prerequisites: true, materials: true, steps: true, fees: true, faqs: true },
      sourceRefs: ['入境处 IANG 续签指引'],
      lastPolicyVersion: '2024-Q4', lastUpdatedAt: '2024-12-01',
    },
    {
      guideId: 'G_PR_CHECKLIST', nodeId: 'node_pr', nodeName: '永居',
      title: '永居申请完整清单', category: 'pr', status: 'active',
      layers: {
        overview: '在港连续通常居住满7年可申请核实永久居民身份。',
        prerequisites: '连续通常居住满7年、无犯罪记录、有稳定收入来源。',
        materials: '香港身份证、连续7年签证/入境记录、7年税单、住址证明（7年）、强积金记录。',
        steps: '1. 确认居住满7年 → 2. 整理7年记录 → 3. 填写申请表 → 4. 递交 → 5. 面见核实',
        fees: '申请费：HKD XXX',
        faqs: 'Q: 7年是否必须连续？ A: 是的，每年离港不超过180天。 Q: 7年从哪开始算？ A: 首次以受养人或工作身份入境之日。',
      },
      layerVisibility: { overview: true, prerequisites: true, materials: true, steps: true, fees: true, faqs: true },
      sourceRefs: ['入境处永居申请指引'],
      lastPolicyVersion: '2024-Q4', lastUpdatedAt: '2024-12-01',
    },
    // 定居指引
    {
      guideId: 'G_SETTLE_HKID', nodeId: 'node_settle', nodeName: '定居',
      title: '抵港后办理香港身份证', category: 'settlement', status: 'active',
      layers: {
        overview: '抵港后30天内必须到人事登记处申领香港身份证。',
        prerequisites: '持有有效签证/进入许可、已抵港。',
        materials: '港澳通行证、签证/进入许可标签（贴在通行证上）、住址证明。',
        steps: '1. 网上预约 → 2. 到人事登记处 → 3. 填表+拍照+打指纹 → 4. 领取收据 → 5. 约10天后领取正式证',
        fees: '首次登记免费',
        faqs: 'Q: 必须30天内吗？ A: 是的，逾期可能被检控。',
      },
      layerVisibility: { overview: true, prerequisites: true, materials: true, steps: true, fees: true, faqs: true },
      sourceRefs: ['入境处人事登记指引'],
      lastPolicyVersion: '2024-Q4', lastUpdatedAt: '2024-12-01',
    },
    {
      guideId: 'G_SETTLE_MPF', nodeId: 'node_settle', nodeName: '定居',
      title: '强积金（MPF）开户指引', category: 'settlement', status: 'active',
      layers: {
        overview: '在香港工作后需加入强制性公积金计划。',
        prerequisites: '在香港有雇佣关系（自雇人士也需参加）。',
        materials: '香港身份证、雇佣合约。',
        steps: '1. 雇主选择MPF受托人 → 2. 填写登记表 → 3. 确定供款比例（雇员/雇主各5%）',
        fees: '视受托人而定，年管理费约0.5%-1.5%',
        faqs: 'Q: 供款比例？ A: 雇员和雇主各供月薪的5%（设有上下限）。',
      },
      layerVisibility: { overview: true, prerequisites: true, materials: true, steps: true, fees: true, faqs: true },
      sourceRefs: ['积金局指引'],
      lastPolicyVersion: '2024-Q4', lastUpdatedAt: '2024-12-01',
    },
    {
      guideId: 'G_SETTLE_TAX', nodeId: 'node_settle', nodeName: '定居',
      title: '香港税务申报指引', category: 'settlement', status: 'active',
      layers: {
        overview: '香港实行地域来源征税原则，薪俸税税率2%-17%累进或15%标准税率。',
        prerequisites: '在港有应课税收入。',
        materials: '雇主提供的IR56B表格、收入证明、可扣除项目证明（MPF、慈善捐款等）。',
        steps: '1. 收到报税表（每年5月） → 2. 填写收入/扣除项 → 3. 1个月内递交 → 4. 收到评税通知',
        fees: '报税本身免费',
        faqs: 'Q: 税率多少？ A: 薪俸税：应课税收入×累进税率（2%-17%）或标准税率15%，取较低者。',
      },
      layerVisibility: { overview: true, prerequisites: true, materials: true, steps: true, fees: true, faqs: true },
      sourceRefs: ['税务局指引'],
      lastPolicyVersion: '2024-Q4', lastUpdatedAt: '2024-12-01',
    },
  ];
  await _upsert('guide_items', 'guideId', items, stats, 'guide_items');
}

// ========== 6. 材料标准 ==========

async function seedMaterialStandards(stats) {
  const items = [
    {
      materialType: 'HK_PERMIT', materialName: '港澳通行证',
      applicablePaths: ['qmas', 'ttps-a', 'ttps-bc', 'asmpt', 'iang', 'ci'],
      sourceDocTypes: ['HK_PERMIT', 'ID_CARD'], isRequired: true,
      originalRequirement: '扫描件（正反面）', stampRequirement: null,
      translationRequirement: null, validityPeriod: '10年（成人）',
      commonMistakes: ['只上传正面未上传反面', '有效期不足6个月'],
      obtainMethod: '户籍地公安局出入境管理处', obtainPeriod: '7-15工作日',
      status: 'active',
    },
    {
      materialType: 'PASSPORT', materialName: '护照',
      applicablePaths: ['qmas', 'ttps-a', 'ttps-bc', 'asmpt', 'iang', 'ci'],
      sourceDocTypes: ['PASSPORT'], isRequired: true,
      originalRequirement: '扫描件（个人信息页）', stampRequirement: null,
      translationRequirement: null, validityPeriod: '10年（成人）',
      commonMistakes: ['护照页模糊', '有效期不足'],
      obtainMethod: '户籍地公安局出入境管理处', obtainPeriod: '7-15工作日',
      status: 'active',
    },
    {
      materialType: 'HK_ID', materialName: '香港身份证',
      applicablePaths: ['qmas', 'ttps-a', 'ttps-bc', 'asmpt', 'iang', 'ci'],
      sourceDocTypes: ['HK_ID'], isRequired: false,
      originalRequirement: '扫描件', stampRequirement: null,
      translationRequirement: null, validityPeriod: '永久有效',
      commonMistakes: [],
      obtainMethod: '入境处人事登记处（抵港后）', obtainPeriod: '约10个工作日',
      status: 'active',
    },
    {
      materialType: 'DEGREE', materialName: '学位证书',
      applicablePaths: ['qmas', 'ttps-a', 'ttps-bc', 'asmpt', 'iang'],
      sourceDocTypes: ['DEGREE'], isRequired: true,
      originalRequirement: '扫描件', stampRequirement: '需有学校公章',
      translationRequirement: '非中英文版本需翻译公证', validityPeriod: '永久有效',
      commonMistakes: ['只上传学位证未上传成绩单', '海外学历未做认证'],
      obtainMethod: '毕业院校教务处', obtainPeriod: '视学校流程',
      status: 'active',
    },
    {
      materialType: 'BANK_STATEMENT', materialName: '银行流水/存款证明',
      applicablePaths: ['qmas', 'ttps-a', 'ci'],
      sourceDocTypes: ['BANK_STATEMENT', 'TAX_RETURN'], isRequired: true,
      originalRequirement: '银行盖章版本', stampRequirement: '需有银行公章',
      translationRequirement: '需中英文版本', validityPeriod: '开具后3个月内有效',
      commonMistakes: ['金额不足', '未翻译', '无银行盖章'],
      obtainMethod: '银行柜台或网银', obtainPeriod: '即日（柜台）或2-3工作日',
      status: 'active',
    },
    {
      materialType: 'EMPLOYMENT_CONTRACT', materialName: '工作证明/雇佣合约',
      applicablePaths: ['qmas', 'ttps-a', 'asmpt', 'iang'],
      sourceDocTypes: ['EMPLOYMENT_CONTRACT'], isRequired: true,
      originalRequirement: '扫描件', stampRequirement: '需有公司公章',
      translationRequirement: '非中英文版本需翻译', validityPeriod: '近3个月内出具',
      commonMistakes: ['未注明职位/薪资', '无公司盖章', '合约已过期'],
      obtainMethod: '雇主HR部门', obtainPeriod: '视公司流程',
      status: 'active',
    },
    {
      materialType: 'TAX_RETURN', materialName: '税单/纳税证明',
      applicablePaths: ['qmas', 'ttps-a'],
      sourceDocTypes: ['TAX_RETURN'], isRequired: false,
      originalRequirement: '税务局出具版本', stampRequirement: null,
      translationRequirement: null, validityPeriod: '最近1-3个纳税年度',
      commonMistakes: ['只上传了代扣代缴凭证而非税务局证明'],
      obtainMethod: '税务局网站或办税服务厅', obtainPeriod: '即日（电子）或5-10工作日',
      status: 'active',
    },
    {
      materialType: 'POLICE_CLEARANCE', materialName: '无犯罪记录证明',
      applicablePaths: ['qmas', 'ci'],
      sourceDocTypes: ['POLICE_CLEARANCE'], isRequired: true,
      originalRequirement: '公安机关出具原件', stampRequirement: '需有公安机关公章',
      translationRequirement: '需中英文或翻译公证', validityPeriod: '出具后6个月内有效',
      commonMistakes: ['未翻译', '超过有效期', '申请地区不对'],
      obtainMethod: '户籍地派出所或公安局', obtainPeriod: '7-15工作日',
      status: 'active',
    },
    {
      materialType: 'PHOTO', materialName: '证件照',
      applicablePaths: ['qmas', 'ttps-a', 'ttps-bc', 'asmpt', 'iang', 'ci'],
      sourceDocTypes: ['PHOTO'], isRequired: true,
      originalRequirement: '电子版（JPG/PNG）', stampRequirement: null,
      translationRequirement: null, validityPeriod: '6个月内拍摄',
      commonMistakes: ['背景非白色', '尺寸不符', '戴深色眼镜', '过度修图'],
      obtainMethod: '照相馆或自助拍照机', obtainPeriod: '即日',
      formatStandard: {
        photoSpec: { size: '55mm×45mm（头部34mm-39mm）', backgroundColor: '白色', headRatio: '面部占画面70-80%', recency: '6个月内' }
      },
      status: 'active',
    },
    {
      materialType: 'ADDRESS_PROOF', materialName: '住址证明',
      applicablePaths: ['qmas', 'ttps-a', 'ttps-bc', 'asmpt', 'iang', 'ci'],
      sourceDocTypes: ['ADDRESS_PROOF', 'BANK_STATEMENT'], isRequired: true,
      originalRequirement: '近3个月内发出的账单/信件', stampRequirement: null,
      translationRequirement: null, validityPeriod: '发出后3个月内有效',
      commonMistakes: ['地址与申请表不一致', '超出3个月有效期'],
      obtainMethod: '电费/水费/银行账单', obtainPeriod: '即日（电子账单）',
      status: 'active',
    },
    {
      materialType: 'APPROVAL_LETTER', materialName: '批准信/签证标签',
      applicablePaths: ['qmas', 'ttps-a', 'ttps-bc', 'asmpt', 'iang', 'ci'],
      sourceDocTypes: ['APPROVAL_LETTER'], isRequired: true,
      originalRequirement: '扫描件（含签证标签页）', stampRequirement: null,
      translationRequirement: null, validityPeriod: '按签证有效期',
      commonMistakes: ['未上传签证标签页', '未包含附带条件页'],
      obtainMethod: '入境处发出', obtainPeriod: '获批后约2-4周',
      status: 'active',
    },
    {
      materialType: 'MARRIAGE_CERT', materialName: '结婚证书',
      applicablePaths: ['qmas', 'ttps-a', 'ttps-bc', 'asmpt', 'iang', 'ci'],
      sourceDocTypes: ['MARRIAGE_CERT'], isRequired: false,
      originalRequirement: '扫描件', stampRequirement: '需有民政部门公章',
      translationRequirement: '非中英文版本需翻译公证', validityPeriod: '永久有效',
      commonMistakes: [],
      obtainMethod: '民政部门', obtainPeriod: '即日（电子）',
      status: 'active',
    },
  ];
  await _upsert('material_standards', 'materialType', items, stats, 'material_standards');
}

// ========== 7. 流程模板 ==========

async function seedProcessTemplates(stats) {
  const items = [
    {
      templateId: 'qmas', templateName: '优才计划（QMAS）申请流程',
      applicablePaths: ['qmas'], totalStages: 6, version: '1.0.0', isActive: true,
      stages: [
        {
          stageId: 'qmas_eval', stageName: '资格评估', order: 1,
          description: '对照12项评核准则，评估是否符合优才计划申请条件（≥6项可申请）',
          isMilestone: false,
          steps: [
            { stepId: 'qmas_eval_1', stepName: '完成在线资格评估', order: 1, requiredMaterials: [{ materialType: 'HK_PERMIT', isOptional: false }] },
            { stepId: 'qmas_eval_2', stepName: '查看评估结果与建议路径', order: 2, requiredMaterials: [] },
          ],
        },
        {
          stageId: 'qmas_prep', stageName: '材料准备', order: 2,
          description: '收集和准备所有申请材料',
          isMilestone: false,
          steps: [
            { stepId: 'qmas_prep_1', stepName: '准备身份证明文件', order: 1, requiredMaterials: [{ materialType: 'HK_PERMIT', isOptional: false }, { materialType: 'PASSPORT', isOptional: false }] },
            { stepId: 'qmas_prep_2', stepName: '准备学历证明', order: 2, requiredMaterials: [{ materialType: 'DEGREE', isOptional: false }] },
            { stepId: 'qmas_prep_3', stepName: '准备工作证明', order: 3, requiredMaterials: [{ materialType: 'EMPLOYMENT_CONTRACT', isOptional: false }] },
            { stepId: 'qmas_prep_4', stepName: '准备资产证明', order: 4, requiredMaterials: [{ materialType: 'BANK_STATEMENT', isOptional: false }] },
            { stepId: 'qmas_prep_5', stepName: '准备推荐信和计划书', order: 5, requiredMaterials: [] },
          ],
        },
        {
          stageId: 'qmas_submit', stageName: '递交申请', order: 3,
          description: '向入境处提交申请',
          isMilestone: true, milestoneDocType: 'APPLICATION_FORM',
          ocrValidationRule: { docTypeDetected: 'APPLICATION_FORM' },
          steps: [
            { stepId: 'qmas_submit_1', stepName: '核对所有材料', order: 1, requiredMaterials: [] },
            { stepId: 'qmas_submit_2', stepName: '在线递交申请', order: 2, requiredMaterials: [] },
          ],
        },
        {
          stageId: 'qmas_wait', stageName: '等候审批', order: 4,
          description: '等待入境处甄选结果（约6-12个月）',
          isMilestone: false,
          steps: [
            { stepId: 'qmas_wait_1', stepName: '关注甄选结果公布', order: 1, requiredMaterials: [] },
          ],
        },
        {
          stageId: 'qmas_approval', stageName: '获批', order: 5,
          description: '收到批准通知，办理签证',
          isMilestone: true, milestoneDocType: 'APPROVAL_LETTER',
          ocrValidationRule: { docTypeDetected: 'APPROVAL_LETTER' },
          steps: [
            { stepId: 'qmas_approval_1', stepName: '查收批准信', order: 1, requiredMaterials: [{ materialType: 'APPROVAL_LETTER', isOptional: false }] },
            { stepId: 'qmas_approval_2', stepName: '办理港澳通行证签注', order: 2, requiredMaterials: [{ materialType: 'HK_PERMIT', isOptional: false }] },
          ],
        },
        {
          stageId: 'qmas_arrival', stageName: '抵港定居', order: 6,
          description: '抵港并办理各项手续',
          isMilestone: false,
          steps: [
            { stepId: 'qmas_arrival_1', stepName: '预约办理香港身份证', order: 1, requiredMaterials: [{ materialType: 'HK_ID', isOptional: false }] },
            { stepId: 'qmas_arrival_2', stepName: '办理银行账户和MPF', order: 2, requiredMaterials: [] },
          ],
        },
      ],
    },
    {
      templateId: 'ttps-a', templateName: '高才通A类申请流程',
      applicablePaths: ['ttps-a'], totalStages: 4, version: '1.0.0', isActive: true,
      stages: [
        {
          stageId: 'ttpsa_eval', stageName: '资格评估', order: 1,
          description: '确认年收入≥HKD 250万',
          isMilestone: false,
          steps: [
            { stepId: 'ttpsa_eval_1', stepName: '核算年收入', order: 1, requiredMaterials: [{ materialType: 'TAX_RETURN', isOptional: false }, { materialType: 'BANK_STATEMENT', isOptional: false }] },
          ],
        },
        {
          stageId: 'ttpsa_prep', stageName: '材料准备', order: 2,
          description: '准备收入证明及相关材料',
          isMilestone: false,
          steps: [
            { stepId: 'ttpsa_prep_1', stepName: '准备收入证明文件', order: 1, requiredMaterials: [{ materialType: 'TAX_RETURN', isOptional: false }, { materialType: 'BANK_STATEMENT', isOptional: false }] },
            { stepId: 'ttpsa_prep_2', stepName: '准备身份证明', order: 2, requiredMaterials: [{ materialType: 'HK_PERMIT', isOptional: false }] },
          ],
        },
        {
          stageId: 'ttpsa_submit', stageName: '递交申请', order: 3,
          description: '在线递交高才通申请',
          isMilestone: true, milestoneDocType: 'APPLICATION_FORM',
          steps: [
            { stepId: 'ttpsa_submit_1', stepName: '在线递交', order: 1, requiredMaterials: [] },
          ],
        },
        {
          stageId: 'ttpsa_approval', stageName: '获批', order: 4,
          description: '等候审批并获取签证（约4周）',
          isMilestone: true, milestoneDocType: 'APPROVAL_LETTER',
          steps: [
            { stepId: 'ttpsa_approval_1', stepName: '获取批准信', order: 1, requiredMaterials: [{ materialType: 'APPROVAL_LETTER', isOptional: false }] },
          ],
        },
      ],
    },
    {
      templateId: 'iang', templateName: 'IANG签证申请流程',
      applicablePaths: ['iang'], totalStages: 3, version: '1.0.0', isActive: true,
      stages: [
        {
          stageId: 'iang_grad', stageName: '毕业确认', order: 1,
          description: '完成学业并获得毕业资格',
          isMilestone: false,
          steps: [
            { stepId: 'iang_grad_1', stepName: '获取毕业证书/成绩单', order: 1, requiredMaterials: [{ materialType: 'DEGREE', isOptional: false }] },
          ],
        },
        {
          stageId: 'iang_submit', stageName: '递交IANG申请', order: 2,
          description: '毕业后6个月内递交申请',
          isMilestone: true, milestoneDocType: 'APPLICATION_FORM',
          steps: [
            { stepId: 'iang_submit_1', stepName: '在线递交IANG申请', order: 1, requiredMaterials: [{ materialType: 'DEGREE', isOptional: false }, { materialType: 'HK_PERMIT', isOptional: false }] },
          ],
        },
        {
          stageId: 'iang_approval', stageName: '获批及领取签证', order: 3,
          description: '获批IANG签证（1年有效期）',
          isMilestone: true, milestoneDocType: 'APPROVAL_LETTER',
          steps: [
            { stepId: 'iang_approval_1', stepName: '领取IANG签证标签', order: 1, requiredMaterials: [{ materialType: 'APPROVAL_LETTER', isOptional: false }] },
            { stepId: 'iang_approval_2', stepName: '办理香港身份证', order: 2, requiredMaterials: [{ materialType: 'HK_ID', isOptional: false }] },
          ],
        },
      ],
    },
  ];
  await _upsert('process_templates', 'templateId', items, stats, 'process_templates');
}

// ========== 8. 会员计划 ==========

async function seedMembershipPlans(stats) {
  const items = [
    {
      planId: 'basic', planName: '基础会员', level: 'basic',
      priceMonthly: 3990, priceYearly: 39900,
      features: [
        '无限AI智能问答',
        '无限证件位 · 无限流程线',
        '个性化材料清单',
        '申请时间线与进度追踪',
        '政策变动实时提醒',
        '7年全路径规划'
      ],
      limits: { ai_questions_per_day: -1, assessments_per_month: -1 },
      highlighted: false, badge: '热门', isActive: true,
    },
    {
      planId: 'pro', planName: '专业会员', level: 'pro',
      priceMonthly: 29990, priceYearly: 299900,
      features: [
        '基础会员全部权益',
        'AI材料生成（6类官方文档）',
        '续签条件自助评估仪表盘',
        '文档合规审查与纠错',
        '入境面试模拟演练',
        '优先响应 · 专属客服通道'
      ],
      limits: { ai_questions_per_day: -1, assessments_per_month: -1 },
      highlighted: true, badge: '推荐', isActive: true,
    },
    {
      planId: 'premium', planName: '尊享会员', level: 'premium',
      priceMonthly: 69990, priceYearly: 699900,
      features: [
        '专业会员全部权益',
        'AI创业孵化 · 香港资源对接',
        '跨境电商合规与落地支持',
        '政府创业补贴政策全程指引',
        '实体证件收纳套装（免费赠送）',
        '加密云存储空间 50GB'
      ],
      limits: { ai_questions_per_day: -1, assessments_per_month: -1 },
      highlighted: false, badge: '尊享', isActive: true,
    },
  ];
  await _upsert('membership_plans', 'planId', items, stats, 'membership_plans');
}

// ========== 9. 商品 ==========

async function seedProducts(stats) {
  const items = [
    {
      productId: 'precheck_basic', name: '资格预检（基础版）', price: 0, category: 'service',
      description: '自动材料匹配 + 基础风险点', unit: '分', isActive: true,
    },
    {
      productId: 'precheck_pro', name: '资格预检（专业版）', price: 9900, category: 'service',
      description: '基础版 + 人工复核 + 详细报告', unit: '分', isActive: true,
    },
    {
      productId: 'consult_30min', name: '30分钟一对一咨询', price: 29900, category: 'consultation',
      description: '线上视频/语音咨询', unit: '分', isActive: true,
    },
  ];
  await _upsert('products', 'productId', items, stats, 'products');
}

// ========== 10. 模拟账号 ==========

async function seedSimulatedAccounts(stats) {
  const items = [
    {
      accountId: 'SIM-QMAS-01', accountName: '张先生（优才申请人 · 金融行业）',
      attributes: { path: 'qmas', phase: 'preparation', industry: '金融', experienceYears: 10, incomeRange: '100-250万', educationLevel: '硕士', languageSkill: '中英', familyStatus: '已婚有子女' },
      isActive: true,
    },
    {
      accountId: 'SIM-TTPSA-01', accountName: '李女士（高才通A类 · 科技行业）',
      attributes: { path: 'ttps-a', phase: 'preparation', industry: '科技', experienceYears: 8, incomeRange: '250万+', educationLevel: '本科', languageSkill: '中英', familyStatus: '已婚' },
      isActive: true,
    },
    {
      accountId: 'SIM-IANG-01', accountName: '王同学（IANG申请人 · 应届硕士）',
      attributes: { path: 'iang', phase: 'evaluation', industry: '教育', experienceYears: 1, incomeRange: '低于30万', educationLevel: '硕士', languageSkill: '中英粤', familyStatus: '单身' },
      isActive: true,
    },
    {
      accountId: 'SIM-RENEWAL-01', accountName: '陈先生（高才通续签 · 金融行业）',
      attributes: { path: 'ttps-a', phase: 'renewal', industry: '金融', experienceYears: 12, incomeRange: '100-250万', educationLevel: '硕士', languageSkill: '中英', familyStatus: '已婚有子女' },
      isActive: true,
    },
  ];
  await _upsert('simulated_accounts', 'accountId', items, stats, 'simulated_accounts');
}
