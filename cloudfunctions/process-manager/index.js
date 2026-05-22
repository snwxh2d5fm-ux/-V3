/**
 * process-manager v4.1 — 流程控管理云函数 (PRD v3.1)
 * 负责流程实例管理、里程碑验证、进度更新
 * V5升级: 12条流程模板 + 四阶段框架 + 6决策节点
 *
 * PRD v3.1 覆盖: PC-01~PC-06 + PC-V5-01~PC-V5-05
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { action } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  try {
    switch (action) {
      case 'start':
        return await startProcess(openid, event);
      case 'getTemplates':
        return await getTemplates(event);
      case 'getTemplate':
        return await getTemplate(event.templateId);
      case 'getActive':
        return await getActive(openid, event);
      case 'getMyProcess':
        return await getMyProcess(openid, event.processId);
      case 'getMyProcesses':
        return await getMyProcesses(openid);
      case 'getProgress':
        return await getProgress(openid, event.processId);
      case 'advanceStage':
        return await advanceStage(openid, event);
      case 'completeStep':
        return await completeStep(openid, event);
      case 'verifyMilestone':
        return await verifyMilestone(openid, event);
      case 'resetIdentityPhase':
        return await resetIdentityPhase(openid, event);
      case 'getChecklist':
        return await getChecklist(openid, event.templateId, event.userDocIds);
      case 'handleException':
        return await handleException(openid, event);
      case 'getDecisionNodes':
        return await getDecisionNodes(event.templateId);
      default:
        return { code: 400, msg: '无效操作' };
    }
  } catch (err) {
    console.error('[process-manager]', err);
    return { code: 500, msg: '流程管理服务异常', error: err.message };
  }
};

/**
 * 获取所有流程模板
 * PC-01.1: 预置14条标准流程模板(12路径+激活+永居通用)
 */
async function getTemplates(event) {
  const query = { isActive: true };
  if (event?.pathType) {
    query.applicablePaths = _.in([event.pathType]);
  }

  const result = await db.collection('process_templates').where(query).orderBy('templateId', 'asc').get();

  // 脱敏：不返回内部字段
  return {
    code: 0,
    data: result.data.map((t) => ({
      templateId: t.templateId,
      templateName: t.templateName,
      applicablePaths: t.applicablePaths,
      totalStages: t.totalStages,
      stageSummary: t.stages?.map((s) => ({
        stageId: s.stageId,
        stageName: s.stageName,
        order: s.order,
        description: s.description,
        isMilestone: s.isMilestone,
      })),
      version: t.version,
    })),
  };
}

/**
 * 获取单个模板详情
 */
async function getTemplate(templateId) {
  const result = await db.collection('process_templates').where({ templateId }).get();
  if (result.data.length === 0) return { code: 404, msg: '模板不存在' };
  return { code: 0, data: result.data[0] };
}

/**
 * 启动新流程
 * PC-01.2: 用户选择路径后自动匹配模板
 */
