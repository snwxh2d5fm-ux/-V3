/**
 * 港漂通关手册 — 路径装配引擎
 *
 * 从 onboarding-tasks.js 模板库中按用户画像筛选、排序任务，
 * 返回关卡分组 + 任务列表 + 汇总摘要。
 *
 * 使用方式（原生微信小程序 CommonJS）：
 *   const { assemblePath, getPhaseName } = require('../../data/onboarding-paths');
 *   const result = assemblePath({ visaType: 'iang', familyStatus: 'single', arrivalScenario: 'fresh', existingAssets: [] });
 */

const allTasks = require('./onboarding-tasks');

// ─────────────────────────────────────────────────────────────
// 常量定义
// ─────────────────────────────────────────────────────────────

const PHASE_NAMES = {
  0: '抵港前准备',
  1: '落地生存',
  2: '行政开户',
  3: '安居乐业',
  4: '出行融入',
  5: '子女教育',
  6: '财务税务',
  7: '续签准备'
};

const PHASE_TIME_ESTIMATES = {
  0: '抵港前1-4周',
  1: 'Day 1-3',
  2: 'Week 1-2',
  3: 'Month 1',
  4: 'Month 1-3',
  5: 'Month 1-3',
  6: 'Month 3-6',
  7: 'Month 6-12'
};

/** 全部8关始终可见；解锁由 guidebooks/index rebuildPhases 通过 STAGE_BRIDGE_MAP 动态判定 */
const FULL_PHASES = [0, 1, 2, 3, 4, 5, 6, 7];

/** 已拥有资产的显示名称映射 */
const ASSET_DISPLAY_NAMES = {
  'hkid': '香港身份证',
  'bank-account': '银行账户',
  'rental': '租约',
  'driving-license': '驾驶执照'
};

/** Phase 5 子女教育：childAgeTrack 与 familyStatus 的匹配规则 */
const CHILD_AGE_TRACK_MAP = {
  'preschool': ['preschool'],
  'school':    ['school-age', 'teen']
};

/** 关卡里程碑文案（接受 familyStatus 作差异化） */
const PHASE_MILESTONES = {
  0: '🛫 出发前准备就绪，香港我来了！',
  1: '🎉 生存模式通关！落地三天站稳脚跟',
  2: '📋 行政开户搞定，正式成为香港市民',
  3: '🏠 安居乐业，找到家的感觉',
  4: '🚇 出行融入，香港不再陌生',
  5: '📚 子女教育安排妥当，安心上学',
  6: '💰 财务税务打基础，未来可期',
  7: '✅ 续签材料齐全，永居之路更进一步'
};

// ─────────────────────────────────────────────────────────────
// 公开辅助函数
// ─────────────────────────────────────────────────────────────

/**
 * 获取关卡中文名称
 * @param {number} phase - 关卡编号 0-7
 * @returns {string}
 */
function getPhaseName(phase) {
  return PHASE_NAMES[phase] || ('关卡' + phase);
}

/**
 * 获取关卡时间预估描述
 * @param {number} phase - 关卡编号 0-7
 * @returns {string}
 */
function getPhaseTimeEstimate(phase) {
  return PHASE_TIME_ESTIMATES[phase] || '';
}

/**
 * 获取关卡通关里程碑文案
 * @param {number} phase - 关卡编号 0-7
 * @param {string} familyStatus - 家庭状态
 * @returns {string}
 */
function getPhaseMilestone(phase, familyStatus) {
  // Phase 5 里程碑可根据家庭状态微调
  if (phase === 5) {
    if (familyStatus === 'single' || familyStatus === 'couple') {
      return '本关卡暂不适用';
    }
    if (familyStatus === 'preschool') {
      return '📚 幼儿园入学准备就绪';
    }
    return '📚 子女入学安排妥当';
  }
  return PHASE_MILESTONES[phase] || '';
}

// ─────────────────────────────────────────────────────────────
// 核心筛选逻辑
// ─────────────────────────────────────────────────────────────

/**
 * 判断任务对当前用户画像是否适用
 * @param {Object} task    - 任务模板对象
 * @param {Object} params  - 用户画像
 * @param {number[]} unlockedPhases - 已解锁关卡列表
 * @returns {boolean}
 */
function isTaskApplicable(task, params, unlockedPhases) {
  // 1) 任务 phase 必须在已解锁关卡中
  if (!unlockedPhases.includes(task.phase)) {
    return false;
  }

  var applicable = task.applicableTo || {};

  // 会员全解锁模式下跳过签证/家庭状态过滤
  if (params.memberUnlockAll) {
    return true;
  }

  // 2) 签证类型匹配
  if (applicable.visaTypes !== 'all' && applicable.visaTypes.indexOf(params.visaType) === -1) {
    return false;
  }

  // 3) 家庭状态匹配
  if (applicable.familyStatus !== 'all' && applicable.familyStatus.indexOf(params.familyStatus) === -1) {
    return false;
  }

  // 4) 抵港场景匹配
  if (applicable.arrivalScenario.indexOf('all') === -1 && applicable.arrivalScenario.indexOf(params.arrivalScenario) === -1) {
    return false;
  }

  // 5) Phase 5 子女教育 — childAgeTrack 额外检查
  if (task.phase === 5 && applicable.childAgeTrack) {
    var allowedFamilyStatuses = CHILD_AGE_TRACK_MAP[applicable.childAgeTrack];
    if (!allowedFamilyStatuses || allowedFamilyStatuses.indexOf(params.familyStatus) === -1) {
      return false;
    }
  }

  return true;
}

