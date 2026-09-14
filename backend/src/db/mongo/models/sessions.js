import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true },
    userId: { type: String, default: null, index: true },
    title: { type: String, required: true },
    description: { type: String, default: null },
    status: { type: String, enum: ['ACTIVE', 'ARCHIVED'], default: 'ACTIVE', index: true },
    documentCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

let model;

export const sessionsModel = {
  init: async (mongoConnection) => {
    model = mongoConnection.model('sessions', schema, 'sessions');
  },
  getModel: () => model,
};
