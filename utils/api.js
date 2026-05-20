/**
 * @fileoverview 住港伴 v4.1 — API 接口层 (PRD v3.1)
 * 仅传输脱敏数据到服务端，原始文件永不上传
 * V5新增: 方案库匹配服务、法律条文校验服务
 * @module api
 */
const { desensitizeFields, MODES } = require('./desensitize');

const BASE = 'https://api.zhugangban.com/v1';

/** 构建查询字符串——替代微信不支持的 URLSearchParams */
function buildQuery(params) {
  var parts = [];
  for (var key in params) {
    if (params.hasOwnProperty(key) && params[key] !== undefined && params[key] !== null) {
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
    }
  }
  return parts.length > 0 ? '?' + parts.join('&') : '';
}

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${BASE}${url}`,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${wx.getStorageSync('__token__') || ''}`,
        'X-Privacy-Mode': 'desensitized',
        'X-Engine-Version': '4.1.0'
      },
      timeout: options.timeout || 15000,
      success: (res) => {
        if (res.statusCode === 200) resolve(res.data);
        else reject({ code: res.statusCode, message: res.data });
      },
      fail: reject
    });
  });
}

// 用户认证
async function wechatLogin() {
  const { code } = await wx.login();
  const res = await request('/auth/wechat', { method: 'POST', data: { code } });
  wx.setStorageSync('__token__', res.token);
  return res;
}

async function getPhoneNumber(encryptedData, iv) {
  const res = await request('/auth/phone', { method: 'POST', data: { encryptedData, iv } });
  return res.phoneNumber;
}

// 上报用户状态（脱敏后，含子状态）
async function reportUserStatus(userStatus, subStatus, milestoneData) {
  const safe = desensitizeFields(milestoneData, MODES.FEATURE);
  return await request('/user/status', {
    method: 'PUT',
    data: { userStatus, subStatus, milestone: safe }
  });
}

// 获取指引数据 (V5: 含置信度标注)
async function fetchGuides(nodeId, options = {}) {
  var qs = buildQuery({ confidence: options.confidenceLevel, path: options.pathType });
  return await request('/guides/' + nodeId + qs);
}

// 获取政策更新 (V5: 含影响范围分析)
async function fetchPolicyUpdates(options = {}) {
  var qs = buildQuery({ path: options.pathType, persona: options.personaId });
  return await request('/policies/updates' + qs);
}

// 获取分类攻略内容 (V5: 含置信度标注)
async function fetchPlaybook(scene, page = 1, confidenceLevel) {
  let url = `/playbook/${scene}?page=${page}`;
  if (confidenceLevel) url += `&confidence=${confidenceLevel}`;
  return await request(url);
}

// 互动
async function interact(interpretationId, action) {
  return await request(`/interactions/${interpretationId}/${action}`, { method: 'POST' });
}

// 搜索攻略 (V5: 含置信度过滤)
async function searchPlaybook(query, confidenceLevel) {
  let url = `/playbook/search?q=${encodeURIComponent(query)}`;
  if (confidenceLevel) url += `&confidence=${confidenceLevel}`;
  return await request(url);
}

// 获取预审结果
async function runPreCheck(processType, docFeatures) {
  const safe = desensitizeFields(docFeatures, MODES.FEATURE);
  return await request('/precheck/run', { method: 'POST', data: { processType, features: safe } });
}

// ============ V5新增: 方案库匹配服务 ============

/**
 * 提交方案库路径匹配请求 (云函数: solution-engine / match-engine)
 * @param {object} profile 用户画像特征
 */
async function matchSolutionPath(profile) {
  try {
    const safe = desensitizeFields(profile, MODES.FEATURE);
    const res = await wx.cloud.callFunction({
      name: 'solution-engine',
      data: { action: 'match', profile: safe }
    });
    return res.result;
  } catch (e) {
    // fallback to match-engine
    try {
      const res = await wx.cloud.callFunction({
        name: 'match-engine',
        data: { action: 'matchSolution', profile: desensitizeFields(profile, MODES.FEATURE) }
      });
      return res.result;
    } catch (e2) {
      console.error('[API] 方案库匹配失败:', e2);
      return { code: 500, message: '方案匹配服务不可用' };
    }
  }
}

/**
 * 获取方案库路径详情对比
 * @param {string[]} pathIds 要对比的路径ID列表
 */
async function compareSolutionPaths(pathIds) {
  try {
    const res = await wx.cloud.callFunction({
      name: 'solution-engine',
      data: { action: 'compare', pathIds }
    });
    return res.result;
  } catch (e) {
    return { code: 500, message: '方案对比服务不可用' };
  }
}

// ============ AI 对话服务 (v5: RAG增强+多轮记忆) ============

