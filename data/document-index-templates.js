/**
 * 住港伴 v3 — 证件索引模板系统 (PRD v4 §3.4.1)
 * 
 * 根据 (status, selectedPath, mode) 三元组匹配证件槽位模板。
 * 每个槽位定义：需要什么证件、必需/建议/可选、最大数量、关联引导流程。
 */

const INDEX_TEMPLATES = {

  // ============ 未申请 + 优才 ============
  'unapplied_qmas_application': {
    templateId: 'unapplied_qmas_application',
    status: 'unapplied', path: 'qmas', mode: 'application',
    totalRequired: 8,
    categories: [
      {
        categoryKey: 'identity', categoryName: '身份证明', categoryIcon: '🪪',
        slots: [
          { slotKey: 'id_card',      docName: '内地身份证',   docIcon: '🆔', requirement: 'required',    description: '人像面+国徽面', maxCount: 2 },
          { slotKey: 'hk_permit',    docName: '港澳通行证',   docIcon: '🛂', requirement: 'required',    description: '需含有效签注', maxCount: 2 },
          { slotKey: 'passport',     docName: '护照',         docIcon: '📘', requirement: 'recommended', description: '如有', maxCount: 1 },
          { slotKey: 'photo',        docName: '证件照',       docIcon: '📷', requirement: 'required',    description: '白底50×40mm', maxCount: 1 }
        ]
      },
      {
        categoryKey: 'education', categoryName: '学历证明', categoryIcon: '🎓',
        slots: [
          { slotKey: 'degree_cert',   docName: '学位证书',     docIcon: '📜', requirement: 'required', description: '最高学位', maxCount: 1 },
          { slotKey: 'transcript',    docName: '成绩单',       docIcon: '📊', requirement: 'required', description: '完整成绩单', maxCount: 1 },
          { slotKey: 'degree_auth',   docName: '学历认证',     docIcon: '✅', requirement: 'required', description: '学信网/留服认证', maxCount: 1 },
          { slotKey: 'language_cert', docName: '语言成绩',     docIcon: '🗣️', requirement: 'recommended', description: '雅思7+/托福94+', maxCount: 1 }
        ]
      },
      {
        categoryKey: 'employment', categoryName: '工作经历', categoryIcon: '💼',
        slots: [
          { slotKey: 'emp_proof',         docName: '工作证明信',     docIcon: '📋', requirement: 'required', description: '含职位+起止日期+职责', maxCount: -1 },
          { slotKey: 'recommendation',    docName: '推荐信',         docIcon: '✉️', requirement: 'required', description: '建议2-3封', maxCount: 3 },
          { slotKey: 'org_chart',         docName: '组织架构图',     docIcon: '📊', requirement: 'optional', description: '证明管理职级', maxCount: 1 }
        ]
      },
      {
        categoryKey: 'financial', categoryName: '资产证明', categoryIcon: '💰',
        slots: [
          { slotKey: 'income_proof',  docName: '收入证明',       docIcon: '💵', requirement: 'required', description: '过去一年≥100万HKD', maxCount: 1 },
          { slotKey: 'bank_statement',docName: '银行流水/存款证明', docIcon: '🏦', requirement: 'required', description: '近6个月', maxCount: 1 },
          { slotKey: 'tax_record',    docName: '纳税记录',       docIcon: '🧾', requirement: 'recommended', description: '个人所得税完税证明', maxCount: 1 }
        ]
      },
      {
        categoryKey: 'application', categoryName: '申请材料', categoryIcon: '📄',
        slots: [
          { slotKey: 'plan_statement',docName: '赴港计划书',     docIcon: '📝', requirement: 'required', description: '500字以内，说明赴港发展计划', maxCount: 1 },
          { slotKey: 'no_crime',      docName: '无犯罪记录证明', docIcon: '🔍', requirement: 'required', description: '户籍所在地派出所开具', maxCount: 1 }
        ]
      }
    ],
    overflowZone: { zoneKey: 'overflow', zoneName: '其他文件', zoneIcon: '📎', description: '补充材料，不限量' }
  },

  // ============ 未申请 + 高才A ============
  'unapplied_ttps_a_application': {
    templateId: 'unapplied_ttps_a_application',
    status: 'unapplied', path: 'ttps_a', mode: 'application',
    totalRequired: 5,
    categories: [
      {
        categoryKey: 'identity', categoryName: '身份证明', categoryIcon: '🪪',
        slots: [
          { slotKey: 'id_card',   docName: '内地身份证', docIcon: '🆔', requirement: 'required', maxCount: 2 },
          { slotKey: 'hk_permit', docName: '港澳通行证', docIcon: '🛂', requirement: 'required', maxCount: 2 },
          { slotKey: 'photo',     docName: '证件照',     docIcon: '📷', requirement: 'required', maxCount: 1 }
        ]
      },
      {
        categoryKey: 'financial', categoryName: '收入证明', categoryIcon: '💰',
        slots: [
          { slotKey: 'income_250w', docName: '年收入证明(≥250万HKD)', docIcon: '💵', requirement: 'required', description: '完税证明+银行流水+雇主证明', maxCount: 3 },
          { slotKey: 'company_docs',docName: '公司证明文件',          docIcon: '🏢', requirement: 'required', description: '营业执照+股权证明(如自雇)', maxCount: 2 }
        ]
      },
      {
        categoryKey: 'application', categoryName: '申请材料', categoryIcon: '📄',
        slots: [
          { slotKey: 'no_crime', docName: '无犯罪记录证明', docIcon: '🔍', requirement: 'required', maxCount: 1 }
        ]
      }
    ]
  },

  // ============ 未申请 + 高才B ============
  'unapplied_ttps_b_application': {
    templateId: 'unapplied_ttps_b_application',
    status: 'unapplied', path: 'ttps_b', mode: 'application',
    totalRequired: 5,
    categories: [
      {
        categoryKey: 'identity', categoryName: '身份证明', categoryIcon: '🪪',
        slots: [
          { slotKey: 'id_card',   docName: '内地身份证', docIcon: '🆔', requirement: 'required', maxCount: 2 },
          { slotKey: 'hk_permit', docName: '港澳通行证', docIcon: '🛂', requirement: 'required', maxCount: 2 },
          { slotKey: 'photo',     docName: '证件照',     docIcon: '📷', requirement: 'required', maxCount: 1 }
        ]
      },
      {
        categoryKey: 'education', categoryName: '学历证明', categoryIcon: '🎓',
        slots: [
          { slotKey: 'degree_cert', docName: '合资格大学学位证', docIcon: '📜', requirement: 'required', description: 'QS前100/Top30', maxCount: 1 }
        ]
      },
      {
        categoryKey: 'employment', categoryName: '工作经历', categoryIcon: '💼',
        slots: [
          { slotKey: 'emp_3y', docName: '3年工作证明', docIcon: '📋', requirement: 'required', description: '毕业后3年全职工作', maxCount: 1 }
        ]
      }
    ]
  },

  // ============ 通用默认模板 ============
  'default_application': {
    templateId: 'default_application',
    status: 'any', path: 'any', mode: 'application',
    totalRequired: 4,
    categories: [
      {
        categoryKey: 'identity', categoryName: '身份证明', categoryIcon: '🪪',
        slots: [
          { slotKey: 'id_card',   docName: '内地身份证', docIcon: '🆔', requirement: 'required', maxCount: 2 },
          { slotKey: 'hk_permit', docName: '港澳通行证', docIcon: '🛂', requirement: 'required', maxCount: 2 },
          { slotKey: 'photo',     docName: '证件照',     docIcon: '📷', requirement: 'required', maxCount: 1 }
        ]
      },
      {
        categoryKey: 'education', categoryName: '学历证明', categoryIcon: '🎓',
        slots: [
          { slotKey: 'degree_cert', docName: '学位证书', docIcon: '📜', requirement: 'required', maxCount: 1 }
        ]
      }
    ]
  }
};

