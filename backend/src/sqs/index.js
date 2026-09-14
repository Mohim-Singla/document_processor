import { sqsClient } from './client/index.js';
import { sqsProducer } from './producer/index.js';
import { processDocumentMessage } from './consumer/documentConsumer.js';

export const sqs = {
  client: sqsClient,
  producer: sqsProducer,
  consumer: {
    processDocumentMessage,
  },
};

export { sqsClient, sqsProducer, processDocumentMessage };
export default sqs;
