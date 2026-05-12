/**
 * 住港伴 — AI 对话云函数 (ai-chat)
 * 接收用户消息，调用 DeepSeek API 生成AI回复。
 * 基于 mode 参数使用不同的系统提示词。
 *
 * 输入: { sessionId, message, mode, context }
 * 输出: { messageId, content, quickReplies, assessmentResult }
 *
 * 环境变量:
 *   DEEPSEEK_API_KEY - DeepSeek API 密钥
 *   DEEPSEEK_MODEL   - 模型名称（默认 deepseek-chat）
 *
 * 源自: 住港伴-miniapp/src/cloud/functions/ai-chat/index.js
 * 适配: 原生小程序框架 + CommonJS
 */
const https = require('https');
const { URL } = require('url');
const prompts = require('./prompts');

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';

function httpPostJson(url, body, headers, timeoutMs) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      method: 'POST',
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: Object.assign({
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body, 'utf8')
      }, headers || {}),
      timeout: timeoutMs || 20000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          text: async () => data,
          json: async () => JSON.parse(data)
        });
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('Request timeout after ' + (timeoutMs || 20000) + 'ms'));
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * 构建 DeepSeek API 请求 (V5: 新增 solution_recommend 模式)
 */
function buildDeepSeekRequest(messages, mode, v5Corrections) {
  var systemPrompt = prompts.getSystemPrompt(mode);

  // V5/V6修正: 追加P0法律修正 + 反旧计分护栏
  if (v5Corrections) {
    systemPrompt += '\n\n[系统指令V5/V6修正 — 最高优先级] 以下修正必须覆盖训练数据中的旧信息:\n' +
      '1. 学生签证可带受养人(配偶+子女)，受养人不得在港工作 [A级，Cap.115]\n' +
      '2. 全日制非本地学生工作限制已于2023/2024年暂时取消(须申请NOL) [A级]\n' +
      '3. Cap.115: s.11(8)=处长酌情权(非s.2A)，s.38A=虚假陈述(非s.42) [A级]\n' +
      '4. 兼读制学生不能申请IANG [A级]\n' +
      '5. 使用"身份规划"描述流程，禁用"移民"字眼\n' +
      '6. 【V6反旧计分】优才2024.11改革: 旧综合计分制(80-120分)已废除, 现为12项是/否准则(≥6即可)。严禁提及"分数""打分""计分""80分/100分/120分"等旧概念！';
  }

  return {
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    messages: [
      { role: 'system', content: systemPrompt }
    ].concat(messages),
    temperature: 0.7,
    max_tokens: 2048,
    stream: false,
  };
}

/**
 * 带超时的 Promise 包装
 */
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('API call timeout after ' + ms + 'ms')), ms)
    )
  ]);
}

/**
 * 调用 DeepSeek API
 */
async function callDeepSeek(requestBody) {
  var apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    console.warn('DEEPSEEK_API_KEY 未设置，使用模拟响应');
    return null;
  }

  var apiTimeout = 25000; // 25秒超时，留5秒给云函数处理返回

  try {
    var body = JSON.stringify(requestBody);
    console.log('Calling DeepSeek API, model:', requestBody.model, 'timeout:', apiTimeout + 'ms');
    var response;

    if (typeof fetch === 'function') {
      var fetchPromise = fetch(DEEPSEEK_BASE_URL + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey,
        },
        body: body,
      });
      response = await withTimeout(fetchPromise, apiTimeout);
    } else {
      response = await httpPostJson(DEEPSEEK_BASE_URL + '/chat/completions', body, {
        'Authorization': 'Bearer ' + apiKey
      }, apiTimeout);
    }

    if (!response.ok) {
      var errorText = await response.text();
      throw new Error('DeepSeek API error: ' + response.status + ' ' + errorText);
    }

    var result = await response.json();
    console.log('DeepSeek API success, usage:', JSON.stringify(result.usage));
    return result;
  } catch (error) {
    console.error('DeepSeek API call failed:', error.message || error);
    return null;
  }
}

/**
 * 解析评估结果 JSON（从AI回复中提取）
 */
function parseAssessmentResult(content) {
  var marker = 'ASSESS_RESULT:';
  var idx = content.indexOf(marker);

  if (idx === -1) return undefined;

  try {
    var jsonStr = content.substring(idx + marker.length).trim();
    var start = jsonStr.indexOf('{');
    var end = jsonStr.lastIndexOf('}');
    if (start === -1 || end === -1) return undefined;

    var result = JSON.parse(jsonStr.substring(start, end + 1));
    return result;
  } catch (e) {
    console.error('Failed to parse assessment result:', e);
    return undefined;
  }
}

/**
 * 生成评估模式下的快捷回复选项
 */
