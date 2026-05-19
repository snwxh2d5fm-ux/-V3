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
    "tips": [
      "高才通A/B类：首次2年→续签3+3年，不绑定雇主",
      "IANG：首次2年→续签2+2+3年，不绑定雇主但需有工作",
      "优才：首次3年→续签3+2年，不要求雇佣但需证明\"通常居住\"",
      "专才：每次2-3年，绑定雇主——换工需重新申请",
      "须在签证到期前递交申请——审批期间可合法逗留"
    ],
    "renewalEvidence": {
      "produces": true,
      "docType": "签证到期日确认",
      "docCategory": "visa",
      "collectMethod": "manual",
      "isRequiredForRenewal": true
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null,
    "officialLinks": [
      {
        "label": "入境处·延长逗留期限",
        "url": "https://www.gov.hk/tc/residents/immigration/nonpermanent/applyextensionstay/othernpr.htm"
      },
      {
        "label": "GovHK·签证续期",
        "url": "https://www.gov.hk/tc/residents/immigration/nonpermanent/applyextensionstay/othernpr.htm"
      }
    ],
    "requiredItems": [
      "签证标签页/e-Visa打印件",
      "护照/港澳通行证（有效期>签证到期日）",
      "香港身份证"
    ],
    "pitfalls": [
      "各路径续签模式不同——不要用IANG续签策略套用到高才/优才",
      "续签窗口通常为到期前1-3个月——太早申请可能被退回，太迟可能断签",
      "断签=连续居住重新计算——对永居7年计时影响最大"
    ]
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
    "tips": [
      "建议提前1-2个月与HR沟通ID990B填写——很多公司HR不熟悉流程需时处理",
      "材料按路径分类归档——受雇=雇主材料为主，自雇=商业登记+合同+银行流水+审计",
      "入境处无硬性薪资门槛——但参考月薪不应低于HKD 20000（基本生活线）"
    ],
    "renewalEvidence": {
      "produces": false
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null,
    "officialLinks": [
      {
        "label": "入境处·续签所需文件",
        "url": "https://www.gov.hk/tc/residents/immigration/nonpermanent/applyextensionstay/othernpr.htm"
      },
      {
        "label": "入境处·表格下载",
        "url": "https://www.immd.gov.hk/hks/forms/forms.html"
      }
    ],
    "requiredItems": [
      "ID91表格（延期逗留申请表）",
      "ID990B表格（雇主填写+盖章）",
      "旅行证件（通行证+有效签注）",
      "雇佣合同（注明职位/月薪/工时）",
      "MPF缴款记录",
      "税单/评税通知书"
    ],
    "pitfalls": [
      "ID990B需雇主盖章——部分HR可能不配合，需提前沟通并提供填写指引",
      "续签被拒最常见原因：就业状态不稳定（失业/gap无解释）>收入不足>MPF/税务记录缺失>在港联系不足>虚假材料",
      "自雇续签比受雇续签严格得多——入境处想看真实业务而非\"挂名自雇\""
    ]
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
    "tips": [
      "\"7年档案整理法\"：从第一年开始，按年份建7个文件夹，每年末归档一次",
      "\"铁三角\"材料（出入境+税单+MPF）最受入境处重视——确保三者跨年度对齐无矛盾",
      "第5-6年提前系统整理——检查缺失可最后1年补漏"
    ],
    "renewalEvidence": {
      "produces": false
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null,
    "officialLinks": [
      {
        "label": "入境处·出入境记录申请",
        "url": "https://www.gov.hk/tc/residents/immigration/nonpermanent/applyextensionstay/othernpr.htm"
      },
      {
        "label": "GovHK·住满7年指南",
        "url": "https://www.gov.hk/tc/residents/immigration/idcard/rop145.html"
      }
    ],
    "requiredItems": [
      "7年出入境记录（向入境处申请）",
      "7年MPF年度结单（联系受托人）",
      "7年税单/评税通知书（eTAX下载）",
      "7年住址证明（租约+水电煤账单）",
      "各阶段雇佣合同/离职证明/升职信",
      "银行月结单（显示日常消费和入息）",
      "保险/医疗/社区活动参与记录"
    ],
    "pitfalls": [
      "最后2年尽量每年在港≥300天——避免连续离港>3个月",
      "证据链断裂（非在港天数）是最常见的补件原因——租约/MPF/税单/雇佣记录跨年度必须连续无断点",
      "MPF/报税记录最容易遗漏早期年份——建议从第一年起保留完整"
    ]
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
    "tips": [
      "水务署转名免费——到水务署网站或致电办理，3-5工作天生效",
      "中电/港灯/煤气转名需约HKD 100-300按金——新账户开通后旧账单自动转至新地址",
      "电子账单即时可得——上网下载最近3期PDF比等纸质信快得多"
    ],
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
    "aiChatContext": null,
    "officialLinks": [
      {
        "label": "中电·电子账单",
        "url": "https://www.clp.com.hk"
      },
      {
        "label": "港灯·电子账单",
        "url": "https://www.hkelectric.com"
      },
      {
        "label": "水务署·电子账单",
        "url": "https://www.wsd.gov.hk/tc/customer-services/online-services/index.html"
      }
    ],
    "requiredItems": [
      "最近3月水电煤账单（必须是近期，过旧不被接受）",
      "水务署/中电/港灯/煤气公司账户信息"
    ],
    "pitfalls": [
      "水电煤账单上姓名必须与身份证完全一致——英文名/姓名的任何缩写差异可能不被接受",
      "电子账单截图不被接受——需下载官方PDF格式账单（含水印/账号）",
      "若最近3月刚搬家账单不齐全——可附上新旧地址账单+搬家证明（搬屋公司收据）过渡"
    ]
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
    "tips": [
      "自雇续签给自己发薪≥HKD 15000-20000/月并注册MPF供款——这是证明\"在香港有经济贡献\"的最直接方式",
      "初创公司持续亏损不直接影响续签——但需展示真实运营（客户/产品进展）",
      "最优策略：受雇+自雇并行——一条路径不稳定时另一路径兜底"
    ],
    "renewalEvidence": {
      "produces": false
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null,
    "officialLinks": [
      {
        "label": "入境处·企业家来港投资",
        "url": "https://www.gov.hk/tc/residents/immigration/nonpermanent/applyextensionstay/entrepreneur.htm"
      },
      {
        "label": "公司注册处",
        "url": "https://www.cr.gov.hk"
      },
      {
        "label": "投资推广署",
        "url": "https://www.investhk.gov.hk"
      }
    ],
    "requiredItems": [
      "香港商业登记证（BR）",
      "公司注册证书（CI）",
      "业务合同/发票（近6-12个月）",
      "公司银行月结单（近6-12个月）",
      "审计报告（有限公司必备）",
      "自雇MPF供款记录",
      "个人税单/评税通知书"
    ],
    "pitfalls": [
      "自雇续签核心难点：证明\"真实业务\"——入境处会审视业务合同是否有真实交易",
      "注册空壳公司/无实际运营/无本地客户=高风险拒签——续签前至少6个月开始积累业务证据",
      "不要造假——入境处有跨境核查能力，一经发现永久列入黑名单",
      "营收不应全为关联交易（即只做内地企业买卖）——入境处希望看到自主获客能力"
    ]
  }
];
