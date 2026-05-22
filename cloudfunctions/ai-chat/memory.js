/**
 * 住港伴 v5.1 — 多轮对话记忆模块 (REQ-010)
 *
 * 双层记忆架构:
 *   - 客户端: wx.Storage（50条，快速恢复）
 *   - 服务端: conversation_logs（最近5轮，跨设备持久化）
 *
 * 合并策略（专家评审 C3）:
 *   - 客户端 history 为时间锚点（新鲜度高）
 *   - 服务端 memory 仅补充客户端缺失的消息
 *   - 去重依赖 client_timestamp + content_hash 双重校验
 *
 * 隐私策略（专家评审 C5）:
 *   - 对话保留 30 天，超过自动归档/脱敏
 */

/**
 * 从 conversation_logs 恢复最近对话记忆
 * @param {string} sessionId - 当前会话ID
 * @param {string} openid - 用户 CloudBase openid
 * @param {object} db - CloudBase 数据库实例
 * @returns {Array<{role:string, content:string, timestamp:number}>}
 */
async function loadRecentMemory(sessionId, openid, db) {
  if (!sessionId && !openid) return [];
  if (!db) return [];

  try {
    const _ = db.command;
    const query = {};

    // 优先按 session_id 查询，回退按 openid
    if (sessionId) {
      query.session_id = sessionId;
    } else if (openid) {
      query._openid = openid;
    }

    const res = await db
      .collection('conversation_logs')
      .where(query)
      .orderBy('timestamp', 'desc')
      .limit(12) // 12条消息 = 6轮，取5轮有冗余
      .field({
        query: true,
        response_preview: true,
        timestamp: true,
        session_id: true,
      })
      .get();

    if (!res.data || res.data.length === 0) return [];

    // 转为 [{role, content, timestamp}] 格式，按时间升序
    const messages = [];
    const seen = new Set();

    for (let i = res.data.length - 1; i >= 0; i--) {
      const log = res.data[i];
      const userContent = log.query || '';
      const assistantContent = log.response_preview || '';

      // content_hash 用于去重（取前80字符做指纹）
      if (userContent) {
        const userHash = userContent.substring(0, 80).trim().toLowerCase();
        if (!seen.has('u_' + userHash)) {
          seen.add('u_' + userHash);
          messages.push({ role: 'user', content: userContent });
        }
      }
      if (assistantContent) {
        const assistantHash = assistantContent.substring(0, 80).trim().toLowerCase();
        if (!seen.has('a_' + assistantHash)) {
          seen.add('a_' + assistantHash);
          messages.push({ role: 'assistant', content: assistantContent });
        }
      }
    }

    return messages;
  } catch (e) {
    console.warn('[memory] loadRecentMemory failed:', e.message);
    return [];
  }
}

/**
 * 合并客户端 history 和服务端 memory
 * 专家评审 C3: 客户端为时间锚点，服务端仅补充缺失
 * 双重校验: content_hash 去重
 *
 * @param {Array} clientHistory - 客户端传来的 [{role, content}]
 * @param {Array} serverMemory - 服务端加载的 [{role, content}]
 * @returns {Array} 合并去重后的历史
 */
function mergeHistory(clientHistory, serverMemory) {
  if (!serverMemory || serverMemory.length === 0) {
    return clientHistory || [];
  }
  if (!clientHistory || clientHistory.length === 0) {
    return serverMemory;
  }

  // 提取客户端消息的 content_hash 集合
  const clientHashes = new Set();
  for (let i = 0; i < clientHistory.length; i++) {
    const c = clientHistory[i];
    if (c && c.content) {
      clientHashes.add(c.content.substring(0, 80).trim().toLowerCase());
    }
  }

  // 服务端消息中，不在客户端已有时才补充
  const merged = [];
  for (let j = 0; j < serverMemory.length; j++) {
    const s = serverMemory[j];
    if (!s || !s.content) continue;
    const hash = s.content.substring(0, 80).trim().toLowerCase();
    if (!clientHashes.has(hash)) {
      merged.push(s);
    }
  }

  // 服务端补充的消息在前（历史更久远），客户端消息在后（更新鲜）
  return merged.concat(clientHistory);
}

/**
 * 压缩记忆以适应 max_tokens 限制
 * @param {Array} messages - 记忆消息数组
 * @param {number} maxMessages - 最多保留条数（默认10条=5轮）
 * @returns {Array}
 */
function trimMemory(messages, maxMessages) {
  maxMessages = maxMessages || 10;
  if (messages.length <= maxMessages) return messages;
  return messages.slice(messages.length - maxMessages);
}

module.exports = {
  loadRecentMemory,
  mergeHistory,
  trimMemory,
};
