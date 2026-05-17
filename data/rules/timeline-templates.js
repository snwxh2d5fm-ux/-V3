/**
 * 住港伴 v3.2 — 时间线模板库 (Timeline Template Library)
 * ============================================================
 * 定义六条身份路径的完整时间线节点。
 * 每条路径 = 7个阶段(phase1~phase7) × N个节点
 *
 * 使用方式:
 *   const templates = require('./timeline-templates');
 *   const qmasTemplate = templates.getTemplate('qmas');
 *   const phase2Nodes = qmasTemplate.phases.phase2;
 *
 * 更新: 2026-05-14 — 从reminders.js事件驱动模型升级为时间线模板模型
 */

// ═══════════════════════════════════════════════════════════════
// PHASE 5 获批激活 — 通用节点（所有路径共享）
// ═══════════════════════════════════════════════════════════════
const PHASE5_ACTIVATION_NODES = [
  {
    nodeId: 'AV-01',
    nodeName: '缴付签证费用',
    actionDescription: '收到获批通知后，在入境处系统缴付签证费用',
    timeLogic: { type: 'relative', anchorField: 'approvalDate', offsetDays: 0, estimatedDuration: '7天内' },
    triggerMaterials: [
      { materialType: 'official', materialName: '获批通知书', formatStandard: 'GD-APPROVAL-01' }
    ],
    prerequisites: [],
    riskLevel: 'medium',
    reminderSchedule: { milestones: [0, 3, 7], frequency: 'once' }
  },
  {
    nodeId: 'AV-02',
    nodeName: '下载/领取e-Visa',
    actionDescription: '缴费完成后下载电子签证(e-Visa)或领取签证标签',
    timeLogic: { type: 'event_driven', anchorField: 'feePaidDate', offsetDays: 0, estimatedDuration: '1-3天' },
    triggerMaterials: [
      { materialType: 'official', materialName: '缴费确认页', formatStandard: null }
    ],
    prerequisites: ['AV-01'],
    riskLevel: 'low',
    reminderSchedule: { milestones: [1, 3], frequency: 'once' }
  },
  {
    nodeId: 'AV-03',
    nodeName: '办理逗留D签注（如需）',
    actionDescription: '持e-Visa前往出入境管理局办理港澳通行证逗留D签注',
    timeLogic: { type: 'relative', anchorField: 'visaDownloadDate', offsetDays: 0, estimatedDuration: '2周内' },
    triggerMaterials: [
      { materialType: 'official', materialName: 'e-Visa打印件', formatStandard: null },
      { materialType: 'id', materialName: '港澳通行证(原件)', formatStandard: 'GD-PERMIT-01' }
    ],
    prerequisites: ['AV-02'],
    riskLevel: 'medium',
    reminderSchedule: { milestones: [1, 7, 14], frequency: 'once' }
  },
  {
    nodeId: 'AV-04',
    nodeName: '预订赴港行程',
    actionDescription: '预订赴港机票/车票，安排入境激活签证',
    timeLogic: { type: 'relative', anchorField: 'visaDownloadDate', offsetDays: 7, estimatedDuration: '获签后3个月内' },
    triggerMaterials: [],
    prerequisites: ['AV-02'],
    riskLevel: 'low',
    reminderSchedule: { milestones: [7, 14, 21], frequency: 'once' }
  },
  {
    nodeId: 'AV-05',
    nodeName: '入境激活签证（走人工通道）',
    actionDescription: '持e-Visa+港澳通行证+D签注入境香港，走人工通道激活签证',
    timeLogic: { type: 'relative', anchorField: 'approvalDate', offsetDays: 0, estimatedDuration: '获批后3个月内必须完成' },
    triggerMaterials: [
      { materialType: 'official', materialName: 'e-Visa打印件', formatStandard: null },
      { materialType: 'id', materialName: '港澳通行证', formatStandard: 'GD-PERMIT-01' }
    ],
    prerequisites: ['AV-03'],
    riskLevel: 'critical',
    reminderSchedule: { milestones: [90, 60, 30, 14, 7, 3, 1], frequency: 'monthly' }
  },
  {
    nodeId: 'AV-06',
    nodeName: '入境领取小白条（务必保管）',
    actionDescription: '入境香港时领取入境标签（小白条），必须永久保留',
    timeLogic: { type: 'event_driven', anchorField: 'activationDate', offsetDays: 0, estimatedDuration: '入境当天' },
    triggerMaterials: [
      { materialType: 'official', materialName: '小白条/入境标签', formatStandard: 'GD-SLIP-01' }
    ],
    prerequisites: ['AV-05'],
    riskLevel: 'critical',
    reminderSchedule: { milestones: [-1, 0], frequency: 'once' }
  },
  {
    nodeId: 'AV-07',
    nodeName: '预约香港身份证办理',
    actionDescription: '入境后尽快预约人事登记办事处办理香港身份证',
    timeLogic: { type: 'relative', anchorField: 'activationDate', offsetDays: 0, estimatedDuration: '入境后1周内预约' },
    triggerMaterials: [
      { materialType: 'official', materialName: '小白条', formatStandard: null },
      { materialType: 'official', materialName: 'e-Visa', formatStandard: null }
    ],
    prerequisites: ['AV-06'],
    riskLevel: 'high',
    reminderSchedule: { milestones: [0, 1, 3, 7], frequency: 'once' }
  },
  {
    nodeId: 'AV-08',
    nodeName: '现场办理香港身份证',
    actionDescription: '按预约时间到人事登记办事处现场办理身份证',
    timeLogic: { type: 'relative', anchorField: 'activationDate', offsetDays: 0, estimatedDuration: '入境后30天内必须完成' },
    triggerMaterials: [
      { materialType: 'id', materialName: '港澳通行证(原件)', formatStandard: 'GD-PERMIT-01' },
      { materialType: 'official', materialName: 'e-Visa打印件', formatStandard: null },
      { materialType: 'official', materialName: '小白条(原件)', formatStandard: null }
    ],
    prerequisites: ['AV-07'],
    riskLevel: 'high',
    reminderSchedule: { milestones: [30, 21, 14, 7, 3], frequency: 'once' }
  },
  {
    nodeId: 'AV-09',
    nodeName: '领取香港身份证（约10个工作日后）',
    actionDescription: '凭收据+港澳通行证领取香港身份证',
    timeLogic: { type: 'relative', anchorField: 'hkIdAppliedDate', offsetDays: 10, estimatedDuration: '办理后约10个工作日' },
    triggerMaterials: [
      { materialType: 'official', materialName: '身份证收据', formatStandard: null },
      { materialType: 'id', materialName: '港澳通行证', formatStandard: null }
    ],
    prerequisites: ['AV-08'],
    riskLevel: 'medium',
    reminderSchedule: { milestones: [7, 10, 14], frequency: 'once' }
  },
  {
    nodeId: 'AV-10',
    nodeName: '银行开户',
    actionDescription: '持香港身份证+通行证+住址证明到银行开立账户',
    timeLogic: { type: 'relative', anchorField: 'hkIdReceivedDate', offsetDays: 0, estimatedDuration: '领身份证后建议1个月内' },
    triggerMaterials: [
      { materialType: 'id', materialName: '香港身份证', formatStandard: null },
      { materialType: 'id', materialName: '港澳通行证', formatStandard: null },
      { materialType: 'proof', materialName: '住址证明(最近3月)', formatStandard: 'GD-ADDR-01' }
    ],
    prerequisites: ['AV-09'],
    riskLevel: 'low',
    reminderSchedule: { milestones: [7, 14, 30], frequency: 'once' }
  },
  {
    nodeId: 'AV-11',
    nodeName: 'MPF开户（如已就业）',
    actionDescription: '入职后雇主需在60天内为你开立强积金账户',
    timeLogic: { type: 'relative', anchorField: 'employmentStartDate', offsetDays: 0, estimatedDuration: '入职后60天内' },
    triggerMaterials: [
      { materialType: 'contract', materialName: '雇佣合约', formatStandard: null }
    ],
    prerequisites: [],
    riskLevel: 'medium',
    reminderSchedule: { milestones: [0, 14, 30, 60], frequency: 'once' }
  }
];

