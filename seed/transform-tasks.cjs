/**
 * Transform onboarding-tasks.js → JSONL for CloudBase NoSQL import
 *
 * Usage: node transform-tasks.cjs
 */
const fs = require('fs');
const path = require('path');

const SOURCE = path.resolve(__dirname, '../data/onboarding-tasks.js');
const OUTPUT = path.resolve(__dirname, 'life_guide_tasks.jsonl');

const tasks = require(SOURCE);

// ─── scene_tags lookup ──────────────────────────────────────────────────────
const SCENE_TAGS = {
  // 关卡0 (抵港前)
  'onboard-001': ['证件'],
  'onboard-002': ['证件'],
  'onboard-003': ['证件'],
  'onboard-004': ['证件'],
  'onboard-005': ['证件'],
  // 关卡1 (落地生存)
  'onboard-101': ['交通','支付'],
  'onboard-102': ['通讯'],
  'onboard-103': ['支付'],
  'onboard-104': ['证件'],
  'onboard-105': ['交通'],
  // 关卡2 (行政开户)
  'onboard-201': ['银行','证件'],
  'onboard-202': ['住房'],
  'onboard-203': ['医疗'],
  'onboard-204': ['运动'],
  'onboard-205': ['证件'],
  'onboard-206': ['住房'],
  'onboard-207': ['社区'],
  // 关卡3 (安居乐业)
  'onboard-300': ['住房'],
  'onboard-301': ['住房'],
  'onboard-302': ['住房'],
  'onboard-303': ['保险','住房'],
  'onboard-304': ['通讯'],
  'onboard-305': ['搬家'],
  'onboard-306': ['社区'],
  'onboard-307': ['搬家'],
  'onboard-308': ['住房'],
  'onboard-309': ['住房'],
  'onboard-310': ['住房'],
  'onboard-311': ['住房'],
  'onboard-312': ['住房'],
  // 关卡4 (出行融入)
  'onboard-401': ['交通','证件'],
  'onboard-402': ['交通'],
  'onboard-403': ['运动'],
  'onboard-404': ['医疗'],
  'onboard-405': ['社区'],
  'onboard-406': ['社区'],
  'onboard-407': ['税务'],
  'onboard-408': ['社区'],
  // 关卡5 (子女教育)
  'onboard-501a': ['教育'],
  'onboard-502a': ['教育'],
  'onboard-503a': ['教育'],
  'onboard-504a': ['教育'],
  'onboard-505a': ['教育'],
  'onboard-501b': ['教育'],
  'onboard-502b': ['教育'],
  'onboard-503b': ['教育'],
  'onboard-504b': ['教育'],
  'onboard-505b': ['教育'],
  'onboard-506b': ['教育'],
  'onboard-507b': ['教育'],
  // 关卡6 (财务税务)
  'onboard-601': ['税务'],
  'onboard-602': ['税务'],
  'onboard-603': ['银行'],
  'onboard-604': ['住房'],
  'onboard-605': ['银行'],
  'onboard-606': ['税务'],
  // 关卡7 (续签准备)
  'onboard-701': ['证件'],
  'onboard-702': ['证件'],
  'onboard-703': ['住房'],
  'onboard-704': ['住房'],
  'onboard-705': ['证件'],
};

// ─── ai_context quick_answer lookup ─────────────────────────────────────────
function makeQuickAnswer(task) {
  const step1 = task.steps && task.steps[0];
  if (!step1 || !step1.content) {
    return (task.title || '').slice(0, 50);
  }
  // Extract most actionable phrase from step 1 content (≤50 chars)
  const firstSent = step1.content.split(/[。.]/)[0].trim();
  // Remove leading label like "核对个人信息："
  const cleaned = firstSent.replace(/^[^：:]*[：:]\s*/, '');
  return cleaned.length <= 50 ? cleaned : cleaned.slice(0, 50);
}

