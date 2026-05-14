/**
 * 住港伴 — 新手引导通关手册存储引擎
 * 港漂通关手册 · 新手任务管理器
 * 基于 wx.setStorageSync / wx.getStorageSync 的全量持久化
 */
var STORAGE_KEY = '__onboarding__';

/**
 * 读取完整进度对象
 * @returns {object|null} 反序列化的 progress 对象，未初始化返回 null
 */
function getProgress() {
  try {
    var raw = wx.getStorageSync(STORAGE_KEY);
    if (!raw) return null;
    return raw;
  } catch (e) {
    console.error('[OnboardingStorage] getProgress error:', e);
    return null;
  }
}

/**
 * 全覆盖保存进度对象
 * @param {object} progress 完整进度对象
 */
function saveProgress(progress) {
  try {
    progress.updatedAt = new Date().toISOString();
    wx.setStorageSync(STORAGE_KEY, progress);
  } catch (e) {
    console.error('[OnboardingStorage] saveProgress error:', e);
  }
}

/**
 * 初始化新手引导进度
 * 仅在不存在已有进度时调用
 * @param {object} params 路径参数: { visaType, familyStatus, arrivalScenario, existingAssets }
 * @returns {object} 新建的 progress 对象
 */
function initOnboarding(params) {
  var now = new Date().toISOString();
  var progress = {
    userId: '',
    pathParams: {
      visaType: params.visaType || '',
      familyStatus: params.familyStatus || 'single',
      arrivalScenario: params.arrivalScenario || 'fresh',
      existingAssets: Array.isArray(params.existingAssets) ? params.existingAssets : []
    },
    startedAt: now,
    currentPhase: 1,
    tasks: {},
    phases: {
      '1': { unlocked: true, completed: false }
    },
    renewalDossier: {
      address: { items: [], completeness: 0 },
      employment: { items: [], completeness: 0 },
      family: { items: [], completeness: 0 },
      visa: { items: [], completeness: 0 }
    },
    updatedAt: now
  };
  saveProgress(progress);
  return progress;
}

/**
 * 标记任务为已完成（步骤完成，但材料尚未收集）
 * @param {string} taskId 任务标识符，如 "onboard-101"
 */
function completeTask(taskId) {
  var progress = getProgress();
  if (!progress) return;
  progress.tasks[taskId] = {
    status: 'completed',
    completedAt: new Date().toISOString(),
    materialCollected: false
  };
  saveProgress(progress);
}

/**
 * 标记任务为已完成，同时附加材料信息
 * @param {string} taskId 任务标识符
 * @param {string} imagePath 材料图片本地路径
 * @param {string} docType 材料类型，如 "hkid"
 * @param {string} docCategory 材料归类，枚举值: "address"|"employment"|"family"|"visa"
 */
function completeTaskWithMaterial(taskId, imagePath, docType, docCategory) {
  var progress = getProgress();
  if (!progress) return;
  var now = new Date().toISOString();
  progress.tasks[taskId] = {
    status: 'completed',
    completedAt: now,
    materialCollected: true,
    imagePath: imagePath || '',
    docType: docType || ''
  };
  // 写入 renewalDossier
  if (docCategory && progress.renewalDossier[docCategory]) {
    var dossier = progress.renewalDossier[docCategory];
    dossier.items.push({
      taskId: taskId,
      docType: docType || '',
      imagePath: imagePath || '',
      collectedAt: now
    });
    // 重新计算该分类的 completeness
    dossier.completeness = recalcCompleteness(dossier.items);
  }
  saveProgress(progress);
}

/**
 * 标记任务为已跳过
 * @param {string} taskId 任务标识符
 * @param {string} reason 跳过原因，如 "已拥有: hkid"
 */
function skipTask(taskId, reason) {
  var progress = getProgress();
  if (!progress) return;
  progress.tasks[taskId] = {
    status: 'skipped',
    skipReason: reason || ''
  };
  saveProgress(progress);
}

/**
 * 将任务重置为待办状态（从存储中移除）
 * @param {string} taskId 任务标识符
 */
function resetTask(taskId) {
  var progress = getProgress();
  if (!progress) return;
  delete progress.tasks[taskId];
  // 同时清理 renewalDossier 中关联的材料条目
  var categories = ['address', 'employment', 'family', 'visa'];
  for (var c = 0; c < categories.length; c++) {
    var cat = categories[c];
    if (!progress.renewalDossier[cat]) continue;
    var filtered = [];
    var items = progress.renewalDossier[cat].items;
    for (var i = 0; i < items.length; i++) {
      if (items[i].taskId !== taskId) {
        filtered.push(items[i]);
      }
    }
    progress.renewalDossier[cat].items = filtered;
    progress.renewalDossier[cat].completeness = recalcCompleteness(filtered);
  }
  saveProgress(progress);
}

/**
 * 解锁指定阶段
 * @param {number|string} phase 阶段编号（使用字符串键）
 */
function unlockPhase(phase) {
  var progress = getProgress();
  if (!progress) return;
  var key = String(phase);
  if (!progress.phases[key]) {
    progress.phases[key] = {};
  }
  progress.phases[key].unlocked = true;
  // 如果该阶段还没有 completed 字段，默认 false
  if (progress.phases[key].completed === undefined) {
    progress.phases[key].completed = false;
  }
  saveProgress(progress);
}

/**
 * 完成指定阶段并自动解锁下一阶段
 * @param {number|string} phase 阶段编号
 */
