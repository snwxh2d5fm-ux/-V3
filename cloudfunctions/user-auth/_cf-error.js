/**
 * 住港伴 V4 — 云函数错误上报（自包含模块）
 * 每个云函数目录各有一份副本，确保独立部署
 *
 * 用法:
 *   const { reportError } = require('./_cf-error');
 *   try { ... } catch (e) {
 *     reportError({ db, fnName: 'my-fn', action, error: e }).catch(() => {});
 *   }
 */
const https = require('https');

const WECOM_WEBHOOK_URL = process.env.WECOM_WEBHOOK_URL || '';
const WECOM_BOT_ID = process.env.WECOM_BOT_ID || '';
const WECOM_BOT_SECRET = process.env.WECOM_BOT_SECRET || '';
const COLLECTION = 'cf_error_logs';
const COOLDOWN_MS = 60000;

const _cooldown = {};
let _accessToken = null;
let _accessTokenExpire = 0;

function fingerprint(fnName, action, error) {
  const msg = (error && (error.message || String(error))) || 'unknown';
  const short = msg.replace(/\d+/g, 'N').replace(/[^a-zA-Z一-鿿]/g, '').slice(0, 80);
  return `${fnName}:${action || 'main'}:${short}`;
}

function shouldAlert(fp) {
  const now = Date.now();
  if (_cooldown[fp] && now - _cooldown[fp] < COOLDOWN_MS) return false;
  _cooldown[fp] = now;
  return true;
}

function classifySeverity(error) {
  const msg = (error && (error.message || String(error))) || '';
  if (/Cannot find module|MODULE_NOT_FOUND|not configured|ENOTFOUND|ECONNREFUSED/i.test(msg)) return 'critical';
  return 'high';
}

function getWecomToken() {
  const now = Date.now();
  if (_accessToken && now < _accessTokenExpire) return Promise.resolve(_accessToken);
  return new Promise((resolve, reject) => {
    https.get(
      `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${WECOM_BOT_ID}&corpsecret=${WECOM_BOT_SECRET}`,
      (res) => {
        let d = ''; res.on('data', (c) => d += c);
        res.on('end', () => {
          try {
            const j = JSON.parse(d);
            if (j.errcode === 0) { _accessToken = j.access_token; _accessTokenExpire = now + (j.expires_in-300)*1000; resolve(_accessToken); }
            else reject(new Error(j.errmsg));
          } catch (e) { reject(e); }
        });
      }
    ).on('error', reject);
  });
}

async function sendWecomAlert({ fnName, action, errorMsg, errorStack, timestamp, severity }) {
  const hasWebhook = !!WECOM_WEBHOOK_URL;
  const hasBot = !!(WECOM_BOT_ID && WECOM_BOT_SECRET);
  if (!hasWebhook && !hasBot) {
    console.warn('[_cf-error] 未配置企微推送，跳过告警');
    return false;
  }
  const emoji = severity === 'critical' ? '🔴' : '🟠';
  const timeStr = new Date(timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const md =
    `${emoji} **云函数异常告警**\n` +
    `> 函数: <font color="warning">${fnName}</font>\n` +
    `> 操作: <font color="comment">${action || 'main'}</font>\n` +
    `> 时间: <font color="comment">${timeStr}</font>\n` +
    `> 错误: <font color="warning">${errorMsg.slice(0, 200)}</font>\n` +
    (errorStack ? `> 堆栈: \`${errorStack.slice(0, 300)}\`\n` : '');
  
  if (hasWebhook) {
    try {
      const u = new (require('url').URL)(WECOM_WEBHOOK_URL);
      const body = JSON.stringify({ msgtype: 'markdown', markdown: { content: md } });
      const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'POST', headers: { 'Content-Type': 'application/json' }, timeout: 5000 }, (res) => { res.resume(); });
      req.on('error', () => {}); req.write(body); req.end();
    } catch (e) { console.error('[_cf-error] Webhook失败:', e.message); }
    return true;
  }
  
  try {
    const token = await getWecomToken();
    const body = JSON.stringify({ touser: '@all', msgtype: 'markdown', agentid: WECOM_BOT_ID, markdown: { content: md } });
    const req = https.request({ hostname: 'qyapi.weixin.qq.com', path: '/cgi-bin/message/send?access_token=' + token, method: 'POST', headers: { 'Content-Type': 'application/json' }, timeout: 5000 }, (res) => { res.resume(); });
    req.on('error', () => {}); req.write(body); req.end();
  } catch (e) { console.error('[_cf-error] Bot失败:', e.message); }
  return true;
}

async function logToDb(db, { fnName, action, errorMsg, errorStack, severity, context }) {
  try {
    await db.collection(COLLECTION).add({
      data: {
        fnName: fnName || 'unknown',
        action: action || 'main',
        errorMsg: errorMsg.slice(0, 1000),
        errorStack: errorStack ? errorStack.slice(0, 2000) : '',
        severity: severity || 'high',
        context: context || {},
        createdAt: new Date().toISOString(),
        expireAt: new Date(Date.now() + 30 * 86400000).toISOString(),
      },
    });
  } catch (e) {
    console.error('[_cf-error] 写入 cf_error_logs 失败:', e.message);
  }
}

async function reportError({ db, fnName, action, error, context }) {
  const errorMsg = (error && (error.message || String(error))) || 'unknown';
  const errorStack = (error && error.stack) || '';
  const severity = classifySeverity(error);
  const now = Date.now();
  const fp = fingerprint(fnName, action, error);

  // 并行执行 DB 写入和企微告警，互不阻塞
  const tasks = [];
  if (db) {
    tasks.push(logToDb(db, { fnName, action, errorMsg, errorStack, severity, context }).catch(e => {
      console.error(`[_cf-error] DB写入失败: [${fnName}]`, e.message);
    }));
  } else {
    console.error(`[_cf-error] DB不可用: [${fnName}] ${errorMsg}`);
  }

  if (shouldAlert(fp)) {
    tasks.push(sendWecomAlert({ fnName, action, errorMsg, errorStack, timestamp: now, severity }));
  }

  if (tasks.length > 0) {
    await Promise.all(tasks);
  }
}

module.exports = { reportError };
