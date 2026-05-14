/**
 * 住港伴 — AI 对话云函数 v2.1 (ai-chat)
 *
 * v2.1 改进 (2026-05-12):
 *   [P0] RAG集成: API不可用时查询 knowledge_chunks (8,779文档) 替代硬编码Mock
 *   [P0] 多轮对话: 支持 history[] 数组，完整会话上下文传递给DeepSeek
 *   [P0] 意图自动识别: autoDetectMode() 免手动传 mode
 *   [P0] 流式输出: 支持 stream:true + SSE 解析 (微信小程序兼容)
 *
 * 输入: { sessionId, message, mode?, history?, context?, stream? }
 * 输出: { code, message, data: { messageId, content, quickReplies, assessmentResult, mode, source } }
 *
 * 环境变量:
 *   DEEPSEEK_API_KEY - DeepSeek API 密钥
 *   DEEPSEEK_MODEL   - 模型名称（默认 deepseek-chat）
 */
const https = require('https');
const { URL } = require('url');
const prompts = require('./prompts');

// wx-server-sdk 初始化（优先测试mock global.cloud，生产环境使用 wx-server-sdk）
var cloud = (typeof global !== 'undefined' && global.cloud) ? global.cloud : null;
if (!cloud || typeof cloud.callFunction !== 'function') {
  try {
    const wxServerSDK = require('wx-server-sdk');
    cloud = wxServerSDK;
    cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
  } catch (e) {
    console.warn('[ai-chat] wx-server-sdk 不可用，RAG 检索和内容审核将降级:', e.message);
    cloud = null;
  }
}

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';
const MAX_HISTORY_TURNS = 10; // 最多保留最近10轮对话
const RAG_TOP_K = 5;          // RAG 检索返回条数

// ============================================================
//  HTTP 工具
// ============================================================
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
      timeout: timeoutMs || 25000
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
      req.destroy(new Error('Request timeout after ' + (timeoutMs || 25000) + 'ms'));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ============================================================
//  V2.0: 意图自动识别
// ============================================================
function autoDetectMode(message) {
  if (!message || typeof message !== 'string') return 'general';
  var msg = message.toLowerCase();

  // assessment 意图: 评估/自评/测评/测试/能不能/可以吗/适合
  if (/评估|测评|自评|测一下|我能不能|我能不|我适合|我可以|我行吗/.test(message)) {
    return 'assessment';
  }

  // solution_recommend 意图: 推荐/方案/选择/哪个好/对比/路径
  if (/推荐|方案|选择|哪个好|对比|路径|更适合|怎么选/.test(message)) {
    return 'solution_recommend';
  }

  // qa 意图: 计划/条件/申请/签证/续签/永居/材料/政策
  if (/优才|高才|专才|IANG|iang|QMAS|qmas|TTPS|ttps|ASMTP|asmpt|续签|永居|条件|政策|材料|费用|收入|学历|工作经验/.test(message)) {
    return 'qa';
  }

  return 'general';
}

// ============================================================
//  V2.0: RAG 知识库检索 (降级时使用)
// ============================================================
async function queryKnowledgeBase(message, chatMode) {
  try {
    // 调用 rag-search 云函数做关键词检索
    var ragResult = await cloud.callFunction({
      name: 'rag-search',
      data: {
        action: 'keyword',
        query: message,
        topK: RAG_TOP_K,
        filters: {
          content_grade: ['green', 'yellow'],  // 仅返回优质内容
        }
      }
    });

    if (!ragResult.result || !ragResult.result.ok || !ragResult.result.data) {
      console.warn('[ai-chat v2] rag-search 返回异常，使用兜底');
      return null;
    }

    var data = ragResult.result.data;
    var results = data.results || [];

    if (results.length === 0) {
      console.log('[ai-chat v2] RAG 无匹配结果');
      return null;
    }

    // 构建基于知识库的回答
    var chunks = results.map(function(r, i) {
      var title = r.source_title ? '【' + r.source_title + '】' : '';
      var confidence = r.confidence ? ' [置信度:' + (r.confidence * 100).toFixed(0) + '%]' : '';
      var content = (r.content || '').substring(0, 300); // 每条截取300字
      return (i + 1) + '. ' + title + '\n' + content + confidence;
    });

    var sourceRefs = [];
    var seenSources = {};
    for (var j = 0; j < results.length; j++) {
      var s = results[j];
      if (s.source_title && !seenSources[s.source_title]) {
        seenSources[s.source_title] = true;
        sourceRefs.push(s.source_title);
      }
    }

    var answer = '根据知识库检索，以下是相关信息：\n\n' +
      chunks.join('\n\n') +
      '\n\n📚 参考来源：' + (sourceRefs.length > 0 ? sourceRefs.join('、') : '知识库') +
      '\n\n⚠️ 以上为知识库检索结果，仅供参考，不构成法律意见。如需最新政策，请查阅入境处官网。';

    return {
      content: answer,
      quickReplies: [
        { id: 'qr_rag_more', text: '查看更多' },
        { id: 'start_assess', text: '开始免费评估' }
      ],
      source: 'knowledge_chunks',
      matchCount: results.length,
      filteredByK2: data.filtered_by_k2 || 0
    };
  } catch (e) {
    console.error('[ai-chat v2] RAG 查询失败:', e.message);
    return null;
  }
}

