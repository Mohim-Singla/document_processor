import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  chunkId: { type: String, required: true, unique: true },
  documentId: { type: String, required: true, index: true },
  sessionId: { type: String, required: true, index: true },
  userId: { type: String, default: null, index: true },
  pageNumber: { type: Number, default: 1 },
  chunkIndex: { type: Number, required: true },
  content: { type: String, required: true },
  metadata: {
    sectionHeading: String,
    charLength: Number,
    hasTable: Boolean,
  },
  embedding: { type: [Number], default: [] },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });

// Compound indexes for high-speed RAG chunk lookups
schema.index({ sessionId: 1, userId: 1, isDeleted: 1 });
schema.index({ documentId: 1, isDeleted: 1 });

let model;

export const documentChunksModel = {
  init: async (mongoConnection) => {
    model = mongoConnection.model('document_chunks', schema, 'document_chunks');
  },
  getModel: () => model,
};
