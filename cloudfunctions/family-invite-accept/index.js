const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  try {
    const { action } = event;

    // action='load': 查询邀请信息（用于接受前预览）
    if (action === 'load') {
      return await loadInvite(event);
    }

    if (action !== 'accept') {
      return { code: 400, msg: '无效的操作类型，支持: load/accept' };
    }

    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    if (!openid) {
      return { code: 401, msg: '请先登录' };
    }

    const { inviteCode } = event;
    if (!inviteCode || typeof inviteCode !== 'string') {
      return { code: 400, msg: '请提供有效的邀请码' };
    }

    // 查询邀请记录
    const inviteResult = await db
      .collection('family_invites')
      .where({
        inviteCode: inviteCode,
        status: 'pending',
      })
      .get();

    if (inviteResult.data.length === 0) {
      return { code: 404, msg: '邀请不存在或已失效' };
    }

    const invite = inviteResult.data[0];

    // 检查是否过期
    const now = new Date();
    const expiresAt = new Date(invite.expiresAt);
    if (now > expiresAt) {
      await db
        .collection('family_invites')
        .where({
          inviteCode: inviteCode,
        })
        .update({
          data: {
            status: 'expired',
            updatedAt: db.serverDate(),
          },
        });
      return { code: 400, msg: '邀请已过期（48小时有效）' };
    }

    // 不能邀请自己
    if (openid === invite.inviterUserId) {
      return { code: 400, msg: '不能接受自己发出的邀请' };
    }

    // 检查接受者是否已在某个家庭空间中
    const existingMemberSpaces = await db
      .collection('family_spaces')
      .where(_.or([{ ownerUserId: openid }, { 'members.userId': openid }]))
      .get();

    if (existingMemberSpaces.data.length > 0) {
      return { code: 400, msg: '您已加入家庭空间，无法重复加入' };
    }

    // 原子更新邀请状态
    const updateResult = await db
      .collection('family_invites')
      .where({
        inviteCode: inviteCode,
        status: 'pending',
      })
      .update({
        data: {
          status: 'accepted',
          acceptedUserId: openid,
          acceptedAt: db.serverDate(),
          updatedAt: db.serverDate(),
        },
      });

    if (updateResult.stats.updated === 0) {
      return { code: 400, msg: '邀请已被使用' };
    }

    // 查找邀请者对应的家庭空间，添加成员
    const spaceResult = await db
      .collection('family_spaces')
      .where({
        ownerUserId: invite.inviterUserId,
      })
      .get();

    if (spaceResult.data.length === 0) {
      return { code: 500, msg: '家庭空间不存在' };
    }

    const space = spaceResult.data[0];
    const spaceId = space.spaceId;

    await db
      .collection('family_spaces')
      .where({
        spaceId: spaceId,
      })
      .update({
        data: {
          members: _.push({
            userId: openid,
            role: invite.role,
            permissions: invite.permissions,
            joinedAt: db.serverDate(),
            status: 'active',
          }),
          updatedAt: db.serverDate(),
        },
      });

    // 写入审计日志
    await db.collection('audit_logs').add({
      data: {
        _openid: openid,
        action: 'family_invite_accepted',
        detail: {
          inviteCode: inviteCode,
          role: invite.role,
          permissions: invite.permissions,
          spaceId: spaceId,
        },
        createdAt: db.serverDate(),
      },
    });

    return {
      code: 0,
      data: {
        spaceId: spaceId,
        role: invite.role,
        permissions: invite.permissions,
      },
    };
  } catch (err) {
    console.error('[family-invite-accept]', err);
    return { code: 500, msg: '服务异常' };
  }
};

// ============ loadInvite: 查询邀请信息（接受前预览） ============
async function loadInvite(event) {
  const { inviteCode } = event;
  if (!inviteCode) return { code: 400, msg: '缺少邀请码' };

  const inviteResult = await db
    .collection('family_invites')
    .where({
      inviteCode: inviteCode,
      status: 'pending',
    })
    .get();

  if (inviteResult.data.length === 0) {
    return { code: 404, msg: '邀请不存在或已失效' };
  }

  const invite = inviteResult.data[0];
  const now = new Date();
  const expiresAt = new Date(invite.expiresAt);
  if (now > expiresAt) {
    return { code: 400, msg: '邀请已过期（48小时有效）' };
  }

  return {
    code: 0,
    data: {
      inviteCode: invite.inviteCode,
      role: invite.role,
      permissions: invite.permissions,
      expiresAt: invite.expiresAt,
    },
  };
}
