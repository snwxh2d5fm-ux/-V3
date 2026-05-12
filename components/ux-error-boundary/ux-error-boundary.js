/**
 * ux-error-boundary — 统一错误边界组件 v1
 * 覆盖三种场景：网络异常 / 服务异常 / 数据异常
 * 
 * Props:
 *   type: 'network' | 'server' | 'data' | 'custom'  (default: 'network')
 *   message: 自定义错误文案 (type='custom' 时必填)
 *   retryable: 是否显示重试按钮 (default: true)
 *
 * Events:
 *   bind:retry — 用户点击重试
 */
Component({
  properties: {
    type: { type: String, value: 'network' },
    message: { type: String, value: '' },
    retryable: { type: Boolean, value: true }
  },
  data: {
    icon: '',
    title: '',
    desc: ''
  },
  lifetimes: {
    attached: function() {
      this.updateContent();
    }
  },
  observers: {
    'type, message': function() {
      this.updateContent();
    }
  },
  methods: {
    updateContent: function() {
      var configs = {
        network:  { icon: '📡', title: '网络连接异常',    desc: '请检查网络后重试，或切换到离线模式查看已缓存内容' },
        server:   { icon: '🔧', title: '服务暂时不可用',  desc: '云端服务正在维护中，请稍后再试' },
        data:     { icon: '📭', title: '数据加载失败',    desc: '未能获取所需数据，请检查权限或联系客服' },
        custom:   { icon: '⚠️',  title: '操作异常',      desc: this.properties.message || '请稍后重试' }
      };
      var cfg = configs[this.properties.type] || configs.custom;
      if (this.properties.type === 'custom' && this.properties.message) {
        cfg.desc = this.properties.message;
      }
      this.setData({ icon: cfg.icon, title: cfg.title, desc: cfg.desc });
    },
    onRetry: function() {
      this.triggerEvent('retry');
    }
  }
});
