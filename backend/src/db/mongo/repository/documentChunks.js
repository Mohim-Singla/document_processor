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

async function findByDocument(documentId, filter = {}) {
  return modelMap.documentChunksModel.getModel().find({ documentId, isDeleted: { $ne: true }, ...filter }).lean();
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
  softDeleteBySession,
  softDeleteByDocument,
  deleteBySession,
  deleteByDocument,
};
