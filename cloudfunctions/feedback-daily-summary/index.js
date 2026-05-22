/**
 * feedback-daily-summary — 每日反馈+开票汇总云函数
 *
 * 定时触发：每日 00:10 (Asia/Hong_Kong)
 * 功能：
 *   1. 汇总过去24小时的反馈工单（feedback 集合）
 *   2. 汇总过去24小时的开票记录（invoices 集合）
 *   3. 生成结构化日报，存入 daily_reports 集合
 *   4. 通过邮件发送至 gangban@funway.hk
 *
 * 复用：开票数据结构来自 payment/invoices.js（orderAmountYuan, title, invoiceType, status）
 *      反馈数据结构来自 feedback-submit/index.js（ticketId, type, content, status）
 *
 * 环境变量（CloudBase 控制台 → 云函数 → 环境变量）:
 *   REPORT_EMAIL        = gangban@funway.hk     （收件邮箱，默认值）
 *   EMAIL_API_URL       = 邮件发送 API 地址       （如 Resend / SendGrid / 自定义 SMTP 网关）
 *   EMAIL_API_KEY       = 邮件 API Key
 *   EMAIL_FROM          = 发件人地址
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// ============ 配置 ============
const REPORT_EMAIL = process.env.REPORT_EMAIL || 'gangban@funway.hk';
const EMAIL_API_URL = process.env.EMAIL_API_URL || '';
const EMAIL_API_KEY = process.env.EMAIL_API_KEY || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@funway.hk';

// ============ 主入口 ============
exports.main = async (event, context) => {
  const action = (event && event.action) || 'dailySummary';

  try {
    switch (action) {
      case 'dailySummary':
        return await dailySummary();
      case 'manualTrigger':
        return await dailySummary(); // 手动触发，行为一致
      case 'getReport':
        return await getReport(event);
      case 'listReports':
        return await listReports(event);
      default:
        return await dailySummary();
    }
  } catch (err) {
    console.error('[feedback-daily-summary]', err);
    return { code: 500, msg: '汇总服务异常', error: err.message };
  }
};

// ============ 每日汇总 ============
async function dailySummary() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10); // "2026-05-19"
  const yesterday = new Date(now.getTime() - 86400000);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const reportDate = yesterdayStr; // 报告的是昨天的数据
  const rangeStart = new Date(yesterdayStr + 'T00:00:00.000+08:00').getTime();
  const rangeEnd = new Date(yesterdayStr + 'T23:59:59.999+08:00').getTime();

  console.debug(
    '[daily-summary] 生成报告:',
    reportDate,
    'range:',
    new Date(rangeStart).toISOString(),
    '~',
    new Date(rangeEnd).toISOString(),
  );

  // 并行查询 feedback + invoices
  const [feedbackData, invoiceData] = await Promise.all([
    queryFeedback(rangeStart, rangeEnd),
    queryInvoices(rangeStart, rangeEnd),
  ]);

  // 构建报告
  const report = buildReport(reportDate, feedbackData, invoiceData);

  // 存入 daily_reports 集合
  let reportId = null;
  try {
    const addResult = await db.collection('daily_reports').add({
      data: {
        reportDate: reportDate,
        type: 'feedback_invoice_daily',
        generatedAt: db.serverDate(),
        sentTo: REPORT_EMAIL,
        sentStatus: 'pending',
        summary: report,
        createdAt: db.serverDate(),
      },
    });
    reportId = addResult._id;
    console.debug('[daily-summary] 报告已存储:', reportId);
  } catch (dbErr) {
    console.error('[daily-summary] 存储失败:', dbErr);
    return { code: 500, msg: '报告存储失败', error: dbErr.message };
  }

  // 发送邮件
  let emailResult = null;
  try {
    emailResult = await sendEmail(reportDate, report, reportId);
    await db
      .collection('daily_reports')
      .doc(reportId)
      .update({
        data: { sentStatus: 'sent', sentAt: db.serverDate(), emailResult: emailResult },
      });
  } catch (emailErr) {
    console.error('[daily-summary] 邮件发送失败:', emailErr.message);
    await db
      .collection('daily_reports')
      .doc(reportId)
      .update({
        data: { sentStatus: 'failed', failReason: emailErr.message },
      });
  }

  // ★ 复用祖脉模式: 同时写入 audit_logs 供运营追溯
  try {
    await db.collection('audit_logs').add({
      data: {
        action: 'daily_summary_generated',
        detail: {
          reportId: reportId,
          reportDate: reportDate,
          feedbackCount: feedbackData.items.length,
          invoiceCount: invoiceData.items.length,
          sentStatus: emailResult ? 'sent' : 'failed',
        },
        createdAt: db.serverDate(),
      },
    });
  } catch (auditErr) {
    /* 审计日志降级 */
  }

  return {
    code: 0,
    msg: 'ok',
    data: {
      reportId: reportId,
      reportDate: reportDate,
      feedbackCount: feedbackData.items.length,
      invoiceCount: invoiceData.items.length,
      sentStatus: emailResult ? 'sent' : 'failed',
    },
  };
}