async function startProcess(openid, event) {
  const { templateId } = event;
  if (!templateId) return { code: 400, msg: '缺少 templateId' };

  const template = await db.collection('process_templates').where({ templateId }).get();
  if (template.data.length === 0) return { code: 404, msg: '模板不存在' };

  const tmpl = template.data[0];

  // 检查是否已有进行中的同模板流程
  const existing = await db.collection('user_processes').where({ _openid: openid, templateId, status: 'active' }).get();
  if (existing.data.length > 0) {
    return { code: 409, msg: '已有进行中的相同流程', data: { processId: existing.data[0]._id } };
  }

  // 构建流程实例
  const stages = tmpl.stages.map((s, i) => ({
    stageId: s.stageId,
    stageName: s.stageName,
    order: s.order,
    status: i === 0 ? 'in_progress' : 'locked',
    isMilestone: s.isMilestone || false,
    milestoneDocType: s.milestoneDocType || null,
    ocrValidationRule: s.ocrValidationRule || null,
    steps: s.steps.map((st) => ({
      stepId: st.stepId,
      stepName: st.stepName,
      status: i === 0 ? 'pending' : 'locked',
      completedAt: null,
      materials: [],
      notes: null,
    })),
  }));

  const milestones = tmpl.stages
    .filter((s) => s.isMilestone)
    .map((s) => ({
      stageId: s.stageId,
      milestoneDocId: null,
      docType: s.milestoneDocType,
      ocrRule: s.ocrValidationRule,
      status: 'pending',
      attempts: 0,
    }));

  const process = {
    _openid: openid,
    templateId: tmpl.templateId,
    templateVersion: tmpl.version,
    currentStageId: stages[0].stageId,
    currentStepId: stages[0].steps[0]?.stepId || null,
    overallProgress: 0,
    stages,
    milestones,
    exceptions: [],
    history: [],
    status: 'active',
    startedAt: db.serverDate(),
    completedAt: null,
    createdAt: db.serverDate(),
    updatedAt: db.serverDate(),
  };

  const result = await db.collection('user_processes').add({ data: process });

  // 记录审计
  await _logAudit(openid, 'process_start', {
    processId: result._id,
    templateId,
    templateName: tmpl.templateName,
  });

  // 更新用户流程计数和当前阶段
  await db
    .collection('users')
    .where({ _openid: openid })
    .update({
      data: { processCount: _.inc(1), currentPhase: tmpl.stages[0].stageId, updatedAt: db.serverDate() },
    });

  return { code: 0, data: { processId: result._id, ...process } };
}

/**
 * 获取用户的单个流程实例
 */
async function getMyProcess(openid, processId) {
  const result = await db.collection('user_processes').where({ _id: processId, _openid: openid }).get();
  if (result.data.length === 0) return { code: 404, msg: '流程不存在' };
  return { code: 0, data: result.data[0] };
}

/**
 * 获取用户所有流程
 */
async function getMyProcesses(openid) {
  const result = await db.collection('user_processes').where({ _openid: openid }).orderBy('createdAt', 'desc').get();

  return {
    code: 0,
    data: result.data.map((p) => ({
      processId: p._id,
      templateId: p.templateId,
      status: p.status,
      currentStageId: p.currentStageId,
      overallProgress: p.overallProgress,
      startedAt: p.startedAt,
    })),
  };
}

/**
 * 获取进度详情
 * PC-02: 进度看板
 */
async function getProgress(openid, processId) {
  const result = await db.collection('user_processes').where({ _id: processId, _openid: openid }).get();
  if (result.data.length === 0) return { code: 404, msg: '流程不存在' };

  const proc = result.data[0];
  const template = await db.collection('process_templates').where({ templateId: proc.templateId }).get();
  const tmpl = template.data[0];

  // 构建进度看板
  const stageProgress = (proc.stages || []).map((ps) => {
    const tmplStage = tmpl?.stages?.find((s) => s.stageId === ps.stageId);
    const totalSteps = tmplStage?.steps?.length || 0;
    const completedSteps = (ps.steps || []).filter((s) => s.status === 'completed').length;

    return {
      stageId: ps.stageId,
      stageName: ps.stageName,
      status: ps.status,
      order: ps.order,
      progress: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
      totalSteps,
      completedSteps,
      isCurrent: ps.stageId === proc.currentStageId,
    };
  });

  return {
    code: 0,
    data: {
      processId: proc._id,
      templateId: proc.templateId,
      currentStageId: proc.currentStageId,
      overallProgress: proc.overallProgress,
      stages: stageProgress,
      milestones: proc.milestones,
      exceptions: proc.exceptions,
    },
  };
}

/**
 * 完成步骤
 * PC-02.3: 当前步骤高亮
 */
