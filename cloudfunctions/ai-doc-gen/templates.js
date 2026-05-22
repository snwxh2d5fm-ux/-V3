/**
 * 住港伴 — AI 文档生成模板 (ai-doc-gen/templates)
 * 从旧版 Taro 云函数提取，适配新版原生框架
 *
 * 支持三种文档类型：
 * - statement_plan: 赴港计划书
 * - recommendation: 推荐信
 * - work_proof: 工作证明
 *
 * ⚠️ 合规声明：所有AI生成的文档均标注「AI辅助生成」属性
 */

/** 所有AI生成文档统一添加的免责声明 */
const AI_DISCLAIMER =
  '\n\n' +
  '═══════════════════════════════════════\n' +
  '【AI辅助生成声明】\n' +
  '本文档由住港伴AI助手辅助生成，仅供参考。\n' +
  '申请人须自行核实全部内容的真实性和准确性，\n' +
  '并对最终提交的文档承担全部责任。\n' +
  '香港入境事务处对弄虚作假零容忍。\n' +
  '如有疑问，请咨询专业身份规划法律顾问。\n' +
  '═══════════════════════════════════════\n';

/**
 * 赴港计划书模板
 */
function generateStatementPlan(userLabels, extraInfo) {
  const position = extraInfo.position || '（请补充职位）';
  const achievements = extraInfo.coreAchievements || '';
  const additionalInfo = extraInfo.additionalInfo || '';
  const today = new Date().toISOString().split('T')[0];

  const labelSummary =
    userLabels.length > 0
      ? userLabels
          .map(function (l) {
            return l.label;
          })
          .join('、')
      : '（请授权个人信息标签以自动填充）';

  return {
    content:
      '赴港计划书\n\n' +
      '日期：' +
      today +
      '\n\n' +
      '一、申请人基本信息\n' +
      '姓名：____________\n' +
      '当前职位：' +
      position +
      '\n' +
      '个人标签：' +
      labelSummary +
      '\n\n' +
      '二、赴港计划\n' +
      '本人计划前往香港发展，基于以下考虑：\n\n' +
      '1. 职业发展\n' +
      '香港作为国际金融中心，拥有完善的法律制度和开放的市场环境。' +
      '本人拟在香港寻找与' +
      position +
      '相关的发展机会，' +
      '发挥在现有领域积累的专业经验和技术能力，为香港的经济发展贡献力量。\n\n' +
      '2. 专业背景\n' +
      '（请在此处描述您的工作经历、核心能力和专业成就）\n' +
      (achievements ? achievements + '\n\n' : '\n') +
      '3. 对香港的贡献\n' +
      '本人期望通过自身专业能力为香港经济社会发展做出贡献，' +
      '同时借助香港的国际平台，进一步提升专业水平。\n\n' +
      '4. 家庭安排\n' +
      '（请在此处描述家庭在港的定居计划，包括子女教育、住房安排等）\n\n' +
      '三、时间规划\n' +
      '短期（1年内）：落实在港工作/创业安排\n' +
      '中期（1-3年）：稳定在港生活和工作，履行通常居住要求\n' +
      '长期（7年）：达到永居申请条件\n\n' +
      (additionalInfo ? '四、补充说明\n' + additionalInfo + '\n\n' : '') +
      '本人声明以上信息真实准确。\n\n' +
      '申请人签名：____________\n' +
      '日期：' +
      today +
      AI_DISCLAIMER,

    format: 'text',
    aiDisclaimer: true,
    reviewNotes: [
      '⚠️ 此为AI辅助生成的初稿，请自行核实所有信息的真实性',
      '请补充完整的个人信息（姓名、联系方式等）',
      '建议在职业发展部分增加具体行业分析和目标公司',
      '如有香港工作Offer，请附上聘书复印件',
      '家庭安排部分建议详细说明子女教育规划',
      '所有成就和经历描述须有可验证的真实依据',
    ],
  };
}

/**
 * 推荐信模板
 */
