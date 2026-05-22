/**
 * 7阶段流程指示器组件
 * stages: [{id, label, status}]  status = done|active|pending|locked
 * progress: 进度百分比 0-100
 */
Component({
  properties: {
    stages: { type: Array, value: [] },
    progress: { type: Number, value: 0 },
  },
});
