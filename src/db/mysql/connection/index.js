import Sequelize from 'sequelize';
import { mysqlConnectionConfig } from '../../../config/database/mysqlConnectionConfig.js';
import { modelMap } from '../models/index.js';

let mysqlConnectionInstance = null;

async function initConnection() {

  mysqlConnectionInstance = new Sequelize(mysqlConnectionConfig.database, mysqlConnectionConfig.username, mysqlConnectionConfig.password, mysqlConnectionConfig);

  await mysqlConnectionInstance.authenticate();

  return mysqlConnectionInstance;
}

async function initModels() {
  const promises = [];
  for(const modelItem of Object.keys(modelMap)) {
    promises.push(modelMap[modelItem].init(mysqlConnectionInstance));
  }
  await Promise.all(promises);
}

export const mysqlConnection = {
  init: async () => {
    await initConnection();
    await initModels();

    return mysqlConnectionInstance;
  },
  getInstance: () => mysqlConnectionInstance ?? mysqlConnection.init(),
};
