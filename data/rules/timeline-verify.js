/**
 * 住港伴 — 提醒器时间线校验脚本
 * 验证六条路径 + 受养人的节点完整性、时长合理性、路径差异正确性
 */
const templates = require('./timeline-templates');
const engine = require('./timeline-engine');

const PATHS = ['qmas', 'ttps_a', 'ttps_b', 'ttps_c', 'asmtp', 'iang', 'dependent'];
const results = { passed: [], warnings: [], errors: [] };

function log(level, msg) {
  results[level].push(msg);
  console.log(`[${level.toUpperCase()}] ${msg}`);
}

// ═══ 1. 节点完整性检查 ═══
console.log('\n=== 1. Node Completeness ===');
PATHS.forEach((pathType) => {
  const t = templates.getTemplate(pathType);
  for (let phase = 1; phase <= 7; phase++) {
    const nodes = t.phases[`phase${phase}`] || [];
    if (nodes.length === 0) {
      log('errors', `${pathType}: Phase ${phase} has ZERO nodes`);
    }
    // Check each node has required fields
    nodes.forEach((node) => {
      if (!node.nodeId) log('errors', `${pathType}: Node in phase${phase} missing nodeId`);
      if (!node.nodeName) log('errors', `${pathType}: ${node.nodeId} missing nodeName`);
      if (!node.timeLogic) log('errors', `${pathType}: ${node.nodeId} missing timeLogic`);
      if (node.riskLevel && !['low', 'medium', 'high', 'critical'].includes(node.riskLevel)) {
        log('errors', `${pathType}: ${node.nodeId} invalid riskLevel: ${node.riskLevel}`);
      }
    });
  }
});
if (!results.errors.filter((e) => e.includes('ZERO nodes')).length) {
  log('passed', 'All paths have nodes in all 7 phases');
}

// ═══ 2. 路径差异正确性检查 ═══
console.log('\n=== 2. Path Differentiation ===');

// 优才独有赴港计划书
const qmas = templates.getTemplate('qmas');
const qmasNodeIds = qmas.phases.phase2.map((n) => n.nodeId);
if (qmasNodeIds.includes('QM-01') && qmasNodeIds.includes('QM-02')) {
  log('passed', 'QMAS: 赴港计划书节点(QM-01, QM-02)存在');
} else {
  log('errors', 'QMAS: 赴港计划书节点缺失');
}

// 高才A独有36月签证
const ttpsA = templates.getTemplate('ttps_a');
if (ttpsA.visaInfo.initialValidityMonths === 36) {
  log('passed', 'TTPS-A: 36月首次签证有效期正确');
} else {
  log('errors', `TTPS-A: 签证有效期应为36月，实际${ttpsA.visaInfo.initialValidityMonths}`);
}

// 高才C独有配额提醒
const ttpsC = templates.getTemplate('ttps_c');
const ttcPhase1Ids = ttpsC.phases.phase1.map((n) => n.nodeId);
if (ttcPhase1Ids.includes('TC-04')) {
  log('passed', 'TTPS-C: 配额检查节点(TC-04)存在');
} else {
  log('errors', 'TTPS-C: 配额检查节点(TC-04)缺失');
}

// 专才独有ID990B
const asmtp = templates.getTemplate('asmtp');
const asmtpPhase2Ids = asmtp.phases.phase2.map((n) => n.nodeId);
if (asmtpPhase2Ids.includes('AP-M04')) {
  log('passed', 'ASMTP: ID990B担保表格节点(AP-M04)存在');
} else {
  log('errors', 'ASMTP: ID990B节点缺失');
}

// IANG毕业后6月内免雇主
const iang = templates.getTemplate('iang');
if (iang.visaInfo.prepCycle === '1-2周') {
  log('passed', 'IANG: 材料准备周期1-2周(快速路径)');
}

// 受养人标记为依赖主申
const dep = templates.getTemplate('dependent');
if (dep.dependentOnSponsor === true) {
  log('passed', 'Dependent: dependentOnSponsor标记正确');
} else {
  log('errors', 'Dependent: 缺少dependentOnSponsor标记');
}

// ═══ 3. 阶段5/7共享验证 ═══
console.log('\n=== 3. Shared Phase Verification ===');
const sharedPhases = templates.getGenericPhaseNodes('phase5');
if (sharedPhases && sharedPhases.length === 11) {
  log('passed', `Phase 5: ${sharedPhases.length}个通用激活节点（预期11）`);
} else {
  log('warnings', `Phase 5: ${sharedPhases ? sharedPhases.length : 0}个节点（预期11）`);
}

const sharedPR = templates.getGenericPhaseNodes('phase7');
if (sharedPR && sharedPR.length === 10) {
  log('passed', `Phase 7: ${sharedPR.length}个通用永居节点（预期10）`);
} else {
  log('warnings', `Phase 7: ${sharedPR ? sharedPR.length : 0}个节点（预期10）`);
}

// ═══ 4. 续签差异验证 ═══
console.log('\n=== 4. Renewal Path Differentiation ===');
Object.entries(templates.PATH_SPECIFIC_RENEWAL_NODES).forEach(([path, nodes]) => {
  if (nodes && nodes.length > 0) {
    log('passed', `${path}: ${nodes.length}个路径专属续签节点`);
  } else {
    log('warnings', `${path}: 无专属续签节点`);
  }
});

