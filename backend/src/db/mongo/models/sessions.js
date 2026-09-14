import mongoose from 'mongoose';
import { SESSION_STATUS } from '../../../utils/constant/status.js';

const schema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true },
    userId: { type: String, default: null, index: true },
    title: { type: String, required: true },
    description: { type: String, default: null },
    status: {
      type: String,
      enum: Object.values(SESSION_STATUS),
      default: SESSION_STATUS.ACTIVE,
      index: true,
    },
    documentCount: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

schema.index({ userId: 1, status: 1, isDeleted: 1, updatedAt: -1, _id: -1 });

let model;

export const sessionsModel = {
  init: async (mongoConnection) => {
    model = mongoConnection.model('sessions', schema, 'sessions');
  },
  getModel: () => model,
};
