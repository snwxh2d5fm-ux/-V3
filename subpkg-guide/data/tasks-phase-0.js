// 住港伴 关卡0: 抵港前准备 (5项)
module.exports = [
  {
    "id": "onboard-001",
    "phase": 0,
    "sequence": 1,
    "category": "抵港前准备",
    "title": "确认签证标签页信息无误",
    "subtitle": "姓名、证件号、有效期，一个错都不能有",
    "timeEstimate": "10分钟",
    "urgency": "必修",
    "icon": "visa",
    "applicableTo": {
      "visaTypes": "all",
      "familyStatus": "all",
      "arrivalScenario": [
        "pre-arrival"
      ],
      "skipIfExisting": []
    },
    "steps": [
      {
        "seq": 1,
        "title": "核对个人信息",
        "content": "检查标签页上的姓名拼音是否与护照/港澳通行证完全一致。检查证件号码、出生日期是否正确。",
        "type": "checklist"
      },
      {
        "seq": 2,
        "title": "核对签证信息",
        "content": "检查签证类别是否正确。检查有效期和逗留期限。注意：签证标签页上的日期格式为DD-MM-YYYY。",
        "type": "checklist"
      },
      {
        "seq": 3,
        "title": "拍照留存",
        "content": "用手机拍下签证标签页正反面，保存到手机相册。这张照片在后续关卡中需要用到。",
        "type": "action"
      }
    ],
    "requiredItems": [
      "签证标签页",
      "护照/港澳通行证"
    ],
    "officialLinks": [
      {
        "label": "入境事务处",
        "url": "https://www.immd.gov.hk"
      }
    ],
    "tips": [
      "如发现信息有误，立即联系入境处更正，不要等到过关时才发现",
      "建议打印一份纸质版随身携带"
    ],
    "pitfalls": [
      "签证标签页上的英文名必须与护照完全一致，包括空格和连字符",
      "逗留期限≠签证有效期，不要混淆"
    ],
    "renewalEvidence": {
      "produces": true,
      "docType": "签证标签页照片",
      "docCategory": "visa",
      "collectMethod": "photo",
      "isRequiredForRenewal": true,
      "expiryCheck": null,
      "renewalTip": "签证标签页是续签时入境处核对身份的基础文件，务必保存清晰照片。"
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null
  },
  {
    "id": "onboard-002",
    "phase": 0,
    "sequence": 2,
    "category": "抵港前准备",
    "title": "准备过关文件包",
    "subtitle": "过关时被卡住就尴尬了——提前备齐",
    "timeEstimate": "15分钟",
    "urgency": "必修",
    "icon": "folder",
    "applicableTo": {
      "visaTypes": "all",
      "familyStatus": "all",
      "arrivalScenario": [
        "pre-arrival"
      ],
      "skipIfExisting": []
    },
    "steps": [
      {
        "seq": 1,
        "title": "整理必备文件",
        "content": "护照/港澳通行证（有效期≥6个月）+ 签证标签页 + 入境小白条（过关时获发，务必保留）。建议准备一个透明文件袋统一收纳。",
        "type": "checklist"
      },
      {
        "seq": 2,
        "title": "准备辅助文件",
        "content": "香港雇佣合约副本（如有）、住宿预订确认（如有）、学位证书/专业资格证书（日后可能用到）。",
        "type": "info"
      },
      {
        "seq": 3,
        "title": "准备现金",
        "content": "建议携带HK$5,000-10,000现金。香港很多地方（街市/茶餐厅/的士）只收现金或八达通。在内地银行提前兑换，汇率更优。",
        "type": "action"
      }
    ],
    "requiredItems": [
      "护照/港澳通行证（有效期≥6个月）",
      "签证标签页",
      "透明文件袋",
      "HK$5,000-10,000现金"
    ],
    "officialLinks": [],
    "tips": [
      "过关时获发的小白条是一张小纸片，极容易丢失——拿到后立刻拍照并放入文件袋",
      "如携带超过HK$12万等值现金/不记名票据，须向海关申报"
    ],
    "pitfalls": [
      "护照有效期不足6个月可能被拒绝入境",
      "港澳通行证上的签注（D签）必须与签证标签页的逗留期限对应"
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
    "id": "onboard-003",
    "phase": 0,
    "sequence": 3,
    "category": "抵港前准备",
    "title": "预约办理香港身份证",
    "subtitle": "先约身份证，再定过关日——同一天办完少跑一趟",
    "timeEstimate": "10分钟",
    "urgency": "必修",
    "icon": "idcard",
    "applicableTo": {
      "visaTypes": "all",
      "familyStatus": "all",
      "arrivalScenario": [
        "pre-arrival"
      ],
      "skipIfExisting": [
        "hkid"
      ]
    },
    "steps": [
      {
        "seq": 1,
        "title": "网上预约",
        "content": "登入入境处网上预约系统（gov.hk/icbooking），选择「申领香港智能身份证」。填写姓名、证件号码、出生日期。",
        "type": "action"
      },
      {
        "seq": 2,
        "title": "选择办理日期——这是关键一步",
        "content": "先定身份证预约日期，再据此安排过关日。最佳策略：预约在过关当天或次日，激活签证+办身份证一趟搞定。湾仔总部最满，九龙（长沙湾/观塘）或新界（火炭/元朗/屯门）更容易约到。每天上午9点释放新名额。",
        "type": "action"
      },
      {
        "seq": 3,
        "title": "根据预约日期反推过关日",
        "content": "确认预约日期后，再安排过关激活签证的日期（建议提前1天或当天）。过关日确定后，依次预订交通、住宿、准备过关文件包。",
        "type": "action"
      },
      {
        "seq": 4,
        "title": "保存预约确认",
        "content": "截图保存预约确认页面（含预约编号、日期、时间、地点）。过关激活签证后按预约时间前往办理。",
        "type": "action"
      }
    ],
    "requiredItems": [
      "护照/港澳通行证号码"
    ],
    "officialLinks": [
      {
        "label": "入境处网上预约",
        "url": "https://www.gov.hk/icbooking"
      }
    ],
    "tips": [
      "核心策略：先约身份证→再定过关日→最后订交通住宿。一趟搞定激活+办证",
      "每天上午9点释放新的预约名额，热门时段竞争激烈",
      "火炭办事处通常比湾仔容易约到",
      "预约可更改两次，如需改期尽早操作"
    ],
    "pitfalls": [
      "不要先订机票酒店再约身份证——预约日期可能不理想，到时候改机票成本高",
      "入境后30天内必须申领身份证，逾期可能被检控",
      "网上预约需输入在港联系电话，可先填酒店/朋友电话"
    ],
    "renewalEvidence": {
      "produces": true,
      "docType": "预约确认截图",
      "docCategory": "visa",
      "collectMethod": "photo",
      "isRequiredForRenewal": false,
      "expiryCheck": null,
      "renewalTip": "预约确认不是必须的续签材料，但保留可作为你抵港后及时办理行政手续的时间证据。"
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null
  },
  {
    "id": "onboard-004",
    "phase": 0,
    "sequence": 4,
    "category": "抵港前准备",
    "title": "下载必备App",
    "subtitle": "到了香港再下载可能来不及——提前装好",
    "timeEstimate": "15分钟",
    "urgency": "建议",
    "icon": "download",
    "applicableTo": {
      "visaTypes": "all",
      "familyStatus": "all",
      "arrivalScenario": [
        "pre-arrival"
      ],
      "skipIfExisting": []
    },
    "steps": [
      {
        "seq": 1,
        "title": "交通出行类",
        "content": "MTR Mobile（港铁路线/票价/班次）、Citybus/九巴App（巴士路线/到站时间）、Uber/滴滴出行（叫车）。高德地图在香港可用但精度不如Google Maps。",
        "type": "action"
      },
      {
        "seq": 2,
        "title": "支付与生活类",
        "content": "AlipayHK（香港支付宝）、八达通App（管理八达通卡）、PayMe（汇丰旗下的电子钱包）。内地支付宝/微信支付在香港部分商户可用但不全面。",
        "type": "action"
      },
      {
        "seq": 3,
        "title": "政府与医疗类",
        "content": "HA Go（医管局一站式医疗App）、智方便iAM Smart（政府数码身份认证）、My SmartPLAY（康文署运动场地预约）。",
        "type": "action"
      },
      {
        "seq": 4,
        "title": "资讯与社交类",
        "content": "WhatsApp（香港主流即时通讯工具）。香港01/明报/经济日报（了解本地新闻）。OpenRice（香港版大众点评）。",
        "type": "info"
      }
    ],
    "requiredItems": [
      "智能手机（剩余存储空间≥2GB）",
      "Apple ID / Google Play账号"
    ],
    "officialLinks": [
      {
        "label": "MTR Mobile",
        "url": "https://www.mtr.com.hk/mtrmobile"
      },
      {
        "label": "HA Go",
        "url": "https://www.ha.org.hk"
      }
    ],
    "tips": [
      "AlipayHK需香港手机号注册，抵港后才能完成——但可以先下载",
      "智方便+需2018年11月后签发的新智能身份证+NFC手机才能登记"
    ],
    "pitfalls": [
      "内地手机号注册的Apple ID可能无法下载部分香港App——建议提前准备香港Apple ID",
      "香港的App生态以iOS为主，部分App的Android版本功能较少"
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
    "id": "onboard-005",
    "phase": 0,
    "sequence": 5,
    "category": "抵港前准备",
    "title": "了解抵港当日路线",
    "subtitle": "拖着行李箱迷路，第一天就崩溃——提前规划",
    "timeEstimate": "20分钟",
    "urgency": "建议",
    "icon": "map",
    "applicableTo": {
      "visaTypes": "all",
      "familyStatus": "all",
      "arrivalScenario": [
        "pre-arrival"
      ],
      "skipIfExisting": []
    },
    "steps": [
      {
        "seq": 1,
        "title": "确定抵达口岸",
        "content": "机场：香港国际机场（最常用）。高铁：西九龙站（内地高铁直达）。陆路口岸：深圳湾/罗湖/落马洲/港珠澳大桥。",
        "type": "info"
      },
      {
        "seq": 2,
        "title": "规划从口岸到住处的交通",
        "content": "机场→市区：机场快线（24分钟到中环，HK$115）/ 机场巴士（较便宜但较慢，HK$20-40）/ 的士（约HK$250-400）。高铁西九龙→市区：步行至柯士甸/九龙站转港铁。",
        "type": "action"
      },
      {
        "seq": 3,
        "title": "准备抵达当日的通讯方案",
        "content": "机场可以买八达通（MTR客务中心/7-Eleven）。抵达后第一件事——买电话卡或连机场WiFi。机场有免费WiFi（限时30分钟）。",
        "type": "info"
      }
    ],
    "requiredItems": [
      "手机（提前下载离线地图/截图路线）",
      "少量港币现金（买车票/八达通用）"
    ],
    "officialLinks": [
      {
        "label": "香港机场交通",
        "url": "https://www.hongkongairport.com"
      },
      {
        "label": "MTR港铁路线图",
        "url": "https://www.mtr.com.hk"
      }
    ],
    "tips": [
      "如果住在新界（屯门/元朗/上水），深圳湾口岸最方便",
      "机场快线多人同行有团体票优惠",
      "Google Maps在香港的公共交通规划准确度很高"
    ],
    "pitfalls": [
      "的士司机可能不认识新界偏远地址——提前准备中英文地址写在纸上",
      "高铁到西九龙站后是「一地两检」，过关后就在香港境内了"
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
