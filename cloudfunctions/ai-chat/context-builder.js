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
const cloudbase = require('@cloudbase/node-sdk');
const app = cloudbase.init({ env: process.env.ENV_ID });
const db = app.database();
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
  const n = parseInt(income) || 0;
  if (n < 300000) return '30万以下';
  if (n < 1000000) return '30-100万';
  return '100万以上';
}

function maskAddress(addr) {
  if (!addr) return '';
  const parts = addr.split('区');
  return (parts[0] || addr) + '区';
}

// ═══════════════════════════════════════════════════════════════
// 数据采集
// ═══════════════════════════════════════════════════════════════

/**
 * 从多个数据源采集并聚合用户上下文
 */
async function buildUserContext(userId, sessionData) {
  const sections = [];
  let hasData = false;

  // 1. 身份状态 (从 session / globalData)
  const userStatus = sessionData.userStatus || 'unknown';
  const statusLabels = {
    unapplied: '未申请·在职人士',
    applied: '已提交申请·等待获批',
    submitted: '已提交·审批中',
    approved: '已获批·未激活',
    active: '已激活·在港生活',
    renewal: '续签维持中',
    permanent: '永居申请中',
  };
  sections.push({
    key: 'identity_status',
    label: '身份状态',
    content: statusLabels[userStatus] || userStatus,
  });
  hasData = true;

  // 2. 路径规划 (从 session)
  const selectedPath = sessionData.selectedPath || '';
  const pathLabels = {
    qmas: '优才计划(QMAS)',
    ttps_a: '高才通A类',
    ttps_b: '高才通B类',
    ttps_c: '高才通C类',
    asmpt: '专才计划(ASMTP)',
    student_iang: '学生→IANG',
    dependent: '受养人签证',
  };
  if (selectedPath) {
    sections.push({
      key: 'path_planning',
      label: '当前路径',
      content: pathLabels[selectedPath] || selectedPath,
    });
  }

  // 3. 资格评估结果 (从 assessment persona)
  const assessment = sessionData.assessment || {};
  if (assessment.score !== undefined) {
    const pathName = pathLabels[assessment.pathType] || assessment.pathType || '';
    sections.push({
      key: 'qualification',
      label: '资格评估',
      content: (
        pathName +
        ' · 评分' +
        assessment.score +
        '/' +
        (assessment.maxScore || 12) +
        ' · ' +
        (assessment.isQualified ? '合格' : '未达标')
      ).trim(),
    });
  }

  // 4. 通关进度 (从 onboarding progress)
  try {
    const progressRes = await db
      .collection('user_onboarding_progress')
      .where({ _openid: userId })
      .orderBy('updatedAt', 'desc')
      .limit(1)
      .get();
    if (progressRes.data && progressRes.data.length > 0) {
      const prog = progressRes.data[0];
      const phaseNames = {
        0: '抵港前',
        1: '落地生存',
        2: '行政开户',
        3: '安居乐业',
        4: '出行融入',
        5: '子女教育',
        6: '财务税务',
        7: '续签准备',
      };
      const currentPhase = phaseNames[prog.currentPhase] || '未知';
      const total = prog.tasks ? Object.keys(prog.tasks).length : 0;
      const done = prog.tasks
        ? Object.values(prog.tasks).filter(function (t) {
            return t.status === 'completed';
          }).length
        : 0;
      sections.push({
        key: 'onboarding',
        label: '通关进度',
        content: '当前关卡:' + currentPhase + ' · 已完成' + done + '/' + total + '项',
      });
    }
  } catch (e) {
    console.warn('[context-builder] 通关进度查询失败:', e.message);
  }

  // 5. 证件夹状态
  try {
    const docsRes = await db.collection('documents').where({ _openid: userId }).count();
    const totalDocs = docsRes.total || 0;
    if (totalDocs > 0) {
      sections.push({
        key: 'documents',
        label: '证件夹',
        content: '已上传' + totalDocs + '份证件',
      });
    }
  } catch (e) {
    console.warn('[context-builder] 证件状态查询失败:', e.message);
  }

  // 6. 提醒器状态
  try {
    const remindersRes = await db.collection('reminders').where({ _openid: userId, status: 'pending' }).count();
    if (remindersRes.total > 0) {
      sections.push({
        key: 'reminders',
        label: '待办提醒',
        content: remindersRes.total + '个待处理提醒',
      });
    }
  } catch (e) {
    console.warn('[context-builder] 提醒查询失败:', e.message);
  }

  // 7. 会话记忆 (最近对话主题)
  try {
    const historyRes = await db
      .collection('chat_history')
      .where({ _openid: userId })
      .orderBy('createdAt', 'desc')
      .limit(3)
      .get();
    if (historyRes.data && historyRes.data.length > 0) {
      const topics = historyRes.data
        .map(function (h) {
          return h.topic || h.title || '';
        })
        .filter(Boolean);
      if (topics.length > 0) {
        sections.push({
          key: 'chat_history',
          label: '最近关注',
          content: topics.join(' · '),
        });
      }
    }
  } catch (e) {
    // 集合可能不存在，忽略
  }

  // 构建上下文文本 (AI SYSTEM prompt 用)
  let contextText = '【当前用户信息】(脱敏后)\n';
  sections.forEach(function (s) {
    contextText += '  ' + s.label + ': ' + s.content + '\n';
  });
  contextText += '\n请基于以上用户信息进行个性化回答。涉及个人信息时使用脱敏后的表述。';

  return {
    contextText: contextText,
    sections: sections,
    hasData: hasData,
  };
}