// ═══════════════════════════════════════════════════════════════
// PHASE 7 永居 — 通用节点（所有路径共享）
// ═══════════════════════════════════════════════════════════════
const PHASE7_PR_NODES = [
  {
    nodeId: 'PR-01',
    nodeName: '永居倒计时1年 — 开始整理7年记录',
    actionDescription: '整理7年期间的全部居住、工作、税务、MPF记录',
    timeLogic: { type: 'relative', anchorField: 'sevenYearDate', offsetDays: -365, estimatedDuration: '满6年时' },
    triggerMaterials: [],
    prerequisites: [],
    riskLevel: 'high',
    reminderSchedule: { milestones: [365, 270, 180, 90], frequency: 'quarterly' }
  },
  {
    nodeId: 'PR-02',
    nodeName: '永居倒计时半年 — 准备解释信材料',
    actionDescription: '整理离境记录，如有任一年离境>180天则准备解释信',
    timeLogic: { type: 'relative', anchorField: 'sevenYearDate', offsetDays: -180, estimatedDuration: '满6.5年时' },
    triggerMaterials: [
      { materialType: 'official', materialName: '7年出入境记录', formatStandard: null }
    ],
    prerequisites: ['PR-01'],
    riskLevel: 'high',
    reminderSchedule: { milestones: [180, 90, 60], frequency: 'monthly' }
  },
  {
    nodeId: 'PR-03',
    nodeName: '申请出入境记录',
    actionDescription: '向入境处申请完整的7年出入境记录',
    timeLogic: { type: 'relative', anchorField: 'sevenYearDate', offsetDays: -180, estimatedDuration: null },
    triggerMaterials: [],
    prerequisites: ['PR-02'],
    riskLevel: 'medium',
    reminderSchedule: { milestones: [180, 90], frequency: 'once' }
  },
  {
    nodeId: 'PR-04',
    nodeName: '7年期满确认',
    actionDescription: '确认已符合永居申请条件：通常居住满7年+无犯罪+签证无断档',
    timeLogic: { type: 'absolute', anchorField: 'sevenYearDate', offsetDays: 0, estimatedDuration: '满7年当天' },
    triggerMaterials: [],
    prerequisites: ['PR-03'],
    riskLevel: 'critical',
    reminderSchedule: { milestones: [0], frequency: 'once' }
  },
  {
    nodeId: 'PR-05',
    nodeName: '填写ROP145申请表',
    actionDescription: '启动永居核实申请，填写ROP145表格',
    timeLogic: { type: 'relative', anchorField: 'sevenYearDate', offsetDays: 0, estimatedDuration: '满7年后建议尽快' },
    triggerMaterials: [
      { materialType: 'official', materialName: 'ROP145申请表', formatStandard: null },
      { materialType: 'id', materialName: '香港身份证', formatStandard: null },
      { materialType: 'official', materialName: '7年签证记录', formatStandard: null }
    ],
    prerequisites: ['PR-04'],
    riskLevel: 'high',
    reminderSchedule: { milestones: [90, 60, 30], frequency: 'once' }
  },
  {
    nodeId: 'PR-06',
    nodeName: '递交永居核实申请',
    actionDescription: '递交ROP145表格+全部证明材料+缴付费用',
    timeLogic: { type: 'event_driven', anchorField: 'prFormCompletedDate', offsetDays: 0, estimatedDuration: null },
    triggerMaterials: [
      { materialType: 'official', materialName: 'ROP145表格(已填)', formatStandard: null },
      { materialType: 'proof', materialName: '7年居住证明', formatStandard: null },
      { materialType: 'proof', materialName: '7年MPF/税务记录', formatStandard: null }
    ],
    prerequisites: ['PR-05'],
    riskLevel: 'high',
    reminderSchedule: { milestones: [14, 7, 3], frequency: 'once' }
  },
  {
    nodeId: 'PR-07',
    nodeName: '永居面试通知',
    actionDescription: '等待入境处面试安排通知',
    timeLogic: { type: 'relative', anchorField: 'prSubmittedDate', offsetDays: 14, estimatedDuration: '递交后约2-6周' },
    triggerMaterials: [],
    prerequisites: ['PR-06'],
    riskLevel: 'medium',
    reminderSchedule: { milestones: [14, 28, 42], frequency: 'once' }
  },
  {
    nodeId: 'PR-08',
    nodeName: '永居面试',
    actionDescription: '按预约时间参加永居面试',
    timeLogic: { type: 'event_driven', anchorField: 'prInterviewDate', offsetDays: 0, estimatedDuration: null },
    triggerMaterials: [
      { materialType: 'id', materialName: '香港身份证(原件)', formatStandard: null },
      { materialType: 'official', materialName: '面试通知信', formatStandard: null }
    ],
    prerequisites: ['PR-07'],
    riskLevel: 'high',
    reminderSchedule: { milestones: [14, 7, 3, 1], frequency: 'once' }
  },
  {
    nodeId: 'PR-09',
    nodeName: '永居获批 — 办理永久居民身份证',
    actionDescription: '永居核实通过，办理香港永久居民身份证',
    timeLogic: { type: 'event_driven', anchorField: 'prApprovedDate', offsetDays: 0, estimatedDuration: null },
    triggerMaterials: [
      { materialType: 'official', materialName: '永居获批通知书', formatStandard: null }
    ],
    prerequisites: ['PR-08'],
    riskLevel: 'low',
    reminderSchedule: { milestones: [0, 7, 14], frequency: 'once' }
  },
  {
    nodeId: 'PR-10',
    nodeName: '申请香港特区护照',
    actionDescription: '持永久居民身份证申请香港特区护照',
    timeLogic: { type: 'relative', anchorField: 'prApprovedDate', offsetDays: 0, estimatedDuration: '获得永居后' },
    triggerMaterials: [
      { materialType: 'id', materialName: '永久居民身份证', formatStandard: null }
    ],
    prerequisites: ['PR-09'],
    riskLevel: 'low',
    reminderSchedule: { milestones: [30, 60], frequency: 'once' }
  }
];

// ═══════════════════════════════════════════════════════════════
// 各路径专有节点定义
// ═══════════════════════════════════════════════════════════════

/**
 * 优才(QMAS) — Phase 1: 资格评估
 */
var QMAS_PHASE1 = [
  { nodeId: 'QE-01', nodeName: '12项准则自评', actionDescription: '对照入境处12项准则逐项自评', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 0, estimatedDuration: '建议1周内' }, triggerMaterials: [{ materialType: 'edu', materialName: '学历证书扫描', formatStandard: null }], prerequisites: [], riskLevel: 'low', reminderSchedule: { milestones: [7, 3], frequency: 'once' } },
  { nodeId: 'QE-02', nodeName: '确定计分制类型', actionDescription: '成就计分制 vs 综合计分制 — 根据自评结果确定', timeLogic: { type: 'event_driven', anchorField: 'QE01Completed', offsetDays: 0, estimatedDuration: null }, triggerMaterials: [], prerequisites: ['QE-01'], riskLevel: 'low', reminderSchedule: { milestones: [7], frequency: 'once' } },
  { nodeId: 'QE-03', nodeName: '确认是否满足≥6项准则', actionDescription: '综合计分制需满足12项准则中≥6项', timeLogic: { type: 'event_driven', anchorField: 'QE02Completed', offsetDays: 0, estimatedDuration: null }, triggerMaterials: [], prerequisites: ['QE-02'], riskLevel: 'critical', reminderSchedule: { milestones: [7, 3], frequency: 'once' } },
  { nodeId: 'QE-04', nodeName: '评估报告生成', actionDescription: '系统生成详细评估报告', timeLogic: { type: 'event_driven', anchorField: 'QE03Completed', offsetDays: 0, estimatedDuration: null }, triggerMaterials: [], prerequisites: ['QE-03'], riskLevel: 'medium', reminderSchedule: { milestones: [3], frequency: 'once' } },
  { nodeId: 'QE-05', nodeName: '启动材料准备', actionDescription: '确认评估通过，进入材料准备阶段', timeLogic: { type: 'event_driven', anchorField: 'QE04Completed', offsetDays: 0, estimatedDuration: null }, triggerMaterials: [], prerequisites: ['QE-04'], riskLevel: 'low', reminderSchedule: { milestones: [7], frequency: 'once' } }
];

/**
 * 优才(QMAS) — Phase 2: 材料准备
 */
var QMAS_PHASE2 = [
  { nodeId: 'QM-01', nodeName: '赴港计划书初稿', actionDescription: '撰写赴港计划书(500-800字)，含个人成就+赴港计划+对港贡献', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 3, estimatedDuration: '1-2周' }, triggerMaterials: [], prerequisites: [], riskLevel: 'critical', reminderSchedule: { milestones: [14, 7, 3], frequency: 'once' } },
  { nodeId: 'QM-02', nodeName: '赴港计划书定稿', actionDescription: '修改完善计划书，最终定稿', timeLogic: { type: 'event_driven', anchorField: 'QM01Completed', offsetDays: 0, estimatedDuration: '1周' }, triggerMaterials: [{ materialType: 'document', materialName: '赴港计划书定稿', formatStandard: '中文或英文，结构完整，含个人成就+赴港计划+对港贡献' }], prerequisites: ['QM-01'], riskLevel: 'critical', reminderSchedule: { milestones: [7, 3, 1], frequency: 'once' } },
  { nodeId: 'QM-03', nodeName: '学历证明准备', actionDescription: '准备学位证+成绩单+学历认证', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 3, estimatedDuration: '1周' }, triggerMaterials: [{ materialType: 'edu', materialName: '学位证书', formatStandard: 'GD-DEGREE-01' }, { materialType: 'edu', materialName: '成绩单', formatStandard: '中英文双语' }, { materialType: 'edu', materialName: '学历认证', formatStandard: '学信网认证/公证处公证' }], prerequisites: [], riskLevel: 'high', reminderSchedule: { milestones: [7, 3], frequency: 'once' } },
  { nodeId: 'QM-04', nodeName: '工作证明准备', actionDescription: '准备在职证明+离职证明(如有)+推荐信', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 3, estimatedDuration: '2周' }, triggerMaterials: [{ materialType: 'work', materialName: '在职证明', formatStandard: '公司信纸+公章+日期' }, { materialType: 'work', materialName: '推荐信', formatStandard: '信纸+签名+联系方式+日期' }], prerequisites: [], riskLevel: 'high', reminderSchedule: { milestones: [14, 7, 3], frequency: 'once' } },
  { nodeId: 'QM-05', nodeName: '推荐信收集', actionDescription: '向前雇主/现雇主索取推荐信×2', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 3, estimatedDuration: '2-3周' }, triggerMaterials: [{ materialType: 'work', materialName: '雇主推荐信', formatStandard: '公司信纸+签名+联系方式+日期+职位描述' }], prerequisites: [], riskLevel: 'high', reminderSchedule: { milestones: [21, 14, 7], frequency: 'once' } },
  { nodeId: 'QM-06', nodeName: '资产证明准备', actionDescription: '准备银行流水+房产证+股票账户等资产证明', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 7, estimatedDuration: '1周' }, triggerMaterials: [{ materialType: 'financial', materialName: '银行流水', formatStandard: '最近6-12个月+银行盖章' }], prerequisites: [], riskLevel: 'low', reminderSchedule: { milestones: [7, 3], frequency: 'once' } },
  { nodeId: 'QM-07', nodeName: '语言能力证明', actionDescription: '准备语言考试成绩单(如适用)', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 3, estimatedDuration: '1周' }, triggerMaterials: [{ materialType: 'certificate', materialName: '语言成绩单', formatStandard: '雅思/托福/CET，2年内有效' }], prerequisites: [], riskLevel: 'medium', reminderSchedule: { milestones: [7, 3], frequency: 'once' } },
  { nodeId: 'QM-08', nodeName: '无犯罪记录证明', actionDescription: '到公安局申请无犯罪记录证明', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 7, estimatedDuration: '2-4周' }, triggerMaterials: [{ materialType: 'official', materialName: '无犯罪记录证明', formatStandard: '6个月内有效' }], prerequisites: [], riskLevel: 'medium', reminderSchedule: { milestones: [28, 14, 7], frequency: 'once' } },
  { nodeId: 'QM-09', nodeName: '港澳通行证检查', actionDescription: '检查港澳通行证有效期是否≥1年', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 1, estimatedDuration: '1天' }, triggerMaterials: [{ materialType: 'id', materialName: '港澳通行证', formatStandard: 'GD-PERMIT-01' }], prerequisites: [], riskLevel: 'medium', reminderSchedule: { milestones: [1], frequency: 'once' } },
  { nodeId: 'QM-10', nodeName: '材料完整性自查', actionDescription: '对照入境处材料清单逐项核查', timeLogic: { type: 'event_driven', anchorField: 'QMAllPrepared', offsetDays: 0, estimatedDuration: '1-2天' }, triggerMaterials: [], prerequisites: ['QM-01', 'QM-02', 'QM-03', 'QM-04', 'QM-05', 'QM-06', 'QM-07', 'QM-08', 'QM-09'], riskLevel: 'high', reminderSchedule: { milestones: [2, 1], frequency: 'once' } }
];

