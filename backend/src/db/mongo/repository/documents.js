import { modelMap } from '../models/index.js';

async function fetchOne(filter) {
  return modelMap.documentsModel.getModel().findOne(filter).lean();
}

async function fetchAll(filter = {}, sort = { createdAt: -1 }) {
  return modelMap.documentsModel.getModel().find(filter).sort(sort).lean();
}

async function create(documentData) {
  const model = modelMap.documentsModel.getModel();
  return model.create(documentData);
}

async function update(filter, updateData) {
  return modelMap.documentsModel.getModel().findOneAndUpdate(filter, { $set: updateData }, { new: true }).lean();
}

async function destroy(filter) {
  return modelMap.documentsModel.getModel().deleteOne(filter);
}

async function deleteBySession(sessionId) {
  return modelMap.documentsModel.getModel().deleteMany({ sessionId });
}

export const documents = {
  fetchOne,
  fetchAll,
  create,
  update,
  destroy,
  deleteBySession,
};
