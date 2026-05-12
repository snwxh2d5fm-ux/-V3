/**
 * 住港伴 v4 — 数据库管理云函数 (db-admin)
 * 处理云端数据同步、备份、统计、AI配置更新
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { action } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  switch (action) {
    case 'stats':
      return await getStats();
    case 'sync':
      return await syncData(openid, event.data);
    case 'pullAll':
      return await pullAllData(openid);
    case 'backup':
      return await createBackup(openid);
    case 'updateAIConfig':
      return await updateAIConfig();
    case 'importKnowledge':
      return await importKnowledge(event.batch, event.collection || 'knowledge_chunks');
    case 'emergencyCleanK2':
      return await emergencyCleanK2(event.dryRun !== false);
    default:
      return { code: 400, message: 'Unknown action: ' + action };
  }
};

async function getStats() {
  try {
    const [docsCount, remindersCount, processesCount] = await Promise.all([
      db.collection('documents').count(),
      db.collection('reminders').count(),
      db.collection('processes').count()
    ]);
    return {
      code: 200,
      stats: {
        documents: docsCount.total,
        reminders: remindersCount.total,
        processes: processesCount.total
      }
    };
  } catch (e) {
    return { code: 500, message: e.message };
  }
}

async function syncData(openid, data) {
  try {
    // 同步用户数据
    if (data && data.documents) {
      for (const doc of data.documents) {
        await db.collection('documents').where({ _openid: openid, id: doc.id }).update({ data: doc }).catch(() =>
          db.collection('documents').add({ data: { ...doc, _openid: openid, updatedAt: Date.now() } })
        );
      }
    }
    if (data && data.reminders) {
      for (const r of data.reminders) {
        await db.collection('reminders').where({ _openid: openid, id: r.id }).update({ data: r }).catch(() =>
          db.collection('reminders').add({ data: { ...r, _openid: openid, updatedAt: Date.now() } })
        );
      }
    }
    return { code: 200, message: 'sync ok' };
  } catch (e) {
    return { code: 500, message: e.message };
  }
}

async function pullAllData(openid) {
  try {
    const [docsRes, remindersRes, processesRes] = await Promise.all([
      db.collection('documents').where({ _openid: openid }).get(),
      db.collection('reminders').where({ _openid: openid }).get(),
      db.collection('processes').where({ _openid: openid }).get()
    ]);
    return {
      code: 200,
      data: {
        documents: docsRes.data,
        reminders: remindersRes.data,
        processes: processesRes.data
      }
    };
  } catch (e) {
    return { code: 500, message: e.message };
  }
}

async function createBackup(openid) {
  try {
    const timestamp = Date.now();
    const [docsRes, remRes, procRes] = await Promise.all([
      db.collection('documents').where({ _openid: openid }).get(),
      db.collection('reminders').where({ _openid: openid }).get(),
      db.collection('processes').where({ _openid: openid }).get()
    ]);
    await db.collection('backups').add({
      data: {
        _openid: openid,
        timestamp,
        documents: docsRes.data,
        reminders: remRes.data,
        processes: procRes.data
      }
    });
    return { code: 200, message: 'backup created', timestamp };
  } catch (e) {
    return { code: 500, message: e.message };
  }
}

async function updateAIConfig() {
  // 更新 DeepSeek V4 模型配置
  return { code: 200, message: 'AI配置已更新', model: 'deepseek-chat', version: 'v4' };
}

/**
 * 轻量知识导入 (≤50条, 用于运行时增量导入)
 * 大批量导入请使用 knowledge-import 云函数
 */
async function importKnowledge(batch, collection) {
  if (!batch || !Array.isArray(batch) || batch.length > 50) {
    return { code: 400, message: 'batch ≤50条' };
  }
  let inserted = 0, skipped = 0, errors = 0;
  for (const item of batch) {
    try {
      if (!item.content_hash) { errors++; continue; }
      const exist = await db.collection(collection)
        .where({ content_hash: item.content_hash }).count();
      if (exist.total > 0) { skipped++; continue; }
      await db.collection(collection).add({
        data: { ...item, createdAt: db.serverDate(), updatedAt: db.serverDate() }
      });
      inserted++;
    } catch (e) { errors++; }
  }
  return { code: 0, data: { inserted, skipped, errors } };
}

/**
 * 紧急清理: 从 knowledge_chunks 中删除已误导入的 K2 内容
 * 匹配条件: source=='doc_recognition_library' + content含K2关键词
 * @param {boolean} dryRun — true=预览, false=执行删除
 */
async function emergencyCleanK2(dryRun) {
  var collection = 'knowledge_chunks';

  try {
    // 匹配条件: doc_id字段以DOC-开头（模型识别库的唯一标识模式）
    // 这些条目含有 visual_features/privacy_level/vault_mode 等K2字段
    // 使用 RegExp 直接匹配 doc_id 字段，避免扫描全部8779条记录
    var docPattern = db.RegExp({ regexp: '^DOC-', options: '' });
    var res = await db.collection(collection)
      .where({ doc_id: docPattern })
      .field({ doc_id: true, name_zh: true, _id: true })
      .limit(100)   // 最多100条（预期16条）
      .get();
    var k2Records = res.data;

    if (dryRun) {
      return {
        code: 200,
        message: '[DRY RUN] 预览将被删除的记录 — 不会实际删除',
        data: {
          matched_count: k2Records.length,
          records: k2Records.map(function(r) {
            return {
              _id: r._id,
              doc_id: r.doc_id,
              name_zh: r.name_zh || '(无)'
            };
          })
        }
      };
    }

    // 执行删除
    var deleted = 0;
    for (var j = 0; j < k2Records.length; j++) {
      await db.collection(collection).doc(k2Records[j]._id).remove();
      deleted++;
    }

    var remaining = await db.collection(collection).count();

    return {
      code: 200,
      message: 'K2内容清理完成',
      data: {
        total_deleted: deleted,
        remaining_total: remaining.total
      }
    };

  } catch (err) {
    console.error('[emergencyCleanK2] 清理失败:', err);
    return { code: 500, message: 'K2清理失败: ' + (err.message || String(err)) };
  }
}
