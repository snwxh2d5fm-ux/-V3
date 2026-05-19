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
    "officialLinks": [
      {
        "label": "香港房屋协会·收楼指引",
        "url": "https://www.hkhs.com"
      },
      {
        "label": "一手住宅物业销售监管局",
        "url": "https://www.srpa.gov.hk"
      }
    ],
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
    "officialLinks": [
      {
        "label": "保监局·家居保险比较",
        "url": "https://www.ia.org.hk"
      },
      {
        "label": "消费者委员会·保险格价",
        "url": "https://www.consumer.org.hk"
      }
    ],
    "tips": [
      "贵重物品（珠宝/名表）通常有单件赔偿上限",
      "索偿：事发后30天内通知+保留损毁物品+保留单据"
    ],
    "pitfalls": [
      "混淆火险与家居保险——火险保障楼宇结构（按揭强制），家居保险保障财物+个人责任，租客只需后者",
      "贵重物品（珠宝/名表）通常有单件赔偿上限——高价值物品需额外申报",
      "家居保险属一般保险（每年续保），21天冷静期不适用于此类保险"
    ],
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
    "officialLinks": [
      {
        "label": "消费者委员会·家电评测",
        "url": "https://www.consumer.org.hk"
      },
      {
        "label": "丰泽电器",
        "url": "https://www.fortress.com.hk"
      }
    ],
    "tips": [
      "Carousell可淘到低至1折的二手名牌家私",
      "宜家送货+安装约$300-800",
      "淘宝集运至香港约7-14天，$10-20/kg"
    ],
    "pitfalls": [
      "租约中未明确家电维修责任——非人为损坏（冷气/热水炉）通常业主负责，但需在租约中列明",
      "大型家具需提前量度门口/走廊/电梯尺寸——部分屋苑需预约货𨋢及缴按金",
      "搬屋时贵重物品（护照/合约/现金/首饰）必须随身携带，切勿放入搬屋车"
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
    "officialLinks": [
      {
        "label": "香港旅游发展局·社区探索",
        "url": "https://www.discoverhongkong.com"
      },
      {
        "label": "民政事务总署·区议会",
        "url": "https://www.had.gov.hk"
      }
    ],
    "tips": [
      "香港街市通常比超市便宜20-30%",
      "万宁/屈臣氏有药剂师",
      "熟悉至少两家24h诊所的地址"
    ],
    "pitfalls": [
      "忽略校网对租房决策的影响——有子女在港上学则住址决定校网分配",
      "港岛租金高配套成熟、九龙性价比好、新界租金低空间大——选错区域通勤成本翻倍",
      "语言适应不足——建议安装粤语学习App学会基本用语（唔该、早晨、几多钱）"
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
    "pitfalls": [
      "未在搬屋前1个月书面通知业主退租或续约——需遵守租约通知期",
      "入伙后72小时内完成地址更改——银行/入境处/运输署/香港邮政的通讯地址需更新",
      "退租时未抄录最后水表电表读数并拍照留底→被多收水电费或扣押金",
      "忘记通知业主/管理处预约货𨋢及缴按金——部分屋苑需提前预约"
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
    "aiChatContext": null,
    "officialLinks": [
      {
        "label": "28Hse 租屋平台",
        "url": "https://www.28hse.com"
      },
      {
        "label": "House730",
        "url": "https://www.house730.com"
      },
      {
        "label": "差饷物业估价署·租务管制",
        "url": "https://www.rvd.gov.hk"
      }
    ],
    "requiredItems": [
      "香港身份证或行街纸（临时身份证明）",
      "入息/经济证明（存款证明/银行流水/雇佣合约）",
      "护照/港澳通行证（如尚无HK身份证）"
    ],
    "pitfalls": [
      "睇楼前必须签署睇楼纸（有效期3个月）——直系亲属也受约束，绕开原代理租同一单位需付双倍佣金",
      "未查册核实业主身份——需到iris.gov.hk查册（HK$10）确认注册业主，防止虚假出租和二房东",
      "口头承诺不算数——所有条件必须写进租约（维修责任/免租期/家电清单）"
    ]
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
    "aiChatContext": null,
    "officialLinks": [
      {
        "label": "一手住宅物业销售监管局",
        "url": "https://www.srpa.gov.hk"
      },
      {
        "label": "中原地产·置业指南",
        "url": "https://hk.centanet.com"
      },
      {
        "label": "差饷物业估价署·物业资讯网",
        "url": "https://www.rvdpi.gov.hk"
      }
    ],
    "requiredItems": [
      "香港身份证/护照",
      "入息/资产证明（至少3个月银行流水+税单+雇佣合约）",
      "预批按揭所需文件（如做预批）"
    ],
    "pitfalls": [
      "2024年2月撤辣后非永居购房税费已与永居看齐（最高4.25%），但需注意\"先免后征\"——若最终未获永居须补缴BSD",
      "购房后确保物业有生活痕迹——空置物业说服力弱，水电煤以你名义登记",
      "非永居阶段购房≈19.25%印花税——$1000万房税约$192.5万，永居后豁免BSD省约$150万"
    ]
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
    "tips": [
      "从价印花税（AVD）按阶梯计算：$300万以下$100, $300-450万1.5%, $450-600万2.25%, $600-900万3%, $900-2000万3.75%, $2000万以上4.25%",
      "按揭成数（2026年）：楼价≤$1000万最高9成（首置+自住+固定收入）, $1125-1500万最高8成, $1715万以上最高7成",
      "非永居通过人才计划购房适用\"先免后征\"——暂免BSD（15%），永居后免除"
    ],
    "renewalEvidence": {
      "produces": true,
      "docType": "印花税缴款证明",
      "docCategory": "address",
      "collectMethod": "photo",
      "isRequiredForRenewal": true
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null,
    "officialLinks": [
      {
        "label": "税务局·印花税",
        "url": "https://www.ird.gov.hk/chi/tax/stamp_duty.htm"
      },
      {
        "label": "金管局·按揭指引",
        "url": "https://www.hkma.gov.hk/chi/key-functions/banking-stability/mortgage-lending/"
      },
      {
        "label": "银行公会·按揭资讯",
        "url": "https://www.hkab.org.hk"
      }
    ],
    "requiredItems": [
      "个人身份证明（确认是否永居身份以判定BSD适用）",
      "入息/资产证明（3个月银行流水+税单+雇佣合约）",
      "目标物业楼价和成交信息"
    ],
    "pitfalls": [
      "忽略杂费：地产代理佣金约1%+律师费0.1-0.2%+按揭保费+火险/管理费",
      "非永居购房=BSD 15%+AVD最高4.25%=约19.25%——$1000万房税约$192.5万，永居后买仅付AVD最高4.25%省$150万",
      "压力测试已暂停（2026年）但银行仍评估还款能力——月供不超过收入合理比例"
    ]
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
    "tips": [
      "律师费约楼价0.1-0.2%——律师负责查契/准备正式合约及按揭文件",
      "签临约时支付\"细订\"（楼价3-5%），临约具法律约束力",
      "签正式合约时支付\"大订\"（合计约楼价10%），成交期一般约3个月"
    ],
    "renewalEvidence": {
      "produces": true,
      "docType": "临时买卖合约",
      "docCategory": "address",
      "collectMethod": "photo",
      "isRequiredForRenewal": true
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null,
    "officialLinks": [
      {
        "label": "香港律师会·物业买卖指引",
        "url": "https://www.hklawsoc.org.hk"
      },
      {
        "label": "一手住宅销售监管局",
        "url": "https://www.srpa.gov.hk"
      }
    ],
    "requiredItems": [
      "HK身份证/护照",
      "临时买卖合约（临约）",
      "细订收据（楼价3-5%）",
      "土地查册结果（土地注册处报告）"
    ],
    "pitfalls": [
      "临约签署前未查册——需到土地注册处查询物业是否有未完成按揭/违建/钉契",
      "未在临约中明确成交日期、贷款条件（subject to mortgage）等保障条款——如银行贷款不足可能损失订金",
      "验楼可在成交前聘请独立验楼师（约数千元）而非等到收楼后才发现问题"
    ]
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
    "tips": [
      "多家银行比较利率——全期按息低至Hibor+1.3%, 封顶P-2%(P=5.25%), 实际年息约3.25%, 最长还款期30年",
      "大部分银行及按保公司接受内地/海外入息申请——需至少3个月入息证明",
      "企业主（自雇）建议香港公司运营满2年+保留完整审计记录后再申请按揭"
    ],
    "renewalEvidence": {
      "produces": true,
      "docType": "按揭批核函",
      "docCategory": "employment",
      "collectMethod": "photo",
      "isRequiredForRenewal": true
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null,
    "officialLinks": [
      {
        "label": "金管局·按揭贷款",
        "url": "https://www.hkma.gov.hk/chi/key-functions/banking-stability/mortgage-lending/"
      },
      {
        "label": "多间银行按揭比较",
        "url": "https://www.hkma.gov.hk"
      }
    ],
    "requiredItems": [
      "HK身份证/护照",
      "公司审计报告（自雇）/雇佣合约+薪资单（受雇）",
      "个人银行流水（最近3-6个月）",
      "内地/香港纳税记录",
      "公司注册证书+商业登记证（如企业主）",
      "临时买卖合约（已完成签署）"
    ],
    "pitfalls": [
      "银行通常不接受内地或海外物业作为资产计算——只认可存款/股票/基金/投资保险",
      "香港信用记录需从零建立——到港后前3个月申请信用卡建立记录对按揭有帮助",
      "收入与贷款金额不匹配——银行会评估还款能力，确保月供在合理范围"
    ]
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
    "tips": [
      "成交期一般约3个月——建议成交日前安排最后视察确认交吉状态",
      "可聘用独立验楼师（约数千元）检查单位——发现结构问题可即时向业主/发展商提出",
      "收楼后确保水电煤账户转至你名下、管理费登记完成"
    ],
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
    "aiChatContext": null,
    "officialLinks": [
      {
        "label": "差饷物业估价署·物业成交",
        "url": "https://www.rvd.gov.hk"
      },
      {
        "label": "土地注册处·查册",
        "url": "https://www.landreg.gov.hk"
      },
      {
        "label": "水务署·转名",
        "url": "https://www.wsd.gov.hk"
      }
    ],
    "requiredItems": [
      "正式买卖合约（已签署）",
      "大订付款证明",
      "律师行结算单/成交清单",
      "按揭贷款文件（如已申请）",
      "身份证明文件"
    ],
    "pitfalls": [
      "未在成交日前安排最后验楼——收楼后发现的隐藏问题（漏水/墙身裂痕/冷气故障）难以追溯",
      "未确认\"交吉\"状态——原业主未清空/未拆违建/未缴清管理费差饷影响收楼",
      "\"先免后征\"人士若未来未获永居须补缴BSD——保留身份规划路径"
    ]
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
    "aiChatContext": null,
    "requiredItems": [
      "身份证明（HK身份证/通行证/护照）",
      "入息/经济证明（银行存款/雇佣合约/税单——业主有权查看）",
      "查册结果（iris.gov.hk, HK$10）核实业主身份和物业状态",
      "签署睇楼纸（睇楼前必签，有效期3个月）",
      "预备资金——按金2月+首月租金+中介费半月+印花税≈月租3.5-4倍"
    ]
  }
];
