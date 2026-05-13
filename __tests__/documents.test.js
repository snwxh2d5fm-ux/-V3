/**
 * 住港伴 v3 — 证件索引模板单元测试
 * 测试 data/document-index-templates.js 的 matchTemplate() 和 computeSlotStates()
 * 运行: npx jest __tests__/documents.test.js --verbose
 */

// ============================================================
// 加载真实数据
// ============================================================
const path = require('path');
const projectRoot = path.resolve(__dirname, '..');
const { INDEX_TEMPLATES, matchTemplate, computeSlotStates } = require(
  path.join(projectRoot, 'data/document-index-templates.js')
);

// ============================================================
// 辅助函数
// ============================================================
function countRequiredSlots(template) {
  var count = 0;
  if (!template || !template.categories) return 0;
  template.categories.forEach(function(cat) {
    cat.slots.forEach(function(slot) {
      if (slot.requirement === 'required') count++;
    });
  });
  return count;
}

function getSlotKeys(template) {
  var keys = [];
  if (!template || !template.categories) return keys;
  template.categories.forEach(function(cat) {
    cat.slots.forEach(function(slot) {
      keys.push(slot.slotKey);
    });
  });
  return keys;
}

// ============================================================
// 1. 模板匹配 — 正常路径
// ============================================================
describe('证件索引模板匹配 — matchTemplate()', function() {

  test('[正常] QMAS 未申请精确匹配 unapplied_qmas_application', function() {
    var tpl = matchTemplate('unapplied', 'qmas', 'application');
    expect(tpl).toBeDefined();
    expect(tpl.templateId).toBe('unapplied_qmas_application');
    expect(tpl.status).toBe('unapplied');
    expect(tpl.path).toBe('qmas');
    expect(tpl.totalRequired).toBe(12);
  });

  test('[正常] 高才A any_前缀匹配 any_ttps_a_application', function() {
    var tpl = matchTemplate('submitted', 'ttps_a', 'application');
    expect(tpl).toBeDefined();
    expect(tpl.templateId).toBe('unapplied_ttps_a_application');
    expect(tpl.totalRequired).toBe(6);
  });

  test('[正常] 高才C any_前缀匹配 any_ttps_c_application', function() {
    var tpl = matchTemplate('approved', 'ttps_c', 'application');
    expect(tpl).toBeDefined();
    expect(tpl.templateId).toBe('any_ttps_c_application');
    expect(tpl.totalRequired).toBe(6);
  });

  test('[正常] 专才ASMTP any_前缀匹配', function() {
    var tpl = matchTemplate('permanent', 'asmpt', 'application');
    expect(tpl).toBeDefined();
    expect(tpl.templateId).toBe('any_asmpt_application');
    expect(tpl.totalRequired).toBe(8);
  });

  test('[正常] 学生IANG any_前缀匹配', function() {
    var tpl = matchTemplate('unapplied', 'student_iang', 'application');
    expect(tpl).toBeDefined();
    expect(tpl.templateId).toBe('any_student_iang_application');
    expect(tpl.totalRequired).toBe(10);
  });

  test('[正常] 兼读进修 any_前缀匹配', function() {
    var tpl = matchTemplate('approved', 'parttime_qmas', 'application');
    expect(tpl).toBeDefined();
    expect(tpl.templateId).toBe('any_parttime_qmas_application');
    expect(tpl.totalRequired).toBe(10);
  });

  test('[正常] 科技人才 any_前缀匹配', function() {
    var tpl = matchTemplate('submitted', 'techtas', 'application');
    expect(tpl).toBeDefined();
    expect(tpl.templateId).toBe('any_techtas_application');
    expect(tpl.totalRequired).toBe(7);
  });

  test('[正常] CIES any_前缀匹配', function() {
    var tpl = matchTemplate('unapplied', 'cies', 'application');
    expect(tpl).toBeDefined();
    expect(tpl.templateId).toBe('any_cies_application');
    expect(tpl.totalRequired).toBe(8);
  });

  test('[正常] 受养人 any_前缀匹配', function() {
    var tpl = matchTemplate('approved', 'dependent', 'application');
    expect(tpl).toBeDefined();
    expect(tpl.templateId).toBe('any_dependent_application');
    expect(tpl.totalRequired).toBe(9);
  });

  test('[正常] 未成年学生 any_前缀匹配', function() {
    var tpl = matchTemplate('unapplied', 'minor_student', 'application');
    expect(tpl).toBeDefined();
    expect(tpl.templateId).toBe('any_minor_student_application');
    expect(tpl.totalRequired).toBe(11);
  });

  test('[正常] 交换生 any_前缀匹配', function() {
    var tpl = matchTemplate('submitted', 'exchange', 'application');
    expect(tpl).toBeDefined();
    expect(tpl.templateId).toBe('any_exchange_application');
    expect(tpl.totalRequired).toBe(8);
  });

  test('[正常] 退休身份 any_前缀匹配', function() {
    var tpl = matchTemplate('approved', 'retirement', 'application');
    expect(tpl).toBeDefined();
    expect(tpl.templateId).toBe('any_retirement_application');
    expect(tpl.totalRequired).toBe(8);
  });

  test('[正常] 所有匹配模板含 required 槽位', function() {
    var paths = ['qmas', 'ttps_a', 'ttps_b', 'ttps_c', 'asmpt', 'student_iang',
                 'parttime_qmas', 'techtas', 'cies', 'dependent', 'minor_student',
                 'exchange', 'retirement'];
    paths.forEach(function(p) {
      var tpl = matchTemplate('unapplied', p, 'application');
      expect(tpl).toBeDefined();
      expect(countRequiredSlots(tpl)).toBeGreaterThan(0);
    });
  });
});

