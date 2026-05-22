Component({
  properties: {
    locked: { type: Boolean, value: true },
    unlockHint: { type: String, value: '上传里程碑材料后可解锁' },
    stageName: { type: String, value: '' },
  },
  methods: {
    onUnlock() {
      this.triggerEvent('unlock');
    },
  },
});
