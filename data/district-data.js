/**
 * 找房向导区域数据
 * 数据来源: 美联物业、中原地产、28Hse公开数据 (2026年5月)
 * 覆盖: 全港35个主要居住区域
 * 更新建议: 每6个月复核租金和通勤数据
 * 数据等级: B级(行业平台公开数据)
 */

/**
 * 找房向导 (District Finder) 决策树数据
 * 关卡3 — 住港伴V3港漂通关手册
 *
 * 35个香港热门租屋地区 × 8个数据维度
 * 涵盖港岛(8)、九龙(12)、新界(15)
 *
 * @module district-data
 * @version 1.0.0
 */

// =============================================================================
// 地区数据
// =============================================================================

module.exports = [
  // ============================
  // 港岛 (8个地区)
  // ============================

  {
    district: "西营盘",
    region: "港岛",
    avgRentPsf: 42,
    commute: { central: 10, causewayBay: 20, tst: 25 },
    schoolNet: { primary: 11, secondary: "中西区" },
    mtrLines: ["港岛线"],
    vibe: "老香港风情 + 外籍家庭聚居 + 慢生活节奏",
    priceRange: { studio: "12K-18K", oneBed: "15K-25K", twoBed: "20K-35K", threeBed: "30K-50K" },
    bestFor: ["港岛上班族", "外籍人士", "喜欢传统社区"],
    hasNewTerritory: false,
    familyFriendly: 3
  },
  {
    district: "坚尼地城",
    region: "港岛",
    avgRentPsf: 40,
    commute: { central: 15, causewayBay: 25, tst: 30 },
    schoolNet: { primary: 11, secondary: "中西区" },
    mtrLines: ["港岛线"],
    vibe: "海滨悠闲生活 + 新兴餐饮区 + 年轻专业人士聚集",
    priceRange: { studio: "11K-17K", oneBed: "14K-24K", twoBed: "19K-33K", threeBed: "28K-48K" },
    bestFor: ["港岛上班族", "年轻专业人士", "海滨生活爱好者"],
    hasNewTerritory: false,
    familyFriendly: 3
  },
  {
    district: "湾仔",
    region: "港岛",
    avgRentPsf: 48,
    commute: { central: 5, causewayBay: 5, tst: 15 },
    schoolNet: { primary: 12, secondary: "湾仔区" },
    mtrLines: ["港岛线", "东铁线"],
    vibe: "商业与住宅混合 + 国际学校集中 + 核心交通枢纽",
    priceRange: { studio: "14K-22K", oneBed: "18K-30K", twoBed: "26K-45K", threeBed: "40K-70K" },
    bestFor: ["港岛上班族", "有学龄儿童家庭", "高预算租客"],
    hasNewTerritory: false,
    familyFriendly: 4
  },
  {
    district: "铜锣湾",
    region: "港岛",
    avgRentPsf: 50,
    commute: { central: 8, causewayBay: 0, tst: 15 },
    schoolNet: { primary: 12, secondary: "湾仔区" },
    mtrLines: ["港岛线"],
    vibe: "购物商圈核心 + 人流密集 + 生活便利度极高",
    priceRange: { studio: "15K-24K", oneBed: "20K-35K", twoBed: "28K-50K", threeBed: "42K-75K" },
    bestFor: ["铜锣湾附近上班族", "购物爱好者", "追求极致便利生活"],
    hasNewTerritory: false,
    familyFriendly: 3
  },
  {
    district: "北角",
    region: "港岛",
    avgRentPsf: 38,
    commute: { central: 15, causewayBay: 10, tst: 20 },
    schoolNet: { primary: 14, secondary: "东区" },
    mtrLines: ["港岛线", "将军澳线"],
    vibe: "老牌住宅区 + 福建/上海侨乡 + 生活成本适中的港岛之选",
    priceRange: { studio: "10K-16K", oneBed: "13K-22K", twoBed: "18K-30K", threeBed: "26K-42K" },
    bestFor: ["预算有限港岛上班族", "年长居民", "追求海景生活"],
    hasNewTerritory: false,
    familyFriendly: 3
  },
  {
    district: "鲗鱼涌",
    region: "港岛",
    avgRentPsf: 36,
    commute: { central: 15, causewayBay: 10, tst: 25 },
    schoolNet: { primary: 14, secondary: "东区" },
    mtrLines: ["港岛线"],
    vibe: "大型住宅区 + 商务区延伸 + 太古城生活圈",
    priceRange: { studio: "10K-16K", oneBed: "13K-22K", twoBed: "17K-28K", threeBed: "24K-40K" },
    bestFor: ["港岛上班族", "太古坊商务人士", "中产家庭"],
    hasNewTerritory: false,
    familyFriendly: 4
  },
  {
    district: "太古",
    region: "港岛",
    avgRentPsf: 37,
    commute: { central: 18, causewayBay: 12, tst: 28 },
    schoolNet: { primary: 14, secondary: "东区" },
    mtrLines: ["港岛线"],
    vibe: "中产大型屋苑 + 太古城中心商圈 + 社区配套完善",
    priceRange: { studio: "11K-17K", oneBed: "14K-24K", twoBed: "18K-30K", threeBed: "25K-42K" },
    bestFor: ["港岛上班族", "中产家庭", "追求生活品质"],
    hasNewTerritory: false,
    familyFriendly: 4
  },
  {
    district: "香港仔",
    region: "港岛",
    avgRentPsf: 32,
    commute: { central: 20, causewayBay: 15, tst: 30 },
    schoolNet: { primary: 18, secondary: "南区" },
    mtrLines: ["南港岛线"],
    vibe: "传统渔港社区 + 公共屋邨为主 + 港岛低价之选",
    priceRange: { studio: "8K-13K", oneBed: "11K-18K", twoBed: "15K-25K", threeBed: "22K-35K" },
    bestFor: ["预算有限的港岛租客", "本地家庭", "南区上班族"],
    hasNewTerritory: false,
    familyFriendly: 3
  },

  // ============================
  // 九龙 (12个地区)
  // ============================

  {
    district: "尖沙咀",
    region: "九龙",
    avgRentPsf: 52,
    commute: { central: 10, causewayBay: 10, tst: 0 },
    schoolNet: { primary: 31, secondary: "油尖旺区" },
    mtrLines: ["荃湾线", "西铁线"],
    vibe: "维港天际线 + 游客商圈 + 高端住宅与商业交汇",
    priceRange: { studio: "15K-22K", oneBed: "20K-32K", twoBed: "30K-50K", threeBed: "45K-80K" },
    bestFor: ["九龙上班族", "高预算租客", "维港景观爱好者"],
    hasNewTerritory: false,
    familyFriendly: 3
  },
  {
    district: "红磡",
    region: "九龙",
    avgRentPsf: 40,
    commute: { central: 12, causewayBay: 15, tst: 5 },
    schoolNet: { primary: 35, secondary: "九龙城区" },
    mtrLines: ["东铁线", "西铁线"],
    vibe: "住宅密集区 + 红馆文化地标 + 海底隧道交通枢纽",
    priceRange: { studio: "10K-16K", oneBed: "14K-22K", twoBed: "18K-30K", threeBed: "25K-42K" },
    bestFor: ["港岛/九龙跨区上班族", "理工大学师生", "追求交通便利"],
    hasNewTerritory: false,
    familyFriendly: 3
  },
  {
    district: "何文田",
    region: "九龙",
    avgRentPsf: 42,
    commute: { central: 15, causewayBay: 20, tst: 8 },
    schoolNet: { primary: 34, secondary: "九龙城区" },
    mtrLines: ["观塘线", "东铁线"],
    vibe: "传统豪宅区 + 34名校网 + 绿树成荫的高尚住宅",
    priceRange: { studio: "12K-18K", oneBed: "16K-26K", twoBed: "22K-38K", threeBed: "32K-55K" },
    bestFor: ["有学龄儿童家庭", "中产家庭", "九龙上班族"],
    hasNewTerritory: false,
    familyFriendly: 5
  },
  {
    district: "九龙塘",
    region: "九龙",
    avgRentPsf: 50,
    commute: { central: 20, causewayBay: 25, tst: 10 },
    schoolNet: { primary: 41, secondary: "九龙城区" },
    mtrLines: ["东铁线", "观塘线"],
    vibe: "低密度豪宅区 + 国际名校集中 + 静谧高尚生活环境",
    priceRange: { studio: "15K-22K", oneBed: "20K-35K", twoBed: "28K-50K", threeBed: "40K-70K" },
    bestFor: ["高预算家庭", "名校需求家长", "追求低密度生活"],
    hasNewTerritory: false,
    familyFriendly: 5
  },
  {
    district: "奥运站",
    region: "九龙",
    avgRentPsf: 47,
    commute: { central: 10, causewayBay: 15, tst: 5 },
    schoolNet: { primary: 32, secondary: "油尖旺区" },
    mtrLines: ["东涌线", "西铁线"],
    vibe: "现代海滨住宅区 + 大型商场奥海城 + 中产家庭首选",
    priceRange: { studio: "13K-20K", oneBed: "18K-28K", twoBed: "24K-40K", threeBed: "35K-60K" },
    bestFor: ["中产家庭", "港岛跨区上班族", "追求现代社区"],
    hasNewTerritory: false,
    familyFriendly: 5
  },
  {
    district: "南昌",
    region: "九龙",
    avgRentPsf: 40,
    commute: { central: 10, causewayBay: 18, tst: 8 },
    schoolNet: { primary: 40, secondary: "深水埗区" },
    mtrLines: ["东涌线", "西铁线"],
    vibe: "新兴住宅发展区 + 公屋与私楼混合 + 双线交通枢纽",
    priceRange: { studio: "10K-15K", oneBed: "13K-22K", twoBed: "18K-30K", threeBed: "25K-42K" },
    bestFor: ["预算有限的九龙上班族", "港岛跨区上班族", "年轻夫妇"],
    hasNewTerritory: false,
    familyFriendly: 3
  },
  {
    district: "深水埗",
    region: "九龙",
    avgRentPsf: 38,
    commute: { central: 12, causewayBay: 18, tst: 10 },
    schoolNet: { primary: 40, secondary: "深水埗区" },
    mtrLines: ["荃湾线", "东涌线"],
    vibe: "老区活化先锋 + 文青热点 + 电子/手作市集天堂",
    priceRange: { studio: "8K-13K", oneBed: "11K-18K", twoBed: "15K-25K", threeBed: "20K-35K" },
    bestFor: ["预算有限租客", "年轻文艺群体", "创业者"],
    hasNewTerritory: false,
    familyFriendly: 2
  },
  {
    district: "长沙湾",
    region: "九龙",
    avgRentPsf: 35,
    commute: { central: 15, causewayBay: 20, tst: 12 },
    schoolNet: { primary: 40, secondary: "深水埗区" },
    mtrLines: ["荃湾线"],
    vibe: "工业与住宅混合区 + 新建私人住宅涌现 + 性价比之选",
    priceRange: { studio: "8K-12K", oneBed: "11K-18K", twoBed: "14K-24K", threeBed: "20K-33K" },
    bestFor: ["预算有限租客", "九龙上班族", "年轻家庭"],
    hasNewTerritory: false,
    familyFriendly: 3
  },
  {
    district: "启德",
    region: "九龙",
    avgRentPsf: 49,
    commute: { central: 15, causewayBay: 20, tst: 10 },
    schoolNet: { primary: 34, secondary: "九龙城区" },
    mtrLines: ["屯马线"],
    vibe: "全新发展区 + 前机场活化项目 + 现代住宅与商场",
    priceRange: { studio: "13K-20K", oneBed: "18K-30K", twoBed: "24K-42K", threeBed: "35K-60K" },
    bestFor: ["高预算租客", "中产家庭", "追求新颖社区"],
    hasNewTerritory: false,
    familyFriendly: 4
  },
  {
    district: "九龙湾",
    region: "九龙",
    avgRentPsf: 34,
    commute: { central: 20, causewayBay: 25, tst: 15 },
    schoolNet: { primary: 46, secondary: "观塘区" },
    mtrLines: ["观塘线"],
    vibe: "工商业与住宅混合 + 德福广场大型商场 + 实用型社区",
    priceRange: { studio: "8K-13K", oneBed: "11K-18K", twoBed: "15K-25K", threeBed: "20K-33K" },
    bestFor: ["九龙东上班族", "预算有限家庭", "追求生活便利"],
    hasNewTerritory: false,
    familyFriendly: 3
  },
  {
    district: "观塘",
    region: "九龙",
    avgRentPsf: 32,
    commute: { central: 20, causewayBay: 25, tst: 18 },
    schoolNet: { primary: 48, secondary: "观塘区" },
    mtrLines: ["观塘线"],
    vibe: "工业区转型中 + 旧区重建 + 九龙东新兴商业核心",
    priceRange: { studio: "7K-12K", oneBed: "10K-16K", twoBed: "13K-22K", threeBed: "18K-30K" },
    bestFor: ["九龙东上班族", "预算有限租客", "追求性价比"],
    hasNewTerritory: false,
    familyFriendly: 2
  },
  {
    district: "将军澳",
    region: "九龙",
    avgRentPsf: 36,
    commute: { central: 25, causewayBay: 20, tst: 20 },
    schoolNet: { primary: 95, secondary: "西贡区" },
    mtrLines: ["将军澳线"],
    vibe: "大型新兴住宅区 + 海滨长廊 + 年轻家庭聚集新市镇",
    priceRange: { studio: "9K-14K", oneBed: "12K-20K", twoBed: "16K-28K", threeBed: "22K-38K" },
    bestFor: ["新兴家庭", "港岛上班族（将军澳线）", "预算适中的租客"],
    hasNewTerritory: false,
    familyFriendly: 4
  },

  // ============================
  // 新界 (15个地区)
  // ============================

  {
    district: "沙田/大围",
    region: "新界",
    avgRentPsf: 44,
    commute: { central: 25, causewayBay: 30, tst: 20 },
    schoolNet: { primary: 91, secondary: "沙田区" },
    mtrLines: ["东铁线", "屯马线"],
    vibe: "大型新市镇典范 + 配套完善 + 优质中小学密集",
    priceRange: { studio: "10K-16K", oneBed: "14K-24K", twoBed: "18K-32K", threeBed: "26K-45K" },
    bestFor: ["有学龄儿童家庭", "东铁线沿线上班族", "追求空间性价比"],
    hasNewTerritory: true,
    familyFriendly: 5
  },
  {
    district: "火炭",
    region: "新界",
    avgRentPsf: 36,
    commute: { central: 30, causewayBay: 35, tst: 28 },
    schoolNet: { primary: 91, secondary: "沙田区" },
    mtrLines: ["东铁线"],
    vibe: "工业与住宅混合区 + 背山面河景致 + 高性价比屋苑",
    priceRange: { studio: "8K-13K", oneBed: "11K-18K", twoBed: "15K-25K", threeBed: "20K-35K" },
    bestFor: ["东铁线沿线上班族", "预算有限家庭", "追求宁静环境"],
    hasNewTerritory: true,
    familyFriendly: 3
  },
  {
    district: "大埔",
    region: "新界",
    avgRentPsf: 32,
    commute: { central: 35, causewayBay: 40, tst: 35 },
    schoolNet: { primary: 84, secondary: "大埔区" },
    mtrLines: ["东铁线"],
    vibe: "成熟大型社区 + 林村河畔 + 社区配套完善的自足市镇",
    priceRange: { studio: "8K-12K", oneBed: "10K-17K", twoBed: "14K-24K", threeBed: "20K-33K" },
    bestFor: ["东铁线沿线上班族", "家庭租客", "追求空间与宁静"],
    hasNewTerritory: true,
    familyFriendly: 4
  },
  {
    district: "上水",
    region: "新界",
    avgRentPsf: 28,
    commute: { central: 40, causewayBay: 45, tst: 40 },
    schoolNet: { primary: 80, secondary: "北区" },
    mtrLines: ["东铁线"],
    vibe: "边界小镇 + 邻近深圳罗湖 + 生活成本为新界最低之一",
    priceRange: { studio: "6K-10K", oneBed: "8K-14K", twoBed: "12K-20K", threeBed: "16K-28K" },
    bestFor: ["跨境上班族", "预算非常有限的租客", "东铁线沿线通勤"],
    hasNewTerritory: true,
    familyFriendly: 3
  },
  {
    district: "粉岭",
    region: "新界",
    avgRentPsf: 27,
    commute: { central: 42, causewayBay: 47, tst: 42 },
    schoolNet: { primary: 81, secondary: "北区" },
    mtrLines: ["东铁线"],
    vibe: "新界小镇生活 + 绿化率高 + 远离城市喧嚣的宁静之选",
    priceRange: { studio: "6K-9K", oneBed: "8K-13K", twoBed: "11K-19K", threeBed: "15K-26K" },
    bestFor: ["预算非常有限的租客", "东铁线沿线上班族", "追求宁静生活"],
    hasNewTerritory: true,
    familyFriendly: 3
  },
  {
    district: "天水围",
    region: "新界",
    avgRentPsf: 25,
    commute: { central: 40, causewayBay: 45, tst: 35 },
    schoolNet: { primary: 72, secondary: "元朗区" },
    mtrLines: ["轻铁", "西铁线"],
    vibe: "大型公屋社区 + 天水围湿地公园 + 社区设施齐全",
    priceRange: { studio: "5K-8K", oneBed: "7K-12K", twoBed: "10K-17K", threeBed: "14K-24K" },
    bestFor: ["预算非常有限的租客", "家庭租客", "新界西工作"],
    hasNewTerritory: true,
    familyFriendly: 3
  },
  {
    district: "元朗",
    region: "新界",
    avgRentPsf: 32,
    commute: { central: 35, causewayBay: 40, tst: 30 },
    schoolNet: { primary: 74, secondary: "元朗区" },
    mtrLines: ["西铁线", "轻铁"],
    vibe: "新界西核心市镇 + 传统与现代交融 + 美食与购物集中",
    priceRange: { studio: "7K-11K", oneBed: "9K-16K", twoBed: "13K-22K", threeBed: "18K-32K" },
    bestFor: ["新界西上班族", "家庭租客", "西铁线沿线通勤"],
    hasNewTerritory: true,
    familyFriendly: 4
  },
  {
    district: "屯门",
    region: "新界",
    avgRentPsf: 30,
    commute: { central: 35, causewayBay: 40, tst: 35 },
    schoolNet: { primary: 71, secondary: "屯门区" },
    mtrLines: ["西铁线"],
    vibe: "新界西大型海滨市镇 + 自给自足社区 + 生活便利",
    priceRange: { studio: "7K-11K", oneBed: "9K-15K", twoBed: "12K-21K", threeBed: "17K-30K" },
    bestFor: ["屯门/元朗上班族", "家庭租客", "追求宁静社区"],
    hasNewTerritory: true,
    familyFriendly: 4
  },
  {
    district: "荃湾",
    region: "新界",
    avgRentPsf: 38,
    commute: { central: 15, causewayBay: 25, tst: 20 },
    schoolNet: { primary: 62, secondary: "荃湾区" },
    mtrLines: ["荃湾线", "西铁线"],
    vibe: "新界西已发展核心 + 荃湾广场等大型商场 + 交通四通八达",
    priceRange: { studio: "9K-14K", oneBed: "12K-20K", twoBed: "16K-28K", threeBed: "22K-38K" },
    bestFor: ["新界西上班族", "港岛跨区上班族", "家庭租客"],
    hasNewTerritory: true,
    familyFriendly: 4
  },
  {
    district: "青衣",
    region: "新界",
    avgRentPsf: 34,
    commute: { central: 20, causewayBay: 25, tst: 20 },
    schoolNet: { primary: 66, secondary: "葵青区" },
    mtrLines: ["东涌线", "机场快线"],
    vibe: "岛屿住宅社区 + 青衣城商场 + 性价比屋苑聚集",
    priceRange: { studio: "8K-13K", oneBed: "11K-18K", twoBed: "15K-25K", threeBed: "20K-35K" },
    bestFor: ["港岛/九龙上班族", "预算有限家庭", "机场相关从业者"],
    hasNewTerritory: true,
    familyFriendly: 4
  },
  {
    district: "东涌",
    region: "新界",
    avgRentPsf: 33,
    commute: { central: 30, causewayBay: 35, tst: 30 },
    schoolNet: { primary: 98, secondary: "离岛区" },
    mtrLines: ["东涌线", "机场快线"],
    vibe: "离岛新区 + 机场社区 + 大自然环绕的现代市镇",
    priceRange: { studio: "8K-13K", oneBed: "11K-18K", twoBed: "15K-26K", threeBed: "22K-36K" },
    bestFor: ["机场/迪士尼从业者", "港岛上班族（东涌线）", "家庭租客"],
    hasNewTerritory: true,
    familyFriendly: 4
  },
  {
    district: "马鞍山",
    region: "新界",
    avgRentPsf: 36,
    commute: { central: 30, causewayBay: 35, tst: 30 },
    schoolNet: { primary: 89, secondary: "沙田区" },
    mtrLines: ["屯马线"],
    vibe: "海滨住宅区 + 新市镇规划 + 家庭社区氛围浓厚",
    priceRange: { studio: "9K-14K", oneBed: "12K-20K", twoBed: "16K-27K", threeBed: "22K-38K" },
    bestFor: ["沙田区上班族", "家庭租客", "追求海滨生活"],
    hasNewTerritory: true,
    familyFriendly: 4
  },
  {
    district: "愉景湾",
    region: "新界",
    avgRentPsf: 30,
    commute: { central: 30, causewayBay: 35, tst: 35 },
    schoolNet: { primary: 99, secondary: "离岛区" },
    mtrLines: ["渡轮"],
    vibe: "度假式低密度社区 + 无车环境 + 外籍人士聚居",
    priceRange: { studio: "10K-16K", oneBed: "14K-22K", twoBed: "18K-30K", threeBed: "25K-42K" },
    bestFor: ["外籍人士", "追求独特生活体验", "中环渡轮通勤"],
    hasNewTerritory: true,
    familyFriendly: 4
  },
  {
    district: "马湾",
    region: "新界",
    avgRentPsf: 35,
    commute: { central: 30, causewayBay: 35, tst: 35 },
    schoolNet: { primary: 0, secondary: "本区" },
    mtrLines: ["巴士", "渡轮"],
    vibe: "离岛小社区 + 无车环保环境 + 大自然景观环绕",
    priceRange: { studio: "8K-13K", oneBed: "11K-18K", twoBed: "15K-25K", threeBed: "20K-35K" },
    bestFor: ["外籍人士", "追求宁静社区", "家庭租客"],
    hasNewTerritory: true,
    familyFriendly: 3
  },
  {
    district: "西贡",
    region: "新界",
    avgRentPsf: 40,
    commute: { central: 40, causewayBay: 35, tst: 40 },
    schoolNet: { primary: 95, secondary: "西贡区" },
    mtrLines: ["巴士/小巴"],
    vibe: "户外活动天堂 + 海鲜美食闻名 + 低密度独立住宅",
    priceRange: { studio: "10K-16K", oneBed: "14K-22K", twoBed: "18K-30K", threeBed: "25K-42K" },
    bestFor: ["户外运动爱好者", "外籍人士", "追求独立住宅"],
    hasNewTerritory: true,
    familyFriendly: 3
  }
];