function completePhase(phase) {
  var progress = getProgress();
  if (!progress) return;
  var key = String(phase);
  var now = new Date().toISOString();
  if (!progress.phases[key]) {
    progress.phases[key] = {};
  }
  progress.phases[key].unlocked = true;
  progress.phases[key].completed = true;
  progress.phases[key].completedAt = now;
  // 自动解锁下一阶段
  var nextKey = String(Number(phase) + 1);
  if (!progress.phases[nextKey]) {
    progress.phases[nextKey] = {};
  }
  progress.phases[nextKey].unlocked = true;
  if (progress.phases[nextKey].completed === undefined) {
    progress.phases[nextKey].completed = false;
  }
  // 同步 currentPhase
  var nextNum = Number(phase) + 1;
  if (nextNum > progress.currentPhase) {
    progress.currentPhase = nextNum;
  }
  saveProgress(progress);
}

/**
 * 更新路径参数（警告：此操作会重置所有进度）
 * @param {object} params 新的路径参数: { visaType, familyStatus, arrivalScenario, existingAssets }
 * @returns {boolean}
 */
function updatePathParams(params) {
  try {
    wx.removeStorageSync(STORAGE_KEY);
    initOnboarding(params);
    return true;
  } catch (e) {
    console.error('[OnboardingStorage] updatePathParams error:', e);
    return false;
  }
}

/**
 * 清除所有新手引导数据
 * @returns {boolean}
 */
function resetAll() {
  try {
    wx.removeStorageSync(STORAGE_KEY);
    return true;
  } catch (e) {
    console.error('[OnboardingStorage] resetAll error:', e);
    return false;
  }
}

/**
 * 仅返回续签材料包部分
 * @returns {object|null}
 */
function getRenewalDossier() {
  var progress = getProgress();
  if (!progress) return null;
  return progress.renewalDossier;
}

/**
 * 计算并返回续签准备度评分
 * @returns {object} { address: float, employment: float, family: float, visa: float, overall: float }
 */
function getRenewalReadiness() {
  var progress = getProgress();
  if (!progress) return { address: 0, employment: 0, family: 0, visa: 0, overall: 0 };
  var dossier = progress.renewalDossier;
  var scores = {
    address: dossier.address ? dossier.address.completeness || 0 : 0,
    employment: dossier.employment ? dossier.employment.completeness || 0 : 0,
    family: dossier.family ? (dossier.family.applicable === false ? 0 : dossier.family.completeness || 0) : 0,
    visa: dossier.visa ? dossier.visa.completeness || 0 : 0
  };
  // overall = 适用分类的平均值
  var applicableCount = 0;
  var totalScore = 0;
  var categories = ['address', 'employment', 'family', 'visa'];
  for (var i = 0; i < categories.length; i++) {
    var cat = categories[i];
    var isApplicable = dossier[cat] ? dossier[cat].applicable !== false : true;
    if (isApplicable) {
      totalScore += scores[cat];
      applicableCount++;
    }
  }
  scores.overall = applicableCount > 0 ? Math.round((totalScore / applicableCount) * 100) / 100 : 0;
  // 确保值在 0-1 区间
  scores.address = clamp01(scores.address);
  scores.employment = clamp01(scores.employment);
  scores.family = clamp01(scores.family);
  scores.visa = clamp01(scores.visa);
  scores.overall = clamp01(scores.overall);
  return scores;
}

/**
 * 生成已收集材料的文本清单，适用于 wx.setClipboardData
 * @returns {string}
 */
function exportChecklist() {
  var progress = getProgress();
  if (!progress) return '';
  var dossier = progress.renewalDossier;
  var lines = [];
  lines.push('【港漂通关手册 · 已收集材料清单】');
  lines.push('');

  var CAT_LABELS = { address: '🏠 居住证明', employment: '💼 工作证明', family: '👨‍👩‍👧 家庭证明', visa: '📄 签证记录', auxiliary: '📎 辅助材料' };
  var categoryOrder = ['visa', 'address', 'employment', 'family'];

  var totalCount = 0;
  for (var o = 0; o < categoryOrder.length; o++) {
    var catKey = categoryOrder[o];
    var catData = dossier[catKey];
    if (!catData || !catData.items || catData.items.length === 0) continue;
    var label = CAT_LABELS[catKey] || catKey;
    lines.push('【' + label + '】' + '  已完成: ' + Math.round((catData.completeness || 0) * 100) + '%');
    for (var j = 0; j < catData.items.length; j++) {
      var item = catData.items[j];
      lines.push('  - ' + (item.docType || item.taskId || '材料'));
      totalCount++;
    }
    lines.push('');
  }
  if (totalCount === 0) {
    lines.push('（暂无已收集材料）');
    lines.push('');
  }
  lines.push('共计 ' + totalCount + ' 份材料');
  return lines.join('\n');
}

// --- 内部辅助函数 ---

/**
 * 根据已有材料条目重新计算 completeness 值
 * 简单策略：每项材料贡献均分，预设 4 项材料为满分
 * @param {Array} items 材料条目数组
 * @returns {number} 0.0 ~ 1.0
 */
function recalcCompleteness(items) {
  if (!items || items.length === 0) return 0;
  var score = Math.min(items.length / 4, 1);
  return Math.round(score * 100) / 100;
}

/**
 * 将数值钳制在 0 ~ 1 之间
 * @param {number} val
 * @returns {number}
 */
function clamp01(val) {
  if (val < 0) return 0;
  if (val > 1) return 1;
  return val;
}

module.exports = {
  initOnboarding: initOnboarding,
  getProgress: getProgress,
  saveProgress: saveProgress,
  completeTask: completeTask,
  completeTaskWithMaterial: completeTaskWithMaterial,
  skipTask: skipTask,
  resetTask: resetTask,
  unlockPhase: unlockPhase,
  completePhase: completePhase,
  updatePathParams: updatePathParams,
  resetAll: resetAll,
  getRenewalDossier: getRenewalDossier,
  getRenewalReadiness: getRenewalReadiness,
  exportChecklist: exportChecklist
};
