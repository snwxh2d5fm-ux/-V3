// pages/playbook/index/index.js - 分类攻略 (流程控内嵌)·获客钩子·免费完全开放
const app = getApp();
const constants = require('../../../data/constants');

Page({
  data: {
    categories: [
      { key: 'all', name: '全部', icon: '📚' },
      { key: 'QMAS', name: '优才', icon: '🎯' },
      { key: 'TTPS', name: '高才通', icon: '🚀' },
      { key: 'IANG', name: 'IANG', icon: '🎓' },
      { key: 'ASMTP', name: '专才', icon: '💼' },
      { key: 'LIFE', name: '生活', icon: '🏠' },
      { key: 'TAX', name: '税务', icon: '💰' },
      { key: 'EDUCATION', name: '教育', icon: '📖' },
    ],
    activeCategory: 'all',
    guides: [],
    searchKeyword: '',
    loading: false,
    page: 1,
    hasMore: true,
    searchFocus: false,
  },

  onLoad() {
    this.loadGuides();
  },

  onPullDownRefresh() {
    this.setData({ page: 1, guides: [], hasMore: true });
    const self = this;
    this.loadGuides().then(function () {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadGuides();
    }
  },

  loadGuides: function () {
    if (this.data.loading) return;
    this.setData({ loading: true });

    try {
      // 从本地缓存或云数据库加载攻略
      const cacheKey = constants.STORAGE_KEYS.GUIDES_CACHE || '__guides_cache__';
      let allGuides = wx.getStorageSync(cacheKey) || [];

      // 如果缓存为空，加载内置示例数据
      if (!allGuides.length) {
        allGuides = this.getBuiltInGuides();
        wx.setStorageSync(cacheKey, allGuides);
      }

      let filtered = allGuides;
      const activeCategory = this.data.activeCategory;
      const searchKeyword = this.data.searchKeyword;

      if (activeCategory !== 'all') {
        filtered = filtered.filter(function (g) {
          return g.knowledge_domain === activeCategory;
        });
      }
      if (searchKeyword) {
        const kw = searchKeyword.toLowerCase();
        filtered = filtered.filter(function (g) {
          return (
            (g.title && g.title.indexOf(kw) >= 0) ||
            (g.topics &&
              g.topics.some(function (t) {
                return t.indexOf(kw) >= 0;
              }))
          );
        });
      }

      // 分页
      const pageSize = 10;
      const start = (this.data.page - 1) * pageSize;
      const pageData = filtered.slice(start, start + pageSize);

      const guides = this.data.page === 1 ? pageData : this.data.guides.concat(pageData);
      this.setData({
        guides: guides,
        hasMore: start + pageSize < filtered.length,
        loading: false,
      });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  getBuiltInGuides() {
    return [
      {
        id: 'g1',
        title: '香港优才12项评分标准详解（2025新版）',
        knowledge_domain: 'QMAS',
        topics: ['优才', '评分'],
        summary: '逐条拆解12项评分标准...',
        usefulCount: 156,
        imageUrl: '',
      },
      {
        id: 'g2',
        title: '高才通A类申请全流程：从收入证明到获批',
        knowledge_domain: 'TTPS',
        topics: ['高才通', 'A类'],
        summary: '年收入250万港币证明材料清单...',
        usefulCount: 89,
        imageUrl: '',
      },
      {
        id: 'g3',
        title: 'IANG签证转永居：7年时间线完整攻略',
        knowledge_domain: 'IANG',
        topics: ['IANG', '永居'],
        summary: '从学生签证到永居的每一步...',
        usefulCount: 203,
        imageUrl: '',
      },
      {
        id: 'g4',
        title: '香港租房避坑指南：签约前必查的5件事',
        knowledge_domain: 'LIFE',
        topics: ['租房', '生活'],
        summary: '签约前务必核查...',
        usefulCount: 312,
        imageUrl: '',
      },
      {
        id: 'g5',
        title: '香港银行开户实战：中银汇丰渣打对比',
        knowledge_domain: 'LIFE',
        topics: ['银行', '开户'],
        summary: '三间银行开户要求对比...',
        usefulCount: 178,
        imageUrl: '',
      },
      {
        id: 'g6',
        title: '专才自雇申请全流程：自己聘自己',
        knowledge_domain: 'ASMTP',
        topics: ['专才', '自雇'],
        summary: '自雇专才的材料清单...',
        usefulCount: 67,
        imageUrl: '',
      },
      {
        id: 'g7',
        title: '香港薪俸税报税省钱攻略',
        knowledge_domain: 'TAX',
        topics: ['税务', '报税'],
        summary: '合法减税的N种方式...',
        usefulCount: 145,
        imageUrl: '',
      },
      {
        id: 'g8',
        title: '香港国际学校申请时间线与面试准备',
        knowledge_domain: 'EDUCATION',
        topics: ['教育', '国际学校'],
        summary: '热门国际学校申请节点...',
        usefulCount: 92,
        imageUrl: '',
      },
    ];
  },

  switchCategory(e) {
    const { key } = e.currentTarget.dataset;
    if (key === this.data.activeCategory) return;
    this.setData({ activeCategory: key, page: 1, guides: [], hasMore: true });
    this.loadGuides();
  },

  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value });
  },

  onSearch() {
    this.setData({ page: 1, guides: [], hasMore: true });
    this.loadGuides();
  },

  onSearchClear() {
    this.setData({ searchKeyword: '', page: 1, guides: [], hasMore: true });
    this.loadGuides();
  },

  onGuideTap(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/subpkg-guide/pages/guide-detail/index?id=${id}` });
  },

  onUsefulTap(e) {
    const { id } = e.currentTarget.dataset;
    const guides = this.data.guides.map(function (g) {
      if (g.id === id) {
        g.usefulCount = (g.usefulCount || 0) + 1;
        g.userVoted = true;
      }
      return g;
    });
    this.setData({ guides: guides });
    wx.showToast({ title: '感谢反馈 👍', icon: 'none' });
  },
});
