/**
 * 住港伴 v5.1 — 知识库批量嵌入脚本
 *
 * [V4.1-PHASE2] ZGB-AI-201: 将 knowledge_chunks 集合全部 chunk 批量调用混元 embedding API
 *
 * 功能:
 *   1. 读取 knowledge_chunks 中所有 content_grade=green/yellow 的活跃 chunk
 *   2. 调用腾讯混元 embedding API (ap-guangzhou, 1024维)
 *   3. 将 embedding 存入每个 chunk 的 embedding 字段 (Float32 数组)
 *
 * 用法:
 *   node scripts/embed-all-chunks.js
 *
 * 前置条件:
 *   - TENCENT_SECRET_ID / TENCENT_SECRET_KEY 环境变量已设置
 *   - tencentcloud-sdk-nodejs-hunyuan 已安装
 *   - 已初始化 CloudBase 环境 (通过 ENV_ID 或默认环境)
 *
 * 成本估算:
 *   - 8,779 chunks x ~300 tokens/chunk = ~2,633,700 tokens
 *   - 单价: ¥0.002 / 千tokens
 *   - 总成本: ~¥5.27
 *
 * 限流保护:
 *   - 每批 5 条并发，防止 QPS 超标
 *   - 每批次间隔 200ms
 *   - 单条超时 10s
 */
const cloudbase = require('@cloudbase/node-sdk');
const BATCH_SIZE = 5;        // 并发批大小 (防止 QPS 超标)
const BATCH_INTERVAL_MS = 200; // 批次间隔
const SINGLE_TIMEOUT_MS = 10000; // 单条超时

// ========== 混元 SDK ==========
let hunyuanClient = null;
try {
  const HunyuanSDK = require('tencentcloud-sdk-nodejs-hunyuan');
  hunyuanClient = HunyuanSDK.hunyuan.v20230901.Client;
} catch(e) {
  console.error('[embed-all-chunks] 错误: tencentcloud-sdk-nodejs-hunyuan 未安装');
  console.error('请执行: npm install tencentcloud-sdk-nodejs-hunyuan');
  process.exit(1);
}

// ========== CloudBase 初始化 ==========
const app = cloudbase.init({ env: process.env.ENV_ID });
const db = app.database();
const _ = db.command;

// ========== 统计 ==========
const stats = {
  total: 0,
  success: 0,
  failed: 0,
  skipped: 0,   // 已有 embedding 跳过
  startTime: Date.now()
};

// ========== 获取单个 chunk 的 embedding ==========
async function getEmbedding(text) {
  try {
    const client = new hunyuanClient({
      credential: {
        secretId: process.env.TENCENT_SECRET_ID,
        secretKey: process.env.TENCENT_SECRET_KEY
      },
      region: 'ap-guangzhou'
    });
    const resp = await client.GetEmbedding({
      Input: (text || '').substring(0, 2048)
    });
    if (resp && resp.Data && resp.Data[0] && resp.Data[0].Embedding) {
      return resp.Data[0].Embedding;
    }
    return null;
  } catch(e) {
    console.warn('[embed-all-chunks]   embedding 调用失败:', e.message);
    return null;
  }
}

// ========== 带超时的 Promise ==========
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise(function(_, reject) {
      setTimeout(function() { reject(new Error('Timeout after ' + ms + 'ms')); }, ms);
    })
  ]);
}

// ========== 读取所有需要嵌入的 chunk ==========
async function fetchAllChunks() {
  var allChunks = [];
  var offset = 0;
  var batchSize = 200;

  console.log('[embed-all-chunks] 正在读取 knowledge_chunks 集合...');

  while (true) {
    try {
      var res = await db.collection('knowledge_chunks')
        .where({
          content_grade: _.in(['green', 'yellow']),
          deprecated: _.neq(true)
        })
        .skip(offset)
        .limit(batchSize)
        .field({ _id: true, content: true, source_title: true })
        .get();

      if (!res.data || res.data.length === 0) break;

      allChunks = allChunks.concat(res.data);
      offset += res.data.length;
      console.log('[embed-all-chunks]   已读取 ' + offset + ' 条...');
    } catch(e) {
      console.error('[embed-all-chunks] 读取失败:', e.message);
      break;
    }
  }

  console.log('[embed-all-chunks] 共读取 ' + allChunks.length + ' 条 chunk');
  return allChunks;
}

