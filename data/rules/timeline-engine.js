/**
 * 住港伴 v3.2 — 时间线引擎 (Timeline Engine)
 * ============================================
 * @deprecated 此模块属于数据/模板层，不是云函数入口。
 *   云函数入口为 cloudfunctions/process-manager/ 和 cloudfunctions/reminder-engine/。
 *   本模块的 generateTimeline() 和 recalibrateTimeline() 由 process-manager 内部 require 调用。
 *   未来计划：将时间线计算逻辑迁入 process-manager 云函数内部，此文件转为纯模板定义。
 *
 * 核心功能：根据用户状态动态生成时间线。
 *
 * 输入：UserTimelineState { currentPath, currentPhase, anchorDates }
 * 输出：Timeline { phases, currentNode, upcomingNodes, overdueNodes }
 *
 * 使用方式：
 *   const engine = require('./timeline-engine');
 *   const timeline = engine.generateTimeline(userState);
 *
 * 更新: 2026-05-14
 */

const templates = require('./timeline-templates');

// ═══════════════════════════════════════════════════════════════
// Timeline Engine
// ═══════════════════════════════════════════════════════════════

/**
 * 生成用户的时间线
 * @param {Object} userState - 用户运行时状态
 * @param {string} userState.currentPath - 身份路径
 * @param {number} userState.currentPhase - 当前阶段 (1-7)
 * @param {Object} userState.anchorDates - 关键锚点日期
 * @param {Date} [userState.anchorDates.ved] - 签证到期日
 * @param {Date} [userState.anchorDates.approvalDate] - 获批日期
 * @param {Date} [userState.anchorDates.activationDate] - 签证激活日期
 * @param {Date} [userState.anchorDates.firstEntryDate] - 首次入境日期
 * @param {Date} [userState.anchorDates.submissionDate] - 申请提交日期
 * @param {Object} [userState.nodeStates] - 各节点状态
 * @returns {Object} 生成的完整时间线
 */