async function completeStep(openid, event) {
  const { processId, stageId, stepId, materialIds } = event;

  const result = await db.collection('user_processes').where({ _id: processId, _openid: openid }).get();
  if (result.data.length === 0) return { code: 404, msg: '流程不存在' };

  const proc = result.data[0];

  // 校验: 当前阶段必须是 in_progress
  const origStage = proc.stages.find((s) => s.stageId === stageId);
  if (!origStage) return { code: 400, msg: '阶段不存在' };
  if (origStage.status === 'completed') return { code: 400, msg: '该阶段已完成，不可操作' };
  if (origStage.status === 'locked') return { code: 400, msg: '该阶段未解锁' };

  const stages = proc.stages.map((s) => {
    if (s.stageId !== stageId) return s;
    return {
      ...s,
      steps: s.steps.map((st) => {
        if (st.stepId !== stepId) return st;
        return {
          ...st,
          status: 'completed',
          completedAt: new Date().toISOString(),
          materials: materialIds || st.materials,
        };
      }),
    };
  });

  // 重新计算进度
  const allSteps = stages.flatMap((s) => s.steps);
  const completed = allSteps.filter((s) => s.status === 'completed').length;
  const progress = allSteps.length > 0 ? Math.round((completed / allSteps.length) * 100) : 0;

  // 判断是否需要推进阶段
  const currentStage = stages.find((s) => s.stageId === stageId);
  const stageAllDone = currentStage?.steps.every((s) => s.status === 'completed');

  let nextStageId = proc.currentStageId;
  let requiresMilestone = false;

  if (stageAllDone) {
    // 向后兼容: 若 isMilestone 未定义，回查模板
    let isMilestone = currentStage?.isMilestone;
    if (isMilestone === undefined) {
      isMilestone = await _resolveMilestoneFallback(proc.templateId, stageId);
    }

    if (isMilestone) {
      // 通道B: 有里程碑，步骤完成不自动推进
      requiresMilestone = true;
    } else {
      // 通道A: 无里程碑，自动推进
      const sortedStages = stages.sort((a, b) => a.order - b.order);
      const currentIdx = sortedStages.findIndex((s) => s.stageId === stageId);
      if (currentIdx < sortedStages.length - 1) {
        nextStageId = sortedStages[currentIdx + 1].stageId;
        stages.find((s) => s.stageId === nextStageId).status = 'in_progress';
      }
    }
  }

  // 乐观锁: 仅当阶段仍为 in_progress 时更新
  const updateResult = await db
    .collection('user_processes')
    .where({
      _id: processId,
      stages: _.elemMatch({ stageId: stageId, status: 'in_progress' }),
    })
    .update({
      data: {
        stages,
        overallProgress: progress,
        currentStageId: nextStageId,
        history: _.push({
          timestamp: new Date().toISOString(),
          action: 'step_complete',
          detail: `完成步骤 ${stageId}.${stepId}`,
        }),
        updatedAt: db.serverDate(),
      },
    });

  if (updateResult.stats.updated === 0) {
    return { code: 409, msg: '阶段状态已变更，请刷新后重试' };
  }

  return { code: 0, data: { overallProgress: progress, stageAllDone, requiresMilestone, nextStageId } };
}

/**
 * 向后兼容: 旧流程实例缺少 isMilestone 字段时，回查模板
 */
async function _resolveMilestoneFallback(templateId, stageId) {
  try {
    const tmpl = await db.collection('process_templates').where({ templateId }).get();
    if (tmpl.data.length > 0) {
      const stage = (tmpl.data[0].stages || []).find((s) => s.stageId === stageId);
      return stage?.isMilestone || false;
    }
  } catch (e) {
    console.warn('[process-manager] _resolveMilestoneFallback error:', e.message);
  }
  return false;
}

/**
 * 解锁下一阶段
 */
async function advanceStage(openid, event) {
  const { processId } = event;
  // 由里程碑验证触发，此处为手动推进入口
  return { code: 0, msg: '阶段推进由里程碑验证自动触发' };
}

