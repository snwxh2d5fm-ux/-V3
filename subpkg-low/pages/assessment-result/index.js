/**
 * 住港伴 v4.1 — 评估结果页 v5.1
 * 展示方案库路径匹配结果 + 画像×路径兼容性校验
 */
const app = getApp();
const constants = require('../../../data/constants');
const { ALL_PATH_DETAILS } = require('../../../data/solution-library');
const templates = require('../../../data/templates');
const { saveProcessLine } = require('../../../utils/storage');
const { getCompatibility, validateBestMatch, getPersonaName } = require('../../data/persona-path-compat');
const tracker = require('../../../utils/tracker');

Page({
  data: {
    persona: 0,
    personaName: '',
    matches: [],
    bestMatch: null,
    loading: true,
    expandedPath: null,
    // 兼容性警告
    compatWarning: null,
    compatWarningOk: true
  },

  onLoad(options) {
    let persona = parseInt(options.persona) || 0;
    // 兜底：URL 未带 persona 时从 storage 读取
    if (!persona) {
      persona = wx.getStorageSync('__assessment_persona__') || 0;
    }
    const personaName = getPersonaName(persona);

    const recommendation = app.globalData.solutionRecommendation ||
      wx.getStorageSync('__solution_recommendation__') || [];

    if (!recommendation || recommendation.length === 0) {
      this.setData({ loading: false, persona, personaName, matches: [] });
      return;
    }

    // 用方案库详情 + 兼容性标签丰富
    const enriched = recommendation.map((m, i) => {
      const detail = ALL_PATH_DETAILS[m.path] || {};
      const riskInfo = constants.PATH_RISK_LEVELS[m.path] || {};
      const cycleInfo = constants.PATH_CYCLES[m.path] || {};
      const compat = getCompatibility(persona, m.path);

      return {
        ...m,
        rank: i + 1,
        name: detail.name || constants.PATH_NAMES[m.path] || m.path,
        riskLevel: riskInfo.level || detail.riskLevel || 'unknown',
        riskLabel: riskInfo.label || '❓未知',
        riskColor: riskInfo.color || '#9CA3AF',
        totalCycle: cycleInfo.label || detail.totalCycle || '—',
        firstVisa: cycleInfo.firstVisa || detail.firstVisa || '—',
        keyRisks: detail.keyRisks || [],
        decisionPoints: detail.decisionPoints || [],
        phases: detail.phases || [],
        confidenceLabel: m.confidence === 'high' ? '高匹配' : m.confidence === 'medium' ? '中匹配' : '低匹配',
        confidenceColor: m.confidence === 'high' ? '#059669' : m.confidence === 'medium' ? '#EA580C' : '#DC2626',
        confidenceBg: m.confidence === 'high' ? '#ECFDF5' : m.confidence === 'medium' ? '#FFF7ED' : '#FEF2F2',
        // 兼容性标签
        compatLevel: compat.level,
        compatLabel: compat.label,
        compatColor: compat.color,
        compatBg: compat.bg
      };
    });

    const bestMatch = enriched[0] || null;

    // 保存评估结果用于通关路线预填
    if (bestMatch) {
      try {
        wx.setStorageSync('__assess_prefill__', {
          recommendedPath: bestMatch.path || '',
          updatedAt: Date.now()
        });
      } catch(e) {}
    }

    // 校验最佳匹配 vs 当前画像
    let compatWarning = null;
    let compatWarningOk = true;
    if (bestMatch && persona > 0) {
      const validation = validateBestMatch(persona, bestMatch.path);
      if (validation.warning) {
        compatWarning = validation.warning;
        compatWarningOk = validation.ok;
      }
    }

    this.setData({
      persona,
      personaName,
      matches: enriched,
      bestMatch,
      loading: false,
      compatWarning,
      compatWarningOk
    });

    // 追踪：评估完成
    if (enriched.length > 0) {
      tracker.track('assessment_completed', {
        persona: persona,
        personaName: personaName,
        topMatches: enriched.slice(0, 3).map(function(m) {
          return { path: m.path, name: m.name, score: m.matchScore, confidence: m.confidence };
        })
      });
    }
  },

  toggleExpand(e) {
    const path = e.currentTarget.dataset.path;
    this.setData({
      expandedPath: this.data.expandedPath === path ? null : path
    });
  },

  /**
   * 选择路径 → 锁定流程线 → 跳转准备清单
   */
  selectPath(e) {
    const path = e.currentTarget.dataset.path;
    const match = this.data.matches.find(m => m.path === path);

    app.globalData.selectedPath = path;
    app.globalData.solutionRecommendation = this.data.matches;
    wx.setStorageSync(constants.STORAGE_KEYS.ACTIVE_PROCESS_ID, path);
    wx.setStorageSync('__solution_recommendation__', this.data.matches);

    // 追踪：评估结果路径选择
    tracker.track('path_selected', {
      pathType: path,
      pathLabel: match ? match.name : path,
      source: 'assessment',
      persona: this.data.persona,
      personaLabel: this.data.personaName,
      matchScore: match ? match.matchScore : 0,
      matchConfidence: match ? match.confidence : '',
      rank: match ? match.rank : 0
    });

    const template = templates.processTemplates.find(t => t.id === path);
    if (!template) {
      wx.showToast({ title: '已选择路径，前往首页', icon: 'success', duration: 800 });
      wx.switchTab({ url: '/pages/process/index/index' });
      return;
    }

    // 展开模板 phases → stages
    const stages = [];
    if (template.phases) {
      template.phases.forEach((phase, pi) => {
        (phase.steps || []).forEach((step, si) => {
          stages.push({
            id: step.id || `${phase.id}_s${si}`,
            order: stages.length,
            name: step.name,
            description: '',
            phaseId: phase.id,
            phaseName: phase.name,
            phaseOrder: pi,
            confidence: step.confidence || phase.confidence || 'B',
            steps: [step.name]
          });
        });
      });
    }

    const processLine = {
      id: `assess_${Date.now()}`,
      name: template.name,
      templateId: path,
      pathType: template.pathType || path,
      riskLevel: template.riskLevel || match?.riskLevel || 'medium',
      totalCycle: template.totalCycle || match?.totalCycle || '—',
      decisionPoints: template.decisionPoints || [],
      phases: template.phases || [],
      stages: stages.map((s, i) => ({
        ...s,
        status: i === 0 ? 'current' : 'pending',
        unlocked: i === 0,
        completedSteps: [],
        progress: 0,
        startedAt: i === 0 ? new Date().toISOString() : null
      })),
      status: 'active',
      progress: 0,
      currentStage: stages[0]?.name || '',
      readyMaterials: 0,
      totalMaterials: stages.length,
      createdAt: new Date().toISOString(),
      source: 'assessment',
      matchScore: match?.matchScore || 0,
      confidence: match?.confidence || 'medium'
    };

    saveProcessLine(processLine);
    app.globalData.activeProcessId = processLine.id;
    app.globalData.activeProcess = processLine;

    // 清理旧的 assessment 来源流程（保留仅最新）
    const { getAllProcessLines } = require('../../../utils/storage');
    const allLines = getAllProcessLines();
    const oldAssess = allLines.filter(l => l.source === 'assessment' && l.id !== processLine.id);
    oldAssess.forEach(l => {
      // 标记为非活跃
      l.status = 'archived';
      saveProcessLine(l);
    });

    wx.showToast({ title: `已锁定：${template.name}`, icon: 'success', duration: 800 });
    wx.reLaunch({ url: '/pages/process/index/index' });
  },

  retake() {
    wx.redirectTo({ url: '/subpkg-low/pages/assessment-index/index' });
  }
});
