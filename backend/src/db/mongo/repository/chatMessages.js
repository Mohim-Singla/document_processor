import { modelMap } from '../models/index.js';

async function create(messageData) {
  return modelMap.chatMessagesModel.getModel().create(messageData);
}

async function findBySession(sessionId, filter = {}, limit = 50) {
  return modelMap.chatMessagesModel.getModel()
    .find({ sessionId, ...filter })
    .sort({ createdAt: 1 })
    .limit(limit)
    .lean();
}

async function deleteBySession(sessionId, filter = {}) {
  return modelMap.chatMessagesModel.getModel().deleteMany({ sessionId, ...filter });
}

export const chatMessages = {
  create,
  findBySession,
  deleteBySession,
};