// ============ 查询反馈（过去24h） ============
async function queryFeedback(rangeStart, rangeEnd) {
  try {
    const result = await db
      .collection('feedback')
      .where({
        createdAt: _.gte(rangeStart).and(_.lte(rangeEnd)),
      })
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get();

    const items = result.data.map((fb) => ({
      ticketId: fb.ticketId,
      type: fb.type, // bug / content / other
      content: truncate(fb.content, 80), // 截断80字
      status: fb.status,
      isAnonymous: !!fb.isAnonymous,
      hasScreenshot: !!fb.screenshot,
      createdAt: fb.createdAt,
    }));

    const byType = { bug: 0, content: 0, other: 0 };
    const byStatus = { submitted: 0, in_progress: 0, replied: 0, closed: 0 };
    items.forEach((item) => {
      if (byType[item.type] !== undefined) byType[item.type]++;
      if (byStatus[item.status] !== undefined) byStatus[item.status]++;
    });

    return { total: items.length, byType, byStatus, items };
  } catch (err) {
    console.error('[daily-summary] 查询feedback失败:', err);
    return { total: 0, byType: { bug: 0, content: 0, other: 0 }, byStatus: {}, items: [] };
  }
}

// ============ 查询开票记录（过去24h） ============
// ★ 复用祖脉 payment/invoices.js 的数据结构
async function queryInvoices(rangeStart, rangeEnd) {
  try {
    const result = await db
      .collection('invoices')
      .where({
        createdAt: _.gte(rangeStart).and(_.lte(rangeEnd)),
      })
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get();

    const items = result.data.map((inv) => ({
      invoiceId: inv._id,
      orderId: inv.orderId,
      productName: inv.productName,
      orderAmountYuan: inv.orderAmountYuan, // ★ 复用祖脉字段
      invoiceType: inv.invoiceType, // personal | company
      title: inv.title, // 发票抬头
      taxNumber: inv.taxNumber || '',
      email: maskEmail(inv.email), // 脱敏邮箱
      status: inv.status, // pending | issued | rejected
      createdAt: inv.createdAt,
    }));

    const byStatus = { pending: 0, issued: 0, rejected: 0 };
    let totalAmount = 0;
    items.forEach((item) => {
      if (byStatus[item.status] !== undefined) byStatus[item.status]++;
      totalAmount += parseFloat(item.orderAmountYuan) || 0;
    });

    return {
      total: items.length,
      byStatus,
      totalAmountYuan: totalAmount.toFixed(2),
      items,
    };
  } catch (err) {
    console.error('[daily-summary] 查询invoices失败:', err);
    return { total: 0, byStatus: {}, totalAmountYuan: '0.00', items: [] };
  }
}

