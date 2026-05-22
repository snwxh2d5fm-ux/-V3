/**
 * knowledge-import — 知识库批量导入云函数
 *
 * 用途: 将预处理好的知识块批量写入 knowledge_chunks 集合
 * 调用: wx.cloud.callFunction({ name: 'knowledge-import', data: { action, batch, ... } })
 *
 * 支持动作:
 *   importChunk    — 导入一批记录 (≤100条/次, 基于 content_hash 去重)
 *   importFromFile — 从云存储文件批量导入 (文件需先上传到云存储)
 *   verify         — 校验 knowledge_chunks 数据完整性
 *   stats          — 查询导入统计
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 单次最大导入条数 (CloudBase 云函数写操作限制)
const MAX_BATCH = 100;

// ============================================================
//  V7: K2 内容拦截 — 防止识别库完整版(含防伪特征等)误导入
// ============================================================
const K2_FORBIDDEN_PATTERNS = [
  '圆角边框',
  '防伪特征',
  '光变油墨',
  '微缩文字',
  '全息防伪',
  '安全特征',
  'AES-256',
  'PBKDF2',
  'WASM',
  'Canny',
  '边缘检测',
  '轮廓近似',
  '校验位算法',
  'MOD 11',
  'MOD11',
  'validation_rules',
  'vault_mode',
  'privacy_level',
];

// K2 结构化字段 — 这些字段只应存在于识别引擎内部，不应进入知识底座
const K2_STRUCTURED_FIELDS = ['visual_features', 'validation_rules', 'vault_mode', 'privacy_level'];

/**
 * 检测文本内容是否含 K2 禁止关键词
 */
function containsK2Content(text) {
  if (!text || typeof text !== 'string') return false;
  for (let i = 0; i < K2_FORBIDDEN_PATTERNS.length; i++) {
    if (text.indexOf(K2_FORBIDDEN_PATTERNS[i]) !== -1) {
      return true;
    }
  }
  return false;
}

/**
 * 检测记录是否含 K2 结构化字段 (如 visual_features, privacy_level)
 * 这些字段在知识底座中不应存在 — 仅效率宝/OCR引擎内部使用
 */
function containsK2StructuredFields(record) {
  for (let i = 0; i < K2_STRUCTURED_FIELDS.length; i++) {
    if (record[K2_STRUCTURED_FIELDS[i]] !== undefined) {
      return true;
    }
  }
  return false;
}

/**
 * 检测记录是否为识别库来源
 */
function isDocRecognitionLibrarySource(record) {
  return (
    record.source === 'doc_recognition_library' &&
    (containsK2StructuredFields(record) || containsK2Content(record.content))
  );
}

/**
 * 综合 K2 检测: 任一命中则拦截
 * @returns {{ blocked: boolean, reason: string }}
 */
function scanForK2(record) {
  // 检查1: 识别库来源 + 含K2结构化字段
  if (isDocRecognitionLibrarySource(record)) {
    return { blocked: true, reason: 'K2 blocked: doc_recognition_library with K2 structured fields' };
  }

  // 检查2: content 字段含K2禁止关键词
  if (containsK2Content(record.content)) {
    return { blocked: true, reason: 'K2 blocked: content contains forbidden pattern' };
  }

  // 检查3: 记录本身含K2结构化字段 (防御性, 无论source为何)
  if (containsK2StructuredFields(record)) {
    return {
      blocked: true,
      reason:
        'K2 blocked: record contains structured K2 fields (visual_features/validation_rules/vault_mode/privacy_level)',
    };
  }

  return { blocked: false, reason: '' };
}

exports.main = async (event, context) => {
  const { action = 'stats' } = event;
  const wxContext = cloud.getWXContext();

  switch (action) {
    case 'importChunk':
      return await importChunk(event.batch, event.collection || 'knowledge_chunks');
    case 'importFromFile':
      return await importFromFile(event.fileID, event.collection || 'knowledge_chunks');
    case 'verify':
      return await verifyData(event.expectedCount);
    case 'stats':
      return await getImportStats();
    default:
      return { code: 400, message: `Unknown action: ${action}` };
  }
};

/**
 * 批量导入记录 (≤100条)
 * @param {Array} batch — 记录数组, 每条至少含 content_hash 字段
 * @param {string} collection — 目标集合名
 */
