import { modelMap } from '../models/index.js';

async function fetchOne(filter) {
  return modelMap.sessionsModel.getModel().findOne({ isDeleted: { $ne: true }, ...filter }).lean();
}

async function fetchAll(filter = {}, sort = { updatedAt: -1 }) {
  return modelMap.sessionsModel.getModel().find({ isDeleted: { $ne: true }, ...filter }).sort(sort).lean();
}

async function fetchPaginated({ filter = {}, cursor = null, limit = 12 }) {
  const query = { isDeleted: { $ne: true }, ...filter };

  if (cursor) {
    // Cursor pagination sorting descending: (updatedAt, _id)
    const cursorDate = new Date(cursor.updatedAt);
    query.$or = [
      { updatedAt: { $lt: cursorDate } },
      { updatedAt: cursorDate, _id: { $lt: cursor.id } },
    ];
  }

  const items = await modelMap.sessionsModel
    .getModel()
    .find(query)
    .sort({ updatedAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();

  const hasMore = items.length > limit;
  const sessionsList = hasMore ? items.slice(0, limit) : items;

  let nextCursor = null;
  if (hasMore && sessionsList.length > 0) {
    const lastItem = sessionsList[sessionsList.length - 1];
    nextCursor = Buffer.from(
      JSON.stringify({
        updatedAt: lastItem.updatedAt,
        id: lastItem._id.toString(),
      })
    ).toString('base64');
  }

  return {
    sessions: sessionsList,
    nextCursor,
    hasMore,
  };
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
  fetchPaginated,
  create,
  update,
  incrementDocCount,
  softDelete,
  destroy,
};
