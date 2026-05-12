/**
 * 住港伴 — AI 资格评估云函数 (ai-assess)
 * 接收用户的评估答案，综合对照各入境路径条件，
 * 计算得分和匹配度，返回结构化的路径参考结果。
 *
 * 输入: { answers }
 *   answers: { [questionId]: answerText }
 *
 * 输出: { assessmentResult: { recommendedPath, confidence, paths[], gapAnalysis[], estimatedTimeline, estimatedCost, similarCases } }
 *
 * 源自: 住港伴-miniapp/src/cloud/functions/ai-assess/index.js
 * 适配: 原生小程序框架 + CommonJS
 */
var scoring = require('./scoring');

/**
 * 计算差距分析
 */
function computeGapAnalysis(pathResults, answers) {
  var gaps = [];
  var topPath = pathResults[0];

  if (!topPath || !topPath.isQualified) {
    gaps.push('所有路径均未达到理想申请条件');
    return gaps;
  }

  var age = answers.age || '';
  var edu = answers.education || '';
  var school = answers.school || '';
  var income = answers.income || '';
  var lang = answers.language || '';

  // 通用差距
  if (lang.indexOf('流利') === -1 && lang.indexOf('雅思') === -1 && lang.indexOf('托福') === -1) {
    gaps.push('英语能力有待提升，考虑考取雅思/托福成绩');
  }

  if (topPath.pathId === 'qmas') {
    if (topPath.score < 6) {
      gaps.push('优才计划12项准则仅满足' + topPath.score + '项，需要至少6项');
    }
    if (school.indexOf('QS') === -1 && school.indexOf('百强') === -1 && school.indexOf('香港') === -1) {
      gaps.push('若非QS百强或香港高校，优才B1准则（合资格大学硕博）可能不满足');
    }
  }

  if (topPath.pathId === 'ttps') {
    if (income.indexOf('250万') === -1 && topPath.score < 2) {
      gaps.push('高才通A类需要年收入≥250万港币，B/C类需要QS百强学位');
    }
  }

  // 收入差距
  if (income.indexOf('低于30万') > -1) {
    gaps.push('当前收入水平较低，可能影响各路径评估');
  }

  return gaps;
}

/**
 * 估算时间线
 */
function estimateTimeline(pathResults) {
  if (pathResults.length === 0) return '待评估';

  var best = pathResults[0];
  if (best.isQualified) {
    return best.estimatedTimeline || '3-6个月';
  }
  return '6-12个月（需先补充条件）';
}

/**
 * 估算费用
 */
function estimateCost(pathResults) {
  if (pathResults.length === 0) return '待评估';
  return pathResults[0].estimatedCost || 'HKD 1,000 - 10,000';
}

// ============ 主入口 ============

/**
 * 云函数入口
 */
exports.main = async function (event, context) {
  var answers = event.answers;

  // 参数校验
  if (!answers || typeof answers !== 'object' || Object.keys(answers).length === 0) {
    return {
      code: 400,
      message: '评估答案不能为空',
      data: null,
    };
  }

  try {
    // 计算各路径得分
    var results = [
      scoring.scoreQMAS(answers),
      scoring.scoreTTPS(answers),
      scoring.scoreASMPT(answers),
      scoring.scoreIANG(answers),
      scoring.scoreInvestment(answers),
    ];

    // 按概率排序（降序）
    results.sort(function (a, b) { return b.probability - a.probability; });

    // 取最佳路径
    var bestPath = results[0];

    // 格式化成输出结构
    var paths = results.map(function (r) {
      return {
        id: r.pathId,
        name: r.pathName,
        probability: r.probability,
        summary: r.summary,
        score: r.score,
        maxScore: r.maxScore,
        details: r.details,
      };
    });

    // 差距分析
    var gapAnalysis = computeGapAnalysis(results, answers);

    // 估算
    var estimatedTimeline = estimateTimeline(results);
    var estimatedCost = estimateCost(results);

    // 相似案例数
    // 实际应用中应从数据库查询真实案例数
    var similarCases = Math.floor(Math.random() * 80) + 10;

    return {
      code: 200,
      message: 'ok',
      data: {
        assessmentResult: {
          recommendedPath: bestPath.pathId,
          recommendedPathName: bestPath.pathName,
          confidence: bestPath.probability,
          paths: paths,
          gapAnalysis: gapAnalysis,
          estimatedTimeline: estimatedTimeline,
          estimatedCost: estimatedCost,
          similarCases: similarCases,
        },
      },
    };
  } catch (error) {
    console.error('ai-assess error:', error);

    return {
      code: 500,
      message: '评估服务异常：' + (error.message || '未知错误'),
      data: null,
    };
  }
};
