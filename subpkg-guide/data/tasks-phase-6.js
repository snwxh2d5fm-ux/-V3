// 住港伴 关卡6: 财务税务 (10项)
module.exports = [
  {
    id: 'onboard-601',
    phase: 6,
    sequence: 1,
    category: '财务税务',
    title: '首次报税',
    subtitle: '收到绿色信封BIR60别慌——首次报税其实很简单',
    timeEstimate: '20分钟',
    urgency: '必修',
    icon: 'tax',
    applicableTo: {
      visaTypes: 'all',
      familyStatus: 'all',
      arrivalScenario: ['fresh', 'delayed'],
      skipIfExisting: [],
    },
    steps: [
      {
        seq: 1,
        title: '报税时间线',
        content: '5月税务局发BIR60→6-7月提交→10-11月收评税→翌年1月缴第一期(75%)→4月缴第二期(25%)',
        type: 'info',
      },
      {
        seq: 2,
        title: '首次报税流程',
        content: '雇主入职3月内提交IR56E→税务局5月内寄首次报税表。如应课税但没收到须7月31日前书面通知',
        type: 'info',
      },
      {
        seq: 3,
        title: '免税额+扣税',
        content: '基本$132k/已婚$264k/子女每名$130k/供养父母$50k/租金扣税$100k/MPF$18k。税阶:2%-6%-10%-14%-17%',
        type: 'info',
      },
    ],
    tips: ['eTax网上报税可延长至2个月', '月入$40k单身税款约$18,100(扣基本+租金+MPF)', '带2子女可达至免税'],
    renewalEvidence: {
      produces: true,
      docType: '评税通知书',
      docCategory: 'employment',
      collectMethod: 'photo',
      isRequiredForRenewal: true,
      renewalTip: '评税通知书是在港有贡献的核心证明。每年5月收到BIR60及时报税，10月收到评税通知书时拍照存档。',
    },
    reminderTrigger: null,
    documentLink: null,
    aiChatContext: null,
    officialLinks: [
      {
        label: '税务局·薪俸税',
        url: 'https://www.ird.gov.hk/chi/tax/salaries_tax.htm',
      },
      {
        label: 'eTax 电子报税',
        url: 'https://www.gov.hk/tc/residents/taxes/etax/index.htm',
      },
    ],
  },
  {
    id: 'onboard-602',
    phase: 6,
    sequence: 2,
    category: '财务税务',
    title: '设定强积金投资组合',
    subtitle: '雇主代登记，雇员需管理——别让退休金睡大觉',
    timeEstimate: '20分钟',
    urgency: '必修',
    icon: 'piggy',
    applicableTo: {
      visaTypes: 'all',
      familyStatus: 'all',
      arrivalScenario: ['fresh', 'delayed'],
      skipIfExisting: [],
    },
    steps: [
      {
        seq: 1,
        title: '什么是MPF',
        content: '雇主雇员各供5%(共10%)，入息下限~$7,100/上限~$30,000。积金易(eMPF)2024年6月启用',
        type: 'info',
      },
      {
        seq: 2,
        title: '选择投资组合',
        content: '预设投资DIS(适合新手)。进取型(股票多)→均衡型→保守型(债券多)。至少每半年检视',
        type: 'action',
      },
      {
        seq: 3,
        title: '2026年新政策',
        content: '全自由行首阶段(2025年5月后入职)→可年移雇主供款至自选计划。取消对冲(2025年5月起)',
        type: 'info',
      },
    ],
    tips: [],
    renewalEvidence: {
      produces: true,
      docType: '首期MPF供款记录',
      docCategory: 'employment',
      collectMethod: 'photo',
      isRequiredForRenewal: true,
      renewalTip: 'MPF供款记录是在港就业的最强证明之一。续签时入境处必查。',
    },
    reminderTrigger: null,
    documentLink: null,
    aiChatContext: null,
    officialLinks: [
      {
        label: '积金局',
        url: 'https://www.mpfa.org.hk',
      },
      {
        label: '积金局·基金表现',
        url: 'https://mfp.mpfa.org.hk/tch/mpp_list.jsp',
      },
      {
        label: '积金局·投资教育',
        url: 'https://www.mpfa.org.hk/tch/mpf_education/',
      },
    ],
  },
  {
    id: 'onboard-603',
    phase: 6,
    sequence: 3,
    category: '财务税务',
    title: '开通跨境汇款',
    subtitle: 'FPS跨境支付通已上线，内地手机号即可收款',
    timeEstimate: '15分钟',
    urgency: '建议',
    icon: 'transfer',
    applicableTo: {
      visaTypes: 'all',
      familyStatus: 'all',
      arrivalScenario: ['fresh', 'delayed'],
      skipIfExisting: [],
    },
    steps: [
      {
        seq: 1,
        title: 'FPS跨境支付通',
        content: '2025年6月上线，只需收款人内地手机号→限额每日$10k/年$200k→部分银行免手续费→即时到账',
        type: 'info',
      },
      {
        seq: 2,
        title: '其他渠道',
        content: 'Wise(汇率最优,约HK$25+0.95%)/AlipayHK(中级$7,999日/高级$2万日)/银行电汇(同名户口8万人民币/日)',
        type: 'info',
      },
    ],
    tips: [],
    renewalEvidence: {
      produces: true,
      docType: '首笔跨境汇款记录',
      docCategory: 'employment',
      collectMethod: 'photo',
      isRequiredForRenewal: false,
    },
    reminderTrigger: null,
    documentLink: null,
    aiChatContext: null,
    officialLinks: [
      {
        label: '金管局·跨境理财通',
        url: 'https://www.hkma.gov.hk/chi/key-functions/international-financial-centre/wealth-management-connect/',
      },
      {
        label: 'Wise 国际汇款',
        url: 'https://wise.com/hk',
      },
      {
        label: '支付宝HK·跨境汇款',
        url: 'https://www.alipayhk.com',
      },
    ],
  },
  {
    id: 'onboard-604',
    phase: 6,
    sequence: 4,
    category: '财务税务',
    title: '设定水电煤自动转账',
    subtitle: '一劳永逸不再忘记缴费——自动转账一次搞定',
    timeEstimate: '10分钟',
    urgency: '建议',
    icon: 'autopay',
    applicableTo: {
      visaTypes: 'all',
      familyStatus: 'all',
      arrivalScenario: ['fresh', 'delayed'],
      skipIfExisting: [],
    },
    steps: [
      {
        seq: 1,
        title: '银行自动转账',
        content: '网银/eDDA/亲临分行→填写自动转账授权书→处理约6-8周。中电/港灯/煤气/水务署银行资料需对应准确',
        type: 'action',
      },
      {
        seq: 2,
        title: 'AlipayHK自动付款',
        content: 'AlipayHK App→缴费专区→选择机构→输入账单编号绑定→开启自动付款。覆盖近500商户，可赚积分',
        type: 'action',
      },
    ],
    tips: [],
    renewalEvidence: {
      produces: false,
    },
    reminderTrigger: null,
    documentLink: null,
    aiChatContext: null,
    officialLinks: [
      {
        label: '中电·网上服务',
        url: 'https://www.clp.com.hk',
      },
      {
        label: '港灯·网上服务',
        url: 'https://www.hkelectric.com',
      },
      {
        label: '水务署·电子服务',
        url: 'https://www.wsd.gov.hk/tc/customer-services/online-services/index.html',
      },
    ],
  },
  {
    id: 'onboard-605',
    phase: 6,
    sequence: 5,
    category: '财务税务',
    title: '建立应急基金',
    subtitle: '3-6个月生活费储备——香港生活的安全垫',
    timeEstimate: '10分钟',
    urgency: '建议',
    icon: 'shield',
    applicableTo: {
      visaTypes: 'all',
      familyStatus: 'all',
      arrivalScenario: ['fresh', 'delayed'],
      skipIfExisting: [],
    },
    steps: [
      {
        seq: 1,
        title: '建议储备',
        content: '3-6个月生活费(含租金+日常开销)，存入高流动性户口(活期/定期存款)',
        type: 'info',
      },
      {
        seq: 2,
        title: '存款利率参考',
        content: '众安ZA Bank活期~1-2%，定期~3-4%(视金额和年期)。汇丰/中银定期~2-3%',
        type: 'info',
      },
    ],
    tips: [],
    renewalEvidence: {
      produces: false,
    },
    reminderTrigger: null,
    documentLink: null,
    aiChatContext: null,
    officialLinks: [
      {
        label: '投资者及理财教育委员会',
        url: 'https://www.ifec.org.hk',
      },
      {
        label: '积金局·理财工具',
        url: 'https://www.mpfa.org.hk/tch/mpf_education/tools/',
      },
    ],
  },
  {
    id: 'onboard-606',
    phase: 6,
    sequence: 6,
    category: '财务税务',
    title: '了解薪俸税扣税项目并规划',
    subtitle: '每年3月31日前做税务规划，善用扣税项目',
    timeEstimate: '15分钟',
    urgency: '必修',
    icon: 'calculator',
    applicableTo: {
      visaTypes: 'all',
      familyStatus: 'all',
      arrivalScenario: ['fresh', 'delayed'],
      skipIfExisting: [],
    },
    steps: [
      {
        seq: 1,
        title: '主要扣税项目',
        content: '住宅租金$100k/MPF强制$18k/自愿医保$8k/合资格年金+MPF自愿$60k/居所贷款利息$100k/慈善捐款(35%入息)',
        type: 'info',
      },
      {
        seq: 2,
        title: '节税案例',
        content: '月入$40k，租金扣$100k+MPF$18k+基本$132k→应课税$230k→税款~$18,100。加1名子女→税款~$1,000',
        type: 'info',
      },
    ],
    tips: ['每年3月31日前做规划(购买医保/做慈善/供MPF)', '税率比较：累进(2-17%)vs标准(15%)→取较低者'],
    renewalEvidence: {
      produces: false,
    },
    reminderTrigger: null,
    documentLink: null,
    aiChatContext: null,
    officialLinks: [
      {
        label: '税务局·免税额/扣税',
        url: 'https://www.ird.gov.hk/chi/paf/pam.htm',
      },
      {
        label: '税务局·薪俸税计算',
        url: 'https://www.ird.gov.hk/chi/ese/st_comp_2025_26_budget/cstc.htm',
      },
      {
        label: '自愿医保扣税',
        url: 'https://www.vhis.gov.hk',
      },
    ],
  },
  {
    id: 'onboard-610',
    phase: 6,
    sequence: 7,
    category: '财务税务',
    title: '注册香港公司',
    subtitle: '自雇/创业第一步——BR+CI两证到手',
    timeEstimate: '30分钟',
    urgency: '建议',
    icon: 'briefcase',
    applicableTo: {
      visaTypes: 'all',
      familyStatus: 'all',
      arrivalScenario: ['fresh', 'delayed'],
      skipIfExisting: [],
    },
    steps: [
      {
        seq: 1,
        title: '选择公司类型',
        content:
          '私人有限公司(Limited)=最常用，股东责任有限。注册时可选择1人公司（自雇最简）或多人公司（合伙）。无限公司不推荐——个人承担无限责任。',
        type: 'info',
      },
      {
        seq: 2,
        title: '准备注册材料',
        content:
          '公司名称（中英文任选，查册确保不重名）/ 注册资本（默认HK$1万，无需实缴）/ 董事+股东身份证明（通行证/护照副本+地址证明）/ 公司秘书（必须委任，可用秘书公司约$1,000-3,000/年）/ 注册地址（可用商务中心$200-500/月）',
        type: 'action',
      },
      {
        seq: 3,
        title: '线上注册(CR eFiling)',
        content:
          '登入公司注册处eCR(eportal.cr.gov.hk)→填表NNC1→上传材料→缴费(电子提交HK$1,545)→1-5工作天获批→获发BR(商业登记证)+CI(公司注册证书)',
        type: 'action',
      },
      {
        seq: 4,
        title: '注册后30天内',
        content:
          '①开立公司银行户口(汇丰/中银商业户口，1-2周审批) ②商业登记证续期(每年HK$2,150) ③刻公司印章(圆章+签名章，约$100-300) ④如实际运营:投保雇员补偿保险(强制)',
        type: 'checklist',
      },
    ],
    requiredItems: ['身份证明文件', '地址证明', 'HK$1,545注册费'],
    officialLinks: [
      {
        label: '公司注册处eCR',
        url: 'https://eportal.cr.gov.hk',
      },
      {
        label: '商业登记署',
        url: 'https://www.ird.gov.hk',
      },
    ],
    tips: [
      '1人自雇公司=给自己发工资+供MPF=最灵活的续签模式',
      '注册地址可用商务中心(月租$200-500)，不需要实体办公室',
      '秘书公司年费$1,000-3,000',
      '公司银行户口比个人户口审批更严，预留2-4周',
    ],
    pitfalls: [
      '公司注册不等于可以立即发工资——必须先开公司银行户口',
      '商业登记证每年必须续期，逾期罚款$300+',
      '无限公司不等于简化——个人对公司全部债务承担无限责任',
    ],
    renewalEvidence: {
      produces: true,
      docType: '商业登记证+公司注册证书',
      docCategory: 'employment',
      collectMethod: 'photo',
      isRequiredForRenewal: true,
      renewalTip: 'BR+CI是自雇续签的核心证明。续签时入境处会核查公司真实运营状态。',
    },
    reminderTrigger: null,
    documentLink: null,
    aiChatContext: null,
  },
  {
    id: 'onboard-611',
    phase: 6,
    sequence: 8,
    category: '财务税务',
    title: '雇主强积金开户',
    subtitle: '自雇/雇主必须为雇员和自己供MPF——否则违法',
    timeEstimate: '20分钟',
    urgency: '建议',
    icon: 'piggy',
    applicableTo: {
      visaTypes: 'all',
      familyStatus: 'all',
      arrivalScenario: ['fresh', 'delayed'],
      skipIfExisting: [],
    },
    steps: [
      {
        seq: 1,
        title: '自雇人士MPF义务',
        content:
          '自雇人士（包括公司董事给自己发薪）必须登记MPF。月入>=HK$7,100须供款5%（上限HK$1,500）。即使月入<$7,100也须登记但免供款。逾期登记最高罚款HK$5,000+欠款20%附加费。',
        type: 'info',
      },
      {
        seq: 2,
        title: '雇主MPF开户',
        content:
          '选择MPF受托人（汇丰/中银/宏利/AIA等）→填写雇主申请表→提交公司BR+CI副本→开设雇主MPF户口→为雇员（包括自己）登记参加强积金计划。雇主额外供款5%（共10%入雇员账户）。',
        type: 'action',
      },
      {
        seq: 3,
        title: '每月供款流程',
        content:
          '每月10日前提交供款→计算雇员有关入息（上限$30,000/月）→雇主+雇员各5%→2025年起取消对冲机制→积金易eMPF平台统一管理（2024年6月启用）',
        type: 'info',
      },
    ],
    requiredItems: ['公司BR+CI', '银行户口', '雇员名单（含自己）'],
    officialLinks: [
      {
        label: '积金局',
        url: 'https://www.mpfa.org.hk',
      },
      {
        label: '积金易eMPF',
        url: 'https://www.empf.org.hk',
      },
    ],
    tips: [
      '自雇人士供款可扣税（每年上限$18,000）',
      '月入<$7,100可申请豁免供款但须登记',
      '选择MPF计划时比较管理费和基金表现',
      '2025年5月起取消对冲——遣散费不可再用MPF雇主供款抵扣',
    ],
    pitfalls: [
      '雇主不供款=刑事罪行，最高罚款$350,000+监禁3年',
      '即使只有自己一个员工也必须设立雇主MPF户口',
      '受雇和自雇双重身份须分别供款',
    ],
    renewalEvidence: {
      produces: true,
      docType: '强积金雇主供款记录',
      docCategory: 'employment',
      collectMethod: 'photo',
      isRequiredForRenewal: true,
      renewalTip: "雇主MPF供款记录是自雇续签的'两址两单'核心材料之一。",
    },
    reminderTrigger: null,
    documentLink: null,
    aiChatContext: null,
  },
  {
    id: 'onboard-612',
    phase: 6,
    sequence: 9,
    category: '财务税务',
    title: '公司年审与利得税报税',
    subtitle: '每年必须做的三件事——年审+报税+更新BR',
    timeEstimate: '20分钟',
    urgency: '建议',
    icon: 'tax',
    applicableTo: {
      visaTypes: 'all',
      familyStatus: 'all',
      arrivalScenario: ['fresh', 'delayed'],
      skipIfExisting: [],
    },
    steps: [
      {
        seq: 1,
        title: '周年申报(NAR1)',
        content:
          '每周年向公司注册处递交NAR1表格→更新董事/股东/秘书资料→费用HK$105（电子提交）→逾期42天内罚HK$870→逾期超9个月最高罚HK$3,480',
        type: 'action',
      },
      {
        seq: 2,
        title: '利得税报税',
        content:
          '税务局每年4月发出BIR51报税表→1个月内递交→附审计报告+利得税计算表。首年可获12个月延期。税率：首200万利润8.25%，超出部分16.5%。',
        type: 'action',
      },
      {
        seq: 3,
        title: '商业登记续期与审计',
        content:
          'BR每年续期(HK$2,150/年)→过期续期追加罚款。所有有限公司必须每年聘请执业会计师做审计(费用约$5,000-20,000视营业额)。小型公司(收入<$200万)可做简化审计。',
        type: 'info',
      },
      {
        seq: 4,
        title: '续签自雇材料包',
        content:
          '入境处自雇续签核心六件套：①有效BR+CI ②经审计的财务报告 ③利得税评税通知书 ④办公室租约(或商务中心合约) ⑤MPF雇主供款记录 ⑥公司银行月结单。建议每季度整理一次。',
        type: 'info',
      },
    ],
    requiredItems: ['公司BR+CI', '银行月结单', '业务单据'],
    officialLinks: [
      {
        label: '公司注册处',
        url: 'https://www.cr.gov.hk',
      },
      {
        label: '税务局利得税',
        url: 'https://www.ird.gov.hk',
      },
    ],
    tips: [
      '聘用执业会计师费用可计入公司支出抵税',
      '简化审计门槛：收入<$200万可用中小企财务报告准则',
      '公司文件保存7年(公司法规定)',
      '即使公司无利润也要做审计和报税',
    ],
    pitfalls: [
      '零申报不等于不审计——香港所有有限公司都必须审计',
      '逾期年审罚款递增快——NAR1逾期9个月罚$3,480',
      '续签时公司不能是空壳——必须证明真实业务运营',
    ],
    renewalEvidence: {
      produces: true,
      docType: '审计报告+利得税评税通知',
      docCategory: 'employment',
      collectMethod: 'photo',
      isRequiredForRenewal: true,
      renewalTip: "审计报告+利得税评税通知书是自雇续签的'两址两单'核心税单证明。",
    },
    reminderTrigger: null,
    documentLink: null,
    aiChatContext: null,
  },
  {
    id: 'onboard-613',
    phase: 6,
    sequence: 10,
    category: '财务税务',
    title: '自雇人士个人报税',
    subtitle: '给自己发工资→个人薪俸税——自雇续签的税单来源',
    timeEstimate: '20分钟',
    urgency: '建议',
    icon: 'tax',
    applicableTo: {
      visaTypes: 'all',
      familyStatus: 'all',
      arrivalScenario: ['fresh', 'delayed'],
      skipIfExisting: [],
    },
    steps: [
      {
        seq: 1,
        title: '给自己发薪的税务逻辑',
        content:
          "公司给自己(董事)发月薪→公司代扣MPF→公司向税务局申报IR56B→个人收到BIR60报税→提交个人薪俸税申报→获评税通知书(税单)。月薪建议>=HK$30,000以确保续签时'在港有合理收入'",
        type: 'info',
      },
      {
        seq: 2,
        title: '个人报税流程',
        content:
          '每年5月收到BIR60绿色信封→1个月内线上(eTax)或邮寄递交→10-11月收到评税通知书→翌年1月缴第一期(75%)→4月缴第二期(25%)。eTax可延期至2个月。',
        type: 'action',
      },
      {
        seq: 3,
        title: '自雇人士扣税清单',
        content:
          'MPF供款$18,000(强制)+$60,000(自愿)/ 住宅租金$100,000 / 自愿医保$8,000/人 / 居所贷款利息$100,000 / 进修开支$100,000 / 慈善捐款<=应评税入息35%',
        type: 'info',
      },
    ],
    requiredItems: ['公司BR+CI', '个人银行月结单', 'MPF供款记录'],
    officialLinks: [
      {
        label: '税务局eTax',
        url: 'https://www.gov.hk/etax',
      },
    ],
    tips: [
      "给自己发薪时月薪不要太低——续签时入境处会看'在港有合理收入'",
      "薪俸税+利得税=双税单=续签最强'在港贡献'证明",
      '建议月薪HK$30,000-50,000(覆盖MPF上限+显示正常收入水平)',
    ],
    pitfalls: [
      '公司亏损不是你个人不报税的理由——个人薪俸税和公司利得税是分开的',
      '给自己发薪时必须有实际银行转账记录(不能是账面数字)',
      '不要频繁调整自己工资——入境处会质疑公司运营稳定性',
    ],
    renewalEvidence: {
      produces: true,
      docType: '个人评税通知书',
      docCategory: 'employment',
      collectMethod: 'photo',
      isRequiredForRenewal: true,
      renewalTip: '个人薪俸税评税通知书+利得税评税通知书=自雇续签双税单黄金组合。',
    },
    reminderTrigger: null,
    documentLink: null,
    aiChatContext: null,
  },
];