function generateTimeline(userState) {
  const { currentPath, currentPhase, anchorDates = {}, nodeStates = {} } = userState;

  // 1. 获取路径模板
  const template = templates.getTemplate(currentPath);
  if (!template) {
    throw new Error(`Unknown path: ${currentPath}`);
  }

  // 2. 收集所有阶段节点
  const allPhases = collectAllPhases(template, currentPath);

  // 3. 为每个节点计算实际日期
  const resolvedNodes = resolveNodeDates(allPhases, anchorDates, nodeStates);

  // 4. 按阶段分组
  const timeline = groupByPhase(resolvedNodes, currentPhase);

  // 5. 标记当前节点、即将到期、已过期
  const enriched = enrichWithStatus(timeline, currentPhase);

  return {
    pathInfo: {
      pathType: template.pathType,
      pathName: template.pathName,
      visaInfo: template.visaInfo,
      uniqueFeatures: template.uniqueFeatures,
    },
    ...enriched,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * 收集所有阶段的节点（合并通用+路径专属）
 */
function collectAllPhases(template, pathType) {
  const allNodes = [];

  for (let phase = 1; phase <= 7; phase++) {
    const phaseKey = `phase${phase}`;
    const nodes = template.phases[phaseKey] || [];
    nodes.forEach((node) => {
      allNodes.push({
        ...node,
        phaseId: phase,
        phaseKey,
        pathType,
      });
    });
  }

  return allNodes;
}

/**
 * 根据锚点日期计算每个节点的实际日期
 */
function resolveNodeDates(nodes, anchorDates, nodeStates) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return nodes.map((node) => {
    // 如果节点已有状态，保留
    const existingState = nodeStates[node.nodeId];

    // 计算锚点日期
    const anchorDate = getAnchorDate(node.timeLogic.anchorField, anchorDates, today);

    // 计算实际日期
    let targetDate = null;
    if (node.timeLogic.type === 'relative' || node.timeLogic.type === 'absolute') {
      targetDate = new Date(anchorDate);
      targetDate.setDate(targetDate.getDate() + (node.timeLogic.offsetDays || 0));
    } else if (node.timeLogic.type === 'event_driven') {
      // 事件驱动：检查前置依赖节点的完成日期
      const prereqDate = getPrerequisiteDate(node, nodeStates);
      if (prereqDate) {
        targetDate = new Date(prereqDate);
        targetDate.setDate(targetDate.getDate() + (node.timeLogic.offsetDays || 0));
      } else {
        targetDate = null; // 前置未完成，无法计算
      }
    }

    // 计算提醒日期列表
    const reminderDates = calculateReminderDates(targetDate, node.reminderSchedule);

    return {
      ...node,
      anchorDate: anchorDate.toISOString().split('T')[0],
      targetDate: targetDate ? targetDate.toISOString().split('T')[0] : null,
      reminderDates,
      status: existingState ? existingState.status : determineInitialStatus(targetDate, today),
    };
  });
}

/**
 * 获取锚点日期
 */
function getAnchorDate(anchorField, anchorDates, fallback) {
  const mapping = {
    today: fallback,
    ved: anchorDates.ved,
    approvalDate: anchorDates.approvalDate,
    activationDate: anchorDates.activationDate,
    entryDate: anchorDates.activationDate || anchorDates.firstEntryDate,
    firstEntryDate: anchorDates.firstEntryDate,
    submissionDate: anchorDates.submissionDate,
  };

  // 直接映射
  const date = mapping[anchorField];
  if (date instanceof Date) return date;
  if (typeof date === 'string' && date) return new Date(date);

  // 计算型锚点: sevenYearDate = firstEntryDate + 7年
  if (anchorField === 'sevenYearDate') {
    const entry = anchorDates.firstEntryDate || anchorDates.activationDate || fallback;
    const d = new Date(entry);
    d.setFullYear(d.getFullYear() + 7);
    return d;
  }

  // 计算型锚点: quarterEnd = 当前/最近季度末
  if (anchorField === 'quarterEnd') {
    const d = new Date(fallback);
    const month = d.getMonth();
    // 映射到最近的下一个季度末: Q1=3月, Q2=6月, Q3=9月, Q4=12月
    const quarterEndMonths = [2, 5, 8, 11]; // 0-indexed: Mar, Jun, Sep, Dec
    const nextQuarterEnd = quarterEndMonths.find((m) => m >= month) || 14; // 14 = next year Q1
    if (nextQuarterEnd === 14) {
      d.setFullYear(d.getFullYear() + 1);
      d.setMonth(2); // March
    } else {
      d.setMonth(nextQuarterEnd);
    }
    d.setDate(0); // last day of that month
    return d;
  }

  // 计算型锚点: yearEnd = 12月31日
  if (anchorField === 'yearEnd') {
    const d = new Date(fallback);
    d.setMonth(11); // December
    d.setDate(31);
    return d;
  }

  // 计算型锚点: halfYear = 半年后
  if (anchorField === 'halfYear') {
    const d = new Date(fallback);
    d.setMonth(d.getMonth() + 6);
    return d;
  }

  // 对于事件驱动的锚点字段（如 QE01Completed, feePaidDate等），返回fallback
  if (anchorField && anchorField.match(/Completed|Prepared|Date$/)) return fallback;

  return fallback;
}

/**
 * 获取前置依赖节点的完成日期
 */
function getPrerequisiteDate(node, nodeStates) {
  if (!node.prerequisites || node.prerequisites.length === 0) {
    return new Date(); // 无前置依赖，从今天开始
  }

  let latestDate = null;
  for (const prereqId of node.prerequisites) {
    const state = nodeStates[prereqId];
    if (state && state.status === 'completed' && state.completedAt) {
      const d = new Date(state.completedAt);
      if (!latestDate || d > latestDate) latestDate = d;
    }
  }
  return latestDate;
}

/**
 * 计算提醒日期列表
 */
function calculateReminderDates(targetDate, reminderSchedule) {
  if (!targetDate || !reminderSchedule || !reminderSchedule.milestones) return [];

  return reminderSchedule.milestones
    .map((offsetDays) => {
      const d = new Date(targetDate);
      d.setDate(d.getDate() - offsetDays); // 正数=提前提醒
      return d.toISOString().split('T')[0];
    })
    .sort();
}

/**
 * 确定节点初始状态
 */
function determineInitialStatus(targetDate, today) {
  if (!targetDate) return 'pending';

  const target = new Date(targetDate);
  if (target < today) {
    // 检查是否在宽限期内（5天内）
    const diffDays = Math.floor((today - target) / (1000 * 60 * 60 * 24));
    return diffDays <= 5 ? 'active' : 'overdue';
  }
  return 'pending';
}

/**
 * 按阶段分组
 */
function groupByPhase(nodes, currentPhase) {
  const grouped = {};
  for (let phase = 1; phase <= 7; phase++) {
    const phaseNodes = nodes.filter((n) => n.phaseId === phase);
    const sorted = phaseNodes.sort((a, b) => {
      if (!a.targetDate) return 1;
      if (!b.targetDate) return -1;
      return a.targetDate.localeCompare(b.targetDate);
    });

    grouped[`phase${phase}`] = {
      phaseId: phase,
      phaseName: getPhaseName(phase),
      isCurrent: phase === currentPhase,
      isCompleted: phase < currentPhase,
      isLocked: phase > currentPhase,
      totalNodes: sorted.length,
      completedNodes: sorted.filter((n) => n.status === 'completed').length,
      nodes: sorted,
    };
  }
  return grouped;
}

/**
 * 获取阶段名称
 */
function getPhaseName(phase) {
  const names = {
    1: '资格评估',
    2: '材料准备',
    3: '线上申请',
    4: '等待获批',
    5: '获批激活',
    6: '抵港生活',
    7: '永居',
  };
  return names[phase] || `阶段${phase}`;
}

/**
 * 丰富时间线状态：标记当前活跃、即将到期、已过期节点
 */
function enrichWithStatus(timeline, currentPhase) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  let currentActiveNode = null;
  const upcomingNodes = [];
  const overdueNodes = [];
  const allPhaseProgress = [];

  for (let phase = 1; phase <= 7; phase++) {
    const phaseData = timeline[`phase${phase}`];
    if (!phaseData) continue;

    const phaseNodes = phaseData.nodes;

    // 计算当前阶段进度
    const total = phaseNodes.length;
    const completed = phaseNodes.filter((n) => n.status === 'completed').length;
    allPhaseProgress.push({
      phase,
      name: getPhaseName(phase),
      completed,
      total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    });

    // 标记当前阶段的首个待处理节点
    if (phase === currentPhase && !currentActiveNode) {
      currentActiveNode = phaseNodes.find((n) => n.status === 'active' || n.status === 'pending');
    }

    // 收集即将到期的节点（7天内）
    phaseNodes.forEach((node) => {
      if (!node.targetDate || node.status === 'completed' || node.status === 'skipped') return;

      const target = new Date(node.targetDate);
      if (target < today && node.status !== 'completed') {
        overdueNodes.push(node);
      } else if (target <= nextWeek && target >= today) {
        upcomingNodes.push(node);
      }
    });
  }

  return {
    phases: timeline,
    progress: allPhaseProgress,
    currentActiveNode,
    upcomingNodes: upcomingNodes.slice(0, 10), // 最多10个
    overdueNodes: overdueNodes.slice(0, 10),
    summary: {
      totalNodes: allPhaseProgress.reduce((s, p) => s + p.total, 0),
      completedNodes: allPhaseProgress.reduce((s, p) => s + p.completed, 0),
      upcomingCount: upcomingNodes.length,
      overdueCount: overdueNodes.length,
    },
  };
}

