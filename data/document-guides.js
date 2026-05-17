/**
 * 证件拍摄指引数据 — 从 documents-add/index.js 提取
 * 30+种证件类型的拍摄指引模板、隐私覆盖条位置、卡槽映射
 */
var SLOT_GUIDES = {
  id_card: { icon: '🪪', title: '身份证材料标准', wfTitle: '中华人民共和国居民身份证', items: [
    '正反面均需拍摄，四角完整可见', '平放深色桌面，正对拍摄，不倾斜', '确保证件号、姓名、照片清晰可读',
    '勿使用复印件或屏幕截图', '圆角边框不得裁切或遮挡'
  ], piiFields: ['姓名', '身份证号', '出生日期', '地址'], specimen: '人像面+国徽面·无反光·圆角完整',
  wfFields: [
    { label: '姓名', width: 'long', pii: true }, { label: '性别', width: 'short', pii: false },
    { label: '民族', width: 'short', pii: false }, { label: '出生日期', width: 'long', pii: true },
    { label: '住址', width: 'full', pii: true }, { label: '公民身份号码', width: 'long', pii: true },
    { label: '签发机关', width: 'mid', pii: false }, { label: '有效期限', width: 'long', pii: false }
  ], showPhoto: true, showSeal: false },
  degree: { icon: '🎓', title: '学位证/毕业证材料标准', wfTitle: '学士学位证书 (A4防伪纸)', items: [
    '证书原件彩色拍摄(A4幅面)，不可拍摄复印件', '16位证书编号(前5位学校代码+4位年份+7位序号)',
    '2寸彩色照片+学校钢印骑缝章清晰', '专业全称、学科门类(如工学学士)', '海外学历需同时拍摄留服认证'
  ], piiFields: ['姓名', '证书编号', '出生日期'], specimen: '学位证正面·钢印+校长签名',
  wfFields: [
    { label: '学位证书编号 (16位)', width: 'long', pii: true }, { label: '姓名 (与身份证一致)', width: 'short', pii: true },
    { label: '性别 / 出生日期', width: 'mid', pii: true }, { label: '专业名称 / 学科门类', width: 'full', pii: false },
    { label: '学位授予单位 (全称)', width: 'full', pii: false }, { label: '校长签名 / 授予日期', width: 'mid', pii: false },
    { label: '2寸彩照 / 钢印骑缝', width: 'short', pii: false }
  ], showPhoto: true, showSeal: true },
  hk_permit: { icon: '🛂', title: '港澳通行证材料标准', wfTitle: '往来港澳通行证 (卡式电子版)', items: [
    '个人信息页+签注页(背面)均需拍摄', '证件号（C开头8位数字）清晰可见',
    '签注页显示D逗留签注类型和有效期', '长城背景底纹、防伪膜反光从侧面打光'
  ], piiFields: ['姓名', '证件号', '出生日期', '有效期'], specimen: '通行证正面个人信息页+背面签注页',
  wfFields: [
    { label: '姓名 (中文)', width: 'short', pii: true }, { label: '姓名 (拼音)', width: 'long', pii: true },
    { label: '通行证号码', width: 'mid', pii: true }, { label: '出生日期', width: 'mid', pii: true },
    { label: '有效期限', width: 'mid', pii: false }, { label: '签发机关 / 签发地', width: 'mid', pii: false },
    { label: '签注类型 / 逗留条件 (背面)', width: 'full', pii: false }
  ], showPhoto: true, showSeal: false },
  passport: { icon: '🛂', title: '护照材料标准', wfTitle: '中华人民共和国护照 (资料页第2页)', items: [
    '资料页(第2页)完整拍摄，含照片、护照号', '护照号为E开头+字母+7位数字',
    '防伪膜含天安门+五星图案，从侧面打光', 'MRZ机读码两行在底部，不可裁切'
  ], piiFields: ['姓名', '护照号', '出生日期', '出生地点'], specimen: '护照第2页资料页·牡丹花防伪',
  wfFields: [
    { label: '类型P / 国家码CHN', width: 'short', pii: false }, { label: '护照号 (E+8位)', width: 'mid', pii: true },
    { label: '姓名 (中文/拼音)', width: 'full', pii: true }, { label: '性别 / 国籍', width: 'short', pii: false },
    { label: '出生日期 / 出生地点', width: 'full', pii: true }, { label: '签发日期 / 有效期至', width: 'full', pii: false },
    { label: '签发机关', width: 'mid', pii: false }, { label: 'MRZ机读码 (底部)', width: 'full', pii: false }
  ], showPhoto: true, showSeal: false },
  hk_id: { icon: '🆔', title: '香港身份证材料标准', wfTitle: '香港永久性居民身份证 (2018版)', items: [
    '正面拍摄，四角完整', '证件号（字母+6位数字+括号校验码）清晰',
    '照片在左侧(黑白ICAO标准)、姓名/出生日期在右侧', '全息图/透明窗口可见、无遮挡'
  ], piiFields: ['姓名', '身份证号', '出生日期'], specimen: '香港身份证正面·照片左置·彩色',
  wfFields: [
    { label: '姓名 (中文)', width: 'mid', pii: true }, { label: '姓名 (英文)', width: 'long', pii: true },
    { label: '身份证号码 (含校验码)', width: 'long', pii: true }, { label: '出生日期', width: 'mid', pii: true },
    { label: '签发日期', width: 'mid', pii: false }, { label: '符号标记 (***AZ 等)', width: 'short', pii: false }
  ], showPhoto: true, showSeal: false },
  household: { icon: '📖', title: '户口本材料标准', wfTitle: '居民户口簿 (首页+户主页+本人页)', items: [
    '首页(扉页)+户主页(常住人口登记卡)+本人页均需拍摄', '首页: 户别/户号/户主姓名/住址/两个公章',
    '本人页: 姓名/与户主关系/身份证号/籍贯/出生地等28项', '户口登记机关(派出所)印章清晰可见'
  ], piiFields: ['姓名', '身份证号', '住址', '籍贯'], specimen: '首页+户主页+本人页·印章清晰',
  wfFields: [
    { label: '户别 (首页)', width: 'short', pii: false }, { label: '户号 (首页)', width: 'mid', pii: false },
    { label: '户主姓名 (首页)', width: 'short', pii: true }, { label: '住址 (首页)', width: 'full', pii: true },
    { label: '本人姓名 (本人页)', width: 'short', pii: true }, { label: '与户主关系 (本人页)', width: 'short', pii: false },
    { label: '公民身份号码', width: 'long', pii: true }, { label: '登记机关 / 签发日期', width: 'mid', pii: false }
  ], showPhoto: false, showSeal: true },
  marriage: { icon: '💍', title: '结婚证材料标准', wfTitle: '中华人民共和国结婚证 (双页展开)', items: [
    '双页全展开拍摄，四角完整不留白', '结婚证字号(J开头)清晰，含行政区划代码',
    '双方姓名、出生日期、身份证号清晰', '合影照片+钢印骑缝章可见', '登记机关红色印章+婚姻登记员亲笔签名'
  ], piiFields: ['双方姓名', '证件号', '登记日期', '出生日期'], specimen: '双页展开·钢印骑缝·红印清晰',
  wfFields: [
    { label: '持证人 (男/女)', width: 'short', pii: true }, { label: '登记日期', width: 'mid', pii: false },
    { label: '结婚证字号', width: 'long', pii: true }, { label: '双方姓名 / 出生日期', width: 'full', pii: true },
    { label: '双方身份证号码', width: 'full', pii: true }, { label: '登记机关 (红印)', width: 'mid', pii: false },
    { label: '婚姻登记员签名', width: 'short', pii: false }
  ], showPhoto: true, showSeal: true },
  birth_cert: { icon: '👶', title: '出生证材料标准', wfTitle: '出生医学证明 (第七版·正页+副页)', items: [
    '正页+副页完整拍摄(不可撕切,副页由派出所裁切)', '婴儿姓名(规范汉字)、性别、出生时间(精确到分)',
    '出生医学证明编号(字母+9位条形码,黄色底)', '父母姓名+身份证号、签发机构+专用章(红色)'
  ], piiFields: ['婴儿姓名', '父母姓名', '身份证号', '出生日期'], specimen: '正页+副页·红色印章·条形码清晰',
  wfFields: [
    { label: '婴儿姓名', width: 'short', pii: true }, { label: '出生医学证明编号', width: 'long', pii: false },
    { label: '出生日期 / 时间', width: 'mid', pii: true }, { label: '母亲姓名 / 证件号', width: 'full', pii: true },
    { label: '父亲姓名 / 证件号', width: 'full', pii: true }, { label: '签发医院 (印章)', width: 'mid', pii: false }
  ], showPhoto: false, showSeal: true },
  work: { icon: '💼', title: '工作证明/推荐信材料标准', wfTitle: '在職證明 / 工作证明', items: [
    '公司抬头纸原件拍摄', '公章+签字必须清晰可见', '包含入职日期、职位、薪资信息',
    '推荐信需推荐人联系方式', '英文版需一并提供'
  ], piiFields: ['姓名', '身份证号', '薪资', '公司名'], specimen: '公司抬头纸+公章+签字',
  wfFields: [
    { label: '公司名称 (抬头)', width: 'full', pii: false }, { label: '员工姓名', width: 'short', pii: true },
    { label: '身份证号码', width: 'long', pii: true }, { label: '入职日期 / 职位', width: 'mid', pii: false },
    { label: '薪资 (月薪/年薪)', width: 'mid', pii: true }, { label: '公章 / 签字', width: 'mid', pii: false }
  ], showPhoto: false, showSeal: true },
  bank: { icon: '💰', title: '银行流水/资产证明材料标准', wfTitle: '银行流水 / 资产证明', items: [
    '银行官方流水单原件拍摄', '最近6-12个月完整记录', '账户名、账号、银行名称清晰',
    '余额和流水记录完整可见', '加盖银行印章的版本'
  ], piiFields: ['账户持有人', '账号', '金额'], specimen: '最近12个月银行流水',
  wfFields: [
    { label: '银行名称', width: 'mid', pii: false }, { label: '账户持有人', width: 'short', pii: true },
    { label: '账号', width: 'long', pii: true }, { label: '币种 / 余额', width: 'mid', pii: true },
    { label: '流水时间段', width: 'full', pii: false }, { label: '银行印章', width: 'mid', pii: false }
  ], showPhoto: false, showSeal: true },
  transcript: { icon: '📄', title: '成绩单材料标准', wfTitle: '学业成绩单', items: [
    '学校官方成绩单原件拍摄', '含学校抬头、学生姓名、学号', '所有学期/学年成绩完整',
    '学校教务处印章清晰', '英文版需一并提供'
  ], piiFields: ['姓名', '学号'], specimen: '学校抬头·教务处盖章',
  wfFields: [
    { label: '学校名称 (抬头)', width: 'full', pii: false }, { label: '学生姓名', width: 'short', pii: true },
    { label: '学号', width: 'mid', pii: true }, { label: '专业 / 学院', width: 'mid', pii: false },
    { label: '成绩列表', width: 'full', pii: false }, { label: '教务处印章 / 日期', width: 'mid', pii: false }
  ], showPhoto: false, showSeal: true },
  degree_auth: { icon: '🔖', title: '学信网认证材料标准', wfTitle: '学信网学历认证报告', items: [
    '学信网生成的认证报告PDF/截图', '报告编号和验证码清晰', '含学位信息、毕业院校、专业', '在线验证报告有效期需在有效期内'
  ], piiFields: ['姓名', '证书编号'], specimen: '学信网学历认证报告',
  wfFields: [
    { label: '报告编号', width: 'long', pii: false }, { label: '姓名', width: 'short', pii: true },
    { label: '毕业院校', width: 'full', pii: false }, { label: '专业 / 学历层次', width: 'mid', pii: false },
    { label: '入学/毕业日期', width: 'mid', pii: false }, { label: '验证码', width: 'mid', pii: false }
  ], showPhoto: true, showSeal: true },
  language_cert: { icon: '🗣️', title: '语言成绩材料标准', wfTitle: '语言能力证明', items: [
    '官方成绩单原件拍摄（IELTS/TOEFL/HSK等）', '考生姓名、考试日期、分数清晰', '证书编号完整可见'
  ], piiFields: ['姓名', '考生编号'], specimen: '语言成绩单原件',
  wfFields: [
    { label: '考试机构', width: 'mid', pii: false }, { label: '考生姓名', width: 'short', pii: true },
    { label: '考生编号', width: 'mid', pii: true }, { label: '考试日期', width: 'mid', pii: false },
    { label: '总分 / 各科分数', width: 'full', pii: false }, { label: '证书编号 / 验证码', width: 'long', pii: false }
  ], showPhoto: false, showSeal: true },
  admission_letter: { icon: '📨', title: '录取通知书材料标准', wfTitle: '录取通知书', items: [
    '学校官方录取通知书原件', '含学校抬头、学生姓名、录取专业', '入学日期和学制清晰', '学校印章/签发人签字'
  ], piiFields: ['姓名', '申请编号'], specimen: '学校抬头·官方印章',
  wfFields: [
    { label: '学校名称 (抬头)', width: 'full', pii: false }, { label: '学生姓名', width: 'short', pii: true },
    { label: '录取专业 / 学位', width: 'mid', pii: false }, { label: '入学日期 / 学制', width: 'mid', pii: false },
    { label: '申请编号', width: 'long', pii: true }, { label: '学校印章 / 签发人', width: 'mid', pii: false }
  ], showPhoto: false, showSeal: true },
  exchange_agreement: { icon: '🌐', title: '交换协议材料标准', wfTitle: '交换/交流项目协议', items: [
    '双方学校签署的交换协议原件', '含交换期间、学分互认条款', '双方学校印章清晰'
  ], piiFields: ['姓名', '学号'], specimen: '双方学校盖章',
  wfFields: [
    { label: '派出学校 (抬头)', width: 'full', pii: false }, { label: '接收学校', width: 'full', pii: false },
    { label: '学生姓名 / 学号', width: 'mid', pii: true }, { label: '交换期间', width: 'mid', pii: false },
    { label: '学分互认条款', width: 'full', pii: false }, { label: '双方印章', width: 'mid', pii: false }
  ], showPhoto: false, showSeal: true },
  parttime_enrollment: { icon: '📚', title: '兼读在读证明标准', wfTitle: '兼读课程在读证明', items: [
    '学校出具的在读证明原件', '含学校抬头、学生姓名、攻读学位', '注明兼读制（Part-time）', '学校印章清晰'
  ], piiFields: ['姓名', '学号'], specimen: '学校抬头·注明兼读制',
  wfFields: [
    { label: '学校名称 (抬头)', width: 'full', pii: false }, { label: '学生姓名', width: 'short', pii: true },
    { label: '攻读学位 / 专业', width: 'mid', pii: false }, { label: '就读状态 (兼读制)', width: 'mid', pii: false },
    { label: '入学日期 / 预计毕业', width: 'full', pii: false }, { label: '教务处印章', width: 'mid', pii: false }
  ], showPhoto: false, showSeal: true },
  emp_letter: { icon: '📝', title: '雇主聘用书材料标准', wfTitle: '雇主聘用书 / 雇佣合约', items: [
    '公司抬头纸原件拍摄', '含职位、入职日期、薪资、工作职责', '雇主签字+公司盖章', '注明雇佣性质（全职/合约）'
  ], piiFields: ['姓名', '身份证号', '薪资'], specimen: '公司抬头纸·公章+签字',
  wfFields: [
    { label: '公司名称 (抬头)', width: 'full', pii: false }, { label: '员工姓名', width: 'short', pii: true },
    { label: '职位 / 部门', width: 'mid', pii: false }, { label: '入职日期 / 合约期', width: 'mid', pii: false },
    { label: '月薪 / 年薪', width: 'mid', pii: true }, { label: '公司印章 / 签字', width: 'mid', pii: false }
  ], showPhoto: false, showSeal: true },
  emp_proof: { icon: '📋', title: '工作证明信材料标准', wfTitle: '工作证明信', items: [
    '公司抬头纸原件', '注明在职期间、职位、工作内容', '人力资源部门或直属上级签字盖章', '含公司联系方式以便核实'
  ], piiFields: ['姓名', '身份证号'], specimen: '公司抬头纸·HR盖章',
  wfFields: [
    { label: '公司名称 (抬头)', width: 'full', pii: false }, { label: '员工姓名', width: 'short', pii: true },
    { label: '身份证号码', width: 'long', pii: true }, { label: '在职期间 / 职位', width: 'mid', pii: false },
    { label: '工作内容简述', width: 'full', pii: false }, { label: 'HR部门印章 / 日期', width: 'mid', pii: false }
  ], showPhoto: false, showSeal: true },
  emp_3y: { icon: '📊', title: '三年工作经验证明标准', wfTitle: '三年工作经验证明', items: [
    '覆盖最近三年全部在职期间', '如有多个雇主需分别提供', '每段工作需注明起止日期和职位', '社保记录/税单可作为辅助证明'
  ], piiFields: ['姓名', '身份证号'], specimen: '连续三年工作记录',
  wfFields: [
    { label: '员工姓名', width: 'short', pii: true }, { label: '身份证号码', width: 'long', pii: true },
    { label: '雇主名称 (第一段)', width: 'full', pii: false }, { label: '起止日期 / 职位', width: 'mid', pii: false },
    { label: '社保/税务辅助证明', width: 'full', pii: false }, { label: '累计年限', width: 'short', pii: false }
  ], showPhoto: false, showSeal: true },
  recommendation: { icon: '✉️', title: '推荐信材料标准', wfTitle: '专家推荐信', items: [
    '推荐人抬头纸或有推荐人联系方式', '详述申请人专业能力和成就', '推荐人签字+日期', '推荐人名片或联系方式可验证'
  ], piiFields: ['申请人姓名', '推荐人姓名'], specimen: '推荐人签字·含联系方式',
  wfFields: [
    { label: '推荐人姓名 / 职位', width: 'mid', pii: true }, { label: '申请人姓名', width: 'short', pii: true },
    { label: '推荐人与申请人关系', width: 'mid', pii: false }, { label: '推荐内容详述', width: 'full', pii: false },
    { label: '推荐人联系方式', width: 'full', pii: true }, { label: '签字 / 日期', width: 'mid', pii: false }
  ], showPhoto: false, showSeal: false },
  company_docs: { icon: '🏢', title: '公司注册文件标准', wfTitle: '公司注册证明书', items: [
    '公司注册处发出的注册证明书', '商业登记证清晰拍摄', '公司名称、注册编号、成立日期清晰', '如有公司章程一并提供'
  ], piiFields: ['公司编号', '董事姓名'], specimen: '公司注册处·商业登记证',
  wfFields: [
    { label: '公司名称 (中/英)', width: 'full', pii: false }, { label: '公司注册编号', width: 'mid', pii: true },
    { label: '成立日期', width: 'mid', pii: false }, { label: '公司类别', width: 'short', pii: false },
    { label: '注册地址', width: 'full', pii: false }, { label: '公司注册处印章', width: 'mid', pii: false }
  ], showPhoto: false, showSeal: true },
  org_chart: { icon: '📐', title: '组织架构图标准', wfTitle: '公司组织架构图', items: [
    '公司官方组织架构图', '标明申请人所属部门及层级', '如有公司印章更佳', '中英文版本均可'
  ], piiFields: ['申请人姓名', '部门'], specimen: '公司组织架构图',
  wfFields: [
    { label: '公司名称', width: 'full', pii: false }, { label: '申请人姓名 / 职位', width: 'mid', pii: true },
    { label: '所属部门', width: 'mid', pii: false }, { label: '汇报层级', width: 'full', pii: false },
    { label: '下属人数', width: 'short', pii: false }, { label: '签发日期 / 版本', width: 'mid', pii: false }
  ], showPhoto: false, showSeal: false },
  tech_achievement: { icon: '🏆', title: '科技成果/专利证明标准', wfTitle: '科技成果 / 专利证书', items: [
    '专利证书/科技奖励证书原件', '专利权人/获奖人姓名清晰', '专利号/证书编号完整', '授权日期和有效期'
  ], piiFields: ['专利人姓名', '专利号'], specimen: '专利证书·授权日期',
  wfFields: [
    { label: '专利/成果名称', width: 'full', pii: false }, { label: '专利号 / 证书编号', width: 'long', pii: true },
    { label: '专利权人 / 获奖人', width: 'mid', pii: true }, { label: '授权日期', width: 'mid', pii: false },
    { label: '有效期', width: 'mid', pii: false }, { label: '授权机关印章', width: 'mid', pii: false }
  ], showPhoto: false, showSeal: true },
  income_proof: { icon: '📊', title: '收入证明标准', wfTitle: '个人收入证明', items: [
    '公司或税务机关出具的收入证明', '含姓名、身份证号、收入金额', '时间段明确（最近6-12个月）', '公司盖章或税务印章'
  ], piiFields: ['姓名', '身份证号', '收入金额'], specimen: '公司/税务机关出具',
  wfFields: [
    { label: '出具机构 (抬头)', width: 'full', pii: false }, { label: '姓名', width: 'short', pii: true },
    { label: '身份证号码', width: 'long', pii: true }, { label: '收入时间段', width: 'mid', pii: false },
    { label: '总收入 / 月收入', width: 'mid', pii: true }, { label: '机构印章 / 日期', width: 'mid', pii: false }
  ], showPhoto: false, showSeal: true },
  tax_record: { icon: '📑', title: '税单材料标准', wfTitle: '个人所得税完税证明', items: [
    '税务机关出具的完税证明', '最近1-3个纳税年度', '含纳税人姓名和身份证号', '税务印章清晰'
  ], piiFields: ['姓名', '身份证号'], specimen: '税务局出具·完税证明',
  wfFields: [
    { label: '税务机关名称', width: 'full', pii: false }, { label: '纳税人姓名', width: 'short', pii: true },
    { label: '身份证号码', width: 'long', pii: true }, { label: '纳税年度', width: 'short', pii: false },
    { label: '应纳税所得额', width: 'mid', pii: true }, { label: '税务印章 / 日期', width: 'mid', pii: false }
  ], showPhoto: false, showSeal: true },
  income_250w: { icon: '💵', title: '年收入250万证明标准', wfTitle: '年收入证明 (≥250万港币)', items: [
    '最近一个完整纳税年度的收入证明', '公司薪资证明+银行流水+税单三件套',
    '收入金额需对应当年度港币≥250万', '各文件收入数据需一致'
  ], piiFields: ['姓名', '年收入金额'], specimen: '薪资证明+银行流水+税单·三件一致',
  wfFields: [
    { label: '姓名', width: 'short', pii: true }, { label: '身份证号码', width: 'long', pii: true },
    { label: '年度', width: 'short', pii: false }, { label: '年收入总额 (港币)', width: 'mid', pii: true },
    { label: '薪资/奖金/股权分解', width: 'full', pii: false }, { label: '公司/税务印章', width: 'mid', pii: false }
  ], showPhoto: false, showSeal: true }
};