async function importChunk(batch, collection) {
  if (!batch || !Array.isArray(batch) || batch.length === 0) {
    return { code: 400, message: 'batch 必须是非空数组' };
  }
  if (batch.length > MAX_BATCH) {
    return { code: 400, message: `单次最多导入 ${MAX_BATCH} 条, 当前 ${batch.length} 条` };
  }

  const stats = { total: batch.length, inserted: 0, skipped: 0, errors: 0, k2_blocked: 0 };

  for (let idx = 0; idx < batch.length; idx++) {
    const item = batch[idx];
    try {
      // V7: K2 内容拦截 — 在去重之前先扫描
      const k2Result = scanForK2(item);
      if (k2Result.blocked) {
        console.warn('[knowledge-import V7] ' + k2Result.reason);
        stats.k2_blocked++;
        continue;
      }

      // 基于 content_hash 去重
      if (!item.content_hash) {
        stats.errors++;
        continue;
      }

      const exist = await db.collection(collection).where({ content_hash: item.content_hash }).count();

      if (exist.total > 0) {
        stats.skipped++;
        continue;
      }

      // 补充时间戳
      const record = {
        ...item,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate(),
        _importBatch: item.pipeline_batch || 'MANUAL',
        _importTime: new Date().toISOString(),
      };

      await db.collection(collection).add({ data: record });
      stats.inserted++;
    } catch (e) {
      console.error(`[knowledge-import] 导入失败:`, e.message);
      stats.errors++;
    }
  }

  return {
    code: 0,
    message:
      '导入完成: ' +
      stats.inserted +
      ' 新增, ' +
      stats.skipped +
      ' 跳过, ' +
      stats.errors +
      ' 失败, ' +
      stats.k2_blocked +
      ' K2拦截',
    data: stats,
  };
}

/**
 * 从云存储文件批量导入 (适用于大文件)
 * 文件格式: JSONL (每行一条JSON记录)
 */
async function importFromFile(fileID, collection) {
  if (!fileID) {
    return { code: 400, message: '缺少 fileID 参数' };
  }

  try {
    // 下载云存储文件
    const downloadResult = await cloud.downloadFile({ fileID });
    const content = downloadResult.fileContent.toString('utf-8');

    // 解析 JSONL
    const lines = content.trim().split('\n');
    const records = [];
    for (const line of lines) {
      try {
        records.push(JSON.parse(line));
      } catch (e) {
        console.warn('[knowledge-import] 跳过无效行:', line.substring(0, 50));
      }
    }

    if (records.length === 0) {
      return { code: 400, message: '文件中未找到有效记录' };
    }

    // 分批写入 (每批 MAX_BATCH 条)
    const totalStats = { total: records.length, inserted: 0, skipped: 0, errors: 0, k2_blocked: 0 };

    for (let i = 0; i < records.length; i += MAX_BATCH) {
      const chunk = records.slice(i, i + MAX_BATCH);
      const result = await importChunk(chunk, collection);
      totalStats.inserted += result.data.inserted;
      totalStats.skipped += result.data.skipped;
      totalStats.errors += result.data.errors;
      totalStats.k2_blocked += result.data.k2_blocked || 0;
    }

    return {
      code: 0,
      message:
        '文件导入完成: ' +
        totalStats.inserted +
        ' 新增, ' +
        totalStats.skipped +
        ' 跳过, ' +
        totalStats.errors +
        ' 失败, ' +
        totalStats.k2_blocked +
        ' K2拦截',
      data: totalStats,
    };
  } catch (e) {
    console.error('[knowledge-import] importFromFile 失败:', e);
    return { code: 500, message: `文件导入失败: ${e.message}` };
  }
}

/**
 * 校验 knowledge_chunks 数据完整性
 */
async function verifyData(expectedCount) {
  try {
    const countResult = await db.collection('knowledge_chunks').count();
    const actual = countResult.total;

    // 按批次统计
    const batchStats = {};
    const batches = ['ANSWERKEY-V5.2', 'ANSWERKEY-V5.2-Q11', 'TESTBANK-V1', 'ZHIHU-20260510', 'POLICY-V1'];

    for (const batch of batches) {
      const res = await db.collection('knowledge_chunks').where({ pipeline_batch: batch }).count();
      batchStats[batch] = res.total;
    }

    // 按 content_grade 统计
    const greenRes = await db.collection('knowledge_chunks').where({ content_grade: 'green' }).count();
    const yellowRes = await db.collection('knowledge_chunks').where({ content_grade: 'yellow' }).count();

    return {
      code: 0,
      message: expectedCount
        ? actual >= expectedCount
          ? '✅ 数据完整'
          : `⚠️ 预期 ${expectedCount}, 实际 ${actual}`
        : '校验完成',
      data: {
        totalDocuments: actual,
        expectedCount: expectedCount || null,
        byBatch: batchStats,
        byGrade: { green: greenRes.total, yellow: yellowRes.total },
      },
    };
  } catch (e) {
    return { code: 500, message: `校验失败: ${e.message}` };
  }
}

/**
 * 查询导入统计
 */
async function getImportStats() {
  try {
    const total = await db.collection('knowledge_chunks').count();

    // 取最近导入的10条样本
    const sample = await db.collection('knowledge_chunks').orderBy('createdAt', 'desc').limit(10).get();

    return {
      code: 0,
      data: {
        totalDocuments: total.total,
        recentImports: sample.data.map((r) => ({
          source_title: r.source_title,
          pipeline_batch: r.pipeline_batch,
          content_grade: r.content_grade,
          knowledge_domain: r.knowledge_domain,
          content_length: r.content ? r.content.length : 0,
        })),
      },
    };
  } catch (e) {
    return { code: 500, message: e.message };
  }
}
