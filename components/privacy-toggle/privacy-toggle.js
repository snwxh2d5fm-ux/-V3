// 住港伴 — 隐私模式切换组件
const app = getApp();

Component({
  properties: {
    mode: { type: String, value: 'local' },
  },
  data: {
    modes: [
      { key: 'local', label: '本地', icon: '🔒', desc: '完整保留' },
      { key: 'desensitized', label: '脱敏', icon: '🛡️', desc: 'PII替换' },
      { key: 'feature', label: '特征', icon: '🏷️', desc: '仅标签' },
    ],
    currentMode: 'local',
  },
  lifetimes: {
    attached() {
      this.setData({ currentMode: app.getPrivacyMode() });
    },
  },
  methods: {
    switchMode(e) {
      const mode = e.currentTarget.dataset.mode;
      app.setPrivacyMode(mode);
      this.setData({ currentMode: mode });
      this.triggerEvent('change', { mode });
    },
  },
});
