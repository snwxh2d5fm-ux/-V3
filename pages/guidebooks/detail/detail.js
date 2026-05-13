/**
 * 住港伴 v4.5 — 攻略详情页 (PRD v4 §3.7.4 + 排版美化)
 * 
 * ====== 正文解析引擎 (v4.5 新增) ======
 * 将 sections[].body 原始文本解析为结构化段落数组
 * type: 'heading' | 'numbered' | 'bullet' | 'paragraph' | 'keypoint'
 * 
 * ====== 3通道数据加载 ======
 * Channel 1: app.globalData.__guideDetailCache__[id] (0ms)
 * Channel 2: require('guidebook-data').getById(id) (0ms)
 * Channel 3: 云函数 guidebook.getArticleDetail (后台)
 */
var app = getApp();
var constants = require('../../../data/constants');
var guideData = require('../../../data/guidebook-data');

// ========== 正文智能解析 ==========

/**
 * 检测段落是否内含多个数字编号/要点标记，如有则按编号边界拆分
 * 解决 "1. xxx。2. xxx。3. xxx" 或 "①xxx②xxx" 这类内联编号无法分段的问题
 * @returns {string[]|null} 拆分后的子项，无需拆分时返回 null
 */
function splitInternalNumbered(paragraph) {
  // 综合匹配所有编号前缀模式
  var patterns = [
    /\d+[\.、\)）]/g,          // "1." "2、" "3)" "4）"
    /[①②③④⑤⑥⑦⑧⑨⑩]/g,        // 圆圈数字
    /[⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/g,        // 圆圈数字 11-20
    /坑\d+[：:]/g,              // "坑1：" "坑2："
    /准则\d/g,                  // "准则1"
    /注意[：:]/g,               // "注意："
    /提示[：:]/g                // "提示："
  ];

  var matches = [];
  for (var i = 0; i < patterns.length; i++) {
    var re = new RegExp(patterns[i].source, 'g');
    var m;
    while ((m = re.exec(paragraph)) !== null) {
      // 排除数字紧跟在非数字字符后的单数字假匹配（如 "10" 中的 "1"）
      if (patterns[i].source.indexOf('\\d+') === 0) {
        // 数字编号：确保是完整数字（前面不是数字）
        if (m.index > 0 && /\d/.test(paragraph.charAt(m.index - 1))) continue;
      }
      matches.push({ index: m.index, len: m[0].length });
    }
  }

  // 按位置排序
  matches.sort(function(a, b) { return a.index - b.index; });

  // 去重 + 过滤重叠（同一位置只保留最长的一个）
  var unique = [];
  for (var j = 0; j < matches.length; j++) {
    if (j === 0 || matches[j].index !== matches[j - 1].index) {
      unique.push(matches[j]);
    }
  }

  // 少于2个编号 → 不拆分（单编号由行首正则处理）
  if (unique.length < 2) return null;

  // 拆分：在每个编号前缀前切开
  var parts = [];
  for (var k = 0; k < unique.length; k++) {
    var start = unique[k].index;
    var end = k + 1 < unique.length ? unique[k + 1].index : paragraph.length;
    var part = paragraph.substring(start, end).trim();
    // 去掉尾部的句号/中文句号（隔离符）
    part = part.replace(/[。.]$/, '');
    // 去掉尾部的分号
    part = part.replace(/[；;]$/, '');
    if (part) parts.push(part);
  }

  return parts.length >= 2 ? parts : null;
}

/**
 * 对单行文本分类并压入 segments 数组
 */
function classifyLine(segments, line, opts) {
  opts = opts || {};
  // 中文序号标题（一、二、三、…）
  if (/^[一二三四五六七八九十]、/.test(line) || /^（[一二三四五六七八九十]）/.test(line)) {
    segments.push({ type: 'heading', content: line });
    return;
  }
  // 准则X、坑X、第X步 标题
  if (/^(准则|坑)\d/.test(line) || /^第[一二三四五六七八九十\d]+[步条节项]/.test(line)) {
    segments.push({ type: 'heading', content: line });
    return;
  }
  // 数字编号: "1." "1、" "①" "(1)" "1）"
  if (/^\d+[\.、\)）]\s*/.test(line) || /^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/.test(line) || /^\(\d+\)/.test(line)) {
    segments.push({ type: 'numbered', content: line });
    return;
  }
  // 要点符号
  if (/^[•·◦▪▸►☑☐✓✔⬥◆◇]/.test(line) || /^[-–—]\s/.test(line)) {
    segments.push({ type: 'bullet', content: line.replace(/^[•·◦▪▸►☑☐✓✔⬥◆◇]\s*/, '').replace(/^[-–—]\s*/, '') });
    return;
  }
  // 关键信息 (从内联拆分来的子项也走这里)
  if (/^(注意|坑\d|重要|提示|特别说明)[：:]/.test(line)) {
    segments.push({ type: 'keypoint', content: line });
    return;
  }
  // 普通段落
  if (opts.forceParagraph) {
    segments.push({ type: 'paragraph', content: line });
  } else {
    // 返回 line 以便上层累积
    return line;
  }
}