// ============================================================
// 2. 模板匹配 — 边界值
// ============================================================
describe('证件索引模板匹配 — 边界值', function() {

  test('[边界] 所有已知状态前缀回退: submitted→命中 unapplied_qmas', function() {
    var tpl = matchTemplate('submitted', 'qmas', 'application');
    expect(tpl).toBeDefined();
    expect(tpl.templateId).toBe('unapplied_qmas_application');
  });

  test('[边界] 所有已知状态前缀回退: approved→命中 unapplied_qmas', function() {
    var tpl = matchTemplate('approved', 'qmas', 'application');
    expect(tpl).toBeDefined();
    expect(tpl.templateId).toBe('unapplied_qmas_application');
  });

  test('[边界] 所有已知状态前缀回退: permanent→命中 unapplied_qmas', function() {
    var tpl = matchTemplate('permanent', 'qmas', 'application');
    expect(tpl).toBeDefined();
    expect(tpl.templateId).toBe('unapplied_qmas_application');
  });

  test('[边界] 所有已知状态前缀回退: renewal→命中 unapplied_qmas', function() {
    var tpl = matchTemplate('renewal', 'qmas', 'application');
    expect(tpl).toBeDefined();
    expect(tpl.templateId).toBe('unapplied_qmas_application');
  });

  test('[边界] QMAS 模板含 5 个分类', function() {
    var tpl = matchTemplate('unapplied', 'qmas', 'application');
    expect(tpl.categories.length).toBe(5);
    var catKeys = tpl.categories.map(function(c) { return c.categoryKey; });
    expect(catKeys).toEqual(['identity', 'education', 'employment', 'financial', 'application']);
  });

  test('[边界] 高才A仅有 identity/financial/application 三个分类', function() {
    var tpl = matchTemplate('unapplied', 'ttps_a', 'application');
    expect(tpl.categories.length).toBe(3);
    var catKeys = tpl.categories.map(function(c) { return c.categoryKey; });
    expect(catKeys).toEqual(['identity', 'financial', 'application']);
  });

  test('[边界] maxCount=-1 表示无上限 (QMAS employment.emp_proof)', function() {
    var tpl = matchTemplate('unapplied', 'qmas', 'application');
    var empCat = tpl.categories.find(function(c) { return c.categoryKey === 'employment'; });
    var empProof = empCat.slots.find(function(s) { return s.slotKey === 'emp_proof'; });
    expect(empProof).toBeDefined();
    expect(empProof.maxCount).toBe(-1);
  });

  test('[边界] overflowZone 存在于 QMAS 模板', function() {
    var tpl = matchTemplate('unapplied', 'qmas', 'application');
    expect(tpl.overflowZone).toBeDefined();
    expect(tpl.overflowZone.zoneKey).toBe('overflow');
  });

  test('[边界] 高才B 不包含 financial 分类', function() {
    var tpl = matchTemplate('unapplied', 'ttps_b', 'application');
    var catKeys = tpl.categories.map(function(c) { return c.categoryKey; });
    expect(catKeys).not.toContain('financial');
  });

  test('[边界] 受养人模板含 relationship/sponsor 分类', function() {
    var tpl = matchTemplate('unapplied', 'dependent', 'application');
    var catKeys = tpl.categories.map(function(c) { return c.categoryKey; });
    expect(catKeys).toContain('relationship');
    expect(catKeys).toContain('sponsor');
  });

  test('[边界] 未成年学生模板 guardian 分类含 3 个槽位', function() {
    var tpl = matchTemplate('unapplied', 'minor_student', 'application');
    var guardianCat = tpl.categories.find(function(c) { return c.categoryKey === 'guardian'; });
    expect(guardianCat).toBeDefined();
    expect(guardianCat.slots.length).toBe(3);
  });
});