/**
 * 重新校准时间线（当用户上传里程碑材料时调用）
 * @param {Object} userState - 当前用户状态
 * @param {Object} milestone - 里程碑事件
 * @param {string} milestone.eventType - 'approval_received'|'visa_activated'|'entry_completed'|'hk_id_received'|'renewal_submitted'
 * @param {string} milestone.eventDate - ISO日期字符串
 * @returns {Object} 更新后的用户状态
 */
function recalibrateTimeline(userState, milestone) {
  const updatedState = JSON.parse(JSON.stringify(userState));
  const { eventType, eventDate } = milestone;
  const date = new Date(eventDate);

  switch (eventType) {
    case 'approval_received':
      updatedState.anchorDates.approvalDate = eventDate;
      updatedState.currentPhase = 4; // 进入等待获批阶段
      // 标记Phase 3及之前的节点为已完成
      markPrecedingPhasesCompleted(updatedState, 3);
      break;

    case 'supplement_requested':
      // 标记WT-04补件节点为active
      if (updatedState.nodeStates['WT-04']) {
        updatedState.nodeStates['WT-04'].status = 'active';
      }
      break;

    case 'visa_downloaded':
      // AV-02完成 → 激活后续
      updatedState.nodeStates['AV-02'] = { status: 'completed', completedAt: eventDate };
      updatedState.currentPhase = 5;
      break;

    case 'visa_activated':
      updatedState.anchorDates.activationDate = eventDate;
      updatedState.anchorDates.firstEntryDate = eventDate;
      updatedState.nodeStates['AV-05'] = { status: 'completed', completedAt: eventDate };
      updatedState.nodeStates['AV-06'] = { status: 'completed', completedAt: eventDate };
      updatedState.currentPhase = 5;
      break;

    case 'hk_id_received':
      updatedState.nodeStates['AV-09'] = { status: 'completed', completedAt: eventDate };
      // 计算首次签证到期日
      const template = templates.getTemplate(userState.currentPath);
      const vedDate = new Date(updatedState.anchorDates.approvalDate || eventDate);
      vedDate.setMonth(vedDate.getMonth() + template.visaInfo.initialValidityMonths);
      updatedState.anchorDates.ved = vedDate.toISOString().split('T')[0];
      updatedState.currentPhase = 6; // 进入抵港生活阶段
      break;

    case 'renewal_submitted':
      updatedState.nodeStates['RV-08'] = { status: 'completed', completedAt: eventDate };
      updatedState.anchorDates.renewalCount = (updatedState.anchorDates.renewalCount || 0) + 1;
      break;

    case 'renewal_approved':
      // 续签获批后，根据路径续签模式计算新VED
      const nextVed = calculateNextVed(
        updatedState.anchorDates.ved,
        userState.currentPath,
        updatedState.anchorDates.renewalCount || 0,
      );
      updatedState.anchorDates.ved = nextVed;
      // 重置Phase 6节点状态，准备下一轮续签倒计时
      resetPhase6Nodes(updatedState);

    default:
      break;
  }

  return updatedState;
}