// =============================================================================
// 预设选项数据（找房向导问题用）
// =============================================================================

/**
 * 预算档位
 */
module.exports.BUDGET_BRACKETS = [
  { id: "b1", label: "HK$10,000-15,000/月", min: 10000, max: 15000 },
  { id: "b2", label: "HK$15,000-25,000/月", min: 15000, max: 25000 },
  { id: "b3", label: "HK$25,000-40,000/月", min: 25000, max: 40000 },
  { id: "b4", label: "HK$40,000-60,000/月", min: 40000, max: 60000 },
  { id: "b5", label: "HK$60,000+/月", min: 60000, max: 999999 }
];

/**
 * 上班区域选项
 */
module.exports.WORK_REGIONS = [
  { id: "hong-kong-island", label: "港岛", mtrRef: "中环/金钟/湾仔/铜锣湾" },
  { id: "kowloon", label: "九龙", mtrRef: "尖沙咀/旺角/九龙塘/观塘" },
  { id: "new-territories", label: "新界", mtrRef: "沙田/大埔/屯门/元朗" },
  { id: "remote", label: "远程/不固定", mtrRef: "" }
];

// =============================================================================
// 核心推荐逻辑
// =============================================================================

// ── 权重配置（可调） ──
var WEIGHTS = {
  rent:       30,   // 租金友好度
  commute:    35,   // 通勤便利度
  family:     20,   // 家庭友好度
  transport:  10,   // 交通便利度（港铁线数）
  budgetFit:   5,   // 预算匹配度
};

