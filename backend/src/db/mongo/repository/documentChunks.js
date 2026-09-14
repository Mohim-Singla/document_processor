import { modelMap } from '../models/index.js';

async function bulkInsert(chunks) {
  return modelMap.documentChunksModel.getModel().insertMany(chunks);
}

async function findBySession(sessionId) {
  return modelMap.documentChunksModel.getModel().find({ sessionId }).lean();
}

async function findByDocument(documentId) {
  return modelMap.documentChunksModel.getModel().find({ documentId }).lean();
}

async function deleteBySession(sessionId) {
  return modelMap.documentChunksModel.getModel().deleteMany({ sessionId });
}

async function deleteByDocument(documentId) {
  return modelMap.documentChunksModel.getModel().deleteMany({ documentId });
}

export const documentChunks = {
  bulkInsert,
  findBySession,
  findByDocument,
  deleteBySession,
  deleteByDocument,
};
