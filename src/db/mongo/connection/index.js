import mongoose from 'mongoose';
import { mongoConnectionConfig } from '../../../config/database/mongoConnectionConfig.js';
import { modelMap } from '../models/index.js';

let mongoConnectionInstance = null;

/**
 * Initializes the MongoDB connection using the provided configuration.
 * Encodes user credentials and forms the connection URL.
 * Creates and stores the mongoose connection instance.
 * @returns {Promise<mongoose.Connection>} The mongoose connection instance.
 */
async function initConnection() {
  const encodedUser = encodeURIComponent(mongoConnectionConfig.user);
  const encodedPassword = encodeURIComponent(mongoConnectionConfig.password);
  const protocol = mongoConnectionConfig.isSRV ? 'mongodb+srv' : 'mongodb';

  const connectionURL = `${protocol}://${encodedUser}:${encodedPassword}@${mongoConnectionConfig.host}/${mongoConnectionConfig.database}`;
  const connectionOptions = {
    authSource: 'admin',
  };
  mongoConnectionInstance = mongoose.createConnection(connectionURL, connectionOptions);

  return mongoConnectionInstance;
}

/**
 * Initializes all the models defined in the modelMap by connecting them to the database instance.
 * @returns {Promise<void>} Resolves once all models are initialized.
 */
async function initModels() {
  const promises = [];
  for(const modelItem of Object.keys(modelMap)) {
    promises.push(modelMap[modelItem].init(mongoConnectionInstance));
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
