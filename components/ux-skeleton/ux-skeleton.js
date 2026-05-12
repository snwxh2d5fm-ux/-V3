/**
 * ux-skeleton — 通用骨架屏组件 v1
 * 支持 card / list / grid / text 四种布局模式
 * 
 * Props:
 *   mode: 'card' | 'list' | 'grid' | 'text'  (default: 'card')
 *   count: 重复数量 (default: 1)
 *   animated: 是否动画 (default: true)
 */
Component({
  properties: {
    mode: { type: String, value: 'card' },
    count: { type: Number, value: 1 },
    animated: { type: Boolean, value: true }
  },
  data: {
    items: []
  },
  lifetimes: {
    attached: function() {
      this.setData({
        items: Array.from({ length: this.properties.count }, function(_, i) { return { key: i }; })
      });
    }
  },
  observers: {
    'count': function(val) {
      this.setData({
        items: Array.from({ length: val }, function(_, i) { return { key: i }; })
      });
    }
  }
});
