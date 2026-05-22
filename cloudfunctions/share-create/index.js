const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const L1_CONTENT_TYPES = ['guide_collection', 'doc_template', 'policy_update'];
const SAFE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function generateShortId() {
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += SAFE_CHARS.charAt(Math.floor(Math.random() * SAFE_CHARS.length));
  }
  return result;
}

exports.main = async (event) => {
  try {
    const { action } = event;

    switch (action) {
      case 'create':
        return await handleCreate(event);
      default:
        return { code: 400, msg: '未知操作' };
    }
  } catch (err) {
    console.error('[share-create]', err);
    return { code: 500, msg: '服务异常' };
  }
};

async function handleCreate(event) {
  const { contentType, contentId, contentTitle, contentDigest } = event;

  // Validate contentType
  if (!contentType) {
    return { code: 400, msg: '缺少内容类型' };
  }
  if (L1_CONTENT_TYPES.indexOf(contentType) === -1) {
    return { code: 400, msg: '该内容不支持分享' };
  }

  // Validate contentId
  if (!contentId) {
    return { code: 400, msg: '缺少内容标识' };
  }

  // Validate contentTitle
  if (!contentTitle) {
    return { code: 400, msg: '缺少攻略标题' };
  }
  if (contentTitle.length > 50) {
    return { code: 400, msg: '攻略标题不能超过50个字符' };
  }

  // Get user identity
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  // Generate unique share ID
  const shareId = generateShortId();

  // Write share record
  await db.collection('share_records').add({
    data: {
      shareId: shareId,
      userId: openid,
      contentType: contentType,
      contentId: contentId,
      contentDigest: {
        title: contentTitle,
        summary: contentDigest || '',
      },
      createdAt: db.serverDate(),
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      status: 'active',
    },
  });

  // Write audit log
  await db.collection('audit_logs').add({
    data: {
      _openid: openid,
      action: 'share_content_created',
      detail: {
        shareId: shareId,
        contentType: contentType,
        contentId: contentId,
      },
      createdAt: db.serverDate(),
    },
  });

  return {
    code: 0,
    data: {
      shareId: shareId,
    },
  };
}
