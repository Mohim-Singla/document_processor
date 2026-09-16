/* eslint-disable import/first */
// eslint-disable-next-line import/newline-after-import
import { serviceConfig } from './config/index.js';
serviceConfig;
import express from 'express';
import cors from 'cors';
import { routeMap } from './route/index.js';
import { responseHandler } from './middleware/responseHandler.js';
import { debugLogger } from './middleware/debug.js';
import { mongoConnection } from './db/mongo/connection/index.js';
// import { mysqlConnection } from './db/mysql/connection/index.js';
import http from 'http';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

async function main() {
  try {
    app.use(cors({
      origin: '*',
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }));
    app.use(express.json({ limit: '60mb', extended: true }));
    app.use(express.urlencoded({ extended: true }));
    app.use(debugLogger);
    app.use(responseHandler);

    // Initialize databases with resilient logging
    try {
      await Promise.all([
        mongoConnection.init(),
        // mysqlConnection.init(),
      ]);
      console.info('Database (MongoDB) successfully connected.');
    } catch (dbError) {
      console.warn('Database connection warning (check .env):', dbError.message);
    }

    app.get('/ping', (req, res) => {
      return res.success('Server is working fine.', { timestamp: Date.now() });
    });

    app.use('', routeMap);

    // =========================================================================
    // IN-PROCESS SQS BACKGROUND WORKER CONSUMER
    // (Comment out this block if deploying the worker as a separate instance)
    // =========================================================================
    try {
      const { sqsClient } = await import('./sqs/client/index.js');
      const { sqsClientConfig } = await import('./config/sqs/sqsClientConfig.js');
      const { processDocumentMessage } = await import('./sqs/consumer/documentConsumer.js');

      await sqsClient.initAllQueues();
      await sqsClient.initConsumer({
        queueName: sqsClientConfig.QUEUES.DOCUMENT_PROCESSING,
        handleMessage: processDocumentMessage,
      });
      console.info('In-process SQS Worker initialized and listening for document jobs.');
    } catch (workerError) {
      console.warn('Could not initialize in-process SQS consumer:', workerError.message);
    }
    // =========================================================================

    server.listen(PORT, (error) => {
      if (error) {
        throw error;
      }
      console.info('Backend service listening on PORT:', PORT);
    });
  } catch (error) {
    console.error('Bootstrap error:', error);
    process.exit(1);
  }
}

main();