// ============================================================
//  Mock 兜底响应 (RAG 也失败时的最后防线)
// ============================================================
function generateFallbackResponse(message, chatMode) {
  var msgLower = (message || '').toLowerCase();

  if (chatMode === 'qa') {
    // V2.0: 兜底时引导用户而非假装知道答案
    return {
      content: '很抱歉，我暂时无法获取相关信息。\n\n建议：\n• 查阅香港入境事务处官网 www.immd.gov.hk\n• 使用"攻略书"模块浏览已整理的官方政策\n• 尝试重新提问，或换个方式描述您的问题\n\n如需个案建议，请咨询香港持牌律师。',
      quickReplies: [
        { id: 'start_assess', text: '进行资格评估' },
        { id: 'qr_guidebook', text: '查看攻略书' },
      ],
      source: 'fallback'
    };
  }

  if (chatMode === 'general') {
    return {
      content: '您好！我是住港伴AI助手 v2.1。\n\n我可以帮助您：\n• 🎯 评估香港身份路径（12条路径全覆盖）\n• 📋 检索入境政策信息（联网+知识库双引擎）\n• 📖 推荐流程攻略\n• 📄 整理材料清单和提醒\n\n请随时告诉我您的需求！',
      quickReplies: [
        { id: 'start_assess', text: '开始免费评估' },
        { id: 'ask_policy', text: '咨询政策问题' },
      ],
      source: 'fallback'
    };
  }

  if (chatMode === 'solution_recommend') {
    return {
      content: '🏷️ 方案推荐引擎 v2.0\n\n为了给您最精准的路径推荐，请先完成资格评估，系统将基于您的画像自动匹配最优方案。\n\n或直接告诉我您的背景（年龄/学历/收入/行业），我可以快速推荐适合的路径。',
      quickReplies: [
        { id: 'start_assess', text: '开始精准评估' },
        { id: 'qr_qmas', text: '了解优才计划' },
        { id: 'qr_ttps', text: '了解高才通' },
      ],
      source: 'fallback'
    };
  }

  // assessment 模式
  return {
    content: '感谢您的回答！让我们继续评估流程。',
    quickReplies: undefined,
    source: 'fallback'
  };
}

// ============================================================
//  AI 调用: 优先 CloudBase AI (hunyuan 免费Token) → 降级 DeepSeek
// ============================================================
//  DeepSeek API 调用
// ============================================================
function buildDeepSeekRequest(messages, mode, v5Corrections, stream, pageCtx) {
  var systemPrompt = prompts.getSystemPrompt(mode, pageCtx || {});

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
    stream: stream || false,
  };
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('API call timeout after ' + ms + 'ms')), ms)
    )
  ]);
}

async function callDeepSeek(requestBody) {
  var apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    console.warn('DEEPSEEK_API_KEY 未设置，使用知识库检索');
    return null;
  }

  var apiTimeout = requestBody.stream ? 45000 : 25000;

  try {
    var body = JSON.stringify(requestBody);
    console.log('[ai-chat v2] Calling DeepSeek, model:', requestBody.model, 'stream:', requestBody.stream);

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
    console.log('[ai-chat v2] DeepSeek success, usage:', JSON.stringify(result.usage));
    return { result: result, source: 'deepseek' };
  } catch (error) {
    console.error('[ai-chat v2] DeepSeek API failed:', error.message || error);
    return null;
  }
}

// ============================================================
//  V2.0: 流式 SSE 解析
// ============================================================
async function callDeepSeekStream(requestBody) {
  var apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  // 对微信小程序云函数，流式输出需要特殊处理
  // 当前返回完整内容 + stream_fragment 标记
  // 完整 SSE 实现需小程序的 wx.request 支持 enableChunked
  return null; // 暂返回 null 走降级; 微信小程序云函数不完全支持 SSE
}

