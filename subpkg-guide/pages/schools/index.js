var corpus = require('../../data/school-corpus.js');

var TYPE_MAP = { '官立':'gov', '资助':'aid', '直资':'dss', '私立':'private', '国际':'intl' };
var NET_MAP = {
  '名校网': ['11','12','34','41'],
  '第二梯队': ['31','32','35','48','62','88'],
  '新来港推荐': ['71','74','80','72']
};

Page({
  data: {
    schools: [],
    filtered: [],
    keyword: '',
    activeType: '全部',
    activeRegion: '',
    activeFee: '',
    activeNet: '',
    showRegionPanel: false,
    showFeePanel: false,
    showNetPanel: false
  },

  onLoad: function() {
    var all = [];
    for (var key in corpus) {
      var s = corpus[key];
      var type = s['类别'] || '';
      all.push({
        id: s.id || key,
        name: s['学校名称'] || '',
        type: type,
        typeKey: TYPE_MAP[type] || 'gov',
        net: s['所属校网'] || '',
        netNum: (s['所属校网'] || '').match(/\d+/),
        region: s['地区'] || '',
        fee: s['学费/年'] || '',
        feeNum: (s['学费/年'] || '').match(/[0-9,]+/),
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

  onTypeFilter: function(e) {
    this.setData({ activeType: e.currentTarget.dataset.type });
    this.doFilter();
  },

  // 区域
  onToggleRegion: function() {
    this.setData({ showRegionPanel: !this.data.showRegionPanel, showFeePanel: false, showNetPanel: false });
  },
  onRegionPick: function(e) {
    this.setData({ activeRegion: e.currentTarget.dataset.region, showRegionPanel: false });
    this.doFilter();
  },

  // 费用
  onToggleFee: function() {
    this.setData({ showFeePanel: !this.data.showFeePanel, showRegionPanel: false, showNetPanel: false });
  },
  onFeePick: function(e) {
    this.setData({ activeFee: e.currentTarget.dataset.fee, showFeePanel: false });
    this.doFilter();
  },

  // 校网
  onToggleNet: function() {
    this.setData({ showNetPanel: !this.data.showNetPanel, showRegionPanel: false, showFeePanel: false });
  },
  onNetPick: function(e) {
    this.setData({ activeNet: e.currentTarget.dataset.net, showNetPanel: false });
    this.doFilter();
  },

  doFilter: function() {
    var type = this.data.activeType;
    var region = this.data.activeRegion;
    var fee = this.data.activeFee;
    var net = this.data.activeNet;
    var kw = (this.data.keyword || '').toLowerCase();
    var netNums = NET_MAP[net] || [];

    var filtered = this.data.schools.filter(function(s) {
      if (type !== '全部' && s.type !== type) return false;
      if (region && region !== '全部') {
        if (s.region.indexOf(region) < 0) return false;
      }
      if (fee && fee !== '全部') {
        var isFree = !s.fee || s.fee.indexOf('免费') >= 0 || s.fee.indexOf('HK$0') >= 0;
        if (fee === '免费' && !isFree) return false;
        if (fee === '收费' && isFree) return false;
      }
      if (netNums.length) {
        var found = false;
        for (var i=0; i<netNums.length; i++) {
          if (s.net.indexOf(netNums[i]) >= 0) { found=true; break; }
        }
        if (!found) return false;
      }
      if (kw) {
        var txt = (s.name + s.region + s.net + s.curriculum).toLowerCase();
        if (txt.indexOf(kw) < 0) return false;
      }
      return true;
    });
    this.setData({ filtered: filtered });
  }
});