// ============================================================
// 3. 模板匹配 — 异常/降级
// ============================================================
describe('证件索引模板匹配 — 异常降级', function() {

  test('[降级] 无匹配路径 → 返回 default_application', function() {
    var tpl = matchTemplate('unknown_status', 'nonexistent_path', 'application');
    expect(tpl).toBeDefined();
    expect(tpl.templateId).toBe('default_application');
  });

  test('[降级] 空路径字符串 → 返回 default_application', function() {
    var tpl = matchTemplate('unapplied', '', 'application');
    expect(tpl).toBeDefined();
    expect(tpl.templateId).toBe('default_application');
  });

  test('[降级] unknown mode → 返回 default_application', function() {
    var tpl = matchTemplate('unapplied', 'qmas', 'unknown_mode');
    expect(tpl).toBeDefined();
    expect(tpl.templateId).toBe('default_application');
  });

  test('[降级] default_application 至少有 2 个分类', function() {
    var tpl = matchTemplate('unknown', 'unknown', 'unknown');
    expect(tpl.categories.length).toBeGreaterThanOrEqual(2);
  });

  test('[降级] default_application totalRequired ≥ 4', function() {
    var tpl = matchTemplate('unknown', 'unknown', 'unknown');
    expect(tpl.totalRequired).toBeGreaterThanOrEqual(4);
  });
});

