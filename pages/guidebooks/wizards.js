/**
 * 攻略书 — 互动向导模块
 * 从 guidebooks/index/index.js 提取，包含找房向导和校网向导
 * @param {object} page — Page 实例 (this)，用于调用 setData 等 Page 方法
 * @param {object} storage — onboarding-storage 模块实例
 */
var districtData = require('../../data/district-data');
function housingWizard(page, storage) {
  return {
    onHousingBannerTap: function() {
      page.setData({ showHousingWizard: true, wizardStep: 0, wizardBudget: '', wizardWork: '', wizardSubRegion: '', wizardSubRegions: [], wizardHasKids: false, wizardResults: [] });
    },

    onWizardNext: function(e) {
      var step = page.data.wizardStep;
      var value = e.currentTarget.dataset.value;

      if (step === 0) {
        page.setData({ wizardBudget: value, wizardStep: 1 });
      } else if (step === 1) {
        page.setData({ wizardWork: value });
        if (value === 'remote') {
          page.setData({ wizardStep: 3, wizardSubRegion: '' });
        } else {
          var SUB_REGIONS = {
            'hong-kong-island': [{v:'central',l:'中环/金钟'},{v:'wanchai',l:'湾仔/铜锣湾'},{v:'quarrybay',l:'鲗鱼涌/太古'},{v:'aberdeen',l:'香港仔/南区'}],
            'kowloon': [{v:'tsimshatsui',l:'尖沙咀'},{v:'mongkok',l:'旺角/油麻地'},{v:'kwuntong',l:'观塘/九龙湾'},{v:'kaitak',l:'启德/红磡'}],
            'new-territories': [{v:'shatin',l:'沙田/大围'},{v:'tsuenwan',l:'荃湾/葵涌'},{v:'tuenmun',l:'屯门/元朗'},{v:'tko',l:'将军澳/西贡'}]
          };
          page.setData({ wizardStep: 2, wizardSubRegions: SUB_REGIONS[value] || [] });
        }
      } else if (step === 2) {
        page.setData({ wizardSubRegion: value, wizardStep: 3 });
      } else if (step === 3) {
        page.setData({ wizardHasKids: value === 'yes', wizardStep: 4 });
        var budgetId = page.data.wizardBudget;
        var budgetValue = 10000;
        var brackets = districtData.BUDGET_BRACKETS;
        for (var bi = 0; bi < brackets.length; bi++) { if (brackets[bi].id === budgetId) { budgetValue = brackets[bi].min; break; } }
        var results = districtData.matchDistricts(budgetValue, page.data.wizardWork, page.data.wizardHasKids);
        var COMMUTE_MAP = { central:'central', wanchai:'causewayBay', quarrybay:'causewayBay', aberdeen:'central', tsimshatsui:'tst', mongkok:'tst', kwuntong:'causewayBay', kaitak:'tst', shatin:'tst', tsuenwan:'tst', tuenmun:'tst', tko:'causewayBay' };
        var SUB_COMMUTE = { central:'中环', wanchai:'铜锣湾', quarrybay:'鲗鱼涌', aberdeen:'香港仔', tsimshatsui:'尖沙咀', mongkok:'旺角', kwuntong:'观塘', kaitak:'启德', shatin:'沙田', tsuenwan:'荃湾', tuenmun:'屯门', tko:'将军澳' };
        var subKey = page.data.wizardSubRegion;
        results.forEach(function(r) {
          r.stars = r.familyFriendly ? new Array(r.familyFriendly + 1).join('⭐') : '⭐';
          r._hasSchoolNet = !!(r.schoolNet && r.schoolNet.primary > 0);
          var commuteField = COMMUTE_MAP[subKey] || 'central';
          r._commuteLabel = (SUB_COMMUTE[subKey] || '中环') + ' ' + (r.commute[commuteField] || r.commute.central) + 'min';
        });
        page.setData({ wizardResults: results });
      }
    },

    onWizardDone: function() {
      storage.completeTask('onboard-300');
      storage.markHousingWizardDone();
      page.setData({ showHousingWizard: false, housingWizardDone: true });
      page.refreshProgress();
      var phases = page.data.phases.map(function(p) { if (p.phase === 3) p.expanded = true; return p; });
      page.setData({ phases: phases });
      wx.showToast({ title: '找房向导完成 ✓', icon: 'success' });
    },

    onWizardClose: function() { page.setData({ showHousingWizard: false }); }
  };
}

function schoolNetWizard(page) {
  return {
    onSchoolNetBannerTap: function() {
      page.setData({ showSchoolNetWizard: true, snWizardStep: 0, snWizardLevel: '', snWizardRegion: '', snWizardBudget: '' });
    },
    onSNWizardNext: function(e) {
      var step = page.data.snWizardStep;
      var value = e.currentTarget.dataset.value;
      if (step === 0) page.setData({ snWizardLevel: value });
      else if (step === 1) page.setData({ snWizardRegion: value });
      else if (step === 2) page.setData({ snWizardBudget: value });
      if (step === 2) {
        var schoolNetData = require('../../../data/school-net-data');
        var results = schoolNetData.matchSchoolNets(page.data.snWizardLevel, page.data.snWizardRegion, page.data.snWizardBudget);
        results.forEach(function(r) { r.stars = new Array(r.familyRating + 1).join('⭐'); });
        page.setData({ snWizardStep: 3, snWizardResults: results });
      } else { page.setData({ snWizardStep: step + 1 }); }
    },
    onSNWizardDone: function() {
      page.setData({ showSchoolNetWizard: false });
      wx.showToast({ title: '校网速查完成 ✓', icon: 'success' });
      var phases = page.data.phases.map(function(p) { if (p.phase === 5) p.expanded = true; return p; });
      page.setData({ phases: phases });
    },
    onSNWizardClose: function() { page.setData({ showSchoolNetWizard: false }); },
    onSNOpenSchools: function() { page.setData({ showSchoolNetWizard: false }); wx.navigateTo({ url: '/subpkg-guide/pages/schools/index' }); }
  };
}

module.exports = { housingWizard: housingWizard, schoolNetWizard: schoolNetWizard };