var MORE_GUIDES = {
  investment_proof: { icon: '📈', title: '投资证明标准', wfTitle: '投资资产证明', items: [
    '证券公司/银行出具的投资资产证明', '含账户名、资产类型、估值', '最近日期的资产报告', '金融机构印章'
  ], piiFields: ['账户名', '账号'], specimen: '金融机构出具·近期估值',
  wfFields: [
    { label: '金融机构名称', width: 'full', pii: false }, { label: '账户持有人', width: 'short', pii: true },
    { label: '账号', width: 'long', pii: true }, { label: '资产类型 / 估值', width: 'full', pii: false },
    { label: '报告日期', width: 'mid', pii: false }, { label: '机构印章', width: 'mid', pii: false }
  ], showPhoto: false, showSeal: true },
  asset_proof: { icon: '🏠', title: '资产证明标准', wfTitle: '个人资产证明 (存款/房产)', items: [
    '银行存款证明或房产证', '含持有人姓名、资产价值', '银行/房管局官方文件', '存款证明需冻结期≥3个月'
  ], piiFields: ['持有人', '账号/房产证号'], specimen: '银行/房管局官方文件',
  wfFields: [
    { label: '出具机构', width: 'full', pii: false }, { label: '资产持有人', width: 'short', pii: true },
    { label: '账号 / 房产证号', width: 'long', pii: true }, { label: '资产估值 / 币种', width: 'mid', pii: false },
    { label: '证明日期', width: 'mid', pii: false }, { label: '机构印章', width: 'mid', pii: false }
  ], showPhoto: false, showSeal: true },
  retirement_fund: { icon: '🏦', title: '退休金证明标准', wfTitle: '退休金/强积金证明', items: [
    'MPF强积金或社保退休金证明', '含姓名、账户信息、累积金额', '最近日期的账户报告'
  ], piiFields: ['姓名', '账户号'], specimen: '强积金/社保·近期报告',
  wfFields: [
    { label: '管理机构名称', width: 'full', pii: false }, { label: '持有人姓名', width: 'short', pii: true },
    { label: '账户号码', width: 'mid', pii: true }, { label: '累积金额 / 币种', width: 'mid', pii: false },
    { label: '报告日期', width: 'mid', pii: false }, { label: '机构印章', width: 'mid', pii: false }
  ], showPhoto: false, showSeal: true },
  pension_proof: { icon: '📋', title: '养老金证明标准', wfTitle: '养老金/社保领取证明', items: [
    '社保局出具的养老金领取证明', '含姓名、领取金额、发放记录', '最近6-12个月发放记录'
  ], piiFields: ['姓名', '身份证号'], specimen: '社保局出具·近期记录',
  wfFields: [
    { label: '社保局名称', width: 'full', pii: false }, { label: '领取人姓名', width: 'short', pii: true },
    { label: '身份证号码', width: 'long', pii: true }, { label: '月领取金额', width: 'mid', pii: false },
    { label: '发放时间段', width: 'mid', pii: false }, { label: '社保局印章', width: 'mid', pii: false }
  ], showPhoto: false, showSeal: true },
  funding_proof: { icon: '💳', title: '资金来源说明标准', wfTitle: '资金来源说明', items: [
    '说明资产来源的书面文件', '如有银行转账记录一并提供', '注明金额、来源途径、用途', '本人签字+日期'
  ], piiFields: ['姓名', '账户号'], specimen: '书面说明·本人签字',
  wfFields: [
    { label: '声明人姓名', width: 'short', pii: true }, { label: '资金来源途径', width: 'full', pii: false },
    { label: '金额 / 币种', width: 'mid', pii: false }, { label: '用途说明', width: 'full', pii: false },
    { label: '银行流水附页', width: 'full', pii: false }, { label: '签字 / 日期', width: 'mid', pii: false }
  ], showPhoto: false, showSeal: false },
  plan_statement: { icon: '📝', title: '赴港计划书 (文字撰写)', wfTitle: '赴港计划书', items: [
    '此为文字撰写类材料，非上传文件', '内容：来港目的、职业规划、对港贡献', '建议800-1500字，分段撰写', '具名+日期'
  ], piiFields: ['姓名'], specimen: '文字撰写·800-1500字',
  wfFields: [
    { label: '姓名 / 日期', width: 'short', pii: true }, { label: '来港目的', width: 'full', pii: false },
    { label: '职业规划', width: 'full', pii: false }, { label: '对港贡献预期', width: 'full', pii: false },
    { label: '在港安居计划', width: 'full', pii: false }, { label: '本人签字', width: 'mid', pii: false }
  ], showPhoto: false, showSeal: false },
  no_crime: { icon: '🛡️', title: '无犯罪记录证明标准', wfTitle: '无犯罪记录证明', items: [
    '户籍所在地公安局/派出所出具', '含姓名、身份证号、无犯罪记录声明', '有效期一般为6个月', '公安机关印章清晰'
  ], piiFields: ['姓名', '身份证号'], specimen: '公安机关出具·6个月有效',
  wfFields: [
    { label: '出具机关名称', width: 'full', pii: false }, { label: '申请人姓名', width: 'short', pii: true },
    { label: '身份证号码', width: 'long', pii: true }, { label: '证明内容', width: 'full', pii: false },
    { label: '有效期至', width: 'mid', pii: false }, { label: '公安机关印章 / 日期', width: 'mid', pii: false }
  ], showPhoto: false, showSeal: true },
  student_visa: { icon: '🎫', title: '学生签证材料标准', wfTitle: '学生签证 / 入境许可', items: [
    '入境处发出的学生签证标签/通知书', '含学校名称、课程名称、签证有效期', '签证编号清晰', '如有e-Visa打印版一并提供'
  ], piiFields: ['姓名', '签证编号', '学校'], specimen: '入境处学生签证标签',
  wfFields: [
    { label: '签证编号', width: 'long', pii: true }, { label: '学生姓名', width: 'short', pii: true },
    { label: '学校 / 课程名称', width: 'full', pii: false }, { label: '签证有效期', width: 'mid', pii: false },
    { label: '逗留条件', width: 'full', pii: false }, { label: '入境处印章', width: 'mid', pii: false }
  ], showPhoto: false, showSeal: true },
  sponsor_id: { icon: '🪪', title: '保证人身份证标准', wfTitle: '保证人身份证明文件', items: [
    '保证人身份证/护照原件拍摄', '姓名、证件号、有效期清晰', '如非香港居民需同时提供签证页'
  ], piiFields: ['保证人姓名', '证件号'], specimen: '保证人身份证·正面',
  wfFields: [
    { label: '保证人姓名', width: 'short', pii: true }, { label: '证件号码', width: 'long', pii: true },
    { label: '证件类型', width: 'short', pii: false }, { label: '有效期', width: 'mid', pii: false },
    { label: '与申请人关系', width: 'mid', pii: false }, { label: '签发机关', width: 'mid', pii: false }
  ], showPhoto: true, showSeal: false },
  sponsor_income: { icon: '💰', title: '保证人收入证明标准', wfTitle: '保证人收入证明', items: [
    '保证人最近6-12个月收入证明', '含姓名、收入金额、时间段', '公司抬头+盖章或税务机关出具'
  ], piiFields: ['保证人姓名', '收入金额'], specimen: '保证人收入证明',
  wfFields: [
    { label: '出具机构 (抬头)', width: 'full', pii: false }, { label: '保证人姓名', width: 'short', pii: true },
    { label: '收入时间段', width: 'mid', pii: false }, { label: '月/年收入金额', width: 'mid', pii: true },
    { label: '职位 / 工作单位', width: 'full', pii: false }, { label: '机构印章 / 日期', width: 'mid', pii: false }
  ], showPhoto: false, showSeal: true },
  sponsor_employment: { icon: '💼', title: '保证人在职证明标准', wfTitle: '保证人在职证明', items: [
    '保证人雇主出具的在职证明', '含职位、在职期间、工作性质', '公司抬头纸+盖章+签字'
  ], piiFields: ['保证人姓名', '公司名'], specimen: '公司抬头·公章+签字',
  wfFields: [
    { label: '公司名称 (抬头)', width: 'full', pii: false }, { label: '保证人姓名', width: 'short', pii: true },
    { label: '职位 / 部门', width: 'mid', pii: false }, { label: '在职期间', width: 'mid', pii: false },
    { label: '工作性质 (全职/合约)', width: 'short', pii: false }, { label: '公司印章 / 签字', width: 'mid', pii: false }
  ], showPhoto: false, showSeal: true },
  guardian_id: { icon: '🪪', title: '监护人身份证标准', wfTitle: '监护人身份证明文件', items: [
    '监护人身份证/护照原件拍摄', '姓名、证件号、有效期清晰', '需可证明监护关系（如户口本/公证书）'
  ], piiFields: ['监护人姓名', '证件号'], specimen: '监护人身份证·正面',
  wfFields: [
    { label: '监护人姓名', width: 'short', pii: true }, { label: '证件号码', width: 'long', pii: true },
    { label: '证件类型', width: 'short', pii: false }, { label: '有效期', width: 'mid', pii: false },
    { label: '与申请人关系', width: 'mid', pii: false }, { label: '签发机关', width: 'mid', pii: false }
  ], showPhoto: true, showSeal: false },
  guardian_consent: { icon: '📄', title: '监护人同意书标准', wfTitle: '监护人同意书 / 监护权证明', items: [
    '法定监护人签署的同意书', '明确同意未成年人在港学习/居留', '含监护人姓名、联系方式、签字', '如有监护权判决书/公证书一并提供'
  ], piiFields: ['监护人姓名', '未成年人姓名'], specimen: '监护人签字·含联系方式',
  wfFields: [
    { label: '监护人姓名', width: 'short', pii: true }, { label: '未成年人姓名', width: 'short', pii: true },
    { label: '监护关系', width: 'mid', pii: false }, { label: '同意事项说明', width: 'full', pii: false },
    { label: '监护人联系方式', width: 'full', pii: true }, { label: '签字 / 日期', width: 'mid', pii: false }
  ], showPhoto: false, showSeal: false },
  guardian_income: { icon: '💰', title: '监护人收入证明标准', wfTitle: '监护人经济能力证明', items: [
    '监护人最近6-12个月收入/资产证明', '含姓名、收入金额、时间段', '可提供薪资证明+银行流水'
  ], piiFields: ['监护人姓名', '收入金额'], specimen: '收入证明+银行流水',
  wfFields: [
    { label: '出具机构 (抬头)', width: 'full', pii: false }, { label: '监护人姓名', width: 'short', pii: true },
    { label: '收入/资产类型', width: 'mid', pii: false }, { label: '月/年收入金额', width: 'mid', pii: true },
    { label: '时间段', width: 'mid', pii: false }, { label: '机构印章 / 日期', width: 'mid', pii: false }
  ], showPhoto: false, showSeal: true },
  approval: { icon: '✅', title: '获批通知/e-Visa材料标准', wfTitle: '入境许可通知书 / e-Visa', items: [
    '入境处发出的正式通知原件', '申请编号、批准日期、签证类型清晰', 'e-Visa可拍摄打印版或手机截图', '含逗留条件和期限的页面'
  ], piiFields: ['姓名', '申请编号', '签证类型'], specimen: '获批通知书/e-Visa PDF',
  wfFields: [
    { label: '入境许可编号', width: 'long', pii: true }, { label: '申请人姓名', width: 'short', pii: true },
    { label: '签证类型 / 逗留条件', width: 'mid', pii: false }, { label: '批准日期', width: 'mid', pii: false },
    { label: '逗留期限至', width: 'mid', pii: false }, { label: '入境处印章/编号', width: 'full', pii: false }
  ], showPhoto: false, showSeal: true }
};