function makeSearchKeywords(task) {
  const combined = `${task.title} ${task.subtitle || ''}`;
  const skip = new Set(['的', '了', '在', '是', '不', '一', '就', '有', '和', '与', '都', '要', '能', '可以', '会', '也', '到', '这', '那', '被', '让', '把', '从', '对', '比', '最', '更', '很']);
  const words = [];
  // Split by common delimiters
  const parts = combined.split(/[———\-—,，。\s\/]+/);
  for (const p of parts) {
    const trimmed = p.trim();
    if (trimmed.length >= 2 && !skip.has(trimmed) && !/^[a-zA-Z0-9+@.]+$/.test(trimmed)) {
      words.push(trimmed);
    }
  }
  if (words.length < 2) {
    const titleWords = task.title.replace(/[——\-—,，。\s\/]/g, ' ').split(' ').filter(w => w.length >= 2 && !skip.has(w));
    return titleWords.slice(0, 4);
  }
  return [...new Set(words)].slice(0, 4);
}

// ─── reminder_config lookup ─────────────────────────────────────────────────
function makeReminderConfig(taskId) {
  if (taskId === 'onboard-301') {
    return { trigger_on_complete: true, auto_reminder_days: 365, reminder_text: null };
  }
  if (taskId === 'onboard-601') {
    return { trigger_on_complete: false, auto_reminder_days: 365, reminder_text: null };
  }
  return { trigger_on_complete: false, auto_reminder_days: null, reminder_text: null };
}

// ─── Transform renewal_evidence ─────────────────────────────────────────────
function transformRenewalEvidence(re) {
  if (!re) return null;
  const out = {};
  if (re.produces !== undefined) out.produces = re.produces;
  if (re.docType !== undefined) out.doc_type = re.docType;
  if (re.docCategory !== undefined) out.doc_category = re.docCategory;
  if (re.collectMethod !== undefined) out.collect_method = re.collectMethod;
  if (re.isRequiredForRenewal !== undefined) out.is_required = re.isRequiredForRenewal;
  if (re.expiryCheck !== undefined) out.expiry_check = re.expiryCheck;
  if (re.renewalTip !== undefined) out.renewal_tip = re.renewalTip;
  return out;
}

// ─── Transform applicable_to ────────────────────────────────────────────────
function transformApplicableTo(at) {
  if (!at) return null;
  return {
    visa_types: at.visaTypes !== undefined ? at.visaTypes : 'all',
    family_status: at.familyStatus !== undefined ? at.familyStatus : 'all',
    arrival_scenario: at.arrivalScenario !== undefined ? at.arrivalScenario : [],
    skip_if_existing: at.skipIfExisting !== undefined ? at.skipIfExisting : [],
  };
}

// ─── Main transform ─────────────────────────────────────────────────────────
const lines = [];

for (const t of tasks) {
  const id = t.id;
  const sceneTags = SCENE_TAGS[id] || ['证件'];
  const reminderConfig = makeReminderConfig(id);
  const quickAnswer = makeQuickAnswer(t);
  const searchKeywords = makeSearchKeywords(t);
  const applicableTo = transformApplicableTo(t.applicableTo);

  const officialLinks = (t.officialLinks || []).map(link => ({
    label: link.label,
    url: link.url,
  }));

  const requiredItems = t.requiredItems || [];

  const steps = (t.steps || []).map(s => ({
    seq: s.seq,
    title: s.title,
    content: s.content,
    type: s.type,
  }));

  const renewalEvidence = transformRenewalEvidence(t.renewalEvidence);

  const obj = {
    _id: id,
    id: id,
    phase: t.phase,
    sequence: t.sequence,
    category: t.category,
    title: t.title,
    subtitle: t.subtitle,
    time_estimate: t.timeEstimate,
    urgency: t.urgency,
    icon: t.icon,
    applicable_to: applicableTo,
    steps: steps,
    required_items: requiredItems,
    official_links: officialLinks,
    tips: t.tips || [],
    pitfalls: t.pitfalls || [],
    renewal_evidence: renewalEvidence,
    scene_tags: sceneTags,
    reminder_config: reminderConfig,
    ai_context: {
      search_keywords: searchKeywords,
      k0_domain: true,
      quick_answer: quickAnswer,
    },
    status: 'active',
  };

  lines.push(JSON.stringify(obj));
}

fs.writeFileSync(OUTPUT, lines.join('\n') + '\n', 'utf-8');
console.log(`Written ${lines.length} lines to ${OUTPUT}`);
