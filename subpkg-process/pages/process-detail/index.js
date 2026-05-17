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
    if (options && options.id) {
      this.setData({ processId: options.id });
      this.loadProcess(options.id);
    } else {
      wx.showToast({ title: '缺少流程ID', icon: 'none' });
      setTimeout(function() { wx.navigateBack(); }, 1000);
    }
  },

  loadProcess(processId) {
    var process = getProcessLine(processId);
    if (!process || !process.stages || !Array.isArray(process.stages)) {
      wx.showToast({ title: '流程数据异常', icon: 'none' });
      setTimeout(function() { wx.navigateBack(); }, 1000);
      return;
    }
    var template = templates.processTemplates.find(function(t) { return t.id === process.templateId; });
    // 计算进度
    var completedStages = process.stages.filter(function(s) { return s.status === 'completed'; }).length;
    var progress = Math.round((completedStages / process.stages.length) * 100);
    var updated = {};
    for (var k in process) { if (process.hasOwnProperty(k)) updated[k] = process[k]; }
    updated.progress = progress;
    this.setData({
      process: updated,
      template
    });
  },

  // 展开/折叠阶段
  toggleStage(e) {
    var stageId = e.currentTarget.dataset.id;
    var stage = this.data.process.stages.find(function(s) { return s.id === stageId; });
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
    var stageId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/subpkg-process/pages/milestone-verify/index?processId=${this.data.processId}&stageId=${stageId}`
    });
  },

  // 标记步骤完成
  markStepDone(e) {
    try {
      var stageId = e.currentTarget.dataset.stageId;
      var stepIdx = e.currentTarget.dataset.stepIdx;
      // 深拷贝 stages 数组，避免修改共享引用
      var process = null;
      try { process = JSON.parse(JSON.stringify(this.data.process)); } catch (e2) { return; }
      if (!process || !process.stages) return;
      var stage = process.stages.find(function(s) { return s.id === stageId; });
      if (!stage) return;
      stage.completedSteps = stage.completedSteps || [];
      if (stage.completedSteps.indexOf(stepIdx) === -1) {
        stage.completedSteps.push(stepIdx);
      }
      if (stage.completedSteps.length >= stage.steps.length) {
        stage.status = 'completed';
        // 解锁下一阶段
        var nextIdx = process.stages.indexOf(stage) + 1;
        if (nextIdx < process.stages.length) {
          process.stages[nextIdx].unlocked = true;
          process.stages[nextIdx].status = 'current';
          process.stages[nextIdx].startedAt = new Date().toISOString();
          process.currentStage = process.stages[nextIdx].name;
        }
      }
      try {
        saveProcessLine(process);
      } catch (e3) {
        console.error('[流程详情] 保存流程失败:', e3);
        wx.showToast({ title: '保存失败，请重试', icon: 'none' });
        return;
      }
      this.loadProcess(this.data.processId);
    } catch (e0) {
      console.error('[流程详情] markStepDone 异常:', e0);
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  // 更新后在onshow重新加载
  onShow() {
    if (this.data.processId) this.loadProcess(this.data.processId);
  }
});