var KEY_ALIASES = {
  'degree_cert': 'degree', 'emp_proof': 'work', 'recommendation': 'emp_letter',
  'income_proof': 'income_250w', 'bank_statement': 'bank', 'income_250w': 'income_250w',
  'tax_record': 'income_250w', 'plan_statement': 'plan_statement', 'no_crime': 'no_crime',
  'birth_cert': 'birth_cert', 'marriage_cert': 'marriage', 'household': 'household',
  'emp_letter': 'emp_letter', 'reference_letter': 'recommendation',
  'student_visa': 'student_visa', 'admission_letter': 'admission_letter',
  'language_cert': 'language_cert', 'org_chart': 'work', 'emp_3y': 'work',
  'company_docs': 'company_docs', 'tech_achievement': 'work',
  'salary_proof': 'income_250w', 'sponsor_id': 'id_card', 'sponsor_income': 'income_250w',
  'sponsor_employment': 'work', 'guardian_id': 'id_card', 'guardian_consent': 'approval',
  'guardian_income': 'income_250w', 'exchange_agreement': 'exchange_agreement',
  'parttime_enrollment': 'parttime_enrollment', 'degree_auth': 'degree_auth',
  'hk_permit': 'hk_permit', 'passport': 'passport', 'hk_id': 'hk_id',
  'approval': 'approval', 'visa_label': 'approval',
  'funding_proof': 'bank', 'investment_proof': 'income_250w', 'asset_proof': 'income_250w',
  'retirement_fund': 'income_250w', 'pension_proof': 'income_250w', 'photo': 'id_card'
};