function generateRecommendation(userLabels, extraInfo) {
  const position = extraInfo.position || '（请补充职位）';
  const achievements = extraInfo.coreAchievements || '';
  const additionalInfo = extraInfo.additionalInfo || '';
  const today = new Date().toISOString().split('T')[0];

  return {
    content:
      '推荐信\n\n' +
      '日期：' +
      today +
      '\n\n' +
      '致相关人士：\n\n' +
      '本人____________，现任____________（推荐人职务），' +
      '很荣幸推荐____________（申请人姓名）申请香港相关签证/入境计划。\n\n' +
      '本人与申请人相识于____________（相识时间/场合），' +
      '在____________（共事/合作过程中），对申请人的专业能力和个人品质有深入了解。\n\n' +
      '一、申请人基本情况\n' +
      '当前职位：' +
      position +
      '\n' +
      '专业领域：' +
      (userLabels
        .map(function (l) {
          return l.label;
        })
        .join('、') || '（待补充）') +
      '\n' +
      '与推荐人关系：____________\n\n' +
      '二、专业能力评价\n' +
      (achievements || '（请补充核心成就和具体事例）') +
      '\n\n' +
      '三、个人品质评价\n' +
      '（请在此处描述申请人的人际交往能力、团队协作精神、职业道德等）\n\n' +
      '四、推荐理由\n' +
      '基于以上了解，本人认为申请人具备在香港发展的能力和潜力，' +
      '能够为香港社会做出积极贡献。\n' +
      (additionalInfo ? '\n补充意见：\n' + additionalInfo + '\n\n' : '\n') +
      '恳请贵方予以考虑。\n\n' +
      '此致\n\n' +
      '推荐人签名：____________\n' +
      '推荐人职务：____________\n' +
      '推荐人单位：____________\n' +
      '联系电话：____________\n' +
      '邮箱：____________\n' +
      '日期：' +
      today +
      AI_DISCLAIMER,

    format: 'text',
    aiDisclaimer: true,
    reviewNotes: [
      '⚠️ 此为AI辅助生成的初稿，请自行核实所有信息的真实性',
      '推荐人需为与申请人有直接工作或学术关系的人士',
      '推荐信需使用推荐人所在单位抬头纸打印',
      '请提供推荐人的完整联系方式以便核实',
      '建议推荐人在信中提供具体事例支撑评价',
      '推荐信有效期通常为6个月',
    ],
  };
}

/**
 * 工作证明模板
 */
function generateWorkProof(userLabels, extraInfo) {
  const position = extraInfo.position || '（请补充职位）';
  const achievements = extraInfo.coreAchievements || '';
  const dateStart = extraInfo.startDate || 'YYYY-MM-DD';
  const dateEnd = extraInfo.endDate || '至今';
  const today = new Date().toISOString().split('T')[0];

  return {
    content:
      '工作证明\n\n' +
      '兹证明\n\n' +
      '姓名：____________\n' +
      '身份证/护照号：____________\n\n' +
      '该员工自' +
      dateStart +
      '至' +
      dateEnd +
      '在本公司任职，' +
      '担任' +
      position +
      '一职。\n\n' +
      '工作期间的主要职责包括：\n' +
      (achievements || '1. ____________\n2. ____________\n3. ____________\n') +
      '\n' +
      '月薪/年薪：____________\n' +
      '工作性质：全职/兼职\n\n' +
      '该员工工作表现良好，无违法违规记录。\n\n' +
      '特此证明。\n\n' +
      (extraInfo.additionalInfo ? '补充说明：\n' + extraInfo.additionalInfo + '\n\n' : '') +
      '证明单位（盖章）：____________\n' +
      '人事负责人签名：____________\n' +
      '联系电话：____________\n' +
      '日期：' +
      today +
      '\n\n' +
      '（本证明仅用于香港入境事务处相关申请）' +
      AI_DISCLAIMER,

    format: 'text',
    aiDisclaimer: true,
    reviewNotes: [
      '⚠️ 此为AI辅助生成的初稿，请自行核实所有信息的真实性',
      '工作证明需使用公司抬头纸打印并加盖公章',
      '证明需注明职位名称、入职时间、离职时间（如在职注明"至今"）',
      '薪资部分建议注明币种（港币/人民币/美元）',
      '最好附上工作证明开具人的联系方式',
      '证明开具日期应在申请提交前6个月内',
    ],
  };
}

module.exports = {
  AI_DISCLAIMER: AI_DISCLAIMER,
  generateStatementPlan: generateStatementPlan,
  generateRecommendation: generateRecommendation,
  generateWorkProof: generateWorkProof,
};