/**
 * 里程碑验证
 * PC-06: 里程碑解锁机制
 */
async function verifyMilestone(openid, event) {
  const { processId, stageId, docId, ocrResult } = event;

  const proc = await db.collection('user_processes').where({ _id: processId, _openid: openid }).get();
  if (proc.data.length === 0) return { code: 404, msg: '流程不存在' };

  const record = proc.data[0];
  let milestone = record.milestones?.find((m) => m.stageId === stageId);
  if (!milestone) {
    // 模板可能未标记isMilestone但前端已展示上传按钮 → 动态创建
    milestone = {
      stageId,
      milestoneDocId: null,
      docType: expectedDocType || 'unknown',
      ocrRule: null,
      status: 'pending',
      attempts: 0,
    };
    record.milestones = [...(record.milestones || []), milestone];
  }

  // 校验: 当前阶段必须是 in_progress
  const origStage = record.stages.find((s) => s.stageId === stageId);
  if (origStage?.status === 'completed') return { code: 400, msg: '该阶段已完成，无需重复验证' };

  // 获取模板中的OCR验证规则
  const template = await db.collection('process_templates').where({ templateId: record.templateId }).get();
  const tmplStage = template.data[0]?.stages?.find((s) => s.stageId === stageId);
  const expectedDocType = tmplStage?.milestoneDocType || '';

  // OCR类型验证
  const actualDocType = ocrResult?.docTypeDetected || '';
  const isMatch = _validateDocType(actualDocType, expectedDocType);

  const attempts = (milestone.attempts || 0) + 1;

  if (!isMatch) {
    // 失败: 仅记录，不锁定
    await _updateMilestone(processId, stageId, docId, {
      attempts,
      isMatch: false,
      status: 'failed',
      ocrResult: { dateField: ocrResult?.dateField, numberField: ocrResult?.numberField },
      verifiedAt: db.serverDate(),
    });

    return { code: 400, msg: `材料类型不符：期望${expectedDocType}，识别为${actualDocType}`, attempts };
  }

  // 验证通过
  await _updateMilestone(processId, stageId, docId, {
    attempts,
    isMatch: true,
    status: 'verified',
    ocrResult: { dateField: ocrResult?.dateField, numberField: ocrResult?.numberField },
    verifiedAt: db.serverDate(),
  });

  // PC-06.9: 前向跳跃验证——检查是否跳过了前置阶段
  const stageIdx = record.stages.findIndex((s) => s.stageId === stageId);
  const unlockedStageIds = [];

  const updatedStages = record.stages.map((s, i) => {
    if (i < stageIdx && s.status === 'locked') {
      unlockedStageIds.push(s.stageId);
      return {
        ...s,
        status: 'completed',
        steps: s.steps.map((st) => ({ ...st, status: 'completed', completedAt: new Date().toISOString() })),
      };
    }
    if (i === stageIdx) return { ...s, status: 'completed' };
    return s;
  });

  // 解锁下一阶段
  let nextStageId = stageId;
  if (stageIdx < record.stages.length - 1) {
    const nextStage = updatedStages[stageIdx + 1];
    nextStage.status = 'in_progress';
    nextStage.steps = nextStage.steps.map((st) => ({ ...st, status: 'pending' }));
    nextStageId = nextStage.stageId;
  }

  const isForwardJump = unlockedStageIds.length > 0;

  // 更新流程
  await db
    .collection('user_processes')
    .where({ _id: processId })
    .update({
      data: {
        stages: updatedStages,
        currentStageId: nextStageId,
        history: _.push({
          timestamp: new Date().toISOString(),
          action: 'milestone_verify',
          detail: `里程碑验证通过: ${stageId}${isForwardJump ? '(前向跳跃)' : ''}`,
        }),
        updatedAt: db.serverDate(),
      },
    });

  // 记录里程碑（不含 lockedUntil 和 isAnomaly）
  await db.collection('milestone_records').add({
    data: {
      _openid: openid,
      processId,
      stageId,
      docId,
      expectedDocType,
      actualDocType,
      isMatch: true,
      confidence: ocrResult?.confidence || 1,
      attempts,
      isForwardJump,
      unlockedStageIds,
      ocrResult: { dateField: ocrResult?.dateField || null, numberField: ocrResult?.numberField || null },
      verifiedAt: db.serverDate(),
      createdAt: db.serverDate(),
    },
  });

  // DR-05.1: 如果是"获批"里程碑，触发证件夹归档
  if (tmplStage?.stageName?.includes('获批') || stageId.includes('approval')) {
    await cloud.callFunction({
      name: 'document-manager',
      data: { action: 'triggerArchive', processId },
    });
  }

  return {
    code: 0,
    data: {
      verified: true,
      unlockedStageIds,
      isForwardJump,
      nextStageId,
      currentStageId: nextStageId,
    },
  };
}

