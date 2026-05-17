/**
 * ai-chat 用户记忆上下文构建器
 *
 * 将用户的结构化数据(身份状态/路径规划/资格评估/通关进度/证件状态)
 * 脱敏后组合为 AI 对话的 SYSTEM 级上下文，注入到每次对话中。
 *
 * 输入: { userId, sessionId }
 * 输出: { contextText, contextSections, hasData }
 *
 * 脱敏规则:
 *   - 姓名 → 仅保留姓氏
 *   - 证件号码 → 仅保留后4位
 *   - 收入 → 区间化(300k以下/300k-1M/1M+)
 *   - 地址 → 仅保留区域
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// ═══════════════════════════════════════════════════════════════
// 脱敏工具
// ═══════════════════════════════════════════════════════════════
function maskName(name) {
  if (!name || name.length < 2) return '用户';
  return name.charAt(0) + '**';
}

function maskIdNumber(num) {
  if (!num || num.length < 4) return '***';
  return '***' + num.slice(-4);
}

function maskIncome(income) {
  var n = parseInt(income) || 0;
  if (n < 300000) return '30万以下';
  if (n < 1000000) return '30-100万';
  return '100万以上';
}

function maskAddress(addr) {
  if (!addr) return '';
  var parts = addr.split('区');
  return (parts[0] || addr) + '区';
}

// ═══════════════════════════════════════════════════════════════
// 数据采集
// ═══════════════════════════════════════════════════════════════

/**
 * 从多个数据源采集并聚合用户上下文
 */
async function buildUserContext(userId, sessionData) {
  var sections = [];
  var hasData = false;

  // 1. 身份状态 (从 session / globalData)
  var userStatus = sessionData.userStatus || 'unknown';
  var statusLabels = {
    unapplied: '未申请·在职人士',
    applied: '已提交申请·等待获批',
    submitted: '已提交·审批中',
    approved: '已获批·未激活',
    active: '已激活·在港生活',
    renewal: '续签维持中',
    permanent: '永居申请中'
  };
  sections.push({
    key: 'identity_status',
    label: '身份状态',
    content: statusLabels[userStatus] || userStatus
  });
  hasData = true;

  // 2. 路径规划 (从 session)
  var selectedPath = sessionData.selectedPath || '';
  var pathLabels = {
    qmas: '优才计划(QMAS)',
    ttps_a: '高才通A类',
    ttps_b: '高才通B类',
    ttps_c: '高才通C类',
    asmpt: '专才计划(ASMTP)',
    student_iang: '学生→IANG',
    dependent: '受养人签证'
  };
  if (selectedPath) {
    sections.push({
      key: 'path_planning',
      label: '当前路径',
      content: pathLabels[selectedPath] || selectedPath
    });
  }

  // 3. 资格评估结果 (从 assessment persona)
  var assessment = sessionData.assessment || {};
  if (assessment.score !== undefined) {
    var pathName = pathLabels[assessment.pathType] || assessment.pathType || '';
    sections.push({
      key: 'qualification',
      label: '资格评估',
      content: (pathName + ' · 评分' + assessment.score + '/' + (assessment.maxScore || 12) + ' · ' + (assessment.isQualified ? '合格' : '未达标')).trim()
    });
  }

  // 4. 通关进度 (从 onboarding progress)
  try {
    var progressRes = await db.collection('user_onboarding_progress')
      .where({ _openid: userId })
      .orderBy('updatedAt', 'desc')
      .limit(1)
      .get();
    if (progressRes.data && progressRes.data.length > 0) {
      var prog = progressRes.data[0];
      var phaseNames = { 0:'抵港前',1:'落地生存',2:'行政开户',3:'安居乐业',4:'出行融入',5:'子女教育',6:'财务税务',7:'续签准备' };
      var currentPhase = phaseNames[prog.currentPhase] || '未知';
      var total = prog.tasks ? Object.keys(prog.tasks).length : 0;
      var done = prog.tasks ? Object.values(prog.tasks).filter(function(t) { return t.status === 'completed'; }).length : 0;
      sections.push({
        key: 'onboarding',
        label: '通关进度',
        content: '当前关卡:' + currentPhase + ' · 已完成' + done + '/' + total + '项'
      });
    }
  } catch (e) {
    console.warn('[context-builder] 通关进度查询失败:', e.message);
  }

  // 5. 证件夹状态
  try {
    var docsRes = await db.collection('documents')
      .where({ _openid: userId })
      .count();
    var totalDocs = docsRes.total || 0;
    if (totalDocs > 0) {
      sections.push({
        key: 'documents',
        label: '证件夹',
        content: '已上传' + totalDocs + '份证件'
      });
    }
  } catch (e) {
    console.warn('[context-builder] 证件状态查询失败:', e.message);
  }

  // 6. 提醒器状态
  try {
    var remindersRes = await db.collection('reminders')
      .where({ _openid: userId, status: 'pending' })
      .count();
    if (remindersRes.total > 0) {
      sections.push({
        key: 'reminders',
        label: '待办提醒',
        content: remindersRes.total + '个待处理提醒'
      });
    }
  } catch (e) {
    console.warn('[context-builder] 提醒查询失败:', e.message);
  }

  // 7. 会话记忆 (最近对话主题)
  try {
    var historyRes = await db.collection('chat_history')
      .where({ _openid: userId })
      .orderBy('createdAt', 'desc')
      .limit(3)
      .get();
    if (historyRes.data && historyRes.data.length > 0) {
      var topics = historyRes.data.map(function(h) {
        return h.topic || h.title || '';
      }).filter(Boolean);
      if (topics.length > 0) {
        sections.push({
          key: 'chat_history',
          label: '最近关注',
          content: topics.join(' · ')
        });
      }
    }
  } catch (e) {
    // 集合可能不存在，忽略
  }

  // 构建上下文文本 (AI SYSTEM prompt 用)
  var contextText = '【当前用户信息】(脱敏后)\n';
  sections.forEach(function(s) {
    contextText += '  ' + s.label + ': ' + s.content + '\n';
  });
  contextText += '\n请基于以上用户信息进行个性化回答。涉及个人信息时使用脱敏后的表述。';

  return {
    contextText: contextText,
    sections: sections,
    hasData: hasData
  };
}

module.exports = { buildUserContext, maskName, maskIdNumber, maskIncome, maskAddress };