/**
 * 匹配索引模板
 * @param {string} status - 用户状态 (unapplied/submitted/approved/permanent)
 * @param {string} path - 申请路径 (qmas/ttps_a/ttps_b/asmpt/student_iang/...)
 * @param {string} mode - 模式 (application/renewal)
 * @returns {object} 匹配的索引模板
 */
function matchTemplate(status, path, mode) {
  // 精确匹配
  const exactKey = `${status}_${path}_${mode}`;
  if (INDEX_TEMPLATES[exactKey]) return INDEX_TEMPLATES[exactKey];

  // 状态+模式匹配
  const statusModeKey = `${status}_any_${mode}`;
  if (INDEX_TEMPLATES[statusModeKey]) return INDEX_TEMPLATES[statusModeKey];

  // fallback
  return INDEX_TEMPLATES['default_application'];
}

/**
 * 计算槽位运行时状态
 * @param {object} template - 索引模板
 * @param {Array} uploadedDocs - 已上传证件列表
 * @returns {Array} 含 fillStatus 的分类+槽位
 */
function computeSlotStates(template, uploadedDocs) {
  return template.categories.map(cat => {
    const slots = cat.slots.map(slot => {
      const uploaded = uploadedDocs.filter(d => 
        d.slotKey === slot.slotKey || 
        d.docType === slot.slotKey ||
        (d.category === cat.categoryKey && d.name && d.name.includes(slot.docName.slice(0, 2)))
      );
      const count = uploaded.length;
      let fillStatus = 'empty';
      if (count >= slot.maxCount && slot.maxCount > 0) fillStatus = 'filled';
      else if (count > 0) fillStatus = 'partial';
      
      // 检查过期
      const hasExpiring = uploaded.some(d => {
        if (!d.validTo) return false;
        const days = Math.ceil((new Date(d.validTo) - new Date()) / 86400000);
        return days >= 0 && days < 90;
      });
      if (hasExpiring && fillStatus === 'filled') fillStatus = 'expiring_soon';
      if (uploaded.some(d => d.expired)) fillStatus = 'expired';

      return {
        ...slot,
        fillStatus,
        uploadedDocs: uploaded,
        uploadedCount: count
      };
    });

    const required = slots.filter(s => s.requirement === 'required');
    const filled = required.filter(s => s.fillStatus === 'filled').length;
    
    return {
      ...cat,
      slots,
      categoryProgress: { filled, total: required.length }
    };
  });
}

module.exports = {
  INDEX_TEMPLATES,
  matchTemplate,
  computeSlotStates
};