/**
 * 优才(QMAS) — Phase 3: 线上申请
 */
var QMAS_PHASE3 = [
  { nodeId: 'OL-01', nodeName: '注册/登录入境处在线系统', actionDescription: '在入境处官网注册账户或登录已有账户', timeLogic: { type: 'event_driven', anchorField: 'QM10Completed', offsetDays: 0, estimatedDuration: '当天' }, triggerMaterials: [{ materialType: 'info', materialName: '个人电邮+手机号', formatStandard: null }], prerequisites: ['QM-10'], riskLevel: 'low', reminderSchedule: { milestones: [1], frequency: 'once' } },
  { nodeId: 'QM-OL-01', nodeName: '赴港计划书系统填报', actionDescription: '在入境处系统中填报赴港计划书内容', timeLogic: { type: 'event_driven', anchorField: 'OL01Completed', offsetDays: 0, estimatedDuration: '与申请表填写同步' }, triggerMaterials: [{ materialType: 'document', materialName: '赴港计划书定稿', formatStandard: '待填入系统对应栏目' }], prerequisites: ['OL-01', 'QM-02'], riskLevel: 'critical', reminderSchedule: { milestones: [3, 1], frequency: 'once' } },
  { nodeId: 'OL-02', nodeName: '填写申请表', actionDescription: '完整填写入境处申请表全部字段', timeLogic: { type: 'event_driven', anchorField: 'OL01Completed', offsetDays: 0, estimatedDuration: '1-2小时' }, triggerMaterials: [], prerequisites: ['OL-01'], riskLevel: 'high', reminderSchedule: { milestones: [3, 1], frequency: 'once' } },
  { nodeId: 'OL-03', nodeName: '上传材料扫描件', actionDescription: '将Phase 2准备的各项材料扫描件上传至系统', timeLogic: { type: 'event_driven', anchorField: 'OL02Completed', offsetDays: 0, estimatedDuration: '1-2小时' }, triggerMaterials: [], prerequisites: ['OL-02', 'QM-OL-01'], riskLevel: 'critical', reminderSchedule: { milestones: [3, 1], frequency: 'once' } },
  { nodeId: 'OL-04', nodeName: '缴付申请费用', actionDescription: '通过在线支付缴付申请费', timeLogic: { type: 'event_driven', anchorField: 'OL03Completed', offsetDays: 0, estimatedDuration: '当天' }, triggerMaterials: [], prerequisites: ['OL-03'], riskLevel: 'low', reminderSchedule: { milestones: [1], frequency: 'once' } },
  { nodeId: 'OL-05', nodeName: '确认提交', actionDescription: '最终核对后确认提交申请', timeLogic: { type: 'event_driven', anchorField: 'OL04Completed', offsetDays: 0, estimatedDuration: null }, triggerMaterials: [], prerequisites: ['OL-04'], riskLevel: 'critical', reminderSchedule: { milestones: [1, 0], frequency: 'once' } }
];

// ═══════════════════════════════════════════════════════════════
// 路径模板定义
// ═══════════════════════════════════════════════════════════════

