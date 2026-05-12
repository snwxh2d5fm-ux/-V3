/**
 * milestone-check.js — 流程控里程碑验证
 *
 * 效率宝预审通过后，检查文档是否具有里程碑角色，
 * 如果用户上传了里程碑文档且 P0 全部通过，
 * 则触发对应阶段解锁。
 *
 * 里程碑映射（UI 7阶段）：
 *   1. 资格评估     — 无需文档
 *   2. 材料准备     — 无需文档
 *   3. 线上申请     — DOC-0602 递交确认回执
 *   4. 等待获批     — 无需文档（状态等待）
 *   5. 获批激活     — DOC-0601 获批函 / DOC-0605 电子签证 / DOC-0701 小白条
 *   6. 抵港生活     — DOC-0103 香港身份证 / DOC-0801 香港银行卡
 *   7. 永居         — DOC-0612 永居核实结果 / DOC-0611 永居申请回执
 */

/**
 * 里程碑文档 → UI 阶段映射表
 */
var MILESTONE_STAGE_MAP = {
  'DOC-0601': { stage_ui: 5, name: '获批激活', trigger: '获批函上传+预审通过' },
  'DOC-0602': { stage_ui: 3, name: '线上申请', trigger: '递交回执上传+预审通过' },
  'DOC-0605': { stage_ui: 5, name: '获批激活', trigger: '电子签证上传+预审通过' },
  'DOC-0701': { stage_ui: 5, name: '获批激活', trigger: '小白条上传+预审通过' },
  'DOC-0609': { stage_ui: 3, name: '续签递交', trigger: '续签回执上传+预审通过' },
  'DOC-0611': { stage_ui: 7, name: '永居申请', trigger: '永居申请回执上传+预审通过' },
  'DOC-0612': { stage_ui: 7, name: '永居获批', trigger: '永居核实结果上传+预审通过' }
};

/**
 * 检查文档是否触发里程碑解锁
 * @param {string} docId - DOC-XXXX
 * @param {object} auditReport - 预审报告
 * @returns {object|null} 里程碑信息或 null
 */
function checkMilestone(docId, auditReport) {
  var mapping = MILESTONE_STAGE_MAP[docId];
  if (!mapping) return null;

  var overall = auditReport.status;
  var triggered = (overall === 'pass' || overall === 'warning' || overall === 'info');

  return {
    doc_id: docId,
    stage_ui: mapping.stage_ui,
    stage_name: mapping.name,
    trigger_condition: mapping.trigger,
    triggered: triggered,
    message: triggered
      ? '✓ 里程碑已达成：' + mapping.trigger + ' → 解锁「' + mapping.name + '」阶段'
      : '✗ 里程碑未达成：P0 阻断问题需先解决'
  };
}

/**
 * 获取所有里程碑文档在当前阶段的完成状态
 * @param {Array} completedDocs - 用户已上传且预审通过的文档列表
 * @returns {object} 各阶段解锁状态
 */
function getStageUnlockStatus(completedDocs) {
  var stages = {
    3: { name: '线上申请',     locked: true, milestone_doc_ids: ['DOC-0602'] },
    5: { name: '获批激活',     locked: true, milestone_doc_ids: ['DOC-0601', 'DOC-0605', 'DOC-0701'] },
    7: { name: '永居',         locked: true, milestone_doc_ids: ['DOC-0611', 'DOC-0612'] }
  };

  var docIds = completedDocs.map(function(d) { return d.doc_id; });

  for (var stage in stages) {
    var info = stages[stage];
    var requiredDocs = info.milestone_doc_ids;
    var hasMilestone = false;
    for (var i = 0; i < requiredDocs.length; i++) {
      if (docIds.indexOf(requiredDocs[i]) !== -1) {
        hasMilestone = true;
        break;
      }
    }
    info.locked = !hasMilestone;
  }

  return {
    stages: stages,
    // 当前应显示的最高解锁阶段
    current_stage: findCurrentStage(stages)
  };
}

function findCurrentStage(stages) {
  for (var s = 3; s <= 7; s++) {
    if (stages[s] && stages[s].locked) {
      return parseInt(s, 10);
    }
  }
  return 7; // 全部解锁
}

module.exports = {
  checkMilestone: checkMilestone,
  getStageUnlockStatus: getStageUnlockStatus,
  MILESTONE_STAGE_MAP: MILESTONE_STAGE_MAP
};