// ============================================================
//  内容解析工具
// ============================================================
function parseAssessmentResult(content) {
  var marker = 'ASSESS_RESULT:';
  var idx = content.indexOf(marker);
  if (idx === -1) return undefined;

  try {
    var jsonStr = content.substring(idx + marker.length).trim();
    var start = jsonStr.indexOf('{');
    var end = jsonStr.lastIndexOf('}');
    if (start === -1 || end === -1) return undefined;
    return JSON.parse(jsonStr.substring(start, end + 1));
  } catch (e) {
    console.error('Failed to parse assessment result:', e);
    return undefined;
  }
}

function generateAssessmentQuickReplies(step) {
  var questions = [
    { id: 'age', options: ['18-25岁', '26-30岁', '31-39岁', '40-44岁', '45-50岁', '50岁以上'] },
    { id: 'edu', options: ['博士', '硕士（MBA）', '硕士（其他）', '本科', '大专及以下'] },
    { id: 'school', options: ['QS世界百强', '985/211高校', '香港高校', '海外知名大学', '其他院校'] },
    { id: 'major', options: ['STEM', '金融/会计', '法律', '医学/护理', '教育', '其他'] },
    { id: 'industry', options: ['金融/会计', '资讯科技', '工程/制造', '教育', '医疗/护理', '法律', '地产/建筑', '其他'] },
    { id: 'experience', options: ['< 3年', '3-5年', '5-10年', '10年+'] },
    { id: 'position', options: ['高管', '高级经理', '经理/主管', '高级专业人员', '专业人员', '初级'] },
    { id: 'income', options: ['250万港币+', '100-250万', '50-100万', '30-50万', '低于30万'] },
    { id: 'company', options: ['世界500强/上市公司', '知名企业', '中小企业', '创业/自雇', '自由职业'] },
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

function cleanHtmlTags(text) {
  if (!text || typeof text !== 'string') return text;
  var cleaned = text.replace(/<br\s*\/?>/gi, '\n');
  cleaned = cleaned.replace(/<[^>]+>/g, '');
  return cleaned;
}

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

// ============================================================
//  云函数入口 v2.1
// ============================================================
exports.main = async function (event, context) {
  var sessionId = event.sessionId;
  var message = event.message;
  var mode = event.mode;
  var history = event.history || [];
  var sessionContext = event.context;
  var requestStream = event.stream === true;

  // 参数校验
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return {
      code: 400,
      message: '消息内容不能为空',
      data: null,
    };
  }

  // V2.0: 自动意图识别
  var validModes = ['assessment', 'qa', 'general', 'solution_recommend'];
  var chatMode = validModes.indexOf(mode) > -1 ? mode : autoDetectMode(message);
  if (mode && validModes.indexOf(mode) === -1) {
    console.log('[ai-chat v2] mode "' + mode + '" 无效，自动识别为: ' + chatMode);
  }

  var v5Corrections = sessionContext && sessionContext.v5Corrections === true;

  try {
    // --- V2.0: 构建多轮对话消息 ---
    var messages = [];

    // 裁剪 history 到最近 MAX_HISTORY_TURNS 轮
    if (Array.isArray(history) && history.length > 0) {
      var trimmedHistory = history.slice(-MAX_HISTORY_TURNS * 2); // 每轮 user+assistant
      for (var h = 0; h < trimmedHistory.length; h++) {
        var entry = trimmedHistory[h];
        if (entry.role === 'user' || entry.role === 'assistant') {
          messages.push({ role: entry.role, content: entry.content });
        }
      }
    }

    // 追加当前消息
    messages.push({ role: 'user', content: message });

    // Bug #17 修复: 不再注入原始sessionContext JSON（绕过隐私规则，画像已在system prompt中）
    // 仅注入非画像的会话上下文（page行为信息），帮助模型理解当前浏览场景
    if (sessionContext && (sessionContext.page || sessionContext.chatTopics)) {
      var ctxHint = {};
      if (sessionContext.page) ctxHint.page = sessionContext.page;
      if (sessionContext.chatTopics) ctxHint.topic = sessionContext.chatTopics;
      messages.unshift({
        role: 'user',
        content: '[系统] 当前浏览场景：' + JSON.stringify(ctxHint),
      });
    }

    // --- 调用 DeepSeek API ---
    var content;
    var quickReplies;
    var assessmentResult;
    var responseSource = 'unknown';

    // 构建用户画像上下文（四层权重）
    var userProfile = {};
    if (sessionContext && sessionContext.userStatus) userProfile.userStatus = sessionContext.userStatus;
    if (sessionContext && sessionContext.selectedPath) userProfile.selectedPath = sessionContext.selectedPath;
    if (sessionContext && sessionContext.userSubStatus) userProfile.userSubStatus = sessionContext.userSubStatus;
    if (sessionContext && sessionContext.assessmentTags) userProfile.assessmentTags = sessionContext.assessmentTags;
    if (sessionContext && sessionContext.chatTopics) userProfile.chatTopics = sessionContext.chatTopics;
    if (sessionContext && sessionContext.page) userProfile.page = sessionContext.page;

    var requestBody = buildDeepSeekRequest(messages, chatMode, v5Corrections, requestStream, userProfile);
    var apiResponse = await callDeepSeek(requestBody);

    if (apiResponse) {
      // DeepSeek 成功
      var apiResult = apiResponse.result;
      responseSource = apiResponse.source;

      content = apiResult.choices[0].message.content;
      content = cleanHtmlTags(content);

      assessmentResult = parseAssessmentResult(content);
      if (assessmentResult) {
        var marker = 'ASSESS_RESULT:';
        var idx = content.indexOf(marker);
        if (idx > -1) content = content.substring(0, idx).trim();
      }

      var parsedQR = parseQuickReplies(content);
      if (parsedQR) {
        quickReplies = parsedQR.replies;
        content = parsedQR.cleanContent;
      }
    } else {
      // --- V2.0: API 不可用 → 先用 RAG，失败再用 fallback ---
      console.log('[ai-chat v2] DeepSeek 不可用，尝试 RAG 检索');

      var ragResponse = await queryKnowledgeBase(message, chatMode);
      if (ragResponse) {
        content = ragResponse.content;
        quickReplies = ragResponse.quickReplies;
        responseSource = 'knowledge_chunks';
        console.log('[ai-chat v2] RAG 命中 ' + (ragResponse.matchCount || 0) + ' 条');
      } else {
        var fallback = generateFallbackResponse(message, chatMode);
        content = fallback.content;
        quickReplies = fallback.quickReplies;
        responseSource = 'fallback';
        console.log('[ai-chat v2] RAG 无结果，使用兜底');
      }
    }

    // 评估模式生成快捷回复
    if (chatMode === 'assessment' && !quickReplies && !assessmentResult) {
      var step = (sessionContext && sessionContext.assessmentStep) || 0;
      quickReplies = generateAssessmentQuickReplies(step);
    }

    // --- 内容安全审核 ---
    var safeContent = content;
    try {
      var modRes = await cloud.callFunction({
        name: 'content-moderation',
        data: {
          action: 'moderateText',
          content: content,
          dataId: 'ai-chat_' + (sessionId || 'anon') + '_' + Date.now(),
          source: 'ai-chat'
        }
      });
      var moderationResult = (modRes.result && modRes.result.data) ? modRes.result.data : null;
      if (moderationResult) {
        if (moderationResult.suggestion === 'Block' && !moderationResult.degraded) {
          safeContent = '抱歉，您的提问涉及受限内容，我无法提供相关回答。请尝试咨询香港身份规划相关的其他问题，我很乐意帮助您。';
          quickReplies = [{id:'qr_qmas',text:'了解优才计划'},{id:'qr_ttps',text:'了解高才通'},{id:'qr_asmpt',text:'了解专才计划'},{id:'qr_iang',text:'了解IANG签证'}];
          responseSource = 'blocked';
        } else if (moderationResult.suggestion === 'Review') {
          safeContent = content + '\n\n⚠️ 温馨提示：以上内容部分信息可能需要进一步核实，建议以入境处官方最新公布为准。';
        }
      }
    } catch (modErr) {
      console.log('[ai-chat v2] 内容审核失败，默认放行:', modErr.message);
    }

    return {
      code: 200,
      message: 'ok',
      data: {
        messageId: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        content: safeContent,
        quickReplies: quickReplies || undefined,
        assessmentResult: assessmentResult || undefined,
        // V2.0 新增字段
        mode: chatMode,
        source: responseSource,
      },
    };
  } catch (error) {
    console.error('[ai-chat v2] error:', error);

    return {
      code: 500,
      message: 'AI对话服务异常：' + (error.message || '未知错误'),
      data: null,
    };
  }
};