const PATH_TEMPLATES = {
  qmas: {
    pathType: 'qmas',
    pathName: '优才计划',
    visaInfo: {
      initialValidityMonths: 24,
      activationDeadlineDays: 90,
      renewalPattern: '2+3+3',
      renewalCoreCondition: '通常居住（不需要在港就业）',
      approvalCycle: '6-12个月',
      prepCycle: '4-8周'
    },
    uniqueFeatures: ['赴港计划书', '12项准则评分', '较长审批周期(6-12月)'],
    phases: {
      phase1: [...QMAS_PHASE1],
      phase2: [...QMAS_PHASE2],
      phase3: [...QMAS_PHASE3],
      phase4: [], // 待从通用库填充
      phase5: PHASE5_ACTIVATION_NODES,
      phase6: [], // 续签节点: VED倒计时+优才专属居住监控
      phase7: PHASE7_PR_NODES
    },
    sharedPhases: ['phase5', 'phase7']
  },

  ttps_a: {
    pathType: 'ttps_a',
    pathName: '高才通A类',
    visaInfo: {
      initialValidityMonths: 36,
      activationDeadlineDays: 90,
      renewalPattern: '3+3+2',
      renewalCoreCondition: '在港就业或创业，收入≥市场中位数',
      approvalCycle: '约4周',
      prepCycle: '2-4周'
    },
    uniqueFeatures: ['年收入≥250万港币', '36月超长首签', '无需学历'],
    phases: {
      phase1: [
        { nodeId: 'TA-01', nodeName: '确认年收入≥250万港币', actionDescription: '核实最近一年应纳税收入≥250万港币', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 0, estimatedDuration: '1周' }, triggerMaterials: [{ materialType: 'financial', materialName: '最近一年税单', formatStandard: 'GD-TAX-01' }], prerequisites: [], riskLevel: 'critical', reminderSchedule: { milestones: [7, 3], frequency: 'once' } },
        { nodeId: 'TA-02', nodeName: '确认收入来源合规（已纳税）', actionDescription: '确认250万收入来源合法且在所在地已纳税', timeLogic: { type: 'event_driven', anchorField: 'TA01Completed', offsetDays: 0, estimatedDuration: null }, triggerMaterials: [{ materialType: 'financial', materialName: '完税证明+银行流水', formatStandard: '税务局+银行盖章' }], prerequisites: ['TA-01'], riskLevel: 'critical', reminderSchedule: { milestones: [7, 3], frequency: 'once' } },
        { nodeId: 'TA-03', nodeName: '评估报告生成', actionDescription: '系统生成详细评估报告', timeLogic: { type: 'event_driven', anchorField: 'TA02Completed', offsetDays: 0, estimatedDuration: null }, triggerMaterials: [], prerequisites: ['TA-02'], riskLevel: 'medium', reminderSchedule: { milestones: [3], frequency: 'once' } },
        { nodeId: 'TA-04', nodeName: '启动材料准备', actionDescription: '确认评估通过，进入材料准备阶段', timeLogic: { type: 'event_driven', anchorField: 'TA03Completed', offsetDays: 0, estimatedDuration: null }, triggerMaterials: [], prerequisites: ['TA-03'], riskLevel: 'low', reminderSchedule: { milestones: [7], frequency: 'once' } }
      ],
      phase2: [
        { nodeId: 'TA-M01', nodeName: '收入证明材料整理', actionDescription: '准备最近12个月银行流水+税单', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 3, estimatedDuration: '1周' }, triggerMaterials: [{ materialType: 'financial', materialName: '最近12个月银行流水', formatStandard: '银行盖章' }, { materialType: 'financial', materialName: '最近年度完税证明', formatStandard: '税务局出具' }], prerequisites: [], riskLevel: 'critical', reminderSchedule: { milestones: [7, 3], frequency: 'once' } },
        { nodeId: 'TA-M02', nodeName: '公司年薪证明信', actionDescription: '请公司出具年薪证明信', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 3, estimatedDuration: '1周' }, triggerMaterials: [{ materialType: 'work', materialName: '公司年薪证明信', formatStandard: '公司信纸+公章+金额明确' }], prerequisites: [], riskLevel: 'high', reminderSchedule: { milestones: [7, 3], frequency: 'once' } },
        { nodeId: 'TA-M03', nodeName: '纳税证明', actionDescription: '核实最近年度完税情况', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 3, estimatedDuration: '1-2周' }, triggerMaterials: [{ materialType: 'financial', materialName: '最近年度完税证明', formatStandard: '税务局出具' }], prerequisites: [], riskLevel: 'critical', reminderSchedule: { milestones: [14, 7, 3], frequency: 'once' } },
        { nodeId: 'TA-M04', nodeName: '港澳通行证检查', actionDescription: '检查有效期是否≥1年', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 1, estimatedDuration: '1天' }, triggerMaterials: [{ materialType: 'id', materialName: '港澳通行证', formatStandard: 'GD-PERMIT-01' }], prerequisites: [], riskLevel: 'medium', reminderSchedule: { milestones: [1], frequency: 'once' } },
        { nodeId: 'TA-M05', nodeName: '学历证明（辅助加分项）', actionDescription: '非必需但建议提交', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 3, estimatedDuration: '1周' }, triggerMaterials: [{ materialType: 'edu', materialName: '最高学位证书', formatStandard: null }], prerequisites: [], riskLevel: 'low', reminderSchedule: { milestones: [7], frequency: 'once' } },
        { nodeId: 'TA-M06', nodeName: '材料完整性自查', actionDescription: '逐项核对', timeLogic: { type: 'event_driven', anchorField: 'TAMAllPrepared', offsetDays: 0, estimatedDuration: '1天' }, triggerMaterials: [], prerequisites: ['TA-M01', 'TA-M02', 'TA-M03', 'TA-M04', 'TA-M05'], riskLevel: 'high', reminderSchedule: { milestones: [1], frequency: 'once' } }
      ],
      phase3: [], // 通用线上申请流程
      phase4: [],
      phase5: PHASE5_ACTIVATION_NODES,
      phase6: [],
      phase7: PHASE7_PR_NODES
    },
    sharedPhases: ['phase3', 'phase5', 'phase7']
  },

  ttps_b: {
    pathType: 'ttps_b',
    pathName: '高才通B类',
    visaInfo: {
      initialValidityMonths: 24,
      activationDeadlineDays: 90,
      renewalPattern: '2+3+3',
      renewalCoreCondition: '在港就业或创业',
      approvalCycle: '约4周',
      prepCycle: '2-3周'
    },
    uniqueFeatures: ['合资格大学学士+3年工作经验', '审批快'],
    phases: {
      phase1: [
        { nodeId: 'TB-01', nodeName: '确认学士学位来自合资格大学', actionDescription: '核实学位颁发院校在入境处合资格大学名单内', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 0, estimatedDuration: '1天' }, triggerMaterials: [{ materialType: 'edu', materialName: '学士学位证书', formatStandard: 'GD-DEGREE-01' }], prerequisites: [], riskLevel: 'critical', reminderSchedule: { milestones: [3], frequency: 'once' } },
        { nodeId: 'TB-02', nodeName: '确认毕业≤5年', actionDescription: '确认学士学位授予日期在5年内', timeLogic: { type: 'event_driven', anchorField: 'TB01Completed', offsetDays: 0, estimatedDuration: null }, triggerMaterials: [{ materialType: 'edu', materialName: '学位证(含授予日期)', formatStandard: null }], prerequisites: ['TB-01'], riskLevel: 'high', reminderSchedule: { milestones: [3], frequency: 'once' } },
        { nodeId: 'TB-03', nodeName: '确认≥3年工作经验', actionDescription: '确认累计3年以上工作经验', timeLogic: { type: 'event_driven', anchorField: 'TB02Completed', offsetDays: 0, estimatedDuration: null }, triggerMaterials: [{ materialType: 'work', materialName: '工作证明+履历', formatStandard: '需覆盖≥3年' }], prerequisites: ['TB-02'], riskLevel: 'high', reminderSchedule: { milestones: [7], frequency: 'once' } },
        { nodeId: 'TB-04', nodeName: '评估报告生成', actionDescription: '系统生成评估报告', timeLogic: { type: 'event_driven', anchorField: 'TB03Completed', offsetDays: 0, estimatedDuration: null }, triggerMaterials: [], prerequisites: ['TB-03'], riskLevel: 'low', reminderSchedule: { milestones: [3], frequency: 'once' } },
        { nodeId: 'TB-05', nodeName: '启动材料准备', actionDescription: '确认评估通过', timeLogic: { type: 'event_driven', anchorField: 'TB04Completed', offsetDays: 0, estimatedDuration: null }, triggerMaterials: [], prerequisites: ['TB-04'], riskLevel: 'low', reminderSchedule: { milestones: [7], frequency: 'once' } }
      ],
      phase2: [
        { nodeId: 'TB-M01', nodeName: '学历证明', actionDescription: '准备学士学位证+成绩单', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 3, estimatedDuration: '1周' }, triggerMaterials: [{ materialType: 'edu', materialName: '学士学位证+成绩单', formatStandard: '合资格大学学士' }], prerequisites: [], riskLevel: 'critical', reminderSchedule: { milestones: [7, 3], frequency: 'once' } },
        { nodeId: 'TB-M02', nodeName: '工作经验证明', actionDescription: '准备工作证明+劳动合同(覆盖≥3年)', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 3, estimatedDuration: '1-2周' }, triggerMaterials: [{ materialType: 'work', materialName: '工作证明+劳动合同', formatStandard: '需覆盖≥3年' }], prerequisites: [], riskLevel: 'high', reminderSchedule: { milestones: [14, 7, 3], frequency: 'once' } },
        { nodeId: 'TB-M03', nodeName: '港澳通行证检查', actionDescription: '有效期检查', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 1, estimatedDuration: '1天' }, triggerMaterials: [{ materialType: 'id', materialName: '港澳通行证', formatStandard: 'GD-PERMIT-01' }], prerequisites: [], riskLevel: 'low', reminderSchedule: { milestones: [1], frequency: 'once' } },
        { nodeId: 'TB-M04', nodeName: '无犯罪记录证明', actionDescription: '公安局出具', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 5, estimatedDuration: '2-4周' }, triggerMaterials: [{ materialType: 'official', materialName: '无犯罪记录证明', formatStandard: '6个月内有效' }], prerequisites: [], riskLevel: 'medium', reminderSchedule: { milestones: [28, 14, 7], frequency: 'once' } },
        { nodeId: 'TB-M05', nodeName: '材料完整性自查', actionDescription: '逐项核对', timeLogic: { type: 'event_driven', anchorField: 'TBMAllPrepared', offsetDays: 0, estimatedDuration: '1天' }, triggerMaterials: [], prerequisites: ['TB-M01', 'TB-M02', 'TB-M03', 'TB-M04'], riskLevel: 'high', reminderSchedule: { milestones: [1], frequency: 'once' } }
      ],
      phase3: [],
      phase4: [],
      phase5: PHASE5_ACTIVATION_NODES,
      phase6: [],
      phase7: PHASE7_PR_NODES
    },
    sharedPhases: ['phase3', 'phase5', 'phase7']
  },

  ttps_c: {
    pathType: 'ttps_c',
    pathName: '高才通C类',
    visaInfo: {
      initialValidityMonths: 24,
      activationDeadlineDays: 90,
      renewalPattern: '2+3+3',
      renewalCoreCondition: '在港就业或创业',
      approvalCycle: '约4周',
      prepCycle: '2-3周'
    },
    uniqueFeatures: ['合资格大学学士+<3年经验', '年度配额10,000名', '一生仅一次申请机会', '先到先得'],
    phases: {
      phase1: [
        { nodeId: 'TC-01', nodeName: '确认学士学位来自合资格大学', actionDescription: '核实学位颁发院校在名单内', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 0, estimatedDuration: '1天' }, triggerMaterials: [{ materialType: 'edu', materialName: '学士学位证书', formatStandard: 'GD-DEGREE-01' }], prerequisites: [], riskLevel: 'critical', reminderSchedule: { milestones: [3], frequency: 'once' } },
        { nodeId: 'TC-02', nodeName: '确认毕业≤5年', actionDescription: '确认授予日期在5年内', timeLogic: { type: 'event_driven', anchorField: 'TC01Completed', offsetDays: 0, estimatedDuration: null }, triggerMaterials: [{ materialType: 'edu', materialName: '学位证(含授予日期)', formatStandard: null }], prerequisites: ['TC-01'], riskLevel: 'high', reminderSchedule: { milestones: [3], frequency: 'once' } },
        { nodeId: 'TC-03', nodeName: '确认工作经验<3年', actionDescription: 'C类要求工作经验不足3年', timeLogic: { type: 'event_driven', anchorField: 'TC02Completed', offsetDays: 0, estimatedDuration: null }, triggerMaterials: [], prerequisites: ['TC-02'], riskLevel: 'low', reminderSchedule: { milestones: [3], frequency: 'once' } },
        { nodeId: 'TC-04', nodeName: '检查年度配额剩余', actionDescription: '查询入境处高才C年度配额使用情况(10,000名/年)', timeLogic: { type: 'event_driven', anchorField: 'TC03Completed', offsetDays: 0, estimatedDuration: '持续关注' }, triggerMaterials: [], prerequisites: ['TC-03'], riskLevel: 'critical', reminderSchedule: { milestones: [90, 60, 30, 14, 7], frequency: 'weekly' } },
        { nodeId: 'TC-05', nodeName: '评估报告生成', actionDescription: '系统生成评估报告', timeLogic: { type: 'event_driven', anchorField: 'TC04Completed', offsetDays: 0, estimatedDuration: null }, triggerMaterials: [], prerequisites: ['TC-04'], riskLevel: 'low', reminderSchedule: { milestones: [3], frequency: 'once' } },
        { nodeId: 'TC-06', nodeName: '启动材料准备（配额充足时尽早）', actionDescription: '确认评估，如配额充足则立即启动', timeLogic: { type: 'event_driven', anchorField: 'TC05Completed', offsetDays: 0, estimatedDuration: null }, triggerMaterials: [], prerequisites: ['TC-05'], riskLevel: 'high', reminderSchedule: { milestones: [1], frequency: 'once' } }
      ],
      phase2: [
        { nodeId: 'TC-M01', nodeName: '学历证明', actionDescription: '学士学位证+成绩单', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 1, estimatedDuration: '1周' }, triggerMaterials: [{ materialType: 'edu', materialName: '学士学位证+成绩单', formatStandard: '合资格大学学士+毕业≤5年' }], prerequisites: [], riskLevel: 'critical', reminderSchedule: { milestones: [7, 3], frequency: 'once' } },
        { nodeId: 'TC-M02', nodeName: '配额确认（持续关注）', actionDescription: '查询入境处配额使用情况，先到先得', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 1, estimatedDuration: '持续' }, triggerMaterials: [], prerequisites: [], riskLevel: 'critical', reminderSchedule: { milestones: [30, 14, 7, 3, 1], frequency: 'weekly' } },
        { nodeId: 'TC-M03', nodeName: '港澳通行证检查', actionDescription: '有效期检查', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 1, estimatedDuration: '1天' }, triggerMaterials: [{ materialType: 'id', materialName: '港澳通行证', formatStandard: 'GD-PERMIT-01' }], prerequisites: [], riskLevel: 'low', reminderSchedule: { milestones: [1], frequency: 'once' } },
        { nodeId: 'TC-M04', nodeName: '材料完整性自查', actionDescription: '逐项核对，配额充足时立即提交', timeLogic: { type: 'event_driven', anchorField: 'TCMAllPrepared', offsetDays: 0, estimatedDuration: '1天' }, triggerMaterials: [], prerequisites: ['TC-M01', 'TC-M02', 'TC-M03'], riskLevel: 'critical', reminderSchedule: { milestones: [1], frequency: 'once' } }
      ],
      phase3: [],
      phase4: [],
      phase5: PHASE5_ACTIVATION_NODES,
      phase6: [],
      phase7: PHASE7_PR_NODES
    },
    sharedPhases: ['phase3', 'phase5', 'phase7']
  },

  asmtp: {
    pathType: 'asmtp',
    pathName: '专才计划',
    visaInfo: {
      initialValidityMonths: 24,
      activationDeadlineDays: 90,
      renewalPattern: '随雇佣期',
      renewalCoreCondition: '雇主持续sponsor（转工需重新申请）',
      approvalCycle: '4-6周',
      prepCycle: '4-6周(含雇主侧)'
    },
    uniqueFeatures: ['雇主sponsor必需', 'ID990B担保表格', '转工需重新申请'],
    phases: {
      phase1: [
        { nodeId: 'AP-01', nodeName: '确认香港雇主sponsor资格', actionDescription: '核实雇主商业登记证+公司状态', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 0, estimatedDuration: '1周' }, triggerMaterials: [{ materialType: 'company', materialName: '雇主商业登记证(BR)', formatStandard: '有效期内' }], prerequisites: [], riskLevel: 'critical', reminderSchedule: { milestones: [7], frequency: 'once' } },
        { nodeId: 'AP-02', nodeName: '确认职位无法由本地人填补', actionDescription: '准备招聘记录+职位描述证明', timeLogic: { type: 'event_driven', anchorField: 'AP01Completed', offsetDays: 0, estimatedDuration: null }, triggerMaterials: [{ materialType: 'company', materialName: '招聘记录+职位描述', formatStandard: null }], prerequisites: ['AP-01'], riskLevel: 'high', reminderSchedule: { milestones: [7], frequency: 'once' } },
        { nodeId: 'AP-03', nodeName: '确认个人学历/经验匹配', actionDescription: '匹配职位要求与个人资历', timeLogic: { type: 'event_driven', anchorField: 'AP02Completed', offsetDays: 0, estimatedDuration: null }, triggerMaterials: [{ materialType: 'edu', materialName: '学历证明', formatStandard: null }, { materialType: 'work', materialName: '工作证明', formatStandard: null }], prerequisites: ['AP-02'], riskLevel: 'high', reminderSchedule: { milestones: [7], frequency: 'once' } },
        { nodeId: 'AP-04', nodeName: '雇主签署ID990B担保表格', actionDescription: '请雇主填写并签署ID990B表格', timeLogic: { type: 'event_driven', anchorField: 'AP03Completed', offsetDays: 0, estimatedDuration: null }, triggerMaterials: [{ materialType: 'official', materialName: 'ID990B表格(雇主填)', formatStandard: '雇主签名+公司盖章' }], prerequisites: ['AP-03'], riskLevel: 'critical', reminderSchedule: { milestones: [14, 7, 3], frequency: 'once' } },
        { nodeId: 'AP-05', nodeName: '评估报告生成', actionDescription: '系统生成评估报告', timeLogic: { type: 'event_driven', anchorField: 'AP04Completed', offsetDays: 0, estimatedDuration: null }, triggerMaterials: [], prerequisites: ['AP-04'], riskLevel: 'low', reminderSchedule: { milestones: [3], frequency: 'once' } },
        { nodeId: 'AP-06', nodeName: '启动材料准备', actionDescription: '确认雇主侧材料齐备', timeLogic: { type: 'event_driven', anchorField: 'AP05Completed', offsetDays: 0, estimatedDuration: null }, triggerMaterials: [], prerequisites: ['AP-05'], riskLevel: 'low', reminderSchedule: { milestones: [7], frequency: 'once' } }
      ],
      phase2: [
        { nodeId: 'AP-M01', nodeName: '个人学历+工作证明', actionDescription: '准备对应职位要求的学历工作证明', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 3, estimatedDuration: '1-2周' }, triggerMaterials: [{ materialType: 'edu', materialName: '学位证', formatStandard: null }, { materialType: 'work', materialName: '工作证明推荐信', formatStandard: null }], prerequisites: [], riskLevel: 'high', reminderSchedule: { milestones: [14, 7], frequency: 'once' } },
        { nodeId: 'AP-M02', nodeName: '雇主商业登记证', actionDescription: '获取雇主BR+CI+NAR1年报', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 3, estimatedDuration: '1周' }, triggerMaterials: [{ materialType: 'company', materialName: 'BR+CI+NAR1年报', formatStandard: '有效期内' }], prerequisites: [], riskLevel: 'high', reminderSchedule: { milestones: [7, 3], frequency: 'once' } },
        { nodeId: 'AP-M03', nodeName: '雇主财务证明', actionDescription: '获取公司审计报告银行流水', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 5, estimatedDuration: '2周' }, triggerMaterials: [{ materialType: 'company', materialName: '审计报告银行流水', formatStandard: '证明有能力支付薪酬' }], prerequisites: [], riskLevel: 'high', reminderSchedule: { milestones: [14, 7], frequency: 'once' } },
        { nodeId: 'AP-M04', nodeName: '雇主ID990B签订', actionDescription: '雇主最后确认并签订ID990B', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 7, estimatedDuration: '2-3周' }, triggerMaterials: [{ materialType: 'official', materialName: 'ID990B(已签订)', formatStandard: '雇主签名+公司盖章' }], prerequisites: ['AP-M02', 'AP-M03'], riskLevel: 'critical', reminderSchedule: { milestones: [21, 14, 7], frequency: 'once' } },
        { nodeId: 'AP-M05', nodeName: '职位说明+招聘证明', actionDescription: '准备证明无法本地填补的材料', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 3, estimatedDuration: '1周' }, triggerMaterials: [{ materialType: 'company', materialName: '职位描述+招聘广告+面试记录', formatStandard: null }], prerequisites: [], riskLevel: 'critical', reminderSchedule: { milestones: [7, 3], frequency: 'once' } },
        { nodeId: 'AP-M06', nodeName: '港澳通行证检查', actionDescription: '有效期检查', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 1, estimatedDuration: '1天' }, triggerMaterials: [{ materialType: 'id', materialName: '港澳通行证', formatStandard: 'GD-PERMIT-01' }], prerequisites: [], riskLevel: 'low', reminderSchedule: { milestones: [1], frequency: 'once' } },
        { nodeId: 'AP-M07', nodeName: '材料完整性自查', actionDescription: '逐项核对(含雇主侧)', timeLogic: { type: 'event_driven', anchorField: 'APMAllPrepared', offsetDays: 0, estimatedDuration: '1天' }, triggerMaterials: [], prerequisites: ['AP-M01', 'AP-M02', 'AP-M03', 'AP-M04', 'AP-M05', 'AP-M06'], riskLevel: 'high', reminderSchedule: { milestones: [1], frequency: 'once' } }
      ],
      phase3: [],
      phase4: [],
      phase5: PHASE5_ACTIVATION_NODES,
      phase6: [],
      phase7: PHASE7_PR_NODES
    },
    sharedPhases: ['phase3', 'phase5', 'phase7']
  },

  iang: {
    pathType: 'iang',
    pathName: 'IANG（非本地毕业生留港）',
    visaInfo: {
      initialValidityMonths: 12,
      activationDeadlineDays: 90,
      renewalPattern: '2+2+3',
      renewalCoreCondition: '在港就业',
      approvalCycle: '2-4周',
      prepCycle: '1-2周'
    },
    uniqueFeatures: ['毕业后6个月内免雇主', '学生签证→IANG过渡', '审批快速'],
    phases: {
      phase1: [
        { nodeId: 'IG-01', nodeName: '确认毕业资格', actionDescription: '确认已获得香港认可院校学位', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 0, estimatedDuration: '1天' }, triggerMaterials: [{ materialType: 'edu', materialName: '学位证书(或预期毕业证明)', formatStandard: '香港认可院校' }], prerequisites: [], riskLevel: 'critical', reminderSchedule: { milestones: [7, 3], frequency: 'once' } },
        { nodeId: 'IG-02', nodeName: '确认在毕业后6个月内', actionDescription: '毕业后6个月内申请IANG无需雇主担保', timeLogic: { type: 'event_driven', anchorField: 'IG01Completed', offsetDays: 0, estimatedDuration: null }, triggerMaterials: [{ materialType: 'edu', materialName: '毕业日期确认', formatStandard: null }], prerequisites: ['IG-01'], riskLevel: 'critical', reminderSchedule: { milestones: [180, 90, 60, 30], frequency: 'once' } },
        { nodeId: 'IG-03', nodeName: '评估报告生成', actionDescription: '系统生成评估报告', timeLogic: { type: 'event_driven', anchorField: 'IG02Completed', offsetDays: 0, estimatedDuration: null }, triggerMaterials: [], prerequisites: ['IG-02'], riskLevel: 'low', reminderSchedule: { milestones: [3], frequency: 'once' } },
        { nodeId: 'IG-04', nodeName: '启动材料准备', actionDescription: '确认评估通过', timeLogic: { type: 'event_driven', anchorField: 'IG03Completed', offsetDays: 0, estimatedDuration: null }, triggerMaterials: [], prerequisites: ['IG-03'], riskLevel: 'low', reminderSchedule: { milestones: [7], frequency: 'once' } }
      ],
      phase2: [
        { nodeId: 'IG-M01', nodeName: '学位证明', actionDescription: '准备学位证+成绩单+毕业证明信', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 3, estimatedDuration: '1周' }, triggerMaterials: [{ materialType: 'edu', materialName: '学位证+成绩单+毕业证明', formatStandard: '香港认可院校' }], prerequisites: [], riskLevel: 'high', reminderSchedule: { milestones: [7, 3], frequency: 'once' } },
        { nodeId: 'IG-M02', nodeName: 'ID990A表格填写', actionDescription: '填写ID990A申请人部分', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 3, estimatedDuration: '1-2天' }, triggerMaterials: [{ materialType: 'official', materialName: 'ID990A表格(已填)', formatStandard: '表格完整+签名' }], prerequisites: [], riskLevel: 'medium', reminderSchedule: { milestones: [3, 1], frequency: 'once' } },
        { nodeId: 'IG-M03', nodeName: '港澳通行证检查', actionDescription: '有效期检查+确认学生签证状态', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 1, estimatedDuration: '1天' }, triggerMaterials: [{ materialType: 'id', materialName: '港澳通行证+学生签证', formatStandard: 'GD-PERMIT-01' }], prerequisites: [], riskLevel: 'medium', reminderSchedule: { milestones: [1], frequency: 'once' } },
        { nodeId: 'IG-M04', nodeName: '在港住址证明', actionDescription: '准备租约或水电账单', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 3, estimatedDuration: '1-2天' }, triggerMaterials: [{ materialType: 'proof', materialName: '租约或水电账单', formatStandard: '最近3个月内' }], prerequisites: [], riskLevel: 'low', reminderSchedule: { milestones: [3, 1], frequency: 'once' } },
        { nodeId: 'IG-M05', nodeName: '材料完整性自查', actionDescription: '逐项核对', timeLogic: { type: 'event_driven', anchorField: 'IGMAllPrepared', offsetDays: 0, estimatedDuration: '1天' }, triggerMaterials: [], prerequisites: ['IG-M01', 'IG-M02', 'IG-M03', 'IG-M04'], riskLevel: 'medium', reminderSchedule: { milestones: [1], frequency: 'once' } }
      ],
      phase3: [],
      phase4: [],
      phase5: PHASE5_ACTIVATION_NODES,
      phase6: [],
      phase7: PHASE7_PR_NODES
    },
    sharedPhases: ['phase3', 'phase5', 'phase7']
  },

  dependent: {
    pathType: 'dependent',
    pathName: '受养人',
    visaInfo: {
      initialValidityMonths: null, // 跟随主申
      activationDeadlineDays: null, // 跟随主申
      renewalPattern: '跟随主申',
      renewalCoreCondition: '主申成功续签（与主申完全锁定）',
      approvalCycle: '跟随主申',
      prepCycle: '1-2周'
    },
    uniqueFeatures: ['依附主申', '时间线与主申完全锁定', '满7年可独立申请永居'],
    phases: {
      phase1: [
        { nodeId: 'DP-01', nodeName: '确认主申签证类型及状态', actionDescription: '核实主申请人当前签证类型和状态', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 0, estimatedDuration: '1天' }, triggerMaterials: [{ materialType: 'official', materialName: '主申签证/进入许可', formatStandard: null }], prerequisites: [], riskLevel: 'critical', reminderSchedule: { milestones: [3], frequency: 'once' } },
        { nodeId: 'DP-02', nodeName: '确认关系证明完整', actionDescription: '准备结婚证(配偶)或出生证(子女)', timeLogic: { type: 'event_driven', anchorField: 'DP01Completed', offsetDays: 0, estimatedDuration: null }, triggerMaterials: [{ materialType: 'proof', materialName: '结婚证/出生证', formatStandard: '官方认证翻译' }], prerequisites: ['DP-01'], riskLevel: 'high', reminderSchedule: { milestones: [7], frequency: 'once' } },
        { nodeId: 'DP-03', nodeName: '确认主申经济能力', actionDescription: '核实主申有足够经济能力支持受养人在港生活', timeLogic: { type: 'event_driven', anchorField: 'DP02Completed', offsetDays: 0, estimatedDuration: null }, triggerMaterials: [{ materialType: 'financial', materialName: '主申银行流水+收入证明', formatStandard: null }], prerequisites: ['DP-02'], riskLevel: 'high', reminderSchedule: { milestones: [7], frequency: 'once' } },
        { nodeId: 'DP-04', nodeName: '评估报告生成', actionDescription: '系统生成评估报告', timeLogic: { type: 'event_driven', anchorField: 'DP03Completed', offsetDays: 0, estimatedDuration: null }, triggerMaterials: [], prerequisites: ['DP-03'], riskLevel: 'low', reminderSchedule: { milestones: [3], frequency: 'once' } },
        { nodeId: 'DP-05', nodeName: '启动材料准备', actionDescription: '确认评估通过', timeLogic: { type: 'event_driven', anchorField: 'DP04Completed', offsetDays: 0, estimatedDuration: null }, triggerMaterials: [], prerequisites: ['DP-04'], riskLevel: 'low', reminderSchedule: { milestones: [7], frequency: 'once' } }
      ],
      phase2: [
        { nodeId: 'DP-M01', nodeName: '关系证明公证翻译', actionDescription: '结婚证/出生证官方认证+翻译', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 3, estimatedDuration: '1周' }, triggerMaterials: [{ materialType: 'proof', materialName: '关系证明公证翻译件', formatStandard: '官方认证翻译' }], prerequisites: [], riskLevel: 'high', reminderSchedule: { milestones: [7, 3], frequency: 'once' } },
        { nodeId: 'DP-M02', nodeName: '主申签证/身份证明', actionDescription: '主申有效签证+港澳通行证+身份证复印件', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 1, estimatedDuration: '1天' }, triggerMaterials: [{ materialType: 'official', materialName: '主申签证+通行证+身份证', formatStandard: '有效期内' }], prerequisites: [], riskLevel: 'critical', reminderSchedule: { milestones: [1], frequency: 'once' } },
        { nodeId: 'DP-M03', nodeName: '主申经济能力证明', actionDescription: '主申银行流水+收入证明', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 3, estimatedDuration: '1周' }, triggerMaterials: [{ materialType: 'financial', materialName: '主申银行流水+收入证明', formatStandard: '保证受养人在港生活' }], prerequisites: [], riskLevel: 'high', reminderSchedule: { milestones: [7, 3], frequency: 'once' } },
        { nodeId: 'DP-M04', nodeName: '在港住址证明', actionDescription: '租约或水电账单(证明足够居住空间)', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 3, estimatedDuration: '1周' }, triggerMaterials: [{ materialType: 'proof', materialName: '租约或水电账单', formatStandard: '足够居住空间' }], prerequisites: [], riskLevel: 'medium', reminderSchedule: { milestones: [7, 3], frequency: 'once' } },
        { nodeId: 'DP-M05', nodeName: '受养人港澳通行证检查', actionDescription: '有效期检查', timeLogic: { type: 'relative', anchorField: 'today', offsetDays: 1, estimatedDuration: '1天' }, triggerMaterials: [{ materialType: 'id', materialName: '港澳通行证', formatStandard: 'GD-PERMIT-01' }], prerequisites: [], riskLevel: 'medium', reminderSchedule: { milestones: [1], frequency: 'once' } },
        { nodeId: 'DP-M06', nodeName: '材料完整性自查', actionDescription: '逐项核对', timeLogic: { type: 'event_driven', anchorField: 'DPMAllPrepared', offsetDays: 0, estimatedDuration: '1天' }, triggerMaterials: [], prerequisites: ['DP-M01', 'DP-M02', 'DP-M03', 'DP-M04', 'DP-M05'], riskLevel: 'high', reminderSchedule: { milestones: [1], frequency: 'once' } }
      ],
      phase3: [],
      phase4: [],
      phase5: PHASE5_ACTIVATION_NODES,
      phase6: [],
      phase7: PHASE7_PR_NODES
    },
    sharedPhases: ['phase3', 'phase5', 'phase7'],
    dependentOnSponsor: true // 标记为依赖性路径
  }
};

