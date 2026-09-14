import { constant } from '../../utils/constant/index.js';

const defaultRegion = process.env.AWS_SQS_REGION_DEFAULT || process.env.AWS_REGION || 'ap-south-1';
const currentEnv = process.env.ENV || constant.ENVS.DEV;

// Dynamically generate queue names with suffix: `${baseName}_${ENV}`
const buildQueues = (env) => {
  const queues = {};
  for (const [key, baseName] of Object.entries(constant.QUEUES)) {
    queues[key] = `${baseName}_${env}`;
  }
  return queues;
};

const config = {
  [constant.ENVS.LOCAL]: {
    REGION: defaultRegion,
    ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_ACCOUNT_ID: process.env.AWS_ACCOUNT_ID,
    QUEUES: buildQueues(constant.ENVS.LOCAL),
  },
  [constant.ENVS.DEV]: {
    REGION: defaultRegion,
    ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_ACCOUNT_ID: process.env.AWS_ACCOUNT_ID,
    QUEUES: buildQueues(constant.ENVS.DEV),
  },
  [constant.ENVS.PROD]: {
    REGION: defaultRegion,
    ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_ACCOUNT_ID: process.env.AWS_ACCOUNT_ID,
    QUEUES: buildQueues(constant.ENVS.PROD),
  },
};

export const sqsClientConfig = config[currentEnv] || config[constant.ENVS.DEV];
export default sqsClientConfig;
