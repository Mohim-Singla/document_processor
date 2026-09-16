import { modelMap } from '../models/index.js';

async function bulkInsert(chunks) {
  const preparedChunks = chunks.map((chunk) => ({
    isDeleted: false,
    deletedAt: null,
    ...chunk,
  }));
  return modelMap.documentChunksModel.getModel().insertMany(preparedChunks);
}

async function findBySession(sessionId, filter = {}) {
  return modelMap.documentChunksModel.getModel().find({ sessionId, isDeleted: { $ne: true }, ...filter }).lean();
}

async function findByDocument(documentId, filter = {}, projection = null, options = {}) {
  let query = modelMap.documentChunksModel.getModel().find({ documentId, isDeleted: { $ne: true }, ...filter }, projection);
  if (options.sort) query = query.sort(options.sort);
  if (options.limit) query = query.limit(options.limit);
  if (options.skip) query = query.skip(options.skip);
  return query.lean();
}

async function countByDocument(documentId, filter = {}) {
  return modelMap.documentChunksModel.getModel().countDocuments({ documentId, isDeleted: { $ne: true }, ...filter });
}

async function softDeleteBySession(sessionId, filter = {}) {
  return modelMap.documentChunksModel.getModel().updateMany(
    { sessionId, isDeleted: { $ne: true }, ...filter },
    { $set: { isDeleted: true, deletedAt: new Date() } }
  );
}

async function softDeleteByDocument(documentId, filter = {}) {
  return modelMap.documentChunksModel.getModel().updateMany(
    { documentId, isDeleted: { $ne: true }, ...filter },
    { $set: { isDeleted: true, deletedAt: new Date() } }
  );
}

async function deleteBySession(sessionId, filter = {}) {
  return softDeleteBySession(sessionId, filter);
}

async function deleteByDocument(documentId, filter = {}) {
  return softDeleteByDocument(documentId, filter);
}

export const documentChunks = {
  bulkInsert,
  findBySession,
  findByDocument,
  countByDocument,
  softDeleteBySession,
  softDeleteByDocument,
  deleteBySession,
  deleteByDocument,
};
