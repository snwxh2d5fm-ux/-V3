/**
 * 住港伴 V3 — 家庭空间邀请页
 * L2家庭空间邀请流程：创建邀请、查看邀请详情、接受邀请
 */
Page({
  data: {
    mode: 'manage', // 'manage' | 'accept'
    loading: true,
    // manage mode
    hasSpace: false,
    members: [],
    // accept mode
    inviteCode: '',
    inviteInfo: null,
    // risk dialog
    showRiskDialog: false,
    // create invite
    selectedRole: 'spouse',
    selectedPermissions: ['personal_info'],
    newInviteCode: null,
    newInviteExpiresAt: null,
    // ui states
    creating: false,
    accepting: false,
    acceptResult: null,
    acceptError: null,
    showSuccess: false,
    // 手动输入邀请码
    acceptInputCode: '',
    // 创建邀请 — 接收方信息
    newRecipientName: '',
  },

  onLoad: function (options) {
    const inviteCode = options.inviteCode || options.query?.inviteCode || '';
    // [V4.2-P1] PII日志已移除: inviteCode不打印明文
    if (inviteCode) {
      this.setData({
        mode: 'accept',
        inviteCode: inviteCode,
        loading: true,
      });
      this.loadInvite();
    } else {
      this.setData({ mode: 'manage' });
      this.loadSpace();
    }
  },

  onShow: function () {
    if (this.data.mode === 'manage') {
      this.loadSpace();
    }
  },

  /** 加载家庭空间信息（管理端） */
  loadSpace: function () {
    const that = this;
    wx.cloud
      .callFunction({
        name: 'family-space-manage',
        data: { action: 'get-space' },
      })
      .then(function (res) {
        const result = res.result || {};
        if (result.code === 0 && result.data && result.data.hasSpace) {
          that.setData({
            hasSpace: true,
            members: result.data.members || [],
            loading: false,
          });
        } else {
          that.setData({
            hasSpace: false,
            members: [],
            loading: false,
          });
        }
      })
      .catch(function () {
        that.setData({
          hasSpace: false,
          loading: false,
        });
        wx.showToast({ title: '网络错误', icon: 'none' });
      });
  },

  /** 加载邀请信息（接受端） */
  loadInvite: function () {
    const that = this;
    const code = this.data.inviteCode;
    // [V4.2-P1] PII日志已移除: loadInvite不打印明文code
    wx.cloud
      .callFunction({
        name: 'family-invite-accept',
        data: { action: 'load', inviteCode: code },
      })
      .then(function (res) {
        const result = res.result || {};
        // [V4.2-P1] PII日志已移除: result不打印完整JSON
        if (result.code === 0 && result.data) {
          that.setData({
            inviteInfo: result.data,
            loading: false,
            acceptError: '',
          });
        } else {
          that.setData({
            loading: false,
            acceptError: (result.msg || '邀请信息无效或已过期') + ' (' + result.code + ')',
            acceptCode: code,
          });
        }
      })
      .catch(function (err) {
        console.error('[family-invite] loadInvite error:', err);
        that.setData({
          loading: false,
          acceptError: '网络异常，请检查网络后重试',
          acceptCode: code,
        });
      });
  },

  // ========== 创建邀请流程 ==========

  /** 打开创建邀请面板 */
  onCreateInvite: function () {
    this.setData({
      showRiskDialog: true,
      newInviteCode: null,
      newInviteExpiresAt: null,
      newRecipientName: '',
    });
  },

  /** 风险确认后生成邀请码 */
  onRiskConfirmed: function () {
    const that = this;
    this.setData({ creating: true, showRiskDialog: false });
    wx.cloud
      .callFunction({
        name: 'family-invite-create',
        data: {
          action: 'create',
          role: this.data.selectedRole,
          permissions: this.data.selectedPermissions,
          recipientName: (this.data.newRecipientName || '').trim(),
        },
      })
      .then(function (res) {
        const result = res.result || {};
        if (result.code === 0 && result.data && result.data.inviteCode) {
          that.setData({
            newInviteCode: result.data.inviteCode,
            newInviteExpiresAt: result.data.expiresAt,
            creating: false,
          });
          wx.showToast({ title: '邀请已生成', icon: 'success' });
        } else {
          that.setData({ creating: false });
          wx.showToast({ title: result.msg || '生成失败', icon: 'none' });
        }
      })
      .catch(function () {
        that.setData({ creating: false });
        wx.showToast({ title: '生成失败，请重试', icon: 'none' });
      });
  },

  /** 取消生成邀请 */
  onRiskCancelled: function () {
    this.setData({ showRiskDialog: false });
  },

  /** 选择家属角色 */
  onRoleSelect: function (e) {
    const role = e.currentTarget.dataset.role;
    this.setData({ selectedRole: role });
  },

  /** 切换权限项 */
  onPermissionToggle: function (e) {
    const perm = e.currentTarget.dataset.permission;
    const permissions = this.data.selectedPermissions;
    const idx = permissions.indexOf(perm);
    if (idx === -1) {
      permissions.push(perm);
    } else {
      permissions.splice(idx, 1);
    }
    this.setData({ selectedPermissions: permissions });
  },

  // ========== 家庭成员管理 ==========

  /** 移除家属 */
  onRemoveMember: function (e) {
    const targetUserId = e.currentTarget.dataset.userId;
    const that = this;
    wx.showModal({
      title: '移除家属',
      content: '确定移除此家庭成员？移除后该成员将无法访问家庭空间',
      success: function (res) {
        if (res.confirm) {
          wx.cloud
            .callFunction({
              name: 'family-space-manage',
              data: { action: 'remove-member', targetUserId: targetUserId },
            })
            .then(function () {
              wx.showToast({ title: '已移除', icon: 'success' });
              that.loadSpace();
            })
            .catch(function () {
              wx.showToast({ title: '移除失败', icon: 'none' });
            });
        }
      },
    });
  },

  /** 更新成员权限 */
  onUpdatePermissions: function (e) {
    const targetUserId = e.currentTarget.dataset.userId;
    const permissions = e.currentTarget.dataset.permissions;
    const that = this;
    wx.showLoading({ title: '更新中...' });
    wx.cloud
      .callFunction({
        name: 'family-space-manage',
        data: { action: 'update-permissions', targetUserId: targetUserId, permissions: permissions },
      })
      .then(function () {
        wx.hideLoading();
        wx.showToast({ title: '权限已更新', icon: 'success' });
        that.loadSpace();
      })
      .catch(function () {
        wx.hideLoading();
        wx.showToast({ title: '更新失败', icon: 'none' });
      });
  },

  // ========== 邀请码操作 ==========

  /** 保存邀请码图片到相册 */
  onSaveInviteImage: function () {
    const code = this.data.newInviteCode;
    if (!code) {
      wx.showToast({ title: '请先生成邀请码', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: code,
      success: function () {
        wx.showModal({
          title: '邀请码已复制',
          content: '邀请码已复制到剪贴板，你可分享给家人使用。如需保存为图片，请手动截图保存。',
          showCancel: false,
        });
      },
    });
  },

  /** 复制邀请码 */
  onCopyInviteCode: function () {
    const code = this.data.newInviteCode;
    if (!code) return;
    wx.setClipboardData({
      data: code,
      success: function () {
        wx.showToast({ title: '已复制', icon: 'success' });
      },
    });
  },

  // ========== 接受邀请流程 ==========

  /** 确认接受邀请 */
  onAcceptInvite: function () {
    const that = this;
    this.setData({ accepting: true });
    wx.cloud
      .callFunction({
        name: 'family-invite-accept',
        data: { action: 'accept', inviteCode: this.data.inviteCode },
      })
      .then(function (res) {
        const result = res.result || {};
        if (result.code === 0) {
          that.setData({
            accepting: false,
            acceptResult: 'success',
            showSuccess: true,
            spaceId: (result.data && result.data.spaceId) || '',
          });
          wx.showToast({ title: '已加入家庭空间', icon: 'success' });
        } else {
          that.setData({
            accepting: false,
            acceptError: result.msg || '加入失败',
            showSuccess: false,
          });
        }
      })
      .catch(function () {
        that.setData({
          accepting: false,
          acceptError: '网络错误，请重试',
          showSuccess: false,
        });
      });
  },

  /** 返回首页 */
  onGoHome: function () {
    wx.switchTab({ url: '/pages/mine/index/index' });
  },

  /** 输入接收方姓名 */
  onRecipientNameInput: function (e) {
    this.setData({ newRecipientName: e.detail.value });
  },

  /** 手动输入邀请码 */
  onAcceptInputCode: function (e) {
    this.setData({ acceptInputCode: e.detail.value });
  },

  /** 跳转到接受邀请页 */
  onGoAccept: function () {
    const code = (this.data.acceptInputCode || '').trim();
    if (!code) {
      wx.showToast({ title: '请输入邀请码', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: '/subpkg-share/pages/family-invite/index?inviteCode=' + encodeURIComponent(code),
    });
  },

  /** 微信分享（一键分享邀请码到聊天） */
  onShareAppMessage: function () {
    const code = this.data.newInviteCode;
    const name = (this.data.newRecipientName || '').trim();
    const title = name ? '邀请' + name + '加入我的家庭空间' : '邀请你加入我的家庭空间';
    if (!code) {
      return {
        title: title,
        path: '/pages/mine/index/index',
      };
    }
    return {
      title: title,
      path: '/subpkg-share/pages/family-invite/index?inviteCode=' + encodeURIComponent(code),
      imageUrl: '',
    };
  },
});