// ═══════════════════════════════════════════════════════════════
// Phase 4 等待获批 — 通用节点
// ═══════════════════════════════════════════════════════════════
const PHASE4_WAITING_NODES = [
  {
    nodeId: 'WT-01', nodeName: '获取申请编号', actionDescription: 'OCR识别确认邮件中的申请编号', timeLogic: { type: 'relative', anchorField: 'submissionDate', offsetDays: 3, estimatedDuration: '提交后1-3个工作日' }, triggerMaterials: [{ materialType: 'official', materialName: '确认邮件/递交回执', formatStandard: null }], prerequisites: [], riskLevel: 'medium', reminderSchedule: { milestones: [3, 1], frequency: 'once' }
  },
  {
    nodeId: 'WT-02', nodeName: '确认申请已受理', actionDescription: '申请编号录入系统，开始计时', timeLogic: { type: 'event_driven', anchorField: 'WT01Completed', offsetDays: 0, estimatedDuration: null }, triggerMaterials: [{ materialType: 'official', materialName: '申请编号', formatStandard: null }], prerequisites: ['WT-01'], riskLevel: 'low', reminderSchedule: { milestones: [1], frequency: 'once' }
  },
  {
    nodeId: 'WT-04', nodeName: '补件通知', actionDescription: '收到入境处补件要求，2周内准备补件材料', timeLogic: { type: 'event_driven', anchorField: 'supplementRequested', offsetDays: 0, estimatedDuration: '通常2周内' }, triggerMaterials: [{ materialType: 'official', materialName: '入境处补件通知', formatStandard: null }], prerequisites: ['WT-02'], riskLevel: 'critical', reminderSchedule: { milestones: [14, 7, 3, 1], frequency: 'once' }
  },
  {
    nodeId: 'WT-06', nodeName: '原则性批准', actionDescription: '收到入境处原则性批准通知书', timeLogic: { type: 'event_driven', anchorField: 'approvalReceived', offsetDays: 0, estimatedDuration: null }, triggerMaterials: [{ materialType: 'official', materialName: '原则性批准通知书', formatStandard: 'GD-APPROVAL-01' }], prerequisites: ['WT-02'], riskLevel: 'low', reminderSchedule: { milestones: [0, 3, 7], frequency: 'once' }
  },
  {
    nodeId: 'WT-07', nodeName: '赴港居留同意书准备', actionDescription: '原则性批准后，3个月内准备赴港居留同意书', timeLogic: { type: 'relative', anchorField: 'approvalReceived', offsetDays: 0, estimatedDuration: '3个月内' }, triggerMaterials: [{ materialType: 'official', materialName: '原则性批准通知书', formatStandard: null }], prerequisites: ['WT-06'], riskLevel: 'high', reminderSchedule: { milestones: [90, 60, 30, 14, 7], frequency: 'once' }
  }
];

