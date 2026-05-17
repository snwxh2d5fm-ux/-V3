var corpus = require('../../data/school-corpus.json');

Page({
  data: {
    schools: [],
    filtered: [],
    keyword: '',
    activeType: '全部'
  },

  onLoad: function() {
    var all = [];
    for (var key in corpus) {
      var s = corpus[key];
      all.push({
        id: s.id || key,
        name: s['学校名称'] || '',
        type: s['类别'] || '',
        net: s['所属校网'] || '',
        region: s['地区'] || '',
        fee: s['学费/年'] || '',
        difficulty: s['插班难度'] || '',
        curriculum: s['课程体系'] || ''
      });
    }
    this.setData({ schools: all });
    this.doFilter();
  },

  onSearch: function(e) {
    this.setData({ keyword: e.detail.value });
    this.doFilter();
  },

  onFilter: function(e) {
    this.setData({ activeType: e.currentTarget.dataset.type });
    this.doFilter();
  },

  doFilter: function() {
    var type = this.data.activeType;
    var kw = (this.data.keyword || '').toLowerCase();
    var filtered = this.data.schools.filter(function(s) {
      if (type !== '全部' && s.type !== type) return false;
      if (kw) {
        var txt = (s.name + s.region + s.net + s.curriculum).toLowerCase();
        if (txt.indexOf(kw) < 0) return false;
      }
      return true;
    });
    this.setData({ filtered: filtered });
  }
});