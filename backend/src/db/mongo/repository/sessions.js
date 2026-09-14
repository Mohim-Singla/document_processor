import { modelMap } from '../models/index.js';

async function fetchOne(filter) {
  return modelMap.sessionsModel.getModel().findOne(filter).lean();
}

async function fetchAll(filter = {}, sort = { updatedAt: -1 }) {
  return modelMap.sessionsModel.getModel().find(filter).sort(sort).lean();
}

async function create(sessionData) {
  const model = modelMap.sessionsModel.getModel();
  return model.create(sessionData);
}

async function update(filter, updateData) {
  return modelMap.sessionsModel.getModel().findOneAndUpdate(filter, { $set: updateData }, { new: true }).lean();
}

async function incrementDocCount(sessionId, delta = 1) {
  if (delta < 0) {
    // Prevent documentCount from dropping below 0
    return modelMap.sessionsModel.getModel().updateOne(
      { sessionId, documentCount: { $gt: 0 } },
      { $inc: { documentCount: delta } }
    );
  }
  return modelMap.sessionsModel.getModel().updateOne({ sessionId }, { $inc: { documentCount: delta } });
}

async function destroy(filter) {
  return modelMap.sessionsModel.getModel().deleteOne(filter);
}

export const sessions = {
  fetchOne,
  fetchAll,
  create,
  update,
  incrementDocCount,
  destroy,
};
