Page({
  data: { playbookId: '', playbook: null },
  onLoad(options) {
    const data = {
      b01: { title: '优才12准则逐一攻略', rating: 4.5, source: '用户经验 + 网络整理', updated: '2026-04-01',
        points: ['掌握12项准则的评分逻辑，优先满足高权重项', '学历准则：QS前100自动满足，非前100需提供其他材料', '工作准则：5年以上管理经验权重最高'],
        steps: ['逐项勾选检查表', '对照标准判断是否满足', '不满足项准备补充材料', '整体评估满足6项即可递交'],
        pitfalls: ['不要盲目凑齐6项，质量比数量重要', '赴港计划书与准则需对应']
      }
    };
    const playbook = data[options.id] || { title: '分类攻略详情' };
    this.setData({ playbookId: options.id, playbook });
  }
});