/**
 * v5.0 增强版: 传递对话历史，启用RAG检索
 * @param {string} sessionId
 * @param {string} message
 * @param {string} mode - general|assessment|qa|solution_recommend
 * @param {object} context - 用户上下文
 * @param {array}  history - 对话历史 [{role,content}]
 */
async function sendChatMessageV5(sessionId, message, mode, context, history) {
  if (!wx.cloud) {
    console.warn('[API] wx.cloud 不可用，返回离线模式');
    return { code: 503, message: '云服务未初始化', data: { content: '抱歉，AI服务需要云环境支持，当前不可用。', sources: [] } };
  }
  try {
    const res = await wx.cloud.callFunction({
      name: 'ai-chat',
      data: {
        sessionId: sessionId || ('sess_' + Date.now()),
        message,
        mode: mode || 'general',
        context: context || {},
        history: history || []
      }
    });
    return res.result;
  } catch (e) {
    console.error('[API] AI对话V5失败:', e);
    return { code: 500, message: 'AI对话服务不可用', data: null };
  }
}

/** v4兼容接口（不传history，向后兼容） */
async function sendChatMessage(sessionId, message, mode, context) {
  return sendChatMessageV5(sessionId, message, mode, context, []);
}

/**
 * v5 流式接口 — HTTP SSE streaming
 * 首字延迟<1.5s，实时渲染
 */
var AI_CHAT_HTTP = 'https://cloudbase-d1g17tgt7cc199a60.service.tcloudbase.com/ai-chat';

function sendChatMessageStream(sessionId, message, mode, context, history, callbacks) {
  var token = wx.getStorageSync('__token__') || '';
  return new Promise(function(resolve, reject) {
    var requestTask = wx.request({
      url: AI_CHAT_HTTP,
      method: 'POST',
      enableChunked: true,
      header: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      data: {
        sessionId: sessionId || ('sess_' + Date.now()),
        message: message,
        mode: mode || 'general',
        context: context || {},
        history: history || [],
        stream: true
      },
      success: function() { /* 流式通过onChunkReceived处理 */ },
      fail: function(err) {
        console.error('[API] Stream request failed:', err);
        // 降级到非流式
        resolve(null);
      }
    });

    var fullContent = '';
    var meta = null;
    var lineBuffer = '';  // S-02 fix: 跨chunk行缓冲，防止JSON被截断

    requestTask.onChunkReceived(function(res) {
      try {
        var text = (res.data || '').toString();
        if (!text) return;
        // 拼接上一次未完整的行
        var raw = lineBuffer + text;
        var lines = raw.split('\n');
        // 最后一行可能不完整，保留到下次
        lineBuffer = lines.pop();
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          if (line.startsWith('data: ')) {
            try {
              var data = JSON.parse(line.substring(6));
              if (data.type === 'meta') {
                meta = data;
                if (callbacks && callbacks.onMeta) callbacks.onMeta(data);
              } else if (data.type === 'token') {
                fullContent += data.content;
                if (callbacks && callbacks.onToken) callbacks.onToken(data.content, fullContent);
              } else if (data.type === 'done') {
                if (callbacks && callbacks.onDone) {
                  callbacks.onDone(fullContent, data);
                }
                resolve({
                  code: 200,
                  data: {
                    messageId: data.trace_id || ('msg_' + Date.now()),
                    content: fullContent,
                    sources: meta ? (meta.sources || []) : [],
                    quickReplies: []
                  }
                });
              } else if (data.type === 'error') {
                reject(new Error(data.message || 'Stream error'));
              }
            } catch(parseErr) {
              console.warn('[API] SSE line parse error:', parseErr.message, 'line:', line.substring(0, 80));
            }
          }
        }
      } catch(e) {
        console.warn('[API] Chunk parse error:', e);
      }
    });
  });
}

/**
 * 提交资格评估 (V5: 方案库对齐版)
 */
async function submitAssessment(answers) {
  try {
    const res = await wx.cloud.callFunction({
      name: 'ai-assess',
      data: { answers, version: 'v5' }
    });
    return res.result;
  } catch (e) {
    console.error('[API] 评估提交失败:', e);
    return { code: 500, message: '评估服务不可用', data: null };
  }
}

async function askPolicyQuestion(question) {
  try {
    const res = await wx.cloud.callFunction({
      name: 'ai-chat',
      data: { sessionId: 'qa_' + Date.now(), message: question, mode: 'qa', context: { confidenceCheck: true } }
    });
    return res.result;
  } catch (e) {
    console.error('[API] 政策问答失败:', e);
    return { code: 500, message: '问答服务不可用', data: null };
  }
}

