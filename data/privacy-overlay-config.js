/**
 * 隐私遮罩配置 — 证件详情页专属
 * 从 add.js 迁移至此，add 流程不再显示遮罩，仅 detail 页使用
 */
var DOC_PRIVACY_OVERLAY = {
  id_card: { bars: [
    { top: '12%', left: '8%', width: '28%', height: '4.5%', label: '姓名' },
    { top: '20%', left: '8%', width: '45%', height: '4%', label: '证号' },
    { top: '28%', left: '8%', width: '22%', height: '4%', label: '出生' },
    { top: '36%', left: '8%', width: '55%', height: '5%', label: '地址' }
  ]},
  passport: { bars: [
    { top: '10%', left: '40%', width: '28%', height: '4%', label: '姓名' },
    { top: '26%', left: '40%', width: '35%', height: '4%', label: '护照号' },
    { top: '32%', left: '40%', width: '25%', height: '4%', label: '出生地点' }
  ]},
  hk_permit: { bars: [
    { top: '12%', left: '35%', width: '25%', height: '4%', label: '姓名' },
    { top: '22%', left: '35%', width: '45%', height: '4%', label: '证件号' },
    { top: '30%', left: '35%', width: '22%', height: '4%', label: '出生' }
  ]},
  hk_id: { bars: [
    { top: '10%', left: '5%', width: '25%', height: '4%', label: '姓名' },
    { top: '18%', left: '5%', width: '40%', height: '4%', label: '证号' },
    { top: '24%', left: '5%', width: '20%', height: '4%', label: '出生' }
  ]},
  degree: { bars: [
    { top: '12%', left: '25%', width: '20%', height: '4%', label: '姓名' },
    { top: '28%', left: '25%', width: '40%', height: '4%', label: '证书编号' }
  ]},
  marriage: { bars: [
    { top: '8%', left: '20%', width: '20%', height: '4%', label: '姓名' },
    { top: '22%', left: '20%', width: '40%', height: '4%', label: '证号' }
  ]},
  birth_cert: { bars: [
    { top: '10%', left: '15%', width: '20%', height: '4%', label: '姓名' },
    { top: '22%', left: '15%', width: '25%', height: '4%', label: '出生' }
  ]},
  bank_statement: { bars: [
    { top: '8%', left: '20%', width: '25%', height: '4%', label: '账户名' },
    { top: '20%', left: '20%', width: '30%', height: '4%', label: '账号' }
  ]},
  work_proof: { bars: [
    { top: '12%', left: '15%', width: '22%', height: '4%', label: '姓名' },
    { top: '22%', left: '15%', width: '40%', height: '4%', label: '公司' }
  ]},
  household: { bars: [
    { top: '8%', left: '10%', width: '22%', height: '4%', label: '姓名' },
    { top: '20%', left: '10%', width: '45%', height: '4%', label: '证号' },
    { top: '28%', left: '10%', width: '55%', height: '5%', label: '地址' }
  ]},
  income_250w: { bars: [
    { top: '10%', left: '15%', width: '22%', height: '4%', label: '姓名' },
    { top: '20%', left: '15%', width: '45%', height: '4%', label: '身份证号' },
    { top: '30%', left: '15%', width: '35%', height: '4%', label: '年收入' }
  ]},
  no_crime: { bars: [
    { top: '10%', left: '15%', width: '22%', height: '4%', label: '姓名' },
    { top: '20%', left: '15%', width: '45%', height: '4%', label: '身份证号' }
  ]},
  student_visa: { bars: [
    { top: '8%', left: '20%', width: '25%', height: '4%', label: '姓名' },
    { top: '18%', left: '20%', width: '35%', height: '4%', label: '签证编号' }
  ]},
  plan_statement: { bars: [] }
};

/** 根据证件类型返回PII遮挡条位置（基于真实证件规格） */
function getPrivacyBars(docType, slotKey) {
  var bars = {
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

  var barAliases = {
    'degree_cert': 'degree', 'marriage_cert': 'marriage', 'birth_cert': 'birth_cert',
    'household': 'household', 'bank_statement': 'bank_statement', 'income_proof': 'income_250w',
    'income_250w': 'income_250w', 'tax_record': 'income_250w', 'emp_proof': 'work_proof',
    'emp_letter': 'work_proof', 'emp_3y': 'work_proof', 'salary_proof': 'income_250w',
    'sponsor_id': 'id_card', 'guardian_id': 'id_card', 'visa_label': 'approval',
    'student_visa': 'approval', 'company_docs': 'income_250w', 'tech_achievement': 'work_proof',
    'reference_letter': 'work_proof', 'recommendation': 'work_proof',
    'sponsor_income': 'income_250w', 'sponsor_employment': 'work_proof',
    'guardian_income': 'income_250w', 'guardian_consent': 'approval',
    'investment_proof': 'income_250w', 'asset_proof': 'income_250w',
    'retirement_fund': 'income_250w', 'pension_proof': 'income_250w',
    'funding_proof': 'bank_statement', 'no_crime': 'work_proof'
  };
  var resolvedBarKey = barAliases[slotKey] || docType;
  if (resolvedBarKey && bars[resolvedBarKey]) return bars[resolvedBarKey];
  if (docType && bars[docType]) return bars[docType];
  if (slotKey && bars[slotKey]) return bars[slotKey];
  return bars.id_card;
}

module.exports = { DOC_PRIVACY_OVERLAY, getPrivacyBars };