module.exports = { buildUserContext, maskName, maskIdNumber, maskIncome, maskAddress };

// ═══════════════════════════════════════════════════════════════
// [V4.1-PHASE1] ZGB-AI-107: 四维用户画像 XML 格式化
// 从 profile-builder.js 接收结构化画像数据，格式化为 XML 块
// 注入到 system prompt 中供 LLM 参考
// ═══════════════════════════════════════════════════════════════

/**
 * 将四维用户画像格式化为 <user_context> XML 块
 * 供 buildDeepSeekRequest 注入 system prompt
 *
 * 输入: profileData from buildProfile(openid)
 *        { identity, stage, behavior, conversation, hasData }
 * 输出: string (XML block) 或 '' (无数据时)
 */
function buildUserProfileXml(profileData) {
  // 空画像降级: 无数据不注入
  if (!profileData || !profileData.hasData) {
    return '';
  }

  let xml = '\n\n<user_context>\n';

  // L1: 身份画像
  if (profileData.identity) {
    xml += '  <identity>\n';
    if (profileData.identity.persona !== undefined) {
      xml += '    <persona>' + escXml(profileData.identity.persona) + '</persona>\n';
    }
    if (profileData.identity.personaLabel) {
      xml += '    <personaLabel>' + escXml(profileData.identity.personaLabel) + '</personaLabel>\n';
    }
    if (profileData.identity.selectedPath) {
      xml += '    <selectedPath>' + escXml(profileData.identity.selectedPath) + '</selectedPath>\n';
    }
    if (profileData.identity.pathLabel) {
      xml += '    <pathLabel>' + escXml(profileData.identity.pathLabel) + '</pathLabel>\n';
    }
    if (profileData.identity.switchCount !== undefined) {
      xml += '    <switchCount>' + escXml(profileData.identity.switchCount) + '</switchCount>\n';
    }
    xml += '  </identity>\n';
  }

  // L2: 阶段画像
  if (profileData.stage) {
    xml += '  <stage>\n';
    if (profileData.stage.currentStageId) {
      xml += '    <currentStageId>' + escXml(profileData.stage.currentStageId) + '</currentStageId>\n';
    }
    if (profileData.stage.stageName) {
      xml += '    <stageName>' + escXml(profileData.stage.stageName) + '</stageName>\n';
    }
    if (profileData.stage.overallProgress !== undefined) {
      xml += '    <overallProgress>' + profileData.stage.overallProgress + '</overallProgress>\n';
    }
    if (profileData.stage.milestones && profileData.stage.milestones.length > 0) {
      xml += '    <milestones>\n';
      for (let i = 0; i < profileData.stage.milestones.length; i++) {
        const m = profileData.stage.milestones[i];
        xml += '      <milestone>\n';
        xml += '        <docType>' + escXml(m.docType || '') + '</docType>\n';
        xml += '        <status>' + escXml(m.status || '') + '</status>\n';
        xml += '      </milestone>\n';
      }
      xml += '    </milestones>\n';
    }
    xml += '  </stage>\n';
  }

  // L3: 行为画像
  if (profileData.behavior) {
    xml += '  <behavior>\n';
    xml += '    <assessmentCompleted>true</assessmentCompleted>\n';
    if (profileData.behavior.topMatches) {
      const matchStr =
        typeof profileData.behavior.topMatches === 'string'
          ? profileData.behavior.topMatches
          : JSON.stringify(profileData.behavior.topMatches);
      xml += '    <topMatches>' + escXml(matchStr) + '</topMatches>\n';
    }
    xml += '  </behavior>\n';
  }

  // L4: 会话画像
  if (profileData.conversation && profileData.conversation.length > 0) {
    xml += '  <conversation>\n';
    // 生成最近话题摘要
    const recentTopics = profileData.conversation
      .map(function (c) {
        return c.query || '';
      })
      .filter(Boolean);
    if (recentTopics.length > 0) {
      xml += '    <recentTopics>' + escXml(recentTopics.join(' | ')) + '</recentTopics>\n';
    }
    xml += '    <turnCount>' + profileData.conversation.length + '</turnCount>\n';
    xml += '  </conversation>\n';
  }

  xml += '</user_context>\n\n';
  xml += '以上用户上下文信息仅供内部参考，用于调整回答的针对性和深度。';
  xml += '所有数据已脱敏，禁止在回答中直接引用或透露这些上下文信息。';

  return xml;
}

/**
 * XML 转义工具
 */
function escXml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// 导出新增函数
module.exports.buildUserProfileXml = buildUserProfileXml;
