/**
 * 住港伴 — 阶段构建器
 * 统一的流程阶段工厂函数，供 path-select 和 process/index 共用
 *
 * P0-CR-02: 消除 path-select 和 process/index 中 20 行重复的 phase2 拆分逻辑
 */

/**
 * 将 phase2_onboarding 拆分为4个独立里程碑阶段
 * @param {Object} phase - 模板中的 phase 对象 (含 p.id, p.order, p.steps)
 * @returns {Array} 4个阶段定义对象
 */
function buildPhase2Stages(phase) {
  var order = phase.order || 2;
  var steps = phase.steps || [];
  var stepCount = steps.length;
  var chunk1 = Math.ceil(stepCount / 4) || 1;

  return [
    {
      id: 'phase2_material_prep',
      name: '材料准备',
      order: order * 10 + 1,
      isMilestone: true,
      milestoneDocType: '路径确认凭证',
      steps: steps.slice(0, chunk1)
    },
    {
      id: 'phase2_submission',
      name: '线上申请',
      order: order * 10 + 2,
      isMilestone: true,
      milestoneDocType: '递交回执/确认邮件',
      steps: steps.slice(chunk1, chunk1 * 2)
    },
    {
      id: 'phase2_awaiting',
      name: '等待获批',
      order: order * 10 + 3,
      isMilestone: true,
      milestoneDocType: '入境处受理回执',
      steps: []
    },
    {
      id: 'phase2_activation',
      name: '获批激活',
      order: order * 10 + 4,
      isMilestone: true,
      milestoneDocType: '签证/进入许可',
      steps: steps.slice(chunk1 * 2)
    }
  ];
}

/**
 * 判断是否为 phase2_onboarding（用于 templates.phases 遍历中的分支）
 * @param {Object} phase
 * @returns {boolean}
 */
function isPhase2Onboarding(phase) {
  var pid = phase.id || '';
  return pid === 'phase2_onboarding' || pid.includes('phase2_onboarding');
}

/**
 * 将阶段定义转换为流程线 stage 对象
 * @param {Object} ps - 阶段定义 { id, name, order, isMilestone, milestoneDocType, steps }
 * @param {string} phaseId - 所属数据层阶段ID
 * @param {boolean} isFirst - 是否为流程线中第一个阶段（决定初始状态）
 * @returns {Object} 流程线 stage 对象
 */
function toStageObject(ps, phaseId, isFirst) {
  return {
    stageId: ps.id,
    stageName: ps.name,
    order: ps.order,
    isMilestone: ps.isMilestone,
    milestoneDocType: ps.milestoneDocType,
    phaseId: phaseId,
    status: isFirst ? 'in_progress' : 'locked',
    steps: (ps.steps || []).map(function(st) {
      return { stepId: st.id || '', stepName: st.name || '', status: 'pending', completedAt: null };
    })
  };
}

/**
 * 自动完成 phase1 评估阶段，解锁下一个阶段
 * @param {Array} stages - 已构建的阶段数组
 */
function autoCompletePhase1(stages) {
  for (var si = 0; si < stages.length; si++) {
    var sid = stages[si].stageId || '';
    if (sid.includes('phase1') || sid.includes('evaluation')) {
      stages[si].status = 'completed';
      stages[si].steps = (stages[si].steps || []).map(function(st) {
        return Object.assign({}, st, { status: 'completed', completedAt: new Date().toISOString() });
      });
    } else if (stages[si].status === 'locked') {
      stages[si].status = 'in_progress';
      break;
    }
  }
}

module.exports = {
  buildPhase2Stages: buildPhase2Stages,
  isPhase2Onboarding: isPhase2Onboarding,
  toStageObject: toStageObject,
  autoCompletePhase1: autoCompletePhase1
};