// ═══════════════════════════════════════════════════════════════
// Phase 6 续签倒计时节点（通用 + 路径专属混入）
// ═══════════════════════════════════════════════════════════════
const PHASE6_RENEWAL_COUNTDOWN_NODES = [
  {
    nodeId: 'RV-01', nodeName: '续签准备启动', actionDescription: '确认续签条件，启动材料整理', timeLogic: { type: 'relative', anchorField: 'ved', offsetDays: -180, estimatedDuration: 'T-180天' }, triggerMaterials: [], prerequisites: [], riskLevel: 'medium', reminderSchedule: { milestones: [180, 150, 120], frequency: 'monthly' }
  },
  {
    nodeId: 'RV-02', nodeName: '居住证明整理', actionDescription: '租约+水电煤账单+银行月结单', timeLogic: { type: 'relative', anchorField: 'ved', offsetDays: -150, estimatedDuration: 'T-150天' }, triggerMaterials: [{ materialType: 'proof', materialName: '租约/水电煤账单/银行月结单', formatStandard: '覆盖最近12个月' }], prerequisites: ['RV-01'], riskLevel: 'high', reminderSchedule: { milestones: [150, 120, 90], frequency: 'monthly' }
  },
  {
    nodeId: 'RV-03', nodeName: '工作/收入证明整理', actionDescription: '雇佣合约+粮单+在职证明', timeLogic: { type: 'relative', anchorField: 'ved', offsetDays: -120, estimatedDuration: 'T-120天' }, triggerMaterials: [{ materialType: 'work', materialName: '雇佣合约/粮单/在职证明', formatStandard: '最近12个月' }], prerequisites: ['RV-01'], riskLevel: 'high', reminderSchedule: { milestones: [120, 90, 60], frequency: 'monthly' }
  },
  {
    nodeId: 'RV-04', nodeName: '税务记录整理', actionDescription: '最近1-2年薪俸税报税表', timeLogic: { type: 'relative', anchorField: 'ved', offsetDays: -90, estimatedDuration: 'T-90天' }, triggerMaterials: [{ materialType: 'financial', materialName: '薪俸税报税表', formatStandard: '最近1-2年' }], prerequisites: ['RV-01'], riskLevel: 'medium', reminderSchedule: { milestones: [90, 60, 30], frequency: 'monthly' }
  },
  {
    nodeId: 'RV-05', nodeName: 'MPF供款记录整理', actionDescription: '最近12个月MPF供款证明', timeLogic: { type: 'relative', anchorField: 'ved', offsetDays: -90, estimatedDuration: 'T-90天' }, triggerMaterials: [{ materialType: 'financial', materialName: '强积金供款记录', formatStandard: '最近12个月' }], prerequisites: ['RV-01'], riskLevel: 'medium', reminderSchedule: { milestones: [90, 60, 30], frequency: 'monthly' }
  },
  {
    nodeId: 'RV-06', nodeName: '雇主证明信（如适用）', actionDescription: '联系雇主出具续签支持信', timeLogic: { type: 'relative', anchorField: 'ved', offsetDays: -60, estimatedDuration: 'T-60天' }, triggerMaterials: [{ materialType: 'work', materialName: '雇主支持信', formatStandard: '公司信纸+公章' }], prerequisites: ['RV-03'], riskLevel: 'high', reminderSchedule: { milestones: [60, 45, 30], frequency: 'once' }
  },
  {
    nodeId: 'RV-07', nodeName: '材料完整性自查', actionDescription: '逐项对照入境处续签清单', timeLogic: { type: 'relative', anchorField: 'ved', offsetDays: -45, estimatedDuration: 'T-45天' }, triggerMaterials: [], prerequisites: ['RV-02', 'RV-03', 'RV-04', 'RV-05'], riskLevel: 'high', reminderSchedule: { milestones: [45, 30, 14], frequency: 'weekly' }
  },
  {
    nodeId: 'RV-08', nodeName: '递交续签申请', actionDescription: '建议不晚于到期前4周递交', timeLogic: { type: 'relative', anchorField: 'ved', offsetDays: -30, estimatedDuration: 'T-30天(建议)' }, triggerMaterials: [], prerequisites: ['RV-07'], riskLevel: 'critical', reminderSchedule: { milestones: [30, 21, 14, 7], frequency: 'weekly' }
  },
  {
    nodeId: 'RV-09', nodeName: '续签审批等待', actionDescription: '审批周期2-8周', timeLogic: { type: 'event_driven', anchorField: 'renewalSubmitted', offsetDays: 0, estimatedDuration: '2-8周' }, triggerMaterials: [], prerequisites: ['RV-08'], riskLevel: 'medium', reminderSchedule: { milestones: [14, 28, 42, 56], frequency: 'biweekly' }
  },
  {
    nodeId: 'RV-10', nodeName: '签证到期紧急提醒', actionDescription: '⚠️ 尚未递交则立即递交，逾期逗留违法', timeLogic: { type: 'relative', anchorField: 'ved', offsetDays: 0, estimatedDuration: 'T-0' }, triggerMaterials: [], prerequisites: ['RV-08'], riskLevel: 'critical', reminderSchedule: { milestones: [14, 7, 3, 1], frequency: 'daily' }
  }
];

