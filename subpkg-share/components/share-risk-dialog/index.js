Component({
  properties: {
    visible: {
      type: Boolean,
      value: false,
    },
    contentType: {
      type: String,
      value: 'family_invite',
    },
  },

  data: {
    checked: false,
  },

  observers: {
    visible: function (val) {
      if (!val) {
        this.setData({ checked: false });
      }
    },
  },

  methods: {
    onCheck: function () {
      this.setData({
        checked: !this.data.checked,
      });
    },

    onCancel: function () {
      this.triggerEvent('cancel');
    },

    onConfirm: function () {
      if (!this.data.checked) {
        return;
      }
      this.triggerEvent('confirm');
    },
  },
});
