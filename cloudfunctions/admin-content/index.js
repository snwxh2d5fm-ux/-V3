// 住港伴 V4 — admin-content: 内容运营
const cloudbase = require('@cloudbase/node-sdk');
const auth = require('../_shared/auth');
const audit = require('../_shared/audit'); // P0-08
const app = cloudbase.init({ env: 'cloudbase-d1g17tgt7cc199a60' });
const db = app.database();

exports.main = async (event) => {
  // P0-08: extract client IP before body parsing
  const clientIp = event.headers?.['x-forwarded-for']?.split(',')[0]?.trim()
    || event.headers?.['x-real-ip']
    || event.httpHeaders?.['x-forwarded-for']?.split(',')[0]?.trim()
    || '';
  let body = event;
  if (event.body && typeof event.body === 'string') {
    try {
      body = JSON.parse(event.body);
    } catch (_) {}
  }
  const { action, params = {}, _apiKey } = body;
  if (!_apiKey) return { code: 401, msg: '缺少 API Key' };
  const adm = await db
    .collection('admin_users')
    .where({ apiKeyHash: auth.sha256(_apiKey), status: 'active' })
    .limit(1)
    .get();
  if (!adm.data.length) return { code: 401, msg: '无效 API Key' };
  const lock = auth.checkLockout(adm.data[0]);
  if (lock.locked) return { code: 429, msg: lock.reason };
  // P0-08 IP白名单
  const ipCheck = auth.checkIPWhitelist(clientIp);
  if (!ipCheck.allowed) {
    console.warn('[IP白名单] admin-content 拒绝:', clientIp, ipCheck.reason);
    return { code: 403, msg: 'IP 不在白名单中' };
  }
  adm.data[0]._clientIp = clientIp;

  try {
    switch (action) {
      case 'getArticleRanking':
        return articleRanking();
      case 'getTaskCompletion':
        return taskCompletion();
      case 'getSearchHotwords':
        return searchHotwords();
      case 'editArticle': // P0-08
        return await editArticle(params, adm.data[0]);
      case 'deleteArticle': // P0-08
        return await deleteArticle(params, adm.data[0]);
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

// P0-08: content edit/delete with audit
async function editArticle(p, admin) {
  const { articleId, updates } = p;
  if (!articleId || !updates) return { code: 400, msg: '缺少 articleId 或 updates' };
  await db.collection('guidebook_articles').doc(articleId).update({
    ...updates,
    updatedBy: admin.email,
    updatedAt: new Date(),
  });
  await audit.logAudit({
    admin: { email: admin.email, role: admin.role || 'unknown' },
    event: audit.AUDIT_EVENTS.CRUD,
    targetType: 'guidebook_articles',
    targetId: articleId,
    detail: { action: 'editArticle', fields: Object.keys(updates) },
    ip: admin._clientIp || '',
  }).catch((e) => console.error('[audit]', e));
  return { code: 0, msg: 'ok' };
}

async function deleteArticle(p, admin) {
  const { articleId } = p;
  if (!articleId) return { code: 400, msg: '缺少 articleId' };
  await db.collection('guidebook_articles').doc(articleId).remove();
  await audit.logAudit({
    admin: { email: admin.email, role: admin.role || 'unknown' },
    event: audit.AUDIT_EVENTS.CRUD,
    targetType: 'guidebook_articles',
    targetId: articleId,
    detail: { action: 'deleteArticle' },
    ip: admin._clientIp || '',
  }).catch((e) => console.error('[audit]', e));
  return { code: 0, msg: 'ok' };
}
