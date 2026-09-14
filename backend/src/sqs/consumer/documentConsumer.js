import { mongoRepositories } from '../../db/mongo/repository/index.js';
import { s3Service } from '../../service/s3Service.js';
import { parsingService } from '../../service/parsingService.js';
import { geminiService } from '../../service/geminiService.js';
import { logger } from '../../utils/logger.js';

const CONTEXT = 'documentConsumer';

/**
 * Consumes an SQS message containing a document processing job:
 * 1. Downloads file buffer from S3 using s3Key
 * 2. Parses/OCRs document into chunks
 * 3. Calculates vector embeddings via Gemini
 * 4. Saves document_chunks to MongoDB
 * 5. Updates document status to READY and increments session docCount
 *
 * @param {Object} sqsMessage
 * @returns {Promise<boolean>} True if processed and acknowledged
 */
export async function processDocumentMessage(sqsMessage) {
  const SUB_CONTEXT = processDocumentMessage.name;
  let jobData = null;

  try {
    jobData = JSON.parse(sqsMessage.Body);
  } catch (err) {
    logger.critical('Invalid JSON payload in SQS message', CONTEXT, SUB_CONTEXT, { body: sqsMessage.Body });
    return true; // Acknowledge bad payload to prevent deadlocks
  }

  const { documentId, sessionId, userId, s3Key, fileName, mimeType } = jobData;
  logger.info('Processing document job from SQS', CONTEXT, SUB_CONTEXT, { documentId, sessionId, fileName });

  try {
    // 0. Idempotency check: If document already processed and READY, skip and acknowledge
    const existingDoc = await mongoRepositories.documents.fetchOne({ documentId });
    if (existingDoc && existingDoc.status === 'READY') {
      logger.info('Document already marked as READY/completed. Skipping processing.', CONTEXT, SUB_CONTEXT, {
        documentId,
        sessionId,
        status: existingDoc.status,
      });
      return true;
    }

    // 1. Download file buffer from S3
    const buffer = await s3Service.getObjectBuffer({ key: s3Key });

    // 2. Parse / OCR document into chunks
    const { pageCount, chunks } = await parsingService.parseDocument({
      buffer,
      fileName,
      mimeType,
      documentId,
      sessionId,
    });

    logger.info('Document parsed by worker', CONTEXT, SUB_CONTEXT, { documentId, chunkCount: chunks.length, pageCount });

    // 3. Compute vector embeddings for each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      chunk.userId = userId;
      chunk.embedding = await geminiService.getEmbedding(chunk.content);
      logger.debug('Worker computed chunk embedding', CONTEXT, SUB_CONTEXT, {
        documentId,
        chunkIndex: i + 1,
        totalChunks: chunks.length,
      });
    }

    // 4. Bulk insert chunks into MongoDB
    if (chunks.length > 0) {
      await mongoRepositories.documentChunks.bulkInsert(chunks);
    }

    // 5. Update document status to READY
    await mongoRepositories.documents.update(
      { documentId, userId },
      { status: 'READY', pageCount }
    );

    logger.info('Document worker successfully completed ingestion', CONTEXT, SUB_CONTEXT, {
      documentId,
      status: 'READY',
      chunkCount: chunks.length,
    });

    return true; // Message acknowledged and removed from queue
  } catch (err) {
    logger.error('Worker failed to process document', CONTEXT, SUB_CONTEXT, {
      documentId,
      error: err.message,
    });

    // Mark as FAILED in MongoDB so user sees error in UI
    try {
      await mongoRepositories.documents.update(
        { documentId, userId },
        { status: 'FAILED', errorMessage: err.message }
      );
    } catch (dbErr) {
      logger.error('Failed to update document status to FAILED', CONTEXT, SUB_CONTEXT, { error: dbErr.message });
    }

    // Return true to remove from SQS if fatal, or throw to retry
    return true;
  }
}

export default processDocumentMessage;
