// 住港伴 关卡3: 安居乐业 (14项)
module.exports = [
  {
    "id": "onboard-301",
    "phase": 3,
    "sequence": 2,
    "category": "安居乐业",
    "title": "签署正式租约并打厘印",
    "subtitle": "租约不打厘印=法律上无效——30天内必须做",
    "timeEstimate": "2-3小时",
    "urgency": "必修",
    "icon": "home",
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
        "title": "签署正式租约",
        "content": "确认条款：一年死约一年生约/租金是否全包/家电清单/维修责任/宠物/免租期，支付两按一上（2月按金+1月上期）",
        "type": "action"
      },
      {
        "seq": 2,
        "title": "30日内打厘印",
        "content": "签正约后30日内到税务局打厘印（网上可办），印花税率：1年内0.25%/1-3年0.5%/3年以上1%",
        "type": "action"
      },
      {
        "seq": 3,
        "title": "确认业主递交CR109表格",
        "content": "提醒业主递交至差饷物业估价署",
        "type": "action"
      },
      {
        "seq": 4,
        "title": "支付全部首期费用",
        "content": "以月租$15,000为例→按金$30,000+首月$15,000+代理佣金$7,500+印花税~$450=~$52,950",
        "type": "info"
      },
      {
        "seq": 5,
        "title": "保存所有文件",
        "content": "租约+厘印证明+CR109回执",
        "type": "action"
      }
    ],
    "requiredItems": [
      "HK身份证",
      "现金/支票（按金+首月租金+佣金+印花税）"
    ],
    "officialLinks": [
      {
        "label": "税务局印花税",
        "url": "https://www.ird.gov.hk"
      }
    ],
    "tips": [
      "打厘印可在网上办理（ird.gov.hk）",
      "逾期打厘印罚款为印花税2-10倍",
      "代理佣金通常为半月租（业主和租客各付一半）"
    ],
    "pitfalls": [
      "未打厘印的租约在法律上不可强制执行",
      "如业主未通知银行擅自出租'自住'物业→断供→银行有权收楼→租客可能不获赔偿",
      "睇楼前必须签署睇楼纸（有效期3月）"
    ],
    "renewalEvidence": {
      "produces": true,
      "docType": "已打厘印租约",
      "docCategory": "address",
      "collectMethod": "photo",
      "isRequiredForRenewal": true,
      "expiryCheck": null,
      "renewalTip": "已打厘印的租约是续签时'通常居住'的最核心证明文件。务必同时保存厘印缴费记录。"
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null
  },
  {
    "id": "onboard-302",
    "phase": 3,
    "sequence": 3,
    "category": "安居乐业",
    "title": "收楼验收拍照存档",
    "subtitle": "退租时保障押金全退——现在不拍以后说不清",
    "timeEstimate": "1小时",
    "urgency": "必修",
    "icon": "camera",
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
        "title": "逐项检查",
        "content": "水压/电掣/门窗/天花漏水痕迹/冷气制冷/手机信号/隔音/白蚁痕迹",
        "type": "action"
      },
      {
        "seq": 2,
        "title": "拍照录影存档",
        "content": "全屋各角落拍照，录影一段全景视频，重点拍已有损坏/瑕疵处",
        "type": "action"
      },
      {
        "seq": 3,
        "title": "签署单位状况清单",
        "content": "与业主签署并双方各持一份，抄录水/电/煤表读数",
        "type": "action"
      }
    ],
    "requiredItems": [
      "手机（拍照/录影）",
      "纸笔（记录表读数）"
    ],
    "officialLinks": [],
    "tips": [
      "建议白天和晚上分别视察了解不同时段噪音",
      "拍照时在照片上标注日期",
      "如有条件，聘请验楼师做专业验收（数千元）"
    ],
    "pitfalls": [
      "退租时业主可能以'你入住时就有'的损坏为由扣按金→现在拍照=最强证据"
    ],
    "renewalEvidence": {
      "produces": true,
      "docType": "单位状况清单+照片",
      "docCategory": "address",
      "collectMethod": "photo",
      "isRequiredForRenewal": false,
      "expiryCheck": null,
      "renewalTip": "收楼验收记录是辅助性的居住证明，可作为'通常居住'的补充证据。"
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null
  },
  {
    "id": "onboard-303",
    "phase": 3,
    "sequence": 4,
    "category": "安居乐业",
    "title": "购买家居保险",
    "subtitle": "保障个人财物+第三方责任——月均$50-100很划算",
    "timeEstimate": "30分钟",
    "urgency": "建议",
    "icon": "shield",
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
        "title": "了解保障范围",
        "content": "家居财物（家私/电器/衣物）+个人责任（第三者受伤/财物损毁）+临时居所（意外不能居住时）+搬屋保障",
        "type": "info"
      },
      {
        "seq": 2,
        "title": "区分火险vs家居保险",
        "content": "火险=保障楼宇结构（业主/银行强制），家居保险=保障财物+责任（租客和业主均可）",
        "type": "info"
      },
      {
        "seq": 3,
        "title": "选购并投保",
        "content": "租客购买家居财物+个人责任即可；年保费约$500-2,000",
        "type": "action"
      }
    ],
    "requiredItems": [
      "HK身份证",
      "地址证明"
    ],
    "officialLinks": [],
    "tips": [
      "贵重物品（珠宝/名表）通常有单件赔偿上限",
      "索偿：事发后30天内通知+保留损毁物品+保留单据"
    ],
    "pitfalls": [],
    "renewalEvidence": {
      "produces": true,
      "docType": "家居保险保单",
      "docCategory": "address",
      "collectMethod": "photo",
      "isRequiredForRenewal": false,
      "expiryCheck": null,
      "renewalTip": "家居保险保单是辅助性的居住证明。"
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null
  },
  {
    "id": "onboard-304",
    "phase": 3,
    "sequence": 5,
    "category": "安居乐业",
    "title": "安装家居宽频",
    "subtitle": "三大供应商1000M光纤对比——最平$68/月",
    "timeEstimate": "30分钟",
    "urgency": "必修",
    "icon": "wifi",
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
        "title": "三大供应商对比",
        "content": "网上行Netvigator（$118-138私楼，送Now TV+Perplexity Pro）/香港宽频HKBN（$88-149，送Global SIM+Disney+）/有线宽频i-Cable（$68-88全港最平）",
        "type": "info"
      },
      {
        "seq": 2,
        "title": "选择并签约",
        "content": "到供应商官网输入地址查询报价→在线签约→预约上门安装",
        "type": "action"
      },
      {
        "seq": 3,
        "title": "安装当天",
        "content": "确保有人在家，安装约1-2小时",
        "type": "action"
      }
    ],
    "requiredItems": [
      "HK身份证",
      "地址证明"
    ],
    "officialLinks": [
      {
        "label": "Netvigator",
        "url": "https://www.netvigator.com"
      },
      {
        "label": "HKBN",
        "url": "https://www.hkbn.net"
      },
      {
        "label": "i-Cable",
        "url": "https://www.i-cable.com"
      }
    ],
    "tips": [
      "旧约到期前3-6月开始格价",
      "HKBN推荐人+新客户各获$400回赠",
      "Netvigator网络最稳定（Ookla 2025第1）"
    ],
    "pitfalls": [
      "实际月费因屋苑而异，建议直接到官网查",
      "i-Cable网上有用户反映'难cut台'",
      "合约期24-36月，中途搬家可转移但要重新签约"
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
    "id": "onboard-305",
    "phase": 3,
    "sequence": 6,
    "category": "安居乐业",
    "title": "购买必要家电/家私",
    "subtitle": "新家必需品清单——别买多了也别漏了",
    "timeEstimate": "1-2小时",
    "urgency": "建议",
    "icon": "cart",
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
        "title": "必需品分级清单",
        "content": "第一优先（马上要）：床褥+枕头+被子/冰箱/洗衣机/煮食炉/热水炉；第二优先（1周内）：饭桌+椅/衣柜/窗帘；第三优先（慢慢添）：沙发/电视/书桌",
        "type": "info"
      },
      {
        "seq": 2,
        "title": "购买渠道",
        "content": "大型连锁（宜家/实惠/日本城）/网购（Carousell二手/淘宝集运）/街坊店",
        "type": "info"
      }
    ],
    "requiredItems": [
      "现金/信用卡"
    ],
    "officialLinks": [],
    "tips": [
      "Carousell可淘到低至1折的二手名牌家私",
      "宜家送货+安装约$300-800",
      "淘宝集运至香港约7-14天，$10-20/kg"
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
    "id": "onboard-306",
    "phase": 3,
    "sequence": 7,
    "category": "安居乐业",
    "title": "熟悉周边环境",
    "subtitle": "找到最近的超市/街市/诊所/药房/银行/邮局",
    "timeEstimate": "1-2小时",
    "urgency": "必修",
    "icon": "map",
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
        "title": "标记关键地点",
        "content": "用Google Maps标记：最近超市（百佳/惠康/fusion）/街市/24h便利店/诊所/药房/银行ATM/邮局/港铁站/巴士站",
        "type": "action"
      },
      {
        "seq": 2,
        "title": "实地走一圈",
        "content": "花1-2小时步行熟悉周边，注意：药店（白底红十字logo≠有药剂师，绿色十字=政府注册药房）",
        "type": "action"
      },
      {
        "seq": 3,
        "title": "加入社区群组",
        "content": "搜索居住区/屋苑的WhatsApp群组或Facebook群组，了解邻里资讯",
        "type": "info"
      }
    ],
    "requiredItems": [
      "智能手机（已开通香港上网）"
    ],
    "officialLinks": [],
    "tips": [
      "香港街市通常比超市便宜20-30%",
      "万宁/屈臣氏有药剂师",
      "熟悉至少两家24h诊所的地址"
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
    "id": "onboard-307",
    "phase": 3,
    "sequence": 8,
    "category": "安居乐业",
    "title": "首次搬家收尾工作",
    "subtitle": "改地址+清理旧居+入伙——72小时内搞定",
    "timeEstimate": "2-3小时",
    "urgency": "建议",
    "icon": "truck",
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
        "title": "更改地址清单",
        "content": "银行/保险/入境处/运输署/香港邮政（可申请邮件转递服务，6个月约$200）",
        "type": "info"
      },
      {
        "seq": 2,
        "title": "入伙后72小时",
        "content": "完成所有地址更改手续+拆箱归位（优先厨房及睡房）+检查搬屋损坏（有问题即时联络搬屋公司）",
        "type": "action"
      },
      {
        "seq": 3,
        "title": "搬屋费用参考",
        "content": "全包价$4,500-16,000/按件$6起/按车$5,300-8,000，自助Lalamove约$400-600",
        "type": "info"
      }
    ],
    "requiredItems": [
      "新地址证明",
      "已打厘印租约"
    ],
    "officialLinks": [
      {
        "label": "香港邮政邮件转递",
        "url": "https://www.hongkongpost.hk"
      }
    ],
    "tips": [
      "避开周末和吉日搬屋更便宜",
      "香港邮政'邮件转递服务'可把旧地址的信转去新地址",
      "搬屋公司格价差距可达4倍→多比较"
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
    "id": "onboard-300",
    "phase": 3,
    "sequence": 0,
    "category": "安居乐业",
    "title": "完成找房向导",
    "subtitle": "先想清楚住哪个区，再看具体租/买房",
    "timeEstimate": "10分钟",
    "urgency": "必修",
    "icon": "compass",
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
        "title": "回答三个问题",
        "content": "预算(5档:$10k-15k/$15k-25k/$25k-40k/$40k-60k/$60k+)/工作在哪区(港岛/九龙/新界/远程)/有无学龄儿童(有/无)",
        "type": "info"
      },
      {
        "seq": 2,
        "title": "查看推荐区域",
        "content": "系统根据答案匹配3-5个最适合的居住区，每个区显示呎租+通勤时间+校网排名+社区特点",
        "type": "info"
      }
    ],
    "tips": [
      "完成找房向导后自动解锁onboard-301~307任务",
      "如不确定预算，先了解各区租金行情再回来填"
    ],
    "renewalEvidence": {
      "produces": false
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null
  },
  {
    "id": "onboard-308",
    "phase": 3,
    "sequence": 9,
    "category": "安居乐业",
    "title": "了解购房全流程",
    "subtitle": "2024撤辣后内地人买房和港人一样税",
    "timeEstimate": "20分钟",
    "urgency": "必修",
    "icon": "home",
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
        "title": "撤辣政策",
        "content": "2024年2月BSD/SSD/NRSD全面撤销，内地/海外人士=香港永久居民印花税率，压力测试已暂停",
        "type": "info"
      },
      {
        "seq": 2,
        "title": "购房十步流程",
        "content": "财务评估→预批按揭→搵楼睇楼→查册出价→签临约(细订3-5%)→正式申请按揭→签正约(14天，大订10%)→银行放款(约3月)→收楼验楼",
        "type": "info"
      },
      {
        "seq": 3,
        "title": "置业杂费",
        "content": "代理佣金约1%+律师费0.1-0.2%+按揭保费(首置35%折扣)+火险/管理费+装修/家私",
        "type": "info"
      }
    ],
    "tips": [
      "通过优才/高才/专才/IANG购楼可'先免后徵'",
      "按揭可贷90%(楼价≤$1000万首置自住)",
      "内地/海外入息可申请按揭(需3月入息证明)"
    ],
    "renewalEvidence": {
      "produces": true,
      "docType": "临时买卖合约(细订)",
      "docCategory": "address",
      "collectMethod": "photo",
      "isRequiredForRenewal": true,
      "renewalTip": "临约证明你已启动购房程序。最终成交后保存正约+印花税证明。"
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null
  },
  {
    "id": "onboard-309",
    "phase": 3,
    "sequence": 10,
    "category": "安居乐业",
    "title": "计算印花税与按揭成数",
    "subtitle": "掌握最新税率才能算出真实预算",
    "timeEstimate": "15分钟",
    "urgency": "必修",
    "icon": "calculator",
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
        "title": "从价印花税阶梯",
        "content": "$300万以下$100/$300-450万1.5%/$450-600万2.25%/$600-900万3%/$900-2000万3.75%/$2000万-1亿4.25%/$1亿+6.5%",
        "type": "info"
      },
      {
        "seq": 2,
        "title": "按揭成数速查",
        "content": "$1000万以下→9成(首置+自住)/$1000-1125万→8-9成(上限$900万)/$1125-1500万→8成/$1500万+→7成",
        "type": "info"
      },
      {
        "seq": 3,
        "title": "先免后徵(NPAO)",
        "content": "优才/高才/专才/IANG人士购楼按首置税率缴付，若最终未成永居须补缴税款",
        "type": "info"
      }
    ],
    "tips": [],
    "renewalEvidence": {
      "produces": true,
      "docType": "印花税缴款证明",
      "docCategory": "address",
      "collectMethod": "photo",
      "isRequiredForRenewal": true
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null
  },
  {
    "id": "onboard-310",
    "phase": 3,
    "sequence": 11,
    "category": "安居乐业",
    "title": "委任律师+签署临时买卖合约",
    "subtitle": "临约具法律约束力，签前一定确认清楚",
    "timeEstimate": "30分钟",
    "urgency": "必修",
    "icon": "file-sign",
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
        "title": "签临约前准备",
        "content": "已取得银行预批按揭(约2月)，已查土地注册处(iris.gov.hk)确保业权清晰，临约具法律约束力",
        "type": "info"
      },
      {
        "seq": 2,
        "title": "支付细订",
        "content": "细订=楼价3-5%，任何一方悔约→对方没收订金+悔约方付双方代理佣金",
        "type": "action"
      },
      {
        "seq": 3,
        "title": "聘律师处理",
        "content": "律师负责查契+准备正式合约+按揭文件，费用约楼价0.1-0.2%",
        "type": "info"
      }
    ],
    "tips": [],
    "renewalEvidence": {
      "produces": true,
      "docType": "临时买卖合约",
      "docCategory": "address",
      "collectMethod": "photo",
      "isRequiredForRenewal": true
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null
  },
  {
    "id": "onboard-311",
    "phase": 3,
    "sequence": 12,
    "category": "安居乐业",
    "title": "申请按揭+银行估值",
    "subtitle": "比较多家银行利率，现在实际年息低至约3.25%",
    "timeEstimate": "30分钟",
    "urgency": "必修",
    "icon": "bank",
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
        "title": "正式申请按揭",
        "content": "带临约+入息/资产证明向银行申请，比较利率，实际年息约3.25%(H+1.3%,P-2%封顶，最长30年)",
        "type": "action"
      },
      {
        "seq": 2,
        "title": "估值与批核",
        "content": "银行安排估值师上门，估值不足需补差价，内地/海外入息需3月证明(受薪)/6月+税单(自雇)",
        "type": "info"
      },
      {
        "seq": 3,
        "title": "按揭保险",
        "content": "首置通常有35%折扣，资产审批方式(无稳定入息)最高贷5成",
        "type": "info"
      }
    ],
    "tips": [],
    "renewalEvidence": {
      "produces": true,
      "docType": "按揭批核函",
      "docCategory": "employment",
      "collectMethod": "photo",
      "isRequiredForRenewal": true
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null
  },
  {
    "id": "onboard-312",
    "phase": 3,
    "sequence": 13,
    "category": "安居乐业",
    "title": "成交收楼",
    "subtitle": "签正约+放款+验楼三步走完购房流程",
    "timeEstimate": "2小时",
    "urgency": "必修",
    "icon": "home-check",
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
        "title": "签正式合约",
        "content": "临约后约14天内，支付大订至合计约楼价10%，确定成交日期(一般约3月后)",
        "type": "action"
      },
      {
        "seq": 2,
        "title": "成交当日",
        "content": "律师安排文件签署+银行放款，同日领取钥匙",
        "type": "action"
      },
      {
        "seq": 3,
        "title": "收楼验收",
        "content": "可聘请验楼师检查(约数千元)，检查墙身/地板/门窗/水电/冷气/漏水，拍照存档",
        "type": "action"
      }
    ],
    "tips": [],
    "renewalEvidence": {
      "produces": true,
      "docType": "正式买卖合约+成交证明",
      "docCategory": "address",
      "collectMethod": "photo",
      "isRequiredForRenewal": true,
      "renewalTip": "买卖合约+印花税证明是购房路径的住址核心证明文件。续签时与水电煤账单配合使用。"
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null
  },
  {
    "id": "onboard-313",
    "phase": 3,
    "sequence": 1,
    "category": "安居乐业",
    "title": "找房全攻略：在哪找、怎么挑、如何避坑",
    "subtitle": "房源平台/中介筛选/问题房排查一站式指南",
    "timeEstimate": "20分钟",
    "urgency": "建议",
    "icon": "search",
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
        "title": "三大房源平台",
        "content": "28Hse（全港最大，房源最多，支持地图搜房）\nHouse730（中原/美联背书，Agent直联）\nSquarefoot（英文界面，外籍/高端房源多）\n辅助：Carousell（转租/合租）、Facebook群组",
        "type": "info"
      },
      {
        "seq": 2,
        "title": "筛选靠谱中介（5步法）",
        "content": "①查牌：地产代理监管局eaa.org.hk查中介牌照\n②看评价：Google Maps查代理公司评分\n③实地接触：靠谱中介主动告知单位缺点\n④收费透明：佣金通常半月租，拒绝隐形收费\n⑤红线：要求私下转账/不签睇楼纸/催交定金=立即换人",
        "type": "action"
      },
      {
        "seq": 3,
        "title": "睇楼必查清单",
        "content": "水电：开水龙头测水压、冲马桶、开热水器\n电器：冷气制冷、抽油烟机、洗衣机运转\n门窗：开关顺畅度、锁完好、隔音效果\n墙壁天花：水渍/发霉/裂纹（特别注意厕所天花板）\n手机信号：屋内各角落测4G/5G信号\n邻里环境：走廊整洁度、楼下噪音、垃圾房位置\n白蚁痕迹：木质家具/门框有无粉末/小孔",
        "type": "checklist"
      },
      {
        "seq": 4,
        "title": "问题房红线（看到就跑）",
        "content": "🚩凶宅：property.hk查该地址历史\n🚩漏水房：天花有水渍/墙身发霉/厕所异味\n🚩违建房：阳台被封/间隔改动=可能被清拆\n🚩业主财困：银行断供中的物业=随时被收楼\n🚩噪音房：邻近马路/铁路/装修中/楼上为幼儿园",
        "type": "info"
      },
      {
        "seq": 5,
        "title": "签约前最后确认",
        "content": "确认租约条款：死约/生约、免租期(通常3-7天)、维修责任、宠物条款\n确认已打厘印（法律效力）\n确认业主已递交CR109表格\n抄录水/电/煤气表读数\n拍照留底：全屋各角落+已有损坏处",
        "type": "checklist"
      }
    ],
    "officialLinks": [
      {
        "label": "28Hse",
        "url": "https://www.28hse.com"
      },
      {
        "label": "地产代理监管局",
        "url": "https://www.eaa.org.hk"
      },
      {
        "label": "地产资讯网(查凶宅)",
        "url": "https://www.property.hk"
      }
    ],
    "tips": [
      "睇楼建议白天+晚上各去一次（白天看采光，晚上看噪音）",
      "同一房源不同中介报价可能差$500-1000/月，多平台对比",
      "签约前到土地注册处iris.gov.hk查册确认业主身份",
      "免租期从签约日起算，不是从入住日起算"
    ],
    "pitfalls": [
      "睇楼前必须签睇楼纸（有效期3个月），否则同一单位找其他中介可能被追佣",
      "口头承诺不算数——所有条件必须写进租约",
      "业主未通知银行擅自出租自住物业→断供→银行收楼→租客不获赔偿"
    ],
    "renewalEvidence": {
      "produces": false
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null
  }
];
