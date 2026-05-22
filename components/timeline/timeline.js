Component({
  properties: {
    items: { type: Array, value: [] },
    activeIndex: { type: Number, value: 0 },
  },
  methods: {
    onItemTap(e) {
      this.triggerEvent('itemtap', { index: e.currentTarget.dataset.index });
    },
  },
});
