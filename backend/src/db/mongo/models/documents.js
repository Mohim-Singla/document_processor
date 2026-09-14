import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    documentId: { type: String, required: true, unique: true },
    sessionId: { type: String, required: true, index: true },
    userId: { type: String, default: null, index: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    s3Key: { type: String, required: true },
    s3Bucket: { type: String, required: true },
    status: {
      type: String,
      enum: ['QUEUED', 'PROCESSING', 'READY', 'FAILED'],
      default: 'QUEUED',
      index: true,
    },
    pageCount: { type: Number, default: 0 },
    errorMessage: { type: String, default: null },
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