// ═══════════════════════════════════════════════════════════════
// 路径专属Phase 6续签附加节点
// ═══════════════════════════════════════════════════════════════
const PATH_SPECIFIC_RENEWAL_NODES = {
  qmas: [
    { nodeId: 'QM-RV-01', nodeName: '季度在港天数统计', actionDescription: '统计本季度在港天数', timeLogic: { type: 'absolute', anchorField: 'quarterEnd', offsetDays: 0, estimatedDuration: '每季度末' }, triggerMaterials: [], prerequisites: [], riskLevel: 'medium', reminderSchedule: { milestones: [14, 7], frequency: 'quarterly' } },
    { nodeId: 'QM-RV-02', nodeName: '年度在港天数预警', actionDescription: '年度在港<180天则发出预警', timeLogic: { type: 'absolute', anchorField: 'yearEnd', offsetDays: 0, estimatedDuration: '每年末' }, triggerMaterials: [], prerequisites: [], riskLevel: 'high', reminderSchedule: { milestones: [30, 14], frequency: 'yearly' } },
    { nodeId: 'QM-RV-03', nodeName: '离境超180天预警', actionDescription: '任一次离境超180天需准备解释信', timeLogic: { type: 'event_driven', anchorField: 'longAbsenceStart', offsetDays: 180, estimatedDuration: '离境第180天' }, triggerMaterials: [], prerequisites: [], riskLevel: 'critical', reminderSchedule: { milestones: [180, 150, 120], frequency: 'once' } }
  ],
  ttps_a: [
    { nodeId: 'TT-RV-01', nodeName: '就业状态季度确认', actionDescription: '确认在港就业/自雇状态持续', timeLogic: { type: 'absolute', anchorField: 'quarterEnd', offsetDays: 0, estimatedDuration: '每季度' }, triggerMaterials: [], prerequisites: [], riskLevel: 'high', reminderSchedule: { milestones: [14, 7], frequency: 'quarterly' } },
    { nodeId: 'TT-RV-02', nodeName: '收入水平年度检查', actionDescription: '确认年收入≥香港市场中位数', timeLogic: { type: 'absolute', anchorField: 'yearEnd', offsetDays: 0, estimatedDuration: '每年' }, triggerMaterials: [{ materialType: 'financial', materialName: '年度收入证明', formatStandard: null }], prerequisites: [], riskLevel: 'critical', reminderSchedule: { milestones: [90, 60, 30], frequency: 'yearly' } },
    { nodeId: 'TT-RV-03', nodeName: '公司存续检查（自雇者）', actionDescription: '自雇者检查BR+审计+业务流水', timeLogic: { type: 'absolute', anchorField: 'halfYear', offsetDays: 0, estimatedDuration: '每半年' }, triggerMaterials: [{ materialType: 'company', materialName: 'BR+审计报告+银行流水', formatStandard: null }], prerequisites: [], riskLevel: 'high', reminderSchedule: { milestones: [30, 14], frequency: 'semiannual' } }
  ],
  asmtp: [
    { nodeId: 'AP-RV-01', nodeName: '雇佣状态季度确认', actionDescription: '确认仍在原雇主处工作', timeLogic: { type: 'absolute', anchorField: 'quarterEnd', offsetDays: 0, estimatedDuration: '每季度' }, triggerMaterials: [], prerequisites: [], riskLevel: 'critical', reminderSchedule: { milestones: [14, 7], frequency: 'quarterly' } },
    { nodeId: 'AP-RV-02', nodeName: '转工预警提醒', actionDescription: '任何转工意向须先确认新雇主sponsor已获批', timeLogic: { type: 'event_driven', anchorField: 'jobChangeIntention', offsetDays: 0, estimatedDuration: null }, triggerMaterials: [], prerequisites: [], riskLevel: 'critical', reminderSchedule: { milestones: [90, 60, 30], frequency: 'once' } }
  ]
};
// ttps_b, ttps_c, iang 与 ttps_a 共享 TT-RV 系列节点
PATH_SPECIFIC_RENEWAL_NODES.ttps_b = PATH_SPECIFIC_RENEWAL_NODES.ttps_a;
PATH_SPECIFIC_RENEWAL_NODES.ttps_c = PATH_SPECIFIC_RENEWAL_NODES.ttps_a;
PATH_SPECIFIC_RENEWAL_NODES.iang = PATH_SPECIFIC_RENEWAL_NODES.ttps_a;

