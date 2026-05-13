/**
 * 住港伴 v4.1 — 悬浮AI住港伴专员组件
 * 接入 DeepSeek V4 模型，通过云函数 ai-chat 调用
 * v4.1: 快捷回复支持 action 导航（自评入口 + 路径选择）
 */
const app = getApp();
const api = require('../../utils/api');

Component({
  properties: {
    visible: {
      type: Boolean,
      value: true
    },
    context: {
      type: Object,
      value: {}
    },
    pathTestMode: {
      type: Boolean,
      value: false
    }
  },

  data: {
    panelOpen: false,
    messages: [],
    inputValue: '',
    loading: false,
    quickEntries: [
      { id: 'path-test', icon: '🗺️', label: '路径评估', mode: 'pathTest' },
      { id: 'assess', icon: '🎯', label: '资格自评', mode: 'assessment' },
      { id: 'policy', icon: '📋', label: '政策问答', mode: 'qa' },
      { id: 'guide', icon: '📖', label: '攻略指引', mode: 'general' },
      { id: 'doc', icon: '📄', label: '材料咨询', mode: 'general' }
    ],
    quickReplies: [],
    scrollToView: ''
  },

  lifetimes: {
    attached() {
      var saved = wx.getStorageSync('__ai_conversation__');
      if (saved && saved.length > 0) {
        this.setData({ messages: saved });
      } else {
        this.setData({
          messages: [{
            role: 'assistant',
            content: '你好！我是住港伴AI专员 v4.1 🤖\n\n我可以帮你：\n• 🎯 自评香港身份路径（12条路径·12项准则）\n• 📋 解答入境政策问题\n• 📖 推荐申请攻略\n• 📄 整理材料清单\n\n直接问我，或点击下方快捷入口～',
            timestamp: Date.now()
          }]
        });
      }
    }
  },

  methods: {
    togglePanel() {
      var open = !this.data.panelOpen;
      this.setData({
        panelOpen: open,
        scrollToView: open ? 'msg-' + (this.data.messages.length - 1) : ''
      });
      if (open) { this.scrollToBottom(); }
    },

    closePanel() { this.setData({ panelOpen: false }); },

    scrollToBottom() {
      var that = this;
      setTimeout(function() {
        var len = that.data.messages.length;
        if (len > 0) { that.setData({ scrollToView: 'msg-' + (len - 1) }); }
      }, 100);
    },

    onInput(e) { this.setData({ inputValue: e.detail.value }); },

    onSendTap() {
      var text = (this.data.inputValue || '').trim();
      if (!text || this.data.loading) return;
      this.sendMessage({ detail: { value: text } });
    },

    async sendMessage(e) {
      var text = ((e && e.detail && e.detail.value) || this.data.inputValue || '').trim();
      if (!text || this.data.loading) return;

      var userMsg = { role: 'user', content: text, timestamp: Date.now() };
      var messages = this.data.messages.concat([userMsg]);
      this.setData({ messages: messages, inputValue: '', loading: true, quickReplies: [] });
      this.scrollToBottom();

      try {
        var pageCtx = this.properties.context || {};
        var res = await api.sendChatMessage(
          app.globalData.aiSessionId, text, 'general',
          {
            userStatus: app.globalData.userStatus,
            userSubStatus: app.globalData.userSubStatus,
            membershipLevel: app.globalData.membershipLevel,
            selectedPath: app.globalData.selectedPath,
            activeProcess: app.globalData.activeProcess ? {
              templateId: app.globalData.activeProcess.templateId,
              currentStageId: app.globalData.activeProcess.currentStageId
            } : null,
            page: pageCtx.page || '',
            pageContext: pageCtx.pageContext || '',
            dataVersion: 'v5-20260508',
            confidenceCheck: true,
            v5Corrections: true
          }
        );

        var replyContent = '抱歉，AI服务暂时不可用，请稍后再试。';
        var quickReplies = [];

        if (res && res.code === 200 && res.data) {
          replyContent = res.data.content || replyContent;
          quickReplies = res.data.quickReplies || [];
        }

        var assistantMsg = {
          role: 'assistant', content: replyContent,
          quickReplies: quickReplies, timestamp: Date.now()
        };

        var newMessages = this.data.messages.concat([assistantMsg]);
        this.setData({ messages: newMessages, quickReplies: quickReplies, loading: false });
        this.saveHistory(newMessages);
        this.scrollToBottom();
      } catch (err) {
        console.error('[FloatingAI] 发送失败:', err);
        var errorMsg = { role: 'assistant', content: '网络开小差了，请稍后再试 😅', timestamp: Date.now() };
        var newMessages = this.data.messages.concat([errorMsg]);
        this.setData({ messages: newMessages, loading: false });
        this.saveHistory(newMessages);
        this.scrollToBottom();
      }
    },

    // 快捷入口
    onQuickEntry(e) {
      var mode = e.currentTarget.dataset.mode;
      if (mode === 'assessment') {
        // 直接跳转自评页面
        this.startAssessment();
        return;
      }
      var prompts = {
        pathTest: '我想做路径评估，帮我看看哪些香港身份规划路径适合我',
        qa: '政策问答',
        general: '攻略指引'
      };
      this.setData({ inputValue: '' });
      this.sendMessage({ detail: { value: prompts[mode] || prompts.general } });
    },

    // 快捷回复点击 — v4.1 支持 action 导航
    onQuickReply(e) {
      var dataset = e.currentTarget.dataset;
      var text = dataset.text;
      var action = dataset.action;

      // 处理导航类 action
      if (action) {
        return this.handleAction(action, text);
      }

      // 普通文本快捷回复
      this.sendMessage({ detail: { value: text } });
    },

    // v4.1: 统一 action 处理
    handleAction(action, label) {
      // 自评入口
      if (action === 'navigate:assessment' || action === 'start_assessment') {
        return this.startAssessment();
      }

      // 路径选择: action="select_path:qmas"
      if (action.indexOf('select_path:') === 0) {
        var pathType = action.split(':')[1];
        return this.selectPathFromChat(pathType, label);
      }

      // 跳转页面: action="navigate:page/url"
      if (action.indexOf('navigate:') === 0) {
        var url = action.substring(9);
        wx.navigateTo({ url: url });
        return;
      }

      // 默认文本回复
      this.sendMessage({ detail: { value: label || action } });
    },

    // v4.1: 启动自评流程
    startAssessment() {
      var persona = wx.getStorageSync('__assessment_persona__') || app.globalData._persona || 0;
      wx.navigateTo({ url: '/pages/assessment/index/index?persona=' + persona + '&from=ai_chat' });
    },

    // v4.1: 从AI对话选择路径 → 更新状态 + 写入账号
    selectPathFromChat(pathType, label) {
      if (!pathType) return;

      // 更新全局状态
      app.globalData.selectedPath = pathType;
      wx.setStorageSync('__active_process_id__', pathType);
      wx.setStorageSync('__ai_selected_path__', { path: pathType, label: label, timestamp: Date.now() });

      // 同步到云端用户账号（如有登录）
      if (app.globalData.cloudReady && app.globalData.isLoggedIn) {
        try {
          var db = wx.cloud.database();
          db.collection('user_profiles').where({ _openid: '{openid}' }).update({
            data: { selectedPath: pathType, pathLabel: label, pathUpdatedAt: Date.now() }
          });
        } catch(dbErr) { console.warn('[AI] DB更新失败:', dbErr); }
      }

      wx.showToast({ title: '已选择：' + (label || pathType), icon: 'success', duration: 1200 });

      // 延迟跳转流程控页面
      var that = this;
      setTimeout(function() {
        that.closePanel();
        wx.switchTab({ url: '/pages/process/index/index' });
      }, 800);
    },

    saveHistory(messages) {
      var toSave = messages.slice(-50);
      wx.setStorageSync('__ai_conversation__', toSave);
    },

    clearConversation() {
      var that = this;
      wx.showModal({
        title: '确认清空',
        content: '确定要清空所有对话记录吗？',
        success: function(res) {
          if (res.confirm) {
            that.setData({
              messages: [{ role: 'assistant', content: '对话已清空。有什么我可以帮你的吗？', timestamp: Date.now() }],
              quickReplies: []
            });
            wx.removeStorageSync('__ai_conversation__');
          }
        }
      });
    },

    noop() {}
  }
});
