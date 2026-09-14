import {
  SQSClient,
  CreateQueueCommand,
  GetQueueUrlCommand,
  GetQueueAttributesCommand,
  SetQueueAttributesCommand,
} from '@aws-sdk/client-sqs';
import { Consumer } from 'sqs-consumer';
import { sqsClientConfig } from '../../config/sqs/sqsClientConfig.js';
import { logger } from '../../utils/logger.js';

const CONTEXT = 'sqsClient';
let sqsClientInstanceMap = new Map();
let queueUrlMap = new Map();
let queueArnMap = new Map();

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
   * Retrieves the QueueArn for a given queue URL
   */
  getQueueArn: async (queueUrl) => {
    if (queueArnMap.has(queueUrl)) {
      return queueArnMap.get(queueUrl);
    }
    const client = sqsClient.getInstance();
    const cmd = new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: ['QueueArn'],
    });
    const res = await client.send(cmd);
    const arn = res.Attributes?.QueueArn;
    if (arn) {
      queueArnMap.set(queueUrl, arn);
    }
    return arn;
  },

  /**
   * Resolves Queue URL: Checks if queue exists on AWS; creates it if it does not exist.
   * Also configures DLQ (Dead Letter Queue) and attaches RedrivePolicy if specified.
   */
  getOrCreateQueueUrl: async (queueName, options = {}) => {
    const targetQueueName = queueName || sqsClientConfig.QUEUES.DOCUMENT_PROCESSING;
    if (queueUrlMap.has(targetQueueName)) {
      return queueUrlMap.get(targetQueueName);
    }

    const client = sqsClient.getInstance();
    const SUB_CONTEXT = 'getOrCreateQueueUrl';

    const attributes = {
      VisibilityTimeout: options.visibilityTimeout || '300', // 5 minutes processing timeout
      MessageRetentionPeriod: options.messageRetentionPeriod || (options.isDlq ? '1209600' : '86400'), // 14 days for DLQ, 1 day for source
      ...(options.attributes || {}),
    };

    if (options.deadLetterTargetArn) {
      attributes.RedrivePolicy = JSON.stringify({
        deadLetterTargetArn: options.deadLetterTargetArn,
        maxReceiveCount: options.maxReceiveCount || 3,
      });
    }

    let queueUrl = null;

    try {
      logger.info(`Checking if SQS queue exists: ${targetQueueName}`, CONTEXT, SUB_CONTEXT, { targetQueueName });
      const getCmd = new GetQueueUrlCommand({ QueueName: targetQueueName });
      const res = await client.send(getCmd);
      queueUrl = res.QueueUrl;
      queueUrlMap.set(targetQueueName, queueUrl);
      logger.info(`Found existing SQS queue URL: ${queueUrl}`, CONTEXT, SUB_CONTEXT);

      // If existing queue needs DLQ RedrivePolicy attached and doesn't have it yet
      if (options.deadLetterTargetArn) {
        try {
          const attrCmd = new GetQueueAttributesCommand({
            QueueUrl: queueUrl,
            AttributeNames: ['RedrivePolicy'],
          });
          const currentAttrs = await client.send(attrCmd);
          if (!currentAttrs.Attributes?.RedrivePolicy) {
            logger.info(`Attaching RedrivePolicy (DLQ) to existing queue ${targetQueueName}`, CONTEXT, SUB_CONTEXT, {
              deadLetterTargetArn: options.deadLetterTargetArn,
            });
            await client.send(
              new SetQueueAttributesCommand({
                QueueUrl: queueUrl,
                Attributes: {
                  RedrivePolicy: JSON.stringify({
                    deadLetterTargetArn: options.deadLetterTargetArn,
                    maxReceiveCount: options.maxReceiveCount || 3,
                  }),
                },
              })
            );
          }
        } catch (policyErr) {
          logger.warn(`Could not verify/update RedrivePolicy for ${targetQueueName}`, CONTEXT, SUB_CONTEXT, {
            error: policyErr.message,
          });
        }
      }

      return queueUrl;
    } catch (err) {
      if (err.name === 'QueueDoesNotExist' || err.message?.includes('does not exist')) {
        logger.warn(`SQS Queue ${targetQueueName} does not exist. Calling AWS to create it...`, CONTEXT, SUB_CONTEXT);
        try {
          const createCmd = new CreateQueueCommand({
            QueueName: targetQueueName,
            Attributes: attributes,
          });
          const createRes = await client.send(createCmd);
          queueUrl = createRes.QueueUrl;
          queueUrlMap.set(targetQueueName, queueUrl);
          logger.info(`Successfully created SQS queue: ${queueUrl}`, CONTEXT, SUB_CONTEXT, { attributes });
          return queueUrl;
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
   * Initializes and creates all queues defined in the QUEUES constant.
   * Guarantees DLQs are created first, then sets up source queues with RedrivePolicy pointing to their DLQ.
   */
  initAllQueues: async () => {
    const SUB_CONTEXT = 'initAllQueues';
    const queues = sqsClientConfig.QUEUES;
    logger.info('Initializing all SQS queues and DLQs on AWS...', CONTEXT, SUB_CONTEXT, { queues });

    const results = {};

    // 1. Initialize DLQ first (if configured)
    let dlqArn = null;
    if (queues.DOCUMENT_PROCESSING_DLQ) {
      const dlqUrl = await sqsClient.getOrCreateQueueUrl(queues.DOCUMENT_PROCESSING_DLQ, {
        isDlq: true,
        visibilityTimeout: '300',
        messageRetentionPeriod: '1209600', // Retain failed messages for 14 days
      });
      results[queues.DOCUMENT_PROCESSING_DLQ] = dlqUrl;
      try {
        dlqArn = await sqsClient.getQueueArn(dlqUrl);
        logger.info('Resolved DLQ ARN', CONTEXT, SUB_CONTEXT, { dlqArn, dlqUrl });
      } catch (arnErr) {
        logger.warn('Failed to retrieve DLQ ARN', CONTEXT, SUB_CONTEXT, { error: arnErr.message });
      }
    }

    // 2. Initialize Main/Source queues with RedrivePolicy pointing to DLQ
    for (const [key, queueName] of Object.entries(queues)) {
      if (key.endsWith('_DLQ')) continue; // Skip DLQ as it was already initialized

      results[queueName] = await sqsClient.getOrCreateQueueUrl(queueName, {
        deadLetterTargetArn: dlqArn,
        maxReceiveCount: 3, // Move to DLQ after 3 failed attempts
      });
    }

    logger.info('All SQS queues and DLQs initialized successfully', CONTEXT, SUB_CONTEXT, { results });
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
      alwaysAcknowledge: true,
      pollingWaitTimeMs: 0,
      waitTimeSeconds: 0,
      handleMessage: async (message) => {
        logger.info('Consumer received message from SQS', CONTEXT, SUB_CONTEXT, { messageId: message.MessageId });
        await handleMessage(message);
        logger.info('Consumer finished message processing successfully', CONTEXT, SUB_CONTEXT, { messageId: message.MessageId });
        return message;
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
