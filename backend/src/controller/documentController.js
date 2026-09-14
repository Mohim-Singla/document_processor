import { v4 as uuidv4 } from 'uuid';
import { mongoRepositories } from '../db/mongo/repository/index.js';
import { s3Service } from '../service/s3Service.js';
import { parsingService } from '../service/parsingService.js';
import { geminiService } from '../service/geminiService.js';
import { logger } from '../utils/logger.js';

const CONTEXT = 'documentController';

export async function listDocuments(req, res) {
  const SUB_CONTEXT = listDocuments.name;
  try {
    const { id: sessionId } = req.params;
    const userId = req.user.userId;

    logger.info('Listing documents for session', CONTEXT, SUB_CONTEXT, { sessionId, userId });

    // IDOR Check: Ensure parent session belongs to this user
    const session = await mongoRepositories.sessions.fetchOne({ sessionId, userId });
    if (!session) {
      logger.warn('Session not found or unauthorized for document list', CONTEXT, SUB_CONTEXT, { sessionId, userId });
      return res.error('Session not found or unauthorized', 'FORBIDDEN', 404);
    }

    const documents = await mongoRepositories.documents.fetchAll({ sessionId, userId });
    logger.info('Documents listed successfully', CONTEXT, SUB_CONTEXT, { sessionId, count: documents.length });
    return res.success('Documents fetched successfully', documents);
  } catch (error) {
    logger.error('Error fetching documents', CONTEXT, SUB_CONTEXT, { error: error.message });
    return res.error('Failed to fetch documents', error.message, 500);
  }
}

export async function uploadDocuments(req, res) {
  const SUB_CONTEXT = uploadDocuments.name;
  try {
    const { id: sessionId } = req.params;
    const userId = req.user.userId;
    const files = req.files || [];

    logger.info('Received document upload request', CONTEXT, SUB_CONTEXT, { sessionId, userId, fileCount: files.length });

    if (files.length === 0) {
      logger.warn('Document upload failed: No files provided', CONTEXT, SUB_CONTEXT);
      return res.error('No files uploaded', 'Validation Error', 400);
    }

    // IDOR Check: Ensure target session belongs to the user
    const session = await mongoRepositories.sessions.fetchOne({ sessionId, userId });
    if (!session) {
      logger.warn('Session not found or unauthorized for document upload', CONTEXT, SUB_CONTEXT, { sessionId, userId });
      return res.error('Session not found or unauthorized', 'FORBIDDEN', 404);
    }

    const createdDocs = [];

    for (const file of files) {
      const documentId = uuidv4();
      const s3Key = `sessions/${sessionId}/${documentId}/${file.originalname}`;

      logger.info('Uploading file to S3', CONTEXT, SUB_CONTEXT, { documentId, fileName: file.originalname, size: file.size });

      // 1. Upload raw file to S3
      const s3Result = await s3Service.uploadToS3({
        key: s3Key,
        buffer: file.buffer,
        mimeType: file.mimetype,
      });

      // 2. Insert record into MongoDB documents collection with owner userId
      const docRecord = await mongoRepositories.documents.create({
        documentId,
        sessionId,
        userId,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        s3Key,
        s3Bucket: s3Result.bucket,
        status: 'PROCESSING',
      });

      createdDocs.push(docRecord);

      // 3. Process asynchronously (parse, embed, index)
      (async () => {
        const INGEST_SUB_CONTEXT = 'processAsyncDocument';
        try {
          logger.info('Starting async document ingestion', CONTEXT, INGEST_SUB_CONTEXT, { documentId, fileName: file.originalname });

          const { pageCount, chunks } = await parsingService.parseDocument({
            buffer: file.buffer,
            fileName: file.originalname,
            mimeType: file.mimetype,
            documentId,
            sessionId,
          });

          logger.info('Document parsed into chunks', CONTEXT, INGEST_SUB_CONTEXT, { documentId, chunkCount: chunks.length, pageCount });

          // Attach owner userId to each chunk and compute embedding
          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            chunk.userId = userId;
            chunk.embedding = await geminiService.getEmbedding(chunk.content);
            logger.debug('Computed chunk embedding', CONTEXT, INGEST_SUB_CONTEXT, { documentId, chunkIndex: i + 1, totalChunks: chunks.length });
          }

          if (chunks.length > 0) {
            await mongoRepositories.documentChunks.bulkInsert(chunks);
          }

          await mongoRepositories.documents.update(
            { documentId, userId },
            { status: 'READY', pageCount }
          );

          // Increment documentCount on session
          await mongoRepositories.sessions.incrementDocCount(sessionId, 1);
          logger.info('Document ingestion completed successfully', CONTEXT, INGEST_SUB_CONTEXT, { documentId, status: 'READY' });
        } catch (err) {
          logger.error('Document ingestion failed', CONTEXT, INGEST_SUB_CONTEXT, { documentId, error: err.message });
          await mongoRepositories.documents.update(
            { documentId, userId },
            { status: 'FAILED', errorMessage: err.message }
          );
        }
      })();
    }

    return res.success('Documents uploaded and processing started', createdDocs, 202);
  } catch (error) {
    logger.error('Error uploading documents', CONTEXT, SUB_CONTEXT, { error: error.message });
    return res.error('Failed to upload documents', error.message, 500);
  }
}