function generateAssessmentQuickReplies(step) {
  var questions = [
    { id: 'age', options: ['18-25岁', '26-30岁', '31-39岁', '40-44岁', '45-50岁', '50岁以上'] },
    { id: 'edu', options: ['博士', '硕士（MBA）', '硕士（其他）', '本科', '大专及以下'] },
    { id: 'school', options: ['QS世界百强', '985/211高校', '香港高校', '海外知名大学', '其他院校'] },
    { id: 'major', options: ['STEM（科学/技术/工程/数学）', '金融/会计', '法律', '医学/护理', '教育', '其他'] },
    { id: 'industry', options: ['金融/会计', '资讯科技', '工程/制造', '教育', '医疗/护理', '法律', '地产/建筑', '其他'] },
    { id: 'experience', options: ['< 3年', '3-5年', '5-10年', '10年+'] },
    { id: 'position', options: ['高管（CXO/VP/Director）', '高级经理/团队负责人', '经理/主管', '高级专业人员', '专业人员', '初级'] },
    { id: 'income', options: ['250万港币+', '100-250万', '50-100万', '30-50万', '低于30万'] },
    { id: 'company', options: ['世界500强/上市公司', '知名企业/行业龙头', '中小企业', '创业/自雇', '自由职业'] },
    { id: 'language', options: ['中文（母语）', '英语（流利）', '英语（一般）', '粤语', '其他外语'] },
    { id: 'family', options: ['单身', '已婚无子女', '已婚有子女（1个）', '已婚有子女（2个+）'] },
  ];

  if (step >= 0 && step < questions.length) {
    return questions[step].options.map(function (text, i) {
      return { id: questions[step].id + '_' + i, text: text };
    });
  }

  return undefined;
}

/**
 * 生成模拟响应（当API不可用时）
 */
function generateMockResponse(message, mode) {
  var msgLower = message.toLowerCase();

  if (mode === 'qa') {
    if (msgLower.indexOf('优才') > -1 || msgLower.indexOf('qmas') > -1) {
      return {
        content: '根据入境处最新版优才计划（2025年11月更新），申请采用12项准则评估制，满足≥6项即可申请。\n\n12项准则涵盖：年龄、学历、工作经验、语言能力、年收入、业务所有权等六大范畴。\n\n来源：入境处官网《优秀人才入境计划》',
        quickReplies: [
          { id: 'qr_qmas_detail', text: '了解更多优才细则' },
          { id: 'qr_compare', text: '对比其他计划' },
        ],
      };
    }
    if (msgLower.indexOf('高才通') > -1 || msgLower.indexOf('ttps') > -1) {
      return {
        content: '高才通计划分为A/B/C三类：\n\n• A类：过去一年收入≥250万港币\n• B类：QS百强本科毕业+3年工作经验\n• C类：QS百强本科毕业（<3年经验，限额1万）\n\n来源：入境处官网《高端人才通行证计划》',
        quickReplies: [
          { id: 'qr_ttps_renew', text: '续签条件' },
          { id: 'qr_ttps_apply', text: '申请材料' },
        ],
      };
    }
    if (msgLower.indexOf('专才') > -1 || msgLower.indexOf('asmpt') > -1) {
      return {
        content: '专才计划（输入内地人才计划）需要先获得香港雇主聘用，由雇主提出申请。适合有明确香港工作机会的人士。\n\n来源：入境处官网《输入内地人才计划》',
        quickReplies: [
          { id: 'qr_asmpt_detail', text: '申请条件和流程' },
          { id: 'qr_compare', text: '对比优才/高才通' },
        ],
      };
    }
    return {
      content: '我理解了您的问题，相关政策信息正在检索中。建议您查阅香港入境事务处官方网站（www.immd.gov.hk）获取最新、最准确的官方信息。\n\n如需个案建议，请咨询香港持牌律师。',
      quickReplies: [
        { id: 'qr_start_assess', text: '进行资格评估' },
        { id: 'qr_more_qa', text: '继续提问' },
      ],
    };
  }

  if (mode === 'general') {
    return {
      content: '您好！我是住港伴AI助手 v4.1。\n\n基于V5置信度知识库，我可以帮助您：\n• 🎯 评估香港身份路径\n• 📋 检索入境政策信息\n• 📖 推荐流程攻略\n• 📄 整理材料清单和提醒\n\n请随时告诉我您的需求！',
      quickReplies: [
        { id: 'start_assess', text: '开始免费评估' },
        { id: 'ask_policy', text: '咨询政策问题' },
      ],
    };
  }

  if (mode === 'solution_recommend') {
    return {
      content: '🏷️ 方案推荐引擎 v1.0\n\n基于您的画像，推荐以下路径（按匹配度排序）：\n\n1. 优才QMAS — 匹配度85% (7-8年，中低风险)\n   适合在职专业人士，12项准则≥6即可申请\n\n2. 高才通B类 — 匹配度70% (7年，低风险)\n   需合资格大学学士+3年工作经验\n\n3. 专才ASMTP — 匹配度50% (7年，中风险)\n   需香港雇主sponsor\n\n⚠️ 以上推荐基于确定性规则匹配，不构成法律意见。\n\n建议：点击"方案推荐"按钮获取更精准的匹配结果。',
      quickReplies: [
        { id: 'qr_qmas', text: '优才计划详解' },
        { id: 'qr_ttps', text: '高才通详解' },
      ],
    };
  }

  // 评估模式 - 默认回复
  return {
    content: '感谢您的回答！让我们继续评估流程。',
    quickReplies: undefined,
  };
}

