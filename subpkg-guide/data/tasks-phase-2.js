// 住港伴 关卡2: 行政开户 (7项)
module.exports = [
  {
    "id": "onboard-201",
    "phase": 2,
    "sequence": 1,
    "category": "行政开户",
    "title": "开立香港银行户口",
    "subtitle": "中银门槛最低，内地身份友好",
    "timeEstimate": "1-2小时",
    "urgency": "必修",
    "icon": "bank",
    "applicableTo": {
      "visaTypes": "all",
      "familyStatus": "all",
      "arrivalScenario": [
        "fresh",
        "delayed"
      ],
      "skipIfExisting": [
        "bank-account"
      ]
    },
    "steps": [
      {
        "seq": 1,
        "title": "准备材料",
        "content": "HK身份证+逗留签注+地址证明近3个月内+内地二代身份证+港澳通行证+入境小白条",
        "type": "info"
      },
      {
        "seq": 2,
        "title": "选择银行并预约",
        "content": "首选中银香港（门槛低/内地身份友好/支持内地地址证明），次选汇丰One（网点多/全球转账），备选ZA Bank（纯线上辅助）",
        "type": "info"
      },
      {
        "seq": 3,
        "title": "亲临分行办理",
        "content": "按预约时间到达，非永久居民不可豁免地址证明，开户用途需明确（工资入账+日常消费+跨境汇款），柜台约30-45min",
        "type": "action"
      }
    ],
    "requiredItems": [
      "HK身份证(如有)",
      "内地二代身份证",
      "港澳通行证",
      "入境小白条",
      "地址证明",
      "现金HK$500-1000"
    ],
    "officialLinks": [
      {
        "label": "中银香港",
        "url": "https://www.bochk.com"
      },
      {
        "label": "汇丰One",
        "url": "https://www.hsbc.com.hk"
      }
    ],
    "tips": [
      "尚无香港地址证明时中银可接受内地地址证明",
      "12月内被拒3次→标记高风险客户→等6月",
      "逗留签注有效期需≥180天"
    ],
    "pitfalls": [
      "地址证明上姓名须与证件完全一致",
      "月入8000却申请500万理财=可疑",
      "截图电子账单不被接受"
    ],
    "renewalEvidence": {
      "produces": true,
      "docType": "银行开户确认函",
      "docCategory": "address",
      "collectMethod": "photo",
      "isRequiredForRenewal": true,
      "expiryCheck": null,
      "renewalTip": "银行开户确认函是地址证明的重要交叉验证材料。建议同时开户后90天内完成首笔交易验证。"
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null
  },
  {
    "id": "onboard-202",
    "phase": 2,
    "sequence": 2,
    "category": "行政开户",
    "title": "获取有效地址证明",
    "subtitle": "香港最常用的身份凭证之一",
    "timeEstimate": "1-2小时",
    "urgency": "必修",
    "icon": "document",
    "applicableTo": {
      "visaTypes": "all",
      "familyStatus": "all",
      "arrivalScenario": [
        "fresh",
        "delayed"
      ],
      "skipIfExisting": [
        "rental"
      ]
    },
    "steps": [
      {
        "seq": 1,
        "title": "了解什么是有效地址证明",
        "content": "水电煤账单/银行月结单/政府函件/已打厘印租约。不接受的：截图电子账单/快递单/手机话费单/手写证明",
        "type": "info"
      },
      {
        "seq": 2,
        "title": "获取第一份地址证明",
        "content": "如已完成银行开户→首月银行月结单（最简便）；如已租房→已打厘印租约；如已申请水电煤→首期账单",
        "type": "action"
      },
      {
        "seq": 3,
        "title": "保存多份地址证明",
        "content": "建议保存至少2-3份不同来源的地址证明（银行+水电+租约），不同机构可能要求不同类型",
        "type": "action"
      },
      {
        "seq": 4,
        "title": "定期更新",
        "content": "地址证明通常要求“近3个月内”，每季度需要新的账单",
        "type": "info"
      }
    ],
    "requiredItems": [
      "银行月结单或租约或水电煤账单"
    ],
    "officialLinks": [
      {
        "label": "差饷物业估价署",
        "url": "https://www.rvd.gov.hk"
      },
      {
        "label": "水务署·账单作地址证明",
        "url": "https://www.wsd.gov.hk"
      },
      {
        "label": "中电/港灯·电费账单",
        "url": "https://www.clp.com.hk"
      }
    ],
    "tips": [
      "银行月结单是最容易获取的地址证明",
      "水务署转名免费",
      "可要求银行发出正式地址确认函（3-7工作天）"
    ],
    "pitfalls": [
      "地址证明上姓名须与证件完全一致",
      "截图电子账单不被接受",
      "新来港前3个月可能缺乏本地地址证明→用租约+厘印过渡"
    ],
    "renewalEvidence": {
      "produces": true,
      "docType": "首期银行月结单",
      "docCategory": "address",
      "collectMethod": "photo",
      "isRequiredForRenewal": true,
      "expiryCheck": null,
      "renewalTip": "首期月结单证明了你在港的经济活动起点。后续每月保存电子版月结单。"
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null
  },
  {
    "id": "onboard-203",
    "phase": 2,
    "sequence": 3,
    "category": "行政开户",
    "title": "登记HA Go并完成首次线下认证",
    "subtitle": "医管局一站式App——预约看病缴费全靠它",
    "timeEstimate": "1小时",
    "urgency": "必修",
    "icon": "hospital",
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
        "title": "下载HA Go App并注册",
        "content": "App Store/Google Play搜索“HA Go”，用香港手机号注册",
        "type": "action"
      },
      {
        "seq": 2,
        "title": "亲临诊所完成首次线下登记",
        "content": "携HK身份证+地址证明前往任一公立诊所/医院，成人自助，小童家长代携港澳通行证+有效签证，⚠️建议健康时尽早登记",
        "type": "action"
      },
      {
        "seq": 3,
        "title": "学习预约门诊",
        "content": "HA Go→预约家庭医学诊所→选择诊所→接纳预约时间，🔑抢号秘诀：每小时的29分和59分刷新App",
        "type": "action"
      }
    ],
    "requiredItems": [
      "HK身份证",
      "地址证明",
      "香港手机号"
    ],
    "officialLinks": [
      {
        "label": "HA Go",
        "url": "https://www.ha.org.hk/hago"
      }
    ],
    "tips": [
      "小童登记后获发临时证件号码",
      "65岁以上长者自动轮候长者筹",
      "65岁以下可抢普通筹"
    ],
    "pitfalls": [
      "必须亲临诊所完成首次登记（不能纯线上）",
      "两个月内3次失约→失去预约资格"
    ],
    "renewalEvidence": {
      "produces": false,
      "docType": null,
      "docCategory": null,
      "collectMethod": null,
      "isRequiredForRenewal": false,
      "expiryCheck": null,
      "renewalTip": null
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null
  },
  {
    "id": "onboard-204",
    "phase": 2,
    "sequence": 4,
    "category": "行政开户",
    "title": "登记SmartPLAY康体通",
    "subtitle": "运动场地预约——政府设施便宜到离谱",
    "timeEstimate": "20分钟",
    "urgency": "建议",
    "icon": "sport",
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
        "title": "下载My SmartPLAY App或访问网页",
        "content": "smartplay.lcsd.gov.hk，需先用“智方便”即时认证",
        "type": "action"
      },
      {
        "seq": 2,
        "title": "完成登记",
        "content": "全港约240个康乐场地共375个自助服务站，亦可亲临柜台",
        "type": "info"
      },
      {
        "seq": 3,
        "title": "了解预订规则",
        "content": "7天内可预订，繁忙时间每人每天同类限2小时，羽毛球场$37-59/小时，健身室月票$180/月",
        "type": "info"
      }
    ],
    "requiredItems": [
      "智方便+登记"
    ],
    "officialLinks": [
      {
        "label": "SmartPLAY",
        "url": "https://smartplay.lcsd.gov.hk"
      }
    ],
    "tips": [
      "年满15岁且完成健身房安全课才能用健身室",
      "全民运动日（8月）多项设施免费",
      "预约后取消不获退款"
    ],
    "pitfalls": [
      "旧Leisure Link用户也须重新登记",
      "非HK居民须亲临佐敦SmartPLAY服务中心登记临时用户"
    ],
    "renewalEvidence": {
      "produces": false,
      "docType": null,
      "docCategory": null,
      "collectMethod": null,
      "isRequiredForRenewal": false,
      "expiryCheck": null,
      "renewalTip": null
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null
  },
  {
    "id": "onboard-205",
    "phase": 2,
    "sequence": 5,
    "category": "行政开户",
    "title": "登记智方便+",
    "subtitle": "政府数码身份——网上办事省去排队",
    "timeEstimate": "15分钟",
    "urgency": "建议",
    "icon": "smart",
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
        "title": "检查设备条件",
        "content": "需NFC手机（iOS14+/Android12+）+ 2018年11月后签发的新智能身份证",
        "type": "info"
      },
      {
        "seq": 2,
        "title": "下载智方便App并升级至+",
        "content": "下载“智方便iAM Smart”→“一按升级智方便+”→拍摄身份证→NFC读取→容貌辨识",
        "type": "action"
      },
      {
        "seq": 3,
        "title": "了解可用服务",
        "content": "网上报税/图书馆登记/运输署预约/医健通等过百项政府服务",
        "type": "info"
      }
    ],
    "requiredItems": [
      "NFC手机",
      "新智能身份证（2018年11月后签发）"
    ],
    "officialLinks": [
      {
        "label": "智方便",
        "url": "https://www.iamsmart.gov.hk"
      }
    ],
    "tips": [
      "智方便+需要NFC功能→部分平价手机不支持",
      "可到自助登记站/邮局办理",
      "11岁以上即可登记"
    ],
    "pitfalls": [
      "2018年前签发的旧身份证不支持",
      "如无法在线完成可亲临登记服务柜位"
    ],
    "renewalEvidence": {
      "produces": false,
      "docType": null,
      "docCategory": null,
      "collectMethod": null,
      "isRequiredForRenewal": false,
      "expiryCheck": null,
      "renewalTip": null
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null
  },
  {
    "id": "onboard-206",
    "phase": 2,
    "sequence": 6,
    "category": "行政开户",
    "title": "水电煤转名",
    "subtitle": "入住后尽快转名——第一期账单就是地址证明",
    "timeEstimate": "30分钟",
    "urgency": "建议",
    "icon": "utility",
    "applicableTo": {
      "visaTypes": "all",
      "familyStatus": "all",
      "arrivalScenario": [
        "fresh",
        "delayed"
      ],
      "skipIfExisting": [
        "rental"
      ]
    },
    "steps": [
      {
        "seq": 1,
        "title": "确认公用事业供应商",
        "content": "港灯（港岛/南丫岛）/中电（九龙/新界），煤气（全港统一：中华煤气），水务署（全港统一）",
        "type": "info"
      },
      {
        "seq": 2,
        "title": "逐一办理转名",
        "content": "网上/电话/亲临，所需：身份证+租约+按金",
        "type": "action"
      },
      {
        "seq": 3,
        "title": "设定自动转账",
        "content": "转名时同时申请自动转账，省去每月手动缴费",
        "type": "action"
      },
      {
        "seq": 4,
        "title": "保存首期账单",
        "content": "首期水电煤账单是最有力的地址证明",
        "type": "action"
      }
    ],
    "requiredItems": [
      "HK身份证",
      "租约",
      "按金（中电/港灯$300-600，煤气$400，水务署免费）"
    ],
    "officialLinks": [
      {
        "label": "中电",
        "url": "https://www.clp.com.hk"
      },
      {
        "label": "港灯",
        "url": "https://www.hkelectric.com"
      },
      {
        "label": "中华煤气",
        "url": "https://www.towngas.com"
      }
    ],
    "tips": [
      "水务署转名免费",
      "可使用AlipayHK自动付款（覆盖近500商户）",
      "PayMe 2025年7月起支持煤气/港灯/中电/水务署缴费"
    ],
    "pitfalls": [
      "入住后务必尽快转名，否则前业主/租客的水电煤账户产生的费用可能纠缠",
      "自动转账处理需6-8周"
    ],
    "renewalEvidence": {
      "produces": true,
      "docType": "首期水电煤账单",
      "docCategory": "address",
      "collectMethod": "photo",
      "isRequiredForRenewal": true,
      "expiryCheck": null,
      "renewalTip": "水电煤账单是入境处认可的'通常居住'最强证明。务必保存每期账单。"
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null
  },
  {
    "id": "onboard-207",
    "phase": 2,
    "sequence": 7,
    "category": "行政开户",
    "title": "申领公共图书馆卡",
    "subtitle": "免费借书+电子资源——香港公共图书馆体系很强",
    "timeEstimate": "15分钟",
    "urgency": "可选",
    "icon": "library",
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
        "title": "选择申请方式",
        "content": "方式一：经“智方便+”网上申请（即时生效，可凭智能身份证借书）；方式二：网上申请电子账户（仅电子资源）；方式三：亲临图书馆",
        "type": "info"
      },
      {
        "seq": 2,
        "title": "完成申请",
        "content": "网上申请→填表→上载身份证+地址证明，年满18岁即时生效",
        "type": "action"
      }
    ],
    "requiredItems": [
      "HK身份证",
      "地址证明"
    ],
    "officialLinks": [
      {
        "label": "香港公共图书馆",
        "url": "https://www.hkpl.gov.hk"
      }
    ],
    "tips": [
      "每位读者可外借最多10项",
      "借期14天，可续借5次",
      "逾期罚款上限：成人$130"
    ],
    "pitfalls": [],
    "renewalEvidence": {
      "produces": false,
      "docType": null,
      "docCategory": null,
      "collectMethod": null,
      "isRequiredForRenewal": false,
      "expiryCheck": null,
      "renewalTip": null
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null
  }
];
