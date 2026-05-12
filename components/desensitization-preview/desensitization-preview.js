Component({
  properties: {
    imagePath: { type: String, value: '' },
    fields: { type: Object, value: {} },
    mode: { type: String, value: 'local' }
  },
  data: {
    showOriginal: false
  },
  methods: {
    toggleView() { this.setData({ showOriginal: !this.data.showOriginal }); }
  }
});
