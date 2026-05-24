/**
 * 住港伴 v4.1 — 确定性规则引擎 (PRD v3.1)
 * V5校验对齐版：P0法律修正 + 五级置信度 + 12×4×N四维规则矩阵
 * JSON Schema驱动的规则匹配引擎，不做AI推理
 */
const { getAllDocuments } = require('./storage');
const { getConfidenceDisplay, getRuleAutoApply, P0_LEGAL_FIXES, P0_POLICY_FIXES } = require('../data/confidence');

const ruleSets = {
  reminders: [],
  materialChecks: [],
  processValidations: [],
  policyMappings: [],
  legalCitationRules: [],
  solutionMatchRules: [],
};
let loaded = false;

async function loadRules() {
  let allLoaded = true;

  // 逐文件隔离加载 — 单个文件加载失败不影响其他
  try {
    ruleSets.reminders = require('../data/rules/reminders.js');
  } catch (e) {
    console.warn('[规则引擎] reminders.js 加载失败，使用内置规则:', e.message);
    ruleSets.reminders = getBuiltinReminderRules();
    allLoaded = false;
  }

  try {
    ruleSets.materialChecks = require('../data/rules/material-checks.js');
  } catch (e) {
    console.warn('[规则引擎] material-checks.js 加载失败，使用内置规则:', e.message);
    ruleSets.materialChecks = getBuiltinCheckRules();
    allLoaded = false;
  }

  try {
    ruleSets.processValidations = require('../data/rules/process-validations.js');
    // 校验规则格式: 确保无不支持的字段
    if (!Array.isArray(ruleSets.processValidations)) throw new Error('process-validations 应为数组');
  } catch (e) {
    console.warn('[规则引擎] process-validations.js 加载失败，使用内置规则:', e.message);
    ruleSets.processValidations = getBuiltinValidationRules();
    allLoaded = false;
  }

  ruleSets.legalCitationRules = getBuiltinLegalRules();
  loaded = true;
  return true;
}

/**
 * 匹配提醒规则 (PRD v3.1: 新增置信度+决策节点+路径维度)
 */
function matchReminderRules(event) {
  if (!loaded) throw new Error('规则引擎未初始化');
  const matches = [];
  ruleSets.reminders.forEach((rule) => {
    if (rule.trigger.event === event.type) {
      // V5新增: 置信度过滤 - D级不自动生成
      if (rule.confidence === 'D') return;
      // V5新增: C级标记需要确认
      const autoApply = getRuleAutoApply(rule.confidence || 'B');
      const reminders = expandReminders(rule, event.data);
      reminders.forEach((r) => {
        r.autoApply = autoApply;
        r.confidence = rule.confidence || 'B';
        r.confidenceLabel = getConfidenceDisplay(rule.confidence || 'B');
        r.path = rule.path || null;
        r.phase = rule.phase || null;
        r.decisionPoint = rule.milestone_tag || null;
        r.legalBasis = rule.legal_basis || null;
      });
      matches.push(...reminders);
    }
  });
  return matches;
}

