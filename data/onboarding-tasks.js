/**
 * 港漂通关手册 — 任务模板库
 *
 * 共 49 个任务模板, 覆盖 8 个关卡 (phase 0-7)
 *
 * 编号规则: onboard-{phase}{seq}
 *   关卡0(抵港前): onboard-0xx
 *   关卡1(落地生存): onboard-1xx
 *   关卡2(行政开户): onboard-2xx
 *   关卡3(安居乐业): onboard-3xx
 *   关卡4(出行融入): onboard-4xx
 *   关卡5(子女教育): onboard-5xx
 *   关卡6(财务税务): onboard-6xx
 *   关卡7(续签准备): onboard-7xx
 *
 * urgency: "必修" | "建议" | "可选"
 * collectMethod: "photo" | "select" | "manual" | null
 * docCategory: "address" | "employment" | "family" | "visa" | "auxiliary" | null
 */

module.exports = [
  // ═══════════════════════════════════════════════════════════════
  // 关卡0: 抵港前准备 (5项)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "onboard-001", phase: 0, sequence: 1, category: "抵港前准备",
    title: "确认签证标签页信息无误",
    subtitle: "姓名、证件号、有效期，一个错都不能有",
    timeEstimate: "10分钟", urgency: "必修", icon: "visa",
    applicableTo: {
      visaTypes: "all", familyStatus: "all",
      arrivalScenario: ["pre-arrival"], skipIfExisting: []
    },
    steps: [
      { seq: 1, title: "核对个人信息", content: "检查标签页上的姓名拼音是否与护照/港澳通行证完全一致。检查证件号码、出生日期是否正确。", type: "checklist" },
      { seq: 2, title: "核对签证信息", content: "检查签证类别是否正确。检查有效期和逗留期限。注意：签证标签页上的日期格式为DD-MM-YYYY。", type: "checklist" },
      { seq: 3, title: "拍照留存", content: "用手机拍下签证标签页正反面，保存到手机相册。这张照片在后续关卡中需要用到。", type: "action" }
    ],
    requiredItems: ["签证标签页", "护照/港澳通行证"],
    officialLinks: [{ label: "入境事务处", url: "https://www.immd.gov.hk" }],
    tips: ["如发现信息有误，立即联系入境处更正，不要等到过关时才发现", "建议打印一份纸质版随身携带"],
    pitfalls: ["签证标签页上的英文名必须与护照完全一致，包括空格和连字符", "逗留期限≠签证有效期，不要混淆"],
    renewalEvidence: { produces: true, docType: "签证标签页照片", docCategory: "visa", collectMethod: "photo", isRequiredForRenewal: true, expiryCheck: null, renewalTip: "签证标签页是续签时入境处核对身份的基础文件，务必保存清晰照片。" },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-002", phase: 0, sequence: 2, category: "抵港前准备",
    title: "准备过关文件包",
    subtitle: "过关时被卡住就尴尬了——提前备齐",
    timeEstimate: "15分钟", urgency: "必修", icon: "folder",
    applicableTo: {
      visaTypes: "all", familyStatus: "all",
      arrivalScenario: ["pre-arrival"], skipIfExisting: []
    },
    steps: [
      { seq: 1, title: "整理必备文件", content: "护照/港澳通行证（有效期≥6个月）+ 签证标签页 + 入境小白条（过关时获发，务必保留）。建议准备一个透明文件袋统一收纳。", type: "checklist" },
      { seq: 2, title: "准备辅助文件", content: "香港雇佣合约副本（如有）、住宿预订确认（如有）、学位证书/专业资格证书（日后可能用到）。", type: "info" },
      { seq: 3, title: "准备现金", content: "建议携带HK$5,000-10,000现金。香港很多地方（街市/茶餐厅/的士）只收现金或八达通。在内地银行提前兑换，汇率更优。", type: "action" }
    ],
    requiredItems: ["护照/港澳通行证（有效期≥6个月）", "签证标签页", "透明文件袋", "HK$5,000-10,000现金"],
    officialLinks: [],
    tips: ["过关时获发的小白条是一张小纸片，极容易丢失——拿到后立刻拍照并放入文件袋", "如携带超过HK$12万等值现金/不记名票据，须向海关申报"],
    pitfalls: ["护照有效期不足6个月可能被拒绝入境", "港澳通行证上的签注（D签）必须与签证标签页的逗留期限对应"],
    renewalEvidence: { produces: false, docType: null, docCategory: null, collectMethod: null, isRequiredForRenewal: false, expiryCheck: null, renewalTip: null },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-003", phase: 0, sequence: 3, category: "抵港前准备",
    title: "预约办理香港身份证",
    subtitle: "先约身份证，再定过关日——同一天办完少跑一趟",
    timeEstimate: "10分钟", urgency: "必修", icon: "idcard",
    applicableTo: {
      visaTypes: "all", familyStatus: "all",
      arrivalScenario: ["pre-arrival"], skipIfExisting: ["hkid"]
    },
    steps: [
      { seq: 1, title: "网上预约", content: "登入入境处网上预约系统（gov.hk/icbooking），选择「申领香港智能身份证」。填写姓名、证件号码、出生日期。", type: "action" },
      { seq: 2, title: "选择办理日期——这是关键一步", content: "先定身份证预约日期，再据此安排过关日。最佳策略：预约在过关当天或次日，激活签证+办身份证一趟搞定。湾仔总部最满，九龙（长沙湾/观塘）或新界（火炭/元朗/屯门）更容易约到。每天上午9点释放新名额。", type: "action" },
      { seq: 3, title: "根据预约日期反推过关日", content: "确认预约日期后，再安排过关激活签证的日期（建议提前1天或当天）。过关日确定后，依次预订交通、住宿、准备过关文件包。", type: "action" },
      { seq: 4, title: "保存预约确认", content: "截图保存预约确认页面（含预约编号、日期、时间、地点）。过关激活签证后按预约时间前往办理。", type: "action" }
    ],
    requiredItems: ["护照/港澳通行证号码"],
    officialLinks: [{ label: "入境处网上预约", url: "https://www.gov.hk/icbooking" }],
    tips: ["核心策略：先约身份证→再定过关日→最后订交通住宿。一趟搞定激活+办证", "每天上午9点释放新的预约名额，热门时段竞争激烈", "火炭办事处通常比湾仔容易约到", "预约可更改两次，如需改期尽早操作"],
    pitfalls: ["不要先订机票酒店再约身份证——预约日期可能不理想，到时候改机票成本高", "入境后30天内必须申领身份证，逾期可能被检控", "网上预约需输入在港联系电话，可先填酒店/朋友电话"],
    renewalEvidence: { produces: true, docType: "预约确认截图", docCategory: "visa", collectMethod: "photo", isRequiredForRenewal: false, expiryCheck: null, renewalTip: "预约确认不是必须的续签材料，但保留可作为你抵港后及时办理行政手续的时间证据。" },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-004", phase: 0, sequence: 4, category: "抵港前准备",
    title: "下载必备App",
    subtitle: "到了香港再下载可能来不及——提前装好",
    timeEstimate: "15分钟", urgency: "建议", icon: "download",
    applicableTo: {
      visaTypes: "all", familyStatus: "all",
      arrivalScenario: ["pre-arrival"], skipIfExisting: []
    },
    steps: [
      { seq: 1, title: "交通出行类", content: "MTR Mobile（港铁路线/票价/班次）、Citybus/九巴App（巴士路线/到站时间）、Uber/滴滴出行（叫车）。高德地图在香港可用但精度不如Google Maps。", type: "action" },
      { seq: 2, title: "支付与生活类", content: "AlipayHK（香港支付宝）、八达通App（管理八达通卡）、PayMe（汇丰旗下的电子钱包）。内地支付宝/微信支付在香港部分商户可用但不全面。", type: "action" },
      { seq: 3, title: "政府与医疗类", content: "HA Go（医管局一站式医疗App）、智方便iAM Smart（政府数码身份认证）、My SmartPLAY（康文署运动场地预约）。", type: "action" },
      { seq: 4, title: "资讯与社交类", content: "WhatsApp（香港主流即时通讯工具）。香港01/明报/经济日报（了解本地新闻）。OpenRice（香港版大众点评）。", type: "info" }
    ],
    requiredItems: ["智能手机（剩余存储空间≥2GB）", "Apple ID / Google Play账号"],
    officialLinks: [
      { label: "MTR Mobile", url: "https://www.mtr.com.hk/mtrmobile" },
      { label: "HA Go", url: "https://www.ha.org.hk" }
    ],
    tips: ["AlipayHK需香港手机号注册，抵港后才能完成——但可以先下载", "智方便+需2018年11月后签发的新智能身份证+NFC手机才能登记"],
    pitfalls: ["内地手机号注册的Apple ID可能无法下载部分香港App——建议提前准备香港Apple ID", "香港的App生态以iOS为主，部分App的Android版本功能较少"],
    renewalEvidence: { produces: false, docType: null, docCategory: null, collectMethod: null, isRequiredForRenewal: false, expiryCheck: null, renewalTip: null },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-005", phase: 0, sequence: 5, category: "抵港前准备",
    title: "了解抵港当日路线",
    subtitle: "拖着行李箱迷路，第一天就崩溃——提前规划",
    timeEstimate: "20分钟", urgency: "建议", icon: "map",
    applicableTo: {
      visaTypes: "all", familyStatus: "all",
      arrivalScenario: ["pre-arrival"], skipIfExisting: []
    },
    steps: [
      { seq: 1, title: "确定抵达口岸", content: "机场：香港国际机场（最常用）。高铁：西九龙站（内地高铁直达）。陆路口岸：深圳湾/罗湖/落马洲/港珠澳大桥。", type: "info" },
      { seq: 2, title: "规划从口岸到住处的交通", content: "机场→市区：机场快线（24分钟到中环，HK$115）/ 机场巴士（较便宜但较慢，HK$20-40）/ 的士（约HK$250-400）。高铁西九龙→市区：步行至柯士甸/九龙站转港铁。", type: "action" },
      { seq: 3, title: "准备抵达当日的通讯方案", content: "机场可以买八达通（MTR客务中心/7-Eleven）。抵达后第一件事——买电话卡或连机场WiFi。机场有免费WiFi（限时30分钟）。", type: "info" }
    ],
    requiredItems: ["手机（提前下载离线地图/截图路线）", "少量港币现金（买车票/八达通用）"],
    officialLinks: [
      { label: "香港机场交通", url: "https://www.hongkongairport.com" },
      { label: "MTR港铁路线图", url: "https://www.mtr.com.hk" }
    ],
    tips: ["如果住在新界（屯门/元朗/上水），深圳湾口岸最方便", "机场快线多人同行有团体票优惠", "Google Maps在香港的公共交通规划准确度很高"],
    pitfalls: ["的士司机可能不认识新界偏远地址——提前准备中英文地址写在纸上", "高铁到西九龙站后是「一地两检」，过关后就在香港境内了"],
    renewalEvidence: { produces: false, docType: null, docCategory: null, collectMethod: null, isRequiredForRenewal: false, expiryCheck: null, renewalTip: null },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  // ═══════════════════════════════════════════════════════════════
  // 关卡1: 落地生存 Day 1-3 (5项)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "onboard-101", phase: 1, sequence: 1, category: "落地生存",
    title: "购买八达通",
    subtitle: "香港人的第二张身份证——没有它寸步难行",
    timeEstimate: "10分钟", urgency: "必修", icon: "card",
    applicableTo: {
      visaTypes: "all", familyStatus: "all",
      arrivalScenario: ["fresh"], skipIfExisting: []
    },
    steps: [
      { seq: 1, title: "找到购买点", content: "机场抵境大堂：MTR客务中心、7-Eleven、Travelex柜台。市区：任意港铁站客务中心、7-Eleven、Circle K。", type: "info" },
      { seq: 2, title: "购买成人租用版", content: "售价HK$150：含$50可退还押金+$100储值额。如带小孩：长者/小童租用版HK$70（$50押金+$20储值额）。", type: "action" },
      { seq: 3, title: "下载八达通App并绑定", content: "绑定后可手机增值、查阅余额和消费记录。iPhone用户可将实体卡转移至Apple Wallet（转移后实体卡失效）。", type: "action" }
    ],
    requiredItems: ["现金HK$150（成人）/ HK$70（小童/长者）"],
    officialLinks: [{ label: "八达通官网", url: "https://www.octopus.com.hk" }],
    tips: ["机场7-Eleven 24小时营业，凌晨抵港也能买", "学生（12-25岁全日制）可申请学生八达通享港铁半价，需2-4周处理", "绑定八达通App后可设置信用卡自动增值"],
    pitfalls: ["旅客八达通（HK$39纪念卡）不含储值额，不推荐", "转移至Apple Wallet后实体卡失效且不可逆"],
    renewalEvidence: { produces: false, docType: null, docCategory: null, collectMethod: null, isRequiredForRenewal: false, expiryCheck: null, renewalTip: null },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-102", phase: 1, sequence: 2, category: "落地生存",
    title: "上台电话卡",
    subtitle: "四大电讯商5G套餐对比——选对一年省上千",
    timeEstimate: "30分钟", urgency: "必修", icon: "phone",
    applicableTo: {
      visaTypes: "all", familyStatus: "all",
      arrivalScenario: ["fresh"], skipIfExisting: []
    },
    steps: [
      { seq: 1, title: "了解四大电讯商", content: "3HK（$148/月，100GB+中港澳6GB，北上常客首选）；CMHK中国移动（$149/月，100GB+中澳2GB，条软简单免行政费）；CSL（$138-168/月，送Perplexity Pro AI服务）；SmarTone（$179/月，送$1,000手机礼券+爆芒保）。", type: "info" },
      { seq: 2, title: "选择套餐并上台", content: "携同香港身份证+地址证明前往电讯商门市。如未有香港身份证，部分电讯商接受护照+入境记录。上台通常需签24-36个月合约。", type: "action" },
      { seq: 3, title: "上台后设置", content: "下载电讯商App管理账户。设定自动缴费（绑定信用卡/银行户口）。了解数据用量和超额费用。", type: "action" }
    ],
    requiredItems: ["香港身份证（如有）或护照+入境记录", "地址证明", "现金/信用卡（首期月费+行政费）"],
    officialLinks: [
      { label: "3HK", url: "https://www.three.com.hk" },
      { label: "CMHK", url: "https://www.hk.chinamobile.com" },
      { label: "CSL", url: "https://www.hkcsl.com" },
      { label: "SmarTone", url: "https://www.smartone.com" }
    ],
    tips: ["如上水/粉岭/上环的街边电话卡店买储值卡更便宜但不稳定，建议上台", "CMHK中国移动价格亲民、简单均真，适合不想研究条款的用户", "经常北上深圳/珠海→3HK；预算有限→CMHK"],
    pitfalls: ["携号转台（MNP）通常比新号码上台多送优惠", "合约期内提前解约需支付剩余月份费用", "部分优惠属限时推广，实际价格以官网为准"],
    renewalEvidence: { produces: false, docType: null, docCategory: null, collectMethod: null, isRequiredForRenewal: false, expiryCheck: null, renewalTip: null },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-103", phase: 1, sequence: 3, category: "落地生存",
    title: "开通AlipayHK",
    subtitle: "香港版支付宝——缴费、搭车、汇款一站搞定",
    timeEstimate: "15分钟", urgency: "必修", icon: "wallet",
    applicableTo: {
      visaTypes: "all", familyStatus: "all",
      arrivalScenario: ["fresh"], skipIfExisting: []
    },
    steps: [
      { seq: 1, title: "下载并注册", content: "App Store/Google Play搜索「AlipayHK」下载。使用香港手机号注册。如已有内地支付宝，需重新注册香港版（两个独立App）。", type: "action" },
      { seq: 2, title: "完成认证", content: "中级认证：上传香港身份证+自拍。中级每日汇款限额HK$7,999。高级认证需额外文件，每日汇款限额HK$2万。", type: "action" },
      { seq: 3, title: "绑定缴费账户", content: "搜寻「缴费专区」→选择机构（中电/港灯/煤气/水务署/差饷）→输入账单编号→开启自动付款。覆盖近500个缴费商户。", type: "action" }
    ],
    requiredItems: ["香港手机号", "香港身份证"],
    officialLinks: [{ label: "AlipayHK", url: "https://www.alipayhk.com" }],
    tips: ["绑定信用卡缴费可赚积分/回赠", "内地消费可直接用AlipayHK支付（汇率自动换算）", "跨境汇款至内地银行账户每日限额按认证级别"],
    pitfalls: ["AlipayHK和内地支付宝是两个独立App，不能通用", "未完成认证前很多功能受限"],
    renewalEvidence: { produces: false, docType: null, docCategory: null, collectMethod: null, isRequiredForRenewal: false, expiryCheck: null, renewalTip: null },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-104", phase: 1, sequence: 4, category: "落地生存",
    title: "办理香港身份证（按预约）",
    subtitle: "抵港后30天内必须办理——按之前预约的时间前往",
    timeEstimate: "1-2小时", urgency: "必修", icon: "idcard",
    applicableTo: {
      visaTypes: "all", familyStatus: "all",
      arrivalScenario: ["fresh"], skipIfExisting: ["hkid"]
    },
    steps: [
      { seq: 1, title: "出发前准备", content: "带齐文件：护照/港澳通行证+签证标签页+入境小白条+预约确认（截图或打印）。如已在关卡0完成了预约，直接按预约时间前往。", type: "checklist" },
      { seq: 2, title: "现场办理", content: "按预约时间到达指定入境处办事处→取号→拍照→打指模→领取「申请身份证收据」（临时身份证）。办理过程约30-45分钟。", type: "action" },
      { seq: 3, title: "领取正式身份证", content: "办理后约10个工作天可领取正式香港智能身份证。凭收据和身份证明文件在指定日期后前往同一办事处领取。", type: "action" }
    ],
    requiredItems: ["护照/港澳通行证", "签证标签页", "入境小白条", "预约确认"],
    officialLinks: [{ label: "入境处身份证预约", url: "https://www.gov.hk/icbooking" }],
    tips: ["拍照时可以微笑但不能露齿", "建议穿深色有领上衣，背景为白色", "临时身份证收据也是一份重要文件——保留至领取正式身份证"],
    pitfalls: ["入境后30天内必须申领，逾期可能被检控", "如错过预约时间，需重新网上预约"],
    renewalEvidence: { produces: true, docType: "临时身份证收据", docCategory: "visa", collectMethod: "photo", isRequiredForRenewal: false, expiryCheck: null, renewalTip: "收据证明你已在法定期限内申领身份证，是可选的辅助证据。" },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-105", phase: 1, sequence: 5, category: "落地生存",
    title: "下载关键App并完成初始设置",
    subtitle: "MTR Mobile、Google Maps、WhatsApp——三个App搞定出行+通讯",
    timeEstimate: "15分钟", urgency: "建议", icon: "download",
    applicableTo: {
      visaTypes: "all", familyStatus: "all",
      arrivalScenario: ["fresh"], skipIfExisting: []
    },
    steps: [
      { seq: 1, title: "出行三件套", content: "MTR Mobile（港铁路线/票价/班次/都会票购买）、Google Maps（香港公共交通规划准确度很高）、Uber/滴滴出行（Call车用）。", type: "action" },
      { seq: 2, title: "通讯必备", content: "WhatsApp（香港主流即时通讯工具，几乎所有香港人都用）。下载后绑定香港手机号即可。", type: "action" },
      { seq: 3, title: "生活辅助", content: "OpenRice（香港版大众点评，找餐厅看评价）。我的天文台（香港天文台官方天气App，台风/暴雨警告推送）。", type: "info" }
    ],
    requiredItems: ["智能手机（剩余存储空间≥1GB）"],
    officialLinks: [
      { label: "MTR Mobile", url: "https://www.mtr.com.hk/mtrmobile" },
      { label: "我的天文台", url: "https://www.hko.gov.hk" }
    ],
    tips: ["MTR Mobile可购买电子都会票（$460/40程，平均$11.5/程）", "Google Maps的公共交通规划在香港比高德/百度地图更准"],
    pitfalls: ["WhatsApp需手机号验证，建议用香港号注册（工作联系用）", "香港的的士App生态较分散，Uber覆盖率最高"],
    renewalEvidence: { produces: false, docType: null, docCategory: null, collectMethod: null, isRequiredForRenewal: false, expiryCheck: null, renewalTip: null },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  // ═══════════════════════════════════════════════════════════════
  // 关卡2: 行政开户 (7项)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "onboard-201", phase: 2, sequence: 1, category: "行政开户",
    title: "开立香港银行户口",
    subtitle: "中银门槛最低，内地身份友好",
    timeEstimate: "1-2小时", urgency: "必修", icon: "bank",
    applicableTo: {
      visaTypes: "all", familyStatus: "all",
      arrivalScenario: ["fresh", "delayed"], skipIfExisting: ["bank-account"]
    },
    steps: [
      { seq: 1, title: "准备材料", content: "HK身份证+逗留签注+地址证明近3个月内+内地二代身份证+港澳通行证+入境小白条", type: "info" },
      { seq: 2, title: "选择银行并预约", content: "首选中银香港（门槛低/内地身份友好/支持内地地址证明），次选汇丰One（网点多/全球转账），备选ZA Bank（纯线上辅助）", type: "info" },
      { seq: 3, title: "亲临分行办理", content: "按预约时间到达，非永久居民不可豁免地址证明，开户用途需明确（工资入账+日常消费+跨境汇款），柜台约30-45min", type: "action" }
    ],
    requiredItems: ["HK身份证(如有)", "内地二代身份证", "港澳通行证", "入境小白条", "地址证明", "现金HK$500-1000"],
    officialLinks: [{ label: "中银香港", url: "https://www.bochk.com" }, { label: "汇丰One", url: "https://www.hsbc.com.hk" }],
    tips: ["尚无香港地址证明时中银可接受内地地址证明", "12月内被拒3次→标记高风险客户→等6月", "逗留签注有效期需≥180天"],
    pitfalls: ["地址证明上姓名须与证件完全一致", "月入8000却申请500万理财=可疑", "截图电子账单不被接受"],
    renewalEvidence: { produces: true, docType: "银行开户确认函", docCategory: "address", collectMethod: "photo", isRequiredForRenewal: true, expiryCheck: null, renewalTip: "银行开户确认函是地址证明的重要交叉验证材料。建议同时开户后90天内完成首笔交易验证。" },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-202", phase: 2, sequence: 2, category: "行政开户",
    title: "获取有效地址证明",
    subtitle: "香港最常用的身份凭证之一",
    timeEstimate: "1-2小时", urgency: "必修", icon: "document",
    applicableTo: {
      visaTypes: "all", familyStatus: "all",
      arrivalScenario: ["fresh", "delayed"], skipIfExisting: ["rental"]
    },
    steps: [
      { seq: 1, title: "了解什么是有效地址证明", content: "水电煤账单/银行月结单/政府函件/已打厘印租约。不接受的：截图电子账单/快递单/手机话费单/手写证明", type: "info" },
      { seq: 2, title: "获取第一份地址证明", content: "如已完成银行开户→首月银行月结单（最简便）；如已租房→已打厘印租约；如已申请水电煤→首期账单", type: "action" },
      { seq: 3, title: "保存多份地址证明", content: "建议保存至少2-3份不同来源的地址证明（银行+水电+租约），不同机构可能要求不同类型", type: "action" },
      { seq: 4, title: "定期更新", content: "地址证明通常要求“近3个月内”，每季度需要新的账单", type: "info" }
    ],
    requiredItems: ["银行月结单或租约或水电煤账单"],
    officialLinks: [],
    tips: ["银行月结单是最容易获取的地址证明", "水务署转名免费", "可要求银行发出正式地址确认函（3-7工作天）"],
    pitfalls: ["地址证明上姓名须与证件完全一致", "截图电子账单不被接受", "新来港前3个月可能缺乏本地地址证明→用租约+厘印过渡"],
    renewalEvidence: { produces: true, docType: "首期银行月结单", docCategory: "address", collectMethod: "photo", isRequiredForRenewal: true, expiryCheck: null, renewalTip: "首期月结单证明了你在港的经济活动起点。后续每月保存电子版月结单。" },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-203", phase: 2, sequence: 3, category: "行政开户",
    title: "登记HA Go并完成首次线下认证",
    subtitle: "医管局一站式App——预约看病缴费全靠它",
    timeEstimate: "1小时", urgency: "必修", icon: "hospital",
    applicableTo: {
      visaTypes: "all", familyStatus: "all",
      arrivalScenario: ["fresh", "delayed"], skipIfExisting: []
    },
    steps: [
      { seq: 1, title: "下载HA Go App并注册", content: "App Store/Google Play搜索“HA Go”，用香港手机号注册", type: "action" },
      { seq: 2, title: "亲临诊所完成首次线下登记", content: "携HK身份证+地址证明前往任一公立诊所/医院，成人自助，小童家长代携港澳通行证+有效签证，⚠️建议健康时尽早登记", type: "action" },
      { seq: 3, title: "学习预约门诊", content: "HA Go→预约家庭医学诊所→选择诊所→接纳预约时间，🔑抢号秘诀：每小时的29分和59分刷新App", type: "action" }
    ],
    requiredItems: ["HK身份证", "地址证明", "香港手机号"],
    officialLinks: [{ label: "HA Go", url: "https://www.ha.org.hk/hago" }],
    tips: ["小童登记后获发临时证件号码", "65岁以上长者自动轮候长者筹", "65岁以下可抢普通筹"],
    pitfalls: ["必须亲临诊所完成首次登记（不能纯线上）", "两个月内3次失约→失去预约资格"],
    renewalEvidence: { produces: false, docType: null, docCategory: null, collectMethod: null, isRequiredForRenewal: false, expiryCheck: null, renewalTip: null },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-204", phase: 2, sequence: 4, category: "行政开户",
    title: "登记SmartPLAY康体通",
    subtitle: "运动场地预约——政府设施便宜到离谱",
    timeEstimate: "20分钟", urgency: "建议", icon: "sport",
    applicableTo: {
      visaTypes: "all", familyStatus: "all",
      arrivalScenario: ["fresh", "delayed"], skipIfExisting: []
    },
    steps: [
      { seq: 1, title: "下载My SmartPLAY App或访问网页", content: "smartplay.lcsd.gov.hk，需先用“智方便”即时认证", type: "action" },
      { seq: 2, title: "完成登记", content: "全港约240个康乐场地共375个自助服务站，亦可亲临柜台", type: "info" },
      { seq: 3, title: "了解预订规则", content: "7天内可预订，繁忙时间每人每天同类限2小时，羽毛球场$37-59/小时，健身室月票$180/月", type: "info" }
    ],
    requiredItems: ["智方便+登记"],
    officialLinks: [{ label: "SmartPLAY", url: "https://smartplay.lcsd.gov.hk" }],
    tips: ["年满15岁且完成健身房安全课才能用健身室", "全民运动日（8月）多项设施免费", "预约后取消不获退款"],
    pitfalls: ["旧Leisure Link用户也须重新登记", "非HK居民须亲临佐敦SmartPLAY服务中心登记临时用户"],
    renewalEvidence: { produces: false, docType: null, docCategory: null, collectMethod: null, isRequiredForRenewal: false, expiryCheck: null, renewalTip: null },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-205", phase: 2, sequence: 5, category: "行政开户",
    title: "登记智方便+",
    subtitle: "政府数码身份——网上办事省去排队",
    timeEstimate: "15分钟", urgency: "建议", icon: "smart",
    applicableTo: {
      visaTypes: "all", familyStatus: "all",
      arrivalScenario: ["fresh", "delayed"], skipIfExisting: []
    },
    steps: [
      { seq: 1, title: "检查设备条件", content: "需NFC手机（iOS14+/Android12+）+ 2018年11月后签发的新智能身份证", type: "info" },
      { seq: 2, title: "下载智方便App并升级至+", content: "下载“智方便iAM Smart”→“一按升级智方便+”→拍摄身份证→NFC读取→容貌辨识", type: "action" },
      { seq: 3, title: "了解可用服务", content: "网上报税/图书馆登记/运输署预约/医健通等过百项政府服务", type: "info" }
    ],
    requiredItems: ["NFC手机", "新智能身份证（2018年11月后签发）"],
    officialLinks: [{ label: "智方便", url: "https://www.iamsmart.gov.hk" }],
    tips: ["智方便+需要NFC功能→部分平价手机不支持", "可到自助登记站/邮局办理", "11岁以上即可登记"],
    pitfalls: ["2018年前签发的旧身份证不支持", "如无法在线完成可亲临登记服务柜位"],
    renewalEvidence: { produces: false, docType: null, docCategory: null, collectMethod: null, isRequiredForRenewal: false, expiryCheck: null, renewalTip: null },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-206", phase: 2, sequence: 6, category: "行政开户",
    title: "水电煤转名",
    subtitle: "入住后尽快转名——第一期账单就是地址证明",
    timeEstimate: "30分钟", urgency: "建议", icon: "utility",
    applicableTo: {
      visaTypes: "all", familyStatus: "all",
      arrivalScenario: ["fresh", "delayed"], skipIfExisting: ["rental"]
    },
    steps: [
      { seq: 1, title: "确认公用事业供应商", content: "港灯（港岛/南丫岛）/中电（九龙/新界），煤气（全港统一：中华煤气），水务署（全港统一）", type: "info" },
      { seq: 2, title: "逐一办理转名", content: "网上/电话/亲临，所需：身份证+租约+按金", type: "action" },
      { seq: 3, title: "设定自动转账", content: "转名时同时申请自动转账，省去每月手动缴费", type: "action" },
      { seq: 4, title: "保存首期账单", content: "首期水电煤账单是最有力的地址证明", type: "action" }
    ],
    requiredItems: ["HK身份证", "租约", "按金（中电/港灯$300-600，煤气$400，水务署免费）"],
    officialLinks: [{ label: "中电", url: "https://www.clp.com.hk" }, { label: "港灯", url: "https://www.hkelectric.com" }, { label: "中华煤气", url: "https://www.towngas.com" }],
    tips: ["水务署转名免费", "可使用AlipayHK自动付款（覆盖近500商户）", "PayMe 2025年7月起支持煤气/港灯/中电/水务署缴费"],
    pitfalls: ["入住后务必尽快转名，否则前业主/租客的水电煤账户产生的费用可能纠缠", "自动转账处理需6-8周"],
    renewalEvidence: { produces: true, docType: "首期水电煤账单", docCategory: "address", collectMethod: "photo", isRequiredForRenewal: true, expiryCheck: null, renewalTip: "水电煤账单是入境处认可的'通常居住'最强证明。务必保存每期账单。" },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-207", phase: 2, sequence: 7, category: "行政开户",
    title: "申领公共图书馆卡",
    subtitle: "免费借书+电子资源——香港公共图书馆体系很强",
    timeEstimate: "15分钟", urgency: "可选", icon: "library",
    applicableTo: {
      visaTypes: "all", familyStatus: "all",
      arrivalScenario: ["fresh", "delayed"], skipIfExisting: []
    },
    steps: [
      { seq: 1, title: "选择申请方式", content: "方式一：经“智方便+”网上申请（即时生效，可凭智能身份证借书）；方式二：网上申请电子账户（仅电子资源）；方式三：亲临图书馆", type: "info" },
      { seq: 2, title: "完成申请", content: "网上申请→填表→上载身份证+地址证明，年满18岁即时生效", type: "action" }
    ],
    requiredItems: ["HK身份证", "地址证明"],
    officialLinks: [{ label: "香港公共图书馆", url: "https://www.hkpl.gov.hk" }],
    tips: ["每位读者可外借最多10项", "借期14天，可续借5次", "逾期罚款上限：成人$130"],
    pitfalls: [],
    renewalEvidence: { produces: false, docType: null, docCategory: null, collectMethod: null, isRequiredForRenewal: false, expiryCheck: null, renewalTip: null },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  // ═══════════════════════════════════════════════════════════════
  // 关卡3: 安居乐业 (7项)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "onboard-301", phase: 3, sequence: 1, category: "安居乐业",
    title: "签署正式租约并打厘印",
    subtitle: "租约不打厘印=法律上无效——30天内必须做",
    timeEstimate: "2-3小时", urgency: "必修", icon: "home",
    applicableTo: {
      visaTypes: "all", familyStatus: "all",
      arrivalScenario: ["fresh", "delayed"], skipIfExisting: ["rental"]
    },
    steps: [
      { seq: 1, title: "签署正式租约", content: "确认条款：一年死约一年生约/租金是否全包/家电清单/维修责任/宠物/免租期，支付两按一上（2月按金+1月上期）", type: "action" },
      { seq: 2, title: "30日内打厘印", content: "签正约后30日内到税务局打厘印（网上可办），印花税率：1年内0.25%/1-3年0.5%/3年以上1%", type: "action" },
      { seq: 3, title: "确认业主递交CR109表格", content: "提醒业主递交至差饷物业估价署", type: "action" },
      { seq: 4, title: "支付全部首期费用", content: "以月租$15,000为例→按金$30,000+首月$15,000+代理佣金$7,500+印花税~$450=~$52,950", type: "info" },
      { seq: 5, title: "保存所有文件", content: "租约+厘印证明+CR109回执", type: "action" }
    ],
    requiredItems: ["HK身份证", "现金/支票（按金+首月租金+佣金+印花税）"],
    officialLinks: [{ label: "税务局印花税", url: "https://www.ird.gov.hk" }],
    tips: ["打厘印可在网上办理（ird.gov.hk）", "逾期打厘印罚款为印花税2-10倍", "代理佣金通常为半月租（业主和租客各付一半）"],
    pitfalls: ["未打厘印的租约在法律上不可强制执行", "如业主未通知银行擅自出租'自住'物业→断供→银行有权收楼→租客可能不获赔偿", "睇楼前必须签署睇楼纸（有效期3月）"],
    renewalEvidence: { produces: true, docType: "已打厘印租约", docCategory: "address", collectMethod: "photo", isRequiredForRenewal: true, expiryCheck: null, renewalTip: "已打厘印的租约是续签时'通常居住'的最核心证明文件。务必同时保存厘印缴费记录。" },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-302", phase: 3, sequence: 2, category: "安居乐业",
    title: "收楼验收拍照存档",
    subtitle: "退租时保障押金全退——现在不拍以后说不清",
    timeEstimate: "1小时", urgency: "必修", icon: "camera",
    applicableTo: {
      visaTypes: "all", familyStatus: "all",
      arrivalScenario: ["fresh", "delayed"], skipIfExisting: []
    },
    steps: [
      { seq: 1, title: "逐项检查", content: "水压/电掣/门窗/天花漏水痕迹/冷气制冷/手机信号/隔音/白蚁痕迹", type: "action" },
      { seq: 2, title: "拍照录影存档", content: "全屋各角落拍照，录影一段全景视频，重点拍已有损坏/瑕疵处", type: "action" },
      { seq: 3, title: "签署单位状况清单", content: "与业主签署并双方各持一份，抄录水/电/煤表读数", type: "action" }
    ],
    requiredItems: ["手机（拍照/录影）", "纸笔（记录表读数）"],
    officialLinks: [],
    tips: ["建议白天和晚上分别视察了解不同时段噪音", "拍照时在照片上标注日期", "如有条件，聘请验楼师做专业验收（数千元）"],
    pitfalls: ["退租时业主可能以'你入住时就有'的损坏为由扣按金→现在拍照=最强证据"],
    renewalEvidence: { produces: true, docType: "单位状况清单+照片", docCategory: "address", collectMethod: "photo", isRequiredForRenewal: false, expiryCheck: null, renewalTip: "收楼验收记录是辅助性的居住证明，可作为'通常居住'的补充证据。" },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-303", phase: 3, sequence: 3, category: "安居乐业",
    title: "购买家居保险",
    subtitle: "保障个人财物+第三方责任——月均$50-100很划算",
    timeEstimate: "30分钟", urgency: "建议", icon: "shield",
    applicableTo: {
      visaTypes: "all", familyStatus: "all",
      arrivalScenario: ["fresh", "delayed"], skipIfExisting: []
    },
    steps: [
      { seq: 1, title: "了解保障范围", content: "家居财物（家私/电器/衣物）+个人责任（第三者受伤/财物损毁）+临时居所（意外不能居住时）+搬屋保障", type: "info" },
      { seq: 2, title: "区分火险vs家居保险", content: "火险=保障楼宇结构（业主/银行强制），家居保险=保障财物+责任（租客和业主均可）", type: "info" },
      { seq: 3, title: "选购并投保", content: "租客购买家居财物+个人责任即可；年保费约$500-2,000", type: "action" }
    ],
    requiredItems: ["HK身份证", "地址证明"],
    officialLinks: [],
    tips: ["贵重物品（珠宝/名表）通常有单件赔偿上限", "索偿：事发后30天内通知+保留损毁物品+保留单据"],
    pitfalls: [],
    renewalEvidence: { produces: true, docType: "家居保险保单", docCategory: "address", collectMethod: "photo", isRequiredForRenewal: false, expiryCheck: null, renewalTip: "家居保险保单是辅助性的居住证明。" },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-304", phase: 3, sequence: 4, category: "安居乐业",
    title: "安装家居宽频",
    subtitle: "三大供应商1000M光纤对比——最平$68/月",
    timeEstimate: "30分钟", urgency: "必修", icon: "wifi",
    applicableTo: {
      visaTypes: "all", familyStatus: "all",
      arrivalScenario: ["fresh", "delayed"], skipIfExisting: []
    },
    steps: [
      { seq: 1, title: "三大供应商对比", content: "网上行Netvigator（$118-138私楼，送Now TV+Perplexity Pro）/香港宽频HKBN（$88-149，送Global SIM+Disney+）/有线宽频i-Cable（$68-88全港最平）", type: "info" },
      { seq: 2, title: "选择并签约", content: "到供应商官网输入地址查询报价→在线签约→预约上门安装", type: "action" },
      { seq: 3, title: "安装当天", content: "确保有人在家，安装约1-2小时", type: "action" }
    ],
    requiredItems: ["HK身份证", "地址证明"],
    officialLinks: [{ label: "Netvigator", url: "https://www.netvigator.com" }, { label: "HKBN", url: "https://www.hkbn.net" }, { label: "i-Cable", url: "https://www.i-cable.com" }],
    tips: ["旧约到期前3-6月开始格价", "HKBN推荐人+新客户各获$400回赠", "Netvigator网络最稳定（Ookla 2025第1）"],
    pitfalls: ["实际月费因屋苑而异，建议直接到官网查", "i-Cable网上有用户反映'难cut台'", "合约期24-36月，中途搬家可转移但要重新签约"],
    renewalEvidence: { produces: false, docType: null, docCategory: null, collectMethod: null, isRequiredForRenewal: false, expiryCheck: null, renewalTip: null },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-305", phase: 3, sequence: 5, category: "安居乐业",
    title: "购买必要家电/家私",
    subtitle: "新家必需品清单——别买多了也别漏了",
    timeEstimate: "1-2小时", urgency: "建议", icon: "cart",
    applicableTo: {
      visaTypes: "all", familyStatus: "all",
      arrivalScenario: ["fresh", "delayed"], skipIfExisting: []
    },
    steps: [
      { seq: 1, title: "必需品分级清单", content: "第一优先（马上要）：床褥+枕头+被子/冰箱/洗衣机/煮食炉/热水炉；第二优先（1周内）：饭桌+椅/衣柜/窗帘；第三优先（慢慢添）：沙发/电视/书桌", type: "info" },
      { seq: 2, title: "购买渠道", content: "大型连锁（宜家/实惠/日本城）/网购（Carousell二手/淘宝集运）/街坊店", type: "info" }
    ],
    requiredItems: ["现金/信用卡"],
    officialLinks: [],
    tips: ["Carousell可淘到低至1折的二手名牌家私", "宜家送货+安装约$300-800", "淘宝集运至香港约7-14天，$10-20/kg"],
    pitfalls: [],
    renewalEvidence: { produces: false, docType: null, docCategory: null, collectMethod: null, isRequiredForRenewal: false, expiryCheck: null, renewalTip: null },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-306", phase: 3, sequence: 6, category: "安居乐业",
    title: "熟悉周边环境",
    subtitle: "找到最近的超市/街市/诊所/药房/银行/邮局",
    timeEstimate: "1-2小时", urgency: "必修", icon: "map",
    applicableTo: {
      visaTypes: "all", familyStatus: "all",
      arrivalScenario: ["fresh", "delayed"], skipIfExisting: []
    },
    steps: [
      { seq: 1, title: "标记关键地点", content: "用Google Maps标记：最近超市（百佳/惠康/fusion）/街市/24h便利店/诊所/药房/银行ATM/邮局/港铁站/巴士站", type: "action" },
      { seq: 2, title: "实地走一圈", content: "花1-2小时步行熟悉周边，注意：药店（白底红十字logo≠有药剂师，绿色十字=政府注册药房）", type: "action" },
      { seq: 3, title: "加入社区群组", content: "搜索居住区/屋苑的WhatsApp群组或Facebook群组，了解邻里资讯", type: "info" }
    ],
    requiredItems: ["智能手机（已开通香港上网）"],
    officialLinks: [],
    tips: ["香港街市通常比超市便宜20-30%", "万宁/屈臣氏有药剂师", "熟悉至少两家24h诊所的地址"],
    pitfalls: [],
    renewalEvidence: { produces: false, docType: null, docCategory: null, collectMethod: null, isRequiredForRenewal: false, expiryCheck: null, renewalTip: null },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-307", phase: 3, sequence: 7, category: "安居乐业",
    title: "首次搬家收尾工作",
    subtitle: "改地址+清理旧居+入伙——72小时内搞定",
    timeEstimate: "2-3小时", urgency: "建议", icon: "truck",
    applicableTo: {
      visaTypes: "all", familyStatus: "all",
      arrivalScenario: ["fresh", "delayed"], skipIfExisting: []
    },
    steps: [
      { seq: 1, title: "更改地址清单", content: "银行/保险/入境处/运输署/香港邮政（可申请邮件转递服务，6个月约$200）", type: "info" },
      { seq: 2, title: "入伙后72小时", content: "完成所有地址更改手续+拆箱归位（优先厨房及睡房）+检查搬屋损坏（有问题即时联络搬屋公司）", type: "action" },
      { seq: 3, title: "搬屋费用参考", content: "全包价$4,500-16,000/按件$6起/按车$5,300-8,000，自助Lalamove约$400-600", type: "info" }
    ],
    requiredItems: ["新地址证明", "已打厘印租约"],
    officialLinks: [{ label: "香港邮政邮件转递", url: "https://www.hongkongpost.hk" }],
    tips: ["避开周末和吉日搬屋更便宜", "香港邮政'邮件转递服务'可把旧地址的信转去新地址", "搬屋公司格价差距可达4倍→多比较"],
    pitfalls: [],
    renewalEvidence: { produces: false, docType: null, docCategory: null, collectMethod: null, isRequiredForRenewal: false, expiryCheck: null, renewalTip: null },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  // ═══════════════════════════════════════════════════════════════
  // 关卡4: 出行融入 (8项)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "onboard-401", phase: 4, sequence: 1, category: "出行融入",
    title: "免试换领香港驾照",
    subtitle: "内地驾照直接换——无需考试",
    timeEstimate: "1-2小时", urgency: "建议", icon: "car",
    applicableTo: {
      visaTypes: "all", familyStatus: "all",
      arrivalScenario: ["fresh", "delayed"], skipIfExisting: ["driving-license"]
    },
    steps: [
      { seq: 1, title: "检查申请资格", content: "年满18岁+持有内地正式驾照（仍有效或过期不超3年）+内地居留不少于6月或驾照已签发≥5年", type: "info" },
      { seq: 2, title: "网上预约", content: "运输署全面网上预约（2026年3月起取消即日筹），每天550名额，每工作日下午5时更新未来4周名额，九龙/观塘/沙田专责处理内地驾照", type: "action" },
      { seq: 3, title: "准备文件", content: "TD63A申请表+HK身份证+内地驾照正本+地址证明（近3月）+出入境记录（证明内地居留≥6月）", type: "action" },
      { seq: 4, title: "亲临牌照事务处", content: "按预约时间前往→提交→费用约HK$900→一般即日获批", type: "action" }
    ],
    requiredItems: ["HK身份证", "内地驾照正本+副本", "地址证明（近3月）", "TD63A申请表", "HK$900", "出入境记录证明"],
    officialLinks: [{ label: "运输署网上预约", url: "https://www.gov.hk/tc/residents/transport/drivinglicense/formtd63a.htm" }],
    tips: ["费用$900（60岁以下，10年有效）", "可授权代理人递交", "2025年9月起经免试签发驾照档号以DI为字首"],
    pitfalls: ["不接受邮寄/投递申请", "回乡证和内地居住证不视为旅行证件（不能用于免试换领）", "70岁以上需TD256体格检验证明书"],
    renewalEvidence: { produces: true, docType: "香港驾照副本", docCategory: "auxiliary", collectMethod: "photo", isRequiredForRenewal: false, expiryCheck: null, renewalTip: "驾照是辅助性的在港生活证明文件。" },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-402", phase: 4, sequence: 2, category: "出行融入",
    title: "熟悉港铁/巴士/的士App",
    subtitle: "香港公共交通世界第一——但你要知道怎么用",
    timeEstimate: "30分钟", urgency: "必修", icon: "bus",
    applicableTo: {
      visaTypes: "all", familyStatus: "all",
      arrivalScenario: ["fresh", "delayed"], skipIfExisting: []
    },
    steps: [
      { seq: 1, title: "港铁", content: "下载MTR Mobile→了解路线/票价/班次→都会票（$460/40程，平均$11.5/程）→早晨折扣（平日7:15-8:15出闸75折）→全月通", type: "info" },
      { seq: 2, title: "巴士", content: "下载Citybus/九巴App→查路线/到站时间，公共交通费用补贴：月支出超出$500部分可获1/3补贴（上限$400）", type: "info" },
      { seq: 3, title: "的士/叫车", content: "Uber（覆盖率最高）/滴滴（优惠力度大）/HKTaxi（老牌的士App）/高德打车", type: "info" }
    ],
    requiredItems: ["八达通", "智能手机已开通香港上网"],
    officialLinks: [{ label: "MTR Mobile", url: "https://www.mtr.com.hk/mtrmobile" }],
    tips: ["都会票2025年5月起可在MTR Mobile App购买电子版", "八达通+AlipayHK已覆盖绝大部分交通工具", "隧道已采用HKeToll电子收费"],
    pitfalls: [],
    renewalEvidence: { produces: false, docType: null, docCategory: null, collectMethod: null, isRequiredForRenewal: false, expiryCheck: null, renewalTip: null },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-403", phase: 4, sequence: 3, category: "出行融入",
    title: "预约运动场地（首次）",
    subtitle: "羽毛球$37-59/小时，健身室月票$180——做了SmartPLAY就要用",
    timeEstimate: "15分钟", urgency: "建议", icon: "sport",
    applicableTo: {
      visaTypes: "all", familyStatus: "all",
      arrivalScenario: ["fresh", "delayed"], skipIfExisting: []
    },
    steps: [
      { seq: 1, title: "热门设施价格", content: "羽毛球场$37-59/hr，网球场$42-148/hr，健身室$14/hr或$180月票，游泳池$17-19/节", type: "info" },
      { seq: 2, title: "完成首次预约", content: "SmartPLAY→选择设施→选择场地→选择时间→付款→到场使用", type: "action" }
    ],
    requiredItems: ["SmartPLAY登记"],
    officialLinks: [{ label: "SmartPLAY", url: "https://smartplay.lcsd.gov.hk" }],
    tips: ["繁忙时间（平日18:00后+周末13:00后）难抢", "健身室需先完成'正确使用健身室设施简介会'", "游泳池无需预约，开放时段前排队"],
    pitfalls: [],
    renewalEvidence: { produces: false, docType: null, docCategory: null, collectMethod: null, isRequiredForRenewal: false, expiryCheck: null, renewalTip: null },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-404", phase: 4, sequence: 4, category: "出行融入",
    title: "首次使用HA Go预约门诊",
    subtitle: "体验一次HA Go挂号——下次真的生病时不慌",
    timeEstimate: "1-2小时", urgency: "建议", icon: "hospital",
    applicableTo: {
      visaTypes: "all", familyStatus: "all",
      arrivalScenario: ["fresh", "delayed"], skipIfExisting: []
    },
    steps: [
      { seq: 1, title: "预约普通科门诊", content: "HA Go→预约家庭医学诊所→选择就近诊所→接纳可用时段（可预约未来24小时）", type: "action" },
      { seq: 2, title: "完成一次就诊", content: "提前15-30min到→用八达通/现金/HA Go缴费→等候叫号→诊症→取药，费用约$150（药每款$5）", type: "action" }
    ],
    requiredItems: ["HA Go已登记", "八达通/现金", "HK身份证"],
    officialLinks: [{ label: "HA Go", url: "https://www.ha.org.hk/hago" }],
    tips: ["抢号秘诀：每小时的29分和59分刷新", "首次使用可在非紧急情况下预约→熟悉流程", "就诊后可要求开具病假纸"],
    pitfalls: ["迟到→可能需重新预约", "两个月内累计3次失约→失去电话/App预约资格"],
    renewalEvidence: { produces: false, docType: null, docCategory: null, collectMethod: null, isRequiredForRenewal: false, expiryCheck: null, renewalTip: null },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-405", phase: 4, sequence: 5, category: "出行融入",
    title: "了解社区活动/兴趣班",
    subtitle: "融入香港生活——从找到一个兴趣班开始",
    timeEstimate: "30分钟", urgency: "建议", icon: "people",
    applicableTo: {
      visaTypes: "all", familyStatus: "all",
      arrivalScenario: ["fresh", "delayed"], skipIfExisting: []
    },
    steps: [
      { seq: 1, title: "寻找渠道", content: "区议会网页/康文署社区活动/社区会堂/宗教团体（教会/佛堂）/NGO（明爱/救世军/东华三院）", type: "info" },
      { seq: 2, title: "选择并报名", content: "按兴趣（运动/音乐/手工艺/语言班/义工）选择1-2项报名，费用通常很低（政府资助）", type: "action" }
    ],
    requiredItems: [],
    officialLinks: [],
    tips: ["康文署社区康乐活动每月更新", "兴趣班是认识本地朋友的最快方式", "很多NGO提供免费广东话班"],
    pitfalls: [],
    renewalEvidence: { produces: false, docType: null, docCategory: null, collectMethod: null, isRequiredForRenewal: false, expiryCheck: null, renewalTip: null },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-406", phase: 4, sequence: 6, category: "出行融入",
    title: "加入本地社交群组",
    subtitle: "跑团/行山群/教会/义工——香港人是这样交朋友的",
    timeEstimate: "30分钟", urgency: "建议", icon: "group",
    applicableTo: {
      visaTypes: "all", familyStatus: "all",
      arrivalScenario: ["fresh", "delayed"], skipIfExisting: []
    },
    steps: [
      { seq: 1, title: "寻找群组", content: "Facebook搜索[区名]跑团/[区名]行山群，Meetup.com搜索“Hong Kong hiking/board games/language exchange”，教会/佛堂/清真寺", type: "info" },
      { seq: 2, title: "参加首次活动", content: "选择1-2个群组参加首次活动，建议从运动类开始（低社交压力）", type: "action" }
    ],
    requiredItems: [],
    officialLinks: [],
    tips: ["香港行山文化极发达，行山群是最容易融入的社交圈", "Meetup上有很多Expats和Local混合的群组", "不要害羞——香港人比想象中友好"],
    pitfalls: [],
    renewalEvidence: { produces: false, docType: null, docCategory: null, collectMethod: null, isRequiredForRenewal: false, expiryCheck: null, renewalTip: null },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-407", phase: 4, sequence: 7, category: "出行融入",
    title: "准备首次报税（如已入职）",
    subtitle: "收到绿色信封BIR60别慌——首次报税其实很简单",
    timeEstimate: "30分钟", urgency: "必修", icon: "tax",
    applicableTo: {
      visaTypes: "all", familyStatus: "all",
      arrivalScenario: ["fresh", "delayed"], skipIfExisting: []
    },
    steps: [
      { seq: 1, title: "了解报税时间", content: "5月第一工作日税务局发BIR60（绿色信封）→6-7月提交→10-11月收评税通知→翌年1月缴第一期（75%）→4月缴第二期（25%）", type: "info" },
      { seq: 2, title: "首次报税", content: "雇主入职3月内向税务局提交IR56E→税务局5月内寄首次报税表→如应课税但没收到报税表须7月31日前书面通知", type: "info" },
      { seq: 3, title: "了解免税额和扣税", content: "基本免税额$132,000/已婚$264,000/子女每名$130,000/供养父母$50,000/住宅租金扣除$100,000/MPF$18,000", type: "info" }
    ],
    requiredItems: ["已入职雇主证明", "税单/BIR60表格"],
    officialLinks: [{ label: "税务局", url: "https://www.ird.gov.hk" }],
    tips: ["网上电子报税（eTax）可延长提交期至2个月", "以月入$40,000为例：单身税款约$18,100（扣除基本+租金+MPF后）", "带2名子女基本可达至免税"],
    pitfalls: ["逾期提交可被罚款最高$10,000", "如须课税但没收到报税表须主动通知税务局"],
    renewalEvidence: { produces: false, docType: null, docCategory: null, collectMethod: null, isRequiredForRenewal: false, expiryCheck: null, renewalTip: null },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-408", phase: 4, sequence: 8, category: "出行融入",
    title: "了解紧急求助渠道",
    subtitle: "999/1823/消防/救护——紧急时不慌",
    timeEstimate: "10分钟", urgency: "必修", icon: "alert",
    applicableTo: {
      visaTypes: "all", familyStatus: "all",
      arrivalScenario: ["fresh", "delayed"], skipIfExisting: []
    },
    steps: [
      { seq: 1, title: "紧急求助", content: "999（警察/消防/救护，三合一共用），112（手机国际紧急号码在香港也可用）", type: "info" },
      { seq: 2, title: "非紧急求助", content: "1823（政府热线24小时，处理非紧急查询和投诉），各区警署电话，医院管理局查询2300 6555", type: "info" }
    ],
    requiredItems: ["已开通香港上网的智能手机"],
    officialLinks: [],
    tips: ["把紧急联系人设为手机快捷拨号", "记录最近医院/警署/消防局的地址", "如在偏远地区行山→下载'郊野公园远足安全App'"],
    pitfalls: [],
    renewalEvidence: { produces: false, docType: null, docCategory: null, collectMethod: null, isRequiredForRenewal: false, expiryCheck: null, renewalTip: null },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },
  // ═══════════════════════════════════════════════════════════════
  // 关卡3: 安居乐业 新增 (6项)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "onboard-300", phase: 3, sequence: 0, category: "安居乐业",
    title: "完成找房向导",
    subtitle: "先想清楚住哪个区，再看具体租/买房",
    timeEstimate: "10分钟", urgency: "必修", icon: "compass",
    applicableTo: { visaTypes: "all", familyStatus: "all", arrivalScenario: ["fresh","delayed"], skipIfExisting: [] },
    steps: [
      { seq: 1, title: "回答三个问题", content: "预算(5档:$10k-15k/$15k-25k/$25k-40k/$40k-60k/$60k+)/工作在哪区(港岛/九龙/新界/远程)/有无学龄儿童(有/无)", type: "info" },
      { seq: 2, title: "查看推荐区域", content: "系统根据答案匹配3-5个最适合的居住区，每个区显示呎租+通勤时间+校网排名+社区特点", type: "info" }
    ],
    tips: ["完成找房向导后自动解锁onboard-301~307任务","如不确定预算，先了解各区租金行情再回来填"],
    renewalEvidence: { produces: false },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-308", phase: 3, sequence: 8, category: "安居乐业",
    title: "了解购房全流程",
    subtitle: "2024撤辣后内地人买房和港人一样税",
    timeEstimate: "20分钟", urgency: "必修", icon: "home",
    applicableTo: { visaTypes: "all", familyStatus: "all", arrivalScenario: ["fresh","delayed"], skipIfExisting: ["rental"] },
    steps: [
      { seq: 1, title: "撤辣政策", content: "2024年2月BSD/SSD/NRSD全面撤销，内地/海外人士=香港永久居民印花税率，压力测试已暂停", type: "info" },
      { seq: 2, title: "购房十步流程", content: "财务评估→预批按揭→搵楼睇楼→查册出价→签临约(细订3-5%)→正式申请按揭→签正约(14天，大订10%)→银行放款(约3月)→收楼验楼", type: "info" },
      { seq: 3, title: "置业杂费", content: "代理佣金约1%+律师费0.1-0.2%+按揭保费(首置35%折扣)+火险/管理费+装修/家私", type: "info" }
    ],
    tips: ["通过优才/高才/专才/IANG购楼可'先免后徵'","按揭可贷90%(楼价≤$1000万首置自住)","内地/海外入息可申请按揭(需3月入息证明)"],
    renewalEvidence: { produces: true, docType: "临时买卖合约(细订)", docCategory: "address", collectMethod: "photo", isRequiredForRenewal: true, renewalTip: "临约证明你已启动购房程序。最终成交后保存正约+印花税证明。" },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-309", phase: 3, sequence: 9, category: "安居乐业",
    title: "计算印花税与按揭成数",
    subtitle: "掌握最新税率才能算出真实预算",
    timeEstimate: "15分钟", urgency: "必修", icon: "calculator",
    applicableTo: { visaTypes: "all", familyStatus: "all", arrivalScenario: ["fresh","delayed"], skipIfExisting: [] },
    steps: [
      { seq: 1, title: "从价印花税阶梯", content: "$300万以下$100/$300-450万1.5%/$450-600万2.25%/$600-900万3%/$900-2000万3.75%/$2000万-1亿4.25%/$1亿+6.5%", type: "info" },
      { seq: 2, title: "按揭成数速查", content: "$1000万以下→9成(首置+自住)/$1000-1125万→8-9成(上限$900万)/$1125-1500万→8成/$1500万+→7成", type: "info" },
      { seq: 3, title: "先免后徵(NPAO)", content: "优才/高才/专才/IANG人士购楼按首置税率缴付，若最终未成永居须补缴税款", type: "info" }
    ],
    tips: [],
    renewalEvidence: { produces: true, docType: "印花税缴款证明", docCategory: "address", collectMethod: "photo", isRequiredForRenewal: true },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-310", phase: 3, sequence: 10, category: "安居乐业",
    title: "委任律师+签署临时买卖合约",
    subtitle: "临约具法律约束力，签前一定确认清楚",
    timeEstimate: "30分钟", urgency: "必修", icon: "file-sign",
    applicableTo: { visaTypes: "all", familyStatus: "all", arrivalScenario: ["fresh","delayed"], skipIfExisting: [] },
    steps: [
      { seq: 1, title: "签临约前准备", content: "已取得银行预批按揭(约2月)，已查土地注册处(iris.gov.hk)确保业权清晰，临约具法律约束力", type: "info" },
      { seq: 2, title: "支付细订", content: "细订=楼价3-5%，任何一方悔约→对方没收订金+悔约方付双方代理佣金", type: "action" },
      { seq: 3, title: "聘律师处理", content: "律师负责查契+准备正式合约+按揭文件，费用约楼价0.1-0.2%", type: "info" }
    ],
    tips: [],
    renewalEvidence: { produces: true, docType: "临时买卖合约", docCategory: "address", collectMethod: "photo", isRequiredForRenewal: true },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-311", phase: 3, sequence: 11, category: "安居乐业",
    title: "申请按揭+银行估值",
    subtitle: "比较多家银行利率，现在实际年息低至约3.25%",
    timeEstimate: "30分钟", urgency: "必修", icon: "bank",
    applicableTo: { visaTypes: "all", familyStatus: "all", arrivalScenario: ["fresh","delayed"], skipIfExisting: [] },
    steps: [
      { seq: 1, title: "正式申请按揭", content: "带临约+入息/资产证明向银行申请，比较利率，实际年息约3.25%(H+1.3%,P-2%封顶，最长30年)", type: "action" },
      { seq: 2, title: "估值与批核", content: "银行安排估值师上门，估值不足需补差价，内地/海外入息需3月证明(受薪)/6月+税单(自雇)", type: "info" },
      { seq: 3, title: "按揭保险", content: "首置通常有35%折扣，资产审批方式(无稳定入息)最高贷5成", type: "info" }
    ],
    tips: [],
    renewalEvidence: { produces: true, docType: "按揭批核函", docCategory: "employment", collectMethod: "photo", isRequiredForRenewal: true },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-312", phase: 3, sequence: 12, category: "安居乐业",
    title: "成交收楼",
    subtitle: "签正约+放款+验楼三步走完购房流程",
    timeEstimate: "2小时", urgency: "必修", icon: "home-check",
    applicableTo: { visaTypes: "all", familyStatus: "all", arrivalScenario: ["fresh","delayed"], skipIfExisting: [] },
    steps: [
      { seq: 1, title: "签正式合约", content: "临约后约14天内，支付大订至合计约楼价10%，确定成交日期(一般约3月后)", type: "action" },
      { seq: 2, title: "成交当日", content: "律师安排文件签署+银行放款，同日领取钥匙", type: "action" },
      { seq: 3, title: "收楼验收", content: "可聘请验楼师检查(约数千元)，检查墙身/地板/门窗/水电/冷气/漏水，拍照存档", type: "action" }
    ],
    tips: [],
    renewalEvidence: { produces: true, docType: "正式买卖合约+成交证明", docCategory: "address", collectMethod: "photo", isRequiredForRenewal: true, renewalTip: "买卖合约+印花税证明是购房路径的住址核心证明文件。续签时与水电煤账单配合使用。" },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  // ═══════════════════════════════════════════════════════════════
  // 关卡5: 子女教育 — 轨道A: 幼儿园 (5项)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "onboard-501a", phase: 5, sequence: 1, category: "子女教育",
    title: "了解香港幼儿园三类体系",
    subtitle: "幼儿中心≠幼稚园≠幼儿班——先搞清差异",
    timeEstimate: "10分钟", urgency: "必修", icon: "school",
    applicableTo: { visaTypes: "all", familyStatus: ["preschool"], arrivalScenario: ["fresh","delayed"], skipIfExisting: [] },
    steps: [
      { seq: 1, title: "三类体系对比", content: "幼儿中心(0-2岁,$3k-8k/月,日托)/幼稚园K1-K3(2岁8月+,免费~$10万/年)/幼儿班N班(足2岁,学前预备)", type: "info" },
      { seq: 2, title: "年龄对应速查", content: "2024年出生→2026-27入N班，2023年→K1，2022年→K2，2021年→K3。截止日8月31日(≠内地9月1日)", type: "info" },
      { seq: 3, title: "选择考虑", content: "半日vs全日? 粤语/英文/普通话? 政府资助(免费)vs国际($80k-200k+/年)? 离家多远?", type: "info" }
    ],
    tips: ["政府资助幼稚园需申请'幼稚园入学注册证'","国际幼稚园通常不在资助范围","8月出生的孩子可能是全班最小→考虑推迟一年入学"],
    renewalEvidence: { produces: false },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-502a", phase: 5, sequence: 2, category: "子女教育",
    title: "掌握幼儿园申请时间线",
    subtitle: "错过窗口=等一年——香港幼儿园报名有极强季节性",
    timeEstimate: "10分钟", urgency: "必修", icon: "calendar",
    applicableTo: { visaTypes: "all", familyStatus: ["preschool"], arrivalScenario: ["fresh","delayed"], skipIfExisting: [] },
    steps: [
      { seq: 1, title: "年度时间线", content: "6-9月索取报名表→9-11月递交→10-11月面试→12月中旬放榜→次年1月8-10日统一注册(留位费$970)→9月开学", type: "info" },
      { seq: 2, title: "关键提醒", content: "政府资助幼稚园必须持'幼稚园入学注册证'注册。国际幼稚园有独立时间线，通常更早", type: "info" },
      { seq: 3, title: "插班申请", content: "部分学校全年接受插班→亲临或下载报名表→提供原校成绩表/评估报告", type: "info" }
    ],
    tips: ["N班通常比K1更早招生","部分热门国际幼稚园需提前1年半排队","留位费$970入学后通常可扣减首月学费"],
    renewalEvidence: { produces: false },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-503a", phase: 5, sequence: 3, category: "子女教育",
    title: "准备幼儿园面试",
    subtitle: "三层面试——孩子独立表现+家长面谈+小组互动",
    timeEstimate: "15分钟", urgency: "必修", icon: "users",
    applicableTo: { visaTypes: "all", familyStatus: ["preschool"], arrivalScenario: ["fresh","delayed"], skipIfExisting: [] },
    steps: [
      { seq: 1, title: "孩子独立表现", content: "约15分钟：颜色/形状辨认，简单拼图，听指令完成任务，考察认知+大小肌肉协调+专注力", type: "info" },
      { seq: 2, title: "家长面谈约10分钟", content: "为什么选我们? 教育理念? 对子女期望? 港漂家长优势：准备英文/普通话回答，强调多语优势", type: "info" },
      { seq: 3, title: "小组互动观察", content: "几个小朋友一起玩，观察分享/等待/无攻击性，正常表现即可不需刻意训练", type: "info" }
    ],
    tips: ["面试以游戏形式进行","穿整齐得体不需正装","小朋友情绪状态>知识储备","家长不要过度抢话","粤语不流利用英文/普通话+表示正在学(加分)"],
    renewalEvidence: { produces: false },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-504a", phase: 5, sequence: 4, category: "子女教育",
    title: "了解学费与三类资助",
    subtitle: "政府资助幼稚园免费，国际幼稚园20万+/年——提前规划",
    timeEstimate: "10分钟", urgency: "建议", icon: "dollar",
    applicableTo: { visaTypes: "all", familyStatus: ["preschool"], arrivalScenario: ["fresh","delayed"], skipIfExisting: [] },
    steps: [
      { seq: 1, title: "学费区间", content: "政府资助(经幼稚园教育计划)学费全免。国际约$80k-200k+/年。本地私立约$30k-80k/年", type: "info" },
      { seq: 2, title: "三类资助", content: "a)幼稚园教育计划→合资格园免费; b)学费减免→最高50-100%(需经济审查); c)就学开支津贴→最高$4,490/年", type: "info" },
      { seq: 3, title: "如何申请", content: "开学后通过幼稚园索取申请表→填妥交回→教育局/社署审批", type: "action" }
    ],
    tips: [],
    renewalEvidence: { produces: false },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-505a", phase: 5, sequence: 5, category: "子女教育",
    title: "区域热门幼稚园参考",
    subtitle: "基于50所学校数据，按居住区推荐",
    timeEstimate: "10分钟", urgency: "建议", icon: "map-pin",
    applicableTo: { visaTypes: "all", familyStatus: ["preschool"], arrivalScenario: ["fresh","delayed"], skipIfExisting: [] },
    steps: [
      { seq: 1, title: "系统联动", content: "结合找房向导中选择的区域，自动列出该区及邻近幼稚园(含类型/学费/面试语言/报名难度)", type: "info" },
      { seq: 2, title: "重点推荐", content: "港漂家庭首选：大型住宅区+有普通话支援+插班友好。数据来源：学校原始语料库50校", type: "info" }
    ],
    tips: [],
    renewalEvidence: { produces: false },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  // ═══════════════════════════════════════════════════════════════
  // 关卡5: 子女教育 — 轨道B: 中小学插班 (7项)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "onboard-501b", phase: 5, sequence: 6, category: "子女教育",
    title: "五类学校全景对比",
    subtitle: "官立=免费但极难插班，直资=灵活但要钱——先搞清差异",
    timeEstimate: "15分钟", urgency: "必修", icon: "building",
    applicableTo: { visaTypes: "all", familyStatus: ["school-age","teen"], arrivalScenario: ["fresh","delayed"], skipIfExisting: [] },
    steps: [
      { seq: 1, title: "对比表", content: "官立(免费/粤语/派位/极难插)/资助(免费/粤语/80%学校/难)/直资($20k-130k/年/中英/自主招/中等)/私立($100k-300k/年/英文/灵活/较易)/国际($100k-300k/年/英文/海外升学/较易)", type: "info" },
      { seq: 2, title: "港漂现实选择", content: "官立/资助插班学位极少且需粤语。直资=最佳平衡(自主招生+双语+一般一条龙)。私立/国际=预算充足", type: "info" },
      { seq: 3, title: "年级匹配与降级", content: "英文落后2-3年+繁体字需6-12月→降1-2级常见。小学降级利大于弊。中学最迟中二结束前插班(中三选科)", type: "info" }
    ],
    tips: ["50所代表性学校(10官立+10资助+15直资+7私立+8国际)","可联动关卡3找房向导→只看目标校区"],
    renewalEvidence: { produces: false },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-502b", phase: 5, sequence: 7, category: "子女教育",
    title: "锁定目标校网+看房配合",
    subtitle: "定校网→选区域→看房——三者联动，顺序不能错",
    timeEstimate: "15分钟", urgency: "必修", icon: "map",
    applicableTo: { visaTypes: "all", familyStatus: ["school-age","teen"], arrivalScenario: ["fresh","delayed"], skipIfExisting: [] },
    steps: [
      { seq: 1, title: "四大名校网速查", content: "11中西区(全港第一)/12湾仔(女校资源多)/34何文田(约20间Band1环绕)/41九龙塘(三大神校)", type: "info" },
      { seq: 2, title: "第二梯队性价比之选", content: "31油尖旺/32大角嘴/35红磡/48观塘/62荃湾/88沙田", type: "info" },
      { seq: 3, title: "新来港家庭推荐", content: "首选屯门/元朗(校网密集+生活成本低)/跨境学童选上水/天水围。追名校→中西区/九龙塘", type: "info" }
    ],
    tips: [],
    renewalEvidence: { produces: false },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-503b", phase: 5, sequence: 8, category: "子女教育",
    title: "准备插班申请材料+年级匹配",
    subtitle: "8项通用材料+年级匹配——准备齐全一次过",
    timeEstimate: "20分钟", urgency: "必修", icon: "folder",
    applicableTo: { visaTypes: "all", familyStatus: ["school-age","teen"], arrivalScenario: ["fresh","delayed"], skipIfExisting: [] },
    steps: [
      { seq: 1, title: "8项材料清单", content: "出生证明+近2-3年成绩表+证书/奖状(不超10页)+父母身份证副本+住址证明+回邮信封+申请费$50-200+学生近照2-4张", type: "info" },
      { seq: 2, title: "年级匹配速查", content: "2019年→P1, 2018→P2, 2014→S1, 2012→S3。适龄入学为主，降1-2级常见(英文+繁体字适应)", type: "info" },
      { seq: 3, title: "居留权要求", content: "须持香港居留权或有效居留证明(受养人签证)。访客签注儿童不得入读。学生签证只能读非公营", type: "info" }
    ],
    tips: ["教育局学位支援组2892 6191→三个工作天内获安排学位","入境管制站可索取申请表","春季插班(1-2月入学)比秋季更易获录取"],
    renewalEvidence: { produces: true, docType: "插班申请回执", docCategory: "family", collectMethod: "photo", isRequiredForRenewal: true },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-504b", phase: 5, sequence: 9, category: "子女教育",
    title: "笔试准备：中英数三科",
    subtitle: "中文繁体字+英文难度高+数学英文出题——三关逐一过",
    timeEstimate: "20分钟", urgency: "必修", icon: "edit",
    applicableTo: { visaTypes: "all", familyStatus: ["school-age","teen"], arrivalScenario: ["fresh","delayed"], skipIfExisting: [] },
    steps: [
      { seq: 1, title: "中文科", content: "繁体字读写速度+香港用词差异(質素≠素质，水準≠水平)，建议提前3-6月练习繁体字", type: "info" },
      { seq: 2, title: "英文科", content: "内地公立学生英文落后香港同级2-3年，重点补阅读速度+词汇量，建议刷香港TSA/Pre-S1真题", type: "info" },
      { seq: 3, title: "数学科", content: "数学进度可能超前但英文出题看不懂→背熟英文术语(integer/fraction/algebra/geometry等)", type: "info" }
    ],
    tips: ["去三联/商务/大众书局买香港同级课本","部分直资/国际学校另有逻辑推理/小组讨论","面试常见：1分钟中英文自我介绍+为什么选我们"],
    renewalEvidence: { produces: false },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-505b", phase: 5, sequence: 10, category: "子女教育",
    title: "面试准备：学生+家长双面试",
    subtitle: "香港插班面试≠内地考试——考察的是综合能力",
    timeEstimate: "20分钟", urgency: "必修", icon: "users",
    applicableTo: { visaTypes: "all", familyStatus: ["school-age","teen"], arrivalScenario: ["fresh","delayed"], skipIfExisting: [] },
    steps: [
      { seq: 1, title: "学生面试准备", content: "1分钟中英文自我介绍+高频问题：为什么选我们?如何适应粤语/英语?优点和缺点?部分学校有小组讨论", type: "info" },
      { seq: 2, title: "家长面试准备", content: "考察教育理念是否契合+对子女了解+家庭支援能力(课后辅导等)，港漂家长优势：多语环境+学习基础扎实", type: "info" },
      { seq: 3, title: "面试礼仪", content: "穿整齐校服/便服，提前15分钟到，眼神接触，积极但不抢话，准备1-2个问学校的问题", type: "info" }
    ],
    tips: ["即使英文学校也可能用粤语闲谈→准备基本粤语回应","不要过度训练→香港学校讨厌'背答案'","面试后24小时内发感谢电邮(英文)"],
    renewalEvidence: { produces: false },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-506b", phase: 5, sequence: 11, category: "子女教育",
    title: "叩门(候补)策略",
    subtitle: "统一派位结果不理想? 叩门是你的第二次机会",
    timeEstimate: "15分钟", urgency: "建议", icon: "door",
    applicableTo: { visaTypes: "all", familyStatus: ["school-age","teen"], arrivalScenario: ["fresh","delayed"], skipIfExisting: [] },
    steps: [
      { seq: 1, title: "什么是叩门", content: "统一派位结果公布后，家长直接向心仪学校申请候补位。叩门位极少(每校1-5个)但每年都有人成功", type: "info" },
      { seq: 2, title: "叩门时间线", content: "5月下旬起领表→6月上旬截止→面试通知电话通知→如指定日期前未接到通知=落选", type: "info" },
      { seq: 3, title: "叩门材料清单", content: "小一入学申请表+派位选校表+注册证+出世纸+父母身份证+幼稚园成绩表+照片+回邮信封", type: "info" }
    ],
    tips: ["叩门≠走后门，全公开候补机制","可同时向多校叩门","面试表现>笔试成绩(叩门阶段)"],
    renewalEvidence: { produces: false },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-507b", phase: 5, sequence: 12, category: "子女教育",
    title: "了解DSE/华侨生联考/IB三大路径",
    subtitle: "小学阶段就要考虑中学→大学的完整路径",
    timeEstimate: "15分钟", urgency: "建议", icon: "graduation",
    applicableTo: { visaTypes: "all", familyStatus: ["school-age","teen"], arrivalScenario: ["fresh","delayed"], skipIfExisting: [] },
    steps: [
      { seq: 1, title: "DSE(中学文凭试)", content: "本地主流，可报香港/内地/海外大学。以'本地生'身份考DSE需提前2年赴港读书", type: "info" },
      { seq: 2, title: "华侨生联考", content: "内地985/211捷径：一本线约400分/二本线约300分。需香港永居+回乡证", type: "info" },
      { seq: 3, title: "IB/A-Level", content: "国际学校主流课程，对接海外升学。IB 45满分为全球顶校敲门砖", type: "info" }
    ],
    tips: ["DSE和华侨生联考不可兼得需提前规划","2026年DSE本地生定义：需在港住满2年","小学插班时就要做好8年规划"],
    renewalEvidence: { produces: false },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  // ═══════════════════════════════════════════════════════════════
  // 关卡6: 财务税务 (6项)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "onboard-601", phase: 6, sequence: 1, category: "财务税务",
    title: "首次报税",
    subtitle: "收到绿色信封BIR60别慌——首次报税其实很简单",
    timeEstimate: "20分钟", urgency: "必修", icon: "tax",
    applicableTo: { visaTypes: "all", familyStatus: "all", arrivalScenario: ["fresh","delayed"], skipIfExisting: [] },
    steps: [
      { seq: 1, title: "报税时间线", content: "5月税务局发BIR60→6-7月提交→10-11月收评税→翌年1月缴第一期(75%)→4月缴第二期(25%)", type: "info" },
      { seq: 2, title: "首次报税流程", content: "雇主入职3月内提交IR56E→税务局5月内寄首次报税表。如应课税但没收到须7月31日前书面通知", type: "info" },
      { seq: 3, title: "免税额+扣税", content: "基本$132k/已婚$264k/子女每名$130k/供养父母$50k/租金扣税$100k/MPF$18k。税阶:2%-6%-10%-14%-17%", type: "info" }
    ],
    tips: ["eTax网上报税可延长至2个月","月入$40k单身税款约$18,100(扣基本+租金+MPF)","带2子女可达至免税"],
    renewalEvidence: { produces: true, docType: "评税通知书", docCategory: "employment", collectMethod: "photo", isRequiredForRenewal: true, renewalTip: "评税通知书是在港有贡献的核心证明。每年5月收到BIR60及时报税，10月收到评税通知书时拍照存档。" },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-602", phase: 6, sequence: 2, category: "财务税务",
    title: "设定强积金投资组合",
    subtitle: "雇主代登记，雇员需管理——别让退休金睡大觉",
    timeEstimate: "20分钟", urgency: "必修", icon: "piggy",
    applicableTo: { visaTypes: "all", familyStatus: "all", arrivalScenario: ["fresh","delayed"], skipIfExisting: [] },
    steps: [
      { seq: 1, title: "什么是MPF", content: "雇主雇员各供5%(共10%)，入息下限~$7,100/上限~$30,000。积金易(eMPF)2024年6月启用", type: "info" },
      { seq: 2, title: "选择投资组合", content: "预设投资DIS(适合新手)。进取型(股票多)→均衡型→保守型(债券多)。至少每半年检视", type: "action" },
      { seq: 3, title: "2026年新政策", content: "全自由行首阶段(2025年5月后入职)→可年移雇主供款至自选计划。取消对冲(2025年5月起)", type: "info" }
    ],
    tips: [],
    renewalEvidence: { produces: true, docType: "首期MPF供款记录", docCategory: "employment", collectMethod: "photo", isRequiredForRenewal: true, renewalTip: "MPF供款记录是在港就业的最强证明之一。续签时入境处必查。" },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-603", phase: 6, sequence: 3, category: "财务税务",
    title: "开通跨境汇款",
    subtitle: "FPS跨境支付通已上线，内地手机号即可收款",
    timeEstimate: "15分钟", urgency: "建议", icon: "transfer",
    applicableTo: { visaTypes: "all", familyStatus: "all", arrivalScenario: ["fresh","delayed"], skipIfExisting: [] },
    steps: [
      { seq: 1, title: "FPS跨境支付通", content: "2025年6月上线，只需收款人内地手机号→限额每日$10k/年$200k→部分银行免手续费→即时到账", type: "info" },
      { seq: 2, title: "其他渠道", content: "Wise(汇率最优,约HK$25+0.95%)/AlipayHK(中级$7,999日/高级$2万日)/银行电汇(同名户口8万人民币/日)", type: "info" }
    ],
    tips: [],
    renewalEvidence: { produces: true, docType: "首笔跨境汇款记录", docCategory: "employment", collectMethod: "photo", isRequiredForRenewal: false },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-604", phase: 6, sequence: 4, category: "财务税务",
    title: "设定水电煤自动转账",
    subtitle: "一劳永逸不再忘记缴费——自动转账一次搞定",
    timeEstimate: "10分钟", urgency: "建议", icon: "autopay",
    applicableTo: { visaTypes: "all", familyStatus: "all", arrivalScenario: ["fresh","delayed"], skipIfExisting: [] },
    steps: [
      { seq: 1, title: "银行自动转账", content: "网银/eDDA/亲临分行→填写自动转账授权书→处理约6-8周。中电/港灯/煤气/水务署银行资料需对应准确", type: "action" },
      { seq: 2, title: "AlipayHK自动付款", content: "AlipayHK App→缴费专区→选择机构→输入账单编号绑定→开启自动付款。覆盖近500商户，可赚积分", type: "action" }
    ],
    tips: [],
    renewalEvidence: { produces: false },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-605", phase: 6, sequence: 5, category: "财务税务",
    title: "建立应急基金",
    subtitle: "3-6个月生活费储备——香港生活的安全垫",
    timeEstimate: "10分钟", urgency: "建议", icon: "shield",
    applicableTo: { visaTypes: "all", familyStatus: "all", arrivalScenario: ["fresh","delayed"], skipIfExisting: [] },
    steps: [
      { seq: 1, title: "建议储备", content: "3-6个月生活费(含租金+日常开销)，存入高流动性户口(活期/定期存款)", type: "info" },
      { seq: 2, title: "存款利率参考", content: "众安ZA Bank活期~1-2%，定期~3-4%(视金额和年期)。汇丰/中银定期~2-3%", type: "info" }
    ],
    tips: [],
    renewalEvidence: { produces: false },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-606", phase: 6, sequence: 6, category: "财务税务",
    title: "了解薪俸税扣税项目并规划",
    subtitle: "每年3月31日前做税务规划，善用扣税项目",
    timeEstimate: "15分钟", urgency: "必修", icon: "calculator",
    applicableTo: { visaTypes: "all", familyStatus: "all", arrivalScenario: ["fresh","delayed"], skipIfExisting: [] },
    steps: [
      { seq: 1, title: "主要扣税项目", content: "住宅租金$100k/MPF强制$18k/自愿医保$8k/合资格年金+MPF自愿$60k/居所贷款利息$100k/慈善捐款(35%入息)", type: "info" },
      { seq: 2, title: "节税案例", content: "月入$40k，租金扣$100k+MPF$18k+基本$132k→应课税$230k→税款~$18,100。加1名子女→税款~$1,000", type: "info" }
    ],
    tips: ["每年3月31日前做规划(购买医保/做慈善/供MPF)","税率比较：累进(2-17%)vs标准(15%)→取较低者"],
    renewalEvidence: { produces: false },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  // ═══════════════════════════════════════════════════════════════
  // 关卡7: 续签准备 (5项)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "onboard-701", phase: 7, sequence: 1, category: "续签准备",
    title: "确认续签时间窗口",
    subtitle: "到期前3个月可递交申请——提前4-6月准备材料",
    timeEstimate: "15分钟", urgency: "必修", icon: "calendar",
    applicableTo: { visaTypes: "all", familyStatus: "all", arrivalScenario: ["fresh","delayed"], skipIfExisting: [] },
    steps: [
      { seq: 1, title: "查签证到期日", content: "翻出签证标签页(或入境处App)，记录精确到期日", type: "action" },
      { seq: 2, title: "续签窗口", content: "到期前3个月开始可递交续签申请(2026年新政)。建议提前4-6个月开始准备材料", type: "info" },
      { seq: 3, title: "各路径续签模式", content: "优才3+3+2/高才A类3+3+2/高才BC类2+3+3/专才3+3+2(绑雇主)/IANG 2+2+3", type: "info" }
    ],
    tips: [],
    renewalEvidence: { produces: true, docType: "签证到期日确认", docCategory: "visa", collectMethod: "manual", isRequiredForRenewal: true },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-702", phase: 7, sequence: 2, category: "续签准备",
    title: "整理续签所需材料清单",
    subtitle: "依路径不同准备不同材料——提前对照检查",
    timeEstimate: "20分钟", urgency: "必修", icon: "checklist",
    applicableTo: { visaTypes: "all", familyStatus: "all", arrivalScenario: ["fresh","delayed"], skipIfExisting: [] },
    steps: [
      { seq: 1, title: "依路径查清单", content: "优才=通常居住+在港有贡献。高才通=两址两单(居住地址+实体办公地址+薪俸/利得税单+MPF记录)", type: "info" },
      { seq: 2, title: "对照续签档案", content: "在Tab3续签档案中检查材料完整度→标记缺失项→制定补充计划", type: "action" }
    ],
    tips: [],
    renewalEvidence: { produces: false },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-703", phase: 7, sequence: 3, category: "续签准备",
    title: "确认通常居住证明齐全",
    subtitle: "租约+厘印+水电煤账单是最重要三件套",
    timeEstimate: "15分钟", urgency: "必修", icon: "home",
    applicableTo: { visaTypes: "all", familyStatus: "all", arrivalScenario: ["fresh","delayed"], skipIfExisting: [] },
    steps: [
      { seq: 1, title: "通常居住证明", content: "租约+厘印+水电煤账单(最重要三件套)+银行月结单+香港驾照+MPF记录+税单", type: "info" },
      { seq: 2, title: "离境天数自查", content: "7年居港期间每年离境天数建议≤180天。如有长期离境准备合理解释(出差/探亲/进修)", type: "info" }
    ],
    tips: [],
    renewalEvidence: { produces: false },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-704", phase: 7, sequence: 4, category: "续签准备",
    title: "补充最近3个月水电煤账单",
    subtitle: "入境处通常要求最近3个月账单——现在就要补充",
    timeEstimate: "15分钟", urgency: "必修", icon: "utility",
    applicableTo: { visaTypes: "all", familyStatus: "all", arrivalScenario: ["fresh","delayed"], skipIfExisting: [] },
    steps: [
      { seq: 1, title: "续签前最后准备", content: "入境处通常要最近3个月账单→如果已存的是半年前的账单，现在需要补充最新一期", type: "info" },
      { seq: 2, title: "获取最新账单", content: "中电/港灯App→查阅电子账单→截图。确保显示完整姓名+地址", type: "action" }
    ],
    tips: [],
    renewalEvidence: { produces: true, docType: "最近3个月水电煤账单", docCategory: "address", collectMethod: "photo", isRequiredForRenewal: true, expiryCheck: "3months", renewalTip: "续签前最后一步关键材料。最近3个月的账单证明你直到续签前一直在此居住。" },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },

  {
    id: "onboard-705", phase: 7, sequence: 5, category: "续签准备",
    title: "了解自雇续签选项",
    subtitle: "不在港有固定雇主? 创业/自由职业者的续签方案",
    timeEstimate: "15分钟", urgency: "建议", icon: "briefcase",
    applicableTo: { visaTypes: "all", familyStatus: "all", arrivalScenario: ["fresh","delayed"], skipIfExisting: [] },
    steps: [
      { seq: 1, title: "适合什么人", content: "不在港有固定雇主/自由职业者/创业人士/高才A类收入不稳定者", type: "info" },
      { seq: 2, title: "自雇续签方案", content: "注册香港公司→真实运营→给自己发工资→纳税+供MPF。需公司BR+商业租约/办公室+审计报告+利得税单", type: "info" }
    ],
    tips: [],
    renewalEvidence: { produces: false },
    reminderTrigger: null, documentLink: null, aiChatContext: null
  },
];
