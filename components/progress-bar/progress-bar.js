Component({
  properties: {
    percent: { type: Number, value: 0 },
    color: { type: String, value: 'var(--color-primary)' },
    height: { type: Number, value: 8 }
  },
  observers: {
    'percent': '_updateBarColor'
  },
  lifetimes: {
    attached: '_updateBarColor'
  },
  methods: {
    _updateBarColor: function() {
      var p = this.data.percent;
      this.setData({ barColor: p >= 80 ? '#059669' : p >= 50 ? '#D97706' : '#DC2626' });
    }
  }
});