function parseBodyIntoSegments(body) {
  if (!body) return [];
  var segments = [];
  var currentPara = '';
  // 按自然段分割
  var paragraphs = body.split(/\n+/);
  for (var i = 0; i < paragraphs.length; i++) {
    var p = paragraphs[i].trim();
    if (!p) {
      if (currentPara) { segments.push({ type: 'paragraph', content: currentPara.trim() }); currentPara = ''; }
      continue;
    }

    // ★ 核心新增：检测内联编号/要点 → 自动拆分
    var subItems = splitInternalNumbered(p);
    if (subItems) {
      if (currentPara) { segments.push({ type: 'paragraph', content: currentPara.trim() }); currentPara = ''; }
      for (var s = 0; s < subItems.length; s++) {
        var result = classifyLine(segments, subItems[s]);
        if (result) currentPara += (currentPara ? '\n' : '') + result;
      }
      continue;
    }

    // 原有逐行分类
    var result = classifyLine(segments, p);
    if (result) {
      if (currentPara) currentPara += '\n' + p;
      else currentPara = p;
    }
  }
  if (currentPara) segments.push({ type: 'paragraph', content: currentPara.trim() });
  return segments;
}

function parseSections(sections) {
  if (!sections || !sections.length) return [];
  var parsed = [];
  for (var i = 0; i < sections.length; i++) {
    var s = sections[i];
    parsed.push({
      heading: s.heading || '',
      segments: parseBodyIntoSegments(s.body || '')
    });
  }
  return parsed;
}