/**
 * 计算两个数组的交集
 * @param {string[]} arrA
 * @param {string[]} arrB
 * @returns {string[]}
 */
function arrayIntersection(arrA, arrB) {
  var result = [];
  var i, j;
  for (i = 0; i < arrA.length; i++) {
    for (j = 0; j < arrB.length; j++) {
      if (arrA[i] === arrB[j]) {
        result.push(arrA[i]);
      }
    }
  }
  return result;
}

/**
 * 主路径装配函数
 *
 * @param {Object} params
 * @param {string} params.visaType        - 签证类型
 * @param {string} params.familyStatus    - 家庭状态
 * @param {string} params.arrivalScenario - 抵港场景
 * @param {string[]} params.existingAssets - 已拥有的资产/文件列表
 * @returns {{ phases: Object[], tasks: Object[], summary: Object }}
 */
function assemblePath(params) {
  // ── 参数校验与默认 ──
  var visaType = params.visaType || 'iang';
  var familyStatus = params.familyStatus || 'single';
  var arrivalScenario = params.arrivalScenario || 'fresh';
  var existingAssets = params.existingAssets || [];

  // ── 全部关卡始终返回；解锁由 guidebooks/index 动态判定 ──
  var unlockedPhases = FULL_PHASES;

  // ── 筛选与排序任务 ──
  var matchedTasks = [];
  var i, task;

  for (i = 0; i < allTasks.length; i++) {
    task = allTasks[i];

    // 检查是否适用
    if (!isTaskApplicable(task, { visaType: visaType, familyStatus: familyStatus, arrivalScenario: arrivalScenario, memberUnlockAll: params.memberUnlockAll }, unlockedPhases)) {
      continue;
    }

    // 深拷贝任务对象以免修改原模板
    var clonedTask = deepCloneTask(task);

    // 检查自动跳过（已拥有资产）
    var skipList = clonedTask.applicableTo.skipIfExisting || [];
    var intersection = arrayIntersection(skipList, existingAssets);

    if (intersection.length > 0) {
      clonedTask.autoSkipped = true;
      clonedTask.skipReason = '已拥有: ' + (ASSET_DISPLAY_NAMES[intersection[0]] || intersection[0]);
    } else {
      clonedTask.autoSkipped = false;
      clonedTask.skipReason = null;
    }

    matchedTasks.push(clonedTask);
  }

  // ── 排序：按 phase 升序，同 phase 内按 sequence 升序 ──
  matchedTasks.sort(function (a, b) {
    if (a.phase !== b.phase) return a.phase - b.phase;
    return a.sequence - b.sequence;
  });

  // ── 全部8关始终返回 (TC-3.1.1 fix: 空关卡也可见) ──
  var phases = [];
  var phaseStats = {};
  var j, phase;

  for (j = 0; j < unlockedPhases.length; j++) {
    phase = unlockedPhases[j];
    phaseStats[phase] = { totalTasks: 0, totalRequired: 0 };
  }

  for (i = 0; i < matchedTasks.length; i++) {
    task = matchedTasks[i];
    phase = task.phase;
    if (!phaseStats[phase]) {
      phaseStats[phase] = { totalTasks: 0, totalRequired: 0 };
    }
    phaseStats[phase].totalTasks++;
    if (task.urgency === '必修') {
      phaseStats[phase].totalRequired++;
    }
  }

  // 按 phase 升序构建 — 包含全部8关 (即使有关卡无匹配任务)
  for (j = 0; j < FULL_PHASES.length; j++) {
    phase = FULL_PHASES[j];
    if (!phaseStats[phase]) {
      phaseStats[phase] = { totalTasks: 0, totalRequired: 0 };
    }
    var stats = phaseStats[phase];
    phases.push({
      phase: phase,
      name: PHASE_NAMES[phase],
      timeEstimate: PHASE_TIME_ESTIMATES[phase],
      unlocked: true,
      totalRequired: stats.totalRequired,
      totalTasks: stats.totalTasks,
      requiredCompleted: 0
    });
  }

  // ── 汇总 ──
  var totalRequired = 0;
  var totalAll = 0;
  for (i = 0; i < phases.length; i++) {
    totalRequired += phases[i].totalRequired;
    totalAll += phases[i].totalTasks;
  }

  var applicableFamily = (familyStatus !== 'single' && familyStatus !== 'couple');

  return {
    phases: phases,
    tasks: matchedTasks,
    summary: {
      totalRequired: totalRequired,
      totalTasks: totalAll,
      applicableFamily: applicableFamily
    }
  };
}

// ─────────────────────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────────────────────

/**
 * 深拷贝任务对象（防止修改原始模板）
 * @param {Object} task
 * @returns {Object}
 */
function deepCloneTask(task) {
  return JSON.parse(JSON.stringify(task));
}

// ─────────────────────────────────────────────────────────────
// 导出
// ─────────────────────────────────────────────────────────────

module.exports = {
  assemblePath: assemblePath,
  getPhaseName: getPhaseName,
  getPhaseTimeEstimate: getPhaseTimeEstimate,
  getPhaseMilestone: getPhaseMilestone
};
