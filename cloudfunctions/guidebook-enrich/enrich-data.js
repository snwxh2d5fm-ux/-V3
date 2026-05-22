module.exports = {
  'onboard-001': {
    required_items: ['签证标签页', '护照/港澳通行证'],
    tips: ['如发现信息有误，立即联系入境处更正，不要等到过关时才发现', '建议打印一份纸质版随身携带'],
    pitfalls: ['签证标签页上的英文名必须与护照完全一致，包括空格和连字符', '逗留期限≠签证有效期，不要混淆'],
    official_links: [
      {
        label: '入境事务处',
        url: 'https://www.immd.gov.hk',
      },
    ],
  },
  'onboard-002': {
    required_items: ['护照/港澳通行证（有效期≥6个月）', '签证标签页', '透明文件袋', 'HK$5,000-10,000现金'],
    tips: [
      '过关时获发的小白条是一张小纸片，极容易丢失——拿到后立刻拍照并放入文件袋',
      '如携带超过HK$12万等值现金/不记名票据，须向海关申报',
    ],
    pitfalls: ['护照有效期不足6个月可能被拒绝入境', '港澳通行证上的签注（D签）必须与签证标签页的逗留期限对应'],
    official_links: [
      {
        label: '入境事务处·签证',
        url: 'https://www.immd.gov.hk/hks/services/index.html',
      },
      {
        label: '香港海关·旅客须知',
        url: 'https://www.customs.gov.hk/tc/passenger_clearance/index.html',
      },
    ],
  },
  'onboard-003': {
    required_items: ['护照/港澳通行证号码'],
    tips: [
      '核心策略：先约身份证→再定过关日→最后订交通住宿。一趟搞定激活+办证',
      '每天上午9点释放新的预约名额，热门时段竞争激烈',
      '火炭办事处通常比湾仔容易约到',
      '预约可更改两次，如需改期尽早操作',
    ],
    pitfalls: [
      '不要先订机票酒店再约身份证——预约日期可能不理想，到时候改机票成本高',
      '入境后30天内必须申领身份证，逾期可能被检控',
      '网上预约需输入在港联系电话，可先填酒店/朋友电话',
    ],
    official_links: [
      {
        label: '入境处网上预约',
        url: 'https://www.gov.hk/icbooking',
      },
    ],
  },
  'onboard-004': {
    required_items: ['智能手机（剩余存储空间≥2GB）', 'Apple ID / Google Play账号'],
    tips: [
      'AlipayHK需香港手机号注册，抵港后才能完成——但可以先下载',
      '智方便+需2018年11月后签发的新智能身份证+NFC手机才能登记',
    ],
    pitfalls: [
      '内地手机号注册的Apple ID可能无法下载部分香港App——建议提前准备香港Apple ID',
      '香港的App生态以iOS为主，部分App的Android版本功能较少',
    ],
    official_links: [
      {
        label: 'MTR Mobile',
        url: 'https://www.mtr.com.hk/mtrmobile',
      },
      {
        label: 'HA Go',
        url: 'https://www.ha.org.hk',
      },
    ],
  },
  'onboard-005': {
    required_items: ['手机（提前下载离线地图/截图路线）', '少量港币现金（买车票/八达通用）'],
    tips: [
      '如果住在新界（屯门/元朗/上水），深圳湾口岸最方便',
      '机场快线多人同行有团体票优惠',
      'Google Maps在香港的公共交通规划准确度很高',
    ],
    pitfalls: [
      '的士司机可能不认识新界偏远地址——提前准备中英文地址写在纸上',
      '高铁到西九龙站后是「一地两检」，过关后就在香港境内了',
    ],
    official_links: [
      {
        label: '香港机场交通',
        url: 'https://www.hongkongairport.com',
      },
      {
        label: 'MTR港铁路线图',
        url: 'https://www.mtr.com.hk',
      },
    ],
  },
  'onboard-101': {
    required_items: ['现金HK$150（成人）/ HK$70（小童/长者）'],
    tips: [
      '机场7-Eleven 24小时营业，凌晨抵港也能买',
      '学生（12-25岁全日制）可申请学生八达通享港铁半价，需2-4周处理',
      '绑定八达通App后可设置信用卡自动增值',
    ],
    pitfalls: ['旅客八达通（HK$39纪念卡）不含储值额，不推荐', '转移至Apple Wallet后实体卡失效且不可逆'],
    official_links: [
      {
        label: '八达通官网',
        url: 'https://www.octopus.com.hk',
      },
    ],
  },
  'onboard-102': {
    required_items: ['香港身份证（如有）或护照+入境记录', '地址证明', '现金/信用卡（首期月费+行政费）'],
    tips: [
      '如上水/粉岭/上环的街边电话卡店买储值卡更便宜但不稳定，建议上台',
      'CMHK中国移动价格亲民、简单均真，适合不想研究条款的用户',
      '经常北上深圳/珠海→3HK；预算有限→CMHK',
    ],
    pitfalls: [
      '携号转台（MNP）通常比新号码上台多送优惠',
      '合约期内提前解约需支付剩余月份费用',
      '部分优惠属限时推广，实际价格以官网为准',
    ],
    official_links: [
      {
        label: '3HK',
        url: 'https://www.three.com.hk',
      },
      {
        label: 'CMHK',
        url: 'https://www.hk.chinamobile.com',
      },
      {
        label: 'CSL',
        url: 'https://www.hkcsl.com',
      },
      {
        label: 'SmarTone',
        url: 'https://www.smartone.com',
      },
    ],
  },
  'onboard-103': {
    required_items: ['香港手机号', '香港身份证'],
    tips: [
      '绑定信用卡缴费可赚积分/回赠',
      '内地消费可直接用AlipayHK支付（汇率自动换算）',
      '跨境汇款至内地银行账户每日限额按认证级别',
    ],
    pitfalls: ['AlipayHK和内地支付宝是两个独立App，不能通用', '未完成认证前很多功能受限'],
    official_links: [
      {
        label: 'AlipayHK',
        url: 'https://www.alipayhk.com',
      },
    ],
  },
  'onboard-104': {
    required_items: ['护照/港澳通行证', '签证标签页', '入境小白条', '预约确认'],
    tips: [
      '拍照时可以微笑但不能露齿',
      '建议穿深色有领上衣，背景为白色',
      '临时身份证收据也是一份重要文件——保留至领取正式身份证',
    ],
    pitfalls: ['入境后30天内必须申领，逾期可能被检控', '如错过预约时间，需重新网上预约'],
    official_links: [
      {
        label: '入境处身份证预约',
        url: 'https://www.gov.hk/icbooking',
      },
    ],
  },
  'onboard-105': {
    required_items: ['智能手机（剩余存储空间≥1GB）'],
    tips: [
      'MTR Mobile可购买电子都会票（$460/40程，平均$11.5/程）',
      'Google Maps的公共交通规划在香港比高德/百度地图更准',
    ],
    pitfalls: ['WhatsApp需手机号验证，建议用香港号注册（工作联系用）', '香港的的士App生态较分散，Uber覆盖率最高'],
    official_links: [
      {
        label: 'MTR Mobile',
        url: 'https://www.mtr.com.hk/mtrmobile',
      },
      {
        label: '我的天文台',
        url: 'https://www.hko.gov.hk',
      },
    ],
  },
  'onboard-201': {
    required_items: ['HK身份证(如有)', '内地二代身份证', '港澳通行证', '入境小白条', '地址证明', '现金HK$500-1000'],
    tips: ['尚无香港地址证明时中银可接受内地地址证明', '12月内被拒3次→标记高风险客户→等6月', '逗留签注有效期需≥180天'],
    pitfalls: ['地址证明上姓名须与证件完全一致', '月入8000却申请500万理财=可疑', '截图电子账单不被接受'],
    official_links: [
      {
        label: '中银香港',
        url: 'https://www.bochk.com',
      },
      {
        label: '汇丰One',
        url: 'https://www.hsbc.com.hk',
      },
    ],
  },
  'onboard-202': {
    required_items: ['银行月结单或租约或水电煤账单'],
    tips: ['银行月结单是最容易获取的地址证明', '水务署转名免费', '可要求银行发出正式地址确认函（3-7工作天）'],
    pitfalls: [
      '地址证明上姓名须与证件完全一致',
      '截图电子账单不被接受',
      '新来港前3个月可能缺乏本地地址证明→用租约+厘印过渡',
    ],
    official_links: [
      {
        label: '差饷物业估价署',
        url: 'https://www.rvd.gov.hk',
      },
      {
        label: '水务署·账单作地址证明',
        url: 'https://www.wsd.gov.hk',
      },
      {
        label: '中电/港灯·电费账单',
        url: 'https://www.clp.com.hk',
      },
    ],
  },
  'onboard-203': {
    required_items: ['HK身份证', '地址证明', '香港手机号'],
    tips: ['小童登记后获发临时证件号码', '65岁以上长者自动轮候长者筹', '65岁以下可抢普通筹'],
    pitfalls: ['必须亲临诊所完成首次登记（不能纯线上）', '两个月内3次失约→失去预约资格'],
    official_links: [
      {
        label: 'HA Go',
        url: 'https://www.ha.org.hk/hago',
      },
    ],
  },
  'onboard-204': {
    required_items: ['智方便+登记'],
    tips: ['年满15岁且完成健身房安全课才能用健身室', '全民运动日（8月）多项设施免费', '预约后取消不获退款'],
    pitfalls: ['旧Leisure Link用户也须重新登记', '非HK居民须亲临佐敦SmartPLAY服务中心登记临时用户'],
    official_links: [
      {
        label: 'SmartPLAY',
        url: 'https://smartplay.lcsd.gov.hk',
      },
    ],
  },
  'onboard-205': {
    required_items: ['NFC手机', '新智能身份证（2018年11月后签发）'],
    tips: ['智方便+需要NFC功能→部分平价手机不支持', '可到自助登记站/邮局办理', '11岁以上即可登记'],
    pitfalls: ['2018年前签发的旧身份证不支持', '如无法在线完成可亲临登记服务柜位'],
    official_links: [
      {
        label: '智方便',
        url: 'https://www.iamsmart.gov.hk',
      },
    ],
  },
  'onboard-206': {
    required_items: ['HK身份证', '租约', '按金（中电/港灯$300-600，煤气$400，水务署免费）'],
    tips: [
      '水务署转名免费',
      '可使用AlipayHK自动付款（覆盖近500商户）',
      'PayMe 2025年7月起支持煤气/港灯/中电/水务署缴费',
    ],
    pitfalls: ['入住后务必尽快转名，否则前业主/租客的水电煤账户产生的费用可能纠缠', '自动转账处理需6-8周'],
    official_links: [
      {
        label: '中电',
        url: 'https://www.clp.com.hk',
      },
      {
        label: '港灯',
        url: 'https://www.hkelectric.com',
      },
      {
        label: '中华煤气',
        url: 'https://www.towngas.com',
      },
    ],
  },
  'onboard-207': {
    required_items: ['HK身份证', '地址证明'],
    tips: ['每位读者可外借最多10项', '借期14天，可续借5次', '逾期罚款上限：成人$130'],
    pitfalls: [
      '借书记录可作为"通常居住"辅助证据——逾期罚款不影响签证续签或永居',
      '大学图书馆卡≠公共图书馆卡——需凭HK身份证单独到港公共图书馆办理',
      '多书同时逾期罚款累积，超限将暂停借书权限——大额借阅需注意',
    ],
    official_links: [
      {
        label: '香港公共图书馆',
        url: 'https://www.hkpl.gov.hk',
      },
    ],
  },
  'onboard-301': {
    required_items: ['HK身份证', '现金/支票（按金+首月租金+佣金+印花税）'],
    tips: [
      '打厘印可在网上办理（ird.gov.hk）',
      '逾期打厘印罚款为印花税2-10倍',
      '代理佣金通常为半月租（业主和租客各付一半）',
    ],
    pitfalls: [
      '未打厘印的租约在法律上不可强制执行',
      "如业主未通知银行擅自出租'自住'物业→断供→银行有权收楼→租客可能不获赔偿",
      '睇楼前必须签署睇楼纸（有效期3月）',
    ],
    official_links: [
      {
        label: '税务局印花税',
        url: 'https://www.ird.gov.hk',
      },
    ],
  },
  'onboard-302': {
    required_items: ['手机（拍照/录影）', '纸笔（记录表读数）'],
    tips: [
      '建议白天和晚上分别视察了解不同时段噪音',
      '拍照时在照片上标注日期',
      '如有条件，聘请验楼师做专业验收（数千元）',
    ],
    pitfalls: ["退租时业主可能以'你入住时就有'的损坏为由扣按金→现在拍照=最强证据"],
    official_links: [
      {
        label: '香港房屋协会·收楼指引',
        url: 'https://www.hkhs.com',
      },
      {
        label: '一手住宅物业销售监管局',
        url: 'https://www.srpa.gov.hk',
      },
    ],
  },
  'onboard-303': {
    required_items: ['HK身份证', '地址证明'],
    tips: ['贵重物品（珠宝/名表）通常有单件赔偿上限', '索偿：事发后30天内通知+保留损毁物品+保留单据'],
    pitfalls: [
      '混淆火险与家居保险——火险保障楼宇结构（按揭强制），家居保险保障财物+个人责任，租客只需后者',
      '贵重物品（珠宝/名表）通常有单件赔偿上限——高价值物品需额外申报',
      '家居保险属一般保险（每年续保），21天冷静期不适用于此类保险',
    ],
    official_links: [
      {
        label: '保监局·家居保险比较',
        url: 'https://www.ia.org.hk',
      },
      {
        label: '消费者委员会·保险格价',
        url: 'https://www.consumer.org.hk',
      },
    ],
  },
  'onboard-304': {
    required_items: ['HK身份证', '地址证明'],
    tips: ['旧约到期前3-6月开始格价', 'HKBN推荐人+新客户各获$400回赠', 'Netvigator网络最稳定（Ookla 2025第1）'],
    pitfalls: [
      '实际月费因屋苑而异，建议直接到官网查',
      "i-Cable网上有用户反映'难cut台'",
      '合约期24-36月，中途搬家可转移但要重新签约',
    ],
    official_links: [
      {
        label: 'Netvigator',
        url: 'https://www.netvigator.com',
      },
      {
        label: 'HKBN',
        url: 'https://www.hkbn.net',
      },
      {
        label: 'i-Cable',
        url: 'https://www.i-cable.com',
      },
    ],
  },
  'onboard-305': {
    required_items: ['现金/信用卡'],
    tips: ['Carousell可淘到低至1折的二手名牌家私', '宜家送货+安装约$300-800', '淘宝集运至香港约7-14天，$10-20/kg'],
    pitfalls: [
      '租约中未明确家电维修责任——非人为损坏（冷气/热水炉）通常业主负责，但需在租约中列明',
      '大型家具需提前量度门口/走廊/电梯尺寸——部分屋苑需预约货𨋢及缴按金',
      '搬屋时贵重物品（护照/合约/现金/首饰）必须随身携带，切勿放入搬屋车',
    ],
    official_links: [
      {
        label: '消费者委员会·家电评测',
        url: 'https://www.consumer.org.hk',
      },
      {
        label: '丰泽电器',
        url: 'https://www.fortress.com.hk',
      },
    ],
  },
  'onboard-306': {
    required_items: ['智能手机（已开通香港上网）'],
    tips: ['香港街市通常比超市便宜20-30%', '万宁/屈臣氏有药剂师', '熟悉至少两家24h诊所的地址'],
    pitfalls: [
      '忽略校网对租房决策的影响——有子女在港上学则住址决定校网分配',
      '港岛租金高配套成熟、九龙性价比好、新界租金低空间大——选错区域通勤成本翻倍',
      '语言适应不足——建议安装粤语学习App学会基本用语（唔该、早晨、几多钱）',
    ],
    official_links: [
      {
        label: '香港旅游发展局·社区探索',
        url: 'https://www.discoverhongkong.com',
      },
      {
        label: '民政事务总署·区议会',
        url: 'https://www.had.gov.hk',
      },
    ],
  },
  'onboard-307': {
    required_items: ['新地址证明', '已打厘印租约'],
    tips: [
      '避开周末和吉日搬屋更便宜',
      "香港邮政'邮件转递服务'可把旧地址的信转去新地址",
      '搬屋公司格价差距可达4倍→多比较',
    ],
    pitfalls: [
      '未在搬屋前1个月书面通知业主退租或续约——需遵守租约通知期',
      '入伙后72小时内完成地址更改——银行/入境处/运输署/香港邮政的通讯地址需更新',
      '退租时未抄录最后水表电表读数并拍照留底→被多收水电费或扣押金',
      '忘记通知业主/管理处预约货𨋢及缴按金——部分屋苑需提前预约',
    ],
    official_links: [
      {
        label: '香港邮政邮件转递',
        url: 'https://www.hongkongpost.hk',
      },
    ],
  },
  'onboard-300': {
    required_items: [
      '香港身份证或行街纸（临时身份证明）',
      '入息/经济证明（存款证明/银行流水/雇佣合约）',
      '护照/港澳通行证（如尚无HK身份证）',
    ],
    tips: ['完成找房向导后自动解锁onboard-301~307任务', '如不确定预算，先了解各区租金行情再回来填'],
    pitfalls: [
      '睇楼前必须签署睇楼纸（有效期3个月）——直系亲属也受约束，绕开原代理租同一单位需付双倍佣金',
      '未查册核实业主身份——需到iris.gov.hk查册（HK$10）确认注册业主，防止虚假出租和二房东',
      '口头承诺不算数——所有条件必须写进租约（维修责任/免租期/家电清单）',
    ],
    official_links: [
      {
        label: '28Hse 租屋平台',
        url: 'https://www.28hse.com',
      },
      {
        label: 'House730',
        url: 'https://www.house730.com',
      },
      {
        label: '差饷物业估价署·租务管制',
        url: 'https://www.rvd.gov.hk',
      },
    ],
  },
  'onboard-308': {
    required_items: [
      '香港身份证/护照',
      '入息/资产证明（至少3个月银行流水+税单+雇佣合约）',
      '预批按揭所需文件（如做预批）',
    ],
    tips: [
      "通过优才/高才/专才/IANG购楼可'先免后徵'",
      '按揭可贷90%(楼价≤$1000万首置自住)',
      '内地/海外入息可申请按揭(需3月入息证明)',
    ],
    pitfalls: [
      '2024年2月撤辣后非永居购房税费已与永居看齐（最高4.25%），但需注意"先免后征"——若最终未获永居须补缴BSD',
      '购房后确保物业有生活痕迹——空置物业说服力弱，水电煤以你名义登记',
      '非永居阶段购房≈19.25%印花税——$1000万房税约$192.5万，永居后豁免BSD省约$150万',
    ],
    official_links: [
      {
        label: '一手住宅物业销售监管局',
        url: 'https://www.srpa.gov.hk',
      },
      {
        label: '中原地产·置业指南',
        url: 'https://hk.centanet.com',
      },
      {
        label: '差饷物业估价署·物业资讯网',
        url: 'https://www.rvdpi.gov.hk',
      },
    ],
  },
  'onboard-309': {
    required_items: [
      '个人身份证明（确认是否永居身份以判定BSD适用）',
      '入息/资产证明（3个月银行流水+税单+雇佣合约）',
      '目标物业楼价和成交信息',
    ],
    tips: [
      '从价印花税（AVD）按阶梯计算：$300万以下$100, $300-450万1.5%, $450-600万2.25%, $600-900万3%, $900-2000万3.75%, $2000万以上4.25%',
      '按揭成数（2026年）：楼价≤$1000万最高9成（首置+自住+固定收入）, $1125-1500万最高8成, $1715万以上最高7成',
      '非永居通过人才计划购房适用"先免后征"——暂免BSD（15%），永居后免除',
    ],
    pitfalls: [
      '忽略杂费：地产代理佣金约1%+律师费0.1-0.2%+按揭保费+火险/管理费',
      '非永居购房=BSD 15%+AVD最高4.25%=约19.25%——$1000万房税约$192.5万，永居后买仅付AVD最高4.25%省$150万',
      '压力测试已暂停（2026年）但银行仍评估还款能力——月供不超过收入合理比例',
    ],
    official_links: [
      {
        label: '税务局·印花税',
        url: 'https://www.ird.gov.hk/chi/tax/stamp_duty.htm',
      },
      {
        label: '金管局·按揭指引',
        url: 'https://www.hkma.gov.hk/chi/key-functions/banking-stability/mortgage-lending/',
      },
      {
        label: '银行公会·按揭资讯',
        url: 'https://www.hkab.org.hk',
      },
    ],
  },
  'onboard-310': {
    required_items: ['HK身份证/护照', '临时买卖合约（临约）', '细订收据（楼价3-5%）', '土地查册结果（土地注册处报告）'],
    tips: [
      '律师费约楼价0.1-0.2%——律师负责查契/准备正式合约及按揭文件',
      '签临约时支付"细订"（楼价3-5%），临约具法律约束力',
      '签正式合约时支付"大订"（合计约楼价10%），成交期一般约3个月',
    ],
    pitfalls: [
      '临约签署前未查册——需到土地注册处查询物业是否有未完成按揭/违建/钉契',
      '未在临约中明确成交日期、贷款条件（subject to mortgage）等保障条款——如银行贷款不足可能损失订金',
      '验楼可在成交前聘请独立验楼师（约数千元）而非等到收楼后才发现问题',
    ],
    official_links: [
      {
        label: '香港律师会·物业买卖指引',
        url: 'https://www.hklawsoc.org.hk',
      },
      {
        label: '一手住宅销售监管局',
        url: 'https://www.srpa.gov.hk',
      },
    ],
  },
  'onboard-311': {
    required_items: [
      'HK身份证/护照',
      '公司审计报告（自雇）/雇佣合约+薪资单（受雇）',
      '个人银行流水（最近3-6个月）',
      '内地/香港纳税记录',
      '公司注册证书+商业登记证（如企业主）',
      '临时买卖合约（已完成签署）',
    ],
    tips: [
      '多家银行比较利率——全期按息低至Hibor+1.3%, 封顶P-2%(P=5.25%), 实际年息约3.25%, 最长还款期30年',
      '大部分银行及按保公司接受内地/海外入息申请——需至少3个月入息证明',
      '企业主（自雇）建议香港公司运营满2年+保留完整审计记录后再申请按揭',
    ],
    pitfalls: [
      '银行通常不接受内地或海外物业作为资产计算——只认可存款/股票/基金/投资保险',
      '香港信用记录需从零建立——到港后前3个月申请信用卡建立记录对按揭有帮助',
      '收入与贷款金额不匹配——银行会评估还款能力，确保月供在合理范围',
    ],
    official_links: [
      {
        label: '金管局·按揭贷款',
        url: 'https://www.hkma.gov.hk/chi/key-functions/banking-stability/mortgage-lending/',
      },
      {
        label: '多间银行按揭比较',
        url: 'https://www.hkma.gov.hk',
      },
    ],
  },
  'onboard-312': {
    required_items: [
      '正式买卖合约（已签署）',
      '大订付款证明',
      '律师行结算单/成交清单',
      '按揭贷款文件（如已申请）',
      '身份证明文件',
    ],
    tips: [
      '成交期一般约3个月——建议成交日前安排最后视察确认交吉状态',
      '可聘用独立验楼师（约数千元）检查单位——发现结构问题可即时向业主/发展商提出',
      '收楼后确保水电煤账户转至你名下、管理费登记完成',
    ],
    pitfalls: [
      '未在成交日前安排最后验楼——收楼后发现的隐藏问题（漏水/墙身裂痕/冷气故障）难以追溯',
      '未确认"交吉"状态——原业主未清空/未拆违建/未缴清管理费差饷影响收楼',
      '"先免后征"人士若未来未获永居须补缴BSD——保留身份规划路径',
    ],
    official_links: [
      {
        label: '差饷物业估价署·物业成交',
        url: 'https://www.rvd.gov.hk',
      },
      {
        label: '土地注册处·查册',
        url: 'https://www.landreg.gov.hk',
      },
      {
        label: '水务署·转名',
        url: 'https://www.wsd.gov.hk',
      },
    ],
  },
  'onboard-313': {
    required_items: [
      '身份证明（HK身份证/通行证/护照）',
      '入息/经济证明（银行存款/雇佣合约/税单——业主有权查看）',
      '查册结果（iris.gov.hk, HK$10）核实业主身份和物业状态',
      '签署睇楼纸（睇楼前必签，有效期3个月）',
      '预备资金——按金2月+首月租金+中介费半月+印花税≈月租3.5-4倍',
    ],
    tips: [
      '睇楼建议白天+晚上各去一次（白天看采光，晚上看噪音）',
      '同一房源不同中介报价可能差$500-1000/月，多平台对比',
      '签约前到土地注册处iris.gov.hk查册确认业主身份',
      '免租期从签约日起算，不是从入住日起算',
    ],
    pitfalls: [
      '睇楼前必须签睇楼纸（有效期3个月），否则同一单位找其他中介可能被追佣',
      '口头承诺不算数——所有条件必须写进租约',
      '业主未通知银行擅自出租自住物业→断供→银行收楼→租客不获赔偿',
    ],
    official_links: [
      {
        label: '28Hse',
        url: 'https://www.28hse.com',
      },
      {
        label: '地产代理监管局',
        url: 'https://www.eaa.org.hk',
      },
      {
        label: '地产资讯网(查凶宅)',
        url: 'https://www.property.hk',
      },
    ],
  },
  'onboard-401': {
    required_items: ['HK身份证', '内地驾照正本+副本', '地址证明（近3月）', 'TD63A申请表', 'HK$900', '出入境记录证明'],
    tips: ['费用$900（60岁以下，10年有效）', '可授权代理人递交', '2025年9月起经免试签发驾照档号以DI为字首'],
    pitfalls: [
      '不接受邮寄/投递申请',
      '回乡证和内地居住证不视为旅行证件（不能用于免试换领）',
      '70岁以上需TD256体格检验证明书',
    ],
    official_links: [
      {
        label: '运输署网上预约',
        url: 'https://www.gov.hk/tc/residents/transport/drivinglicense/formtd63a.htm',
      },
    ],
  },
  'onboard-402': {
    required_items: ['八达通', '智能手机已开通香港上网'],
    tips: [
      '都会票2025年5月起可在MTR Mobile App购买电子版',
      '八达通+AlipayHK已覆盖绝大部分交通工具',
      '隧道已采用HKeToll电子收费',
    ],
    pitfalls: [
      '学生八达通需每年到港铁客务中心续期——过期自动转成人价，通勤成本翻倍',
      '的士起表$27（2026年），过海附加费使车费翻倍',
      '香港行人靠左、过马路先看右边——与内地相反',
      '部分巴士不设普通话报站——建议开Google Maps实时追踪防止坐过站',
    ],
    official_links: [
      {
        label: 'MTR Mobile',
        url: 'https://www.mtr.com.hk/mtrmobile',
      },
    ],
  },
  'onboard-403': {
    required_items: ['SmartPLAY登记'],
    tips: [
      '繁忙时间（平日18:00后+周末13:00后）难抢',
      "健身室需先完成'正确使用健身室设施简介会'",
      '游泳池无需预约，开放时段前排队',
    ],
    pitfalls: [
      'SmartPLAY实名预约+抽签制——热门时段（周末晚）需提前7天抢号，羽毛球场中签率可能低于30%',
      '系统绑定HK身份证——刚入境未获身份证者无法注册',
      '预约取消须至少提前24小时——多次违规会暂停预约资格30-90天',
    ],
    official_links: [
      {
        label: 'SmartPLAY',
        url: 'https://smartplay.lcsd.gov.hk',
      },
    ],
  },
  'onboard-404': {
    required_items: ['HA Go已登记', '八达通/现金', 'HK身份证'],
    tips: ['抢号秘诀：每小时的29分和59分刷新', '首次使用可在非紧急情况下预约→熟悉流程', '就诊后可要求开具病假纸'],
    pitfalls: ['迟到→可能需重新预约', '两个月内累计3次失约→失去电话/App预约资格'],
    official_links: [
      {
        label: 'HA Go',
        url: 'https://www.ha.org.hk/hago',
      },
    ],
  },
  'onboard-405': {
    required_items: [
      '香港身份证（参加大多数社区活动的基础证件）',
      '住址证明（部分社区中心要求所在区域居住证明）',
      '费用：大部分免费或低廉（HKD 50-200/期），长者中心更低（HKD 20-50/次）',
    ],
    tips: ['康文署社区康乐活动每月更新', '兴趣班是认识本地朋友的最快方式', '很多NGO提供免费广东话班'],
    pitfalls: [
      '广东话兴趣班居多——普通话/英语活动覆盖面有限，建议先查该中心是否提供',
      '社区活动报名往往需现场办理会员卡（带身份证+住址证明），不能全线上完成',
      '港大SPACE等大学进修粤语班收费HKD 2000-5000/期，与免费社区活动不同',
    ],
    official_links: [
      {
        label: '康文署·社区活动',
        url: 'https://www.lcsd.gov.hk',
      },
      {
        label: '民政事务总署·兴趣班',
        url: 'https://www.had.gov.hk',
      },
      {
        label: '工联会·进修课程',
        url: 'https://www.hkftustsc.org',
      },
    ],
  },
  'onboard-406': {
    required_items: [
      'WhatsApp/微信账号（香港社交主力工具）',
      'LinkedIn账号（专业人士脉圈）',
      '部分付费组织（如香港总商会）需会费HKD 1000-3000/年',
    ],
    tips: [
      '香港行山文化极发达，行山群是最容易融入的社交圈',
      'Meetup上有很多Expats和Local混合的群组',
      '不要害羞——香港人比想象中友好',
    ],
    pitfalls: [
      'Facebook/Meetup使用率低于内地预期——真正活跃本地社交在WhatsApp群组和微信',
      '行山群等大量聚集在Facebook群组，内地手机需稳定网络',
      '港漂群商业化倾向显著——部分群由商业机构运营（如保险销售），需辨别信息真实性',
    ],
    official_links: [
      {
        label: 'Meetup 香港·社交活动',
        url: 'https://www.meetup.com/hong-kong/',
      },
      {
        label: '小红书·港漂社群',
        url: 'https://www.xiaohongshu.com',
      },
    ],
  },
  'onboard-407': {
    required_items: ['已入职雇主证明', '税单/BIR60表格'],
    tips: [
      '网上电子报税（eTax）可延长提交期至2个月',
      '以月入$40,000为例：单身税款约$18,100（扣除基本+租金+MPF后）',
      '带2名子女基本可达至免税',
    ],
    pitfalls: ['逾期提交可被罚款最高$10,000', '如须课税但没收到报税表须主动通知税务局'],
    official_links: [
      {
        label: '税务局',
        url: 'https://www.ird.gov.hk',
      },
    ],
  },
  'onboard-408': {
    required_items: ['已开通香港上网的智能手机'],
    tips: [
      '把紧急联系人设为手机快捷拨号',
      '记录最近医院/警署/消防局的地址',
      "如在偏远地区行山→下载'郊野公园远足安全App'",
    ],
    pitfalls: [
      '999是统一紧急号码——但非紧急情况请勿拨打，滥用可被检控',
      '证件丢失须先报警拿报案回执——这是所有后续补办的基础文件，非直接去中旅社/入境处',
      '公立急症室HKD 180/次但轮候4-8小时——普通门诊须提前预约（HKD 50/次）',
    ],
    official_links: [
      {
        label: '香港警务处·紧急求助',
        url: 'https://www.police.gov.hk',
      },
      {
        label: '1823 政府热线',
        url: 'https://www.1823.gov.hk',
      },
      {
        label: '消防处·救护服务',
        url: 'https://www.hkfsd.gov.hk',
      },
    ],
  },
  'onboard-501a': {
    required_items: [
      '子女出生证明（正本+副本，非英文件需翻译）',
      '父母HK身份证/签证副本',
      '子女受养人签证/香港身份证（如已办理）',
      '住址证明（部分幼稚园按区域优先）',
      '儿童免疫接种记录（需香港卫生署认可）',
    ],
    tips: [
      "政府资助幼稚园需申请'幼稚园入学注册证'",
      '国际幼稚园通常不在资助范围',
      '8月出生的孩子可能是全班最小→考虑推迟一年入学',
    ],
    pitfalls: [
      'K1须提前1年申请（入学前一年9-11月报名）——错过窗口只能等K2插班',
      'N班（2岁班）学位极度紧张——需怀孕期间开始排队',
      '幼稚园入学与"校网"无关（校网仅适用于小学派位），但部分幼稚园有附属小学优势',
      '非牟利幼稚园虽免学费但杂费（茶点/校服/书簿）仍约HKD 5000-10000/年',
    ],
    official_links: [
      {
        label: '教育局·幼稚园教育',
        url: 'https://www.edb.gov.hk/tc/edu-system/preprimary-kindergarten/index.html',
      },
      {
        label: '幼稚园概览',
        url: 'https://www.chsc.hk/kindergarten/',
      },
    ],
  },
  'onboard-502a': {
    required_items: ['子女出生证明及身份证明', '父母HK身份证/签证', '住址证明', '入学申请表+报名费'],
    tips: ['N班通常比K1更早招生', '部分热门国际幼稚园需提前1年半排队', '留位费$970入学后通常可扣减首月学费'],
    pitfalls: [
      '幼稚园面试集中在入学前一年11-12月——错过需大量叩门',
      '非牟利幼稚园虽免费但面试竞争激烈——热门校录取率可能低于30%',
      '8月出生的孩子可能是全班最小——考虑推迟一年入学',
      '国际幼稚园通常不在资助范围且需提前1年半排队',
    ],
    official_links: [
      {
        label: '教育局·幼稚园入学',
        url: 'https://www.edb.gov.hk/tc/edu-system/preprimary-kindergarten/kindergarten-k1-admission-arrangements/index.html',
      },
      {
        label: '学券/幼稚园教育计划',
        url: 'https://www.edb.gov.hk/tc/edu-system/preprimary-kindergarten/pevs/index.html',
      },
    ],
  },
  'onboard-503a': {
    required_items: [
      '子女出生证明及身份证明',
      '父母HK身份证',
      '住址证明',
      '子女成绩单/幼儿园评估报告（叩门时特别重要）',
      '免疫接种记录',
    ],
    tips: [
      '面试以游戏形式进行',
      '穿整齐得体不需正装',
      '小朋友情绪状态>知识储备',
      '家长不要过度抢话',
      '粤语不流利用英文/普通话+表示正在学(加分)',
    ],
    pitfalls: [
      '面试以游戏形式进行——小朋友情绪状态>知识储备，穿整齐得体不需正装',
      '部分热门幼稚园面试以粤语/英语进行——纯普通话背景子女需提前准备',
      '家长面谈约10分钟——学校关注家庭教育理念是否与学校匹配',
    ],
    official_links: [
      {
        label: '教育局·幼稚园入学安排',
        url: 'https://www.edb.gov.hk/tc/edu-system/preprimary-kindergarten/kindergarten-k1-admission-arrangements/index.html',
      },
      {
        label: '幼稚园概览·学校查询',
        url: 'https://www.chsc.hk/kindergarten/',
      },
    ],
  },
  'onboard-504a': {
    required_items: ['子女出生证明及身份证明', '父母HK身份证/签证', '住址证明', '入息证明（申请资助用——家庭月入审查）'],
    tips: [
      '政府资助幼稚园需申请"幼稚园入学注册证"——此为免学费凭证',
      '学费减免计划（全免/半免）按家庭收入审查——四人家庭月入低于约HKD 50000可申请',
      '三类资助：幼稚园教育计划（政府资助）+幼稚园及幼儿中心学费减免+学生就学开支津贴',
    ],
    pitfalls: [
      '资助申请需每年重新提交——忘记续期则次年恢复全费',
      '国际幼稚园不在政府资助范围——学费HKD 8000-25000/月全自费',
      '"幼稚园入学注册证"仅适用于参加计划的非牟利幼稚园——私立独立幼稚园不适用',
    ],
    official_links: [
      {
        label: '学生资助处·幼稚园学费减免',
        url: 'https://www.wfsfaa.gov.hk/sfo/tc/primarysecondary/kinder/index.htm',
      },
      {
        label: '在职家庭津贴',
        url: 'https://www.wfsfaa.gov.hk/wfao/',
      },
      {
        label: '幼稚园教育计划·学费资助',
        url: 'https://www.edb.gov.hk/tc/edu-system/preprimary-kindergarten/pevs/index.html',
      },
    ],
  },
  'onboard-505a': {
    required_items: ['幼稚园概览（chsc.hk）可按区域筛选全部注册幼稚园——需与关卡3找房向导联动选区域'],
    tips: [
      '港岛中西区/湾仔区名校集中但租金最高',
      '九龙城区（九龙塘）国际幼稚园密集',
      '沙田/大埔性价比高适合预算有限家庭',
      '联动关卡3找房向导→只看目标区域幼稚园',
    ],
    pitfalls: [
      '热门区域幼稚园（九龙塘/中西区）面试竞争激烈——建议同时报5-8所增加录取概率',
      '不同区幼稚园质素差异大——参考教育局质素评核报告',
      '区域热门≠适合你的孩子——考虑教学语言（粤/英/普）和教学理念',
    ],
    official_links: [
      {
        label: '幼稚园概览·分区搜索',
        url: 'https://www.chsc.hk/kindergarten/',
      },
      {
        label: 'Baby Kingdom·家长口碑',
        url: 'https://www.baby-kingdom.com',
      },
      {
        label: '教育局·幼稚园名单',
        url: 'https://www.edb.gov.hk/tc/student-parents/sch-info/sch-search/schlist.aspx',
      },
    ],
  },
  'onboard-501b': {
    required_items: ['子女出生证明及身份证明', '住址证明（官立/资助按校网）', '成绩单/在学证明', '课外活动/获奖证明'],
    tips: ['50所代表性学校(10官立+10资助+15直资+7私立+8国际)', '可联动关卡3找房向导→只看目标校区'],
    pitfalls: [
      '五类学校：官立（免费/粤语/校网派位）、资助（免费/多为宗教团体）、直资（年费$2000-6000/课程灵活）、私立（年费$5-15万/独立招生）、国际（年费$15-30万+债券$50-300万）',
      '非永居子女同样享受15年免费教育（公立中小学），但不能通过JUPAS联招',
      '粤语教学环境对纯内地背景子女是显著挑战——建议选有普通话支援的学校',
    ],
    official_links: [
      {
        label: '教育局·学校概览',
        url: 'https://www.chsc.hk/primary/',
      },
      {
        label: '香港小学概览',
        url: 'https://www.schooland.hk',
      },
      {
        label: '直资学校议会',
        url: 'https://www.dsssc.org.hk',
      },
    ],
  },
  'onboard-502b': {
    required_items: [
      '子女HK身份证/受养人签证',
      '住址证明（校网判定依据——须为实际居住地址）',
      '小一入学申请表（教育局统一派发）',
      '自行分配学位计分证明（兄姊在校/父母校友等）',
    ],
    tips: [
      '四大名校网：九龙城41校网、中西区11校网、湾仔12校网——租金普遍$25000+/月',
      '第二梯队性价比之选：沙田91校网、东区14校网——租金$15000-20000/月且学校质素不俗',
      '新来港家庭推荐：荃湾62校网/葵青65校网——社区成熟、跨境交通方便',
    ],
    pitfalls: [
      '自行分配学位"计分办法"对非本地背景家庭不利（无校友分/无兄姊在校分）——大概率需走统一派位',
      '热门校网（如41校网）租房价高且竞争激烈',
      '校网地址必须是实际居住地址（租约+水电账单）——虚假申报学位可能被取消',
    ],
    official_links: [
      {
        label: '教育局·校网划分',
        url: 'https://www.edb.gov.hk/tc/edu-system/primary-secondary/spa-systems/primary-1-admission/school-net-lists.html',
      },
      {
        label: '中原·校网置业',
        url: 'https://hk.centanet.com',
      },
    ],
  },
  'onboard-503b': {
    required_items: [
      '子女出生证明及身份证明（正本+副本）',
      '父母HK身份证',
      '住址证明（最近3月水电煤账单）',
      '最近2年成绩单（需翻译公证）',
      '获奖/课外活动证明（叩门加分）',
      '推荐信（原校老师/校长）',
      '在学证明/转学证明',
      '免疫接种记录',
    ],
    tips: [
      '教育局学位支援组2892 6191→三个工作天内获安排学位',
      '入境管制站可索取申请表',
      '春季插班(1-2月入学)比秋季更易获录取',
    ],
    pitfalls: [
      '插班年级匹配：内地小五=香港小五（同为六年制），内地初三=香港中三（同为三年初中）',
      '春季插班（1-2月入学）比秋季更易获录取——竞争少且学位刚释放',
      '教育局学位支援组2892 6191——三个工作天内为适龄儿童安排学位',
      '部分学校要求降级1年（尤其是英文水平未达标者）',
    ],
    official_links: [
      {
        label: '教育局·学位分配系统',
        url: 'https://www.edb.gov.hk/tc/edu-system/primary-secondary/spa-systems/index.html',
      },
      {
        label: '学校概览·插班指引',
        url: 'https://www.chsc.hk/primary/',
      },
    ],
  },
  'onboard-504b': {
    required_items: [
      '香港同级课本（三联/商务/大众书局购买）',
      '中英数三科历年试卷/练习册',
      '中英/英中字典',
      '文具/计算机',
    ],
    tips: [
      '去三联/商务/大众书局买香港同级课本',
      '部分直资/国际学校另有逻辑推理/小组讨论',
      '面试常见：1分钟中英文自我介绍+为什么选我们',
    ],
    pitfalls: [
      '中文科：香港用繁体字+粤语拼音——与内地简体+普通话拼音完全不同，需专项补课',
      '英文科：香港小学英文水平普遍比内地同级高1-2级——尤其是口语和写作',
      '数学科：香港中学以英文出题为主——内地学生需适应英文数学术语',
    ],
    official_links: [
      {
        label: '香港考试及评核局',
        url: 'https://www.hkeaa.edu.hk',
      },
      {
        label: '教育局·中英数课程指引',
        url: 'https://www.edb.gov.hk/tc/curriculum-development/index.html',
      },
    ],
  },
  'onboard-505b': {
    required_items: [
      '学生：中英文自我介绍（1分钟）、获奖证书/作品集、校服/整齐便服',
      '家长：家庭教育理念陈述、子女成长故事、对目标学校的了解',
    ],
    tips: [
      '即使英文学校也可能用粤语闲谈→准备基本粤语回应',
      "不要过度训练→香港学校讨厌'背答案'",
      '面试后24小时内发感谢电邮(英文)',
    ],
    pitfalls: [
      '即使英文学校也可能用粤语闲谈——准备基本粤语回应（如"我哋会支持小朋友"）',
      '不要过度训练——香港学校讨厌"背答案"，自然真诚最重要',
      '面试后24小时内发英文感谢电邮——这是香港职场/学校的基本礼节',
    ],
    official_links: [
      {
        label: '教育局·学校概览',
        url: 'https://www.chsc.hk/primary/',
      },
      {
        label: '香港小升中面试资料网',
        url: 'https://www.edu-kingdom.com',
      },
    ],
  },
  'onboard-506b': {
    required_items: [
      '叩门信（手写/打印，中英皆可）',
      '子女成绩单/评估报告副本',
      '获奖/课外活动证明副本',
      '推荐信（如有）',
      '子女近照',
      '回邮信封（贴足邮票）',
    ],
    tips: ['叩门≠走后门，全公开候补机制', '可同时向多校叩门', '面试表现>笔试成绩(叩门阶段)'],
    pitfalls: [
      '叩门≠走后门——全公开候补机制，入学处公平处理',
      '可同时向多校叩门——无数量限制但建议精选3-5所',
      '面试表现>笔试成绩（叩门阶段）——学校更看重学生态度和家长诚意',
      '叩门黄金窗口仅2-3天（放榜后）——提前备好全套材料随时投递',
    ],
    official_links: [
      {
        label: '教育局·学位分配',
        url: 'https://www.edb.gov.hk/tc/edu-system/primary-secondary/spa-systems/secondary-sch/index.html',
      },
      {
        label: '教育王国·叩门攻略',
        url: 'https://www.edu-kingdom.com',
      },
    ],
  },
  'onboard-507b': {
    required_items: ['持续8年的在学证明/成绩单档案', '各阶段学校申请表', '课外活动/比赛证明'],
    tips: ['DSE和华侨生联考不可兼得需提前规划', '2026年DSE本地生定义：需在港住满2年', '小学插班时就要做好8年规划'],
    pitfalls: [
      'DSE和华侨生联考不可兼得——需提前规划路线（小四前决定）',
      '2026年DSE本地生定义：需在港住满2年——永居≠本地生（大学学费方面）',
      '小学插班时就要做好8年规划——中学→大学→永居的时间轴需完整对齐',
      'IB路线衔接英/美大学成本低于DSE，但学费高3-5倍',
    ],
    official_links: [
      {
        label: '考评局·DSE',
        url: 'https://www.hkeaa.edu.hk/tc/hkdse/',
      },
      {
        label: 'IBO·国际文凭',
        url: 'https://www.ibo.org',
      },
      {
        label: '港澳台华侨生联考',
        url: 'https://www.eeagd.edu.cn',
      },
    ],
  },
  'onboard-601': {
    required_items: [
      '雇主IR56B表格（由雇主每年4月提交税务局）',
      '个人薪俸税报税表BIR60（4月发出，1个月内填写）',
      '评税通知书（税务局10-11月发出）',
    ],
    tips: ['eTax网上报税可延长至2个月', '月入$40k单身税款约$18,100(扣基本+租金+MPF)', '带2子女可达至免税'],
    pitfalls: [
      '第一次报税特别容易忽略——年中入职首份报税表次年4月才发出（覆盖数月收入）',
      '在读期间无香港来源收入则无需报税，但校内兼职/实习（TA/RA）必须申报',
      '薪俸税累进2-17%（或标准15%取低者），基本免税额HKD 132000（2025/26）',
      'eTax网上报税可延长至2个月',
    ],
    official_links: [
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
  'onboard-602': {
    required_items: ['HK身份证', '雇主MPF登记通知', 'MPF受托人账户资料'],
    tips: [
      'MPF供款比例：雇员5%+雇主5%，月薪$7100以下免供',
      'MPF默认"分散投资"策略偏保守——年轻人建议转"增长型"或"环球股票"组合以对抗通胀',
      '每年可免费转换MPF投资组合1次——利用年度结单检讨投资表现',
    ],
    pitfalls: [
      '默认不选择=自动进入保守组合——长期回报可能低于通胀（~1-2%年化）',
      '频繁转换MPF投资组合并不建议——管理费累积侵蚀回报',
      '转换工作时MPF账户转移需主动操作——可能遗留多个空账户增加管理复杂度',
      'MPF在65岁前一般不能提取（永久离港除外）',
    ],
    official_links: [
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
  'onboard-603': {
    required_items: [
      '香港银行账户（已开通）',
      'HK身份证',
      '内地银行账户（汇款来源）',
      '收款人资料（内地银行SWIFT/账号）',
    ],
    tips: [
      '转数快（FPS）即时转账覆盖香港本地——建议到港后尽快开通',
      'Wise/OFX等第三方汇款平台汇率优于银行——$10000以上汇款可省$200-500',
      '中银香港→中银内地"中银快汇"免手续费——同集团跨境汇款最优方案',
    ],
    pitfalls: [
      '不要一次性汇入超大额（>$30万HKD）——可能触发银行大额交易审核延迟到账',
      '注意每人每年$5万美元外汇额度限制（内地）',
      '汇款用途填写规范——"留学/生活费用"而非"投资/购房"免触发外汇管制',
    ],
    official_links: [
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
  'onboard-604': {
    required_items: ['银行户口（已开通自动转账）', '各公用事业账单（水/电/煤/管理费）'],
    tips: [
      '银行自动转账：到各公用事业网站或致电客服登记——中电/港灯/水务署均支持',
      'AlipayHK自动付款：进入"生活缴费"→选择服务商→绑定自动付款→从信用卡/余额扣款免手续费',
      '每月自动扣款记录=在港居住的强力佐证——建议保留至少3年账单',
    ],
    pitfalls: [
      '自动转账≠授权后万事大吉——银行账户余额不足时扣款失败会产生逾期罚款',
      '搬屋后必须更新所有自动转账的地址和账号——旧地址账单转嫁给下任租客会陷入纠纷',
      '水电煤账单是最有力的住址证明——每季度保留一份完整账单',
    ],
    official_links: [
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
  'onboard-605': {
    required_items: ['银行存款账户', '香港身份证'],
    tips: [
      '应急基金建议：3-6个月生活费（HK$45000-90000）——以月均HK$15000计算（租金/饮食/交通）',
      '高息活期：ZA Bank/WeLab Bank等虚拟银行活期利率6-8%（2026年）',
      '定期存款：3-6个月港元定存利率约3.5-4%（2026年）',
    ],
    pitfalls: [
      '不要把全部储蓄存入定存——至少保留1个月生活费在活期随时可取',
      '虚拟银行存款保障——每家上限HKD 50万（存款保障计划）',
      '应急基金≠长线投资——追求流动性>回报率',
    ],
    official_links: [
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
  'onboard-606': {
    required_items: [
      '报税表BIR60',
      '免税额/扣税证明——父母/子女（受养人免税额）、租金（租金扣税）、强积金供款记录（MPF扣税）、自愿医保/年金保费（合资格保费扣税）、慈善捐款收据',
    ],
    tips: ['每年3月31日前做规划(购买医保/做慈善/供MPF)', '税率比较：累进(2-17%)vs标准(15%)→取较低者'],
    pitfalls: [
      '每年3月31日前做税务规划——购买医保/做慈善/供MPF可扣减当年税款',
      '累进税率（2-17%）vs标准税率（15%）——税务局自动取较低者，毋须自行选择',
      '租金扣税上限HKD 10万/年——需保留完整租约+印花证明+租金收据',
      '自愿医保（VHIS）保费可扣税——标准计划约$3000-6000/年，扣税上限$8000/人',
    ],
    official_links: [
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
  'onboard-610': {
    required_items: ['身份证明文件', '地址证明', 'HK$1,545注册费'],
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
    official_links: [
      {
        label: '公司注册处eCR',
        url: 'https://eportal.cr.gov.hk',
      },
      {
        label: '商业登记署',
        url: 'https://www.ird.gov.hk',
      },
    ],
  },
  'onboard-611': {
    required_items: ['公司BR+CI', '银行户口', '雇员名单（含自己）'],
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
    official_links: [
      {
        label: '积金局',
        url: 'https://www.mpfa.org.hk',
      },
      {
        label: '积金易eMPF',
        url: 'https://www.empf.org.hk',
      },
    ],
  },
  'onboard-612': {
    required_items: ['公司BR+CI', '银行月结单', '业务单据'],
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
    official_links: [
      {
        label: '公司注册处',
        url: 'https://www.cr.gov.hk',
      },
      {
        label: '税务局利得税',
        url: 'https://www.ird.gov.hk',
      },
    ],
  },
  'onboard-613': {
    required_items: ['公司BR+CI', '个人银行月结单', 'MPF供款记录'],
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
    official_links: [
      {
        label: '税务局eTax',
        url: 'https://www.gov.hk/etax',
      },
    ],
  },
  'onboard-701': {
    required_items: ['签证标签页/e-Visa打印件', '护照/港澳通行证（有效期>签证到期日）', '香港身份证'],
    tips: [
      '高才通A/B类：首次2年→续签3+3年，不绑定雇主',
      'IANG：首次2年→续签2+2+3年，不绑定雇主但需有工作',
      '优才：首次3年→续签3+2年，不要求雇佣但需证明"通常居住"',
      '专才：每次2-3年，绑定雇主——换工需重新申请',
      '须在签证到期前递交申请——审批期间可合法逗留',
    ],
    pitfalls: [
      '各路径续签模式不同——不要用IANG续签策略套用到高才/优才',
      '续签窗口通常为到期前1-3个月——太早申请可能被退回，太迟可能断签',
      '断签=连续居住重新计算——对永居7年计时影响最大',
    ],
    official_links: [
      {
        label: '入境处·延长逗留期限',
        url: 'https://www.gov.hk/tc/residents/immigration/nonpermanent/applyextensionstay/othernpr.htm',
      },
      {
        label: 'GovHK·签证续期',
        url: 'https://www.gov.hk/tc/residents/immigration/nonpermanent/applyextensionstay/othernpr.htm',
      },
    ],
  },
  'onboard-702': {
    required_items: [
      'ID91表格（延期逗留申请表）',
      'ID990B表格（雇主填写+盖章）',
      '旅行证件（通行证+有效签注）',
      '雇佣合同（注明职位/月薪/工时）',
      'MPF缴款记录',
      '税单/评税通知书',
    ],
    tips: [
      '建议提前1-2个月与HR沟通ID990B填写——很多公司HR不熟悉流程需时处理',
      '材料按路径分类归档——受雇=雇主材料为主，自雇=商业登记+合同+银行流水+审计',
      '入境处无硬性薪资门槛——但参考月薪不应低于HKD 20000（基本生活线）',
    ],
    pitfalls: [
      'ID990B需雇主盖章——部分HR可能不配合，需提前沟通并提供填写指引',
      '续签被拒最常见原因：就业状态不稳定（失业/gap无解释）>收入不足>MPF/税务记录缺失>在港联系不足>虚假材料',
      '自雇续签比受雇续签严格得多——入境处想看真实业务而非"挂名自雇"',
    ],
    official_links: [
      {
        label: '入境处·续签所需文件',
        url: 'https://www.gov.hk/tc/residents/immigration/nonpermanent/applyextensionstay/othernpr.htm',
      },
      {
        label: '入境处·表格下载',
        url: 'https://www.immd.gov.hk/hks/forms/forms.html',
      },
    ],
  },
  'onboard-703': {
    required_items: [
      '7年出入境记录（向入境处申请）',
      '7年MPF年度结单（联系受托人）',
      '7年税单/评税通知书（eTAX下载）',
      '7年住址证明（租约+水电煤账单）',
      '各阶段雇佣合同/离职证明/升职信',
      '银行月结单（显示日常消费和入息）',
      '保险/医疗/社区活动参与记录',
    ],
    tips: [
      '"7年档案整理法"：从第一年开始，按年份建7个文件夹，每年末归档一次',
      '"铁三角"材料（出入境+税单+MPF）最受入境处重视——确保三者跨年度对齐无矛盾',
      '第5-6年提前系统整理——检查缺失可最后1年补漏',
    ],
    pitfalls: [
      '最后2年尽量每年在港≥300天——避免连续离港>3个月',
      '证据链断裂（非在港天数）是最常见的补件原因——租约/MPF/税单/雇佣记录跨年度必须连续无断点',
      'MPF/报税记录最容易遗漏早期年份——建议从第一年起保留完整',
    ],
    official_links: [
      {
        label: '入境处·出入境记录申请',
        url: 'https://www.gov.hk/tc/residents/immigration/nonpermanent/applyextensionstay/othernpr.htm',
      },
      {
        label: 'GovHK·住满7年指南',
        url: 'https://www.gov.hk/tc/residents/immigration/idcard/rop145.html',
      },
    ],
  },
  'onboard-704': {
    required_items: ['最近3月水电煤账单（必须是近期，过旧不被接受）', '水务署/中电/港灯/煤气公司账户信息'],
    tips: [
      '水务署转名免费——到水务署网站或致电办理，3-5工作天生效',
      '中电/港灯/煤气转名需约HKD 100-300按金——新账户开通后旧账单自动转至新地址',
      '电子账单即时可得——上网下载最近3期PDF比等纸质信快得多',
    ],
    pitfalls: [
      '水电煤账单上姓名必须与身份证完全一致——英文名/姓名的任何缩写差异可能不被接受',
      '电子账单截图不被接受——需下载官方PDF格式账单（含水印/账号）',
      '若最近3月刚搬家账单不齐全——可附上新旧地址账单+搬家证明（搬屋公司收据）过渡',
    ],
    official_links: [
      {
        label: '中电·电子账单',
        url: 'https://www.clp.com.hk',
      },
      {
        label: '港灯·电子账单',
        url: 'https://www.hkelectric.com',
      },
      {
        label: '水务署·电子账单',
        url: 'https://www.wsd.gov.hk/tc/customer-services/online-services/index.html',
      },
    ],
  },
  'onboard-705': {
    required_items: [
      '香港商业登记证（BR）',
      '公司注册证书（CI）',
      '业务合同/发票（近6-12个月）',
      '公司银行月结单（近6-12个月）',
      '审计报告（有限公司必备）',
      '自雇MPF供款记录',
      '个人税单/评税通知书',
    ],
    tips: [
      '自雇续签给自己发薪≥HKD 15000-20000/月并注册MPF供款——这是证明"在香港有经济贡献"的最直接方式',
      '初创公司持续亏损不直接影响续签——但需展示真实运营（客户/产品进展）',
      '最优策略：受雇+自雇并行——一条路径不稳定时另一路径兜底',
    ],
    pitfalls: [
      '自雇续签核心难点：证明"真实业务"——入境处会审视业务合同是否有真实交易',
      '注册空壳公司/无实际运营/无本地客户=高风险拒签——续签前至少6个月开始积累业务证据',
      '不要造假——入境处有跨境核查能力，一经发现永久列入黑名单',
      '营收不应全为关联交易（即只做内地企业买卖）——入境处希望看到自主获客能力',
    ],
    official_links: [
      {
        label: '入境处·企业家来港投资',
        url: 'https://www.gov.hk/tc/residents/immigration/nonpermanent/applyextensionstay/entrepreneur.htm',
      },
      {
        label: '公司注册处',
        url: 'https://www.cr.gov.hk',
      },
      {
        label: '投资推广署',
        url: 'https://www.investhk.gov.hk',
      },
    ],
  },
};
