import mongoose from 'mongoose';
import { DOCUMENT_STATUS } from '../../../utils/constant/status.js';

const schema = new mongoose.Schema(
  {
    documentId: { type: String, required: true, unique: true },
    sessionId: { type: String, required: true, index: true },
    userId: { type: String, default: null },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    s3Key: { type: String, required: true },
    s3Bucket: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(DOCUMENT_STATUS),
      default: DOCUMENT_STATUS.QUEUED,
    },
    pageCount: { type: Number, default: 0 },
    summary: { type: String, default: null },
    errorMessage: { type: String, default: null },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

let model;

export const documentsModel = {
  init: async (mongoConnection) => {
    model = mongoConnection.model('documents', schema, 'documents');
  },
  getModel: () => model,
};
