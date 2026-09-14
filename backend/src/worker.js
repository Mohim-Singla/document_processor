/* eslint-disable import/first */
import { serviceConfig } from './config/index.js';

serviceConfig;
import { mongoConnection } from './db/mongo/connection/index.js';
import { mysqlConnection } from './db/mysql/connection/index.js';
import { sqsClient } from './sqs/client/index.js';
import { sqsClientConfig } from './config/sqs/sqsClientConfig.js';
import { processDocumentMessage } from './sqs/consumer/documentConsumer.js';
import { logger } from './utils/logger.js';

const CONTEXT = 'workerService';

async function startWorker() {
  const SUB_CONTEXT = 'startWorker';
  logger.info('Starting standalone Document Processor Background Worker...', CONTEXT, SUB_CONTEXT);

  try {
    // 1. Connect to persistence layers
    await Promise.all([
      mongoConnection.init(),
      mysqlConnection.init(),
    ]);
    logger.info('Worker connected to MongoDB and MySQL databases', CONTEXT, SUB_CONTEXT);

    // 2. Initialize and verify all SQS queues exist on AWS (auto-create if missing)
    await sqsClient.initAllQueues();

    // 3. Start SQS Consumers for queues
    const consumers = [];

    // Document processing consumer
    const docConsumer = await sqsClient.initConsumer({
      queueName: sqsClientConfig.QUEUES.DOCUMENT_PROCESSING,
      handleMessage: processDocumentMessage,
    });
    consumers.push(docConsumer);

    logger.info('All consumers started. Worker is running and waiting for SQS jobs...', CONTEXT, SUB_CONTEXT);

    // Graceful shutdown handling
    const shutdown = () => {
      logger.info('Stopping all worker consumers...', CONTEXT, SUB_CONTEXT);
      consumers.forEach((c) => c.stop());
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err) {
    logger.critical('Fatal error in worker startup', CONTEXT, SUB_CONTEXT, { error: err.message });
    process.exit(1);
  }
}

startWorker();
