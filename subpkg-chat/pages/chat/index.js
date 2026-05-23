/**
 * 住港伴 v5.0 — AI 对话页 (RAG增强+多轮记忆+K2卫士)
 * 接入 DeepSeek/混元 + CloudBase RAG + 安全护栏
 */
const app = getApp();
const api = require('../../../utils/api');
const constants = require('../../../data/constants');
// [V4.1-PHASE1] Task 4: 事件埋点工具
const eventTracker = require('../../../utils/event-tracker');

// K2安全横幅定义（单一真相源）
const SAFETY_BANNERS = {
  forgery: '⚠️ 证件真伪需由签发机构核验，AI不提供辨别方法',
  audit: '⚠️ AI不代替入境处审核，材料结果以官方为准',
  privacy: '🔒 如需了解数据处理细节，请查阅隐私政策',
};

// K2触发词规则
const SAFETY_RULES = [
  { regex: /伪造|假证|真假|怎么辨别|防伪特征/, banner: 'forgery' },
  { regex: /帮我审|能通过吗|能过吗|这材料行吗/, banner: 'audit' },
  { regex: /数据.*加密|怎么保护.*数据|数据.*存储/, banner: 'privacy' },
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
    showSources: false,

    // [V4.1-PHASE1] Task 2: 流式字数统计
    streamingWordCount: 0,
    // [V4.1-PHASE1] Task 3+4: 会话追踪
    aiSessionId: '',
    sessionStartTime: 0,
    turnNumber: 0,
    // [V4.1-PHASE2] Task 1: 动态 Quick Reply
    // [V4.1-PHASE2] Task 2: 游戏化进度条
    sessionProgress: 0,
    milestoneReached: false,
  },

  onLoad: function () {
    // [V4.1-PHASE1] Task 4: 生成会话ID并记录开始时间
    const sessionId = 'ai_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    this.setData({
      aiSessionId: sessionId,
      sessionStartTime: Date.now(),
    });

    const saved = wx.getStorageSync(constants.STORAGE_KEYS.AI_CONVERSATION);
    if (saved && saved.length > 0) {
      this.setData({ messages: saved });
      // [V4.1-PHASE1] Task 3: 页面加载后恢复反馈按钮状态
      this._restoreFeedbackState();
    } else {
      this.showWelcome();
    }

    // [V4.1-PHASE1] Task 4: 事件埋点 — ai_chat_open
    eventTracker.track('open', {
      source: this._getEntrySource(),
      session_id: sessionId,
    });
  },

  onShow: function () {
    this.scrollToBottom();
  },

  // [V4.1-PHASE1] Task 4: 页面卸载时触发关闭埋点
  onUnload: function () {
    const startTime = this.data.sessionStartTime;
    const durationSeconds = startTime ? Math.round((Date.now() - startTime) / 1000) : 0;
    eventTracker.track('close', {
      duration_seconds: durationSeconds,
      last_turn_number: this.data.turnNumber,
      session_id: this.data.aiSessionId,
    });
  },

  // [V4.1-PHASE1] Task 4: 获取页面入口来源
  _getEntrySource: function () {
    try {
      const pages = getCurrentPages();
      if (pages && pages.length > 1) {
        const prevPage = pages[pages.length - 2];
        if (prevPage) {
          const route = prevPage.route || '';
          if (route.indexOf('tabBar') > -1 || route.indexOf('index/index') > -1) return 'bottomNav';
          if (route.indexOf('quick') > -1 || route.indexOf('entry') > -1) return 'quickEntry';
          return route;
        }
      }
    } catch (e) {}
    return 'unknown';
  },

  showWelcome: function () {
    // [V4.1-PHASE1] Task 5: 画像感知欢迎语 — 优先使用本地缓存的 userProfile
    const profileWelcome = this._getProfileWelcome();
    if (profileWelcome) {
      this.setData({
        messages: [{ role: 'assistant', content: profileWelcome, timestamp: Date.now() }],
      });
      return;
    }

    // 无画像 — 使用原有通用欢迎语
    const hasStatus = app.globalData.userStatus && app.globalData.userStatus !== 'unapplied';
    const hasPath = !!app.globalData.selectedPath;

    let welcome =
      '你好！我是住港伴AI专员 v5.0\n\n基于RAG增强知识库（8,000+条官方政策数据），我可以帮你：\n• 🎯 评估香港身份路径（12条路径）\n• 📋 解答入境政策问题（含来源标注）\n• 📖 推荐流程攻略\n• 📄 梳理材料清单';

    if (hasPath) {
      welcome +=
        '\n\n你当前在「' +
        (constants.PATH_NAMES[app.globalData.selectedPath] || app.globalData.selectedPath) +
        '」路径中。';
    }
    if (hasStatus && !hasPath) {
      const label = constants.USER_STATUS_OPTIONS.find(function (o) {
        return o.value === app.globalData.userSubStatus;
      });
      welcome +=
        '\n\n你已设置状态为「' + (label ? label.label : app.globalData.userStatus) + '」，随时可以开始路径评估。';
    }
    welcome += '\n\n直接输入问题，或点击下方快捷入口开始～';

    this.setData({
      messages: [{ role: 'assistant', content: welcome, timestamp: Date.now() }],
    });
  },

  // [V4.1-PHASE1] Task 5: 从本地缓存读取用户画像摘要，生成个性化欢迎语
  _getProfileWelcome: function () {
    try {
      const profileStr = wx.getStorageSync(constants.STORAGE_KEYS.USER_PROFILE);
      if (!profileStr) return null;
      const profile = typeof profileStr === 'string' ? JSON.parse(profileStr) : profileStr;
      if (!profile || !profile.selectedPath) return null;

      const pathName = constants.PATH_NAMES[profile.selectedPath] || profile.selectedPath;

      // 尝试获取阶段名称
      let stageLabel = '';
      if (profile.persona !== undefined && profile.persona !== null) {
        const stageMap = {
          0: '获取身份',
          1: '维护身份',
          2: '申请永居',
        };
        stageLabel = stageMap[profile.persona] || '';
      }

      if (stageLabel) {
        return '你好！你正在走' + pathName + '，当前在「' + stageLabel + '」阶段。有什么可以帮你的？';
      }
      return '你好！你正在走' + pathName + '，有什么可以帮你的？';
    } catch (e) {
      return null;
    }
  },

  // ========== 输入处理 ==========
  onInput: function (e) {
    this.setData({ inputValue: e.detail.value });
  },

  onSendTap: function () {
    const text = (this.data.inputValue || '').trim();
    if (!text || this.data.loading) return;
    this.setData({ inputValue: '' });
    this.sendMessage(text);
  },

  sendMessage: async function (text) {
    if (this.data.loading) return;

    const userMsg = { role: 'user', content: text, timestamp: Date.now() };
    const messages = this.data.messages.concat([userMsg]);

    this.setData({
      messages: messages,
      loading: true,
      quickReplies: [],
      showSources: false,
      sources: [],
    });
    this.scrollToBottom();

    try {
      const context = {
        userStatus: app.globalData.userStatus,
        userSubStatus: app.globalData.userSubStatus,
        membershipLevel: app.globalData.membershipLevel,
        selectedPath: app.globalData.selectedPath,
        activeProcess: app.globalData.activeProcess
          ? {
              templateId: app.globalData.activeProcess.templateId,
              currentStageId: app.globalData.activeProcess.currentStageId,
            }
          : null,
        dataVersion: constants.DATA_VERSION,
        confidenceCheck: true,
        v5Corrections: true,
      };

      const history = this.buildHistory(messages);
      const clientBanners = this.runSafetyCheck(text);
      // [V4.1-PHASE1] Task 1: 修复流式检测 Bug — 使用 wx.canIUse 精确检测
      const useStream = api.isStreamSupported();
      // [V4.1-PHASE1] Task 1: 检测失败时降级为非流式
      if (!useStream) {
        console.warn('[Chat] 当前微信版本不支持流式响应，降级为非流式模式');
      }

      // 流式渲染回调
      const that = this;
      if (useStream) {
        // [V4.1-PHASE1] Task 2: 重置流式字数统计
        this.setData({ streamingWordCount: 0 });
        const streamResult = await api.sendChatMessageStream(
          app.globalData.aiSessionId,
          text,
          this.data.mode,
          context,
          history,
          {
            onToken: function (token, full) {
              that.appendStreamToken(token);
            },
            onDone: function (content, meta) {
              // [V4.1-PHASE1] Task 3: 流式完成时由主流程处理，此处仅为占位
            },
          },
        );
        if (streamResult && streamResult.code === 200) {
          // [V4.1-PHASE2 FIX] 传递 quick_replies 到 finishStream，修复流式路径快捷回复丢失
          this.finishStream(streamResult.data.content, streamResult.data.sources || [], {
            trace_id: streamResult.data.messageId,
            quick_replies: streamResult.data.quickReplies || [],
          });
          this.saveHistory(that.data.messages);
          return;
        }
        // 流式失败降级到非流式
      }

      const res = await api.sendChatMessageV5(app.globalData.aiSessionId, text, this.data.mode, context, history);

      this._failCount = 0; // 成功后重置错误计数

      let replyContent = '抱歉，AI服务暂时不可用，请稍后再试。';
      let quickReplies = [];
      let sources = [];
      const banners = clientBanners.slice();

      if (res && res.code === 200 && res.data) {
        // [V4.1-PHASE2 FIX] 防御性剥离 quick_replies 代码块
        const cleanContent = this._stripQuickRepliesFromContent(res.data.content);
        replyContent = this.formatReplyContent(cleanContent || replyContent);
        // [V4.1-PHASE2] Task 1: 解析动态quick_replies
        quickReplies = this._extractQuickReplies(
          res.data.content,
          res.data.quick_replies || res.data.quickReplies || [],
        );
        // [V4.1-PHASE2] Task 3: 读取置信度等级
        var confidenceLevel = res.data.confidence_level || null;
        sources = res.data.sources || [];

        if (res.data.assessmentResult) {
          replyContent += '\n\n' + this.formatAssessmentResult(res.data.assessmentResult);
          try {
            wx.setStorageSync('__assess_prefill__', {
              recommendedPath: res.data.assessmentResult.recommendedPath || '',
              familyStatus: res.data.assessmentResult.familyStatus || '',
              updatedAt: Date.now(),
            });
          } catch (e) {}
        }

        // 合并服务端安全横幅
        const serverBanners = (res.data.safety && res.data.safety.safety_banners) || [];
        for (let i = 0; i < serverBanners.length; i++) {
          if (banners.indexOf(serverBanners[i]) === -1) {
            banners.push(serverBanners[i]);
          }
        }
      }

      const messageId = res && res.data ? res.data.messageId : null;
      const assistantMsg = {
        role: 'assistant',
        content: replyContent,
        quickReplies: quickReplies,
        timestamp: Date.now(),
        msgId: messageId, // [V4.1-PHASE1] Task 3: 消息ID用于反馈状态持久化
        // [V4.1-PHASE2] Task 3: 置信度等级
        confidenceLevel: typeof confidenceLevel !== 'undefined' ? confidenceLevel : null,
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
        showSources: sources.length > 0,
      });

      this.saveHistory(newMessages);
      // [V4.1-PHASE2] Task 2: 进度+1 + 里程碑检测
      this._checkMilestone();
      this.scrollToBottom();

      // [V4.1-PHASE1] Task 4: 事件埋点 — ai_chat_send
      const turnNum = this.data.turnNumber + 1;
      this.setData({ turnNumber: turnNum });
      eventTracker.track('send', {
        input_mode: 'keyboard',
        message_length: text.length,
        session_id: this.data.aiSessionId,
        turn_number: turnNum,
      });
    } catch (err) {
      console.error('[Chat] 发送失败:', err);
      const failCount = (this._failCount || 0) + 1;
      this._failCount = failCount;
      if (failCount >= 3) {
        this.setData({ pageError: 'network', loading: false });
        return;
      }
      const errorMsg = { role: 'assistant', content: '网络开小差了，请稍后再试 😅', timestamp: Date.now() };
      var newMessages = this.data.messages.concat([errorMsg]);
      this.setData({ messages: newMessages, loading: false });
      this.saveHistory(newMessages);
    }
  },

  onPageRetry: function () {
    this._failCount = 0;
    this.setData({ pageError: null });
  },

  // ========== 快捷入口 ==========
  onQuickEntry: function (e) {
    const mode = e.currentTarget.dataset.mode;
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

  onQuickReply: function (e) {
    this.sendMessage(e.currentTarget.dataset.text);
  },

  // ========== 方案推荐 ==========
  onSolutionRecommend: async function () {
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
        let msg =
          '🎯 为你推荐最优路径：\n\n**' +
          pathName +
          '**\n匹配度: ' +
          (topPick.matchScore || topPick.score) +
          '%\n风险等级: ' +
          (riskInfo.label || '—');
        msg +=
          '\n\n备选方案: ' +
          result
            .slice(1)
            .map(function (r) {
              return constants.PATH_NAMES[r.path] || r.path;
            })
            .join('、');
        const assistantMsg = { role: 'assistant', content: msg, timestamp: Date.now() };
        const newMessages = this.data.messages.concat([assistantMsg]);
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
  formatReplyContent: function (text) {
    if (!text) return '';
    // HTML实体编码防止XSS注入
    const escaped = this._escapeHTML(text);
    return escaped
      .replace(/^### (.+)$/gm, '<br/><strong style="font-size:30rpx;display:block;margin:16rpx 0 8rpx">$1</strong>')
      .replace(/^## (.+)$/gm, '<br/><strong style="font-size:32rpx;display:block;margin:20rpx 0 10rpx">$1</strong>')
      .replace(/\*\*(.+?)\*\*/g, '<span style="color:#1a73e8;font-weight:700">$1</span>');
  },

  /** HTML实体编码——防止AI响应中的恶意标签在WXML中执行 */
  _escapeHTML: function (str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  formatAssessmentResult: function (result) {
    if (!result) return '';
    // HTML实体编码LLM输出的所有字段，防止XSS
    const e = this._escapeHTML;
    let text = '📊 评估结果：\n';
    if (result.recommendedPath) text += '• 推荐路径: ' + e(result.recommendedPath) + '\n';
    if (result.confidence) text += '• 匹配置信度: ' + e(String(result.confidence)) + '%\n';
    if (result.estimatedTimeline) text += '• 预估周期: ' + e(result.estimatedTimeline) + '\n';
    if (result.gapAnalysis && result.gapAnalysis.length > 0) {
      text += '• 待改善项: ' + e(result.gapAnalysis.join(', ')) + '\n';
    }
    text += '\n⚠️ 以上评估仅供参考，不构成法律意见。';
    return text;
  },

  scrollToBottom: function () {
    const that = this;
    setTimeout(function () {
      const len = that.data.messages.length;
      if (len > 0) that.setData({ scrollToView: 'msg-' + (len - 1) });
    }, 100);
  },

  saveHistory: function (messages) {
    wx.setStorageSync(constants.STORAGE_KEYS.AI_CONVERSATION, messages.slice(-50));
  },

  clearConversation: function () {
    const that = this;
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有对话记录吗？',
      success: function (res) {
        if (res.confirm) {
          wx.removeStorageSync(constants.STORAGE_KEYS.AI_CONVERSATION);
          that.showWelcome();
        }
      },
    });
  },

  // [V4.1-PHASE1] Task 3: 页面加载后从本地缓存恢复反馈按钮状态
  _restoreFeedbackState: function () {
    const savedFeedback = wx.getStorageSync('__ai_feedback__') || {};
    const msgs = this.data.messages;
    let changed = false;
    for (let i = 0; i < msgs.length; i++) {
      if (msgs[i].role === 'assistant' && msgs[i].msgId && savedFeedback[msgs[i].msgId]) {
        const fb = savedFeedback[msgs[i].msgId];
        msgs[i].feedbackGiven = fb.rating === 1 ? 'like' : 'dislike';
        changed = true;
      }
    }
    if (changed) {
      this.setData({ messages: msgs });
    }
  },

  // [V4.1-PHASE2] Task 1: 从AI回答中提取动态quick_replies
  _extractQuickReplies: function (responseContent, responseData) {
    if (responseData && Array.isArray(responseData) && responseData.length > 0) {
      try {
        return responseData.slice(0, 3);
      } catch (e) {
        return [];
      }
    }
    if (!responseContent) return [];
    try {
      const jsonMatch = responseContent.match(/\[\s*\{[\s\S]*?"id"\s*:\s*"qr_[\s\S]*?\}\s*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.slice(0, 3);
        }
      }
    } catch (e) {
      console.warn('[PHASE2] quick_replies JSON\u89e3\u6790\u5931\u8d25');
    }
    return [];
  },

  // [V4.1-PHASE2 FIX] 防御性剥离 content 中的 ```quick_replies 代码块
  // 防止云函数未剥离时前端暴露原始代码
  _stripQuickRepliesFromContent: function (content) {
    if (!content || typeof content !== 'string') return content || '';
    return content
      .replace(/```quick_replies[\s\S]*?```/g, '')
      .replace(/quick_replies\s*\[[\s\S]*?\]/g, '')
      // [V4.1-PHASE3] 第三层: LLM直接输出裸 [{...}] 无任何wrapper
      .replace(/\[\s*\{[^}]*"id"\s*:\s*"qr_[\s\S]*?\]/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  },

  // [V4.1-PHASE2] Task 2: 进度检测 + 里程碑
  _checkMilestone: function () {
    const progress = this.data.sessionProgress + 1;
    this.setData({ sessionProgress: progress });
    if (progress === 5) {
      wx.showToast({ title: '\u5df2\u63a2\u7d22 5 \u4e2a\u95ee\u9898!', icon: 'none' });
      if (typeof eventTracker !== 'undefined' && eventTracker.track) {
        eventTracker.track('milestone', {
          milestone_type: '5',
          session_id: this.data.aiSessionId,
          turn_number: progress,
        });
      }
    } else if (progress === 10) {
      const that = this;
      wx.showModal({
        title: '\U0001f389 \u89e3\u9501\u9690\u85cf\u653b\u7565',
        content:
          '\u4f60\u5df2\u5b8c\u6210 10 \u8f6e\u5bf9\u8bdd!\u8bd5\u8bd5\u66f4\u6df1\u5165\u7684\u95ee\u9898\u5427~',
        showCancel: false,
        success: function () {
          that.setData({ milestoneReached: true });
        },
      });
      if (typeof eventTracker !== 'undefined' && eventTracker.track) {
        eventTracker.track('milestone', {
          milestone_type: '10',
          session_id: this.data.aiSessionId,
          turn_number: progress,
        });
      }
    }
  },

  noop: function () {},

  // ========== K2安全护栏 ==========
  runSafetyCheck: function (text) {
    const banners = [];
    const lower = (text || '').toLowerCase();
    for (let i = 0; i < SAFETY_RULES.length; i++) {
      if (SAFETY_RULES[i].regex.test(lower)) {
        const key = SAFETY_RULES[i].banner;
        if (banners.indexOf(SAFETY_BANNERS[key]) === -1) {
          banners.push(SAFETY_BANNERS[key]);
        }
      }
    }
    return banners;
  },

  // ========== 流式渲染 ==========
  appendStreamToken: function (token) {
    // S-02 fix: 每个token独立做HTML实体编码，防止流式过程中XSS注入
    const safeToken = this._escapeHTML(token);
    const msgs = this.data.messages;
    const last = msgs[msgs.length - 1];
    if (last && last.role === 'assistant' && last.isStreaming) {
      last.content += safeToken;
    } else {
      msgs.push({ role: 'assistant', content: safeToken, timestamp: Date.now(), isStreaming: true });
    }
    this.setData({
      messages: msgs,
      // [V4.1-PHASE1] Task 2: 更新流式字数统计（用于显示"已生成XX字"）
      streamingWordCount: ((msgs[msgs.length - 1] && msgs[msgs.length - 1].content) || '').length,
    });
    this.scrollToBottom();
  },

  finishStream: function (content, sources, meta) {
    const msgs = this.data.messages;
    const last = msgs[msgs.length - 1];
    if (last && last.role === 'assistant') {
      // S-02 fix: 流式完成后用完整escape+markdown格式化替换累加内容，确保一致性
      // [V4.1-PHASE2 FIX] 防御性剥离 quick_replies 代码块
      const cleanStreamContent = this._stripQuickRepliesFromContent(content);
      last.content = this.formatReplyContent(cleanStreamContent);
      last.isStreaming = false;
      last.sources = sources;
      // [V4.1-PHASE1] Task 3: 保存消息ID用于反馈状态持久化
      last.msgId = meta ? meta.trace_id || meta.messageId || null : null;
      // [V4.1-PHASE2] Task 1: 从meta解析动态quick_replies
      const qrData = meta ? meta.quick_replies || meta.quickReplies || [] : [];
      last.quickReplies = this._extractQuickReplies(content, qrData);
      // [V4.1-PHASE2] Task 3: 从meta读取置信度等级
      last.confidenceLevel = meta ? meta.confidence_level || null : null;
    }
    this.setData({
      messages: msgs,
      loading: false,
      sources: sources || [],
      showSources: sources && sources.length > 0,
      isStreaming: false,
      // [V4.1-PHASE1] Task 2: 流式结束后清理字数统计
      streamingWordCount: 0,
    });
    // [V4.1-PHASE2] Task 2: 进度+1 + 里程碑检测
    this._checkMilestone();
  },

  // ========== 对话历史 ==========
  buildHistory: function (messages) {
    const past = messages.slice(0, -1);
    return past.slice(-20).map(function (m) {
      return { role: m.role, content: m.content };
    });
  },

  // ========== 反馈 ==========
  // [V4.1-PHASE1] Task 3: 反馈按钮状态持久化（本地缓存+云端同步+界面禁用）
  onFeedback: function (e) {
    const type = e.currentTarget.dataset.type; // 'like' 或 'dislike'
    const msgId = e.currentTarget.dataset.msgId;

    const rating = type === 'like' ? 1 : 0;
    const savedFeedback = wx.getStorageSync('__ai_feedback__') || {};

    // 跳过已反馈的消息
    if (msgId && savedFeedback[msgId]) {
      wx.showToast({ title: '已反馈过', icon: 'none' });
      return;
    }

    // 1. 本地缓存（刷新后保持状态）
    if (msgId) {
      savedFeedback[msgId] = { rating: rating, timestamp: Date.now() };
      wx.setStorageSync('__ai_feedback__', savedFeedback);
    }

    // 2. 云端同步（调用ai-chat云函数feedback action）
    if (msgId) {
      wx.cloud
        .callFunction({
          name: 'ai-chat',
          data: {
            action: 'feedback',
            session_id: this.data.aiSessionId,
            message_id: msgId,
            rating: rating,
            tags: [],
            timestamp: Date.now(),
          },
        })
        .catch(function (err) {
          console.warn('[Chat] 反馈云端同步失败:', err);
        });
    }

    // 3. 更新本地消息状态（按钮变灰不可再点）
    const msgs = this.data.messages;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'assistant' && msgs[i].msgId === msgId) {
        msgs[i].feedbackGiven = type;
        break;
      }
    }
    this.setData({ messages: msgs });

    // 4. 轻提示
    wx.showToast({ title: '反馈已收到', icon: 'success' });

    // 5. 埋点
    eventTracker.track('feedback', {
      rating: rating,
      message_id: msgId,
      session_id: this.data.aiSessionId,
    });
  },
});
