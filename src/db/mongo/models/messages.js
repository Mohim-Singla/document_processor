import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  userId: { type: String, required: true },
  groupId: { type: String, required: true },
  messageContent: { type: String, required: true },
  timestamp: { type: Date, required: true, default: Date.now },
}, { timestamps: true });

let model;

/**
 * messages model utility.
 * Provides methods to initialize the model and retrieve the model instance.
 */
export const messagesModel = {
  /**
   * Initializes the messages model by creating it using the provided MongoDB connection.
   *
   * @param {mongoose.Connection} mongoConnection - The mongoose connection instance to use for creating the model.
   * @returns {Promise<void>} Resolves once the model is initialized.
   */
  init: async (mongoConnection) => {
    model = mongoConnection.model('messages', schema, 'messages');
  },

  /**
   * Retrieves the messages model instance.
   *
   * @returns {mongoose.Model} The mongoose model instance for the 'messages' collection.
   */
  getModel: () => model,
};
