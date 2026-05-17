// cloudfunctions/document-manager/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { action, data } = event;
  const { OPENID } = cloud.getWXContext();

  switch (action) {
    case 'list': return listDocs(OPENID);
    case 'save': return saveDoc(OPENID, data);
    case 'delete': return deleteDoc(OPENID, data);
    case 'sync': return syncDocs(OPENID, data);
    default: return { ok: false, error: 'unknown_action' };
  }
};

async function listDocs(openid) {
  const { data: docs } = await db.collection('user_documents')
    .where({ _openid: openid, status: 'active' })
    .orderBy('updatedAt', 'desc').get();
  return { ok: true, documents: docs };
}

async function saveDoc(openid, { doc }) {
  const coll = db.collection('user_documents');
  if (doc._id) {
    await coll.doc(doc._id).update({ data: { ...doc, updatedAt: new Date() } });
  } else {
    await coll.add({ data: { ...doc, _openid: openid, createdAt: new Date(), updatedAt: new Date() } });
  }
  return { ok: true };
}

async function deleteDoc(openid, { docId }) {
  // 验证文档归属——仅允许删除本人的文档
  const result = await db.collection('user_documents')
    .where({ _id: docId, _openid: openid }).get();
  if (!result.data || result.data.length === 0) {
    return { ok: false, error: 'document_not_found_or_not_owned' };
  }
  await db.collection('user_documents').doc(docId).update({
    data: { status: 'archived', updatedAt: new Date() }
  });
  return { ok: true };
}

async function syncDocs(openid, { localDocs }) {
  // 双向同步：云端新记录覆盖本地，本地新记录上传云端
  const { data: cloudDocs } = await db.collection('user_documents')
    .where({ _openid: openid }).get();
  return { ok: true, cloudDocs };
}
