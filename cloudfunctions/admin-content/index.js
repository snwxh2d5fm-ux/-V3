// 住港伴 V4 — admin-content: 内容运营
const cloudbase = require('@cloudbase/node-sdk');
const crypto = require('crypto');
const app = cloudbase.init({ env: 'cloudbase-d1g17tgt7cc199a60' });
const db = app.database();
function sha256(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

exports.main = async (event) => {
  let body = event;
  if (event.body && typeof event.body === 'string') {
    try {
      body = JSON.parse(event.body);
    } catch (_) {}
  }
  const { action, params = {}, _apiKey } = body;
  if (!_apiKey) return { code: 401, msg: '缺少 API Key' };
  if (
    !(
      await db
        .collection('admin_users')
        .where({ apiKeyHash: sha256(_apiKey), status: 'active' })
        .limit(1)
        .get()
    ).data.length
  )
    return { code: 401, msg: '无效 API Key' };

  try {
    switch (action) {
      case 'getArticleRanking':
        return articleRanking();
      case 'getTaskCompletion':
        return taskCompletion();
      case 'getSearchHotwords':
        return searchHotwords();
      default:
        return { code: 400, msg: '无效操作: ' + action };
    }
  } catch (err) {
    return { code: 500, msg: err.message };
  }
};

async function articleRanking() {
  const articles = await db.collection('guidebook_articles').limit(20).get();
  return {
    code: 0,
    data: (articles.data || []).map((a) => ({ title: a.title, category: a.category, createdAt: a.createdAt })),
  };
}

async function taskCompletion() {
  const tasks = await db.collection('life_guide_tasks').limit(100).get();
  const byCat = {};
  (tasks.data || []).forEach((t) => {
    const c = t.category || 'other';
    if (!byCat[c]) byCat[c] = { total: 0, completed: 0 };
    byCat[c].total++;
    if (t.completed) byCat[c].completed++;
  });
  return { code: 0, data: { tasks: tasks.data.length, byCategory: byCat } };
}

async function searchHotwords() {
  const logs = await db.collection('conversation_logs').orderBy('timestamp', 'desc').limit(200).get();
  const words = {};
  (logs.data || []).forEach((l) => {
    const q = (l.query || '').slice(0, 30);
    if (q) words[q] = (words[q] || 0) + 1;
  });
  const top = Object.entries(words)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([w, c]) => ({ word: w, count: c }));
  return { code: 0, data: top };
}
