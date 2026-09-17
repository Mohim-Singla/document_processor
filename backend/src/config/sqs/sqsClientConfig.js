import { constant } from '../../utils/constant/index.js';

const defaultRegion = process.env.AWS_SQS_REGION_DEFAULT || process.env.AWS_REGION || 'ap-south-1';
const currentEnv = process.env.ENV || constant.ENVS.DEV;
const waitTimeSeconds = Number(process.env.AWS_SQS_WAIT_TIME_SECONDS) || constant.AWS_CONFIG.DEFAULT_SQS_WAIT_TIME_SECONDS;
const pollingWaitTimeMs = Number(process.env.AWS_SQS_POLLING_WAIT_TIME_MS) || constant.AWS_CONFIG.DEFAULT_SQS_POLLING_WAIT_TIME_MS;

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
    WAIT_TIME_SECONDS: waitTimeSeconds,
    POLLING_WAIT_TIME_MS: pollingWaitTimeMs,
  },
  [constant.ENVS.DEV]: {
    REGION: defaultRegion,
    ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_ACCOUNT_ID: process.env.AWS_ACCOUNT_ID,
    QUEUES: buildQueues(constant.ENVS.DEV),
    WAIT_TIME_SECONDS: waitTimeSeconds,
    POLLING_WAIT_TIME_MS: pollingWaitTimeMs,
  },
  [constant.ENVS.PROD]: {
    REGION: defaultRegion,
    ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_ACCOUNT_ID: process.env.AWS_ACCOUNT_ID,
    QUEUES: buildQueues(constant.ENVS.PROD),
    WAIT_TIME_SECONDS: waitTimeSeconds,
    POLLING_WAIT_TIME_MS: pollingWaitTimeMs,
  },
};

export const sqsClientConfig = config[currentEnv] || config[constant.ENVS.DEV];
export default sqsClientConfig;