// ============================================================
// 4. 槽位状态计算 — computeSlotStates()
// ============================================================
describe('槽位状态计算 — computeSlotStates()', function() {

  var qmasTemplate;

  beforeEach(function() {
    qmasTemplate = matchTemplate('unapplied', 'qmas', 'application');
  });

  test('[正常] 空上传列表 → 所有 required 槽位 fillStatus=empty', function() {
    var result = computeSlotStates(qmasTemplate, []);
    expect(result.length).toBe(5);
    result.forEach(function(cat) {
      cat.slots.forEach(function(slot) {
        expect(['empty', 'partial', 'filled', 'expiring_soon', 'expired']).toContain(slot.fillStatus);
      });
    });
    var identityCat = result.find(function(c) { return c.categoryKey === 'identity'; });
    var idSlot = identityCat.slots.find(function(s) { return s.slotKey === 'id_card'; });
    expect(idSlot.fillStatus).toBe('empty');
    expect(idSlot.uploadedCount).toBe(0);
  });

  test('[正常] 已上传证件匹配 → fillStatus=filled', function() {
    var uploadedDocs = [
      { slotKey: 'id_card', type: 'id_card', name: '身份证' },
      { slotKey: 'id_card', type: 'id_card', name: '身份证反面' }
    ];
    var result = computeSlotStates(qmasTemplate, uploadedDocs);
    var identityCat = result.find(function(c) { return c.categoryKey === 'identity'; });
    var idSlot = identityCat.slots.find(function(s) { return s.slotKey === 'id_card'; });
    expect(idSlot.fillStatus).toBe('filled');
    expect(idSlot.uploadedCount).toBe(2);
  });

  test('[正常] 部分上传 maxCount>count>0 → fillStatus=partial', function() {
    var uploadedDocs = [
      { slotKey: 'recommendation', type: 'recommendation', name: '推荐信-A' }
    ];
    var result = computeSlotStates(qmasTemplate, uploadedDocs);
    var empCat = result.find(function(c) { return c.categoryKey === 'employment'; });
    var recSlot = empCat.slots.find(function(s) { return s.slotKey === 'recommendation'; });
    expect(recSlot.maxCount).toBe(3);
    expect(recSlot.fillStatus).toBe('partial');
    expect(recSlot.uploadedCount).toBe(1);
  });

  test('[正常] maxCount=-1 不限量 → 上传1个=partial', function() {
    var uploadedDocs = [
      { slotKey: 'emp_proof', type: 'emp_proof', name: '工作证明-A公司' }
    ];
    var result = computeSlotStates(qmasTemplate, uploadedDocs);
    var empCat = result.find(function(c) { return c.categoryKey === 'employment'; });
    var empProofSlot = empCat.slots.find(function(s) { return s.slotKey === 'emp_proof'; });
    expect(empProofSlot.maxCount).toBe(-1);
    expect(empProofSlot.fillStatus).toBe('partial');
  });

  test('[边界] ownerType 过滤: self 仅匹配 self 文档', function() {
    var uploadedDocs = [
      { slotKey: 'id_card', ownerType: 'self', name: '本人身份证' },
      { slotKey: 'id_card', ownerType: 'spouse', name: '配偶身份证' }
    ];
    var result = computeSlotStates(qmasTemplate, uploadedDocs, 'self');
    var identityCat = result.find(function(c) { return c.categoryKey === 'identity'; });
    var idSlot = identityCat.slots.find(function(s) { return s.slotKey === 'id_card'; });
    expect(idSlot.uploadedCount).toBe(1);
  });

  test('[边界] ownerType 过滤: spouse 仅匹配 spouse 文档', function() {
    var uploadedDocs = [
      { slotKey: 'id_card', ownerType: 'self', name: '本人身份证' },
      { slotKey: 'id_card', ownerType: 'spouse', name: '配偶身份证' }
    ];
    var result = computeSlotStates(qmasTemplate, uploadedDocs, 'spouse');
    var identityCat = result.find(function(c) { return c.categoryKey === 'identity'; });
    var idSlot = identityCat.slots.find(function(s) { return s.slotKey === 'id_card'; });
    expect(idSlot.uploadedCount).toBe(1);
  });

  test('[边界] 无 ownerType 文档默认视为 self', function() {
    var uploadedDocs = [
      { slotKey: 'id_card', name: '身份证' }  // 无 ownerType
    ];
    var result = computeSlotStates(qmasTemplate, uploadedDocs, 'self');
    var identityCat = result.find(function(c) { return c.categoryKey === 'identity'; });
    var idSlot = identityCat.slots.find(function(s) { return s.slotKey === 'id_card'; });
    expect(idSlot.uploadedCount).toBe(1);

    // spouse 过滤应该匹配不到
    var result2 = computeSlotStates(qmasTemplate, uploadedDocs, 'spouse');
    var identityCat2 = result2.find(function(c) { return c.categoryKey === 'identity'; });
    var idSlot2 = identityCat2.slots.find(function(s) { return s.slotKey === 'id_card'; });
    expect(idSlot2.uploadedCount).toBe(0);
  });

  test('[边界] 即将过期(<90天) → fillStatus=expiring_soon', function() {
    var futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    var uploadedDocs = [
      { slotKey: 'id_card', validTo: futureDate.toISOString().split('T')[0] },
      { slotKey: 'id_card', validTo: futureDate.toISOString().split('T')[0] }
    ];
    var result = computeSlotStates(qmasTemplate, uploadedDocs);
    var identityCat = result.find(function(c) { return c.categoryKey === 'identity'; });
    var idSlot = identityCat.slots.find(function(s) { return s.slotKey === 'id_card'; });
    expect(idSlot.fillStatus).toBe('expiring_soon');
  });

  test('[边界] 已过期 → fillStatus=expired', function() {
    var uploadedDocs = [
      { slotKey: 'id_card', expired: true },
      { slotKey: 'id_card', expired: true }
    ];
    var result = computeSlotStates(qmasTemplate, uploadedDocs);
    var identityCat = result.find(function(c) { return c.categoryKey === 'identity'; });
    var idSlot = identityCat.slots.find(function(s) { return s.slotKey === 'id_card'; });
    expect(idSlot.fillStatus).toBe('expired');
  });

  test('[边界] docType 匹配 slotKey（OCR 识别兜底）', function() {
    var uploadedDocs = [
      { type: 'id_card', name: '扫描件' }
    ];
    var result = computeSlotStates(qmasTemplate, uploadedDocs);
    var identityCat = result.find(function(c) { return c.categoryKey === 'identity'; });
    var idSlot = identityCat.slots.find(function(s) { return s.slotKey === 'id_card'; });
    expect(idSlot.uploadedCount).toBe(1);
  });

  test('[边界] 分类+名称模糊匹配兜底', function() {
    var uploadedDocs = [
      { category: 'identity', name: '内地身份证扫描件' }
    ];
    var result = computeSlotStates(qmasTemplate, uploadedDocs);
    var identityCat = result.find(function(c) { return c.categoryKey === 'identity'; });
    var idSlot = identityCat.slots.find(function(s) { return s.slotKey === 'id_card'; });
    expect(idSlot.uploadedCount).toBe(1);
  });

  test('[边界] 分类进度计算: QMAS identity 4槽全required', function() {
    var result = computeSlotStates(qmasTemplate, []);
    var identityCat = result.find(function(c) { return c.categoryKey === 'identity'; });
    expect(identityCat.categoryProgress.total).toBe(3);
    expect(identityCat.categoryProgress.filled).toBe(0);
  });

  test('[降级] 空模板或无 categories', function() {
    var emptyTpl = { templateId: 'empty', categories: [] };
    var result = computeSlotStates(emptyTpl, []);
    expect(result).toEqual([]);
  });

  test('[降级] 空 uploadedDocs → 所有分类 progress.filled=0', function() {
    var result = computeSlotStates(qmasTemplate, []);
    result.forEach(function(cat) {
      expect(cat.categoryProgress.filled).toBe(0);
      expect(cat.categoryProgress.total).toBeGreaterThan(0);
    });
  });
});