async function generateDocument(docType, userLabels, extraInfo) {
  try {
    const res = await wx.cloud.callFunction({
      name: 'ai-doc-gen',
      data: { docType, userLabels: userLabels || [], extraInfo: extraInfo || {} }
    });
    return res.result;
  } catch (e) {
    console.error('[API] 文档生成失败:', e);
    return { code: 500, message: '文档生成服务不可用', data: null };
  }
}

// ============ 续签仪表盘服务 ============
async function getDashboardData() {
  return await request('/dashboard/data');
}

// ============ 案例库服务 ============
async function getApprovedCases() {
  return await request('/cases/approved');
}

// ============ 加密上传服务 ============
async function uploadAnonymizedText(encryptedText, metadata) {
  return await request('/upload/anonymized', {
    method: 'POST',
    data: { encryptedText, metadata }
  });
}

// ============ 支付服务 ============
/**
 * 获取会员方案列表（云函数: payment.getPlans）
 */
async function fetchMembershipPlans() {
  try {
    const res = await wx.cloud.callFunction({
      name: 'payment',
      data: { action: 'getPlans' }
    });
    return res.result;
  } catch (e) {
    console.error('[API] 获取方案列表失败:', e);
    return { code: 500, data: [] };
  }
}

/**
 * 创建支付订单（云函数: payment.createOrder）
 * @param {string} planId 方案ID
 * @param {string} period 'yearly' | 'monthly'
 * @returns {{ code:0, data:{ orderId, payment, amount, amountYuan } }}
 */
async function createPaymentOrder(planId, period) {
  try {
    const res = await wx.cloud.callFunction({
      name: 'payment',
      data: { action: 'createOrder', planId, period: period || 'yearly' }
    });
    return res.result;
  } catch (e) {
    console.error('[API] 创建支付订单失败:', e);
    return { code: 500, msg: '支付服务异常' };
  }
}

/**
 * 查询支付订单状态（云函数: payment.getOrderStatus）
 */
async function queryOrderStatus(orderId) {
  try {
    const res = await wx.cloud.callFunction({
      name: 'payment',
      data: { action: 'getOrderStatus', orderId }
    });
    return res.result;
  } catch (e) {
    return { code: 500, msg: '查询失败' };
  }
}

/**
 * 查询会员订阅状态（云函数: payment.checkSubscription）
 */
async function checkMembershipStatus() {
  try {
    const res = await wx.cloud.callFunction({
      name: 'payment',
      data: { action: 'checkSubscription' }
    });
    return res.result;
  } catch (e) {
    return { code: 500, data: { level: 'free', isActive: true } };
  }
}

/**
 * 获取用户订单记录（云函数: payment.getUserOrders）
 */
async function getUserOrders(limit) {
  try {
    const res = await wx.cloud.callFunction({
      name: 'payment',
      data: { action: 'getUserOrders', limit: limit || 10 }
    });
    return res.result;
  } catch (e) {
    return { code: 500, data: [] };
  }
}

/**
 * 获取用户订阅记录（云函数: payment.getSubscriptions）
 */
async function getUserSubscriptions() {
  try {
    const res = await wx.cloud.callFunction({
      name: 'payment',
      data: { action: 'getSubscriptions' }
    });
    return res.result;
  } catch (e) {
    return { code: 500, data: [] };
  }
}

/** @deprecated 使用 createPaymentOrder 替代 */
async function createPayment(planId, amount) {
  return await createPaymentOrder(planId, 'yearly');
}

// ============ 通知服务 ============
async function subscribeTemplateMessage(tmplIds) {
  try {
    const res = await wx.requestSubscribeMessage({ tmplIds });
    return Object.values(res).some(v => v === 'accept');
  } catch (e) {
    return false;
  }
}

// ============ 用户同步服务 ============
async function syncUserProfile(profileData) {
  try {
    return await wx.cloud.callFunction({
      name: 'user-auth',
      data: { action: 'syncProfile', profile: profileData }
    });
  } catch (e) {
    console.error('[API] syncProfile failed:', e);
    return { code: 500, message: e.message || '同步失败', data: null };
  }
}

module.exports = {
  request, wechatLogin, getPhoneNumber, reportUserStatus,
  fetchGuides, fetchPolicyUpdates, fetchPlaybook,
  interact, searchPlaybook, runPreCheck,
  sendChatMessage, sendChatMessageV5, sendChatMessageStream, submitAssessment, askPolicyQuestion,
  generateDocument, getDashboardData, getApprovedCases,
  uploadAnonymizedText, createPayment, createPaymentOrder, queryOrderStatus,
  checkMembershipStatus, getUserOrders, getUserSubscriptions,
  fetchMembershipPlans, subscribeTemplateMessage,
  syncUserProfile,
  matchSolutionPath, compareSolutionPaths
};
