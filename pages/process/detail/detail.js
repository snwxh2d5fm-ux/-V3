// 住港伴 — 流程详情进度看板
const { getProcessLine, saveProcessLine } = require('../../../utils/storage');
const templates = require('../../../data/templates.js');

Page({
  data: {
    processId: '',
    process: null,
    template: null,
    expandedStage: null
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ processId: options.id });
      this.loadProcess(options.id);
    }
  },

  loadProcess(processId) {
    const process = getProcessLine(processId);
    if (!process) {
      wx.showToast({ title: '流程不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1000);
      return;
    }
    const template = templates.processTemplates.find(t => t.id === process.templateId);
    // 计算进度
    const completedStages = process.stages.filter(s => s.status === 'completed').length;
    const progress = Math.round((completedStages / process.stages.length) * 100);
    this.setData({
      process: { ...process, progress },
      template
    });
  },

  // 展开/折叠阶段
  toggleStage(e) {
    const stageId = e.currentTarget.dataset.id;
    const stage = this.data.process.stages.find(s => s.id === stageId);
    if (!stage || !stage.unlocked) {
      wx.showToast({ title: '请先上传里程碑材料解锁此阶段', icon: 'none' });
      return;
    }
    this.setData({
      expandedStage: this.data.expandedStage === stageId ? null : stageId
    });
  },

  // 解锁阶段
  unlockStage(e) {
    const stageId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/milestone-verify/milestone-verify?processId=${this.data.processId}&stageId=${stageId}`
    });
  },

  // 标记步骤完成
  markStepDone(e) {
    const { stageId, stepIdx } = e.currentTarget.dataset;
    const process = { ...this.data.process };
    const stage = process.stages.find(s => s.id === stageId);
    if (!stage) return;
    stage.completedSteps = stage.completedSteps || [];
    if (!stage.completedSteps.includes(stepIdx)) {
      stage.completedSteps.push(stepIdx);
    }
    if (stage.completedSteps.length >= stage.steps.length) {
      stage.status = 'completed';
      // 解锁下一阶段
      const nextIdx = process.stages.indexOf(stage) + 1;
      if (nextIdx < process.stages.length) {
        process.stages[nextIdx].unlocked = true;
        process.stages[nextIdx].status = 'current';
        process.stages[nextIdx].startedAt = new Date().toISOString();
        process.currentStage = process.stages[nextIdx].name;
      }
    }
    saveProcessLine(process);
    this.loadProcess(this.data.processId);
  },

  // 更新后在onshow重新加载
  onShow() {
    if (this.data.processId) this.loadProcess(this.data.processId);
  }
});
