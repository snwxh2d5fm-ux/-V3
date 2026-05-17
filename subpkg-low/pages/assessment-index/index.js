/**
 * 住港伴 v4.1 — 资格评估自评页
 * 15道题逐题作答 → 方案库路径匹配 → 报告页
 * 基于 PRD v3.1 五级置信度框架 + 12用户画像
 */
const app = getApp();
const constants = require('../../../data/constants');
const { matchPersonaToPaths, ALL_PATH_DETAILS } = require('../../../data/solution-library');
const { submitAssessment } = require('../../../utils/api');

Page({
  data: {
    // 题目列表 (从 constants 加载)
    questions: [],
    totalQuestions: 0,

    // 当前题目索引
    currentIndex: 0,

    // 用户答案 { questionId: selectedOptionIndex }
    answers: {},

    // 当前选中选项
    selectedOption: null,

    // 动画状态
    animating: false,
    direction: 'forward', // forward | back

    // 是否为多选
    isMultiSelect: false,
    multiSelected: {},

    // 进度
    progress: 0,
    canGoBack: false,
    canGoForward: false,

    // 提交状态
    submitting: false,
    error: null
  },

  onLoad(options) {
    const persona = parseInt(options.persona) || 0;
    this._persona = persona; // 保存画像ID供提交时传递
    const questions = this.buildQuestions(persona).map(q => ({
      ...q,
      criteriaLines: (q.criteria || '').split('\n').filter(line => line.trim())
    }));
    this.setData({
      questions,
      totalQuestions: questions.length,
      canGoBack: false,
      canGoForward: false,
      progress: 0
    });
    // 初始化第一题
    this.updateProgress();
  },

  /**
   * 根据用户子状态画像过滤/排序题目
   * persona: 1=在校学生 2=在职人士 4=企业主 7=海外华人
   */
  buildQuestions(persona) {
    const all = constants.ASSESSMENT_QUESTIONS;

    // 根据不同画像调整题目顺序和可见性
    if (persona === 1) {
      // 在校学生：优先学历，跳过工作经验相关
      return all.filter(q =>
        !['experience', 'position', 'company', 'income', 'capital', 'hasIP'].includes(q.id)
      );
    }
    if (persona === 4) {
      // 企业主：优先资产和公司相关
      return all.filter(q =>
        !['major', 'position', 'hasFamousCompany'].includes(q.id)
      );
    }
    if (persona === 7) {
      // 海外华人：显示全部
      return all;
    }
    // 默认（在职人士 persona 2）：显示全部
    return all;
  },

  /**
   * 更新进度条和按钮状态
   */
  updateProgress() {
    const { currentIndex, questions, answers } = this.data;
    const answered = Object.keys(answers).length;
    this.setData({
      progress: Math.round((answered / questions.length) * 100),
      canGoBack: currentIndex > 0,
      canGoForward: !!answers[questions[currentIndex]?.id]
    });
  },

  /**
   * 选择选项
   */
  selectOption(e) {
    const idx = e.currentTarget.dataset.index;
    const q = this.data.questions[this.data.currentIndex];

    if (q.type === 'multiSelect') {
      // 多选：toggle
      const multi = { ...this.data.multiSelected };
      multi[idx] = !multi[idx];
      const selectedValues = Object.keys(multi).filter(k => multi[k]);
      this.setData({
        multiSelected: multi,
        selectedOption: selectedValues.length > 0 ? selectedValues : null,
        canGoForward: selectedValues.length > 0
      });
      // 同步到 answers
      if (selectedValues.length > 0) {
        this.setData({
          ['answers.' + q.id]: selectedValues
        });
      } else {
        const a = { ...this.data.answers };
        delete a[q.id];
        this.setData({ answers: a });
      }
    } else {
      // 单选
      this.setData({
        selectedOption: idx,
        canGoForward: true,
        ['answers.' + q.id]: idx
      });
    }
  },

  /**
   * 上一题
   */
  goPrev() {
    if (!this.data.canGoBack || this.data.animating) return;
    this.setData({ animating: true, direction: 'back' });
    const prevIndex = this.data.currentIndex - 1;
    const prevQ = this.data.questions[prevIndex];
    const prevAnswer = this.data.answers[prevQ.id];

    setTimeout(() => {
      this.setData({
        currentIndex: prevIndex,
        selectedOption: prevQ.type === 'multiSelect' ? prevAnswer : prevAnswer ?? null,
        multiSelected: prevQ.type === 'multiSelect'
          ? this.buildMultiMap(prevAnswer)
          : {},
        animating: false
      });
      this.updateProgress();
    }, 200);
  },

  /**
   * 下一题
   */
  goNext() {
    if (!this.data.canGoForward || this.data.animating) return;
    const { currentIndex, questions } = this.data;

    if (currentIndex >= questions.length - 1) {
      // 最后一题 → 提交
      this.submitAnswers();
      return;
    }

    this.setData({ animating: true, direction: 'forward' });
    const nextIndex = currentIndex + 1;
    const nextQ = this.data.questions[nextIndex];
    const nextAnswer = this.data.answers[nextQ.id];

    setTimeout(() => {
      this.setData({
        currentIndex: nextIndex,
        selectedOption: nextQ.type === 'multiSelect' ? nextAnswer : nextAnswer ?? null,
        multiSelected: nextQ.type === 'multiSelect'
          ? this.buildMultiMap(nextAnswer)
          : {},
        animating: false
      });
      this.updateProgress();
    }, 200);
  },

  buildMultiMap(answer) {
    if (!answer) return {};
    const map = {};
    (Array.isArray(answer) ? answer : []).forEach(i => { map[i] = true; });
    return map;
  },

  /**
   * 提交答案 → 本地匹配 + 云端匹配 → 跳转报告页
   */
  async submitAnswers() {
    if (this.data.submitting) return;
    this.setData({ submitting: true, error: null });

    try {
      const profile = this.buildProfile();

      // V5: 提取身份画像 → 写入 IDENTITY_PROFILE 供智能材料清单使用
      this.saveIdentityProfile();

      // 1. 本地确定性匹配
      const localMatches = matchPersonaToPaths(profile);

      // 2. 云端增强匹配（非阻塞，fallback）
      let cloudMatches = [];
      try {
        const res = await submitAssessment(
          this.data.questions.map((q, i) => ({
            id: q.id,
            question: q.question,
            answer: this.data.answers[q.id] !== undefined
              ? (q.type === 'multiSelect'
                  ? (this.data.answers[q.id] || []).map(j => q.options[j])
                  : q.options[this.data.answers[q.id]])
              : null
          }))
        );
        if (res && res.matches) cloudMatches = res.matches;
      } catch (e) {
        console.log('[自评] 云端匹配不可用，使用本地结果');
      }

      // 3. 合并结果
      const merged = this.mergeResults(localMatches, cloudMatches);

      // 4. 存入 globalData
      app.globalData.solutionRecommendation = merged;
      wx.setStorageSync('__solution_recommendation__', merged);

      // 5. 跳转报告页（携带画像ID供兼容性校验）
      this.setData({ submitting: false });
      wx.redirectTo({
        url: `/subpkg-low/pages/assessment-result/index?persona=${this._persona || 0}`
      });

    } catch (e) {
      this.setData({ submitting: false, error: '评估服务暂时不可用，请稍后重试' });
      console.error('[自评] 提交失败:', e);
    }
  },

  /**
   * 将答案转换为 profile 对象（供方案库匹配）
   */
  buildProfile() {
    const a = this.data.answers;
    const qs = this.data.questions;

    const getAnswer = (id) => {
      const q = qs.find(q => q.id === id);
      if (!q || a[id] === undefined) return null;
      if (q.type === 'multiSelect') {
        return (a[id] || []).map(i => q.options[i]).join(',');
      }
      return q.options[a[id]];
    };

    return {
      persona: this._persona || 0,
      age: this.parseAge(getAnswer('age')),
      education: getAnswer('education') || '',
      eligibleSchool: this.parseEligibleSchool(getAnswer('school')),
      major: getAnswer('major') || '',
      industry: getAnswer('industry') || '',
      experience: this.parseYears(getAnswer('experience')),
      position: getAnswer('position') || '',
      hasFamous: this.parseBoolean(getAnswer('hasFamousCompany')),
      hasIntlExp: this.parseBoolean(getAnswer('hasIntlExp')),
      income: this.parseIncome(getAnswer('income')),
      companyType: this.parseCompanyType(getAnswer('company')),
      language: getAnswer('language') || '',
      englishProficient: this.parseEnglish(getAnswer('language')),
      hasKids: this.parseHasKids(getAnswer('family')),
      childAge: this.parseChildAge(getAnswer('family')),
      hasIP: this.parseBoolean(getAnswer('hasIP')),
      capital: this.parseCapital(getAnswer('capital')),
      studyType: null,
      isTargetIndustry: this.parseTargetIndustry(getAnswer('industry')),
      educationLevel: this.parseEducationLevel(getAnswer('education')),
      hasParentCompanion: false,
      hasListedCompany: false
    };
  },

  // ==== 答案解析辅助函数 ====
  parseAge(ans) {
    if (!ans) return 30;
    if (ans.includes('18-25')) return 21;
    if (ans.includes('26-30')) return 28;
    if (ans.includes('31-39')) return 35;
    if (ans.includes('40-44')) return 42;
    if (ans.includes('45-50')) return 47;
    return 55;
  },
  parseEligibleSchool(ans) {
    if (!ans) return false;
    return ans.includes('百强') || ans.includes('合资格');
  },
  parseYears(ans) {
    if (!ans) return 3;
    if (ans.includes('< 3')) return 1;
    if (ans.includes('3-5')) return 4;
    if (ans.includes('5-10')) return 7;
    return 12;
  },
  parseBoolean(ans) {
    if (!ans) return false;
    return ans.startsWith('是');
  },
  parseIncome(ans) {
    if (!ans) return 0;
    // 选项格式: "HK$250万及以上（约¥233万）" / "HK$100-250万（约¥93-233万）"
    // 注意：必须按 HK$ 前缀精确匹配，避免子串误判（HK$100-250万 含 "HK$250"）
    const clean = ans.trim();
    if (clean.startsWith('HK$250万'))       return 3000000;
    if (clean.startsWith('HK$100-250万'))   return 1800000;
    if (clean.startsWith('HK$50-100万'))    return 750000;
    if (clean.startsWith('HK$30-50万'))     return 400000;
    if (clean.startsWith('HK$30万以下'))     return 200000;
    // 兼容旧格式
    if (clean.includes('250万港币'))        return 3000000;
    if (clean.includes('100-250万'))        return 1800000;
    if (clean.includes('50-100万'))         return 750000;
    if (clean.includes('30-50万'))          return 400000;
    return 200000;
  },
  parseCompanyType(ans) {
    if (!ans) return 'employed';
    if (ans.includes('500强') || ans.includes('上市')) return 'famous';
    if (ans.includes('创业') || ans.includes('自雇')) return 'enterprise_owner';
    return 'employed';
  },
  parseEnglish(ans) {
    if (!ans) return false;
    return ans.includes('英语流利') || ans.includes('雅思');
  },
  parseHasKids(ans) {
    if (!ans) return false;
    return ans.includes('有子女');
  },
  parseChildAge(ans) {
    if (!ans) return undefined;
    if (ans.includes('< 18岁') || ans.includes('< 18')) return 10;
    return undefined;
  },
  parseMaritalStatus(ans) {
    if (!ans) return 'unknown';
    if (ans.includes('单身')) return 'single';
    if (ans.includes('已婚')) return 'married';
    if (ans.includes('离异')) return 'divorced';
    return 'unknown';
  },
  parseChildCount(ans) {
    if (!ans) return 0;
    if (ans.includes('1个')) return 1;
    if (ans.includes('2个') || ans.includes('及以上')) return 2;
    return 0;
  },

  /**
   * V5: 从自评答案中提取身份画像并写入存储
   */
  saveIdentityProfile() {
    var a = this.data.answers;
    var qs = this.data.questions;
    var getAnswer = function(id) {
      var q = qs.find(function(q) { return q.id === id; });
      if (!q || a[id] === undefined) return null;
      if (q.type === 'multiSelect') return (a[id] || []).map(function(i) { return q.options[i]; }).join(',');
      return q.options[a[id]];
    };

    var familyAns = getAnswer('family') || '';
    var subStatus = wx.getStorageSync(constants.STORAGE_KEYS.USER_SUB_STATUS) || '';
    var persona = this._persona || 0;
    var personaLabel = '';
    if (subStatus.indexOf('student') > -1) personaLabel = '在校学生';
    else if (subStatus.indexOf('employed') > -1) personaLabel = '在职人士';
    else if (subStatus.indexOf('owner') > -1) personaLabel = '企业主';
    else if (subStatus.indexOf('overseas') > -1) personaLabel = '海外华人';

    var profile = {
      maritalStatus: this.parseMaritalStatus(familyAns),
      hasChildren: this.parseHasKids(familyAns),
      childCount: this.parseChildCount(familyAns),
      persona: persona,
      personaLabel: personaLabel,
      updatedAt: Date.now(),
      source: 'assessment'
    };

    wx.setStorageSync(constants.STORAGE_KEYS.IDENTITY_PROFILE, profile);
    console.log('[自评] 身份画像已保存:', JSON.stringify(profile));
  },
  parseCapital(ans) {
    if (!ans) return 0;
    // 选项格式: "HK$3,000万及以上"
    const clean = ans.trim();
    if (clean.startsWith('HK$3,000万'))         return 35000000;
    if (clean.startsWith('HK$1,000-3,000万'))   return 20000000;
    if (clean.startsWith('HK$500-1,000万'))      return 7500000;
    if (clean.startsWith('HK$500万以下'))         return 2000000;
    // 兼容旧格式
    if (clean.includes('3000万港币'))            return 35000000;
    if (clean.includes('1000-3000万'))           return 20000000;
    if (clean.includes('500-1000万'))            return 7500000;
    return 2000000;
  },
  parseTargetIndustry(ans) {
    if (!ans) return false;
    return ['金融', '资讯科技', '工程', 'STEM'].some(k => ans.includes(k));
  },
  parseEducationLevel(ans) {
    if (!ans) return 1;
    if (ans.includes('博士')) return 4;
    if (ans.includes('硕士')) return 3;
    if (ans.includes('本科')) return 2;
    return 1;
  },

  /**
   * 合并本地和云端匹配结果
   */
  mergeResults(local, cloud) {
    const scoreMap = {};
    local.forEach(m => {
      scoreMap[m.path] = (scoreMap[m.path] || 0) + (m.matchScore || 0);
    });
    cloud.forEach(m => {
      scoreMap[m.path] = (scoreMap[m.path] || 0) + (m.matchScore || m.score || 0);
    });
    return Object.entries(scoreMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([path, score]) => ({
        path,
        matchScore: Math.min(Math.round(score / (cloud.length > 0 ? 2 : 1)), 100),
        confidence: score >= 80 ? 'high' : score >= 50 ? 'medium' : 'low',
        details: ALL_PATH_DETAILS[path] || null
      }));
  }
});