/**
 * 获取材料匹配清单
 * PC-03.1: 流程步骤关联证件
 */
async function getChecklist(openid, templateId, userDocIds) {
  const template = await db.collection('process_templates').where({ templateId }).get();
  if (template.data.length === 0) return { code: 404, msg: '模板不存在' };

  const tmpl = template.data[0];
  const userDocs = await db
    .collection('user_documents')
    .where({ _id: _.in(userDocIds || []), _openid: openid })
    .get();

  // 收集所需材料类型
  const materialMap = {};
  for (const stage of tmpl.stages || []) {
    for (const step of stage.steps || []) {
      for (const mat of step.requiredMaterials || []) {
        materialMap[mat.materialType] = {
          materialType: mat.materialType,
          isOptional: mat.isOptional,
          condition: mat.condition,
          matchedDocs: [],
        };
      }
    }
  }

  // 匹配已有材料
  for (const doc of userDocs.data) {
    if (materialMap[doc.docType]) {
      materialMap[doc.docType].matchedDocs.push({
        docId: doc._id,
        docName: doc.docName,
        status: doc.docStatus === 'expired' ? 'expired' : 'ready',
      });
    }
  }

  const checklist = Object.values(materialMap).map((m) => ({
    ...m,
    status: m.matchedDocs.length > 0 ? 'matched' : 'missing',
    hasExpired: m.matchedDocs.some((d) => d.status === 'expired'),
  }));

  return {
    code: 0,
    data: {
      templateId,
      checklist,
      summary: {
        total: checklist.length,
        matched: checklist.filter((c) => c.status === 'matched').length,
        missing: checklist.filter((c) => c.status === 'missing').length,
      },
    },
  };
}

/**
 * 处理异常（补件/被拒）
 * PC-05: 异常处理
 */
/**
 * ¥599身份重置 (由 payment 云函数 V3 回调触发)
 * 清除当前活跃流程、提醒规则、用户阶段标记
 */
async function resetIdentityPhase(openid, event) {
  const { transactionId } = event;
  if (!transactionId) return { code: 400, msg: '缺少 transactionId' };

  // 1. 校验支付凭证 (订单集合 orders，由 payment 云函数 confirmPayment 写入)
  const payLog = await db
    .collection('orders')
    .where({ _openid: openid, transactionId, status: 'completed', category: 'identity_reset' })
    .get();
  if (payLog.data.length === 0) return { code: 402, msg: '未找到支付记录或支付未完成' };

  // 2. 取消当前活跃流程
  await db
    .collection('user_processes')
    .where({ _openid: openid, status: 'active' })
    .update({ data: { status: 'cancelled', updatedAt: db.serverDate() } });

  // 3. 清除关联提醒
  await db
    .collection('reminders')
    .where({ _openid: openid, status: 'active' })
    .update({ data: { status: 'inactive', updatedAt: db.serverDate() } });

  // 4. 清除 users 中的阶段标记
  await db
    .collection('users')
    .where({ _openid: openid })
    .update({
      data: { currentPhase: '', currentStageId: '', guidebookAllUnlocked: false, updatedAt: db.serverDate() },
    });

  // 5. 写入审计日志
  await _logAudit(openid, 'identity_reset', { transactionId });

  return { code: 0, msg: '身份状态已重置，请重新选择' };
}