var ALL_GUIDES = {};
Object.keys(SLOT_GUIDES).forEach(function(k) { ALL_GUIDES[k] = SLOT_GUIDES[k]; });
Object.keys(MORE_GUIDES).forEach(function(k) { ALL_GUIDES[k] = MORE_GUIDES[k]; });

function getSlotGuide(slotKey, docName) {
  var name = (docName || '').toLowerCase();
  var resolvedKey = KEY_ALIASES[slotKey] || slotKey;
  if (resolvedKey && ALL_GUIDES[resolvedKey]) return ALL_GUIDES[resolvedKey];
  for (var key in ALL_GUIDES) {
    if (name.indexOf(key.replace(/_/g, '')) >= 0 || name.indexOf(key) >= 0) return ALL_GUIDES[key];
  }
  if (slotKey && ALL_GUIDES[slotKey]) return ALL_GUIDES[slotKey];
  return null;
}

var FREE_DOC_GUIDES = {
  id_card: { icon: '🪪', wfTitle: '中华人民共和国居民身份证', items: ['背景：深色桌面，白色背景', '人像：正面居中，头部在虚线框内', '国徽：背面国徽清晰，居中拍摄', '边距：四角留出5mm空白，勿裁切'], piiFields: ['姓名', '身份证号', '出生日期'], specimen: '人像面+国徽面·无反光·圆角完整', showPhoto: true, showSeal: false,
    wfFields: [{ label: '姓名', width: 'short', pii: true }, { label: '性别 / 民族', width: 'mid', pii: false }, { label: '出生日期', width: 'mid', pii: true }, { label: '住址', width: 'full', pii: true }, { label: '公民身份号码', width: 'long', pii: true }, { label: '签发机关', width: 'mid', pii: false }, { label: '有效期限', width: 'mid', pii: false }] },
  hk_permit: { icon: '🛂', wfTitle: '往来港澳通行证', items: ['背景：深色桌面', '信息页：个人信息+签注页完整', '边距：四角完整，勿裁切'], piiFields: ['姓名', '证件号', '有效期'], specimen: '个人信息页·无反光', showPhoto: true, showSeal: false,
    wfFields: [{ label: '姓名', width: 'short', pii: true }, { label: '通行证号码', width: 'long', pii: true }, { label: '出生日期', width: 'mid', pii: true }, { label: '签发机关', width: 'mid', pii: false }, { label: '签发日期 / 有效期限', width: 'full', pii: false }, { label: '签注类型 / 逗留条件', width: 'mid', pii: false }] },
  passport: { icon: '🛂', wfTitle: '中华人民共和国护照', items: ['背景：深色桌面', '信息页：含照片个人信息页', '边距：护照四边完整'], piiFields: ['姓名', '护照号', '出生日期'], specimen: '个人信息页·无反光', showPhoto: true, showSeal: false,
    wfFields: [{ label: '姓名 (中/英)', width: 'mid', pii: true }, { label: '护照号码', width: 'mid', pii: true }, { label: '国籍 / 性别', width: 'short', pii: false }, { label: '出生日期 / 地点', width: 'full', pii: true }, { label: '签发日期 / 有效期至', width: 'full', pii: false }, { label: '签发机关', width: 'mid', pii: false }] },
  hk_id: { icon: '🆔', wfTitle: '香港永久性居民身份证', items: ['背景：深色桌面', '正面：芯片面朝上', '边距：四角完整'], piiFields: ['姓名', '身份证号'], specimen: '正面·芯片可见', showPhoto: true, showSeal: false,
    wfFields: [{ label: '姓名 (中/英)', width: 'mid', pii: true }, { label: '身份证号码', width: 'long', pii: true }, { label: '出生日期', width: 'mid', pii: true }, { label: '签发日期', width: 'mid', pii: false }, { label: '符号标记', width: 'short', pii: false }] },
  household: { icon: '📖', wfTitle: '居民户口簿', items: ['背景：深色桌面', '内容：户主页+本人页', '边距：四角完整'], piiFields: ['姓名', '身份证号', '住址'], specimen: '户主页+本人页', showPhoto: false, showSeal: true,
    wfFields: [{ label: '户主姓名', width: 'short', pii: true }, { label: '户号', width: 'mid', pii: false }, { label: '住址', width: 'full', pii: true }, { label: '本人姓名', width: 'short', pii: true }, { label: '公民身份号码', width: 'long', pii: true }, { label: '与户主关系', width: 'short', pii: false }, { label: '登记机关 (印章)', width: 'mid', pii: false }] },
  marriage: { icon: '💍', wfTitle: '中华人民共和国结婚证', items: ['背景：深色桌面', '内容：双页展开', '要求：印章+照片清晰'], piiFields: ['双方姓名', '证件号'], specimen: '双页展开·印章清晰', showPhoto: true, showSeal: true,
    wfFields: [{ label: '持证人姓名', width: 'short', pii: true }, { label: '登记日期', width: 'mid', pii: false }, { label: '结婚证字号', width: 'long', pii: true }, { label: '双方姓名', width: 'full', pii: true }, { label: '双方证件号码', width: 'full', pii: true }, { label: '登记机关 (印章)', width: 'mid', pii: false }] },
  birth_cert: { icon: '👶', wfTitle: '出生医学证明', items: ['背景：深色桌面', '内容：正面完整', '要求：编号+印章清晰'], piiFields: ['婴儿姓名', '出生日期'], specimen: '正面·无折叠', showPhoto: false, showSeal: true,
    wfFields: [{ label: '婴儿姓名', width: 'short', pii: true }, { label: '出生医学证明编号', width: 'long', pii: false }, { label: '出生日期 / 时间', width: 'mid', pii: true }, { label: '母亲姓名 / 证件号', width: 'full', pii: true }, { label: '父亲姓名 / 证件号', width: 'full', pii: true }, { label: '签发医院 (印章)', width: 'mid', pii: false }] },
  degree: { icon: '🎓', wfTitle: '学位证书', items: ['背景：深色桌面', '内容：证书正面完整', '要求：证书编号+印章清晰'], piiFields: ['姓名', '证书编号'], specimen: '正面·印章清晰', showPhoto: true, showSeal: true,
    wfFields: [{ label: '学位证书编号', width: 'long', pii: true }, { label: '姓名', width: 'short', pii: true }, { label: '性别 / 出生日期', width: 'mid', pii: false }, { label: '所学专业', width: 'mid', pii: false }, { label: '学位授予单位', width: 'full', pii: false }, { label: '授予日期', width: 'mid', pii: false }] },
  plan_statement: { icon: '📝', wfTitle: '赴港计划书 (文字)', items: ['此材料为文字撰写，非文件上传', '建议800-1500字', '内容：来港目的+职业规划+对港贡献'], piiFields: ['姓名'], specimen: '文字撰写·800-1500字', showPhoto: false, showSeal: false,
    wfFields: [{ label: '姓名 / 日期', width: 'short', pii: true }, { label: '来港目的', width: 'full', pii: false }, { label: '职业规划', width: 'full', pii: false }, { label: '对港贡献预期', width: 'full', pii: false }, { label: '在港安居计划', width: 'full', pii: false }, { label: '本人签字', width: 'mid', pii: false }] },
  approval: { icon: '✅', wfTitle: '获批通知书', items: ['背景：深色桌面', '内容：通知完整页面', '要求：申请编号+日期清晰'], piiFields: ['姓名', '申请编号'], specimen: '获批原件', showPhoto: false, showSeal: true,
    wfFields: [{ label: '入境许可编号', width: 'long', pii: true }, { label: '申请人姓名', width: 'short', pii: true }, { label: '签证类型 / 逗留条件', width: 'mid', pii: false }, { label: '批准日期', width: 'mid', pii: false }, { label: '逗留期限至', width: 'mid', pii: false }, { label: '入境处印章/编号', width: 'full', pii: false }] }
};

