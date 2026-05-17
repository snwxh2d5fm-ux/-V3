// 住港伴 关卡4: 出行融入 (7项)
module.exports = [
  {
    "id": "onboard-401",
    "phase": 4,
    "sequence": 1,
    "category": "出行融入",
    "title": "免试换领香港驾照",
    "subtitle": "内地驾照直接换——无需考试",
    "timeEstimate": "1-2小时",
    "urgency": "建议",
    "icon": "car",
    "applicableTo": {
      "visaTypes": "all",
      "familyStatus": "all",
      "arrivalScenario": [
        "fresh",
        "delayed"
      ],
      "skipIfExisting": [
        "driving-license"
      ]
    },
    "steps": [
      {
        "seq": 1,
        "title": "检查申请资格",
        "content": "年满18岁+持有内地正式驾照（仍有效或过期不超3年）+内地居留不少于6月或驾照已签发≥5年",
        "type": "info"
      },
      {
        "seq": 2,
        "title": "网上预约",
        "content": "运输署全面网上预约（2026年3月起取消即日筹），每天550名额，每工作日下午5时更新未来4周名额，九龙/观塘/沙田专责处理内地驾照",
        "type": "action"
      },
      {
        "seq": 3,
        "title": "准备文件",
        "content": "TD63A申请表+HK身份证+内地驾照正本+地址证明（近3月）+出入境记录（证明内地居留≥6月）",
        "type": "action"
      },
      {
        "seq": 4,
        "title": "亲临牌照事务处",
        "content": "按预约时间前往→提交→费用约HK$900→一般即日获批",
        "type": "action"
      }
    ],
    "requiredItems": [
      "HK身份证",
      "内地驾照正本+副本",
      "地址证明（近3月）",
      "TD63A申请表",
      "HK$900",
      "出入境记录证明"
    ],
    "officialLinks": [
      {
        "label": "运输署网上预约",
        "url": "https://www.gov.hk/tc/residents/transport/drivinglicense/formtd63a.htm"
      }
    ],
    "tips": [
      "费用$900（60岁以下，10年有效）",
      "可授权代理人递交",
      "2025年9月起经免试签发驾照档号以DI为字首"
    ],
    "pitfalls": [
      "不接受邮寄/投递申请",
      "回乡证和内地居住证不视为旅行证件（不能用于免试换领）",
      "70岁以上需TD256体格检验证明书"
    ],
    "renewalEvidence": {
      "produces": true,
      "docType": "香港驾照副本",
      "docCategory": "auxiliary",
      "collectMethod": "photo",
      "isRequiredForRenewal": false,
      "expiryCheck": null,
      "renewalTip": "驾照是辅助性的在港生活证明文件。"
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null
  },
  {
    "id": "onboard-402",
    "phase": 4,
    "sequence": 2,
    "category": "出行融入",
    "title": "熟悉港铁/巴士/的士App",
    "subtitle": "香港公共交通世界第一——但你要知道怎么用",
    "timeEstimate": "30分钟",
    "urgency": "必修",
    "icon": "bus",
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
        "title": "港铁",
        "content": "下载MTR Mobile→了解路线/票价/班次→都会票（$460/40程，平均$11.5/程）→早晨折扣（平日7:15-8:15出闸75折）→全月通",
        "type": "info"
      },
      {
        "seq": 2,
        "title": "巴士",
        "content": "下载Citybus/九巴App→查路线/到站时间，公共交通费用补贴：月支出超出$500部分可获1/3补贴（上限$400）",
        "type": "info"
      },
      {
        "seq": 3,
        "title": "的士/叫车",
        "content": "Uber（覆盖率最高）/滴滴（优惠力度大）/HKTaxi（老牌的士App）/高德打车",
        "type": "info"
      }
    ],
    "requiredItems": [
      "八达通",
      "智能手机已开通香港上网"
    ],
    "officialLinks": [
      {
        "label": "MTR Mobile",
        "url": "https://www.mtr.com.hk/mtrmobile"
      }
    ],
    "tips": [
      "都会票2025年5月起可在MTR Mobile App购买电子版",
      "八达通+AlipayHK已覆盖绝大部分交通工具",
      "隧道已采用HKeToll电子收费"
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
  },
  {
    "id": "onboard-403",
    "phase": 4,
    "sequence": 3,
    "category": "出行融入",
    "title": "预约运动场地（首次）",
    "subtitle": "羽毛球$37-59/小时，健身室月票$180——做了SmartPLAY就要用",
    "timeEstimate": "15分钟",
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
        "title": "热门设施价格",
        "content": "羽毛球场$37-59/hr，网球场$42-148/hr，健身室$14/hr或$180月票，游泳池$17-19/节",
        "type": "info"
      },
      {
        "seq": 2,
        "title": "完成首次预约",
        "content": "SmartPLAY→选择设施→选择场地→选择时间→付款→到场使用",
        "type": "action"
      }
    ],
    "requiredItems": [
      "SmartPLAY登记"
    ],
    "officialLinks": [
      {
        "label": "SmartPLAY",
        "url": "https://smartplay.lcsd.gov.hk"
      }
    ],
    "tips": [
      "繁忙时间（平日18:00后+周末13:00后）难抢",
      "健身室需先完成'正确使用健身室设施简介会'",
      "游泳池无需预约，开放时段前排队"
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
  },
  {
    "id": "onboard-404",
    "phase": 4,
    "sequence": 4,
    "category": "出行融入",
    "title": "首次使用HA Go预约门诊",
    "subtitle": "体验一次HA Go挂号——下次真的生病时不慌",
    "timeEstimate": "1-2小时",
    "urgency": "建议",
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
        "title": "预约普通科门诊",
        "content": "HA Go→预约家庭医学诊所→选择就近诊所→接纳可用时段（可预约未来24小时）",
        "type": "action"
      },
      {
        "seq": 2,
        "title": "完成一次就诊",
        "content": "提前15-30min到→用八达通/现金/HA Go缴费→等候叫号→诊症→取药，费用约$150（药每款$5）",
        "type": "action"
      }
    ],
    "requiredItems": [
      "HA Go已登记",
      "八达通/现金",
      "HK身份证"
    ],
    "officialLinks": [
      {
        "label": "HA Go",
        "url": "https://www.ha.org.hk/hago"
      }
    ],
    "tips": [
      "抢号秘诀：每小时的29分和59分刷新",
      "首次使用可在非紧急情况下预约→熟悉流程",
      "就诊后可要求开具病假纸"
    ],
    "pitfalls": [
      "迟到→可能需重新预约",
      "两个月内累计3次失约→失去电话/App预约资格"
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
    "id": "onboard-405",
    "phase": 4,
    "sequence": 5,
    "category": "出行融入",
    "title": "了解社区活动/兴趣班",
    "subtitle": "融入香港生活——从找到一个兴趣班开始",
    "timeEstimate": "30分钟",
    "urgency": "建议",
    "icon": "people",
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
        "title": "寻找渠道",
        "content": "区议会网页/康文署社区活动/社区会堂/宗教团体（教会/佛堂）/NGO（明爱/救世军/东华三院）",
        "type": "info"
      },
      {
        "seq": 2,
        "title": "选择并报名",
        "content": "按兴趣（运动/音乐/手工艺/语言班/义工）选择1-2项报名，费用通常很低（政府资助）",
        "type": "action"
      }
    ],
    "requiredItems": [],
    "officialLinks": [],
    "tips": [
      "康文署社区康乐活动每月更新",
      "兴趣班是认识本地朋友的最快方式",
      "很多NGO提供免费广东话班"
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
  },
  {
    "id": "onboard-406",
    "phase": 4,
    "sequence": 6,
    "category": "出行融入",
    "title": "加入本地社交群组",
    "subtitle": "跑团/行山群/教会/义工——香港人是这样交朋友的",
    "timeEstimate": "30分钟",
    "urgency": "建议",
    "icon": "group",
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
        "title": "寻找群组",
        "content": "Facebook搜索[区名]跑团/[区名]行山群，Meetup.com搜索“Hong Kong hiking/board games/language exchange”，教会/佛堂/清真寺",
        "type": "info"
      },
      {
        "seq": 2,
        "title": "参加首次活动",
        "content": "选择1-2个群组参加首次活动，建议从运动类开始（低社交压力）",
        "type": "action"
      }
    ],
    "requiredItems": [],
    "officialLinks": [],
    "tips": [
      "香港行山文化极发达，行山群是最容易融入的社交圈",
      "Meetup上有很多Expats和Local混合的群组",
      "不要害羞——香港人比想象中友好"
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
  },
  {
    "id": "onboard-408",
    "phase": 4,
    "sequence": 7,
    "category": "出行融入",
    "title": "了解紧急求助渠道",
    "subtitle": "999/1823/消防/救护——紧急时不慌",
    "timeEstimate": "10分钟",
    "urgency": "必修",
    "icon": "alert",
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
        "title": "紧急求助",
        "content": "999（警察/消防/救护，三合一共用），112（手机国际紧急号码在香港也可用）",
        "type": "info"
      },
      {
        "seq": 2,
        "title": "非紧急求助",
        "content": "1823（政府热线24小时，处理非紧急查询和投诉），各区警署电话，医院管理局查询2300 6555",
        "type": "info"
      }
    ],
    "requiredItems": [
      "已开通香港上网的智能手机"
    ],
    "officialLinks": [],
    "tips": [
      "把紧急联系人设为手机快捷拨号",
      "记录最近医院/警署/消防局的地址",
      "如在偏远地区行山→下载'郊野公园远足安全App'"
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
