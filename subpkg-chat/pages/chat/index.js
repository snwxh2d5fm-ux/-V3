/**
 * 住港伴 v5.0 — AI 对话页 (RAG增强+多轮记忆+K2卫士)
 * 接入 DeepSeek/混元 + CloudBase RAG + 安全护栏
 */
var app = getApp();
var api = require('../../../utils/api');
var constants = require('../../../data/constants');

// K2安全横幅定义（单一真相源）
var SAFETY_BANNERS = {
  forgery:  '⚠️ 证件真伪需由签发机构核验，AI不提供辨别方法',
  audit:    '⚠️ AI不代替入境处审核，材料结果以官方为准',
  privacy:  '🔒 如需了解数据处理细节，请查阅隐私政策'
};

// K2触发词规则
var SAFETY_RULES = [
  { regex: /伪造|假证|真假|怎么辨别|防伪特征/,   banner: 'forgery' },
  { regex: /帮我审|能通过吗|能过吗|这材料行吗/,     banner: 'audit' },
  { regex: /数据.*加密|怎么保护.*数据|数据.*存储/,   banner: 'privacy' }
];

Page({
  data: {
    messages: [],
    inputValue: '',
    loading: false,
    pageError: null,
    quickReplies: [],
    scrollToView: '',
    mode: 'general',
    modeLabel: 'AI 助手',
    solutionMode: false,
    solutionMatches: null,

    // 安全护栏
    safetyBanners: [],
    showFeedback: false,
    currentMessageId: null,

    // RAG增强
    sources: [],
    showSources: false
  },

  onLoad: function() {
    var saved = wx.getStorageSync(constants.STORAGE_KEYS.AI_CONVERSATION);
    if (saved && saved.length > 0) {
      this.setData({ messages: saved });
    } else {
      this.showWelcome();
    }
  },

  onShow: function() {
    this.scrollToBottom();
  },

  showWelcome: function() {
    var hasStatus = app.globalData.userStatus && app.globalData.userStatus !== 'unapplied';
    var hasPath = !!app.globalData.selectedPath;

    var welcome = '你好！我是住港伴AI专员 v5.0\n\n基于RAG增强知识库（8,000+条官方政策数据），我可以帮你：\n• 🎯 评估香港身份路径（12条路径）\n• 📋 解答入境政策问题（含来源标注）\n• 📖 推荐流程攻略\n• 📄 梳理材料清单';

    if (hasPath) {
      welcome += '\n\n你当前在「' + (constants.PATH_NAMES[app.globalData.selectedPath] || app.globalData.selectedPath) + '」路径中。';
    }
    if (hasStatus && !hasPath) {
      var label = constants.USER_STATUS_OPTIONS.find(function(o) { return o.value === app.globalData.userSubStatus; });
      welcome += '\n\n你已设置状态为「' + (label ? label.label : app.globalData.userStatus) + '」，随时可以开始路径评估。';
    }
    welcome += '\n\n直接输入问题，或点击下方快捷入口开始～';

    this.setData({
      messages: [{ role: 'assistant', content: welcome, timestamp: Date.now() }]
    });
  },

  // ========== 输入处理 ==========
  onInput: function(e) {
    this.setData({ inputValue: e.detail.value });
  },

  onSendTap: function() {
    var text = (this.data.inputValue || '').trim();
    if (!text || this.data.loading) return;
    this.setData({ inputValue: '' });
    this.sendMessage(text);
  },

  sendMessage: async function(text) {
    if (this.data.loading) return;

    var userMsg = { role: 'user', content: text, timestamp: Date.now() };
    var messages = this.data.messages.concat([userMsg]);

    this.setData({
      messages: messages,
      loading: true,
      quickReplies: [],
      showSources: false,
      sources: []
    });
    this.scrollToBottom();

    try {
      var context = {
        userStatus: app.globalData.userStatus,
        userSubStatus: app.globalData.userSubStatus,
        membershipLevel: app.globalData.membershipLevel,
        selectedPath: app.globalData.selectedPath,
        activeProcess: app.globalData.activeProcess ? {
          templateId: app.globalData.activeProcess.templateId,
          currentStageId: app.globalData.activeProcess.currentStageId
        } : null,
        dataVersion: constants.DATA_VERSION,
        confidenceCheck: true,
        v5Corrections: true
      };

      var history = this.buildHistory(messages);
      var clientBanners = this.runSafetyCheck(text);

      var res = await api.sendChatMessageV5(
        app.globalData.aiSessionId,
        text,
        this.data.mode,
        context,
        history
      );

      this._failCount = 0; // 成功后重置错误计数

      var replyContent = '抱歉，AI服务暂时不可用，请稍后再试。';
      var quickReplies = [];
      var sources = [];
      var banners = clientBanners.slice();

      if (res && res.code === 200 && res.data) {
        replyContent = this.formatReplyContent(res.data.content || replyContent);
        quickReplies = res.data.quickReplies || [];
        sources = res.data.sources || [];

        if (res.data.assessmentResult) {
          replyContent += '\n\n' + this.formatAssessmentResult(res.data.assessmentResult);
          try {
            wx.setStorageSync('__assess_prefill__', {
              recommendedPath: res.data.assessmentResult.recommendedPath || '',
              familyStatus: res.data.assessmentResult.familyStatus || '',
              updatedAt: Date.now()
            });
          } catch(e) {}
        }

        // 合并服务端安全横幅
        var serverBanners = (res.data.safety && res.data.safety.safety_banners) || [];
        for (var i = 0; i < serverBanners.length; i++) {
          if (banners.indexOf(serverBanners[i]) === -1) {
            banners.push(serverBanners[i]);
          }
        }
      }

      var assistantMsg = {
        role: 'assistant',
        content: replyContent,
        quickReplies: quickReplies,
        timestamp: Date.now()
      };

      var newMessages = this.data.messages.concat([assistantMsg]);
      this.setData({
        messages: newMessages,
        quickReplies: quickReplies,
        loading: false,
        safetyBanners: banners,
        showFeedback: banners.length > 0,
        currentMessageId: res && res.data ? res.data.messageId : null,
        sources: sources,
        showSources: sources.length > 0
      });

      this.saveHistory(newMessages);
      this.scrollToBottom();
    } catch (err) {
      console.error('[Chat] 发送失败:', err);
      var failCount = (this._failCount || 0) + 1;
      this._failCount = failCount;
      if (failCount >= 3) {
        this.setData({ pageError: 'network', loading: false });
        return;
      }
      var errorMsg = { role: 'assistant', content: '网络开小差了，请稍后再试 😅', timestamp: Date.now() };
      var newMessages = this.data.messages.concat([errorMsg]);
      this.setData({ messages: newMessages, loading: false });
      this.saveHistory(newMessages);
    }
  },

  onPageRetry: function() {
    this._failCount = 0;
    this.setData({ pageError: null });
  },

  // ========== 快捷入口 ==========
  onQuickEntry: function(e) {
    var mode = e.currentTarget.dataset.mode;
    var prompt;
    switch (mode) {
      case 'pathTest':
        this.setData({ mode: 'assessment', modeLabel: '路径评估' });
        prompt = '开始路径评估——请告诉我你的基本情况：学历、工作经验年限、目前所在行业、大致年收入范围';
        break;
      case 'assessment':
        this.setData({ mode: 'assessment', modeLabel: '资格评估' });
        prompt = '开始资格评估';
        break;
      case 'qa':
        this.setData({ mode: 'qa', modeLabel: '政策问答' });
        prompt = '查询入境政策';
        break;
      case 'solution':
        this.setData({ mode: 'solution_recommend', modeLabel: '方案推荐' });
        prompt = '基于我的情况推荐最优身份路径';
        break;
      default:
        this.setData({ mode: 'general', modeLabel: 'AI 助手' });
        prompt = '你好';
    }
    this.sendMessage(prompt);
  },

  onQuickReply: function(e) {
    this.sendMessage(e.currentTarget.dataset.text);
  },

  // ========== 方案推荐 ==========
  onSolutionRecommend: async function() {
    if (!app.globalData.userProfile) {
      wx.showToast({ title: '请先在"我的"页面完善信息', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '分析中...' });
    try {
      var result = await app.getSolutionRecommendation(app.globalData.userProfile);
      wx.hideLoading();
      if (result && result.length > 0) {
        var topPick = result[0];
        var pathName = constants.PATH_NAMES[topPick.path] || topPick.path;
        var riskInfo = constants.PATH_RISK_LEVELS[topPick.path] || {};
        var msg = '🎯 为你推荐最优路径：\n\n**' + pathName + '**\n匹配度: ' + (topPick.matchScore || topPick.score) + '%\n风险等级: ' + (riskInfo.label || '—');
        msg += '\n\n备选方案: ' + result.slice(1).map(function(r) { return constants.PATH_NAMES[r.path] || r.path; }).join('、');
        var assistantMsg = { role: 'assistant', content: msg, timestamp: Date.now() };
        var newMessages = this.data.messages.concat([assistantMsg]);
        this.setData({ messages: newMessages });
        this.saveHistory(newMessages);
        this.scrollToBottom();
      }
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '推荐失败', icon: 'none' });
    }
  },

  // ========== 辅助方法 ==========
  formatReplyContent: function(text) {
    if (!text) return '';
    // HTML实体编码防止XSS注入
    var escaped = this._escapeHTML(text);
    return escaped.replace(/\*\*(.+?)\*\*/g, '<span style="color:#1a73e8;font-weight:700">$1</span>');
  },

  /** HTML实体编码——防止AI响应中的恶意标签在WXML中执行 */
  _escapeHTML: function(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  formatAssessmentResult: function(result) {
    if (!result) return '';
    // HTML实体编码LLM输出的所有字段，防止XSS
    var e = this._escapeHTML;
    var text = '📊 评估结果：\n';
    if (result.recommendedPath) text += '• 推荐路径: ' + e(result.recommendedPath) + '\n';
    if (result.confidence) text += '• 匹配置信度: ' + e(String(result.confidence)) + '%\n';
    if (result.estimatedTimeline) text += '• 预估周期: ' + e(result.estimatedTimeline) + '\n';
    if (result.gapAnalysis && result.gapAnalysis.length > 0) {
      text += '• 待改善项: ' + e(result.gapAnalysis.join(', ')) + '\n';
    }
    text += '\n⚠️ 以上评估仅供参考，不构成法律意见。';
    return text;
  },

  scrollToBottom: function() {
    var that = this;
    setTimeout(function() {
      var len = that.data.messages.length;
      if (len > 0) that.setData({ scrollToView: 'msg-' + (len - 1) });
    }, 100);
  },

  saveHistory: function(messages) {
    wx.setStorageSync(constants.STORAGE_KEYS.AI_CONVERSATION, messages.slice(-50));
  },

  clearConversation: function() {
    var that = this;
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有对话记录吗？',
      success: function(res) {
        if (res.confirm) {
          wx.removeStorageSync(constants.STORAGE_KEYS.AI_CONVERSATION);
          that.showWelcome();
        }
      }
    });
  },

  noop: function() {},

  // ========== K2安全护栏 ==========
  runSafetyCheck: function(text) {
    var banners = [];
    var lower = (text || '').toLowerCase();
    for (var i = 0; i < SAFETY_RULES.length; i++) {
      if (SAFETY_RULES[i].regex.test(lower)) {
        var key = SAFETY_RULES[i].banner;
        if (banners.indexOf(SAFETY_BANNERS[key]) === -1) {
          banners.push(SAFETY_BANNERS[key]);
        }
      }
    }
    return banners;
  },

  // ========== 对话历史 ==========
  buildHistory: function(messages) {
    var past = messages.slice(0, -1);
    return past.slice(-20).map(function(m) {
      return { role: m.role, content: m.content };
    });
  },

  // ========== 反馈 ==========
  onFeedback: function(e) {
    var type = e.currentTarget.dataset.type;
    var msgId = this.data.currentMessageId;

    if (msgId) {
      wx.cloud.callFunction({
        name: 'ai-chat',
        data: { action: 'feedback', messageId: msgId, feedback: type, timestamp: Date.now() }
      }).catch(function(){});
    }

    wx.showToast({
      title: type === 'inaccurate' ? '已记录，我们会改进' : '感谢反馈',
      icon: 'success'
    });
    this.setData({ showFeedback: false });
  }
});