// ── 通勤时间矩阵：按工作区取最近的主要通勤参考站 ──
function getCommute(d, workRegionId) {
  switch (workRegionId) {
    case 'hong-kong-island': return d.commute.central;
    case 'kowloon':          return d.commute.tst;
    case 'new-territories':
      // 新界工作在区内通勤较短，跨区用尖沙咀作中枢参考
      return d.region === '新界' ? Math.round(d.commute.tst * 0.5) : d.commute.central;
    case 'remote':           return 5; // 远程办公无通勤压力
    default:                 return d.commute.central;
  }
}

/**
 * 根据预算、上班区域和是否带娃，推荐最匹配的5个地区
 *
 * v2 改进：
 *   - 加权评分替代线性加分
 *   - 预算精确匹配档位而非仅"可负担"
 *   - 港铁线数计入交通便利度
 *   - 通勤分用平滑衰减替代分段函数
 */
module.exports.matchDistricts = function (budget, workRegion, hasChildren) {
  var districts = module.exports;
  var brackets = module.exports.BUDGET_BRACKETS;

  // 1. 确定用户预算档位
  var userBracket = null;
  for (var i = 0; i < brackets.length; i++) {
    if (budget >= brackets[i].min && budget <= brackets[i].max) {
      userBracket = brackets[i]; break;
    }
  }
  if (!userBracket) {
    for (i = 0; i < brackets.length; i++) {
      if (budget <= brackets[i].max) { userBracket = brackets[i]; break; }
    }
    if (!userBracket) userBracket = brackets[brackets.length - 1];
  }

  // 2. 可负担性过滤
  function parseMinRent(priceStr) {
    return parseInt(priceStr.split('-')[0].replace(/[Kk]/,'000'), 10);
  }

  var d, i, affordable = [];
  for (i = 0; i < districts.length; i++) {
    d = districts[i];
    if (typeof d !== 'object' || !d.district || !d.priceRange) continue;
    var min2Bed = parseMinRent(d.priceRange.twoBed || d.priceRange.studio);
    if (budget >= min2Bed || budget >= parseMinRent(d.priceRange.studio)) {
      affordable.push(d);
    }
  }

  // 3. 加权评分
  var MAX_COMMUTE = 60;
  var MAX_RENT = 60;

  var scored = [];
  for (i = 0; i < affordable.length; i++) {
    d = affordable[i];
    var scores = {};

    // 租金友好度：呎租越低越高（0-1归一化）
    scores.rent = Math.max(0, (MAX_RENT - d.avgRentPsf) / MAX_RENT);

    // 通勤便利度：用指数衰减（15min满分，60min零分）
    var commute = getCommute(d, workRegion);
    scores.commute = Math.exp(-commute / 18);

    // 交通便利度：港铁线数归一化
    scores.transport = Math.min(d.mtrLines.length / 4, 1);

    // 家庭友好度（仅带娃用户计入）
    scores.family = hasChildren ? d.familyFriendly / 5 : 0.5; // 无娃时中性

    // 预算匹配度：用户档位 vs 区域价格档位
    var zoneBracket = d.avgRentPsf < 30 ? 0 : (d.avgRentPsf < 40 ? 1 : (d.avgRentPsf < 50 ? 2 : 3));
    var userBracketIdx = brackets.indexOf(userBracket);
    scores.budgetFit = 1 - Math.abs(zoneBracket - userBracketIdx) / 4;

    // 加权总分
    var total = 0;
    Object.keys(WEIGHTS).forEach(function(k) { total += scores[k] * WEIGHTS[k]; });

    // 新界工作的区域针对性加分
    if (workRegion === 'new-territories' && d.region === '新界' && d.hasNewTerritory) {
      total += 5;
    }

    scored.push({
      district: d.district, region: d.region,
      avgRentPsf: d.avgRentPsf,
      commute: d.commute,
      schoolNet: d.schoolNet,
      mtrLines: d.mtrLines,
      vibe: d.vibe,
      priceRange: d.priceRange,
      bestFor: d.bestFor,
      familyFriendly: d.familyFriendly,
      score: Math.round(total * 10) / 10
    });
  }

  scored.sort(function(a, b) { return b.score - a.score; });
  return scored.slice(0, 5);
};