function getFreeDocGuide(docType) { return FREE_DOC_GUIDES[docType] || null; }

var SLOT_CATEGORY_MAP = {
  'id_card': 'identity', 'hk_permit': 'identity', 'passport': 'identity', 'hk_id': 'identity', 'photo': 'identity',
  'degree_cert': 'education', 'transcript': 'education', 'degree_auth': 'education', 'language_cert': 'education',
  'admission_letter': 'education', 'exchange_agreement': 'education', 'parttime_enrollment': 'education',
  'emp_letter': 'work', 'emp_proof': 'work', 'reference_letter': 'work', 'recommendation': 'work',
  'salary_proof': 'work', 'org_chart': 'work', 'emp_3y': 'work', 'company_docs': 'work', 'tech_achievement': 'work',
  'bank_statement': 'assets', 'tax_record': 'assets', 'income_250w': 'assets', 'income_proof': 'assets',
  'investment_proof': 'assets', 'asset_proof': 'assets', 'retirement_fund': 'assets', 'pension_proof': 'assets', 'funding_proof': 'assets',
  'visa_label': 'approved', 'approval': 'approved', 'plan_statement': 'approved', 'student_visa': 'approved', 'hk_visa': 'approved', 'no_crime': 'approved',
  'marriage_cert': 'identity', 'birth_cert': 'identity', 'household': 'identity',
  'sponsor_id': 'identity', 'sponsor_income': 'assets', 'sponsor_employment': 'work',
  'guardian_id': 'identity', 'guardian_consent': 'approved', 'guardian_income': 'assets'
};

