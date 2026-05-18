/**
 * 住港伴 V3 — 家庭空间邀请页
 * L2家庭空间邀请流程：创建邀请、查看邀请详情、接受邀请
 */
Page({
  data: {
    mode: 'manage',           // 'manage' | 'accept'
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
    showSuccess: false
  },

  onLoad: function(options) {
    var inviteCode = options.inviteCode;
    if (inviteCode) {
      this.setData({
        mode: 'accept',
        inviteCode: inviteCode,
        loading: true
      });
      this.loadInvite();
    } else {
      this.setData({ mode: 'manage' });
      this.loadSpace();
    }
  },

  onShow: function() {
    if (this.data.mode === 'manage') {
      this.loadSpace();
    }
  },

  /** 加载家庭空间信息（管理端） */
  loadSpace: function() {
    var that = this;
    wx.cloud.callFunction({
      name: 'family-space-manage',
      data: { action: 'get-space' }
    }).then(function(res) {
      var result = res.result || {};
      if (result.success && result.space) {
        that.setData({
          hasSpace: true,
          members: result.space.members || [],
          loading: false
        });
      } else {
        that.setData({
          hasSpace: false,
          members: [],
          loading: false
        });
      }
    }).catch(function() {
      that.setData({
        hasSpace: false,
        loading: false
      });
      wx.showToast({ title: '网络错误', icon: 'none' });
    });
  },

  /** 加载邀请信息（接受端） */
  loadInvite: function() {
    var that = this;
    wx.cloud.callFunction({
      name: 'family-invite-accept',
      data: { action: 'load', inviteCode: this.data.inviteCode }
    }).then(function(res) {
      var result = res.result || {};
      if (result.success && result.invite) {
        that.setData({
          inviteInfo: result.invite,
          loading: false
        });
      } else {
        that.setData({
          loading: false,
          acceptError: result.error || '邀请信息无效或已过期'
        });
      }
    }).catch(function() {
      that.setData({
        loading: false,
        acceptError: '加载邀请信息失败'
      });
    });
  },

  // ========== 创建邀请流程 ==========

  /** 打开创建邀请面板 */
  onCreateInvite: function() {
    this.setData({
      showRiskDialog: true,
      newInviteCode: null,
      newInviteExpiresAt: null
    });
  },

  /** 风险确认后生成邀请码 */
  onRiskConfirmed: function() {
    var that = this;
    this.setData({ creating: true, showRiskDialog: false });
    wx.cloud.callFunction({
      name: 'family-invite-create',
      data: {
        action: 'create',
        role: this.data.selectedRole,
        permissions: this.data.selectedPermissions
      }
    }).then(function(res) {
      var result = res.result || {};
      if (result.success && result.inviteCode) {
        that.setData({
          newInviteCode: result.inviteCode,
          newInviteExpiresAt: result.expiresAt,
          creating: false
        });
        wx.showToast({ title: '邀请已生成', icon: 'success' });
      } else {
        that.setData({ creating: false });
        wx.showToast({ title: result.error || '生成失败', icon: 'none' });
      }
    }).catch(function() {
      that.setData({ creating: false });
      wx.showToast({ title: '生成失败，请重试', icon: 'none' });
    });
  },

  /** 取消生成邀请 */
  onRiskCancelled: function() {
    this.setData({ showRiskDialog: false });
  },

  /** 选择家属角色 */
  onRoleSelect: function(e) {
    var role = e.currentTarget.dataset.role;
    this.setData({ selectedRole: role });
  },

  /** 切换权限项 */
  onPermissionToggle: function(e) {
    var perm = e.currentTarget.dataset.permission;
    var permissions = this.data.selectedPermissions;
    var idx = permissions.indexOf(perm);
    if (idx === -1) {
      permissions.push(perm);
    } else {
      permissions.splice(idx, 1);
    }
    this.setData({ selectedPermissions: permissions });
  },

  // ========== 家庭成员管理 ==========

  /** 移除家属 */
  onRemoveMember: function(e) {
    var targetUserId = e.currentTarget.dataset.userId;
    var that = this;
    wx.showModal({
      title: '移除家属',
      content: '确定移除此家庭成员？移除后该成员将无法访问家庭空间',
      success: function(res) {
        if (res.confirm) {
          wx.cloud.callFunction({
            name: 'family-space-manage',
            data: { action: 'remove-member', targetUserId: targetUserId }
          }).then(function() {
            wx.showToast({ title: '已移除', icon: 'success' });
            that.loadSpace();
          }).catch(function() {
            wx.showToast({ title: '移除失败', icon: 'none' });
          });
        }
      }
    });
  },

  /** 更新成员权限 */
  onUpdatePermissions: function(e) {
    var targetUserId = e.currentTarget.dataset.userId;
    var permissions = e.currentTarget.dataset.permissions;
    var that = this;
    wx.showLoading({ title: '更新中...' });
    wx.cloud.callFunction({
      name: 'family-space-manage',
      data: { action: 'update-permissions', targetUserId: targetUserId, permissions: permissions }
    }).then(function() {
      wx.hideLoading();
      wx.showToast({ title: '权限已更新', icon: 'success' });
      that.loadSpace();
    }).catch(function() {
      wx.hideLoading();
      wx.showToast({ title: '更新失败', icon: 'none' });
    });
  },

  // ========== 邀请码操作 ==========

  /** 保存邀请码图片到相册 */
  onSaveInviteImage: function() {
    var code = this.data.newInviteCode;
    if (!code) {
      wx.showToast({ title: '请先生成邀请码', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: code,
      success: function() {
        wx.showModal({
          title: '邀请码已复制',
          content: '邀请码已复制到剪贴板，你可分享给家人使用。如需保存为图片，请手动截图保存。',
          showCancel: false
        });
      }
    });
  },

  /** 复制邀请码 */
  onCopyInviteCode: function() {
    var code = this.data.newInviteCode;
    if (!code) return;
    wx.setClipboardData({
      data: code,
      success: function() {
        wx.showToast({ title: '已复制', icon: 'success' });
      }
    });
  },

  // ========== 接受邀请流程 ==========

  /** 确认接受邀请 */
  onAcceptInvite: function() {
    var that = this;
    this.setData({ accepting: true });
    wx.cloud.callFunction({
      name: 'family-invite-accept',
      data: { action: 'accept', inviteCode: this.data.inviteCode }
    }).then(function(res) {
      var result = res.result || {};
      if (result.success) {
        that.setData({
          accepting: false,
          acceptResult: 'success',
          showSuccess: true,
          spaceId: result.spaceId || ''
        });
        wx.showToast({ title: '已加入家庭空间', icon: 'success' });
      } else {
        that.setData({
          accepting: false,
          acceptError: result.error || '加入失败',
          showSuccess: false
        });
      }
    }).catch(function() {
      that.setData({
        accepting: false,
        acceptError: '网络错误，请重试',
        showSuccess: false
      });
    });
  },

  /** 返回首页 */
  onGoHome: function() {
    wx.switchTab({ url: '/pages/mine/index/index' });
  }
});
