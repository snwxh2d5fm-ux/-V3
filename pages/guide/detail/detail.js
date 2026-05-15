// pages/guide/detail/detail.js - 攻略详情页
Page({
  data: {
    guide: null,
    relatedGuides: [],
    isCollected: false,
    showFullContent: true,
    allOpen: false
  },

  onLoad(options) {
    const { id } = options;
    if (id) this.loadGuide(id);
  },

  loadGuide(id) {
    // 从缓存获取攻略数据
    var cache = wx.getStorageSync('__guides_cache__') || [];
    var guide = cache.find(function(g) { return g.id === id; });

    if (guide) {
      this.setData({ guide: guide });
      this.loadRelated(guide);
      this.checkCollection(id);
    } else {
      wx.showToast({ title: '攻略未找到', icon: 'none' });
    }
  },

  loadRelated(guide) {
    var cache = wx.getStorageSync('__guides_cache__') || [];
    var related = cache
      .filter(function(g) { return g.id !== guide.id && g.knowledge_domain === guide.knowledge_domain; })
      .slice(0, 3);
    this.setData({ relatedGuides: related });
  },

  checkCollection(id) {
    var collected = wx.getStorageSync('__guide_collections__') || [];
    this.setData({ isCollected: collected.indexOf(id) >= 0 });
  },

  toggleCollect() {
    var guide = this.data.guide;
    var isCollected = this.data.isCollected;
    var collected = wx.getStorageSync('__guide_collections__') || [];
    if (isCollected) {
      collected = collected.filter(function(id) { return id !== guide.id; });
    } else {
      collected.push(guide.id);
    }
    wx.setStorageSync('__guide_collections__', collected);
    this.setData({ isCollected: !isCollected });
    wx.showToast({ title: isCollected ? '已取消收藏' : '已收藏 ⭐', icon: 'none' });
  },

  onUsefulTap() {
    var guide = this.data.guide;
    guide.usefulCount = (guide.usefulCount || 0) + 1;
    // 回写缓存
    var cache = wx.getStorageSync('__guides_cache__') || [];
    var idx = cache.findIndex(function(g) { return g.id === guide.id; });
    if (idx > -1) cache[idx].usefulCount = guide.usefulCount;
    wx.setStorageSync('__guides_cache__', cache);
    this.setData({ guide: guide });
    wx.showToast({ title: '感谢反馈 👍', icon: 'none' });
  },

  onNotUsefulTap() {
    wx.showToast({ title: '感谢反馈，我们会改进', icon: 'none' });
  },

  onRelatedTap(e) {
    const { id } = e.currentTarget.dataset;
    wx.redirectTo({ url: `/pages/guide/detail/detail?id=${id}` });
  },

  toggleLayer(e) {
    const { id } = e.currentTarget.dataset;
    const guide = this.data.guide;
    if (!guide || !guide.layers) return;
    const layers = guide.layers.map(function(l) {
      if (l.id === id) { l.open = !l.open; }
      return l;
    });
    guide.layers = layers;
    this.setData({ guide });
  },

  toggleAll() {
    const guide = this.data.guide;
    if (!guide || !guide.layers) return;
    const allOpen = !this.data.allOpen;
    const layers = guide.layers.map(function(l) {
      l.open = allOpen;
      return l;
    });
    guide.layers = layers;
    this.setData({ guide, allOpen });
  },

  onShareAppMessage() {
    return {
      title: this.data.guide ? this.data.guide.title : '住港伴攻略',
      path: `/pages/guide/detail/detail?id=${this.data.guide.id}`
    };
  }
});
