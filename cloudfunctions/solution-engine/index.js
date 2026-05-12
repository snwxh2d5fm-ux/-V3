/**
 * solution-engine v1.0 — 方案库智能推荐引擎 (PRD v3.1 新增)
 * 基于12用户画像×10推荐路径×风险矩阵的确定性匹配
 * 不做AI推理，使用结构化匹配表
 *
 * PRD v3.1 覆盖: SR-01~SR-04
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 12标准画像特征定义
const PERSONA_FEATURES = {
  1: { ageMax:28, educationMin:'本科', eligibleSchool:true, expMax:3, incomeMax:2500000, capitalMax:5000000, corePaths:['student_iang','ttps_c'] },
  2: { ageMin:28, ageMax:40, educationMin:'本科', expMin:3, expMax:15, incomeMax:2500000, capitalMax:5000000, corePaths:['qmas','ttps_b'] },
  3: { ageMin:30, incomeMin:2500000, corePaths:['ttps_a','cies'] },
  4: { ageMin:35, ageMax:55, expMin:10, incomeMin:1000000, capitalMin:10000000, corePaths:['ttps_a','cies','qmas'] },
  5: { ageMin:28, ageMax:45, educationMin:'本科', expMin:5, studyType:'parttime', corePaths:['parttime_qmas','qmas'] },
  6: { ageMax:28, educationMin:'本科', eligibleSchool:true, expMax:5, corePaths:['ttps_b','ttps_c','student_iang'] },
  7: { hasIntlExp:true, expMin:3, corePaths:['qmas','ttps_b','asmpt'] },
  8: { major:'STEM', educationMin:'硕士', expMin:2, corePaths:['techtas','qmas'] }
};

// 路径详情(部分关键路径)
const PATH_PROFILES = {
  student_iang: { name:'全日制学生→IANG→永居', riskLevel:'low', totalCycle:'7-8年', passRate:0.92, confidence:'B', requirements:['获港校offer','全日制学习','毕业申请IANG','在港就业'] },
  parttime_qmas: { name:'兼读制→优才/专才→永居', riskLevel:'medium_high', totalCycle:'7-9年', passRate:0.65, confidence:'C', requirements:['毕业后另寻路径','优才12准则≥6项或专才雇主'], notes:['兼读制不申IANG','旅游签入境上课属法律灰色地带'] },
  ttps_a: { name:'高才通A类(≥250万)', riskLevel:'low', totalCycle:'7年', passRate:0.95, confidence:'A', requirements:['年收入≥250万港币','纳税/审计证明'], firstVisa:'36月' },
  ttps_b: { name:'高才通B类(学士+3年)', riskLevel:'low', totalCycle:'7年', passRate:0.95, confidence:'A', requirements:['合资格大学学士','≥3年工作经验'], firstVisa:'24月' },
  ttps_c: { name:'高才通C类(学士<3年)', riskLevel:'medium', totalCycle:'7年', passRate:0.90, confidence:'B', requirements:['合资格大学学士','毕业≤5年','配额可用'], firstVisa:'24月', notes:['年度配额10000名'] },
  qmas: { name:'优才QMAS(12准则≥6)', riskLevel:'medium_low', totalCycle:'7-8年', passRate:0.70, confidence:'C', requirements:['12项准则≥6项','赴港计划书'], notes:['"通常居住"无硬性天数要求，建议≥180天/年'] },
  asmpt: { name:'专才ASMTP(雇主sponsor)', riskLevel:'medium', totalCycle:'7年', passRate:0.85, confidence:'B', requirements:['香港雇主sponsor','证明职位无法本地填补'], notes:['绑雇主','换雇主需重新申请'] },
  techtas: { name:'科技人才TechTAS', riskLevel:'low', totalCycle:'7年', passRate:0.90, confidence:'B', requirements:['合资格科技领域','合资格雇主'] },
  cies: { name:'投资类身份规划CIES', riskLevel:'low', totalCycle:'8-9年', passRate:0.95, confidence:'A', requirements:['准资产≥3000万','持续撷持有效资产'] }
};

exports.main = async (event) => {
  const { action } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  try {
    switch (action) {
      case 'match':    return await matchPaths(event.profile);
      case 'compare':  return await comparePaths(event.pathIds);
      case 'getDetail': return await getPathDetail(event.pathId);
      case 'listAll':  return await listAllPaths();
      default:         return { code: 400, msg: '无效操作' };
    }
  } catch (err) {
    console.error('[solution-engine]', err);
    return { code: 500, msg: '方案引擎异常', error: err.message };
  }
};

/**
 * SR-01: 确定性路径匹配
 * 基于用户画像特征匹配方案库，返回Top 1~3路径+备选方案
 */
