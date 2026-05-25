/**
 * feedback-submit v1.0 — 意见反馈云函数
 * V1范围：submit / list / detail / append 四个action
 * 安全：PII脱敏入库 + wxContext鉴权 + 数据隔离
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 内容安全审核（复用 content-moderation 云函数）
async function moderateText(text) {
  if (!text || typeof text !== 'string') return { pass: true };
  try {
    const result = await cloud.callFunction({
      name: 'content-moderation',
      data: { action: 'moderateText', content: text },
    });
    if (result && result.result && result.result.code === 0) {
      const resData = result.result.data || {};
      // 降级场景：TMS不可用时按 fail-closed 拒绝
      if (resData.degraded) {
        console.warn('[feedback-submit] 审核服务降级，拒绝提交');
        return { pass: false, reason: '内容安全服务暂不可用，请稍后重试' };
      }
      // 检查审核结果：仅 Pass 放行，Block/Review 均拦截
      if (resData.suggestion === 'Pass') {
        return { pass: true };
      }
      return { pass: false, reason: '内容包含违规信息，请修改后重新提交' };
    }
    // 审核不通过（敏感词命中）返回拦截原因
    return { pass: false, reason: (result && result.result && result.result.msg) || '内容不合规' };
  } catch (e) {
    // 审核服务异常时，安全侧兜底：拒绝提交（不能降级通过）
    console.error('[feedback-submit] 内容审核调用失败，拒绝提交:', e.message);
    return { pass: false, reason: '内容安全服务暂不可用，请稍后重试' };
  }
}

// ============ PII 脱敏（云函数端强制，不可绕过） ============
function sanitizePII(text) {
  if (!text || typeof text !== 'string') return text;
  try {
    let s = text;
    // 中国大陆身份证 (18位)
    s = s.replace(/[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]/g, '***');
    // 中国大陆身份证 (15位，旧版)
    s = s.replace(/[1-9]\d{7}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}/g, '***');
    // 香港身份证 (A-Z + 6位数字 + 括号校验码)
    s = s.replace(/[A-Z]{1,2}\d{6}\([\dA-Z]\)/g, '***');
    // 中国大陆手机号
    s = s.replace(/1[3-9]\d{9}/g, '***');
    // 香港手机号 (5/6/9开头，8位)
    s = s.replace(/\b[569]\d{7}\b/g, '***');
    // 邮箱
    s = s.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '***');
    // 护照号 (E + 8位数字，或 G + 8位数字)
    s = s.replace(/\b[EG]\d{8}\b/g, '***');
    return s;
  } catch (e) {
    return text;
  }
}

// ============ 脱敏昵称 ============
function maskNickname(nickname) {
  if (!nickname || typeof nickname !== 'string') return '';
  if (nickname.length <= 2) return nickname[0] + '*';
  return nickname[0] + '**' + nickname[nickname.length - 1];
}

// ============ 生成工单号 ============
function generateTicketId() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return 'FB-' + y + m + d + '-' + seq;
}

// ============ 主入口 ============
exports.main = async (event) => {
  const action = event.action;
  try {
    switch (action) {
      case 'submit':
        return await submit(event);
      case 'list':
        return await list(event);
      case 'detail':
        return await detail(event);
      case 'append':
        return await append(event);
      default:
        return { code: 400, msg: '不支持的操作: ' + action + '，支持: submit/list/detail/append' };
    }
  } catch (err) {
    console.error('[feedback-submit]', err);
    return { code: 500, msg: '服务异常: ' + err.message };
  }
};

// ============ 1. 提交反馈 ============
async function submit(event) {
  const content = (event.content || '').trim();
  const type = event.type; // bug / content / other
  const isAnonymous = !!event.isAnonymous;
  const screenshot = event.screenshot || ''; // cloud fileID
  const contact = event.contact || {};

  // 校验
  if (!content) return { code: 400, msg: '反馈内容不能为空' };
  if (content.length < 10) return { code: 400, msg: '反馈内容至少10个字' };
  if (content.length > 500) return { code: 400, msg: '反馈内容不能超过500字' };
  const validTypes = ['bug', 'content', 'other'];
  if (validTypes.indexOf(type) === -1) return { code: 400, msg: '请选择反馈类型: bug/content/other' };

  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  // 匿名模式不写userId
  const userId = isAnonymous ? null : openid || null;

  // PII 脱敏
  const sanitizedContent = sanitizePII(content);

  // 内容安全审核（准入控制，审核不通过拦截提交）
  const modResult = await moderateText(sanitizedContent);
  if (!modResult.pass) {
    return { code: 400, msg: modResult.reason || '内容不合规，请修改后重新提交' };
  }

  // 脱敏昵称
  let nickname = '';
  if (!isAnonymous && contact.nickname) {
    nickname = maskNickname(contact.nickname);
  }

  const ticketId = generateTicketId();
  const now = Date.now();

  const record = {
    ticketId: ticketId,
    userId: userId,
    isAnonymous: isAnonymous,
    type: type,
    content: sanitizedContent,
    screenshot: screenshot,
    contact: { nickname: nickname },
    status: 'submitted',
    createdAt: now,
    updatedAt: now,
  };

  try {
    await db.collection('feedback').add({ data: record });
    return {
      code: 0,
      data: {
        ticketId: ticketId,
        status: 'submitted',
        createdAt: now,
      },
    };
  } catch (dbErr) {
    console.error('[feedback-submit] 写入失败:', dbErr);
    return { code: 500, msg: '提交失败，请重试' };
  }
}

// ============ 2. 查询反馈列表 ============
async function list(event) {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) return { code: 403, msg: '请先登录' };

  const status = event.status || ''; // '' = 全部, 'submitted'/'in_progress'/'replied'/'closed'
  const limit = Math.min(event.limit || 20, 50);
  const skip = event.skip || 0;

  const where = { userId: openid };
  if (status) {
    // "处理中"Tab 需同时匹配 submitted + in_progress
    if (status === 'submitted') {
      where.status = _.in(['submitted', 'in_progress']);
    } else {
      where.status = status;
    }
  }

  try {
    const result = await db
      .collection('feedback')
      .where(where)
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(limit)
      .get();

    // 为每条反馈附上最新一条回复
    const items = [];
    for (let i = 0; i < result.data.length; i++) {
      const fb = result.data[i];
      const item = {
        ticketId: fb.ticketId,
        type: fb.type,
        content: fb.content,
        status: fb.status,
        createdAt: fb.createdAt,
        updatedAt: fb.updatedAt,
        hasScreenshot: !!fb.screenshot,
        latestReply: null,
      };
      // 查询最新回复
      try {
        const replyResult = await db
          .collection('feedback_reply')
          .where({ ticketId: fb.ticketId })
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get();
        if (replyResult.data.length > 0) {
          item.latestReply = {
            content: replyResult.data[0].content,
            role: replyResult.data[0].role,
            createdAt: replyResult.data[0].createdAt,
          };
        }
      } catch (e) {
        /* 忽略查询失败 */
      }
      items.push(item);
    }

    // 精确 hasMore: 用 count() 而非 items.length >= limit
    let totalCount = 0;
    try {
      const countResult = await db.collection('feedback').where(where).count();
      totalCount = countResult.total;
    } catch (e) {
      /* count 失败降级 */
    }
    const realTotal = totalCount || items.length;
    return { code: 0, data: { items: items, total: realTotal, hasMore: skip + items.length < realTotal } };
  } catch (dbErr) {
    console.error('[feedback-submit] 查询失败:', dbErr);
    return { code: 500, msg: '查询失败' };
  }
}

