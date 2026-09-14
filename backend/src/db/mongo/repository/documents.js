import { modelMap } from '../models/index.js';

async function fetchOne(filter) {
  return modelMap.documentsModel.getModel().findOne({ isDeleted: { $ne: true }, ...filter }).lean();
}

async function fetchAll(filter = {}, sort = { createdAt: -1 }) {
  return modelMap.documentsModel.getModel().find({ isDeleted: { $ne: true }, ...filter }).sort(sort).lean();
}

async function create(documentData) {
  const model = modelMap.documentsModel.getModel();
  return model.create({ isDeleted: false, deletedAt: null, ...documentData });
}

async function update(filter, updateData) {
  return modelMap.documentsModel.getModel().findOneAndUpdate({ isDeleted: { $ne: true }, ...filter }, { $set: updateData }, { new: true }).lean();
}

async function softDelete(filter) {
  return modelMap.documentsModel.getModel().updateOne(
    { isDeleted: { $ne: true }, ...filter },
    { $set: { isDeleted: true, deletedAt: new Date() } }
  );
}

async function softDeleteBySession(sessionId, filter = {}) {
  return modelMap.documentsModel.getModel().updateMany(
    { sessionId, isDeleted: { $ne: true }, ...filter },
    { $set: { isDeleted: true, deletedAt: new Date() } }
  );
}

async function destroy(filter) {
  return softDelete(filter);
}

async function deleteBySession(sessionId, filter = {}) {
  return softDeleteBySession(sessionId, filter);
}

async function count(filter = {}) {
  return modelMap.documentsModel.getModel().countDocuments({ isDeleted: { $ne: true }, ...filter });
}

export const documents = {
  fetchOne,
  fetchAll,
  create,
  update,
  softDelete,
  softDeleteBySession,
  destroy,
  deleteBySession,
  count,
};