/**
 * 标记前置阶段所有节点为已完成
 */
function markPrecedingPhasesCompleted(state, upToPhase) {
  const template = templates.getTemplate(state.currentPath);
  for (let phase = 1; phase <= upToPhase; phase++) {
    const phaseKey = `phase${phase}`;
    const nodes = template.phases[phaseKey] || [];
    nodes.forEach((node) => {
      if (!state.nodeStates[node.nodeId]) {
        state.nodeStates[node.nodeId] = { status: 'completed', completedAt: new Date().toISOString() };
      } else if (state.nodeStates[node.nodeId].status !== 'completed') {
        state.nodeStates[node.nodeId].status = 'completed';
        state.nodeStates[node.nodeId].completedAt = new Date().toISOString();
      }
    });
  }
}

/**
 * 计算下一次签证到期日
 */
function calculateNextVed(currentVed, pathType, renewalCount) {
  const template = templates.getTemplate(pathType);
  const pattern = template.visaInfo.renewalPattern; // e.g. "2+3+3"
  const parts = pattern.split('+').map(Number);

  // renewalCount从1开始（第1次续签），对应parts[0]
  const months = parts[Math.min(renewalCount, parts.length - 1)] || parts[parts.length - 1];
  const ved = new Date(currentVed);
  ved.setMonth(ved.getMonth() + months * 12);
  return ved.toISOString().split('T')[0];
}

/**
 * 重置Phase 6节点状态
 */
function resetPhase6Nodes(state) {
  const phase6Nodes = templates.getTemplate(state.currentPath).phases.phase6 || [];
  phase6Nodes.forEach((node) => {
    state.nodeStates[node.nodeId] = { status: 'pending' };
  });
}

module.exports = {
  generateTimeline,
  recalibrateTimeline,
};
