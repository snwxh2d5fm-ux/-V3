module.exports = [
  {
    "id": "VAL_MILESTONE_01", "stage": "material_prep",
    "field": "processType", "required": true,
    "pattern": "qmas|ttps_a|ttps_bc|asmpt|iang"
  },
  {
    "id": "VAL_MILESTONE_02", "stage": "submitted",
    "field": "applicationNumber", "required": true,
    "pattern": "[A-Z0-9\\-]{6,}"
  },
  {
    "id": "VAL_MILESTONE_03", "stage": "approved",
    "field": "applicationNumber", "required": true,
    "pattern": "[A-Z0-9\\-]{6,}"
  },
  {
    "id": "VAL_MILESTONE_04", "stage": "approved",
    "field": "approvalDate", "required": true,
    "pattern": "\\d{4}[-/]\\d{1,2}[-/]\\d{1,2}"
  },
  {
    "id": "VAL_MILESTONE_05", "stage": "visa_activated",
    "field": "visaType", "required": true
  },
  {
    "id": "VAL_MILESTONE_06", "stage": "visa_activated",
    "field": "validTo", "required": true,
    "pattern": "\\d{4}[-/]\\d{1,2}[-/]\\d{1,2}"
  },
  {
    "id": "VAL_MILESTONE_07", "stage": "landed",
    "field": "hkIdNumber", "required": true,
    "pattern": "[A-Z]\\d{6}\\([0-9A]\\)"
  },
  {
    "id": "VAL_MILESTONE_08", "stage": "permanent",
    "field": "hkIdNumber", "required": true,
    "pattern": "[A-Z]\\d{6}\\([0-9A]\\)"
  },
  {
    "id": "VAL_ANOMALY_01", "stage": "approved",
    "field": "rawText", "forbiddenPattern": "购物|发票|收据|消费",
    "reason": "上传图片内容与获批通知书不符"
  },
  {
    "id": "VAL_ANOMALY_02", "stage": "permanent",
    "field": "rawText", "forbiddenPattern": "非永久|Non-permanent",
    "reason": "上传的身份证非永久居民身份证"
  }
];
