Component({
  properties: {
    percent: { type: Number, value: 0 },
    color: { type: String, value: 'var(--color-primary)' },
    height: { type: Number, value: 8 }
  },
  observers: {
    'percent': function(percent) {
      this.setData({
        barColor: percent >= 80 ? '#059669' : percent >= 50 ? '#D97706' : '#DC2626'
      });
    }
  },
  lifetimes: {
    attached: function() {
      this.setData({
        barColor: this.data.percent >= 80 ? '#059669' : this.data.percent >= 50 ? '#D97706' : '#DC2626'
      });
    }
  }
});
