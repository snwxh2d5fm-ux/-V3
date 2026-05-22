Component({
  properties: {
    items: { type: Array, value: [] },
    readonly: { type: Boolean, value: false },
  },
  methods: {
    onToggle(e) {
      if (this.data.readonly) return;
      this.triggerEvent('toggle', { index: e.currentTarget.dataset.index });
    },
  },
});
