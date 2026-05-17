// 住港伴 关卡7: 续签准备 (5项)
module.exports = [
  {
    "id": "onboard-701",
    "phase": 7,
    "sequence": 1,
    "category": "续签准备",
    "title": "确认续签时间窗口",
    "subtitle": "到期前3个月可递交申请——提前4-6月准备材料",
    "timeEstimate": "15分钟",
    "urgency": "必修",
    "icon": "calendar",
    "applicableTo": {
      "visaTypes": "all",
      "familyStatus": "all",
      "arrivalScenario": [
        "fresh",
        "delayed"
      ],
      "skipIfExisting": []
    },
    "steps": [
      {
        "seq": 1,
        "title": "查签证到期日",
        "content": "翻出签证标签页(或入境处App)，记录精确到期日",
        "type": "action"
      },
      {
        "seq": 2,
        "title": "续签窗口",
        "content": "到期前3个月开始可递交续签申请(2026年新政)。建议提前4-6个月开始准备材料",
        "type": "info"
      },
      {
        "seq": 3,
        "title": "各路径续签模式",
        "content": "优才3+3+2/高才A类3+3+2/高才BC类2+3+3/专才3+3+2(绑雇主)/IANG 2+2+3",
        "type": "info"
      }
    ],
    "tips": [],
    "renewalEvidence": {
      "produces": true,
      "docType": "签证到期日确认",
      "docCategory": "visa",
      "collectMethod": "manual",
      "isRequiredForRenewal": true
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null
  },
  {
    "id": "onboard-702",
    "phase": 7,
    "sequence": 2,
    "category": "续签准备",
    "title": "整理续签所需材料清单",
    "subtitle": "依路径不同准备不同材料——提前对照检查",
    "timeEstimate": "20分钟",
    "urgency": "必修",
    "icon": "checklist",
    "applicableTo": {
      "visaTypes": "all",
      "familyStatus": "all",
      "arrivalScenario": [
        "fresh",
        "delayed"
      ],
      "skipIfExisting": []
    },
    "steps": [
      {
        "seq": 1,
        "title": "依路径查清单",
        "content": "优才=通常居住+在港有贡献。高才通=两址两单(居住地址+实体办公地址+薪俸/利得税单+MPF记录)",
        "type": "info"
      },
      {
        "seq": 2,
        "title": "对照续签档案",
        "content": "在Tab3续签档案中检查材料完整度→标记缺失项→制定补充计划",
        "type": "action"
      }
    ],
    "tips": [],
    "renewalEvidence": {
      "produces": false
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null
  },
  {
    "id": "onboard-703",
    "phase": 7,
    "sequence": 3,
    "category": "续签准备",
    "title": "确认通常居住证明齐全",
    "subtitle": "租约+厘印+水电煤账单是最重要三件套",
    "timeEstimate": "15分钟",
    "urgency": "必修",
    "icon": "home",
    "applicableTo": {
      "visaTypes": "all",
      "familyStatus": "all",
      "arrivalScenario": [
        "fresh",
        "delayed"
      ],
      "skipIfExisting": []
    },
    "steps": [
      {
        "seq": 1,
        "title": "通常居住证明",
        "content": "租约+厘印+水电煤账单(最重要三件套)+银行月结单+香港驾照+MPF记录+税单",
        "type": "info"
      },
      {
        "seq": 2,
        "title": "离境天数自查",
        "content": "7年居港期间每年离境天数建议≤180天。如有长期离境准备合理解释(出差/探亲/进修)",
        "type": "info"
      }
    ],
    "tips": [],
    "renewalEvidence": {
      "produces": false
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null
  },
  {
    "id": "onboard-704",
    "phase": 7,
    "sequence": 4,
    "category": "续签准备",
    "title": "补充最近3个月水电煤账单",
    "subtitle": "入境处通常要求最近3个月账单——现在就要补充",
    "timeEstimate": "15分钟",
    "urgency": "必修",
    "icon": "utility",
    "applicableTo": {
      "visaTypes": "all",
      "familyStatus": "all",
      "arrivalScenario": [
        "fresh",
        "delayed"
      ],
      "skipIfExisting": []
    },
    "steps": [
      {
        "seq": 1,
        "title": "续签前最后准备",
        "content": "入境处通常要最近3个月账单→如果已存的是半年前的账单，现在需要补充最新一期",
        "type": "info"
      },
      {
        "seq": 2,
        "title": "获取最新账单",
        "content": "中电/港灯App→查阅电子账单→截图。确保显示完整姓名+地址",
        "type": "action"
      }
    ],
    "tips": [],
    "renewalEvidence": {
      "produces": true,
      "docType": "最近3个月水电煤账单",
      "docCategory": "address",
      "collectMethod": "photo",
      "isRequiredForRenewal": true,
      "expiryCheck": "3months",
      "renewalTip": "续签前最后一步关键材料。最近3个月的账单证明你直到续签前一直在此居住。"
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null
  },
  {
    "id": "onboard-705",
    "phase": 7,
    "sequence": 5,
    "category": "续签准备",
    "title": "了解自雇续签选项",
    "subtitle": "不在港有固定雇主? 创业/自由职业者的续签方案",
    "timeEstimate": "15分钟",
    "urgency": "建议",
    "icon": "briefcase",
    "applicableTo": {
      "visaTypes": "all",
      "familyStatus": "all",
      "arrivalScenario": [
        "fresh",
        "delayed"
      ],
      "skipIfExisting": []
    },
    "steps": [
      {
        "seq": 1,
        "title": "适合什么人",
        "content": "不在港有固定雇主/自由职业者/创业人士/高才A类收入不稳定者",
        "type": "info"
      },
      {
        "seq": 2,
        "title": "自雇续签方案",
        "content": "注册香港公司→真实运营→给自己发工资→纳税+供MPF。需公司BR+商业租约/办公室+审计报告+利得税单",
        "type": "info"
      }
    ],
    "tips": [],
    "renewalEvidence": {
      "produces": false
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null
  }
];
