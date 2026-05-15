const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

function dedupTasks(tasks) {
  const seen = {};
  const result = [];
  for (const t of tasks) {
    const key = t._id || (t.title + '_' + t.phase + '_' + t.sequence);
    if (seen[key]) continue;
    seen[key] = true;
    result.push(t);
  }
  return result;
}

function assemblePathOnServer(allTasks, params) {
  const { visaType, familyStatus, arrivalScenario, existingAssets = [] } = params;

  // Phase unlock rules
  const phaseUnlockMap = {
    'pre-arrival': [0],
    'fresh': [0, 1, 2, 3, 4, 5, 6, 7],
    'delayed': [2, 3, 4, 5, 6, 7]
  };
  const unlockedPhases = phaseUnlockMap[arrivalScenario] || [1, 2, 3, 4, 5, 6, 7];

  const PHASE_NAMES = {
    0: '抵港前准备', 1: '落地生存', 2: '行政开户', 3: '安居乐业',
    4: '出行融入', 5: '子女教育', 6: '财务税务', 7: '续签准备'
  };

  const tasks = [];

  for (const task of allTasks) {
    // Phase check
    if (!unlockedPhases.includes(task.phase)) continue;

    const at = task.applicable_to || {};

    // Visa type match
    if (at.visa_types !== 'all' &&
        (!Array.isArray(at.visa_types) || !at.visa_types.includes(visaType))) continue;

    // Family status match
    if (at.family_status !== 'all' &&
        (!Array.isArray(at.family_status) || !at.family_status.includes(familyStatus))) continue;

    // Arrival scenario match
    if (at.arrival_scenarios && !at.arrival_scenarios.includes('all') &&
        !at.arrival_scenarios.includes(arrivalScenario)) continue;

    // Auto-skip existing assets
    let autoSkipped = false;
    let skipReason = '';
    if (at.skip_if_existing && Array.isArray(at.skip_if_existing)) {
      for (const asset of at.skip_if_existing) {
        if (existingAssets.includes(asset)) {
          autoSkipped = true;
          const assetNames = {
            'hkid': '香港身份证',
            'bank-account': '银行户口',
            'rental': '已签租约',
            'driving-license': '香港驾照'
          };
          skipReason = '已拥有: ' + (assetNames[asset] || asset);
          break;
        }
      }
    }

    tasks.push({ ...task, autoSkipped, skipReason: skipReason || '' });
  }

  // Sort by phase then sequence
  tasks.sort((a, b) => a.phase - b.phase || a.sequence - b.sequence);

  // Phase summary
  const phases = unlockedPhases.map(phase => {
    const phaseTasks = tasks.filter(t => t.phase === phase);
    const required = phaseTasks.filter(t => t.urgency === '必修' && !t.autoSkipped);
    return {
      phase,
      name: PHASE_NAMES[phase],
      unlocked: true,
      totalRequired: required.length,
      totalTasks: phaseTasks.filter(t => !t.autoSkipped).length
    };
  });

  return {
    tasks,
    phases,
    summary: {
      totalRequired: tasks.filter(t => t.urgency === '必修' && !t.autoSkipped).length,
      totalTasks: tasks.filter(t => !t.autoSkipped).length,
      applicableFamily: familyStatus !== 'single'
    }
  };
}

exports.main = async (event, context) => {
  const { mode, params = {} } = event;
  const collection = db.collection('life_guide_tasks');

  try {
    switch (mode) {
      case 'byPhase':
        // params: { phases: [0,1,2] }
        // Return active tasks in given phases, sorted by phase then sequence
        const { phases } = params;
        const phaseResult = await collection
          .where({ phase: _.in(phases), status: 'active' })
          .orderBy('phase', 'asc')
          .orderBy('sequence', 'asc')
          .get();
        return { code: 0, data: phaseResult.data, total: phaseResult.data.length };

      case 'byPath':
        // params: { visaType, familyStatus, arrivalScenario, existingAssets }
        const allResult = await collection
          .where({ status: 'active' })
          .orderBy('phase', 'asc')
          .orderBy('sequence', 'asc')
          .get();

        const filtered = assemblePathOnServer(dedupTasks(allResult.data), params);
        return { code: 0, data: filtered.tasks, phases: filtered.phases, summary: filtered.summary };

      case 'bySceneTags':
        // params: { tags: ["银行","住房"] }
        const tagResult = await collection
          .where({ scene_tags: _.in(params.tags), status: 'active' })
          .orderBy('phase', 'asc')
          .orderBy('sequence', 'asc')
          .get();
        const tagData = dedupTasks(tagResult.data);
        return { code: 0, data: tagData, total: tagData.length };

      case 'search':
        // params: { keyword: "银行" }
        // Search in title and ai_context.search_keywords
        const keyword = params.keyword || '';
        const searchResult = await collection
          .where(_.and([
            { status: 'active' },
            _.or([
              { title: db.RegExp({ regexp: keyword, options: 'i' }) },
              { 'ai_context.search_keywords': _.in([keyword]) }
            ])
          ]))
          .orderBy('phase', 'asc')
          .get();
        return { code: 0, data: searchResult.data, total: searchResult.data.length };

      case 'byUrgency':
        const urgResult = await collection
          .where({ urgency: '必修', status: 'active' })
          .orderBy('phase', 'asc')
          .orderBy('sequence', 'asc')
          .get();
        return { code: 0, data: urgResult.data, total: urgResult.data.length };

      case 'all':
        const all = await collection
          .where({ status: 'active' })
          .orderBy('phase', 'asc')
          .orderBy('sequence', 'asc')
          .get();
        const allData = dedupTasks(all.data);
        return { code: 0, data: allData, total: allData.length };

      default:
        return { code: 400, error: `Unknown mode: ${mode}` };
    }
  } catch (err) {
    console.error('queryLifeGuideTasks error:', err);
    return { code: 500, error: err.message };
  }
};
