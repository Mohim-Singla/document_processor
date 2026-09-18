import { modelMap } from '../models/index.js';
import { PAGINATION } from '../../../utils/constant/index.js';

async function create(messageData) {
  return modelMap.chatMessagesModel.getModel().create({ isDeleted: false, deletedAt: null, ...messageData });
}

async function findBySession(sessionId, filter = {}, limit = PAGINATION.DEFAULT_CHAT_MESSAGE_LIMIT) {
  return modelMap.chatMessagesModel.getModel()
    .find({ sessionId, isDeleted: { $ne: true }, ...filter })
    .sort({ createdAt: 1 })
    .limit(limit)
    .lean();
}

async function findLastBySession(sessionId, filter = {}) {
  return modelMap.chatMessagesModel.getModel()
    .findOne({ sessionId, isDeleted: { $ne: true }, ...filter })
    .sort({ createdAt: -1 })
    .lean();
}

async function softDeleteBySession(sessionId, filter = {}) {
  return modelMap.chatMessagesModel.getModel().updateMany(
    { sessionId, isDeleted: { $ne: true }, ...filter },
    { $set: { isDeleted: true, deletedAt: new Date() } }
  );
}

async function deleteBySession(sessionId, filter = {}) {
  return softDeleteBySession(sessionId, filter);
}

export const chatMessages = {
  create,
  findBySession,
  findLastBySession,
  softDeleteBySession,
  deleteBySession,
};