async function handleException(openid, event) {
  const { processId, type, description } = event;
  if (!['supplement', 'rejection'].includes(type)) {
    return { code: 400, msg: '无效异常类型' };
  }

  await db
    .collection('user_processes')
    .where({ _id: processId })
    .update({
      data: {
        exceptions: _.push({
          type,
          receivedAt: new Date().toISOString(),
          description,
          resolvedAt: null,
          resolution: null,
        }),
        updatedAt: db.serverDate(),
      },
    });

  if (type === 'rejection') {
    await db
      .collection('user_processes')
      .where({ _id: processId })
      .update({
        data: { status: 'rejected' },
      });
  }

  return { code: 0, msg: 'ok' };
}

/**
 * V5新增: 获取活跃流程 (供 app.js refreshProcessData 调用)
 */
async function getActive(openid, event) {
  const processId = event.processId;
  const result = await db
    .collection('user_processes')
    .where(processId ? { _id: processId, _openid: openid } : { _openid: openid, status: 'active' })
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
  if (result.data.length === 0) return { code: 404, msg: '无活跃流程' };
  return { code: 0, data: result.data[0] };
}

/**
 * V5新增: 获取模板决策节点 (PRD v3.1 PC-V5-02)
 */
async function getDecisionNodes(templateId) {
  const result = await db.collection('process_templates').where({ templateId }).get();
  if (result.data.length === 0) return { code: 404, msg: '模板不存在' };
  const tmpl = result.data[0];
  const DP_MAP = {
    dp1_initial_path: { name: '首次路径选择', desc: '评估各路径资格条件' },
    dp2_student_to_work: { name: '学生→工作转换', desc: '选择: IANG/优才/专才/高才通' },
    dp3_renewal_strategy: { name: '续签策略', desc: '雇主sponsor/自雇/创业/类别转换' },
    dp4_category_switch: { name: '类别转换', desc: '是否/何时转换到其他类别' },
    dp5_pr_sprint: { name: '永居冲刺', desc: '材料整理/离港解释/递交策略' },
    dp6_family_sync: { name: '家庭同步', desc: '主申与受养人状态协调' },
  };
  const dps = (tmpl.decisionPoints || []).map((dp) => {
    const info = DP_MAP[dp] || { name: dp, desc: '' };
    return { id: dp, name: info.name, description: info.desc };
  });
  return { code: 0, data: { templateId, templateName: tmpl.templateName, decisionPoints: dps } };
}

// ========== 内部函数 ==========

function _validateDocType(actual, expected) {
  if (!expected) return true; // 无期望类型 → 放行
  if (!actual) return true; // OCR未识别出类型 → 放行（信任用户上传）
  const a = actual.toLowerCase().replace(/[^a-z0-9]/g, '');
  const e = expected.toLowerCase().replace(/[^a-z0-9]/g, '');
  return a.includes(e) || e.includes(a);
}

async function _updateMilestone(processId, stageId, docId, updates) {
  const proc = await db.collection('user_processes').where({ _id: processId }).get();
  if (proc.data.length === 0) return;

  const milestones = (proc.data[0].milestones || []).map((m) => {
    if (m.stageId !== stageId) return m;
    return { ...m, ...updates, milestoneDocId: docId || m.milestoneDocId };
  });

  await db
    .collection('user_processes')
    .where({ _id: processId })
    .update({
      data: { milestones, updatedAt: db.serverDate() },
    });
}

async function _logAudit(openid, action, detail) {
  await db.collection('audit_logs').add({
    data: { _openid: openid, action, detail, engineVersion: '1.0.0', createdAt: db.serverDate() },
  });
}
