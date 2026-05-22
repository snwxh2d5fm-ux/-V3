/**
 * db-admin — 紧急清理: 从 knowledge_chunks 中删除已误导入的 K2 内容
 *
 * 问题: 模型识别库完整JSONL（含visual_features/validation_rules/privacy_level/vault_mode等K2敏感字段）
 *       已导入knowledge_chunks集合，16条记录全部含K2内容，现可被RAG检索。
 *
 * 用法: wx.cloud.callFunction({ name: 'db-admin', data: { action: 'emergencyCleanK2', dryRun: true } })
 *       dryRun=true 预览将被删除的记录
 *       dryRun=false 执行删除
 *
 * 删除条件: source == 'doc_recognition_library'
 * 影响范围: 仅模型识别库的16条chunk，不影响V5 AnswerKey/题库/知乎/政策等其他数据
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

/**
 * 紧急清理: 删除误导入的识别库K2内容
 */
async function emergencyCleanK2(dryRun) {
  const collection = 'knowledge_chunks';
  const sourceMatched = { source: 'doc_recognition_library' };

  // 如果导入时没有设置source字段，则用content中包含K2特征的模式来匹配
  // 作为后备方案
  const k2Pattern = db.RegExp({
    regexp: 'visual_features|validation_rules|vault_mode|privacy_level|圆角边框|全息防伪|光变油墨',
    options: 'i'
  });

  try {
    // 方法1: 按source字段匹配
    var res = await db.collection(collection)
      .where(sourceMatched)
      .field({ content: true, source_title: true, content_hash: true })
      .get();

    var matchedBySource = res.data;

    // 方法2: 按内容K2特征匹配（后备，以防source字段未设置）
    var res2 = await db.collection(collection)
      .where({ content: k2Pattern })
      .field({ content: true, source_title: true, content_hash: true })
      .get();

    // 合并去重
    var allMatched = matchedBySource.slice();
    var seenHashes = {};
    for (var i = 0; i < matchedBySource.length; i++) {
      seenHashes[matchedBySource[i].content_hash] = true;
    }
    for (var j = 0; j < res2.data.length; j++) {
      if (!seenHashes[res2.data[j].content_hash]) {
        allMatched.push(res2.data[j]);
        seenHashes[res2.data[j].content_hash] = true;
      }
    }

    if (dryRun) {
      return {
        code: 200,
        message: '[DRY RUN] 预览将被删除的记录 — 不会实际删除',
        data: {
          matched_count: allMatched.length,
          matched_by_source: matchedBySource.length,
          matched_by_pattern: res2.data.length,
          records: allMatched.map(function(r) {
            return {
              content_hash: r.content_hash,
              source_title: r.source_title,
              content_preview: (r.content || '').substring(0, 100),
            };
          }),
        },
      };
    }

    // 执行删除
    var deleteSource = 0;
    var deletePattern = 0;

    for (var k = 0; k < matchedBySource.length; k++) {
      await db.collection(collection)
        .where({ content_hash: matchedBySource[k].content_hash })
        .remove();
      deleteSource++;
    }

    for (var l = 0; l < res2.data.length; l++) {
      if (!seenHashes[res2.data[l].content_hash]) {
        await db.collection(collection)
          .where({ content_hash: res2.data[l].content_hash })
          .remove();
        deletePattern++;
      }
    }

    return {
      code: 200,
      message: 'K2内容清理完成',
      data: {
        deleted_by_source: deleteSource,
        deleted_by_pattern: deletePattern,
        total_deleted: deleteSource + deletePattern,
        remaining_total: (await db.collection(collection).count()).total,
      },
    };

  } catch (err) {
    return { code: 500, message: 'K2清理失败: ' + (err.message || String(err)) };
  }
}

module.exports = { emergencyCleanK2 };