// ============ 构建报告 ============
function buildReport(reportDate, feedbackData, invoiceData) {
  return {
    reportDate: reportDate,
    generatedAt: new Date().toISOString(),

    // 反馈工单
    feedback: {
      total: feedbackData.total,
      byType: feedbackData.byType,
      byStatus: feedbackData.byStatus,
      items: feedbackData.items,
    },

    // 开票记录
    invoices: {
      total: invoiceData.total,
      byStatus: invoiceData.byStatus,
      totalAmountYuan: invoiceData.totalAmountYuan,
      items: invoiceData.items,
    },

    // 总计
    totals: {
      feedbackCount: feedbackData.total,
      invoiceCount: invoiceData.total,
      invoiceAmountYuan: invoiceData.totalAmountYuan,
    },
  };
}

// ============ 邮件发送 ============
async function sendEmail(reportDate, report, reportId) {
  const subject = `【住港伴日报】${reportDate} 反馈+开票汇总`;
  const htmlBody = buildEmailHtml(reportDate, report, reportId);

  // 未配置邮件服务 → 仅存储，不发送
  if (!EMAIL_API_URL || !EMAIL_API_KEY) {
    console.debug('[daily-summary] 未配置 EMAIL_API_URL，跳过邮件发送。报告ID:', reportId);
    return { method: 'none', note: 'EMAIL_API_URL not configured, report stored only' };
  }

  // 通过 HTTP API 发送邮件（支持 Resend / SendGrid / 自定义 SMTP 网关）
  const https = require('https');
  const http = require('http');
  const urlModule = require('url');

  const parsedUrl = urlModule.parse(EMAIL_API_URL);
  const transport = parsedUrl.protocol === 'https:' ? https : http;

  const postData = JSON.stringify({
    from: EMAIL_FROM,
    to: REPORT_EMAIL,
    subject: subject,
    html: htmlBody,
  });

  // ★ 通用邮件 API 格式（兼容 Resend / 自定义网关）
  // 如需 SendGrid 格式，请调整 EMAIL_API_URL 和请求体
  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
    path: parsedUrl.path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + EMAIL_API_KEY,
      'Content-Length': Buffer.byteLength(postData),
    },
    timeout: 15000,
  };

  return new Promise((resolve, reject) => {
    const req = transport.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.debug('[daily-summary] 邮件发送成功:', res.statusCode);
          resolve({ method: 'api', statusCode: res.statusCode });
        } else {
          reject(new Error('邮件API返回: ' + res.statusCode + ' ' + body.substring(0, 200)));
        }
      });
    });
    req.on('error', (e) => reject(new Error('邮件请求失败: ' + e.message)));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('邮件请求超时'));
    });
    req.write(postData);
    req.end();
  });
}