// ═══════════════════════════════════════════════════════════════
// 通用Phase 3 线上申请节点
// ═══════════════════════════════════════════════════════════════
const PHASE3_GENERIC_APPLY_NODES = [
  { nodeId: 'OL-01-G', nodeName: '注册/登录入境处在线系统', actionDescription: '入境处官网注册或登录', timeLogic: { type: 'event_driven', anchorField: 'phase2Completed', offsetDays: 0, estimatedDuration: '当天' }, triggerMaterials: [], prerequisites: [], riskLevel: 'low', reminderSchedule: { milestones: [1], frequency: 'once' } },
  { nodeId: 'OL-02-G', nodeName: '填写申请表', actionDescription: '完整填写入境处申请表', timeLogic: { type: 'event_driven', anchorField: 'OL01Completed', offsetDays: 0, estimatedDuration: '1-2小时' }, triggerMaterials: [], prerequisites: ['OL-01-G'], riskLevel: 'high', reminderSchedule: { milestones: [3, 1], frequency: 'once' } },
  { nodeId: 'OL-03-G', nodeName: '上传材料扫描件', actionDescription: '将Phase 2材料扫描件上传', timeLogic: { type: 'event_driven', anchorField: 'OL02Completed', offsetDays: 0, estimatedDuration: '1-2小时' }, triggerMaterials: [], prerequisites: ['OL-02-G'], riskLevel: 'critical', reminderSchedule: { milestones: [3, 1], frequency: 'once' } },
  { nodeId: 'OL-04-G', nodeName: '缴付申请费用', actionDescription: '在线支付申请费', timeLogic: { type: 'event_driven', anchorField: 'OL03Completed', offsetDays: 0, estimatedDuration: '当天' }, triggerMaterials: [], prerequisites: ['OL-03-G'], riskLevel: 'low', reminderSchedule: { milestones: [1], frequency: 'once' } },
  { nodeId: 'OL-05-G', nodeName: '确认提交', actionDescription: '最终核对后提交', timeLogic: { type: 'event_driven', anchorField: 'OL04Completed', offsetDays: 0, estimatedDuration: null }, triggerMaterials: [], prerequisites: ['OL-04-G'], riskLevel: 'critical', reminderSchedule: { milestones: [1, 0], frequency: 'once' } }
];

// ═══════════════════════════════════════════════════════════════
// 模块导出
// ═══════════════════════════════════════════════════════════════

/**
 * 获取指定路径的完整时间线模板
 * @param {string} pathType - 'qmas'|'ttps_a'|'ttps_b'|'ttp_c'|'asmtp'|'iang'|'dependent'
 * @returns {object} 路径时间线模板（含phase3/4/6通用节点填充）
 */
function getTemplate(pathType) {
  const template = PATH_TEMPLATES[pathType];
  if (!template) throw new Error(`Unknown path type: ${pathType}`);

  // 填充通用节点的克隆（避免引用共享）
  const filled = JSON.parse(JSON.stringify(template));

  // Phase 3: 线上申请通用节点（但保留路径特有的节点如优才的赴港计划书填报）
  if (!filled.phases.phase3 || filled.phases.phase3.length === 0) {
    filled.phases.phase3 = JSON.parse(JSON.stringify(PHASE3_GENERIC_APPLY_NODES));
  }

  // Phase 4: 等待获批通用节点
  if (!filled.phases.phase4 || filled.phases.phase4.length === 0) {
    let phase4nodes = JSON.parse(JSON.stringify(PHASE4_WAITING_NODES));
    // 优才额外添加长周期提醒节点
    if (pathType === 'qmas') {
      phase4nodes.push(
        { nodeId: 'QM-WT-01', nodeName: '2个月无消息 — 仍在正常周期', timeLogic: { type: 'relative', anchorField: 'submissionDate', offsetDays: 60 }, riskLevel: 'low', reminderSchedule: { milestones: [60], frequency: 'once' } },
        { nodeId: 'QM-WT-02', nodeName: '4个月进度查询提醒', timeLogic: { type: 'relative', anchorField: 'submissionDate', offsetDays: 120 }, riskLevel: 'low', reminderSchedule: { milestones: [120], frequency: 'once' } },
        { nodeId: 'QM-WT-03', nodeName: '6个月 — 建议主动查询', timeLogic: { type: 'relative', anchorField: 'submissionDate', offsetDays: 180 }, riskLevel: 'medium', reminderSchedule: { milestones: [180], frequency: 'once' } },
        { nodeId: 'QM-WT-04', nodeName: '9个月 — 接近周期上限', timeLogic: { type: 'relative', anchorField: 'submissionDate', offsetDays: 270 }, riskLevel: 'high', reminderSchedule: { milestones: [270], frequency: 'once' } },
        { nodeId: 'QM-WT-05', nodeName: '12个月 — 超过平均周期', timeLogic: { type: 'relative', anchorField: 'submissionDate', offsetDays: 365 }, riskLevel: 'critical', reminderSchedule: { milestones: [365], frequency: 'once' } }
      );
    }
    filled.phases.phase4 = phase4nodes;
  }

  // Phase 6: 续签倒计时通用节点 + 路径专属节点
  if (!filled.phases.phase6 || filled.phases.phase6.length === 0) {
    let phase6nodes = JSON.parse(JSON.stringify(PHASE6_RENEWAL_COUNTDOWN_NODES));
    const specificNodes = PATH_SPECIFIC_RENEWAL_NODES[pathType];
    if (specificNodes) {
      phase6nodes = phase6nodes.concat(JSON.parse(JSON.stringify(specificNodes)));
    }
    filled.phases.phase6 = phase6nodes;
  }

  return filled;
}

/**
 * 获取所有路径类型列表
 */
function getAllPathTypes() {
  return Object.keys(PATH_TEMPLATES);
}

/**
 * 获取指定阶段的通用节点（不绑定路径）
 * @param {string} phaseKey - 'phase5'|'phase7'|'phase3_generic'|'phase4_waiting'|'phase6_renewal'
 */
function getGenericPhaseNodes(phaseKey) {
  const map = {
    phase5: PHASE5_ACTIVATION_NODES,
    phase7: PHASE7_PR_NODES,
    phase3_generic: PHASE3_GENERIC_APPLY_NODES,
    phase4_waiting: PHASE4_WAITING_NODES,
    phase6_renewal: PHASE6_RENEWAL_COUNTDOWN_NODES
  };
  return map[phaseKey] ? JSON.parse(JSON.stringify(map[phaseKey])) : null;
}

module.exports = {
  getTemplate,
  getAllPathTypes,
  getGenericPhaseNodes,
  PATH_TEMPLATES,
  PHASE5_ACTIVATION_NODES,
  PHASE7_PR_NODES,
  PHASE4_WAITING_NODES,
  PHASE6_RENEWAL_COUNTDOWN_NODES,
  PATH_SPECIFIC_RENEWAL_NODES,
  QMAS_PHASE1,
  QMAS_PHASE2,
  QMAS_PHASE3
};
