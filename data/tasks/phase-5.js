// 住港伴 关卡5: 子女教育 (12项)
module.exports = [
  {
    "id": "onboard-501a",
    "phase": 5,
    "sequence": 1,
    "category": "子女教育",
    "title": "了解香港幼儿园三类体系",
    "subtitle": "幼儿中心≠幼稚园≠幼儿班——先搞清差异",
    "timeEstimate": "10分钟",
    "urgency": "必修",
    "icon": "school",
    "applicableTo": {
      "visaTypes": "all",
      "familyStatus": [
        "preschool"
      ],
      "arrivalScenario": [
        "fresh",
        "delayed"
      ],
      "skipIfExisting": []
    },
    "steps": [
      {
        "seq": 1,
        "title": "三类体系对比",
        "content": "幼儿中心(0-2岁,$3k-8k/月,日托)/幼稚园K1-K3(2岁8月+,免费~$10万/年)/幼儿班N班(足2岁,学前预备)",
        "type": "info"
      },
      {
        "seq": 2,
        "title": "年龄对应速查",
        "content": "2024年出生→2026-27入N班，2023年→K1，2022年→K2，2021年→K3。截止日8月31日(≠内地9月1日)",
        "type": "info"
      },
      {
        "seq": 3,
        "title": "选择考虑",
        "content": "半日vs全日? 粤语/英文/普通话? 政府资助(免费)vs国际($80k-200k+/年)? 离家多远?",
        "type": "info"
      }
    ],
    "tips": [
      "政府资助幼稚园需申请'幼稚园入学注册证'",
      "国际幼稚园通常不在资助范围",
      "8月出生的孩子可能是全班最小→考虑推迟一年入学"
    ],
    "renewalEvidence": {
      "produces": false
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null,
    "officialLinks": [
      {
        "label": "教育局·幼稚园教育",
        "url": "https://www.edb.gov.hk/tc/edu-system/preprimary-kindergarten/index.html"
      },
      {
        "label": "幼稚园概览",
        "url": "https://www.chsc.hk/kindergarten/"
      }
    ],
    "requiredItems": [
      "子女出生证明（正本+副本，非英文件需翻译）",
      "父母HK身份证/签证副本",
      "子女受养人签证/香港身份证（如已办理）",
      "住址证明（部分幼稚园按区域优先）",
      "儿童免疫接种记录（需香港卫生署认可）"
    ],
    "pitfalls": [
      "K1须提前1年申请（入学前一年9-11月报名）——错过窗口只能等K2插班",
      "N班（2岁班）学位极度紧张——需怀孕期间开始排队",
      "幼稚园入学与\"校网\"无关（校网仅适用于小学派位），但部分幼稚园有附属小学优势",
      "非牟利幼稚园虽免学费但杂费（茶点/校服/书簿）仍约HKD 5000-10000/年"
    ]
  },
  {
    "id": "onboard-502a",
    "phase": 5,
    "sequence": 2,
    "category": "子女教育",
    "title": "掌握幼儿园申请时间线",
    "subtitle": "错过窗口=等一年——香港幼儿园报名有极强季节性",
    "timeEstimate": "10分钟",
    "urgency": "必修",
    "icon": "calendar",
    "applicableTo": {
      "visaTypes": "all",
      "familyStatus": [
        "preschool"
      ],
      "arrivalScenario": [
        "fresh",
        "delayed"
      ],
      "skipIfExisting": []
    },
    "steps": [
      {
        "seq": 1,
        "title": "年度时间线",
        "content": "6-9月索取报名表→9-11月递交→10-11月面试→12月中旬放榜→次年1月8-10日统一注册(留位费$970)→9月开学",
        "type": "info"
      },
      {
        "seq": 2,
        "title": "关键提醒",
        "content": "政府资助幼稚园必须持'幼稚园入学注册证'注册。国际幼稚园有独立时间线，通常更早",
        "type": "info"
      },
      {
        "seq": 3,
        "title": "插班申请",
        "content": "部分学校全年接受插班→亲临或下载报名表→提供原校成绩表/评估报告",
        "type": "info"
      }
    ],
    "tips": [
      "N班通常比K1更早招生",
      "部分热门国际幼稚园需提前1年半排队",
      "留位费$970入学后通常可扣减首月学费"
    ],
    "renewalEvidence": {
      "produces": false
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null,
    "officialLinks": [
      {
        "label": "教育局·幼稚园入学",
        "url": "https://www.edb.gov.hk/tc/edu-system/preprimary-kindergarten/kindergarten-k1-admission-arrangements/index.html"
      },
      {
        "label": "学券/幼稚园教育计划",
        "url": "https://www.edb.gov.hk/tc/edu-system/preprimary-kindergarten/pevs/index.html"
      }
    ],
    "requiredItems": [
      "子女出生证明及身份证明",
      "父母HK身份证/签证",
      "住址证明",
      "入学申请表+报名费"
    ],
    "pitfalls": [
      "幼稚园面试集中在入学前一年11-12月——错过需大量叩门",
      "非牟利幼稚园虽免费但面试竞争激烈——热门校录取率可能低于30%",
      "8月出生的孩子可能是全班最小——考虑推迟一年入学",
      "国际幼稚园通常不在资助范围且需提前1年半排队"
    ]
  },
  {
    "id": "onboard-503a",
    "phase": 5,
    "sequence": 3,
    "category": "子女教育",
    "title": "准备幼儿园面试",
    "subtitle": "三层面试——孩子独立表现+家长面谈+小组互动",
    "timeEstimate": "15分钟",
    "urgency": "必修",
    "icon": "users",
    "applicableTo": {
      "visaTypes": "all",
      "familyStatus": [
        "preschool"
      ],
      "arrivalScenario": [
        "fresh",
        "delayed"
      ],
      "skipIfExisting": []
    },
    "steps": [
      {
        "seq": 1,
        "title": "孩子独立表现",
        "content": "约15分钟：颜色/形状辨认，简单拼图，听指令完成任务，考察认知+大小肌肉协调+专注力",
        "type": "info"
      },
      {
        "seq": 2,
        "title": "家长面谈约10分钟",
        "content": "为什么选我们? 教育理念? 对子女期望? 港漂家长优势：准备英文/普通话回答，强调多语优势",
        "type": "info"
      },
      {
        "seq": 3,
        "title": "小组互动观察",
        "content": "几个小朋友一起玩，观察分享/等待/无攻击性，正常表现即可不需刻意训练",
        "type": "info"
      }
    ],
    "tips": [
      "面试以游戏形式进行",
      "穿整齐得体不需正装",
      "小朋友情绪状态>知识储备",
      "家长不要过度抢话",
      "粤语不流利用英文/普通话+表示正在学(加分)"
    ],
    "renewalEvidence": {
      "produces": false
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null,
    "officialLinks": [
      {
        "label": "教育局·幼稚园入学安排",
        "url": "https://www.edb.gov.hk/tc/edu-system/preprimary-kindergarten/kindergarten-k1-admission-arrangements/index.html"
      },
      {
        "label": "幼稚园概览·学校查询",
        "url": "https://www.chsc.hk/kindergarten/"
      }
    ],
    "requiredItems": [
      "子女出生证明及身份证明",
      "父母HK身份证",
      "住址证明",
      "子女成绩单/幼儿园评估报告（叩门时特别重要）",
      "免疫接种记录"
    ],
    "pitfalls": [
      "面试以游戏形式进行——小朋友情绪状态>知识储备，穿整齐得体不需正装",
      "部分热门幼稚园面试以粤语/英语进行——纯普通话背景子女需提前准备",
      "家长面谈约10分钟——学校关注家庭教育理念是否与学校匹配"
    ]
  },
  {
    "id": "onboard-504a",
    "phase": 5,
    "sequence": 4,
    "category": "子女教育",
    "title": "了解学费与三类资助",
    "subtitle": "政府资助幼稚园免费，国际幼稚园20万+/年——提前规划",
    "timeEstimate": "10分钟",
    "urgency": "建议",
    "icon": "dollar",
    "applicableTo": {
      "visaTypes": "all",
      "familyStatus": [
        "preschool"
      ],
      "arrivalScenario": [
        "fresh",
        "delayed"
      ],
      "skipIfExisting": []
    },
    "steps": [
      {
        "seq": 1,
        "title": "学费区间",
        "content": "政府资助(经幼稚园教育计划)学费全免。国际约$80k-200k+/年。本地私立约$30k-80k/年",
        "type": "info"
      },
      {
        "seq": 2,
        "title": "三类资助",
        "content": "a)幼稚园教育计划→合资格园免费; b)学费减免→最高50-100%(需经济审查); c)就学开支津贴→最高$4,490/年",
        "type": "info"
      },
      {
        "seq": 3,
        "title": "如何申请",
        "content": "开学后通过幼稚园索取申请表→填妥交回→教育局/社署审批",
        "type": "action"
      }
    ],
    "tips": [
      "政府资助幼稚园需申请\"幼稚园入学注册证\"——此为免学费凭证",
      "学费减免计划（全免/半免）按家庭收入审查——四人家庭月入低于约HKD 50000可申请",
      "三类资助：幼稚园教育计划（政府资助）+幼稚园及幼儿中心学费减免+学生就学开支津贴"
    ],
    "renewalEvidence": {
      "produces": false
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null,
    "officialLinks": [
      {
        "label": "学生资助处·幼稚园学费减免",
        "url": "https://www.wfsfaa.gov.hk/sfo/tc/primarysecondary/kinder/index.htm"
      },
      {
        "label": "在职家庭津贴",
        "url": "https://www.wfsfaa.gov.hk/wfao/"
      },
      {
        "label": "幼稚园教育计划·学费资助",
        "url": "https://www.edb.gov.hk/tc/edu-system/preprimary-kindergarten/pevs/index.html"
      }
    ],
    "requiredItems": [
      "子女出生证明及身份证明",
      "父母HK身份证/签证",
      "住址证明",
      "入息证明（申请资助用——家庭月入审查）"
    ],
    "pitfalls": [
      "资助申请需每年重新提交——忘记续期则次年恢复全费",
      "国际幼稚园不在政府资助范围——学费HKD 8000-25000/月全自费",
      "\"幼稚园入学注册证\"仅适用于参加计划的非牟利幼稚园——私立独立幼稚园不适用"
    ]
  },
  {
    "id": "onboard-505a",
    "phase": 5,
    "sequence": 5,
    "category": "子女教育",
    "title": "区域热门幼稚园参考",
    "subtitle": "基于50所学校数据，按居住区推荐",
    "timeEstimate": "10分钟",
    "urgency": "建议",
    "icon": "map-pin",
    "applicableTo": {
      "visaTypes": "all",
      "familyStatus": [
        "preschool"
      ],
      "arrivalScenario": [
        "fresh",
        "delayed"
      ],
      "skipIfExisting": []
    },
    "steps": [
      {
        "seq": 1,
        "title": "系统联动",
        "content": "结合找房向导中选择的区域，自动列出该区及邻近幼稚园(含类型/学费/面试语言/报名难度)",
        "type": "info"
      },
      {
        "seq": 2,
        "title": "重点推荐",
        "content": "港漂家庭首选：大型住宅区+有普通话支援+插班友好。数据来源：学校原始语料库50校",
        "type": "info"
      }
    ],
    "tips": [
      "港岛中西区/湾仔区名校集中但租金最高",
      "九龙城区（九龙塘）国际幼稚园密集",
      "沙田/大埔性价比高适合预算有限家庭",
      "联动关卡3找房向导→只看目标区域幼稚园"
    ],
    "renewalEvidence": {
      "produces": false
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null,
    "officialLinks": [
      {
        "label": "幼稚园概览·分区搜索",
        "url": "https://www.chsc.hk/kindergarten/"
      },
      {
        "label": "Baby Kingdom·家长口碑",
        "url": "https://www.baby-kingdom.com"
      },
      {
        "label": "教育局·幼稚园名单",
        "url": "https://www.edb.gov.hk/tc/student-parents/sch-info/sch-search/schlist.aspx"
      }
    ],
    "requiredItems": [
      "幼稚园概览（chsc.hk）可按区域筛选全部注册幼稚园——需与关卡3找房向导联动选区域"
    ],
    "pitfalls": [
      "热门区域幼稚园（九龙塘/中西区）面试竞争激烈——建议同时报5-8所增加录取概率",
      "不同区幼稚园质素差异大——参考教育局质素评核报告",
      "区域热门≠适合你的孩子——考虑教学语言（粤/英/普）和教学理念"
    ]
  },
  {
    "id": "onboard-501b",
    "phase": 5,
    "sequence": 6,
    "category": "子女教育",
    "title": "五类学校全景对比",
    "subtitle": "官立=免费但极难插班，直资=灵活但要钱——先搞清差异",
    "timeEstimate": "15分钟",
    "urgency": "必修",
    "icon": "building",
    "applicableTo": {
      "visaTypes": "all",
      "familyStatus": [
        "school-age",
        "teen"
      ],
      "arrivalScenario": [
        "fresh",
        "delayed"
      ],
      "skipIfExisting": []
    },
    "steps": [
      {
        "seq": 1,
        "title": "对比表",
        "content": "官立(免费/粤语/派位/极难插)/资助(免费/粤语/80%学校/难)/直资($20k-130k/年/中英/自主招/中等)/私立($100k-300k/年/英文/灵活/较易)/国际($100k-300k/年/英文/海外升学/较易)",
        "type": "info"
      },
      {
        "seq": 2,
        "title": "港漂现实选择",
        "content": "官立/资助插班学位极少且需粤语。直资=最佳平衡(自主招生+双语+一般一条龙)。私立/国际=预算充足",
        "type": "info"
      },
      {
        "seq": 3,
        "title": "年级匹配与降级",
        "content": "英文落后2-3年+繁体字需6-12月→降1-2级常见。小学降级利大于弊。中学最迟中二结束前插班(中三选科)",
        "type": "info"
      }
    ],
    "tips": [
      "50所代表性学校(10官立+10资助+15直资+7私立+8国际)",
      "可联动关卡3找房向导→只看目标校区"
    ],
    "renewalEvidence": {
      "produces": false
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null,
    "officialLinks": [
      {
        "label": "教育局·学校概览",
        "url": "https://www.chsc.hk/primary/"
      },
      {
        "label": "香港小学概览",
        "url": "https://www.schooland.hk"
      },
      {
        "label": "直资学校议会",
        "url": "https://www.dsssc.org.hk"
      }
    ],
    "requiredItems": [
      "子女出生证明及身份证明",
      "住址证明（官立/资助按校网）",
      "成绩单/在学证明",
      "课外活动/获奖证明"
    ],
    "pitfalls": [
      "五类学校：官立（免费/粤语/校网派位）、资助（免费/多为宗教团体）、直资（年费$2000-6000/课程灵活）、私立（年费$5-15万/独立招生）、国际（年费$15-30万+债券$50-300万）",
      "非永居子女同样享受15年免费教育（公立中小学），但不能通过JUPAS联招",
      "粤语教学环境对纯内地背景子女是显著挑战——建议选有普通话支援的学校"
    ]
  },
  {
    "id": "onboard-502b",
    "phase": 5,
    "sequence": 7,
    "category": "子女教育",
    "title": "锁定目标校网+看房配合",
    "subtitle": "定校网→选区域→看房——三者联动，顺序不能错",
    "timeEstimate": "15分钟",
    "urgency": "必修",
    "icon": "map",
    "applicableTo": {
      "visaTypes": "all",
      "familyStatus": [
        "school-age",
        "teen"
      ],
      "arrivalScenario": [
        "fresh",
        "delayed"
      ],
      "skipIfExisting": []
    },
    "steps": [
      {
        "seq": 1,
        "title": "四大名校网速查",
        "content": "11中西区(全港第一)/12湾仔(女校资源多)/34何文田(约20间Band1环绕)/41九龙塘(三大神校)",
        "type": "info"
      },
      {
        "seq": 2,
        "title": "第二梯队性价比之选",
        "content": "31油尖旺/32大角嘴/35红磡/48观塘/62荃湾/88沙田",
        "type": "info"
      },
      {
        "seq": 3,
        "title": "新来港家庭推荐",
        "content": "首选屯门/元朗(校网密集+生活成本低)/跨境学童选上水/天水围。追名校→中西区/九龙塘",
        "type": "info"
      }
    ],
    "tips": [
      "四大名校网：九龙城41校网、中西区11校网、湾仔12校网——租金普遍$25000+/月",
      "第二梯队性价比之选：沙田91校网、东区14校网——租金$15000-20000/月且学校质素不俗",
      "新来港家庭推荐：荃湾62校网/葵青65校网——社区成熟、跨境交通方便"
    ],
    "renewalEvidence": {
      "produces": false
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null,
    "officialLinks": [
      {
        "label": "教育局·校网划分",
        "url": "https://www.edb.gov.hk/tc/edu-system/primary-secondary/spa-systems/primary-1-admission/school-net-lists.html"
      },
      {
        "label": "中原·校网置业",
        "url": "https://hk.centanet.com"
      }
    ],
    "requiredItems": [
      "子女HK身份证/受养人签证",
      "住址证明（校网判定依据——须为实际居住地址）",
      "小一入学申请表（教育局统一派发）",
      "自行分配学位计分证明（兄姊在校/父母校友等）"
    ],
    "pitfalls": [
      "自行分配学位\"计分办法\"对非本地背景家庭不利（无校友分/无兄姊在校分）——大概率需走统一派位",
      "热门校网（如41校网）租房价高且竞争激烈",
      "校网地址必须是实际居住地址（租约+水电账单）——虚假申报学位可能被取消"
    ]
  },
  {
    "id": "onboard-503b",
    "phase": 5,
    "sequence": 8,
    "category": "子女教育",
    "title": "准备插班申请材料+年级匹配",
    "subtitle": "8项通用材料+年级匹配——准备齐全一次过",
    "timeEstimate": "20分钟",
    "urgency": "必修",
    "icon": "folder",
    "applicableTo": {
      "visaTypes": "all",
      "familyStatus": [
        "school-age",
        "teen"
      ],
      "arrivalScenario": [
        "fresh",
        "delayed"
      ],
      "skipIfExisting": []
    },
    "steps": [
      {
        "seq": 1,
        "title": "8项材料清单",
        "content": "出生证明+近2-3年成绩表+证书/奖状(不超10页)+父母身份证副本+住址证明+回邮信封+申请费$50-200+学生近照2-4张",
        "type": "info"
      },
      {
        "seq": 2,
        "title": "年级匹配速查",
        "content": "2020年出生→P1, 2019→P2, 2014→S1, 2012→S3。适龄入学为主，降1-2级常见(英文+繁体字适应)",
        "type": "info"
      },
      {
        "seq": 3,
        "title": "居留权要求",
        "content": "须持香港居留权或有效居留证明(受养人签证)。访客签注儿童不得入读。学生签证只能读非公营",
        "type": "info"
      }
    ],
    "tips": [
      "教育局学位支援组2892 6191→三个工作天内获安排学位",
      "入境管制站可索取申请表",
      "春季插班(1-2月入学)比秋季更易获录取"
    ],
    "renewalEvidence": {
      "produces": true,
      "docType": "插班申请回执",
      "docCategory": "family",
      "collectMethod": "photo",
      "isRequiredForRenewal": true
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null,
    "officialLinks": [
      {
        "label": "教育局·学位分配系统",
        "url": "https://www.edb.gov.hk/tc/edu-system/primary-secondary/spa-systems/index.html"
      },
      {
        "label": "学校概览·插班指引",
        "url": "https://www.chsc.hk/primary/"
      }
    ],
    "requiredItems": [
      "子女出生证明及身份证明（正本+副本）",
      "父母HK身份证",
      "住址证明（最近3月水电煤账单）",
      "最近2年成绩单（需翻译公证）",
      "获奖/课外活动证明（叩门加分）",
      "推荐信（原校老师/校长）",
      "在学证明/转学证明",
      "免疫接种记录"
    ],
    "pitfalls": [
      "插班年级匹配：内地小五=香港小五（同为六年制），内地初三=香港中三（同为三年初中）",
      "春季插班（1-2月入学）比秋季更易获录取——竞争少且学位刚释放",
      "教育局学位支援组2892 6191——三个工作天内为适龄儿童安排学位",
      "部分学校要求降级1年（尤其是英文水平未达标者）"
    ]
  },
  {
    "id": "onboard-504b",
    "phase": 5,
    "sequence": 9,
    "category": "子女教育",
    "title": "笔试准备：中英数三科",
    "subtitle": "中文繁体字+英文难度高+数学英文出题——三关逐一过",
    "timeEstimate": "20分钟",
    "urgency": "必修",
    "icon": "edit",
    "applicableTo": {
      "visaTypes": "all",
      "familyStatus": [
        "school-age",
        "teen"
      ],
      "arrivalScenario": [
        "fresh",
        "delayed"
      ],
      "skipIfExisting": []
    },
    "steps": [
      {
        "seq": 1,
        "title": "中文科",
        "content": "繁体字读写速度+香港用词差异(質素≠素质，水準≠水平)，建议提前3-6月练习繁体字",
        "type": "info"
      },
      {
        "seq": 2,
        "title": "英文科",
        "content": "内地公立学生英文落后香港同级2-3年，重点补阅读速度+词汇量，建议刷香港TSA/Pre-S1真题",
        "type": "info"
      },
      {
        "seq": 3,
        "title": "数学科",
        "content": "数学进度可能超前但英文出题看不懂→背熟英文术语(integer/fraction/algebra/geometry等)",
        "type": "info"
      }
    ],
    "tips": [
      "去三联/商务/大众书局买香港同级课本",
      "部分直资/国际学校另有逻辑推理/小组讨论",
      "面试常见：1分钟中英文自我介绍+为什么选我们"
    ],
    "renewalEvidence": {
      "produces": false
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null,
    "officialLinks": [
      {
        "label": "香港考试及评核局",
        "url": "https://www.hkeaa.edu.hk"
      },
      {
        "label": "教育局·中英数课程指引",
        "url": "https://www.edb.gov.hk/tc/curriculum-development/index.html"
      }
    ],
    "requiredItems": [
      "香港同级课本（三联/商务/大众书局购买）",
      "中英数三科历年试卷/练习册",
      "中英/英中字典",
      "文具/计算机"
    ],
    "pitfalls": [
      "中文科：香港用繁体字+粤语拼音——与内地简体+普通话拼音完全不同，需专项补课",
      "英文科：香港小学英文水平普遍比内地同级高1-2级——尤其是口语和写作",
      "数学科：香港中学以英文出题为主——内地学生需适应英文数学术语"
    ]
  },
  {
    "id": "onboard-505b",
    "phase": 5,
    "sequence": 10,
    "category": "子女教育",
    "title": "面试准备：学生+家长双面试",
    "subtitle": "香港插班面试≠内地考试——考察的是综合能力",
    "timeEstimate": "20分钟",
    "urgency": "必修",
    "icon": "users",
    "applicableTo": {
      "visaTypes": "all",
      "familyStatus": [
        "school-age",
        "teen"
      ],
      "arrivalScenario": [
        "fresh",
        "delayed"
      ],
      "skipIfExisting": []
    },
    "steps": [
      {
        "seq": 1,
        "title": "学生面试准备",
        "content": "1分钟中英文自我介绍+高频问题：为什么选我们?如何适应粤语/英语?优点和缺点?部分学校有小组讨论",
        "type": "info"
      },
      {
        "seq": 2,
        "title": "家长面试准备",
        "content": "考察教育理念是否契合+对子女了解+家庭支援能力(课后辅导等)，港漂家长优势：多语环境+学习基础扎实",
        "type": "info"
      },
      {
        "seq": 3,
        "title": "面试礼仪",
        "content": "穿整齐校服/便服，提前15分钟到，眼神接触，积极但不抢话，准备1-2个问学校的问题",
        "type": "info"
      }
    ],
    "tips": [
      "即使英文学校也可能用粤语闲谈→准备基本粤语回应",
      "不要过度训练→香港学校讨厌'背答案'",
      "面试后24小时内发感谢电邮(英文)"
    ],
    "renewalEvidence": {
      "produces": false
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null,
    "officialLinks": [
      {
        "label": "教育局·学校概览",
        "url": "https://www.chsc.hk/primary/"
      },
      {
        "label": "香港小升中面试资料网",
        "url": "https://www.edu-kingdom.com"
      }
    ],
    "requiredItems": [
      "学生：中英文自我介绍（1分钟）、获奖证书/作品集、校服/整齐便服",
      "家长：家庭教育理念陈述、子女成长故事、对目标学校的了解"
    ],
    "pitfalls": [
      "即使英文学校也可能用粤语闲谈——准备基本粤语回应（如\"我哋会支持小朋友\"）",
      "不要过度训练——香港学校讨厌\"背答案\"，自然真诚最重要",
      "面试后24小时内发英文感谢电邮——这是香港职场/学校的基本礼节"
    ]
  },
  {
    "id": "onboard-506b",
    "phase": 5,
    "sequence": 11,
    "category": "子女教育",
    "title": "叩门(候补)策略",
    "subtitle": "统一派位结果不理想? 叩门是你的第二次机会",
    "timeEstimate": "15分钟",
    "urgency": "建议",
    "icon": "door",
    "applicableTo": {
      "visaTypes": "all",
      "familyStatus": [
        "school-age",
        "teen"
      ],
      "arrivalScenario": [
        "fresh",
        "delayed"
      ],
      "skipIfExisting": []
    },
    "steps": [
      {
        "seq": 1,
        "title": "什么是叩门",
        "content": "统一派位结果公布后，家长直接向心仪学校申请候补位。叩门位极少(每校1-5个)但每年都有人成功",
        "type": "info"
      },
      {
        "seq": 2,
        "title": "叩门时间线",
        "content": "5月下旬起领表→6月上旬截止→面试通知电话通知→如指定日期前未接到通知=落选",
        "type": "info"
      },
      {
        "seq": 3,
        "title": "叩门材料清单",
        "content": "小一入学申请表+派位选校表+注册证+出世纸+父母身份证+幼稚园成绩表+照片+回邮信封",
        "type": "info"
      }
    ],
    "tips": [
      "叩门≠走后门，全公开候补机制",
      "可同时向多校叩门",
      "面试表现>笔试成绩(叩门阶段)"
    ],
    "renewalEvidence": {
      "produces": false
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null,
    "officialLinks": [
      {
        "label": "教育局·学位分配",
        "url": "https://www.edb.gov.hk/tc/edu-system/primary-secondary/spa-systems/secondary-sch/index.html"
      },
      {
        "label": "教育王国·叩门攻略",
        "url": "https://www.edu-kingdom.com"
      }
    ],
    "requiredItems": [
      "叩门信（手写/打印，中英皆可）",
      "子女成绩单/评估报告副本",
      "获奖/课外活动证明副本",
      "推荐信（如有）",
      "子女近照",
      "回邮信封（贴足邮票）"
    ],
    "pitfalls": [
      "叩门≠走后门——全公开候补机制，入学处公平处理",
      "可同时向多校叩门——无数量限制但建议精选3-5所",
      "面试表现>笔试成绩（叩门阶段）——学校更看重学生态度和家长诚意",
      "叩门黄金窗口仅2-3天（放榜后）——提前备好全套材料随时投递"
    ]
  },
  {
    "id": "onboard-507b",
    "phase": 5,
    "sequence": 12,
    "category": "子女教育",
    "title": "了解DSE/华侨生联考/IB三大路径",
    "subtitle": "小学阶段就要考虑中学→大学的完整路径",
    "timeEstimate": "15分钟",
    "urgency": "建议",
    "icon": "graduation",
    "applicableTo": {
      "visaTypes": "all",
      "familyStatus": [
        "school-age",
        "teen"
      ],
      "arrivalScenario": [
        "fresh",
        "delayed"
      ],
      "skipIfExisting": []
    },
    "steps": [
      {
        "seq": 1,
        "title": "DSE(中学文凭试)",
        "content": "本地主流，可报香港/内地/海外大学。以'本地生'身份考DSE需提前2年赴港读书",
        "type": "info"
      },
      {
        "seq": 2,
        "title": "华侨生联考",
        "content": "内地985/211捷径：一本线约400分/二本线约300分。需香港永居+回乡证",
        "type": "info"
      },
      {
        "seq": 3,
        "title": "IB/A-Level",
        "content": "国际学校主流课程，对接海外升学。IB 45满分为全球顶校敲门砖",
        "type": "info"
      }
    ],
    "tips": [
      "DSE和华侨生联考不可兼得需提前规划",
      "2026年DSE本地生定义：需在港住满2年",
      "小学插班时就要做好8年规划"
    ],
    "renewalEvidence": {
      "produces": false
    },
    "reminderTrigger": null,
    "documentLink": null,
    "aiChatContext": null,
    "officialLinks": [
      {
        "label": "考评局·DSE",
        "url": "https://www.hkeaa.edu.hk/tc/hkdse/"
      },
      {
        "label": "IBO·国际文凭",
        "url": "https://www.ibo.org"
      },
      {
        "label": "港澳台华侨生联考",
        "url": "https://www.eeagd.edu.cn"
      }
    ],
    "requiredItems": [
      "持续8年的在学证明/成绩单档案",
      "各阶段学校申请表",
      "课外活动/比赛证明"
    ],
    "pitfalls": [
      "DSE和华侨生联考不可兼得——需提前规划路线（小四前决定）",
      "2026年DSE本地生定义：需在港住满2年——永居≠本地生（大学学费方面）",
      "小学插班时就要做好8年规划——中学→大学→永居的时间轴需完整对齐",
      "IB路线衔接英/美大学成本低于DSE，但学费高3-5倍"
    ]
  }
];