// ============ 邮件 HTML 模板 ============
function buildEmailHtml(reportDate, report, reportId) {
  const f = report.feedback;
  const inv = report.invoices;

  // ★ 复用祖脉开票字段：invoiceType → 个人/企业，title → 抬头
  const invoiceRows = inv.items
    .map(function (item, i) {
      const typeLabel = item.invoiceType === 'company' ? '🏢 企业' : '🧑 个人';
      const statusLabel = { pending: '⏳处理中', issued: '✅已开具', rejected: '❌已退回' }[item.status] || item.status;
      return (
        '<tr>' +
        '<td>' +
        (i + 1) +
        '</td>' +
        '<td>' +
        escapeHtml(item.orderId || '').substring(0, 12) +
        '</td>' +
        '<td>' +
        escapeHtml(item.productName || '') +
        '</td>' +
        '<td>' +
        escapeHtml(item.title || '') +
        '</td>' +
        '<td>' +
        typeLabel +
        '</td>' +
        '<td>¥' +
        (item.orderAmountYuan || '0.00') +
        '</td>' +
        '<td>' +
        statusLabel +
        '</td>' +
        '<td>' +
        escapeHtml(item.email || '') +
        '</td>' +
        '</tr>'
      );
    })
    .join('');

  const feedbackRows = f.items
    .map(function (item, i) {
      const typeLabel = { bug: '🐛功能异常', content: '📝内容错误', other: '💬其他' }[item.type] || item.type;
      const statusLabel =
        { submitted: '已提交', in_progress: '处理中', replied: '已回复', closed: '已关闭' }[item.status] || item.status;
      return (
        '<tr>' +
        '<td>' +
        (i + 1) +
        '</td>' +
        '<td>' +
        escapeHtml(item.ticketId || '') +
        '</td>' +
        '<td>' +
        typeLabel +
        '</td>' +
        '<td>' +
        escapeHtml(item.content || '') +
        '</td>' +
        '<td>' +
        statusLabel +
        '</td>' +
        '<td>' +
        (item.isAnonymous ? '是' : '否') +
        '</td>' +
        '<td>' +
        (item.hasScreenshot ? '📎有' : '-') +
        '</td>' +
        '</tr>'
      );
    })
    .join('');

  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f5f5f5;padding:20px}' +
    '.container{max-width:700px;margin:0 auto;background:#fff;border-radius:12px;padding:32px}' +
    'h1{font-size:20px;color:#1a1a1a;margin:0 0 4px}h2{font-size:16px;color:#1a73e8;margin:24px 0 12px;border-bottom:2px solid #1a73e8;padding-bottom:4px}' +
    '.date{font-size:14px;color:#888;margin:0 0 24px}.stat-row{display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap}' +
    '.stat-box{flex:1;min-width:100px;background:#f0f4ff;border-radius:8px;padding:12px;text-align:center}' +
    '.stat-num{font-size:24px;font-weight:700;color:#1a73e8}.stat-label{font-size:12px;color:#666;margin-top:4px}' +
    'table{width:100%;border-collapse:collapse;font-size:13px;margin:8px 0 20px}th{background:#f8f9fa;padding:8px 6px;text-align:left;font-weight:600;border-bottom:2px solid #e0e0e0}' +
    'td{padding:8px 6px;border-bottom:1px solid #eee;vertical-align:top}' +
    '.footer{margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#aaa}' +
    '.highlight{color:#e37400;font-weight:600}' +
    '</style></head><body><div class="container">' +
    '<h1>住港伴 · 每日运营日报</h1>' +
    '<p class="date">报告日期：' +
    reportDate +
    ' | 报告ID：' +
    (reportId || '-') +
    '</p>' +
    // ★ 总览
    '<h2>📊 总览</h2>' +
    '<div class="stat-row">' +
    '<div class="stat-box"><div class="stat-num">' +
    f.total +
    '</div><div class="stat-label">反馈工单</div></div>' +
    '<div class="stat-box"><div class="stat-num">' +
    inv.total +
    '</div><div class="stat-label">开票申请</div></div>' +
    '<div class="stat-box"><div class="stat-num">¥' +
    (inv.totalAmountYuan || '0.00') +
    '</div><div class="stat-label">开票金额</div></div>' +
    '</div>' +
    // ★ 反馈工单
    '<h2>💬 反馈工单 (' +
    f.total +
    '条)</h2>' +
    (f.total > 0
      ? '<table><thead><tr><th>#</th><th>工单号</th><th>类型</th><th>内容</th><th>状态</th><th>匿名</th><th>附件</th></tr></thead><tbody>' +
        feedbackRows +
        '</tbody></table>'
      : '<p style="color:#999">今日无反馈工单</p>') +
    // 反馈分布
    (f.total > 0
      ? '<div class="stat-row">' +
        '<div class="stat-box"><div class="stat-num">' +
        (f.byType.bug || 0) +
        '</div><div class="stat-label">🐛 功能异常</div></div>' +
        '<div class="stat-box"><div class="stat-num">' +
        (f.byType.content || 0) +
        '</div><div class="stat-label">📝 内容错误</div></div>' +
        '<div class="stat-box"><div class="stat-num">' +
        (f.byType.other || 0) +
        '</div><div class="stat-label">💬 其他</div></div>' +
        '<div class="stat-row">' +
        '<div class="stat-box"><div class="stat-num">' +
        (f.byStatus.submitted || 0) +
        '</div><div class="stat-label">待处理</div></div>' +
        '<div class="stat-box"><div class="stat-num">' +
        (f.byStatus.in_progress || 0) +
        '</div><div class="stat-label">处理中</div></div>' +
        '<div class="stat-box"><div class="stat-num">' +
        (f.byStatus.replied || 0) +
        '</div><div class="stat-label">已回复</div></div>' +
        '</div>'
      : '') +
    // ★ 开票记录
    '<h2>🧾 开票记录 (' +
    inv.total +
    '条)</h2>' +
    (inv.total > 0
      ? '<table><thead><tr><th>#</th><th>订单号</th><th>商品</th><th>抬头</th><th>类型</th><th>金额</th><th>状态</th><th>邮箱</th></tr></thead><tbody>' +
        invoiceRows +
        '</tbody></table>'
      : '<p style="color:#999">今日无开票申请</p>') +
    '<div class="stat-row">' +
    '<div class="stat-box"><div class="stat-num">' +
    (inv.byStatus.pending || 0) +
    '</div><div class="stat-label">⏳ 待处理</div></div>' +
    '<div class="stat-box"><div class="stat-num">' +
    (inv.byStatus.issued || 0) +
    '</div><div class="stat-label">✅ 已开具</div></div>' +
    '<div class="stat-box"><div class="stat-num">' +
    (inv.byStatus.rejected || 0) +
    '</div><div class="stat-label">❌ 已退回</div></div>' +
    '</div>' +
    '<div class="footer">' +
    '<p>此邮件由住港伴运营系统自动生成，每日 00:10 (HKT) 发送。</p>' +
    '<p>如需修改收件人或停用日报，请联系运维团队。</p>' +
    '<p>报告ID: ' +
    (reportId || '-') +
    '</p>' +
    '</div>' +
    '</div></body></html>'
  );
}