// ============ 3. 查询反馈详情（含回复） ============
async function detail(event) {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) return { code: 403, msg: '请先登录' };

  const ticketId = event.ticketId;
  if (!ticketId) return { code: 400, msg: '缺少工单号' };

  try {
    const fbResult = await db.collection('feedback').where({ ticketId: ticketId, userId: openid }).get();

    if (fbResult.data.length === 0) {
      return { code: 404, msg: '工单不存在或无权查看' };
    }

    const fb = fbResult.data[0];

    // 查询回复列表
    let replies = [];
    try {
      const replyResult = await db
        .collection('feedback_reply')
        .where({ ticketId: ticketId })
        .orderBy('createdAt', 'asc')
        .get();
      replies = replyResult.data.map(function (r) {
        return {
          replyId: r._id,
          role: r.role,
          content: r.content,
          createdAt: r.createdAt,
        };
      });
    } catch (e) {
      /* 忽略 */
    }

    return {
      code: 0,
      data: {
        ticketId: fb.ticketId,
        type: fb.type,
        content: fb.content,
        screenshot: fb.screenshot,
        status: fb.status,
        isAnonymous: fb.isAnonymous,
        createdAt: fb.createdAt,
        updatedAt: fb.updatedAt,
        replies: replies,
      },
    };
  } catch (dbErr) {
    console.error('[feedback-submit] 详情查询失败:', dbErr);
    return { code: 500, msg: '查询失败' };
  }
}

// ============ 4. 用户追加补充说明 ============
async function append(event) {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) return { code: 403, msg: '请先登录' };

  const ticketId = event.ticketId;
  const content = (event.content || '').trim();

  if (!ticketId) return { code: 400, msg: '缺少工单号' };
  if (!content) return { code: 400, msg: '补充内容不能为空' };
  if (content.length > 500) return { code: 400, msg: '补充内容不能超过500字' };

  // 校验反馈属于当前用户
  try {
    const fbResult = await db.collection('feedback').where({ ticketId: ticketId, userId: openid }).get();

    if (fbResult.data.length === 0) {
      return { code: 404, msg: '工单不存在或无权操作' };
    }

    const fb = fbResult.data[0];

    // 已关闭的反馈不允许追加
    if (fb.status === 'closed') {
      return { code: 400, msg: '该反馈已关闭，无法追加说明' };
    }

    // PII 脱敏
    const sanitizedContent = sanitizePII(content);

    // 内容安全审核
    const modResult = await moderateText(sanitizedContent);
    if (!modResult.pass) {
      return { code: 400, msg: modResult.reason || '内容不合规，请修改后重新提交' };
    }

    const now = Date.now();

    await db.collection('feedback_reply').add({
      data: {
        ticketId: ticketId,
        role: 'user',
        content: sanitizedContent,
        createdAt: now,
      },
    });

    // 更新反馈时间戳
    await db
      .collection('feedback')
      .where({ ticketId: ticketId })
      .update({ data: { updatedAt: now } });

    return { code: 0, data: { createdAt: now } };
  } catch (dbErr) {
    console.error('[feedback-submit] 追加失败:', dbErr);
    return { code: 500, msg: '追加失败' };
  }
}
