/**
 * 住港伴 v4.4 — 攻略书主页 (Tab1·免费开放)
 * 
 * 数据架构:
 *   data/guidebook-data.js (权威数据源)
 *     ├── getAllCards() → 卡片元数据（列表渲染）
 *     ├── getRecommended(status) → 身份状态推荐
 *     └── getById(id) → 完整文章（detail页调用）
 * 
 * 透传机制 (index → detail):
 *   点击卡片 → app.globalData.__guideDetailCache__[id] = fullData
 *          → wx.navigateTo('/pages/guidebooks/detail/detail?id=' + id)
 *          → detail页优先从 globalData 取，次选 require('guidebook-data').getById(id)
 */
var app = getApp();
var constants = require('../../../data/constants');
var guideData = require('../../../data/guidebook-data');

Page({
  data: {
    stageSteps: [
      { id: 'evaluation', label: '资格评估', status: 'active' },
      { id: 'preparation', label: '材料准备', status: 'pending' },
      { id: 'submission', label: '线上申请', status: 'pending' },
      { id: 'waiting', label: '等待获批', status: 'pending' },
      { id: 'activation', label: '获批激活', status: 'pending' },
      { id: 'settlement', label: '抵港生活', status: 'pending' },
      { id: 'pr', label: '永居', status: 'pending' }
    ],
    stageProgress: 14,
    userStatus: 'unapplied',
    selectedPath: null,
    statusLabel: '',
    searchKeyword: '',
    searchFocused: false,
    activeCategory: 'all',
    categories: [
      { id: 'all', icon: '📚', label: '全部', count: 47 },
      { id: 'qmas', icon: '🎯', label: '优才', count: 8 },
      { id: 'ttps', icon: '🏃', label: '高才通', count: 4 },
      { id: 'asmpt', icon: '💼', label: '专才', count: 3 },
      { id: 'iang', icon: '🎓', label: 'IANG', count: 4 },
      { id: 'landing', icon: '🛬', label: '赴港落地', count: 5 },
      { id: 'renewal', icon: '🔄', label: '续签', count: 5 },
      { id: 'pr_sprint', icon: '🏁', label: '永居冲刺', count: 5 },
      { id: 'life', icon: '🏠', label: '在港生活', count: 12 },
      { id: 'other', icon: '📌', label: '其他', count: 1 }
    ],
    guideCards: [],
    filteredCards: [],
    recommendedCards: [],
    recommendedReason: '',
    hotTags: ['证件照', '银行开户', '租房', '受养人', '税务', 'MPF', '驾照', '保险'],
    sortBy: 'default',
    loading: true,
    loadError: false,
    cloudSource: false,
    scrollTop: 0
  },

  onLoad: function() {
    var session = wx.getStorageSync(constants.STORAGE_KEYS.SESSION) || {};
    var userStatus = session.userStatus || app.globalData.userStatus || 'unapplied';
    var statusLabels = { unapplied: '未申请', submitted: '已交件·等待审批', approved: '已获批', permanent: '永居' };
    this.setData({
      userStatus: userStatus,
      selectedPath: session.selectedPath || null,
      statusLabel: statusLabels[userStatus] || ''
    });
    this.loadGuides();
  },

  onShow: function() { this.refreshRatings(); },

  loadGuides: function() {
    var that = this;
    that.setData({ loading: true, loadError: false });
    var ratingCache = wx.getStorageSync('guide_ratings') || {};
    var cards = guideData.getAllCards();
    cards = cards.map(function(c) { c.helpful = ratingCache[c.id] || c.helpful; return c; });
    var rec = guideData.getRecommended(that.data.userStatus, that.data.selectedPath);
    var recCards = rec.cards.map(function(c) { c.helpful = ratingCache[c.id] || c.helpful; return c; });
    that.setData({ guideCards: cards, recommendedCards: recCards, recommendedReason: rec.reason, loading: false });
    that.applyFilters();
    that.tryCloudLoad(ratingCache);
  },

  tryCloudLoad: function(ratingCache) {
    var that = this;
    if (!app.globalData.cloudReady && !wx.cloud) return;
    wx.cloud.callFunction({ name: 'guidebook', data: { action: 'getArticles', page: 1, pageSize: 200, sortBy: 'default' } }).then(function(res) {
      if (res.result && res.result.code === 0 && res.result.data && res.result.data.articles && res.result.data.articles.length > 0) {
        var localIds = {};
        that.data.guideCards.forEach(function(c) { localIds[c.id] = true; });
        var cloudArticles = res.result.data.articles.map(function(a) { a.helpful = ratingCache[a.id] || a.helpful || 0; return a; });
        // 仅补充本地缺失的卡片，不替换已有数据
        var merged = that.data.guideCards.slice();
        var added = 0;
        cloudArticles.forEach(function(a) {
          if (!localIds[a.id]) { merged.push(a); added++; }
        });
        that.setData({ guideCards: merged, cloudSource: added > 0 });
        that.applyFilters();
      }
    }).catch(function(e) { console.log('[攻略书] 云端加载失败:', e.message); });
  },

  refreshRatings: function() {
    var ratingCache = wx.getStorageSync('guide_ratings') || {};
    var cards = this.data.guideCards.map(function(c) { c.helpful = ratingCache[c.id] || c.helpful; return c; });
    if (cards.length > 0) { this.setData({ guideCards: cards }); this.applyFilters(); }
  },

  onSearchInput: function(e) { this.setData({ searchKeyword: e.detail.value }); this.applyFilters(); },
  onSearchFocus: function() { this.setData({ searchFocused: true }); },
  onSearchBlur: function() { this.setData({ searchFocused: false }); },
  clearSearch: function() { this.setData({ searchKeyword: '' }); this.applyFilters(); },
  switchCategory: function(e) { this.setData({ activeCategory: e.currentTarget.dataset.category }); this.applyFilters(); },
  switchSort: function(e) { this.setData({ sortBy: e.currentTarget.dataset.sort }); this.applyFilters(); },

  applyFilters: function() {
    var cards = this.data.guideCards.slice();
    var kw = this.data.searchKeyword, cat = this.data.activeCategory, sort = this.data.sortBy;
    if (cat !== 'all') cards = cards.filter(function(c) { return c.category === cat; });
    if (kw.trim()) {
      var lower = kw.trim().toLowerCase();
      cards = cards.filter(function(c) { return (c.title || '').toLowerCase().indexOf(lower) >= 0 || (c.desc || '').toLowerCase().indexOf(lower) >= 0 || (c.tags || []).some(function(t) { return t.toLowerCase().indexOf(lower) >= 0; }); });
    }
    if (sort === 'helpful') cards.sort(function(a, b) { return (b.helpful || 0) - (a.helpful || 0); });
    else if (sort === 'latest') cards.sort(function(a, b) { return (b.updated || '').localeCompare(a.updated || ''); });
    this.setData({ filteredCards: cards });
  },

  navigateToDetail: function(e) {
    var id = e.currentTarget.dataset.id;
    if (!id) return;
    var fullData = guideData.getById(id);
    // 若本地DB有完整数据 → 缓存并跳转
    if (fullData) {
      var ratingCache = wx.getStorageSync('guide_ratings') || {};
      var data = {};
      var keys = Object.keys(fullData);
      for (var i = 0; i < keys.length; i++) { data[keys[i]] = fullData[keys[i]]; }
      data.helpful = ratingCache[id] || fullData.helpful;
      if (!app.globalData.__guideDetailCache__) app.globalData.__guideDetailCache__ = {};
      app.globalData.__guideDetailCache__[id] = data;
    } else {
      // 云端卡片：用列表数据构造最小缓存，detail页后台补全
      var card = (this.data.guideCards || []).find(function(c) { return c.id === id; });
      if (card) {
        if (!app.globalData.__guideDetailCache__) app.globalData.__guideDetailCache__ = {};
        app.globalData.__guideDetailCache__[id] = {
          id: card.id, title: card.title, icon: card.icon, desc: card.desc || '',
          contentType: card.contentType || 'article', sections: [],
          category: card.category, tags: card.tags, confidence: card.confidence || 'B',
          source: card.source || '攻略书', updated: card.updated || '',
          rating: card.rating || '4.0', helpful: card.helpful || 0
        };
      }
    }
    wx.navigateTo({ url: '/pages/guidebooks/detail/detail?id=' + id });
  },

  searchByTag: function(e) { this.setData({ searchKeyword: e.currentTarget.dataset.tag }); this.applyFilters(); },
  scrollToTop: function() { this.setData({ scrollTop: 0 }); wx.pageScrollTo({ scrollTop: 0, duration: 300 }); },
  onPullDownRefresh: function() { this.loadGuides(); wx.stopPullDownRefresh(); },
  onShareAppMessage: function() { return { title: '住港伴攻略书 — 香港身份办理全流程攻略', path: '/pages/guidebooks/index/index' }; }
});
