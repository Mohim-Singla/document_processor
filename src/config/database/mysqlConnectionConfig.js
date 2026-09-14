import dotenv from 'dotenv';
import { constant } from '../../utils/constant/index.js';

dotenv.config();

const config = {
  [constant.ENVS.LOCAL]: {
    host: process.env.MYSQL_HOST_IP,
    dialect: 'mysql',
    username: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    pool: {
      max: 30,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    logging: false,
  },
  [constant.ENVS.DEV]: {
    host: process.env.MYSQL_HOST_IP,
    dialect: 'mysql',
    username: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    pool: {
      max: 30,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    logging: false,
  },
  [constant.ENVS.PROD]: {
    host: process.env.MYSQL_HOST_IP,
    dialect: 'mysql',
    username: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    pool: {
      max: 30,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    logging: false,
  },
};

export const mysqlConnectionConfig =  config[process.env.ENV];
export default config;