/**
 * V4.1: 清洗 AI 回复中的 HTML 标签
 */
function cleanHtmlTags(text) {
  if (!text || typeof text !== 'string') return text;
  // 替换 <br>, <br/>, <br /> 为换行
  var cleaned = text.replace(/<br\s*\/?>/gi, '\n');
  // 去掉其他 HTML 标签
  cleaned = cleaned.replace(/<[^>]+>/g, '');
  return cleaned;
}

/**
 * V4.1: 解析 AI 回复中的 quick_replies JSON 块
 * 格式: ```quick_replies\n[...]\n```
 */
function parseQuickReplies(content) {
  var marker = '```quick_replies';
  var idx = content.indexOf(marker);
  if (idx === -1) return null;

  var afterMarker = content.substring(idx + marker.length);
  var endIdx = afterMarker.indexOf('```');
  if (endIdx === -1) return null;

  var jsonStr = afterMarker.substring(0, endIdx).trim();
  try {
    var replies = JSON.parse(jsonStr);
    if (!Array.isArray(replies) || replies.length === 0) return null;
    var cleanContent = content.substring(0, idx).trim();
    return { replies: replies, cleanContent: cleanContent };
  } catch(e) {
    console.warn('parseQuickReplies failed:', e.message);
    return null;
  }
}

/**
 * 云函数入口
 */
exports.main = async function (event, context) {
  var sessionId = event.sessionId;
  var message = event.message;
  var mode = event.mode;
  var sessionContext = event.context;

  // 参数校验
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return {
      code: 400,
      message: '消息内容不能为空',
      data: null,
    };
  }

  var validModes = ['assessment', 'qa', 'general', 'solution_recommend'];
  var chatMode = validModes.indexOf(mode) > -1 ? mode : 'general';

  // V5: 检测是否需要P0修正增强
  var v5Corrections = sessionContext && sessionContext.v5Corrections === true;

  try {
    // 构建消息历史
    var messages = [
      { role: 'user', content: message },
    ];

    // 如果有上下文信息，追加到用户消息中
    if (sessionContext && Object.keys(sessionContext).length > 0) {
      messages.unshift({
        role: 'user',
        content: '用户已知信息：' + JSON.stringify(sessionContext, null, 2),
      });
    }

    // 调用 DeepSeek API (V5: 传入v5Corrections标记)
    var requestBody = buildDeepSeekRequest(messages, chatMode, v5Corrections);
    var apiResult = await callDeepSeek(requestBody);

    var content;
    var quickReplies;
    var assessmentResult;

    if (apiResult && apiResult.choices && apiResult.choices.length > 0) {
      content = apiResult.choices[0].message.content;

      // 清洗 HTML 标签（DeepSeek 偶尔输出 <br>）
      content = cleanHtmlTags(content);

      // 尝试解析评估结果
      assessmentResult = parseAssessmentResult(content);

      // 如果包含评估结果，去掉 JSON 标记部分
      if (assessmentResult) {
        var marker = 'ASSESS_RESULT:';
        var idx = content.indexOf(marker);
        if (idx > -1) {
          content = content.substring(0, idx).trim();
        }
      }

      // V4.1: 解析 quick_replies JSON 块
      var parsedQR = parseQuickReplies(content);
      if (parsedQR) {
        quickReplies = parsedQR.replies;
        content = parsedQR.cleanContent;
      }
    } else {
      // 降级到模拟响应
      var mock = generateMockResponse(message, chatMode);
      content = mock.content;
      quickReplies = mock.quickReplies;
    }

    // 评估模式下生成快捷回复
    if (chatMode === 'assessment' && !quickReplies && !assessmentResult) {
      var step = (sessionContext && sessionContext.assessmentStep) || 0;
      quickReplies = generateAssessmentQuickReplies(step);
    }

    return {
      code: 200,
      message: 'ok',
      data: {
        messageId: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        content: content,
        quickReplies: quickReplies || undefined,
        assessmentResult: assessmentResult || undefined,
      },
    };
  } catch (error) {
    console.error('ai-chat error:', error);

    return {
      code: 500,
      message: 'AI对话服务异常：' + (error.message || '未知错误'),
      data: null,
    };
  }
};
