import {
  SQSClient,
  CreateQueueCommand,
  GetQueueUrlCommand,
} from '@aws-sdk/client-sqs';
import { Consumer } from 'sqs-consumer';
import { sqsClientConfig } from '../../config/sqs/sqsClientConfig.js';
import { logger } from '../../utils/logger.js';

const CONTEXT = 'sqsClient';
let sqsClientInstanceMap = new Map();
let queueUrlMap = new Map();

export const sqsClient = {
  /**
   * Returns an SQS client instance for a given region (cached)
   */
  getInstance: (region) => {
    const targetRegion = region || sqsClientConfig.REGION || 'ap-south-1';
    let instance = sqsClientInstanceMap.get(targetRegion);
    if (!instance) {
      instance = new SQSClient({
        region: targetRegion,
        credentials: {
          accessKeyId: sqsClientConfig.ACCESS_KEY_ID || '',
          secretAccessKey: sqsClientConfig.SECRET_ACCESS_KEY || '',
        },
      });
      sqsClientInstanceMap.set(targetRegion, instance);
    }
    return instance;
  },

  /**
   * Resolves Queue URL: Checks if queue exists on AWS; creates it if it does not exist.
   */
  getOrCreateQueueUrl: async (queueName) => {
    const targetQueueName = queueName || sqsClientConfig.QUEUES.DOCUMENT_PROCESSING;
    if (queueUrlMap.has(targetQueueName)) {
      return queueUrlMap.get(targetQueueName);
    }

    const client = sqsClient.getInstance();
    const SUB_CONTEXT = 'getOrCreateQueueUrl';

    try {
      logger.info(`Checking if SQS queue exists: ${targetQueueName}`, CONTEXT, SUB_CONTEXT, { targetQueueName });
      const getCmd = new GetQueueUrlCommand({ QueueName: targetQueueName });
      const res = await client.send(getCmd);
      queueUrlMap.set(targetQueueName, res.QueueUrl);
      logger.info(`Found existing SQS queue URL: ${res.QueueUrl}`, CONTEXT, SUB_CONTEXT);
      return res.QueueUrl;
    } catch (err) {
      // QueueDoesNotExist error code or 400
      if (err.name === 'QueueDoesNotExist' || err.message?.includes('does not exist')) {
        logger.warn(`SQS Queue ${targetQueueName} does not exist. Calling AWS to create it...`, CONTEXT, SUB_CONTEXT);
        try {
          const createCmd = new CreateQueueCommand({
            QueueName: targetQueueName,
            Attributes: {
              VisibilityTimeout: '300', // 5 minutes processing timeout for heavy OCR/embeddings
              MessageRetentionPeriod: '86400', // 1 day
            },
          });
          const createRes = await client.send(createCmd);
          queueUrlMap.set(targetQueueName, createRes.QueueUrl);
          logger.info(`Successfully created SQS queue: ${createRes.QueueUrl}`, CONTEXT, SUB_CONTEXT);
          return createRes.QueueUrl;
        } catch (createErr) {
          logger.error(`Failed to create SQS queue ${targetQueueName}`, CONTEXT, SUB_CONTEXT, { error: createErr.message });
          throw createErr;
        }
      } else {
        logger.error(`Error querying SQS queue ${targetQueueName}`, CONTEXT, SUB_CONTEXT, { error: err.message });
        throw err;
      }
    }
  },

  /**
   * Initializes and creates all queues defined in the QUEUES constant by looping over Object.values
   */
  initAllQueues: async () => {
    const SUB_CONTEXT = 'initAllQueues';
    const queueNames = Object.values(sqsClientConfig.QUEUES);
    logger.info('Initializing all SQS queues on AWS...', CONTEXT, SUB_CONTEXT, { queues: queueNames });

    const results = {};
    for (const queueName of queueNames) {
      results[queueName] = await sqsClient.getOrCreateQueueUrl(queueName);
    }

    logger.info('All SQS queues initialized successfully', CONTEXT, SUB_CONTEXT, { results });
    return results;
  },

  /**
   * Initializes consumer with message handler callback
   */
  initConsumer: async ({ queueName, handleMessage }) => {
    const SUB_CONTEXT = 'initConsumer';
    const targetQueueName = queueName || sqsClientConfig.QUEUES.DOCUMENT_PROCESSING;
    const queueUrl = await sqsClient.getOrCreateQueueUrl(targetQueueName);
    const client = sqsClient.getInstance();

    logger.info('Starting SQS Consumer for queue', CONTEXT, SUB_CONTEXT, { queueUrl, targetQueueName });

    const consumer = Consumer.create({
      queueUrl,
      sqs: client,
      shouldDeleteMessages: true,
      handleMessage: async (message) => {
        logger.info('Consumer received message from SQS', CONTEXT, SUB_CONTEXT, { messageId: message.MessageId });
        await handleMessage(message);
        logger.info('Consumer finished message processing successfully', CONTEXT, SUB_CONTEXT, { messageId: message.MessageId });
      },
    });

    consumer.on('error', (err) => {
      logger.error('SQS Consumer client error', CONTEXT, SUB_CONTEXT, { error: err.message });
    });

    consumer.on('processing_error', (err) => {
      logger.error('SQS Consumer processing error', CONTEXT, SUB_CONTEXT, { error: err.message });
    });

    consumer.on('timeout_error', (err) => {
      logger.error('SQS Consumer timeout error', CONTEXT, SUB_CONTEXT, { error: err.message });
    });

    consumer.start();
    logger.info('SQS Consumer started polling successfully', CONTEXT, SUB_CONTEXT, { targetQueueName });
    return consumer;
  },
};

export default sqsClient;