export async function getPreviewUrl(req, res) {
  const SUB_CONTEXT = getPreviewUrl.name;
  try {
    const { docId } = req.params;
    const userId = req.user.userId;

    logger.info('Generating presigned preview URL', CONTEXT, SUB_CONTEXT, { docId, userId });

    // IDOR Check: Ensure document belongs to this user
    const document = await mongoRepositories.documents.fetchOne({ documentId: docId, userId });

    if (!document) {
      logger.warn('Document not found or unauthorized for preview', CONTEXT, SUB_CONTEXT, { docId, userId });
      return res.error('Document not found or unauthorized', 'FORBIDDEN', 404);
    }

    const url = await s3Service.getPresignedDownloadUrl({ key: document.s3Key });
    logger.info('Preview URL generated successfully', CONTEXT, SUB_CONTEXT, { docId });
    return res.success('Presigned preview URL generated', { url });
  } catch (error) {
    logger.error('Error getting preview URL', CONTEXT, SUB_CONTEXT, { error: error.message });
    return res.error('Failed to generate preview URL', error.message, 500);
  }
}

export async function deleteDocument(req, res) {
  const SUB_CONTEXT = deleteDocument.name;
  try {
    const { id: sessionId, docId } = req.params;
    const userId = req.user.userId;

    logger.info('Deleting document', CONTEXT, SUB_CONTEXT, { sessionId, docId, userId });

    // IDOR Check: Ensure document belongs to this user and session
    const document = await mongoRepositories.documents.fetchOne({ documentId: docId, sessionId, userId });

    if (!document) {
      logger.warn('Document not found or unauthorized for deletion', CONTEXT, SUB_CONTEXT, { sessionId, docId, userId });
      return res.error('Document not found or unauthorized', 'FORBIDDEN', 404);
    }

    await s3Service.deleteFromS3({ key: document.s3Key }).catch(() => {});
    await mongoRepositories.documentChunks.deleteByDocument(docId, { userId });
    await mongoRepositories.documents.destroy({ documentId: docId, userId });
    await mongoRepositories.sessions.incrementDocCount(sessionId, -1);

    logger.info('Document deleted successfully', CONTEXT, SUB_CONTEXT, { docId });
    return res.success('Document deleted successfully');
  } catch (error) {
    logger.error('Error deleting document', CONTEXT, SUB_CONTEXT, { error: error.message });
    return res.error('Failed to delete document', error.message, 500);
  }
}

export const documentController = {
  listDocuments,
  uploadDocuments,
  getPreviewUrl,
  deleteDocument,
};
