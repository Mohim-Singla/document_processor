import { modelMap } from '../models/index.js';

async function bulkInsert(chunks) {
  return modelMap.documentChunksModel.getModel().insertMany(chunks);
}

async function findBySession(sessionId, filter = {}) {
  return modelMap.documentChunksModel.getModel().find({ sessionId, ...filter }).lean();
}

async function findByDocument(documentId, filter = {}) {
  return modelMap.documentChunksModel.getModel().find({ documentId, ...filter }).lean();
}

async function deleteBySession(sessionId, filter = {}) {
  return modelMap.documentChunksModel.getModel().deleteMany({ sessionId, ...filter });
}

async function deleteByDocument(documentId, filter = {}) {
  return modelMap.documentChunksModel.getModel().deleteMany({ documentId, ...filter });
}

export const documentChunks = {
  bulkInsert,
  findBySession,
  findByDocument,
  deleteBySession,
  deleteByDocument,
};
