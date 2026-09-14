import { modelMap } from '../models/index.js';

async function fetchOne(filter) {
  return modelMap.sessionsModel.getModel().findOne({ isDeleted: { $ne: true }, ...filter }).lean();
}

async function fetchAll(filter = {}, sort = { updatedAt: -1 }) {
  return modelMap.sessionsModel.getModel().find({ isDeleted: { $ne: true }, ...filter }).sort(sort).lean();
}

async function create(sessionData) {
  const model = modelMap.sessionsModel.getModel();
  return model.create({ isDeleted: false, deletedAt: null, ...sessionData });
}

async function update(filter, updateData) {
  return modelMap.sessionsModel.getModel().findOneAndUpdate({ isDeleted: { $ne: true }, ...filter }, { $set: updateData }, { new: true }).lean();
}

async function incrementDocCount(sessionId, delta = 1) {
  if (delta < 0) {
    // Prevent documentCount from dropping below 0
    return modelMap.sessionsModel.getModel().updateOne(
      { sessionId, isDeleted: { $ne: true }, documentCount: { $gt: 0 } },
      { $inc: { documentCount: delta } }
    );
  }
  return modelMap.sessionsModel.getModel().updateOne({ sessionId, isDeleted: { $ne: true } }, { $inc: { documentCount: delta } });
}

async function softDelete(filter) {
  return modelMap.sessionsModel.getModel().updateOne(
    { isDeleted: { $ne: true }, ...filter },
    { $set: { isDeleted: true, deletedAt: new Date() } }
  );
}

async function destroy(filter) {
  return softDelete(filter);
}

export const sessions = {
  fetchOne,
  fetchAll,
  create,
  update,
  incrementDocCount,
  softDelete,
  destroy,
};
