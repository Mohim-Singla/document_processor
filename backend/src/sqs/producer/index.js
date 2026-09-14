import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { sqsClient } from '../client/index.js';
import { sqsClientConfig } from '../../config/sqs/sqsClientConfig.js';
import { logger } from '../../utils/logger.js';

const CONTEXT = 'sqsProducer';

/**
 * Sends a job payload to an SQS queue.
 *
 * @param {string} [queueName] - Target queue name (defaults to DOCUMENT_PROCESSING queue)
 * @param {Object} payload - Document ingestion parameters { documentId, sessionId, userId, s3Key, fileName, mimeType }
 * @returns {Promise<{ messageId: string }>}
 */
export async function sendDocumentJob(payload, queueName) {
  const SUB_CONTEXT = sendDocumentJob.name;
  const targetQueue = queueName || sqsClientConfig.QUEUES.DOCUMENT_PROCESSING;

  logger.info('Sending document processing job to SQS', CONTEXT, SUB_CONTEXT, {
    documentId: payload.documentId,
    sessionId: payload.sessionId,
    targetQueue,
  });

  try {
    const queueUrl = await sqsClient.getOrCreateQueueUrl(targetQueue);
    const client = sqsClient.getInstance();

    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(payload),
    });

    const res = await client.send(command);
    logger.info('Document job dispatched to SQS queue', CONTEXT, SUB_CONTEXT, {
      messageId: res.MessageId,
      documentId: payload.documentId,
      targetQueue,
    });
    return { messageId: res.MessageId };
  } catch (err) {
    logger.error('Failed to send document job to SQS', CONTEXT, SUB_CONTEXT, {
      documentId: payload.documentId,
      error: err.message,
      targetQueue,
    });
    throw err;
  }
}

export const sqsProducer = {
  sendDocumentJob,
};

export default sqsProducer;