function slotToCategory(slotKey) { return SLOT_CATEGORY_MAP[slotKey] || ''; }

var PRIVACY_BARS = {
  id_card: [
    { top: '10%', left: '42%', width: '52%', height: '4%', label: '姓名' },
    { top: '16%', left: '42%', width: '25%', height: '3.5%', label: '性别' },
    { top: '22%', left: '42%', width: '35%', height: '3.5%', label: '民族' },
    { top: '28%', left: '42%', width: '48%', height: '3.5%', label: '出生' },
    { top: '35%', left: '8%', width: '88%', height: '8%', label: '住址' },
    { top: '48%', left: '8%', width: '88%', height: '5%', label: '住址(续)' },
    { top: '58%', left: '42%', width: '50%', height: '5%', label: '公民身份号码' }
  ],
  hk_permit: [
    { top: '12%', left: '42%', width: '16%', height: '4%', label: '姓名' },
    { top: '12%', left: '60%', width: '34%', height: '4%', label: '拼音' },
    { top: '25%', left: '50%', width: '40%', height: '4%', label: '通行证号' },
    { top: '38%', left: '42%', width: '25%', height: '4%', label: '出生日期' },
    { top: '52%', left: '50%', width: '40%', height: '4%', label: '有效期限' }
  ],
  passport: [
    { top: '8%', left: '35%', width: '55%', height: '4%', label: '姓名' },
    { top: '16%', left: '35%', width: '30%', height: '3.5%', label: '护照号(E+8位)' },
    { top: '24%', left: '35%', width: '20%', height: '3%', label: '性别' },
    { top: '30%', left: '35%', width: '50%', height: '4%', label: '出生日期/地点' }
  ],
  hk_id: [
    { top: '15%', left: '42%', width: '24%', height: '3.5%', label: '中文姓名' },
    { top: '15%', left: '68%', width: '28%', height: '3.5%', label: '英文姓名' },
    { top: '28%', left: '42%', width: '52%', height: '4%', label: '身份证号码' },
    { top: '42%', left: '42%', width: '30%', height: '4%', label: '出生日期' }
  ],
  household: [
    { top: '8%', left: '25%', width: '18%', height: '3.5%', label: '户主姓名' },
    { top: '8%', left: '50%', width: '44%', height: '8%', label: '住址' },
    { top: '18%', left: '25%', width: '18%', height: '3.5%', label: '本人姓名' },
    { top: '30%', left: '50%', width: '44%', height: '4%', label: '公民身份号码' }
  ],
  marriage: [
    { top: '40%', left: '10%', width: '24%', height: '5%', label: '持证人' },
    { top: '25%', left: '10%', width: '30%', height: '4%', label: '登记日期' },
    { top: '50%', left: '10%', width: '40%', height: '4%', label: '结婚证字号' },
    { top: '58%', left: '10%', width: '80%', height: '5%', label: '双方姓名' },
    { top: '65%', left: '10%', width: '80%', height: '5%', label: '双方身份证号' }
  ],
  birth_cert: [
    { top: '15%', left: '30%', width: '24%', height: '4%', label: '婴儿姓名' },
    { top: '25%', left: '30%', width: '35%', height: '3.5%', label: '出生日期/时间' },
    { top: '48%', left: '8%', width: '40%', height: '4%', label: '母亲姓名' },
    { top: '48%', left: '52%', width: '44%', height: '4%', label: '母亲身份证号' },
    { top: '56%', left: '8%', width: '40%', height: '4%', label: '父亲姓名' },
    { top: '56%', left: '52%', width: '44%', height: '4%', label: '父亲身份证号' }
  ],
  degree: [
    { top: '18%', left: '12%', width: '18%', height: '3.5%', label: '姓名' },
    { top: '18%', left: '35%', width: '55%', height: '3.5%', label: '证书编号' },
    { top: '24%', left: '12%', width: '30%', height: '3.5%', label: '出生日期' }
  ],
  work: [
    { top: '18%', left: '12%', width: '18%', height: '3.5%', label: '姓名' },
    { top: '18%', left: '40%', width: '52%', height: '3.5%', label: '身份证号' },
    { top: '32%', left: '40%', width: '52%', height: '3.5%', label: '薪资' }
  ],
  bank: [
    { top: '10%', left: '12%', width: '22%', height: '3.5%', label: '账户持有人' },
    { top: '10%', left: '50%', width: '44%', height: '3.5%', label: '账号' },
    { top: '20%', left: '12%', width: '30%', height: '3.5%', label: '余额' }
  ],
  approval: [
    { top: '12%', left: '12%', width: '22%', height: '3.5%', label: '姓名' },
    { top: '12%', left: '50%', width: '44%', height: '3.5%', label: '入境许可编号' }
  ]
};