// ═══ 5. 时间线引擎输出验证 ═══
console.log('\n=== 5. Engine Output Verification ===');
try {
  const testState = {
    currentPath: 'qmas',
    currentPhase: 2,
    anchorDates: {},
  };
  const timeline = engine.generateTimeline(testState);
  if (timeline.pathInfo && timeline.phases && timeline.summary) {
    log('passed', `Engine生成成功: ${timeline.summary.totalNodes}个节点, ${timeline.summary.completedNodes}已完成`);
    if (timeline.phases.phase5.nodes.length > 0) {
      log('passed', `Phase 5(共享)正确填充了${timeline.phases.phase5.nodes.length}个节点`);
    }
  } else {
    log('errors', 'Engine输出结构不完整');
  }
} catch (e) {
  log('errors', `Engine生成失败: ${e.message}`);
}

// ═══ 6. 重新校准验证 ═══
console.log('\n=== 6. Recalibration ===');
try {
  const baseState = {
    currentPath: 'ttps_b',
    currentPhase: 4,
    anchorDates: { submissionDate: '2026-05-01' },
    nodeStates: {},
  };
  const recalibrated = engine.recalibrateTimeline(baseState, {
    eventType: 'approval_received',
    eventDate: '2026-06-01',
  });
  if (recalibrated.anchorDates.approvalDate === '2026-06-01') {
    log('passed', '重新校准: 获批日期正确设置');
  }
  // 验证重新生成的时间线
  const recalTimeline = engine.generateTimeline(recalibrated);
  if (recalTimeline.phases.phase4.isCurrent) {
    log('passed', '重新校准后: Phase 4正确标识为当前阶段');
  }
} catch (e) {
  log('errors', `重新校准失败: ${e.message}`);
}

// ═══ 7. 永居7年计算验证 ═══
console.log('\n=== 7. PR 7-Year Calculation ===');
PATHS.forEach((pathType) => {
  try {
    const state = {
      currentPath: pathType,
      currentPhase: 7,
      anchorDates: { firstEntryDate: '2026-05-14' },
      nodeStates: {},
    };
    const tl = engine.generateTimeline(state);
    // PR-04 (7年期满) 应从 firstEntryDate + 7年计算
    const pr04 = tl.phases.phase7.nodes.find((n) => n.nodeId === 'PR-04');
    if (pr04 && pr04.targetDate) {
      const expected = new Date('2026-05-14');
      expected.setFullYear(expected.getFullYear() + 7);
      if (pr04.targetDate === expected.toISOString().split('T')[0]) {
        log('passed', `${pathType}: PR-04 7年期满日期正确(${pr04.targetDate})`);
      } else {
        log('errors', `${pathType}: PR-04 期望${expected.toISOString().split('T')[0]} 实际${pr04.targetDate}`);
      }
    }
  } catch (e) {
    log('errors', `${pathType}: PR计算失败 - ${e.message}`);
  }
});

// ═══ 8. 续签倒计时VED倒序验证 ═══
console.log('\n=== 8. VED Countdown Logic ===');
try {
  const state = {
    currentPath: 'qmas',
    currentPhase: 6,
    anchorDates: {
      approvalDate: '2025-01-01',
      firstEntryDate: '2025-03-01',
      ved: '2027-01-01',
    },
    nodeStates: {},
  };
  const tl = engine.generateTimeline(state);
  const phase6 = tl.phases.phase6.nodes;
  const rv01 = phase6.find((n) => n.nodeId === 'RV-01');
  const rv08 = phase6.find((n) => n.nodeId === 'RV-08');
  const rv10 = phase6.find((n) => n.nodeId === 'RV-10');

  if (rv01 && rv01.targetDate) {
    // RV-01应该在VED-180天
    const expected = new Date('2027-01-01');
    expected.setDate(expected.getDate() - 180);
    if (rv01.targetDate === expected.toISOString().split('T')[0]) {
      log('passed', `RV-01倒计时T-180天正确: ${rv01.targetDate}`);
    } else {
      log('errors', `RV-01期望${expected.toISOString().split('T')[0]} 实际${rv01.targetDate}`);
    }
  }

  if (rv08 && rv08.targetDate) {
    const expected = new Date('2027-01-01');
    expected.setDate(expected.getDate() - 30);
    if (rv08.targetDate === expected.toISOString().split('T')[0]) {
      log('passed', `RV-08倒计时T-30天正确: ${rv08.targetDate}`);
    }
  }

  if (rv10 && rv10.targetDate) {
    const expected = new Date('2027-01-01');
    if (rv10.targetDate === expected.toISOString().split('T')[0]) {
      log('passed', `RV-10倒计时T-0天(VED)正确: ${rv10.targetDate}`);
    }
  }
} catch (e) {
  log('errors', `VED倒计时验证失败: ${e.message}`);
}

// ═══ 汇总 ═══
console.log('\n=== VERIFICATION SUMMARY ===');
console.log(`✅ Passed:  ${results.passed.length}`);
console.log(`⚠️  Warnings: ${results.warnings.length}`);
console.log(`❌ Errors:   ${results.errors.length}`);

if (results.errors.length > 0) {
  console.log('\n--- ERRORS ---');
  results.errors.forEach((e) => console.log(`  ❌ ${e}`));
}
if (results.warnings.length > 0) {
  console.log('\n--- WARNINGS ---');
  results.warnings.forEach((w) => console.log(`  ⚠️  ${w}`));
}

process.exit(results.errors.length > 0 ? 1 : 0);
