Component({
  properties: {
    percent: { type: Number, value: 0 },
    color: { type: String, value: 'var(--color-primary)' },
    height: { type: Number, value: 8 }
  },
  computed: {
    barColor() { return this.data.percent >= 80 ? '#059669' : this.data.percent >= 50 ? '#D97706' : '#DC2626'; }
  }
});
