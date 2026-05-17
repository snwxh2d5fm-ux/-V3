// 住港伴 关卡1: 落地生存 (5项)
module.exports = [
  {
    "id": "onboard-101",
    "phase": 1,
    "sequence": 1,
    "category": "落地生存",
    "title": "购买八达通",
    "subtitle": "香港人的第二张身份证——没有它寸步难行",
    "timeEstimate": "10分钟",
    "urgency": "必修",
    "icon": "card",
    "applicableTo": {
      "visaTypes": "all",
      "familyStatus": "all",
      "arrivalScenario": [
        "fresh"
      ],
      "skipIfExisting": []
    },
    "steps": [
      {
        "seq": 1,
        "title": "找到购买点",
        "content": "机场抵境大堂：MTR客务中心、7-Eleven、Travelex柜台。市区：任意港铁站客务中心、7-Eleven、Circle K。",
        "type": "info"
      },
      {
        "seq": 2,
        "title": "购买成人租用版",
        "content": "售价HK$150：含$50可退还押金+$100储值额。如带小孩：长者/小童租用版HK$70（$50押金+$20储值额）。",
        "type": "action"
      },
      {
        "seq": 3,
        "title": "下载八达通App并绑定",
        "content": "绑定后可手机增值、查阅余额和消费记录。iPhone用户可将实体卡转移至Apple Wallet（转移后实体卡失效）。",
        "type": "action"
      }
    ],
    "requiredItems": [
      "现金HK$150（成人）/ HK$70（小童/长者）"
    ],
    "officialLinks": [
      {
        "label": "八达通官网",
        "url": "https://www.octopus.com.hk"
      }
    ],
    "tips": [
      "机场7-Eleven 24小时营业，凌晨抵港也能买",
      "学生（12-25岁全日制）可申请学生八达通享港铁半价，需2-4周处理",
      "绑定八达通App后可设置信用卡自动增值"
    ],
    "pitfalls": [
      "旅客八达通（HK$39纪念卡）不含储值额，不推荐",
      "转移至Apple Wallet后实体卡失效且不可逆"
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
    "id": "onboard-102",
    "phase": 1,
    "sequence": 2,
    "category": "落地生存",
    "title": "上台电话卡",
    "subtitle": "四大电讯商5G套餐对比——选对一年省上千",
    "timeEstimate": "30分钟",
    "urgency": "必修",
    "icon": "phone",
    "applicableTo": {
      "visaTypes": "all",
      "familyStatus": "all",
      "arrivalScenario": [
        "fresh"
      ],
      "skipIfExisting": []
    },
    "steps": [
      {
        "seq": 1,
        "title": "了解四大电讯商",
        "content": "3HK（$148/月，100GB+中港澳6GB，北上常客首选）；CMHK中国移动（$149/月，100GB+中澳2GB，条软简单免行政费）；CSL（$138-168/月，送Perplexity Pro AI服务）；SmarTone（$179/月，送$1,000手机礼券+爆芒保）。",
        "type": "info"
      },
      {
        "seq": 2,
        "title": "选择套餐并上台",
        "content": "携同香港身份证+地址证明前往电讯商门市。如未有香港身份证，部分电讯商接受护照+入境记录。上台通常需签24-36个月合约。",
        "type": "action"
      },
      {
        "seq": 3,
        "title": "上台后设置",
        "content": "下载电讯商App管理账户。设定自动缴费（绑定信用卡/银行户口）。了解数据用量和超额费用。",
        "type": "action"
      }
    ],
    "requiredItems": [
      "香港身份证（如有）或护照+入境记录",
      "地址证明",
      "现金/信用卡（首期月费+行政费）"
    ],
    "officialLinks": [
      {
        "label": "3HK",
        "url": "https://www.three.com.hk"
      },
      {
        "label": "CMHK",
        "url": "https://www.hk.chinamobile.com"
      },
      {
        "label": "CSL",
        "url": "https://www.hkcsl.com"
      },
      {
        "label": "SmarTone",
        "url": "https://www.smartone.com"
      }
    ],
    "tips": [
      "如上水/粉岭/上环的街边电话卡店买储值卡更便宜但不稳定，建议上台",
      "CMHK中国移动价格亲民、简单均真，适合不想研究条款的用户",
      "经常北上深圳/珠海→3HK；预算有限→CMHK"
    ],
    "pitfalls": [
      "携号转台（MNP）通常比新号码上台多送优惠",
      "合约期内提前解约需支付剩余月份费用",
      "部分优惠属限时推广，实际价格以官网为准"
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
    "id": "onboard-103",
    "phase": 1,
    "sequence": 3,
    "category": "落地生存",
    "title": "开通AlipayHK",
    "subtitle": "香港版支付宝——缴费、搭车、汇款一站搞定",
    "timeEstimate": "15分钟",
    "urgency": "必修",
    "icon": "wallet",
    "applicableTo": {
      "visaTypes": "all",
      "familyStatus": "all",
      "arrivalScenario": [
        "fresh"
      ],
      "skipIfExisting": []
    },
    "steps": [
      {
        "seq": 1,
        "title": "下载并注册",
        "content": "App Store/Google Play搜索「AlipayHK」下载。使用香港手机号注册。如已有内地支付宝，需重新注册香港版（两个独立App）。",
        "type": "action"
      },
      {
        "seq": 2,
        "title": "完成认证",
        "content": "中级认证：上传香港身份证+自拍。中级每日汇款限额HK$7,999。高级认证需额外文件，每日汇款限额HK$2万。",
        "type": "action"
      },
      {
        "seq": 3,
        "title": "绑定缴费账户",
        "content": "搜寻「缴费专区」→选择机构（中电/港灯/煤气/水务署/差饷）→输入账单编号→开启自动付款。覆盖近500个缴费商户。",
        "type": "action"
      }
    ],
    "requiredItems": [
      "香港手机号",
      "香港身份证"
    ],
    "officialLinks": [
      {
        "label": "AlipayHK",
        "url": "https://www.alipayhk.com"
      }
    ],
    "tips": [
      "绑定信用卡缴费可赚积分/回赠",
      "内地消费可直接用AlipayHK支付（汇率自动换算）",
      "跨境汇款至内地银行账户每日限额按认证级别"
    ],
    "pitfalls": [
      "AlipayHK和内地支付宝是两个独立App，不能通用",
      "未完成认证前很多功能受限"
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
    "id": "onboard-104",
    "phase": 1,
    "sequence": 4,
    "category": "落地生存",
    "title": "办理香港身份证（按预约）",
    "subtitle": "抵港后30天内必须办理——按之前预约的时间前往",
    "timeEstimate": "1-2小时",
    "urgency": "必修",
    "icon": "idcard",
    "applicableTo": {
      "visaTypes": "all",
      "familyStatus": "all",
      "arrivalScenario": [
        "fresh"
      ],
      "skipIfExisting": [
        "hkid"
      ]
    },
    "steps": [
      {
        "seq": 1,
        "title": "出发前准备",
        "content": "带齐文件：护照/港澳通行证+签证标签页+入境小白条+预约确认（截图或打印）。如已在关卡0完成了预约，直接按预约时间前往。",
        "type": "checklist"
      },
      {
        "seq": 2,
        "title": "现场办理",
        "content": "按预约时间到达指定入境处办事处→取号→拍照→打指模→领取「申请身份证收据」（临时身份证）。办理过程约30-45分钟。",
        "type": "action"
      },
      {
        "seq": 3,
        "title": "领取正式身份证",
        "content": "办理后约10个工作天可领取正式香港智能身份证。凭收据和身份证明文件在指定日期后前往同一办事处领取。",
        "type": "action"
      }
    ],
    "requiredItems": [
      "护照/港澳通行证",
      "签证标签页",
      "入境小白条",
      "预约确认"
    ],
    "officialLinks": [
      {
        "label": "入境处身份证预约",
        "url": "https://www.gov.hk/icbooking"
      }
    ],
    "tips": [
      "拍照时可以微笑但不能露齿",
      "建议穿深色有领上衣，背景为白色",
      "临时身份证收据也是一份重要文件——保留至领取正式身份证"
    ],
    "pitfalls": [
      "入境后30天内必须申领，逾期可能被检控",
      "如错过预约时间，需重新网上预约"
    ],
    "renewalEvidence": {
      "produces": true,
      "docType": "临时身份证收据",
      "docCategory": "visa",
      "collectMethod": "photo",
      "isRequiredForRenewal": false,
      "expiryCheck": null,
      "renewalTip": "收据证明你已在法定期限内申领身份证，是可选的辅助证据。"
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null
  },
  {
    "id": "onboard-105",
    "phase": 1,
    "sequence": 5,
    "category": "落地生存",
    "title": "下载关键App并完成初始设置",
    "subtitle": "MTR Mobile、Google Maps、WhatsApp——三个App搞定出行+通讯",
    "timeEstimate": "15分钟",
    "urgency": "建议",
    "icon": "download",
    "applicableTo": {
      "visaTypes": "all",
      "familyStatus": "all",
      "arrivalScenario": [
        "fresh"
      ],
      "skipIfExisting": []
    },
    "steps": [
      {
        "seq": 1,
        "title": "出行三件套",
        "content": "MTR Mobile（港铁路线/票价/班次/都会票购买）、Google Maps（香港公共交通规划准确度很高）、Uber/滴滴出行（Call车用）。",
        "type": "action"
      },
      {
        "seq": 2,
        "title": "通讯必备",
        "content": "WhatsApp（香港主流即时通讯工具，几乎所有香港人都用）。下载后绑定香港手机号即可。",
        "type": "action"
      },
      {
        "seq": 3,
        "title": "生活辅助",
        "content": "OpenRice（香港版大众点评，找餐厅看评价）。我的天文台（香港天文台官方天气App，台风/暴雨警告推送）。",
        "type": "info"
      }
    ],
    "requiredItems": [
      "智能手机（剩余存储空间≥1GB）"
    ],
    "officialLinks": [
      {
        "label": "MTR Mobile",
        "url": "https://www.mtr.com.hk/mtrmobile"
      },
      {
        "label": "我的天文台",
        "url": "https://www.hko.gov.hk"
      }
    ],
    "tips": [
      "MTR Mobile可购买电子都会票（$460/40程，平均$11.5/程）",
      "Google Maps的公共交通规划在香港比高德/百度地图更准"
    ],
    "pitfalls": [
      "WhatsApp需手机号验证，建议用香港号注册（工作联系用）",
      "香港的的士App生态较分散，Uber覆盖率最高"
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
  }
];
