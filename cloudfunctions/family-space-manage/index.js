const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

function maskUserId(originalUserId) {
  if (!originalUserId || originalUserId.length <= 6) {
    return originalUserId;
  }
  return originalUserId.substring(0, 3) + '****' + originalUserId.substring(originalUserId.length - 3);
}

exports.main = async (event) => {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    if (!openid) {
      return { code: 401, msg: '请先登录' };
    }

    const { action } = event;
    if (!action) {
      return { code: 400, msg: '请指定操作类型' };
    }

    switch (action) {
      case 'get-space': {
        // 查询用户所属的家庭空间（作为所有者或成员）
        var spaceResult = await db
          .collection('family_spaces')
          .where(_.or([{ ownerUserId: openid }, { 'members.userId': openid }]))
          .get();

        if (spaceResult.data.length === 0) {
          return {
            code: 0,
            data: {
              hasSpace: false,
            },
          };
        }

        var space = spaceResult.data[0];

        // 对成员列表中的非本人 userId 进行脱敏
        const maskedMembers = [];
        for (var i = 0; i < space.members.length; i++) {
          const member = space.members[i];
          const maskedMember = {};
          for (const key in member) {
            if (member.hasOwnProperty(key)) {
              maskedMember[key] = member[key];
            }
          }
          if (member.userId !== openid && member.userId !== space.ownerUserId) {
            maskedMember.userId = maskUserId(member.userId);
          }
          maskedMembers.push(maskedMember);
        }

        return {
          code: 0,
          data: {
            hasSpace: true,
            spaceId: space.spaceId,
            ownerUserId: space.ownerUserId,
            isOwner: space.ownerUserId === openid,
            members: maskedMembers,
            createdAt: space.createdAt,
            updatedAt: space.updatedAt,
          },
        };
      }

      case 'update-permissions': {
        var { targetUserId, permissions } = event;

        if (!targetUserId || typeof targetUserId !== 'string') {
          return { code: 400, msg: '请指定要修改权限的成员' };
        }

        if (!Array.isArray(permissions) || permissions.length === 0) {
          return { code: 400, msg: '请提供有效的权限列表' };
        }

        const allowedPermissions = [
          'personal_info',
          'documents',
          'reminders',
          'process',
          'document_upload',
          'financial_info',
        ];
        for (var i = 0; i < permissions.length; i++) {
          if (allowedPermissions.indexOf(permissions[i]) === -1) {
            return { code: 400, msg: '包含无效的权限项：' + permissions[i] };
          }
        }

        // 验证调用者是空间所有者
        var spaceResult = await db
          .collection('family_spaces')
          .where({
            ownerUserId: openid,
          })
          .get();

        if (spaceResult.data.length === 0) {
          return { code: 403, msg: '仅家庭空间所有者可修改成员权限' };
        }

        var space = spaceResult.data[0];

        // 检查目标成员是否存在
        let memberFound = false;
        for (let j = 0; j < space.members.length; j++) {
          if (space.members[j].userId === targetUserId) {
            memberFound = true;
            break;
          }
        }

        if (!memberFound) {
          return { code: 404, msg: '未找到该成员' };
        }

        // 更新成员权限
        const updateKey =
          'members.' +
          space.members.findIndex(function (m) {
            return m.userId === targetUserId;
          }) +
          '.permissions';

        const updateObj = {};
        updateObj[updateKey] = permissions;
        updateObj['updatedAt'] = db.serverDate();

        await db
          .collection('family_spaces')
          .where({
            spaceId: space.spaceId,
          })
          .update({
            data: updateObj,
          });

        // 写入审计日志
        await db.collection('audit_logs').add({
          data: {
            _openid: openid,
            action: 'family_permissions_updated',
            detail: {
              targetUserId: targetUserId,
              permissions: permissions,
              spaceId: space.spaceId,
            },
            createdAt: db.serverDate(),
          },
        });

        return { code: 0, data: { success: true } };
      }

      case 'remove-member': {
        var { targetUserId } = event;

        if (!targetUserId || typeof targetUserId !== 'string') {
          return { code: 400, msg: '请指定要移除的成员' };
        }

        // 验证调用者是空间所有者
        var spaceResult = await db
          .collection('family_spaces')
          .where({
            ownerUserId: openid,
          })
          .get();

        if (spaceResult.data.length === 0) {
          return { code: 403, msg: '仅家庭空间所有者可移除成员' };
        }

        var space = spaceResult.data[0];

        // 不能移除自己（所有者应使用空间解散或单独处理）
        if (targetUserId === openid) {
          return { code: 400, msg: '无法移除自己，请使用退出功能' };
        }

        // 移除成员
        await db
          .collection('family_spaces')
          .where({
            spaceId: space.spaceId,
          })
          .update({
            data: {
              members: _.pull({
                userId: targetUserId,
              }),
              updatedAt: db.serverDate(),
            },
          });

        // 写入审计日志
        await db.collection('audit_logs').add({
          data: {
            _openid: openid,
            action: 'family_member_removed',
            detail: {
              targetUserId: targetUserId,
              spaceId: space.spaceId,
            },
            createdAt: db.serverDate(),
          },
        });

        return { code: 0, data: { success: true } };
      }

      case 'leave': {
        // 查找当前用户作为成员（非所有者）的家庭空间
        var spaceResult = await db
          .collection('family_spaces')
          .where({
            ownerUserId: _.neq(openid),
            'members.userId': openid,
          })
          .get();

        if (spaceResult.data.length === 0) {
          return { code: 400, msg: '您不是家庭成员或您是空间所有者，无法退出（所有者可考虑解散空间）' };
        }

        var space = spaceResult.data[0];

        // 将自己从成员列表中移除
        await db
          .collection('family_spaces')
          .where({
            spaceId: space.spaceId,
          })
          .update({
            data: {
              members: _.pull({
                userId: openid,
              }),
              updatedAt: db.serverDate(),
            },
          });

        // 写入审计日志
        await db.collection('audit_logs').add({
          data: {
            _openid: openid,
            action: 'family_member_left',
            detail: {
              spaceId: space.spaceId,
            },
            createdAt: db.serverDate(),
          },
        });

        return { code: 0, data: { success: true } };
      }

      // ===== 家庭空间文档状态（纯布尔，不传文件） =====
      case 'set-doc-status': {
        const { slotKey, filled } = event;
        if (!slotKey) return { code: 400, msg: '缺少 slotKey' };

        // 查找用户所属的家庭空间
        var spaceResult = await db
          .collection('family_spaces')
          .where(_.or([{ ownerUserId: openid }, { 'members.userId': openid }]))
          .get();

        if (spaceResult.data.length === 0) {
          return { code: 404, msg: '未加入家庭空间' };
        }

        var space = spaceResult.data[0];
        const spaceId = space.spaceId;

        // 判断角色（owner 或 member）
        const isOwner = space.ownerUserId === openid;
        const role = isOwner
          ? 'owner'
          : (
              space.members.find(function (m) {
                return m.userId === openid;
              }) || {}
            ).role || 'member';

        // Upsert 文档状态
        const existing = await db
          .collection('family_doc_status')
          .where({ spaceId: spaceId, userId: openid, slotKey: slotKey })
          .get();

        if (existing.data.length > 0) {
          await db
            .collection('family_doc_status')
            .where({ spaceId: spaceId, userId: openid, slotKey: slotKey })
            .update({
              data: { filled: !!filled, updatedAt: db.serverDate() },
            });
        } else {
          await db.collection('family_doc_status').add({
            data: {
              spaceId: spaceId,
              userId: openid,
              role: role,
              slotKey: slotKey,
              filled: !!filled,
              updatedAt: db.serverDate(),
            },
          });
        }

        return { code: 0, data: { success: true } };
      }

      case 'get-doc-status': {
        var { targetUserId } = event;
        if (!targetUserId) return { code: 400, msg: '缺少 targetUserId' };

        // 验证调用者与目标用户在同一家庭空间
        var spaceResult = await db
          .collection('family_spaces')
          .where(
            _.or([
              { ownerUserId: openid, 'members.userId': targetUserId },
              { ownerUserId: targetUserId, 'members.userId': openid },
              { ownerUserId: openid, ownerUserId: targetUserId },
            ]),
          )
          .get();

        // 修正：检查空间是否包含双方
        let validSpace = null;
        for (var i = 0; i < spaceResult.data.length; i++) {
          const sp = spaceResult.data[i];
          const hasTarget =
            sp.ownerUserId === targetUserId ||
            (sp.members || []).some(function (m) {
              return m.userId === targetUserId;
            });
          const hasSelf =
            sp.ownerUserId === openid ||
            (sp.members || []).some(function (m) {
              return m.userId === openid;
            });
          if (hasTarget && hasSelf) {
            validSpace = sp;
            break;
          }
        }

        if (!validSpace) {
          return { code: 403, msg: '无权查看对方的文档状态' };
        }

        const statusResult = await db
          .collection('family_doc_status')
          .where({ spaceId: validSpace.spaceId, userId: targetUserId })
          .get();

        const slots = {};
        (statusResult.data || []).forEach(function (d) {
          slots[d.slotKey] = { filled: d.filled, updatedAt: d.updatedAt };
        });

        return { code: 0, data: { slots: slots } };
      }

      default:
        return { code: 400, msg: '无效的操作类型' };
    }
  } catch (err) {
    console.error('[family-space-manage]', err);
    return { code: 500, msg: '服务异常' };
  }
};