// ========== 批量处理 ==========
async function processBatch(batch) {
  var promises = batch.map(function(chunk) {
    return withTimeout(getEmbedding(chunk.content || ''), SINGLE_TIMEOUT_MS)
      .then(function(embedding) {
        if (embedding) {
          return { _id: chunk._id, embedding: embedding, success: true };
        }
        return { _id: chunk._id, success: false };
      })
      .catch(function(err) {
        console.warn('[embed-all-chunks]   chunk ' + chunk._id + ' 嵌入失败:', err.message);
        return { _id: chunk._id, success: false };
      });
  });

  return Promise.all(promises);
}

// ========== 写入 embedding 到 DB ==========
async function saveEmbedding(chunkId, embedding) {
  try {
    await db.collection('knowledge_chunks').doc(chunkId).update({
      embedding: embedding
    });
    return true;
  } catch(e) {
    console.warn('[embed-all-chunks]   DB 写入失败 _id=' + chunkId + ':', e.message);
    return false;
  }
}

// ========== 主流程 ==========
async function main() {
  console.log('================================================');
  console.log('  住港伴 v5.1 — 知识库批量嵌入脚本');
  console.log('  时间: ' + new Date().toISOString());
  console.log('  环境: ENV_ID=' + (process.env.ENV_ID || '默认'));
  console.log('  混元 SDK: ' + (hunyuanClient ? '已加载' : '未加载'));
  console.log('================================================\n');

  // 验证环境变量
  if (!process.env.TENCENT_SECRET_ID || !process.env.TENCENT_SECRET_KEY) {
    console.error('[embed-all-chunks] 错误: 请设置 TENCENT_SECRET_ID 和 TENCENT_SECRET_KEY 环境变量');
    process.exit(1);
  }

  // 1. 读取所有 chunk
  var allChunks = await fetchAllChunks();
  stats.total = allChunks.length;

  if (allChunks.length === 0) {
    console.log('[embed-all-chunks] 没有需要嵌入的 chunk');
    return;
  }

  // 2. 分批次嵌入
  console.log('\n[embed-all-chunks] 开始批量嵌入，批次大小=' + BATCH_SIZE + '...\n');

  for (var i = 0; i < allChunks.length; i += BATCH_SIZE) {
    var batch = allChunks.slice(i, i + BATCH_SIZE);
    var results = await processBatch(batch);

    // 逐个写入 DB
    for (var j = 0; j < results.length; j++) {
      var r = results[j];
      if (r.success && r.embedding) {
        var saved = await saveEmbedding(r._id, r.embedding);
        if (saved) {
          stats.success++;
        } else {
          stats.failed++;
        }
      } else {
        stats.failed++;
      }
    }

    // 进度报告
    var processed = Math.min(i + BATCH_SIZE, allChunks.length);
    var elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);
    var rate = (processed / elapsed).toFixed(1);
    console.log('[embed-all-chunks]   进度: ' + processed + '/' + allChunks.length +
      ' (' + (processed / allChunks.length * 100).toFixed(1) + '%)' +
      ' | 成功: ' + stats.success + ' | 失败: ' + stats.failed +
      ' | 速率: ' + rate + '条/秒');

    // 批次间隔
    if (i + BATCH_SIZE < allChunks.length) {
      await new Promise(function(r) { setTimeout(r, BATCH_INTERVAL_MS); });
    }
  }

  // 3. 最终报告
  var totalElapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);
  console.log('\n================================================');
  console.log('  批量嵌入完成');
  console.log('  总计: ' + stats.total + ' 条');
  console.log('  成功: ' + stats.success + ' 条');
  console.log('  失败: ' + stats.failed + ' 条');
  console.log('  耗时: ' + totalElapsed + ' 秒');
  console.log('  速率: ' + (stats.success / totalElapsed).toFixed(1) + ' 条/秒');
  console.log('  成本估算: ~¥' + (stats.total * 300 * 0.002 / 1000).toFixed(2));
  console.log('================================================');
}

// ========== 执行 ==========
main().catch(function(err) {
  console.error('[embed-all-chunks] 脚本异常退出:', err);
  process.exit(1);
});