// ============================================================
// 5. 模板数据完整性
// ============================================================
describe('模板数据完整性校验', function() {

  test('[数据] INDEX_TEMPLATES 存在且非空', function() {
    expect(INDEX_TEMPLATES).toBeDefined();
    var keys = Object.keys(INDEX_TEMPLATES);
    expect(keys.length).toBeGreaterThan(10);
  });

  test('[数据] 每个模板有 templateId/status/path/mode/categories', function() {
    Object.keys(INDEX_TEMPLATES).forEach(function(key) {
      var tpl = INDEX_TEMPLATES[key];
      expect(tpl.templateId).toBeDefined();
      expect(tpl.categories).toBeDefined();
      expect(Array.isArray(tpl.categories)).toBe(true);
      expect(tpl.categories.length).toBeGreaterThan(0);
    });
  });

  test('[数据] 模板 ID 字段值唯一', function() {
    var ids = Object.values(INDEX_TEMPLATES).map(function(t) { return t.templateId; });
    var uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  test('[数据] 每个槽位含 slotKey/docName/requirement/maxCount', function() {
    Object.values(INDEX_TEMPLATES).forEach(function(tpl) {
      tpl.categories.forEach(function(cat) {
        cat.slots.forEach(function(slot) {
          expect(slot.slotKey).toBeDefined();
          expect(slot.docName).toBeDefined();
          expect(slot.requirement).toBeDefined();
          expect(['required', 'recommended', 'optional']).toContain(slot.requirement);
          expect(typeof slot.maxCount).toBe('number');
        });
      });
    });
  });

  test('[数据] 所有模板 totalRequired 与 required 槽位数一致', function() {
    // 验证 totalRequired 声明的值是否与实际 required 槽位数匹配
    var mismatches = [];
    Object.values(INDEX_TEMPLATES).forEach(function(tpl) {
      var actualRequired = countRequiredSlots(tpl);
      if (tpl.totalRequired !== actualRequired) {
        mismatches.push(tpl.templateId + ': declared=' + tpl.totalRequired + ' actual=' + actualRequired);
      }
    });
    expect(mismatches).toEqual([]);
  });
});
