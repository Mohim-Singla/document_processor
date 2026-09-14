import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  messageId: { type: String, required: true, unique: true },
  sessionId: { type: String, required: true, index: true },
  userId: { type: String, default: null, index: true },
  sender: { type: String, enum: ['USER', 'ASSISTANT'], required: true },
  content: { type: String, required: true },
  citations: [
    {
      documentId: String,
      fileName: String,
      pageNumber: Number,
      snippet: String,
      score: Number,
    },
  ],
}, { timestamps: true });

let model;

export const chatMessagesModel = {
  init: async (mongoConnection) => {
    model = mongoConnection.model('chat_messages', schema, 'chat_messages');
  },
  getModel: () => model,
};
