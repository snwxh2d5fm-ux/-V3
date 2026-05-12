/**
 * 住港伴 — AI 文档生成云函数 (ai-doc-gen)
 * 接收文档类型和用户信息，生成赴港相关文档初稿。
 * 支持模板生成 + DeepSeek AI 增强生成。
 *
 * 支持的文档类型：
 * - statement_plan: 赴港计划书
 * - recommendation: 推荐信
 * - work_proof: 工作证明
 *
 * 输入: { docType, userLabels, extraInfo }
 * 输出: { draftId, content, format, reviewNotes, aiDisclaimer }
 *
 * ⚠️ 合规声明：所有AI生成的文档均标注「AI辅助生成」属性。
 *
 * 源自: 住港伴-miniapp/src/cloud/functions/ai-doc-gen/index.js
 * 适配: 原生小程序框架 + CommonJS
 */
var https = require('https');
var { URL } = require('url');
var templates = require('./templates');

var DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';

function httpPostJson(url, body, headers) {
  return new Promise(function (resolve, reject) {
    var parsedUrl = new URL(url);
    var options = {
      method: 'POST',
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: Object.assign({
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body, 'utf8')
      }, headers || {})
    };

    var req = https.request(options, function (res) {
      var data = '';
      res.on('data', function (chunk) { data += chunk; });
      res.on('end', function () {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          text: async function () { return data; },
          json: async function () { return JSON.parse(data); }
        });
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * 构建 DeepSeek 文档生成请求
 */
function buildDocGenRequest(docType, userLabels, extraInfo) {
  var labelSummary = userLabels.map(function (l) {
    return l.category + ':' + l.label;
  }).join('、');

  var docTypeNames = {
    'statement_plan': '赴港计划书',
    'recommendation': '推荐信',
    'work_proof': '工作证明',
  };

  var docTypeName = docTypeNames[docType] || '文档';

  var systemPrompt = '你是一位专业的香港入境申请文书撰写助手，擅于撰写高质量的申请文档。\n\n' +
    '请根据以下用户信息撰写一份' + docTypeName + '：\n' +
    '格式要求：正式、专业、完整，符合香港入境事务处的规范。\n' +
    '语言：中文（繁体或简体均可）。\n' +
    '不要添加占位符，所有内容应该根据用户信息尽量填充完整。';

  var userPrompt = '文档类型：' + docTypeName + '\n\n';

  if (labelSummary) {
    userPrompt += '用户标签信息：' + labelSummary + '\n';
  }

  if (extraInfo.position) {
    userPrompt += '当前职位：' + extraInfo.position + '\n';
  }

  if (extraInfo.coreAchievements) {
    userPrompt += '核心成就：' + extraInfo.coreAchievements + '\n';
  }

  if (extraInfo.additionalInfo) {
    userPrompt += '补充信息：' + extraInfo.additionalInfo + '\n';
  }

  userPrompt += '\n请直接输出完整的文档内容，无需额外说明。';

  return {
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.8,
    max_tokens: 4096,
  };
}

/**
 * 调用 DeepSeek API
 */
async function callDeepSeek(requestBody) {
  var apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    console.warn('DEEPSEEK_API_KEY 未设置，使用模板生成');
    return null;
  }

  try {
    var body = JSON.stringify(requestBody);
    var response;

    if (typeof fetch === 'function') {
      response = await fetch(DEEPSEEK_BASE_URL + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey,
        },
        body: body,
      });
    } else {
      response = await httpPostJson(DEEPSEEK_BASE_URL + '/chat/completions', body, {
        'Authorization': 'Bearer ' + apiKey
      });
    }

    if (!response.ok) {
      var errorText = await response.text();
      throw new Error('DeepSeek API error: ' + response.status + ' ' + errorText);
    }

    var result = await response.json();
    return result;
  } catch (error) {
    console.error('DeepSeek API call failed:', error);
    return null;
  }
}

/**
 * 解析 AI 生成的文档内容
 */
function parseGeneratedContent(apiResult) {
  if (!apiResult || !apiResult.choices || apiResult.choices.length === 0) {
    return null;
  }

  var content = apiResult.choices[0].message.content;

  return {
    content: content + templates.AI_DISCLAIMER,
    format: 'text',
    aiDisclaimer: true,
    reviewNotes: [
      '⚠️ 此为AI生成的初稿，仅供参考。请自行核对并对照入境处官方要求',
      '请核查所有个人信息的准确性',
      '确认文档格式符合入境处要求',
      '所有陈述必须有可验证的真实经历支撑——入境处对弄虚作假零容忍',
    ],
  };
}

// ============ 主入口 ============

/**
 * 云函数入口
 */
exports.main = async function (event, context) {
  var docType = event.docType;
  var userLabels = event.userLabels;
  var extraInfo = event.extraInfo;

  // 参数校验
  var validDocTypes = ['statement_plan', 'recommendation', 'work_proof'];
  if (!docType || validDocTypes.indexOf(docType) === -1) {
    return {
      code: 400,
      message: '不支持的文档类型：' + (docType || '未知') + '。支持的类型：' + validDocTypes.join(', '),
      data: null,
    };
  }

  if (!userLabels || !Array.isArray(userLabels)) {
    return {
      code: 400,
      message: '用户标签不能为空',
      data: null,
    };
  }

  if (!extraInfo || typeof extraInfo !== 'object') {
    return {
      code: 400,
      message: '补充信息不能为空',
      data: null,
    };
  }

  try {
    var result;

    // 1. 尝试使用 AI 增强生成
    var requestBody = buildDocGenRequest(docType, userLabels, extraInfo);
    var apiResult = await callDeepSeek(requestBody);

    if (apiResult) {
      var parsed = parseGeneratedContent(apiResult);
      if (parsed) {
        result = parsed;
      }
    }

    // 2. AI 不可用时使用模板生成
    if (!result) {
      switch (docType) {
        case 'statement_plan':
          result = templates.generateStatementPlan(userLabels, extraInfo);
          break;
        case 'recommendation':
          result = templates.generateRecommendation(userLabels, extraInfo);
          break;
        case 'work_proof':
          result = templates.generateWorkProof(userLabels, extraInfo);
          break;
        default:
          throw new Error('未知文档类型：' + docType);
      }
    }

    return {
      code: 200,
      message: 'ok',
      data: {
        draftId: 'draft_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        content: result.content,
        format: result.format,
        reviewNotes: result.reviewNotes,
        aiDisclaimer: result.aiDisclaimer || true,
        estimatedCost: '免费（AI辅助生成）',
      },
    };
  } catch (error) {
    console.error('ai-doc-gen error:', error);

    return {
      code: 500,
      message: '文档生成服务异常：' + (error.message || '未知错误'),
      data: null,
    };
  }
};
