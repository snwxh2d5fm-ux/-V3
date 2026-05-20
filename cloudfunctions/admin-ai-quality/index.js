// 住港伴 V4 — admin-ai-quality: AI质量监控 (response_preview 绝对禁止返回 — P0-05)
const cloudbase = require('@cloudbase/node-sdk');
const crypto = require('crypto');
const app = cloudbase.init({ env: 'cloudbase-d1g17tgt7cc199a60' });
const db = app.database();
function sha256(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }
function sanitize(s) { return (s||'').replace(/1[3-9]\d{9}/g,'[手机号]').replace(/[A-Z]\d{6,8}/g,'[证件号]').replace(/[\w.-]+@[\w.-]+/g,'[邮箱]'); }

exports.main = async (event) => {
  let body = event; if (event.body && typeof event.body === 'string') { try { body = JSON.parse(event.body); } catch (_) {} }
  const { action, params = {}, _apiKey } = body;
  if (!_apiKey) return { code: 401, msg: '缺少 API Key' };
  const kh = sha256(_apiKey);
  const adm = await db.collection('admin_users').where({ apiKeyHash: kh, status: 'active' }).limit(1).get();
  if (!adm.data.length) return { code: 401, msg: '无效的 API Key' };

  try {
    switch (action) {
      case 'getAIDashboard': return aiDashboard(params);
      case 'getAccuracyTrend': return accuracyTrend(params);
      case 'getTopQueries': return topQueries(params);
      case 'getSafetyEvents': return safetyEvents(params);
      default: return { code: 400, msg: '无效操作: ' + action };
    }
  } catch (err) { return { code: 500, msg: err.message }; }
};

async function aiDashboard(p) {
  const days = p.days || 7;
  const [convCnt, safetyCnt, costSum] = await Promise.all([
    db.collection('conversation_logs').count(),
    db.collection('conversation_logs').where({ 'safety_triggered.0': db.RegExp({ $exists: true }) }).count(),
    db.collection('conversation_logs').get()
  ]);
  let totalCost = 0; let totalTokens = 0;
  (costSum.data||[]).forEach(c => { totalTokens += ((c.tokens||{}).total_tokens||0); });
  // Approx: DeepSeek ~$0.14/1M tokens
  totalCost = Math.round(totalTokens / 1000000 * 0.14 * 100) / 100;
  return { code: 0, data: { conversations: convCnt.total, safetyEvents: safetyCnt.total, estimatedCostRMB: totalCost, totalTokens } };
}

async function accuracyTrend(p) {
  const evals = await db.collection('eval_results').orderBy('createdAt','desc').limit(p.days||30).get();
  const byDay = {};
  (evals.data||[]).forEach(e => {
    const d = (e.createdAt||'').toString().slice(0,10);
    if (!byDay[d]) byDay[d] = { scores: [], count: 0 };
    byDay[d].scores.push(e.score||0);
    byDay[d].count++;
  });
  const trend = Object.entries(byDay).map(([date,v]) => ({ date, avgAccuracy: Math.round(v.scores.reduce((a,b)=>a+b,0)/v.scores.length), count: v.count }));
  return { code: 0, data: trend };
}

async function topQueries(p) {
  const logs = await db.collection('conversation_logs').orderBy('timestamp','desc').limit(100).get();
  const queries = {};
  (logs.data||[]).forEach(l => { const q = sanitize(l.query||'').slice(0,40); if (q) queries[q] = (queries[q]||0)+1; });
  const top = Object.entries(queries).sort((a,b) => b[1]-a[1]).slice(0,20).map(([q,c]) => ({ query: q, count: c }));
  return { code: 0, data: top };
}

async function safetyEvents(p) {
  const logs = await db.collection('conversation_logs').where({ 'safety_triggered.0': db.RegExp({ $exists: true }) }).orderBy('timestamp','desc').limit(50).get();
  return { code: 0, data: (logs.data||[]).map(l => ({ time: l.timestamp, query: sanitize(l.query||'').slice(0,60), triggers: l.safety_triggered })) };
}
