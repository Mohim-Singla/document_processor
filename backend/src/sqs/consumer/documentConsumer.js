import { mongoRepositories } from '../../db/mongo/repository/index.js';
import { s3Service } from '../../service/s3Service.js';
import { parsingService } from '../../service/parsingService.js';
import { aiService } from '../../service/aiService.js';
import { DOCUMENT_STATUS } from '../../utils/constant/status.js';
import { logger } from '../../utils/logger.js';

const CONTEXT = 'documentConsumer';

/**
 * Core processor for a document ingestion job:
 * 1. Uses provided in-memory buffer or downloads from S3 using s3Key
 * 2. Parses/OCRs document into chunks
 * 3. Generates high-level document summary
 * 4. Calculates contextualized vector embeddings via multi-provider AI service
 * 5. Saves document_chunks to MongoDB
 * 6. Updates document status to READY
 *
 * @param {Object} jobData
 * @param {string} jobData.documentId
 * @param {string} jobData.sessionId
 * @param {string} jobData.userId
 * @param {string} jobData.s3Key
 * @param {string} jobData.fileName
 * @param {string} jobData.mimeType
 * @param {Buffer} [jobData.buffer] - Optional in-memory buffer to bypass S3 download (e.g. upload fallback)
 * @returns {Promise<boolean>}
 */
export async function processDocumentJob({ documentId, sessionId, userId, s3Key, fileName, mimeType, buffer: providedBuffer = null }) {
  const SUB_CONTEXT = processDocumentJob.name;
  logger.info('Starting document processing job', CONTEXT, SUB_CONTEXT, { documentId, sessionId, fileName });

  try {
    // 0. Active check & Idempotency: If document or parent session is deleted, skip
    const existingDoc = await mongoRepositories.documents.fetchOne({ documentId, isDeleted: false });
    const existingSession = await mongoRepositories.sessions.fetchOne({ sessionId, isDeleted: false });

    if (!existingDoc || !existingSession) {
      logger.info('Document or parent session no longer active. Skipping ingestion and discarding job.', CONTEXT, SUB_CONTEXT, {
        documentId,
        sessionId,
      });
      return true;
    }

    if (existingDoc.status === DOCUMENT_STATUS.READY) {
      logger.info('Document already marked as READY/completed. Skipping processing.', CONTEXT, SUB_CONTEXT, {
        documentId,
        sessionId,
        status: existingDoc.status,
      });
      return true;
    }

    // 1. Obtain file buffer (from argument if in-process upload fallback, or download from S3)
    const buffer = providedBuffer || await s3Service.getObjectBuffer({ key: s3Key });

    // 2. Parse / OCR document into chunks
    const { pageCount, rawText, chunks } = await parsingService.parseDocument({
      buffer,
      fileName,
      mimeType,
      documentId,
      sessionId,
    });

    logger.info('Document parsed successfully', CONTEXT, SUB_CONTEXT, { documentId, chunkCount: chunks.length, pageCount });

    // 3. Generate high-level summary first so chunk embeddings can be contextualized
    const summaryResult = await aiService.generateDocumentSummary(rawText);
    const summary = summaryResult?.summary || '';
    const summaryAiVendor = summaryResult?.aiVendor || null;
    const summaryAiModel = summaryResult?.aiModel || null;

    // 4. Compute chunk embeddings contextualized with document summary and fileName
    await aiService.getEmbeddingsForChunks(chunks, userId, {
      summary,
      fileName,
    });

    // 5. Check if document or session was deleted while async parsing/embedding was running
    const [activeDoc, activeSession] = await Promise.all([
      mongoRepositories.documents.fetchOne({ documentId, userId, isDeleted: false }),
      mongoRepositories.sessions.fetchOne({ sessionId, userId, isDeleted: false }),
    ]);

    if (!activeDoc || !activeSession) {
      logger.info('Document or session deleted during async processing. Skipping persistence.', CONTEXT, SUB_CONTEXT, { documentId, sessionId });
      return true;
    }

    // 6. Bulk insert chunks into MongoDB
    if (chunks.length > 0) {
      await mongoRepositories.documentChunks.bulkInsert(chunks);
    }

    // 7. Update document status to READY and persist summary with AI vendor/model metadata
    await mongoRepositories.documents.update(
      { documentId, userId },
      {
        status: DOCUMENT_STATUS.READY,
        pageCount,
        summary,
        summaryAiVendor,
        summaryAiModel,
        errorMessage: null,
      }
    );

    logger.info('Document processing job completed successfully', CONTEXT, SUB_CONTEXT, {
      documentId,
      status: DOCUMENT_STATUS.READY,
      chunkCount: chunks.length,
      hasSummary: Boolean(summary),
      summaryAiVendor,
      summaryAiModel,
    });

    return true;
  } catch (err) {
    logger.error('Failed to process document job', CONTEXT, SUB_CONTEXT, {
      documentId,
      error: err.message,
    });

    // Mark as FAILED in MongoDB so user sees error in UI
    try {
      await mongoRepositories.documents.update(
        { documentId, userId },
        { status: DOCUMENT_STATUS.FAILED, errorMessage: err.message }
      );
    } catch (dbErr) {
      logger.error('Failed to update document status to FAILED', CONTEXT, SUB_CONTEXT, { error: dbErr.message });
    }

    throw err;
  }
}

/**
 * Consumes an SQS message containing a document processing job
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
    logger.critical('Invalid JSON payload in SQS message', CONTEXT, SUB_CONTEXT, { body: sqsMessage.Body, error: err.message });
    throw err;
  }

  return processDocumentJob(jobData);
}

export default processDocumentMessage;