// ============ 查询历史报告 ============
async function getReport(event) {
  const reportId = event.reportId;
  const reportDate = event.reportDate;

  const query = { type: 'feedback_invoice_daily' };
  if (reportId) {
    try {
      var result = await db.collection('daily_reports').doc(reportId).get();
      if (!result.data || result.data.length === 0) return { code: 404, msg: '报告不存在' };
      return { code: 0, data: result.data[0] || result.data };
    } catch (e) {
      return { code: 404, msg: '报告不存在' };
    }
  }
  if (reportDate) {
    var result = await db
      .collection('daily_reports')
      .where({ reportDate: reportDate, type: 'feedback_invoice_daily' })
      .orderBy('generatedAt', 'desc')
      .limit(1)
      .get();
    if (result.data.length === 0) return { code: 404, msg: '该日期无报告' };
    return { code: 0, data: result.data[0] };
  }
  return { code: 400, msg: '需要 reportId 或 reportDate' };
}

async function listReports(event) {
  const limit = Math.min(event.limit || 30, 90);
  const skip = event.skip || 0;
  const result = await db
    .collection('daily_reports')
    .where({ type: 'feedback_invoice_daily' })
    .orderBy('reportDate', 'desc')
    .skip(skip)
    .limit(limit)
    .get();
  return {
    code: 0,
    data: result.data.map(function (r) {
      return {
        reportId: r._id,
        reportDate: r.reportDate,
        sentStatus: r.sentStatus,
        sentTo: r.sentTo,
        generatedAt: r.generatedAt,
        feedbackCount: (r.summary && r.summary.totals && r.summary.totals.feedbackCount) || 0,
        invoiceCount: (r.summary && r.summary.totals && r.summary.totals.invoiceCount) || 0,
      };
    }),
  };
}

// ============ 工具函数 ============
function truncate(text, maxLen) {
  if (!text) return '';
  return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
}

function maskEmail(email) {
  if (!email || email.indexOf('@') === -1) return email;
  const parts = email.split('@');
  const name = parts[0];
  const domain = parts[1];
  if (name.length <= 3) return name[0] + '***@' + domain;
  return name.substring(0, 2) + '***@' + domain;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