var BAR_ALIASES = {
  'degree_cert': 'degree', 'marriage_cert': 'marriage', 'birth_cert': 'birth_cert',
  'household': 'household', 'bank_statement': 'bank', 'income_proof': 'income_250w',
  'income_250w': 'id_card', 'tax_record': 'id_card', 'emp_proof': 'work',
  'emp_letter': 'work', 'emp_3y': 'work', 'salary_proof': 'id_card',
  'sponsor_id': 'id_card', 'guardian_id': 'id_card', 'visa_label': 'approval',
  'student_visa': 'approval', 'company_docs': 'id_card', 'tech_achievement': 'work',
  'reference_letter': 'work', 'recommendation': 'work',
  'sponsor_income': 'id_card', 'sponsor_employment': 'work',
  'guardian_income': 'id_card', 'guardian_consent': 'approval',
  'investment_proof': 'id_card', 'asset_proof': 'id_card',
  'retirement_fund': 'id_card', 'pension_proof': 'id_card',
  'funding_proof': 'bank', 'no_crime': 'work'
};

function getPrivacyBars(docType, slotKey) {
  var resolvedBarKey = BAR_ALIASES[slotKey] || docType;
  if (resolvedBarKey && PRIVACY_BARS[resolvedBarKey]) return PRIVACY_BARS[resolvedBarKey];
  if (docType && PRIVACY_BARS[docType]) return PRIVACY_BARS[docType];
  if (slotKey && PRIVACY_BARS[slotKey]) return PRIVACY_BARS[slotKey];
  return PRIVACY_BARS.id_card;
}

module.exports = { getSlotGuide: getSlotGuide, getFreeDocGuide: getFreeDocGuide, slotToCategory: slotToCategory, getPrivacyBars: getPrivacyBars };
