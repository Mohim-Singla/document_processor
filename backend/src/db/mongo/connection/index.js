import mongoose from 'mongoose';
import { mongoConnectionConfig } from '../../../config/database/mongoConnectionConfig.js';
import { modelMap } from '../models/index.js';

let mongoConnectionInstance = null;

/**
 * Initializes the MongoDB connection using the provided configuration.
 * Handles both authenticated and unauthenticated connections.
 * @returns {Promise<mongoose.Connection>} The mongoose connection instance.
 */
async function initConnection() {
  const protocol = mongoConnectionConfig.isSRV ? 'mongodb+srv' : 'mongodb';
  let connectionURL = '';

  if (mongoConnectionConfig.user && mongoConnectionConfig.password) {
    const encodedUser = encodeURIComponent(mongoConnectionConfig.user);
    const encodedPassword = encodeURIComponent(mongoConnectionConfig.password);
    connectionURL = `${protocol}://${encodedUser}:${encodedPassword}@${mongoConnectionConfig.host}/${mongoConnectionConfig.database}`;
  } else {
    connectionURL = `${protocol}://${mongoConnectionConfig.host}/${mongoConnectionConfig.database}`;
  }

  const connectionOptions = {
    ...(mongoConnectionConfig.user ? { authSource: 'admin' } : {}),
  };

  mongoConnectionInstance = mongoose.createConnection(connectionURL, connectionOptions);

  return mongoConnectionInstance;
}

/**
 * Initializes all the models defined in the modelMap by connecting them to the database instance.
 * Automatically creates collections if they do not exist and builds indexes.
 * @returns {Promise<void>} Resolves once all models and collections are initialized.
 */
async function initModels() {
  const promises = [];
  for (const modelItem of Object.keys(modelMap)) {
    promises.push(
      (async () => {
        await modelMap[modelItem].init(mongoConnectionInstance);
        const model = modelMap[modelItem].getModel();
        if (model) {
          // Creates collection in DB if it doesn't already exist
          await model.createCollection();
          // Builds all schema-defined indexes
          await model.syncIndexes();
        }
      })()
    );
  }
  await Promise.all(promises);
}

/**
 * MongoDB connection utility.
 * Provides methods to initialize the connection and retrieve the instance.
 */
export const mongoConnection = {
  /**
   * Initializes the MongoDB connection and the models.
   * @returns {Promise<void>} Resolves once the connection and models are initialized.
   */
  init: async () => {
    await initConnection();
    await initModels();

    return mongoConnectionInstance;
  },

  /**
   * Retrieves the MongoDB connection instance, or initializes it if not already done.
   * @returns {Promise<mongoose.Connection>} The mongoose connection instance.
   */
  getInstance: () => mongoConnectionInstance ?? mongoConnection.init(),
};