Page({
  data: {
    guide: null, guideId: '', loading: true, loadError: false, notFound: false,
    contentType: 'article', parsedSections: [],
    userRating: null, ratingSubmitting: false, relatedGuides: [],
    showFullContent: false, showConfidenceInfo: false
  },

  onLoad: function(options) {
    var id = options.id;
    if (!id) { this.setData({ notFound: true, loading: false }); return; }
    this.setData({ guideId: id });
    var ratings = wx.getStorageSync('guide_ratings_detail') || {};
    this.setData({ userRating: ratings[id] || null });
    this.loadDetail(id);
  },

  loadDetail: function(id) {
    var that = this;
    that.setData({ loading: true, loadError: false });
    if (app.globalData.__guideDetailCache__ && app.globalData.__guideDetailCache__[id]) {
      that.renderGuide(app.globalData.__guideDetailCache__[id]);
      that.loadRelated(app.globalData.__guideDetailCache__[id]);
      return;
    }
    var localGuide = guideData.getById(id);
    if (localGuide) {
      var ratingCache = wx.getStorageSync('guide_ratings') || {};
      var data = {};
      var keys = Object.keys(localGuide);
      for (var i = 0; i < keys.length; i++) { data[keys[i]] = localGuide[keys[i]]; }
      data.helpful = ratingCache[id] || localGuide.helpful;
      that.renderGuide(data);
      that.loadRelated(data);
      that.refreshFromCloud(id);
      return;
    }
    that.loadFromCloud(id, function(cloudGuide) {
      if (cloudGuide) { that.renderGuide(cloudGuide); that.loadRelated(cloudGuide); return; }
      that.setData({ loading: false, loadError: true });
    });
  },

  loadFromCloud: function(id, callback) {
    if (!app.globalData.cloudReady && !wx.cloud) { callback(null); return; }
    wx.cloud.callFunction({ name: 'guidebook', data: { action: 'getArticleDetail', articleId: id } }).then(function(res) {
      if (res.result && res.result.code === 0 && res.result.data) { callback(res.result.data); }
      else { callback(null); }
    }).catch(function(e) { console.log('[攻略详情] 云端失败:', e.message); callback(null); });
  },

  refreshFromCloud: function(id) {
    if (!app.globalData.cloudReady && !wx.cloud) return;
    wx.cloud.callFunction({ name: 'guidebook', data: { action: 'getArticleDetail', articleId: id } }).then(function(res) {
      if (res.result && res.result.code === 0 && res.result.data) {
        if (!app.globalData.__guideDetailCache__) app.globalData.__guideDetailCache__ = {};
        app.globalData.__guideDetailCache__[id] = res.result.data;
      }
    }).catch(function() {});
  },

  renderGuide: function(guide) {
    var ct = guide.contentType;
    if (!ct) {
      if (guide.faqAnswer && guide.faqAnswer.length > 0) ct = 'faq';
      else if (guide.steps && guide.steps.length > 0) ct = 'steps';
      else ct = 'article';
    }
    var confidence = guide.confidence || 'B';
    var confidenceInfo = constants.CONFIDENCE_LEVELS[confidence] || constants.CONFIDENCE_LEVELS.B;
    var parsedSections = ct === 'faq' ? (function(text) { if (!text) return []; return text.split(/\\n+/).filter(function(b){ return b.trim(); }).map(function(b){ b = b.trim(); var c = b.indexOf('：'); if (c < 0) c = b.indexOf(':'); if (c > 0 && c < 40) return { type: 'heading', content: b.substring(0, c+1) }; if (/^\\d+[.]/.test(b)) return { type: 'numbered', content: b }; if (/^[-]/.test(b)) return { type: 'bullet', content: b.replace(/^[-]\\s*/, '') }; return { type: 'body', content: b }; }); })(guide.faqAnswer) : parseSections(guide.sections);

    this.setData({
      guide: {
        id: guide.id, title: guide.title, icon: guide.icon,
        desc: guide.desc || '', contentType: ct,
        faqAnswer: guide.faqAnswer || '', steps: guide.steps || [],
        sections: guide.sections || [], pitfalls: guide.pitfalls || [],
        materials: guide.materials || [], source: guide.source || '攻略书',
        updated: guide.updated || '', rating: guide.rating || '4.0',
        helpful: guide.helpful || 0, confidence: confidence,
        confidenceInfo: confidenceInfo, tags: guide.tags || [],
        legalBasis: guide.legalBasis || '',
        applicableConditions: guide.applicableConditions || '',
        content: guide.content || ''
      },
      parsedSections: parsedSections, contentType: ct, loading: false
    })
  },

  loadRelated: function(guide) {
    var category = guide.category || 'life';
    var all = guideData.getByCategory(category);
    var related = [];
    for (var i = 0; i < all.length; i++) {
      if (all[i].id !== guide.id) { related.push(all[i]); if (related.length >= 4) break; }
    }
    this.setData({ relatedGuides: related });
  },

  rateArticle: function(e) {
    if (this.data.ratingSubmitting) return;
    var that = this, rating = e.currentTarget.dataset.rating;
    var previousRating = that.data.userRating;
    var newRating = previousRating === rating ? null : rating;
    that.setData({ userRating: newRating, ratingSubmitting: true });
    try {
      var ratings = wx.getStorageSync('guide_ratings_detail') || {};
      if (newRating) ratings[that.data.guideId] = newRating;
      else delete ratings[that.data.guideId];
      wx.setStorageSync('guide_ratings_detail', ratings);
      var mainRatings = wx.getStorageSync('guide_ratings') || {};
      var helpful = that.data.guide.helpful || 0;
      if (newRating === 'up' && previousRating !== 'up') { helpful++; if (previousRating === 'down') helpful++; }
      else if (newRating === 'down' && previousRating !== 'down') { helpful = Math.max(0, helpful - 1); if (previousRating === 'up') helpful = Math.max(0, helpful - 1); }
      else if (!newRating && previousRating === 'up') helpful = Math.max(0, helpful - 1);
      else if (!newRating && previousRating === 'down') helpful++;
      mainRatings[that.data.guideId] = helpful;
      wx.setStorageSync('guide_ratings', mainRatings);
      that.setData({ 'guide.helpful': helpful });
      if (app.globalData.cloudReady || wx.cloud) {
        wx.cloud.callFunction({ name: 'guidebook', data: { action: 'rateArticle', articleId: that.data.guideId, rating: newRating, previousRating: previousRating } }).catch(function() {});
      }
    } catch(err) { console.error(err); wx.showToast({ title: '评分失败', icon: 'none' }); }
    that.setData({ ratingSubmitting: false });
  },

  toggleBookmark: function() {
    var bookmarks = wx.getStorageSync('guidebook_bookmarks') || [];
    var id = this.data.guideId, index = bookmarks.indexOf(id);
    if (index >= 0) { bookmarks.splice(index, 1); wx.showToast({ title: '已取消收藏', icon: 'none' }); }
    else { bookmarks.unshift(id); wx.showToast({ title: '已收藏', icon: 'success' }); }
    wx.setStorageSync('guidebook_bookmarks', bookmarks);
  },

  toggleFullContent: function() { this.setData({ showFullContent: !this.data.showFullContent }); },
  toggleConfidenceInfo: function() { this.setData({ showConfidenceInfo: !this.data.showConfidenceInfo }); },
  navigateToRelated: function(e) {
    var id = e.currentTarget.dataset.id;
    if (id) {
      var g = guideData.getById(id);
      if (g) { if (!app.globalData.__guideDetailCache__) app.globalData.__guideDetailCache__ = {}; app.globalData.__guideDetailCache__[id] = g; }
      wx.redirectTo({ url: '/pages/guidebooks/detail/detail?id=' + id });
    }
  },
  goBack: function() { wx.navigateBack(); },
  retry: function() { this.loadDetail(this.data.guideId); },
  onShareAppMessage: function() {
    var guide = this.data.guide;
    return { title: guide ? guide.title : '住港伴 — 香港身份攻略', path: '/pages/guidebooks/detail/detail?id=' + this.data.guideId };
  }
});