function expandReminders(rule, eventData) {
  const reminders = [];
  rule.reminders.forEach((r) => {
    const triggerDate = eventData[rule.trigger.date_field];
    if (!triggerDate) return;
    const baseDate = parseDate(triggerDate);
    if (!baseDate) return;
    const deadline = new Date(baseDate.getTime() + r.offset_days * 86400000);
    const alerts = r.alerts.map((days) => {
      const alertDate = new Date(deadline.getTime() - days * 86400000);
      return { date: alertDate.toISOString().slice(0, 10), daysBefore: days };
    });
    reminders.push({
      id: `R_${rule.rule_id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      ruleId: rule.rule_id,
      label: r.label,
      eventDate: triggerDate,
      deadline: deadline.toISOString().slice(0, 10),
      alerts,
      dependsOn: r.depends_on || null,
      status: 'active',
      createdAt: new Date().toISOString(),
    });
  });
  return reminders;
}

function runMaterialCheck(processType, userDocIds) {
  const rules = ruleSets.materialChecks.filter((r) => r.processType === processType);
  if (rules.length === 0) {
    return { total: 0, ready: 0, missing: 0, items: [], score: 0 };
  }
  const userDocs = getAllDocuments().filter((d) => userDocIds.includes(d.id));
  const items = rules.map((rule) => {
    const matched = userDocs.find((d) => d.category === rule.requiredCategory);
    let status = 'missing';
    let detail = '';
    if (matched) {
      status = 'ready';
      if (rule.maxAgeDays && matched.createdAt) {
        const age = (Date.now() - new Date(matched.createdAt).getTime()) / 86400000;
        if (age > rule.maxAgeDays) {
          status = 'expired';
          detail = `材料已超过 ${rule.maxAgeDays} 天有效期`;
        }
      }
      if (rule.requireOCR && !matched.ocrVerified) {
        status = 'pending';
        detail = '待OCR验证';
      }
    }
    return {
      id: rule.id,
      name: rule.name,
      requiredCategory: rule.requiredCategory,
      status,
      matchedDocId: matched ? matched.id : null,
      detail,
    };
  });
  const ready = items.filter((i) => i.status === 'ready').length;
  return {
    total: items.length,
    ready,
    missing: items.filter((i) => i.status === 'missing').length,
    pending: items.filter((i) => i.status === 'pending').length,
    expired: items.filter((i) => i.status === 'expired').length,
    items,
    score: Math.round((ready / items.length) * 100),
  };
}

function runConsistencyCheck(docIds) {
  const docs = getAllDocuments().filter((d) => docIds.includes(d.id));
  const issues = [];
  const fieldMappings = [
    { fields: ['name'], label: '姓名' },
    { fields: ['idNumber', 'hkIdNumber'], label: '证件号' },
    { fields: ['company', 'employer'], label: '公司名' },
    { fields: ['birthDate'], label: '出生日期' },
  ];
  for (let i = 0; i < docs.length; i++) {
    for (let j = i + 1; j < docs.length; j++) {
      fieldMappings.forEach((mapping) => {
        mapping.fields.forEach((f1) => {
          mapping.fields.forEach((f2) => {
            const v1 = docs[i].ocrData ? docs[i].ocrData[f1] : null;
            const v2 = docs[j].ocrData ? docs[j].ocrData[f2] : null;
            if (v1 && v2 && v1 !== v2) {
              issues.push({
                severity: 'high',
                type: 'inconsistency',
                field: mapping.label,
                doc1: { id: docs[i].id, name: docs[i].name, value: v1 },
                doc2: { id: docs[j].id, name: docs[j].name, value: v2 },
                suggestion: `请确认两份文档中的${mapping.label}是否应保持一致`,
              });
            }
          });
        });
      });
    }
  }
  return issues;
}

function validateMilestone(targetStage, ocrResult) {
  const validations = ruleSets.processValidations.filter((v) => v.stage === targetStage);
  if (validations.length === 0) return { valid: true, reason: '无验证规则', confidence: 'B' };
  for (const rule of validations) {
    const value = ocrResult[rule.field];
    if (rule.required && !value) {
      return { valid: false, reason: `缺少必填字段: ${rule.field}`, confidence: rule.confidence || 'A' };
    }
    if (rule.pattern && value) {
      const re = new RegExp(rule.pattern);
      if (!re.test(value)) {
        return {
          valid: false,
          reason: `字段 ${rule.field} 格式不符合预期: ${value}`,
          confidence: rule.confidence || 'A',
        };
      }
    }
  }
  return { valid: true, reason: '通过验证', confidence: 'A' };
}

// ============ V5新增: 法律条文引用校验 (PRD v3.1 EF-V5-01) ============

function checkLegalCitation(text) {
  const issues = [];
  // 检测过时的条文引用
  Object.entries(P0_LEGAL_FIXES).forEach(([wrongRef, fix]) => {
    const pattern = new RegExp(wrongRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    if (pattern.test(text)) {
      issues.push({
        severity: 'P0',
        wrongCitation: fix.wrong,
        correctCitation: fix.correct,
        reason: fix.reason,
        confidence: fix.confidence,
      });
    }
  });
  return issues;
}

// ============ V5新增: 绝对化语言检测 (PRD v3.1 EF-V5-01) ============

function checkAbsoluteLanguage(text) {
  const absolutes = [
    { pattern: /100%\s*(计入|保证|可以|获得|成功)/g, label: '过度确信', suggestion: '入境处有酌情权，非法律保证' },
    { pattern: /绝对\s*(可以|没问题|保证|批准)/g, label: '绝对化表述', suggestion: '避免使用绝对化语言' },
    { pattern: /保证\s*(获批|通过|成功)/g, label: '保证性表述', suggestion: '入境审批存在不确定性' },
  ];
  const issues = [];
  absolutes.forEach(({ pattern, label, suggestion }) => {
    const matches = text.match(pattern);
    if (matches) {
      issues.push({ severity: 'P1', type: 'absolute_language', label, matches: [...new Set(matches)], suggestion });
    }
  });
  return issues;
}

// ============ V5新增: 政策版本检查 (PRD v3.1 EF-V5-02) ============

function checkPolicyVersion(text) {
  const deprecatedPolicies = [
    {
      pattern: /20(?:19|20|21|22)年.*学生.*工作.*(?:限制|小时|每周)/g,
      issue: '学生工作限制政策已于2023/2024年更新，旧政策已废止 [A]',
    },
    { pattern: /学生签证.*不.*带.*受养人/g, issue: '学生签证可以带受养人(受养人不得工作)，旧说法已修正 [A]' },
    { pattern: /Cap\.115\s+s\.2A/g, issue: 'Cap.115 s.2A定义居留权而非"视为逗留"，正确为s.11(8) [A]' },
    { pattern: /Cap\.115\s+s\.42(?!\s*被)/g, issue: '虚假陈述条文为s.38A，非s.42 [A]' },
  ];
  const issues = [];
  deprecatedPolicies.forEach(({ pattern, issue }) => {
    if (pattern.test(text)) {
      issues.push({ severity: 'P0', type: 'deprecated_policy', issue });
    }
  });
  return issues;
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  const m = dateStr.match(/(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})[日]?/);
  if (m) return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
  return null;
}

// ============ V5内置提醒规则 (12路径×4阶段×N节点) ============
function getBuiltinReminderRules() {
  return [
    // 通用: 获批后
    {
      rule_id: 'R_APPROVAL_001',
      path: 'all',
      phase: 'phase2_onboarding',
      milestone_tag: 'dp1_initial_path',
      trigger: { event: 'approval_received', date_field: 'approvalDate' },
      confidence: 'A',
      legal_basis: 'Cap.115 签证条款',
      reminders: [
        { label: '提交赴港同意书', offset_days: 90, alerts: [60, 30, 14, 7, 3] },
        { label: '领取签证/进入许可', offset_days: 90, alerts: [14, 7, 3] },
        { label: '赴港激活签证(3个月内)', offset_days: 90, alerts: [30, 14, 7, 3, 1] },
        { label: '申办香港身份证(30天内/Cap.177)', offset_days: 120, alerts: [7, 3, 1] },
      ],
    },
    // 学生签证激活后
    {
      rule_id: 'R_VISA_ACTIVATE_001',
      path: 'student_iang',
      phase: 'phase2_onboarding',
      milestone_tag: 'dp2_student_to_work',
      trigger: { event: 'visa_activated', date_field: 'activationDate' },
      confidence: 'A',
      legal_basis: 'Cap.177 香港身份证',
      reminders: [{ label: '申办香港身份证(30天内)', offset_days: 30, alerts: [21, 14, 7, 3, 1] }],
    },
    // 学生签证到期前: 准备IANG
    {
      rule_id: 'R_STUDENT_IANG_001',
      path: 'student_iang',
      phase: 'phase3_maintenance',
      milestone_tag: 'dp2_student_to_work',
      trigger: { event: 'visa_expiring', date_field: 'expiryDate' },
      confidence: 'A',
      legal_basis: 'IANG政策',
      reminders: [
        { label: 'IANG准备启动(毕业前3月)', offset_days: -90, alerts: [180, 120, 90, 60, 30] },
        { label: '凭Completion Letter申请IANG', offset_days: 0, alerts: [30, 14, 7] },
      ],
    },
    // 签证到期前: 续签通用
    {
      rule_id: 'R_RENEWAL_001',
      path: 'all',
      phase: 'phase3_maintenance',
      milestone_tag: 'dp3_renewal_strategy',
      trigger: { event: 'visa_expiring', date_field: 'expiryDate' },
      confidence: 'A',
      legal_basis: 'Cap.115 签证续签',
      reminders: [
        { label: '续签材料准备启动', offset_days: -90, alerts: [180, 90, 60, 30] },
        { label: '递交续签申请', offset_days: 0, alerts: [90, 60, 30, 14, 7] },
      ],
    },
    // 永居冲刺
    {
      rule_id: 'R_PR_001',
      path: 'all',
      phase: 'phase4_pr_sprint',
      milestone_tag: 'dp5_pr_sprint',
      trigger: { event: 'pr_eligible', date_field: 'sevenYearDate' },
      confidence: 'A',
      legal_basis: 'Cap.115 永居申请',
      reminders: [
        { label: '永居申请准备(提前6月)', offset_days: -180, alerts: [180, 90, 60, 30] },
        { label: '整理7年在港记录', offset_days: -90, alerts: [90, 60, 30] },
        { label: '永居材料准备完成', offset_days: 0, alerts: [90, 60, 30, 14, 7] },
      ],
    },
    // IANG签证到期(24月后)决策节点提醒
    {
      rule_id: 'R_IANG_RENEWAL_001',
      path: 'student_iang',
      phase: 'phase3_maintenance',
      milestone_tag: 'dp3_renewal_strategy',
      trigger: { event: 'iang_24mo_expiring', date_field: 'expiryDate' },
      confidence: 'B',
      legal_basis: 'IANG续签政策',
      reminders: [
        { label: '决策节点③续签策略: 雇主/自雇/创业', offset_days: -90, alerts: [90, 60, 30] },
        { label: '确认MPF+税单记录完整', offset_days: -60, alerts: [60, 30, 14] },
      ],
    },
    // 优才12准则自评
    {
      rule_id: 'R_QMAS_ASSESS_001',
      path: 'qmas',
      phase: 'phase1_evaluation',
      milestone_tag: 'dp1_initial_path',
      trigger: { event: 'qmas_assessment_started', date_field: 'startDate' },
      confidence: 'C',
      legal_basis: '优才新制12项准则',
      reminders: [
        { label: '完成12项准则逐项评估', offset_days: 14, alerts: [7, 3, 1] },
        { label: '确认满足≥6项准则', offset_days: 14, alerts: [3, 1] },
      ],
    },
    // 高才B续签(24月后)
    {
      rule_id: 'R_TTPS_B_RENEWAL_001',
      path: 'ttps_b',
      phase: 'phase3_maintenance',
      milestone_tag: 'dp3_renewal_strategy',
      trigger: { event: 'ttps_24mo_expiring', date_field: 'expiryDate' },
      confidence: 'B',
      legal_basis: '高才通续签指引',
      reminders: [{ label: '确认在港就业/创业证据完整', offset_days: -90, alerts: [90, 60, 30, 14] }],
    },
  ];
}

function getBuiltinCheckRules() {
  return [
    { id: 'CHK_QMAS_01', processType: 'qmas', name: '赴港计划书', requiredCategory: 'employment', maxAgeDays: 180 },
    { id: 'CHK_QMAS_02', processType: 'qmas', name: '学位证书', requiredCategory: 'education' },
    { id: 'CHK_QMAS_03', processType: 'qmas', name: '在职证明', requiredCategory: 'employment', maxAgeDays: 90 },
    { id: 'CHK_QMAS_04', processType: 'qmas', name: '推荐信', requiredCategory: 'employment', maxAgeDays: 90 },
    { id: 'CHK_QMAS_05', processType: 'qmas', name: '资产证明', requiredCategory: 'assets', maxAgeDays: 90 },
    { id: 'CHK_QMAS_06', processType: 'qmas', name: '身份证', requiredCategory: 'identities' },
    { id: 'CHK_QMAS_07', processType: 'qmas', name: '港澳通行证', requiredCategory: 'identities' },
    { id: 'CHK_STUDENT_01', processType: 'student_iang', name: '录取通知书', requiredCategory: 'education' },
    { id: 'CHK_STUDENT_02', processType: 'student_iang', name: '学位证书(毕业时)', requiredCategory: 'education' },
    {
      id: 'CHK_STUDENT_03',
      processType: 'student_iang',
      name: 'Completion Letter(IANG用)',
      requiredCategory: 'education',
    },
    { id: 'CHK_TTPS_A01', processType: 'ttps_a', name: '纳税证明', requiredCategory: 'financial', maxAgeDays: 365 },
    { id: 'CHK_TTPS_A02', processType: 'ttps_a', name: '审计报告', requiredCategory: 'financial', maxAgeDays: 365 },
    { id: 'CHK_TTPS_A03', processType: 'ttps_a', name: '银行流水', requiredCategory: 'financial', maxAgeDays: 90 },
  ];
}

function getBuiltinValidationRules() {
  return [
    {
      stage: 'hk_id_application',
      field: 'hkIdNumber',
      required: true,
      pattern: '[A-Z]{1,2}\\d{6,7}\\([0-9A]\\)',
      confidence: 'A',
    },
  ];
}

function getBuiltinLegalRules() {
  return [
    {
      id: 'LEGAL_CHECK_001',
      type: 'cap115_2A_to_11_8',
      pattern: /s\.?2A/gi,
      severity: 'P0',
      fix: 'Cap.115 s.11(8) (入境处处长酌情权)',
      reason: 's.2A定义居留权，非"视为合法逗留"机制',
    },
    {
      id: 'LEGAL_CHECK_002',
      type: 'cap115_42_to_38A',
      pattern: /s\.?42(?!\s*被)/gi,
      severity: 'P0',
      fix: 'Cap.115 s.38A (虚假陈述)',
      reason: '虚假陈述条文为s.38A',
    },
  ];
}

module.exports = {
  loadRules,
  matchReminderRules,
  runMaterialCheck,
  runConsistencyCheck,
  validateMilestone,
  parseDate,
  expandReminders,
  // V5新增
  checkLegalCitation,
  checkAbsoluteLanguage,
  checkPolicyVersion,
  P0_LEGAL_FIXES,
  P0_POLICY_FIXES,
};
