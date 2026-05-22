const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const LANDING_PAGE_MAP = {
  guide_collection: '/pages/guidebooks/guidebooks-detail',
  doc_template: '/pages/doc-templates/detail',
  policy_update: '/pages/policy/detail',
};

exports.main = async (event) => {
  try {
    const { action } = event;

    switch (action) {
      case 'resolve':
        return await handleResolve(event);
      case 'revoke':
        return await handleRevoke(event);
      default:
        return { code: 400, msg: '未知操作' };
    }
  } catch (err) {
    console.error('[share-resolve]', err);
    return { code: 500, msg: '服务异常' };
  }
};

async function handleResolve(event) {
  const { shareId } = event;

  if (!shareId) {
    return { code: 400, msg: '缺少分享标识' };
  }

  // Query active share record
  const result = await db
    .collection('share_records')
    .where({
      shareId: shareId,
      status: 'active',
    })
    .get();

  if (result.data.length === 0) {
    return { code: 404, msg: '内容已失效或不存在' };
  }

  const record = result.data[0];

  // Check if expired
  const now = new Date();
  const expiresAt = new Date(record.expiresAt);
  if (now > expiresAt) {
    await db
      .collection('share_records')
      .where({
        shareId: shareId,
      })
      .update({
        data: {
          status: 'expired',
        },
      });
    return { code: 404, msg: '内容已过期' };
  }

  // Compute landing page
  const landingPage = LANDING_PAGE_MAP[record.contentType] || '/pages/index/index';

  // Return content info only — no sharer personal info
  return {
    code: 0,
    data: {
      contentType: record.contentType,
      contentId: record.contentId,
      contentDigest: record.contentDigest,
      landingPage: landingPage,
    },
  };
}

async function handleRevoke(event) {
  const { shareId } = event;

  if (!shareId) {
    return { code: 400, msg: '缺少分享标识' };
  }

  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  // Query own active share record
  const result = await db
    .collection('share_records')
    .where({
      shareId: shareId,
      userId: openid,
      status: 'active',
    })
    .get();

  if (result.data.length === 0) {
    return { code: 404, msg: '分享记录不存在或无权操作' };
  }

  // Update status to revoked
  await db
    .collection('share_records')
    .where({
      shareId: shareId,
      userId: openid,
    })
    .update({
      data: {
        status: 'revoked',
        revokedAt: db.serverDate(),
      },
    });

  // Write audit log
  await db.collection('audit_logs').add({
    data: {
      _openid: openid,
      action: 'share_content_revoked',
      detail: {
        shareId: shareId,
      },
      createdAt: db.serverDate(),
    },
  });

  return {
    code: 0,
    msg: '已撤回',
  };
}
