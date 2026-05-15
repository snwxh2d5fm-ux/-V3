/**
 * 住港伴 v4.1 — AI 对话页 (PRD v3.1)
 * 接入 DeepSeek V4 模型 + CloudBase RAG 知识库
 * 支持: 资格评估 / 政策问答 / 方案推荐 / 通用对话
 */
const app = getApp();
const api = require('../../../utils/api');
const constants = require('../../../data/constants');

Page({
  data: {
    messages: [],
    inputValue: '',
    loading: false,
    pageError: null,        // v5: 页面级错误状态 (null | 'network' | 'server')
    quickReplies: [],
    scrollToView: '',
    mode: 'general',  // general | assessment | qa | solution_recommend
    modeLabel: 'AI 助手',

    // 方案推荐模式
    solutionMode: false,
    solutionMatches: null,

    // V7: 安全护栏
    safetyBanners: [],       // 当前展示的安全横幅
    showFeedback: false,     // 是否展示反馈按钮
    currentMessageId: null   // 当前AI回答的messageId
  },

  onLoad() {
    // 恢复对话历史
    const saved = wx.getStorageSync(constants.STORAGE_KEYS.AI_CONVERSATION);
    if (saved && saved.length > 0) {
      this.setData({ messages: saved });
    } else {
      this.showWelcome();
    }
  },

  onShow() {
    this.scrollToBottom();
  },

  showWelcome() {
    const hasStatus = app.globalData.userStatus && app.globalData.userStatus !== 'unapplied';
    const hasPath = !!app.globalData.selectedPath;

    let welcome = '你好！我是住港伴AI专员 v4.1\n\n基于V5置信度知识库，我可以帮你：\n• 🎯 评估香港身份路径\n• 📋 解答入境政策问题\n• 📖 推荐流程攻略\n• 📄 梳理材料清单';

    if (hasPath) {
      welcome += `\n\n你当前在「${constants.PATH_NAMES[app.globalData.selectedPath] || app.globalData.selectedPath}」路径中，我能提供针对性的指引。`;
    }
    if (hasStatus && !hasPath) {
      welcome += '\n\n你已设置状态为「' + (constants.USER_STATUS_OPTIONS.find(o => o.value === app.globalData.userSubStatus)?.label || app.globalData.userStatus) + '」，随时可以开始路径评估。';
    }

    welcome += '\n\n直接输入问题，或点击下方快捷入口开始～';

    this.setData({
      messages: [{
        role: 'assistant',
        content: welcome,
        timestamp: Date.now()
      }]
    });
  },

  // ========== 输入处理 ==========
  onInput(e) {
    this.setData({ inputValue: e.detail.value });
  },

  onSendTap() {
    const text = (this.data.inputValue || '').trim();
    if (!text || this.data.loading) return;
    this.setData({ inputValue: '' });
    this.sendMessage(text);
  },

  async sendMessage(text) {
    if (this.data.loading) return;

    const userMsg = {
      role: 'user',
      content: text,
      timestamp: Date.now()
    };

    const messages = [...this.data.messages, userMsg];
    this.setData({
      messages,
      loading: true,
      quickReplies: []
    });
    this.scrollToBottom();

    try {
      // 构建完整V5上下文
      const context = {
        userStatus: app.globalData.userStatus,
        userSubStatus: app.globalData.userSubStatus,
        membershipLevel: app.globalData.membershipLevel,
        selectedPath: app.globalData.selectedPath,
        activeProcess: app.globalData.activeProcess ? {
          templateId: app.globalData.activeProcess.templateId,
          currentStageId: app.globalData.activeProcess.currentStageId
        } : null,
        dataVersion: constants.DATA_VERSION,
        // V5: 置信度与法律校验标记
        confidenceCheck: true,
        v5Corrections: true
      };

      const res = await api.sendChatMessage(
        app.globalData.aiSessionId,
        text,
        this.data.mode,
        context
      );

      let replyContent = '抱歉，AI服务暂时不可用，请稍后再试。';
      let quickReplies = [];

      if (res && res.code === 200 && res.data) {
        replyContent = this.formatReplyContent(res.data.content || replyContent);
        quickReplies = res.data.quickReplies || [];
        // 处理方案推荐结果
        if (res.data.assessmentResult) {
          replyContent += '\n\n' + this.formatAssessmentResult(res.data.assessmentResult);
          // 保存评估结果用于通关路线预填
          try {
            wx.setStorageSync('__assess_prefill__', {
              recommendedPath: res.data.assessmentResult.recommendedPath || '',
              familyStatus: res.data.assessmentResult.familyStatus || '',
              updatedAt: Date.now()
            });
          } catch(e) {}
        }
        // V7: 处理安全元数据
        if (res.data.safety) {
          this.setData({
            safetyBanners: res.data.safety.safety_banners || [],
            showFeedback: true,
            currentMessageId: res.data.messageId
          });
        }
      }

      const assistantMsg = {
        role: 'assistant',
        content: replyContent,
        quickReplies,
        timestamp: Date.now()
      };

      const newMessages = [...this.data.messages, assistantMsg];
      this.setData({
        messages: newMessages,
        quickReplies,
        loading: false
      });

      this.saveHistory(newMessages);
      this.scrollToBottom();
    } catch (err) {
      console.error('[Chat] 发送失败:', err);
      // v5: 持续失败计数 — 3次后切换到错误边界模式
      var failCount = (this._failCount || 0) + 1;
      this._failCount = failCount;
      if (failCount >= 3) {
        this.setData({ pageError: 'network', loading: false });
        return;
      }
      const errorMsg = {
        role: 'assistant',
        content: '网络开小差了，请稍后再试 😅',
        timestamp: Date.now()
      };
      const newMessages = [...this.data.messages, errorMsg];
      this.setData({ messages: newMessages, loading: false });
      this.saveHistory(newMessages);
    }
  },

  // v5: 页面级错误边界重试
  onPageRetry: function() {
    this._failCount = 0;
    this.setData({ pageError: null });
  },

  // ========== 快捷入口 ==========
  onQuickEntry(e) {
    const { mode } = e.currentTarget.dataset;
    let prompt;
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

  // ========== 快捷回复 ==========
  onQuickReply(e) {
    const { text } = e.currentTarget.dataset;
    this.sendMessage(text);
  },

  // ========== 方案推荐 ==========
  async onSolutionRecommend() {
    if (!app.globalData.userProfile) {
      wx.showToast({ title: '请先在"我的"页面完善信息', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '分析中...' });
    try {
      const result = await app.getSolutionRecommendation(app.globalData.userProfile);
      wx.hideLoading();
      if (result && result.length > 0) {
        const topPick = result[0];
        const pathName = constants.PATH_NAMES[topPick.path] || topPick.path;
        const riskInfo = constants.PATH_RISK_LEVELS[topPick.path] || {};
        const msg = `🎯 为你推荐最优路径：\n\n**${pathName}**\n匹配度: ${topPick.matchScore || topPick.score}%\n风险等级: ${riskInfo.label || '—'}\n\n备选方案: ${result.slice(1).map(r => constants.PATH_NAMES[r.path] || r.path).join('、')}`;
        const assistantMsg = { role: 'assistant', content: msg, timestamp: Date.now() };
        const newMessages = [...this.data.messages, assistantMsg];
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

  /** 转换markdown **粗体** 为高亮文本 */
  formatReplyContent(text) {
    if (!text) return '';
    return text.replace(/\*\*(.+?)\*\*/g, '<span style="color:#1a73e8;font-weight:700">$1</span>');
  },

  formatAssessmentResult(result) {
    if (!result) return '';
    let text = '📊 评估结果：\n';
    if (result.recommendedPath) text += `• 推荐路径: ${result.recommendedPath}\n`;
    if (result.confidence) text += `• 匹配置信度: ${result.confidence}%\n`;
    if (result.estimatedTimeline) text += `• 预估周期: ${result.estimatedTimeline}\n`;
    if (result.gapAnalysis && result.gapAnalysis.length > 0) {
      text += `• 待改善项: ${result.gapAnalysis.join(', ')}\n`;
    }
    text += '\n⚠️ 以上评估仅供参考，不构成法律意见。';
    return text;
  },

  scrollToBottom() {
    setTimeout(() => {
      const len = this.data.messages.length;
      if (len > 0) {
        this.setData({ scrollToView: 'msg-' + (len - 1) });
      }
    }, 100);
  },

  saveHistory(messages) {
    const toSave = messages.slice(-50);
    wx.setStorageSync(constants.STORAGE_KEYS.AI_CONVERSATION, toSave);
  },

  // 清空对话
  clearConversation() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有对话记录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync(constants.STORAGE_KEYS.AI_CONVERSATION);
          this.showWelcome();
        }
      }
    });
  },

  // 阻止冒泡
  noop() {},

  // ========== V7: 安全护栏方法 ==========
  getBannerText: function(bannerCode) {
    var map = {
      'KNOW_YOUR_FORGERY': '⚠️ 证件真伪需由签发机构核验，AI不提供辨别方法',
      'KNOW_YOUR_AUDIT': '⚠️ AI不代替入境处审核，材料结果以官方为准',
      'KNOW_YOUR_PRIVACY': '🔒 如需了解数据处理细节，请查阅隐私政策'
    };
    return map[bannerCode] || '';
  },

  onFeedback: function(e) {
    var type = e.currentTarget.dataset.type;
    wx.showToast({ title: '感谢反馈', icon: 'success' });
    this.setData({ showFeedback: false });
  }
});
