/**
 * guidebook-enrich — 攻略书场景速查完整性批量补充
 *
 * 一次性运行：为 life_guide_tasks 集合所有67条文档注入
 * required_items / tips / pitfalls / official_links 字段
 *
 * 数据来源：data/tasks/phase-{0-7}.js（已通过V5 AnswerKey+题库验证）
 * 幂等：使用 $set 覆盖已有字段，不影响 other 字段
 *
 * 触发方式：
 *   1. 部署此云函数
 *   2. 在云开发控制台手动触发（action=enrich）
 *   3. 返回每个 taskId 的更新状态
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const enrichMap = require('./enrich-data.js');

exports.main = async (event) => {
  const { action = 'enrich' } = event || {};

  if (action !== 'enrich') {
    return { code: 400, msg: '仅支持 action=enrich' };
  }

  const taskIds = Object.keys(enrichMap);
  const stats = { total: taskIds.length, updated: 0, skipped: 0, errors: 0, details: [] };

  // 批量更新：每批10个并发
  const BATCH = 10;
  for (let i = 0; i < taskIds.length; i += BATCH) {
    const batch = taskIds.slice(i, i + BATCH);
    const promises = batch.map(async (taskId) => {
      try {
        const fields = enrichMap[taskId];
        const updateData = {};
        if (fields.required_items && fields.required_items.length > 0)
          updateData.required_items = fields.required_items;
        if (fields.tips && fields.tips.length > 0) updateData.tips = fields.tips;
        if (fields.pitfalls && fields.pitfalls.length > 0) updateData.pitfalls = fields.pitfalls;
        if (fields.official_links && fields.official_links.length > 0)
          updateData.official_links = fields.official_links;

        if (Object.keys(updateData).length === 0) {
          stats.skipped++;
          stats.details.push({ taskId, status: 'skipped', reason: 'no_fields_to_update' });
          return;
        }

        const result = await db.collection('life_guide_tasks').where({ id: taskId }).update({ data: updateData });

        if (result.stats && result.stats.updated > 0) {
          stats.updated++;
          stats.details.push({ taskId, status: 'updated', fields: Object.keys(updateData) });
        } else {
          stats.skipped++;
          stats.details.push({ taskId, status: 'skipped', reason: 'not_found_or_no_change' });
        }
      } catch (err) {
        console.error(`[guidebook-enrich] update ${taskId} failed:`, err);
        stats.errors++;
        stats.details.push({ taskId, status: 'error', message: err.message });
      }
    });
    await Promise.all(promises);
  }

  return { code: 0, msg: '攻略书场景速查数据补充完成', data: stats };
};
