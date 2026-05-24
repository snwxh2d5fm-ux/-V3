const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const crypto = require('crypto');

function generateSpaceId() {
  return 'FS-' + Date.now().toString(36).toUpperCase();
}

function validateRole(role) {
  return ['spouse', 'child'].indexOf(role) !== -1;
}

function validatePermissions(permissions) {
  if (!Array.isArray(permissions) || permissions.length === 0) {
    return false;
  }
  // 对齐客户端侧权限值：personal_info/documents/reminders/process
  const allowed = ['personal_info', 'documents', 'reminders', 'process', 'document_upload', 'financial_info'];
  for (let i = 0; i < permissions.length; i++) {
    if (allowed.indexOf(permissions[i]) === -1) {
      return false;
    }
  }
  return true;
}

exports.main = async (event) => {
  try {
    const { action } = event;
    if (action !== 'create') {
      return { code: 400, msg: '无效的操作类型' };
    }

    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    if (!openid) {
      return { code: 401, msg: '请先登录' };
    }

    const { role, permissions, recipientName } = event;

    if (!validateRole(role)) {
      return { code: 400, msg: '无效的家属角色，仅支持 spouse 或 child' };
    }

    if (!validatePermissions(permissions)) {
      return { code: 400, msg: '无效的权限列表' };
    }

    // 接收方姓名校验（与玄武审查 #28 裁决一致：DB 存 inviteeName）
    const inviteeName = (recipientName || '').trim();
    if (!inviteeName || inviteeName.length < 1 || inviteeName.length > 20) {
      return { code: 400, msg: '请填写接收方姓名（1-20字）' };
    }

    // financial_info 默认关闭
    if (permissions.indexOf('financial_info') !== -1) {
      const filteredPermissions = [];
      for (let i = 0; i < permissions.length; i++) {
        if (permissions[i] !== 'financial_info') {
          filteredPermissions.push(permissions[i]);
        }
      }
      return { code: 400, msg: 'financial_info 权限暂不支持邀请时开通' };
    }

    // 检查是否已有家庭空间
    const existingSpace = await db
      .collection('family_spaces')
      .where({
        ownerUserId: openid,
      })
      .get();

    let spaceId;
    if (existingSpace.data.length > 0) {
      // 已有空间：仅追加新邀请，不重复创建空间
      spaceId = existingSpace.data[0].spaceId;
    } else {
      // 首次创建空间
      spaceId = generateSpaceId();
      await db.collection('family_spaces').add({
        data: {
          spaceId: spaceId,
          ownerUserId: openid,
          members: [],
          createdAt: db.serverDate(),
          updatedAt: db.serverDate(),
        },
      });
    }

    // 生成邀请码
    const inviteCode = crypto.randomBytes(12).toString('hex');

    // 有效期48小时
    const now = Date.now();
    const expiresAt = new Date(now + 48 * 3600000).toISOString();

    // 写入邀请记录（关联到已有或新建的空间）
    await db.collection('family_invites').add({
      data: {
        inviteCode: inviteCode,
        inviterUserId: openid,
        spaceId: spaceId,
        role: role,
        permissions: permissions,
        inviteeName: inviteeName,
        status: 'pending',
        createdAt: db.serverDate(),
        expiresAt: expiresAt,
      },
    });

    // 写入审计日志
    await db.collection('audit_logs').add({
      data: {
        _openid: openid,
        action: 'family_invite_created',
        detail: {
          inviteCode: inviteCode,
          role: role,
          permissions: permissions,
          inviteeName: inviteeName,
        },
        createdAt: db.serverDate(),
      },
    });

    return {
      code: 0,
      data: {
        inviteCode: inviteCode,
        expiresAt: expiresAt,
        role: role,
        permissions: permissions,
      },
    };
  } catch (err) {
    console.error('[family-invite-create]', err);
    return { code: 500, msg: '服务异常' };
  }
};