async function matchPaths(profile) {
  if (!profile) return { code: 400, msg: '缺少用户画像' };

  const scores = {};
  const p = profile;

  // 画像匹配逻辑(确定性规则)
  if (p.age <= 28 && p.education && p.experience <= 3) scores.student_iang = (scores.student_iang||0) + 40;
  if (p.age >= 28 && p.age <= 40 && p.experience >= 3 && (p.income || 0) < 2500000) scores.qmas = (scores.qmas||0) + 40;
  if (p.income >= 2500000) scores.ttps_a = (scores.ttps_a||0) + 100;
  if (p.eligibleSchool === true && p.experience < 3) scores.ttps_c = (scores.ttps_c||0) + 100;
  if (p.eligibleSchool === true && p.experience >= 3) scores.ttps_b = (scores.ttps_b||0) + 100;
  if (p.major === 'STEM' && p.experience >= 2) { scores.techtas = (scores.techtas||0) + 80; scores.qmas = (scores.qmas||0) + 30; }
  if (p.capital >= 30000000) scores.cies = (scores.cies||0) + 100;
  if (p.companyType === 'enterprise_owner' && p.income >= 2500000) { scores.ttps_a = (scores.ttps_a||0) + 85; scores.cies = (scores.cies||0) + 60; }
  if (p.hasIntlExp === true && p.experience >= 3) scores.qmas = (scores.qmas||0) + 25;

  // 优才12准则评估
  let qmasCrit = 0;
  if (p.age <= 50) qmasCrit++;
  if (p.educationLevel >= 2) qmasCrit++;
  if (p.major === 'STEM') qmasCrit++;
  if (p.language === 'bilingual_fluent') qmasCrit++;
  if (p.experience >= 5) qmasCrit++;
  if (p.hasFamous === true && p.experience >= 3) qmasCrit++;
  if (p.hasIntlExp === true && p.experience >= 2) qmasCrit++;
  if (p.income >= 1000000) qmasCrit++;
  if (p.companyType === 'enterprise_owner' && p.capital >= 5000000) qmasCrit++;
  if (p.hasIP === true) qmasCrit++;
  if (qmasCrit >= 6) scores.qmas = (scores.qmas||0) + 50;

  // 排序+构建结果
  const sorted = Object.entries(scores)
    .filter(([,s]) => s > 0)
    .sort(([,a],[,b]) => b - a)
    .slice(0, 4);

  const matches = sorted.map(([pathId, score]) => {
    const detail = PATH_PROFILES[pathId] || { name: pathId };
    return {
      pathId,
      name: detail.name,
      score: Math.min(score, 100),
      confidence: score >= 80 ? 'high' : score >= 50 ? 'medium' : 'low',
      passRate: detail.passRate || 0.75,
      riskLevel: detail.riskLevel || 'medium',
      totalCycle: detail.totalCycle || '7-8年',
      requirements: detail.requirements || [],
      notes: detail.notes || [],
      firstVisa: detail.firstVisa || null
    };
  });

  // 保存推荐结果
  if (openid) {
    try {
      await db.collection('solution_results').add({
        data: { _openid: openid, profile: desensitizeProfile(p), matches, createdAt: db.serverDate() }
      });
    } catch (e) { /* 非关键 */ }
  }

  return {
    code: 0,
    data: {
      matches,
      topPick: matches[0] || null,
      alternatives: matches.slice(1),
      totalMatched: matches.length
    }
  };
}

/**
 * SR-03: 方案路径对比
 */
async function comparePaths(pathIds) {
  if (!pathIds || pathIds.length < 2) return { code: 400, msg: '至少需要2条路径进行对比' };

  const profiles = pathIds.map(id => {
    const detail = PATH_PROFILES[id];
    return detail ? {
      pathId: id,
      name: detail.name,
      riskLevel: detail.riskLevel,
      totalCycle: detail.totalCycle,
      passRate: detail.passRate,
      requirements: detail.requirements,
      notes: detail.notes
    } : { pathId: id, name: id, riskLevel: 'unknown' };
  });

  // 添加决策节点对比
  const decisionComparisons = {
    dp2_student_to_work: [
      { option:'A', label:'IANG', passRate:'>95%', cycle:'2+2+3', risk:'低', note:'不绑雇主' },
      { option:'B', label:'优才', passRate:'~70%', cycle:'2+3+3', risk:'中', note:'需12准则≥6' }
    ],
    dp3_renewal_strategy: [
      { option:'A', label:'雇主续签', passRate:'高', risk:'低', note:'需ID990B' },
      { option:'B', label:'自雇续签', passRate:'中高', risk:'中', note:'注册公司+实际运营' }
    ]
  };

  return {
    code: 0,
    data: {
      paths: profiles,
      comparisons: decisionComparisons,
      comparisonDimensions: ['审批周期', '成本', '自由度', '风险等级', '续签难度']
    }
  };
}

async function getPathDetail(pathId) {
  const detail = PATH_PROFILES[pathId];
  if (!detail) return { code: 404, msg: '路径不存在' };
  return { code: 0, data: { pathId, ...detail } };
}

async function listAllPaths() {
  const all = Object.entries(PATH_PROFILES).map(([id, p]) => ({
    pathId: id, name: p.name, riskLevel: p.riskLevel,
    totalCycle: p.totalCycle, passRate: p.passRate, confidence: p.confidence
  }));
  return { code: 0, data: { total: all.length, paths: all } };
}

function desensitizeProfile(profile) {
  const safe = {};
  const keep = ['age','education','major','industry','experience','income','capital','studyType','eligibleSchool','hasIntlExp','hasKids','companyType','hasFamous','hasIP'];
  for (const k of keep) { if (profile[k] !== undefined) safe[k] = profile[k]; }
  return safe;
}
